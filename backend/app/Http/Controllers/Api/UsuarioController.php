<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UsuarioController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(
            User::with('rol:id,nombre')
                ->orderBy('id', 'desc')
                ->get()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'name' => 'required|string|max:100',
            'usuario' => [
                'required', 'string', 'max:50',
                Rule::unique('users', 'usuario')
            ],
            'email' => [
                'required', 'email', 'max:191',
                Rule::unique('users', 'email')
            ],
            'password' => 'required|string|min:8',
            'id_rol' => 'required|exists:roles,id',
            'estado' => 'required|in:activo,inactivo',
        ]);

        $datos['password'] = Hash::make($datos['password']);

        $usuario = User::create($datos);

        return response()->json([
            'mensaje' => 'Usuario registrado correctamente',
            'usuario' => $usuario->load('rol'),
        ], 201);
    }

    public function show(User $usuario): JsonResponse
    {
        return response()->json($usuario->load('rol'));
    }

    public function update(
        Request $request,
        User $usuario
    ): JsonResponse {
        $datos = $request->validate([
            'name' => 'required|string|max:100',
            'usuario' => [
                'required', 'string', 'max:50',
                Rule::unique('users', 'usuario')->ignore($usuario->id)
            ],
            'email' => [
                'nullable', 'email', 'max:191',
                Rule::unique('users', 'email')->ignore($usuario->id)
            ],
            'password' => 'nullable|string|min:8',
            'id_rol' => 'required|exists:roles,id',
            'estado' => 'required|in:activo,inactivo',
        ]);

        // Evitar que el administrador se quite sus propios permisos.
        if ($request->user()->id === $usuario->id) {
            if (
                $datos['estado'] !== 'activo' ||
                (int) $datos['id_rol'] !== (int) $usuario->id_rol
            ) {
                return response()->json([
                    'mensaje' => 'No puedes desactivar tu propia cuenta ni cambiar tu rol.'
                ], 422);
            }
        }

        if (empty($datos['password'])) {
            unset($datos['password']);
        } else {
            $datos['password'] = Hash::make($datos['password']);
        }

        $usuario->update($datos);

        return response()->json([
            'mensaje' => 'Usuario actualizado correctamente',
            'usuario' => $usuario->load('rol'),
        ]);
    }
}
