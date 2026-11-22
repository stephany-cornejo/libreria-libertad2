<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Producto;
use Illuminate\Database\ForeignKeyConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

class ProductoController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Producto::query()->with('categoria:id,nombre')->orderBy('nombre')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $producto = Producto::create($this->validar($request));

        return response()->json($producto->load('categoria:id,nombre'), 201);
    }

    public function show(Producto $producto): JsonResponse
    {
        return response()->json($producto->load('categoria:id,nombre'));
    }

    public function update(Request $request, Producto $producto): JsonResponse
    {
        $producto->update($this->validar($request, $producto));

        return $this->show($producto);
    }

    public function destroy(Producto $producto): Response|JsonResponse
    {
        try {
            return $producto->getConnection()->transaction(function () use ($producto) {
                $actual = Producto::query()->lockForUpdate()->findOrFail($producto->id);
                if ($actual->stock > 0) {
                    return response()->json(['mensaje' => 'El producto aún tiene existencias.'], 409);
                }

                $actual->delete();

                return response()->noContent();
            });
        } catch (ForeignKeyConstraintViolationException) {
            return response()->json(['mensaje' => 'El producto tiene registros asociados.'], 409);
        }
    }

    private function validar(Request $request, ?Producto $producto = null): array
    {
        $codigoUnico = Rule::unique('productos', 'codigo');
        if ($producto) {
            $codigoUnico->ignore($producto);
        }

        return $request->validate([
            'categoria_id' => ['required', 'integer', 'exists:categorias,id'],
            'codigo' => ['required', 'string', 'max:50', $codigoUnico],
            'nombre' => ['required', 'string', 'max:150'],
            'descripcion' => ['nullable', 'string', 'max:500'],
            'precio' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:99999999.99'],
            'stock_minimo' => ['required', 'integer', 'min:0', 'max:4294967295'],
            'stock' => ['missing'],
        ]);
    }
}
