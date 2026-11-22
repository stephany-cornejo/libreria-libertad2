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
