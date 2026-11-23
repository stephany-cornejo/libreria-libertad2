<?php

namespace App\Services;

use App\Enums\ConceptoMovimiento;
use App\Enums\TipoMovimiento;
use App\Models\Movimiento;
use App\Models\Producto;
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
            ->whereBetween('fecha', [$desde, $hasta])
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

        return [
            'periodo' => $this->periodo($desde, $hasta),
            'totales' => [
                'unidades_entrada' => $total(TipoMovimiento::Entrada),
                'unidades_salida' => $total(TipoMovimiento::Salida),
            ],
            'por_concepto' => $conceptos->values(),
        ];
    }

    /**
     * Ventas del periodo: totales, evolución diaria y productos más vendidos.
     */
    public function ventas(Carbon $desde, Carbon $hasta, int $limiteProductos = 10): array
    {
        $ventas = fn () => Movimiento::query()
            ->where('concepto', ConceptoMovimiento::Venta)
            ->whereBetween('fecha', [$desde, $hasta]);

        $totales = $ventas()
            ->selectRaw('COUNT(*) AS ventas')
            ->selectRaw('COALESCE(SUM(cantidad), 0) AS unidades')
            ->selectRaw('COALESCE(SUM(cantidad * precio_unitario), 0) AS importe')
            ->toBase()
            ->first();

        $porDia = $ventas()
            ->selectRaw('DATE(fecha) AS dia')
            ->selectRaw('COUNT(*) AS ventas')
            ->selectRaw('SUM(cantidad) AS unidades')
            ->selectRaw('COALESCE(SUM(cantidad * precio_unitario), 0) AS importe')
            ->groupByRaw('DATE(fecha)')
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

    private function periodo(Carbon $desde, Carbon $hasta): array
    {
        return ['desde' => $desde->toDateString(), 'hasta' => $hasta->toDateString()];
    }

    private function dinero(mixed $valor): string
    {
        return number_format((float) $valor, 2, '.', '');
    }
}
