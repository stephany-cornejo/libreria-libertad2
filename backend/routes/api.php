<?php

use App\Http\Controllers\Api\UsuarioController;
use App\Models\Rol;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', 'rol'])->group(function () {
    Route::get('/perfil', function (Request $request) {
        $usuario = $request->user()->loadMissing('rol');

        return response()->json([
            'id' => $usuario->id,
            'nombre' => $usuario->name,
            'usuario' => $usuario->usuario,
            'estado' => $usuario->estado,
            'rol' => $usuario->rol->nombre,
        ]);
    });

    Route::middleware('rol:Administrador')->group(function () {
        Route::get('/roles', fn () => Rol::orderBy('nombre')->get(['id', 'nombre']));
        Route::apiResource('usuarios', UsuarioController::class)->except(['destroy']);
    });
});
