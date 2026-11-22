<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::get('/estado', function () {
    return response()->json([
        'mensaje' => 'API de Libreria Independencia funcionando',
        'estado' => 'ok'
    ]);
});

Route::get('/perfil', function (Request $request) {
    $usuario = $request->user()->load('rol');

    return response()->json([
        'id' => $usuario->id,
        'nombre' => $usuario->name,
        'usuario' => $usuario->usuario,
        'estado' => $usuario->estado,
        'rol' => $usuario->rol->nombre,
    ]);
})->middleware('auth:sanctum');