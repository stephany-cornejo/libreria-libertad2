<?php

namespace Tests\Feature\Inventario;

use App\Models\Movimiento;
use App\Models\Producto;
use App\Models\Proveedor;
use App\Services\InventarioService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Tests\Concerns\CreaDatosDeInventario;
use Tests\TestCase;

class ConsistenciaInventarioTest extends TestCase
{
    use CreaDatosDeInventario, RefreshDatabase;

    /**
     * Ejecuta una secuencia larga y variada de operaciones (incluidas salidas
     * rechazadas) y comprueba que el stock final de cada producto coincide
     * con el saldo de su historial y con la cadena stock_anterior/resultante.
     */
    public function test_el_stock_coincide_con_el_historial_tras_muchas_operaciones(): void
    {
        mt_srand(20261122);
        $servicio = app(InventarioService::class);
        $admin = $this->crearUsuario('Administrador');
        $proveedor = Proveedor::factory()->create();
        $productos = collect(range(1, 4))->map(fn ($i) => $this->crearProducto(['codigo' => "CONS-{$i}"]));
        $esperado = $productos->mapWithKeys(fn (Producto $p) => [$p->id => 0])->all();
        $rechazadas = 0;

        $conceptos = ['compra', 'reposicion', 'devolucion', 'venta', 'venta', 'venta', 'perdida', 'dano', 'ajuste'];

        for ($i = 0; $i < 200; $i++) {
            $producto = $productos->random();
            $concepto = $conceptos[array_rand($conceptos)];
            $cantidad = mt_rand(1, 15);

            try {
                $servicio->registrar($admin, [
                    'producto_id' => $producto->id,
                    'concepto' => $concepto,
                    'cantidad' => $cantidad,
                    'proveedor_id' => $concepto === 'compra' ? $proveedor->id : null,
                    'motivo' => in_array($concepto, ['devolucion', 'perdida', 'dano', 'ajuste'], true) ? 'Prueba' : null,
                ]);
                $esperado[$producto->id] += in_array($concepto, ['compra', 'reposicion', 'devolucion'], true) ? $cantidad : -$cantidad;
            } catch (ValidationException $e) {
                $this->assertArrayHasKey('cantidad', $e->errors(), 'Solo deben rechazarse salidas por falta de stock.');
                $this->assertGreaterThan($esperado[$producto->id], $cantidad);
                $rechazadas++;
            }
        }

        $this->assertGreaterThan(0, $rechazadas, 'El escenario debe incluir salidas rechazadas.');

        foreach ($productos as $producto) {
            $this->assertSame($esperado[$producto->id], $producto->refresh()->stock);
            $this->assertGreaterThanOrEqual(0, $producto->stock);

            // Cada movimiento parte del saldo que dejó el anterior.
            $saldo = 0;
            foreach (Movimiento::where('producto_id', $producto->id)->orderBy('id')->get() as $movimiento) {
                $this->assertSame($saldo, $movimiento->stock_anterior, "Cadena rota en el movimiento {$movimiento->id}");
                $saldo = $movimiento->stock_resultante;
            }
            $this->assertSame($producto->stock, $saldo);
        }

        $this->artisan('inventario:verificar')->assertSuccessful();
    }

    public function test_el_comando_detecta_stock_alterado_fuera_de_los_movimientos(): void
    {
        $producto = $this->crearProducto(['codigo' => 'ALT-1', 'nombre' => 'Producto alterado'], stockInicial: 10);
        $this->crearProducto(['codigo' => 'SIN-MOV', 'nombre' => 'Stock sin origen']);

        $this->artisan('inventario:verificar')->assertSuccessful();

        DB::table('productos')->where('id', $producto->id)->update(['stock' => 15]);
        DB::table('productos')->where('codigo', 'SIN-MOV')->update(['stock' => 3]);

        $this->artisan('inventario:verificar')
            ->expectsOutputToContain('2 producto(s) con stock que no coincide')
            ->expectsTable(
                ['ID', 'Código', 'Producto', 'Stock actual', 'Según movimientos', 'Diferencia'],
                [
                    [$producto->id, 'ALT-1', 'Producto alterado', 15, 10, 5],
                    [Producto::where('codigo', 'SIN-MOV')->value('id'), 'SIN-MOV', 'Stock sin origen', 3, 0, 3],
                ],
            )
            ->assertFailed();
    }

    public function test_una_salida_rechazada_no_deja_cambios_parciales(): void
    {
        $producto = $this->crearProducto(stockInicial: 2);
        $antes = Movimiento::count();

        try {
            app(InventarioService::class)->registrar($this->crearUsuario(), [
                'producto_id' => $producto->id, 'concepto' => 'venta', 'cantidad' => 3,
            ]);
            $this->fail('La salida debió rechazarse.');
        } catch (ValidationException) {
        }

        $this->assertSame(2, $producto->refresh()->stock);
        $this->assertSame($antes, Movimiento::count());
    }
}
