<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Producto;
use Illuminate\Http\JsonResponse;

class AlertaInventarioController extends Controller
{
    private const COLUMNAS = ['id', 'categoria_id', 'codigo', 'nombre', 'stock', 'stock_minimo'];

    /**
     * Productos agotados y productos con existencias en o por debajo del mínimo.
     */
    public function __invoke(): JsonResponse
    {
        $agotados = Producto::query()
            ->agotados()
            ->with('categoria:id,nombre')
            ->orderBy('nombre')
            ->get(self::COLUMNAS);

        $stockBajo = Producto::query()
            ->stockBajo()
            ->with('categoria:id,nombre')
            ->orderByRaw('stock / GREATEST(stock_minimo, 1)')
            ->orderBy('nombre')
            ->get(self::COLUMNAS)
            ->each(fn (Producto $producto) => $producto->setAttribute(
                'faltante', $producto->stock_minimo - $producto->stock,
            ));

        return response()->json([
            'resumen' => [
                'agotados' => $agotados->count(),
                'stock_bajo' => $stockBajo->count(),
                'total' => $agotados->count() + $stockBajo->count(),
            ],
            'agotados' => $agotados,
            'stock_bajo' => $stockBajo,
        ]);
    }
}
