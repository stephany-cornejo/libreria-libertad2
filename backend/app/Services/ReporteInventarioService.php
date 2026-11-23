<?php

namespace App\Services;

use App\Enums\ConceptoMovimiento;
use App\Enums\TipoMovimiento;
use App\Models\Movimiento;
use App\Models\Producto;
use App\Support\ZonaHoraria;
use Carbon\CarbonPeriod;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Consultas agregadas de inventario y ventas.
 *
 * Todas las cifras se calculan en la base de datos para no cargar
 * los productos o movimientos en memoria.
 */
class ReporteInventarioService
{
    /**
     * Existencias y valorización actual del inventario, en total y por categoría.
     */
    public function inventario(): array
    {
        $totales = Producto::query()
            ->selectRaw('COUNT(*) AS productos')
            ->selectRaw('SUM(CASE WHEN stock > 0 THEN 1 ELSE 0 END) AS productos_disponibles')
            ->selectRaw('COALESCE(SUM(stock), 0) AS unidades')
            ->selectRaw('COALESCE(SUM(precio * stock), 0) AS valor')
            ->toBase()
            ->first();

        $porCategoria = DB::table('categorias')
            ->leftJoin('productos', 'productos.categoria_id', '=', 'categorias.id')
            ->groupBy('categorias.id', 'categorias.nombre')
            ->orderBy('categorias.nombre')
            ->select('categorias.id', 'categorias.nombre')
            ->selectRaw('COUNT(productos.id) AS productos')
            ->selectRaw('COALESCE(SUM(productos.stock), 0) AS unidades')
            ->selectRaw('COALESCE(SUM(productos.precio * productos.stock), 0) AS valor')
            ->selectRaw('SUM(CASE WHEN productos.id IS NOT NULL AND productos.stock = 0 THEN 1 ELSE 0 END) AS agotados')
            ->get()
            ->map(fn ($fila) => [
                'id' => (int) $fila->id,
                'nombre' => $fila->nombre,
                'productos' => (int) $fila->productos,
                'unidades' => (int) $fila->unidades,
                'valor' => $this->dinero($fila->valor),
                'agotados' => (int) $fila->agotados,
            ]);

        return [
            'totales' => [
                'productos' => (int) $totales->productos,
                'productos_disponibles' => (int) $totales->productos_disponibles,
                'unidades' => (int) $totales->unidades,
                'valor' => $this->dinero($totales->valor),
                'agotados' => Producto::query()->agotados()->count(),
                'stock_bajo' => Producto::query()->stockBajo()->count(),
            ],
            'por_categoria' => $porCategoria,
        ];
    }

    /**
     * Unidades e importe movidos por tipo y concepto en un periodo.
     */
    public function movimientos(Carbon $desde, Carbon $hasta): array
    {
        $filas = Movimiento::query()
            ->whereBetween('fecha', $this->rango($desde, $hasta))
            ->groupBy('tipo', 'concepto')
            ->select('tipo', 'concepto')
            ->selectRaw('COUNT(*) AS movimientos')
            ->selectRaw('SUM(cantidad) AS unidades')
            ->selectRaw('COALESCE(SUM(cantidad * precio_unitario), 0) AS importe')
            ->toBase()
            ->get()
            ->keyBy('concepto');

        $conceptos = collect(ConceptoMovimiento::cases())->map(function (ConceptoMovimiento $concepto) use ($filas) {
            $fila = $filas->get($concepto->value);

            return [
                'tipo' => $concepto->tipo()->value,
                'concepto' => $concepto->value,
                'etiqueta' => $concepto->etiqueta(),
                'movimientos' => (int) ($fila->movimientos ?? 0),
                'unidades' => (int) ($fila->unidades ?? 0),
                'importe' => $this->dinero($fila->importe ?? 0),
            ];
        });

        $total = fn (TipoMovimiento $tipo) => (int) $conceptos->where('tipo', $tipo->value)->sum('unidades');
        $totalMovimientos = fn (TipoMovimiento $tipo) => (int) $conceptos->where('tipo', $tipo->value)->sum('movimientos');

        $diarios = Movimiento::query()
            ->whereBetween('fecha', $this->rango($desde, $hasta))
            ->selectRaw($this->diaLocal().' AS dia')
            ->selectRaw("SUM(CASE WHEN tipo = 'entrada' THEN cantidad ELSE 0 END) AS entradas")
            ->selectRaw("SUM(CASE WHEN tipo = 'salida' THEN cantidad ELSE 0 END) AS salidas")
            ->groupByRaw($this->diaLocal())
            ->toBase()
            ->get()
            ->keyBy(fn ($fila) => (string) $fila->dia);

        return [
            'periodo' => $this->periodo($desde, $hasta),
            'totales' => [
                'movimientos_entrada' => $totalMovimientos(TipoMovimiento::Entrada),
                'movimientos_salida' => $totalMovimientos(TipoMovimiento::Salida),
                'unidades_entrada' => $total(TipoMovimiento::Entrada),
                'unidades_salida' => $total(TipoMovimiento::Salida),
                'variacion_neta' => $total(TipoMovimiento::Entrada) - $total(TipoMovimiento::Salida),
            ],
            'por_concepto' => $conceptos->values(),
            // Un registro por cada día del periodo, incluidos los días sin movimientos.
            'por_dia' => collect(CarbonPeriod::create($desde->copy()->startOfDay(), $hasta->copy()->startOfDay()))
                ->map(function (\DateTimeInterface $dia) use ($diarios) {
                    $fecha = $dia->format('Y-m-d');
                    $fila = $diarios->get($fecha);

                    return [
                        'fecha' => $fecha,
                        'entradas' => (int) ($fila->entradas ?? 0),
                        'salidas' => (int) ($fila->salidas ?? 0),
                    ];
                })
                ->values(),
        ];
    }

    /**
     * Existencias actuales por producto.
     *
     * @param  'agotados'|'stock_bajo'|'disponibles'|null  $estado
     */
    public function existencias(?string $estado = null, ?int $categoriaId = null): array
    {
        $productos = Producto::query()
            ->join('categorias', 'categorias.id', '=', 'productos.categoria_id')
            ->when($estado === 'agotados', fn ($q) => $q->agotados())
            ->when($estado === 'stock_bajo', fn ($q) => $q->stockBajo())
            ->when($estado === 'disponibles', fn ($q) => $q->whereColumn('productos.stock', '>', 'productos.stock_minimo'))
            ->when($categoriaId, fn ($q, $id) => $q->where('productos.categoria_id', $id))
            ->orderBy('categorias.nombre')
            ->orderBy('productos.nombre')
            ->get([
                'productos.id', 'productos.codigo', 'productos.nombre', 'productos.precio',
                'productos.stock', 'productos.stock_minimo', 'categorias.nombre as nombre_categoria',
            ])
            ->map(fn (Producto $p) => [
                'id' => $p->id,
                'codigo' => $p->codigo,
                'nombre' => $p->nombre,
                'categoria' => $p->nombre_categoria,
                'precio' => $this->dinero($p->precio),
                'stock' => $p->stock,
                'stock_minimo' => $p->stock_minimo,
                'valor' => $this->dinero((float) $p->precio * $p->stock),
                'estado' => match (true) {
                    $p->stock === 0 => 'agotado',
                    $p->stock <= $p->stock_minimo => 'stock_bajo',
                    default => 'disponible',
                },
            ]);

        return [
            'totales' => [
                'productos' => $productos->count(),
                'unidades' => (int) $productos->sum('stock'),
                'valor' => $this->dinero($productos->sum(fn ($p) => (float) $p['valor'])),
                'agotados' => $productos->where('estado', 'agotado')->count(),
                'stock_bajo' => $productos->where('estado', 'stock_bajo')->count(),
            ],
            'productos' => $productos->values(),
        ];
    }

    /**
     * Productos de poca rotación: con existencias, ordenados de menos a más
     * unidades vendidas en el periodo. Incluye los que no tuvieron ventas.
     */
    public function rotacion(Carbon $desde, Carbon $hasta, int $limite = 15): array
    {
        $ultimaVenta = Movimiento::query()
            ->selectRaw('MAX(fecha)')
            ->whereColumn('movimientos.producto_id', 'productos.id')
            ->where('concepto', ConceptoMovimiento::Venta);

        $productos = DB::table('productos')
            ->join('categorias', 'categorias.id', '=', 'productos.categoria_id')
            ->leftJoin('movimientos as ventas', function ($join) use ($desde, $hasta) {
                $join->on('ventas.producto_id', '=', 'productos.id')
                    ->where('ventas.concepto', '=', ConceptoMovimiento::Venta->value)
                    ->whereBetween('ventas.fecha', $this->rango($desde, $hasta));
            })
            ->where('productos.stock', '>', 0)
            ->groupBy('productos.id', 'productos.codigo', 'productos.nombre', 'productos.stock', 'productos.precio', 'categorias.nombre')
            ->select('productos.id', 'productos.codigo', 'productos.nombre', 'productos.stock', 'productos.precio', 'categorias.nombre as categoria')
            ->selectRaw('COALESCE(SUM(ventas.cantidad), 0) AS unidades_vendidas')
            ->selectSub($ultimaVenta->toBase(), 'ultima_venta')
            ->orderBy('unidades_vendidas')
            ->orderByDesc('productos.stock')
            ->orderBy('productos.nombre')
            ->limit($limite)
            ->get()
            ->map(fn ($fila) => [
                'id' => (int) $fila->id,
                'codigo' => $fila->codigo,
                'nombre' => $fila->nombre,
                'categoria' => $fila->categoria,
                'stock' => (int) $fila->stock,
                'unidades_vendidas' => (int) $fila->unidades_vendidas,
                'valor_inmovilizado' => $this->dinero((float) $fila->precio * (int) $fila->stock),
                'ultima_venta' => $fila->ultima_venta
                    ? Carbon::parse($fila->ultima_venta, ZonaHoraria::app())->toIso8601ZuluString()
                    : null,
                // Días naturales locales entre la última venta y el fin del periodo.
                'dias_sin_venta' => $fila->ultima_venta
                    ? (int) Carbon::parse($fila->ultima_venta, ZonaHoraria::app())->setTimezone($hasta->getTimezone())
                        ->startOfDay()->diffInDays($hasta->copy()->startOfDay())
                    : null,
            ]);

        return [
            'periodo' => $this->periodo($desde, $hasta),
            'productos' => $productos->values(),
        ];
    }

    /**
     * Ventas del periodo: totales, evolución diaria y productos más vendidos.
     */
    public function ventas(Carbon $desde, Carbon $hasta, int $limiteProductos = 10): array
    {
        $ventas = fn () => Movimiento::query()
            ->where('concepto', ConceptoMovimiento::Venta)
            ->whereBetween('fecha', $this->rango($desde, $hasta));

        $totales = $ventas()
            ->selectRaw('COUNT(*) AS ventas')
            ->selectRaw('COALESCE(SUM(cantidad), 0) AS unidades')
            ->selectRaw('COALESCE(SUM(cantidad * precio_unitario), 0) AS importe')
            ->toBase()
            ->first();

        $porDia = $ventas()
            ->selectRaw($this->diaLocal().' AS dia')
            ->selectRaw('COUNT(*) AS ventas')
            ->selectRaw('SUM(cantidad) AS unidades')
            ->selectRaw('COALESCE(SUM(cantidad * precio_unitario), 0) AS importe')
            ->groupByRaw($this->diaLocal())
            ->orderBy('dia')
            ->toBase()
            ->get()
            ->map(fn ($fila) => [
                'fecha' => (string) $fila->dia,
                'ventas' => (int) $fila->ventas,
                'unidades' => (int) $fila->unidades,
                'importe' => $this->dinero($fila->importe),
            ]);

        $masVendidos = $ventas()
            ->join('productos', 'productos.id', '=', 'movimientos.producto_id')
            ->groupBy('productos.id', 'productos.codigo', 'productos.nombre')
            ->select('productos.id', 'productos.codigo', 'productos.nombre')
            ->selectRaw('SUM(movimientos.cantidad) AS unidades')
            ->selectRaw('COALESCE(SUM(movimientos.cantidad * movimientos.precio_unitario), 0) AS importe')
            ->orderByDesc('unidades')
            ->orderBy('productos.nombre')
            ->limit($limiteProductos)
            ->toBase()
            ->get()
            ->map(fn ($fila) => [
                'id' => (int) $fila->id,
                'codigo' => $fila->codigo,
                'nombre' => $fila->nombre,
                'unidades' => (int) $fila->unidades,
                'importe' => $this->dinero($fila->importe),
            ]);

        return [
            'periodo' => $this->periodo($desde, $hasta),
            'totales' => [
                'ventas' => (int) $totales->ventas,
                'unidades' => (int) $totales->unidades,
                'importe' => $this->dinero($totales->importe),
            ],
            'por_dia' => $porDia,
            'mas_vendidos' => $masVendidos,
        ];
    }

    /**
     * Productos cuyo stock no coincide con el saldo de sus movimientos
     * (entradas menos salidas). Un producto con stock y sin movimientos
     * también se reporta, porque sus existencias no tienen origen registrado.
     */
    public function inconsistencias(): array
    {
        $saldo = "COALESCE(SUM(CASE WHEN movimientos.tipo = 'entrada' THEN movimientos.cantidad "
            ."WHEN movimientos.tipo = 'salida' THEN -CAST(movimientos.cantidad AS SIGNED) ELSE 0 END), 0)";

        return DB::table('productos')
            ->leftJoin('movimientos', 'movimientos.producto_id', '=', 'productos.id')
            ->groupBy('productos.id', 'productos.codigo', 'productos.nombre', 'productos.stock')
            ->select('productos.id', 'productos.codigo', 'productos.nombre', 'productos.stock')
            ->selectRaw("{$saldo} AS stock_calculado")
            ->havingRaw("productos.stock <> {$saldo}")
            ->orderBy('productos.codigo')
            ->get()
            ->map(fn ($fila) => [
                'id' => (int) $fila->id,
                'codigo' => $fila->codigo,
                'nombre' => $fila->nombre,
                'stock' => (int) $fila->stock,
                'stock_calculado' => (int) $fila->stock_calculado,
            ])
            ->all();
    }

    /**
     * Límites del periodo en la zona de la base de datos. $desde y $hasta llegan
     * como inicio y fin de días locales (ver ReporteController::periodo).
     *
     * @return array{0: Carbon, 1: Carbon}
     */
    private function rango(Carbon $desde, Carbon $hasta): array
    {
        return [ZonaHoraria::enBase($desde), ZonaHoraria::enBase($hasta)];
    }

    /** Día local de un movimiento, para agrupar por día. */
    private function diaLocal(): string
    {
        return 'DATE('.ZonaHoraria::columnaLocal('fecha').')';
    }

    private function periodo(Carbon $desde, Carbon $hasta): array
    {
        return ['desde' => $desde->toDateString(), 'hasta' => $hasta->toDateString()];
    }

    private function dinero(mixed $valor): string
    {
        return number_format((float) $valor, 2, '.', '');
    }
}
