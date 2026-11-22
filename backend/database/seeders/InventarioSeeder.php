<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class InventarioSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            CategoriasSeeder::class,
            ProveedoresSeeder::class,
            ProductosSeeder::class,
            MovimientosSeeder::class,
        ]);
    }
}
