<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerificarRol
{
    public function handle(
        Request $request,
        Closure $next,
        ?string $rol = null
    ): Response {

        $usuario = $request->user();

        if (!$usuario) {
            return response()->json([
                'mensaje' => 'No autenticado.'
            ], 401);
        }

        if ($usuario->estado !== 'activo') {
            return response()->json([
                'mensaje' => 'La cuenta está inactiva.'
            ], 403);
        }

        $nombreRol = $usuario->rol?->nombre;

        if (!$nombreRol) {
            return response()->json([
                'mensaje' => 'El usuario no tiene un rol válido.'
            ], 403);
        }

        if (
            $rol !== null &&
            $nombreRol !== 'Administrador' &&
            $nombreRol !== $rol
        ) {
            return response()->json([
                'mensaje' => 'No tienes permisos para esta operación.'
            ], 403);
        }

        return $next($request);
    }
}
