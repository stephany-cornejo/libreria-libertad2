<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Categoria;
use Illuminate\Database\ForeignKeyConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

class CategoriaController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Categoria::query()->orderBy('nombre')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $categoria = Categoria::create($this->validar($request));

        return response()->json($categoria, 201);
    }

    public function show(Categoria $categoria): JsonResponse
    {
        return response()->json($categoria);
    }

    public function update(Request $request, Categoria $categoria): JsonResponse
    {
        $categoria->update($this->validar($request, $categoria));

        return $this->show($categoria);
    }

    public function destroy(Categoria $categoria): Response|JsonResponse
    {
        if ($categoria->productos()->exists()) {
            return response()->json(['mensaje' => 'La categoría tiene productos asociados.'], 409);
        }

        try {
            $categoria->delete();
        } catch (ForeignKeyConstraintViolationException) {
            return response()->json(['mensaje' => 'La categoría tiene productos asociados.'], 409);
        }

        return response()->noContent();
    }

    private function validar(Request $request, ?Categoria $categoria = null): array
    {
        $nombreUnico = Rule::unique('categorias', 'nombre');
        if ($categoria) {
            $nombreUnico->ignore($categoria);
        }

        return $request->validate([
            'nombre' => ['required', 'string', 'max:100', $nombreUnico],
            'descripcion' => ['nullable', 'string', 'max:500'],
        ]);
    }
}
