<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Rol;

class RolesSeeder extends Seeder
{
    public function run(): void
    {
        Rol::firstOrCreate([
            'nombre' => 'Administrador',
        ]);

        Rol::firstOrCreate([
            'nombre' => 'Empleado',
        ]);
    }
}
