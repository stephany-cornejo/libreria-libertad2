<?php

namespace Database\Seeders;

use App\Models\Producto;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class MovimientosSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function () {
            $usuarioId = User::query()
                ->where('estado', 'activo')
                ->whereHas('rol', fn ($consulta) => $consulta->where('nombre', 'Administrador'))
                ->orderBy('id')
                ->value('id');

            if ($usuarioId === null) {
                throw new RuntimeException(
                    'Crea un usuario Administrador activo antes de sembrar movimientos.'
                );
            }

            $proveedores = DB::table('proveedores')
                ->where('codigo', 'like', 'DEMO-PROV-%')
                ->orderBy('codigo')
                ->pluck('id');

            $productos = Producto::query()
                ->where('codigo', 'like', ProductosSeeder::PREFIJO.'%')
                ->orderBy('codigo')
                ->lockForUpdate()
                ->get();

            if ($proveedores->isEmpty() || $productos->isEmpty()) {
                throw new RuntimeException('Ejecuta primero los seeders de proveedores y productos.');
            }

            $ahora = now();
            foreach ($productos as $indice => $producto) {
                $primeraEntrada = 12 + ($indice * 7) % 55;
                $reposicion = 4 + ($indice * 3) % 22;
                $disponibles = $primeraEntrada + $reposicion;
                $salida = $indice % 7 === 0
                    ? $disponibles
                    : 1 + ($indice * 11) % $disponibles;

                $proveedor = $proveedores[$indice % $proveedores->count()];
                $eventos = [
                    ['entrada', 'compra', $primeraEntrada, 42 + $indice % 18, $proveedor, 'Compra inicial para inventario de demostración'],
                    ['entrada', 'reposicion', $reposicion, 21 + $indice % 14, $proveedor, 'Reposición de demostración'],
                    ['salida', 'venta', $salida, 2 + $indice % 14, null, 'Venta de demostración'],
                ];

                foreach ($eventos as $orden => [$tipo, $concepto, $cantidad, $dias, $proveedorId, $motivo]) {
                    $referencia = $producto->codigo.'-MOV-'.($orden + 1);
                    if (DB::table('movimientos')->where('referencia', $referencia)->exists()) {
                        continue;
                    }

                    $stock = $producto->stock + ($tipo === 'entrada' ? $cantidad : -$cantidad);
                    if ($stock < 0) {
                        throw new RuntimeException("Stock insuficiente para sembrar {$referencia}.");
                    }

                    DB::table('movimientos')->insert([
                        'producto_id' => $producto->id,
                        'proveedor_id' => $proveedorId,
                        'tipo' => $tipo,
                        'cantidad' => $cantidad,
                        'fecha' => $ahora->copy()->subDays($dias),
                        'referencia' => $referencia,
                        'motivo' => $motivo,
                        'created_at' => $ahora,
                        'updated_at' => $ahora,
                        'usuario_id' => $usuarioId,
                        'concepto' => $concepto,
                        'stock_anterior' => $producto->stock,
                        'stock_resultante' => $stock,
                    ]);

                    $producto->stock = $stock;
                }

                if ($producto->isDirty('stock')) {
                    $producto->save();
                }
            }
        }, attempts: 3);
    }
}
