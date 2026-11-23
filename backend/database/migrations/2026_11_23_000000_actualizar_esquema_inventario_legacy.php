<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('proveedores', 'estado')) {
            DB::statement("ALTER TABLE proveedores ADD estado ENUM('activo','inactivo') NOT NULL DEFAULT 'activo', ADD INDEX proveedores_estado_index (estado)");
        }

        if (Schema::hasIndex('movimientos', ['usuario_id', 'fecha'])) {
            return;
        }

        // Los únicos datos históricos con autor y concepto reconstruibles son los del seeder.
        $admin = DB::table('users')->join('roles', 'users.id_rol', '=', 'roles.id')
            ->where('users.estado', 'activo')->where('roles.nombre', 'Administrador')->min('users.id');
        $updates = [];
        $stocks = [];
        foreach (DB::table('movimientos as m')->join('productos as p', 'm.producto_id', '=', 'p.id')
            ->select('m.*', 'p.codigo', 'p.stock')->orderBy('m.producto_id')->orderByDesc('m.fecha')->orderByDesc('m.id')->get() as $row) {
            $prefix = $row->codigo.'-MOV-';
            $concept = match ($row->referencia) {
                $prefix.'1' => 'compra',
                $prefix.'2' => 'reposicion',
                $prefix.'3' => 'venta',
                default => null,
            };
            if (!$admin || !str_starts_with($row->codigo, 'DEMO-') || !$concept || $row->motivo === null ||
                $row->tipo !== ($concept === 'venta' ? 'salida' : 'entrada')) {
                throw new RuntimeException('Revisa el administrador y los movimientos históricos antes de migrar.');
            }
            $after = $stocks[$row->producto_id] ?? $row->stock;
            $before = $after - ($row->tipo === 'entrada' ? $row->cantidad : -$row->cantidad);
            if ($before < 0) {
                throw new RuntimeException("Stock histórico inconsistente en movimiento {$row->id}.");
            }
            $stocks[$row->producto_id] = $before;
            $updates[$row->id] = ['usuario_id' => $admin, 'concepto' => $concept,
                'stock_anterior' => $before, 'stock_resultante' => $after];
        }

        if (!Schema::hasColumn('movimientos', 'usuario_id')) {
            DB::statement("ALTER TABLE movimientos
                ADD usuario_id BIGINT UNSIGNED NULL,
                ADD concepto ENUM('compra','reposicion','devolucion','venta','perdida','dano','ajuste') NULL,
                ADD stock_anterior INT UNSIGNED NULL, ADD stock_resultante INT UNSIGNED NULL,
                ADD precio_unitario DECIMAL(10,2) NULL");
        }
        DB::transaction(function () use ($updates) {
            foreach ($updates as $id => $values) {
                DB::table('movimientos')->where('id', $id)->update($values);
            }
        });
        DB::statement("ALTER TABLE movimientos
            MODIFY usuario_id BIGINT UNSIGNED NOT NULL,
            MODIFY concepto ENUM('compra','reposicion','devolucion','venta','perdida','dano','ajuste') NOT NULL,
            MODIFY stock_anterior INT UNSIGNED NOT NULL, MODIFY stock_resultante INT UNSIGNED NOT NULL,
            MODIFY motivo VARCHAR(250) NOT NULL,
            ADD CONSTRAINT movimientos_usuario_id_foreign FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE RESTRICT,
            ADD INDEX movimientos_usuario_id_fecha_index (usuario_id,fecha),
            ADD INDEX movimientos_tipo_concepto_fecha_index (tipo,concepto,fecha),
            ADD INDEX movimientos_fecha_index (fecha)");
    }

    public function down(): void
    {
        // El esquema actualizado también es el de las instalaciones nuevas.
    }
};
