<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Producto;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ResumenController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $resumen = [
            'totalProductos' => Producto::count(),
            'productosConStockBajo' => Producto::whereColumn('stock', '<=', 'stock_minimo')->count(),
        ];

        if ($request->user()->rol->nombre === 'Administrador') {
            $usuarios = User::query()
                ->selectRaw('estado, COUNT(*) as cantidad')
                ->groupBy('estado')
                ->pluck('cantidad', 'estado');

            $resumen += [
                'totalUsuarios' => $usuarios->sum(),
                'usuariosActivos' => (int) ($usuarios['activo'] ?? 0),
                'usuariosInactivos' => (int) ($usuarios['inactivo'] ?? 0),
            ];
        }

        return response()->json($resumen);
    }
}
