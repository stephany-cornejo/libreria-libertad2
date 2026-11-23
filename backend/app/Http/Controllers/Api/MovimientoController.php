<?php

namespace App\Http\Controllers\Api;

use App\Enums\ConceptoMovimiento;
use App\Enums\TipoMovimiento;
use App\Http\Controllers\Controller;
use App\Models\Movimiento;
use App\Services\InventarioService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

class MovimientoController extends Controller
{
    private const RELACIONES = [
        'producto:id,codigo,nombre,stock,stock_minimo',
        'proveedor:id,codigo,nombre',
        'usuario:id,name,usuario',
    ];

    public function __construct(private readonly InventarioService $inventario) {}

    /**
     * Historial de movimientos, del más reciente al más antiguo.
     */
    public function index(Request $request): JsonResponse
    {
        $filtros = $request->validate([
            'producto_id' => ['nullable', 'integer'],
            'proveedor_id' => ['nullable', 'integer'],
            'usuario_id' => ['nullable', 'integer'],
            'tipo' => ['nullable', Rule::enum(TipoMovimiento::class)],
            'concepto' => ['nullable', Rule::enum(ConceptoMovimiento::class)],
            'desde' => ['nullable', 'date_format:Y-m-d'],
            'hasta' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:desde'],
            'buscar' => ['nullable', 'string', 'max:100'],
            'por_pagina' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $movimientos = $this->filtrar(Movimiento::query(), $filtros)
            ->with(self::RELACIONES)
            ->orderByDesc('fecha')
            ->orderByDesc('id')
            ->paginate($filtros['por_pagina'] ?? 25)
            ->withQueryString();

        return response()->json($movimientos);
    }

    public function show(Movimiento $movimiento): JsonResponse
    {
        return response()->json($movimiento->load(self::RELACIONES));
    }

    public function registrarEntrada(Request $request): JsonResponse
    {
        return $this->registrar($request, TipoMovimiento::Entrada);
    }

    public function registrarSalida(Request $request): JsonResponse
    {
        return $this->registrar($request, TipoMovimiento::Salida);
    }

    /**
     * Catálogo de conceptos con sus reglas, para construir formularios.
     */
    public function conceptos(): JsonResponse
    {
        return response()->json(collect(ConceptoMovimiento::cases())->map(fn (ConceptoMovimiento $concepto) => [
            'valor' => $concepto->value,
            'etiqueta' => $concepto->etiqueta(),
            'tipo' => $concepto->tipo()->value,
            'requiere_proveedor' => $concepto->requiereProveedor(),
            'admite_proveedor' => $concepto->admiteProveedor(),
            'requiere_motivo' => $concepto->requiereMotivo(),
            'motivo_predeterminado' => $concepto->motivoPredeterminado(),
            'solo_administrador' => $concepto->requiereAutorizacion(),
        ]));
    }

    private function registrar(Request $request, TipoMovimiento $tipo): JsonResponse
    {
        $conceptos = array_column($tipo->conceptos(), 'value');

        $datos = $request->validate([
            'producto_id' => ['required', 'integer', 'exists:productos,id'],
            'concepto' => ['required', 'string', Rule::in($conceptos)],
            'cantidad' => ['required', 'integer', 'min:1', 'max:1000000'],
            'proveedor_id' => ['nullable', 'integer', 'exists:proveedores,id'],
            'precio_unitario' => ['nullable', 'numeric', 'decimal:0,2', 'min:0', 'max:99999999.99'],
            'fecha' => ['nullable', 'date', 'before_or_equal:now'],
            'referencia' => ['nullable', 'string', 'max:80', 'unique:movimientos,referencia'],
            'motivo' => ['nullable', 'string', 'max:250'],
        ], [
            'concepto.in' => "El concepto no corresponde a una {$tipo->value}. Valores permitidos: ".implode(', ', $conceptos).'.',
            'cantidad.min' => 'La cantidad debe ser un número entero mayor que cero.',
            'fecha.before_or_equal' => 'La fecha del movimiento no puede ser futura.',
            'referencia.unique' => 'Ya existe un movimiento con esa referencia.',
        ]);

        $movimiento = $this->inventario->registrar($request->user(), $datos);

        return response()->json($movimiento->load(self::RELACIONES), 201);
    }

    private function filtrar(Builder $consulta, array $filtros): Builder
    {
        return $consulta
            ->when($filtros['producto_id'] ?? null, fn ($q, $id) => $q->where('producto_id', $id))
            ->when($filtros['proveedor_id'] ?? null, fn ($q, $id) => $q->where('proveedor_id', $id))
            ->when($filtros['usuario_id'] ?? null, fn ($q, $id) => $q->where('usuario_id', $id))
            ->when($filtros['tipo'] ?? null, fn ($q, $tipo) => $q->where('tipo', $tipo))
            ->when($filtros['concepto'] ?? null, fn ($q, $concepto) => $q->where('concepto', $concepto))
            ->when($filtros['desde'] ?? null, fn ($q, $desde) => $q->where('fecha', '>=', Carbon::parse($desde)->startOfDay()))
            ->when($filtros['hasta'] ?? null, fn ($q, $hasta) => $q->where('fecha', '<=', Carbon::parse($hasta)->endOfDay()))
            ->when($filtros['buscar'] ?? null, function ($q, $texto) {
                $patron = '%'.addcslashes($texto, '%_\\').'%';
                $q->where(fn ($sub) => $sub
                    ->where('referencia', 'like', $patron)
                    ->orWhere('motivo', 'like', $patron)
                    ->orWhereHas('producto', fn ($p) => $p
                        ->where('codigo', 'like', $patron)
                        ->orWhere('nombre', 'like', $patron)));
            });
    }
}
