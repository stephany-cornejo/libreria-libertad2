<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Proveedor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProveedorController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filtros = $request->validate([
            'buscar' => ['nullable', 'string', 'max:100'],
            'estado' => ['nullable', Rule::in([Proveedor::ACTIVO, Proveedor::INACTIVO])],
        ]);

        $proveedores = Proveedor::query()
            ->withCount('movimientos')
            ->when($filtros['estado'] ?? null, fn ($consulta, $estado) => $consulta->where('estado', $estado))
            ->when($filtros['buscar'] ?? null, function ($consulta, $texto) {
                $patron = '%'.addcslashes($texto, '%_\\').'%';
                $consulta->where(fn ($q) => $q
                    ->where('codigo', 'like', $patron)
                    ->orWhere('nombre', 'like', $patron)
                    ->orWhere('contacto', 'like', $patron)
                    ->orWhere('email', 'like', $patron));
            })
            ->orderBy('nombre')
            ->get();

        return response()->json($proveedores);
    }

    public function store(Request $request): JsonResponse
    {
        $proveedor = Proveedor::create($this->validar($request));

        return response()->json($proveedor->refresh(), 201);
    }

    public function show(Proveedor $proveedor): JsonResponse
    {
        return response()->json($proveedor->loadCount('movimientos'));
    }

    public function update(Request $request, Proveedor $proveedor): JsonResponse
    {
        $proveedor->update($this->validar($request, $proveedor));

        return $this->show($proveedor);
    }

    /**
     * Activa o desactiva un proveedor. Los proveedores no se eliminan
     * para conservar la trazabilidad de los movimientos que los referencian.
     */
    public function cambiarEstado(Request $request, Proveedor $proveedor): JsonResponse
    {
        $datos = $request->validate([
            'estado' => ['required', Rule::in([Proveedor::ACTIVO, Proveedor::INACTIVO])],
        ]);

        $proveedor->forceFill(['estado' => $datos['estado']])->save();

        return $this->show($proveedor);
    }

    private function validar(Request $request, ?Proveedor $proveedor = null): array
    {
        $codigoUnico = Rule::unique('proveedores', 'codigo');
        if ($proveedor) {
            $codigoUnico->ignore($proveedor);
        }

        return $request->validate([
            'codigo' => ['required', 'string', 'max:50', $codigoUnico],
            'nombre' => ['required', 'string', 'max:150'],
            'contacto' => ['nullable', 'string', 'max:100'],
            'email' => ['nullable', 'string', 'email', 'max:191'],
            'telefono' => ['nullable', 'string', 'max:30', 'regex:/^[0-9+()\-\s]+$/'],
            'direccion' => ['nullable', 'string', 'max:250'],
            'estado' => ['missing'],
        ], [
            'telefono.regex' => 'El teléfono solo puede contener números, espacios y los signos + ( ) -.',
            'estado.missing' => 'El estado se cambia desde la opción de activar o desactivar.',
        ]);
    }
}
