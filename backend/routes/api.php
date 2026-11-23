<?php

use App\Http\Controllers\Api\AlertaInventarioController;
use App\Http\Controllers\Api\CategoriaController;
use App\Http\Controllers\Api\MovimientoController;
use App\Http\Controllers\Api\ProductoController;
use App\Http\Controllers\Api\ProveedorController;
use App\Http\Controllers\Api\ReporteController;
use App\Http\Controllers\Api\ResumenController;
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

    Route::get('/resumen', ResumenController::class);
    Route::apiResource('productos', ProductoController::class)
        ->parameters(['productos' => 'producto'])
        ->only(['index', 'show']);

    // Proveedores (consulta)
    Route::apiResource('proveedores', ProveedorController::class)
        ->parameters(['proveedores' => 'proveedor'])
        ->only(['index', 'show']);

    // Movimientos de inventario
    Route::get('/movimientos/conceptos', [MovimientoController::class, 'conceptos']);
    Route::post('/movimientos/entradas', [MovimientoController::class, 'registrarEntrada']);
    Route::post('/movimientos/salidas', [MovimientoController::class, 'registrarSalida']);
    Route::get('/movimientos', [MovimientoController::class, 'index']);
    Route::get('/movimientos/{movimiento}', [MovimientoController::class, 'show'])->whereNumber('movimiento');

    // Alertas de existencias
    Route::get('/inventario/alertas', AlertaInventarioController::class);

    Route::middleware('rol:Administrador')->group(function () {
        Route::apiResource('proveedores', ProveedorController::class)
            ->parameters(['proveedores' => 'proveedor'])
            ->only(['store', 'update']);
        Route::patch('/proveedores/{proveedor}/estado', [ProveedorController::class, 'cambiarEstado']);

        Route::prefix('reportes')->controller(ReporteController::class)->group(function () {
            Route::get('/inventario', 'inventario');
            Route::get('/movimientos', 'movimientos');
            Route::get('/ventas', 'ventas');
        });

        Route::get('/roles', fn () => Rol::orderBy('nombre')->get(['id', 'nombre']));
        Route::apiResource('usuarios', UsuarioController::class)->except(['destroy']);
        Route::apiResource('categorias', CategoriaController::class)
            ->parameters(['categorias' => 'categoria']);
        Route::apiResource('productos', ProductoController::class)
            ->parameters(['productos' => 'producto'])
            ->only(['store', 'update', 'destroy']);
    });
});
