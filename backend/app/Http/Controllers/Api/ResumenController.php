<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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

        return response()->json([
            'skuDisponibles' => (int) $totales->sku,
            'unidadesDisponibles' => (int) $totales->unidades,
            'valorInventario' => (string) $totales->valor,
        ]);
    }
}
