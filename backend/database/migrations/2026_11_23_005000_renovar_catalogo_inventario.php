<?php

use Database\Seeders\InventarioSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // Una instalación vacía carga el inventario después de crear su primer administrador.
        if (!DB::table('users')->exists() && !DB::table('productos')->exists()
            && !DB::table('proveedores')->exists() && !DB::table('categorias')->exists()) {
            return;
        }
        DB::transaction(function () {
            foreach (['movimientos', 'productos', 'proveedores', 'categorias'] as $tabla) {
                DB::table($tabla)->delete();
            }
            app(InventarioSeeder::class)->setContainer(app())->run();
        });
    }

    public function down(): void
    {
        throw new RuntimeException('El inventario anterior se recupera desde su copia de seguridad.');
    }
};
