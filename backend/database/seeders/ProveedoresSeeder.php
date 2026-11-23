<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ProveedoresSeeder extends Seeder
{
    public function run(): void
    {
        $proveedores = [
            'Distribuidora Papel y Tinta',
            'Editorial Puente de Letras',
            'Papelería Mayorista Prisma',
            'Suministros Escolares Horizonte',
            'Editorial Rutas de Lectura',
            'Material Didáctico Arcoíris',
            'Papeles y Cartulinas Trébol',
            'Insumos de Oficina Estación',
            'Editorial Página Abierta',
            'Distribuidora Escolar Brújula',
            'Arte y Color Mayorista',
            'Insumos Creativos Taller',
            'Editorial Bosque de Cuentos',
            'Distribuidora Cuaderno Azul',
            'Suministros Académicos Punto',
        ];

        foreach ($proveedores as $indice => $nombre) {
            $numero = $indice + 1;
            $codigo = sprintf('DEMO-PROV-%02d', $numero);
            if (DB::table('proveedores')->where('codigo', $codigo)->exists()) {
                continue;
            }

            DB::table('proveedores')->insert([
                'codigo' => $codigo,
                'nombre' => $nombre,
                'contacto' => 'Ventas mayoristas',
                'email' => "proveedor{$numero}@example.com",
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}
