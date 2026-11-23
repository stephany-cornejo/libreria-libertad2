<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Categoria;
use App\Models\Producto;
use Illuminate\Http\JsonResponse;

class ResumenController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $totales = Producto::query()
            ->where('stock', '>', 0)
            ->selectRaw('COUNT(*) AS sku, COALESCE(SUM(stock), 0) AS unidades, COALESCE(SUM(precio * stock), 0) AS valor')
            ->toBase()
            ->first();

        $categorias = Categoria::query()->orderBy('nombre')->get(['id', 'nombre']);
        $destacados = Producto::query()
            ->where('stock', '>', 0)
            ->orderByDesc('stock')
            ->orderBy('id')
            ->limit(6)
            ->get(['id', 'codigo', 'nombre', 'precio', 'stock']);

        return response()->json([
            'categorias' => $categorias,
            'destacados' => $destacados,
            'skuDisponibles' => (int) $totales->sku,
            'unidadesDisponibles' => (int) $totales->unidades,
            'valorInventario' => (string) $totales->valor,
        ]);
    }
}
