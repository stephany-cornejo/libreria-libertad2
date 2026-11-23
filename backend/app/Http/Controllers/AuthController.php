<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'usuario' => 'required|string',
            'password' => 'required|string',
        ]);

        $credenciales = [
            'usuario' => $datos['usuario'],
            'password' => $datos['password'],
            'estado' => 'activo',
        ];

        if (!Auth::attempt($credenciales)) {
            throw ValidationException::withMessages([
                'usuario' => [
                    'Credenciales incorrectas o cuenta inactiva.'
                ],
            ]);
        }

        $request->session()->regenerate();

        $usuario = $request->user()->load('rol');

        return response()->json([
            'mensaje' => 'Inicio de sesión exitoso',
            'usuario' => [
                'id' => $usuario->id,
                'nombre' => $usuario->name,
                'usuario' => $usuario->usuario,
                'rol' => $usuario->rol->nombre,
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json([
            'mensaje' => 'Sesión cerrada correctamente',
        ]);
    }
}
