<?php

namespace App\Console\Commands;

use App\Services\ReporteInventarioService;
use Illuminate\Console\Command;

class VerificarInventario extends Command
{
    protected $signature = 'inventario:verificar';

    protected $description = 'Verifica que el stock de cada producto coincida con el saldo de sus movimientos';

    public function handle(ReporteInventarioService $reportes): int
    {
        $inconsistencias = $reportes->inconsistencias();

        if ($inconsistencias === []) {
            $this->components->info('El inventario es consistente: el stock de todos los productos coincide con sus movimientos.');

            return self::SUCCESS;
        }

        $this->components->error(count($inconsistencias).' producto(s) con stock que no coincide con sus movimientos.');

        $this->table(
            ['ID', 'Código', 'Producto', 'Stock actual', 'Según movimientos', 'Diferencia'],
            array_map(fn (array $fila) => [
                $fila['id'],
                $fila['codigo'],
                $fila['nombre'],
                $fila['stock'],
                $fila['stock_calculado'],
                $fila['stock'] - $fila['stock_calculado'],
            ], $inconsistencias),
        );

        return self::FAILURE;
    }
}
