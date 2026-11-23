<?php

namespace Tests\Feature\Inventario;

use App\Models\Movimiento;
use App\Models\Proveedor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use LogicException;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Concerns\CreaDatosDeInventario;
use Tests\TestCase;

class MovimientoTest extends TestCase
{
    use CreaDatosDeInventario, RefreshDatabase;

    // ---------------------------------------------------------------
    // Entradas
    // ---------------------------------------------------------------

    public function test_una_compra_aumenta_el_stock_y_registra_el_historial_completo(): void
    {
        $usuario = $this->comoEmpleado();
        $producto = $this->crearProducto(stockInicial: 4);
        $proveedor = Proveedor::factory()->create();

        $this->postJson('/api/movimientos/entradas', [
            'producto_id' => $producto->id,
            'concepto' => 'compra',
            'cantidad' => 10,
            'proveedor_id' => $proveedor->id,
            'precio_unitario' => '6.50',
            'referencia' => 'FAC-0001',
        ])
            ->assertCreated()
            ->assertJsonPath('tipo', 'entrada')
            ->assertJsonPath('concepto', 'compra')
            ->assertJsonPath('cantidad', 10)
            ->assertJsonPath('stock_anterior', 4)
            ->assertJsonPath('stock_resultante', 14)
            ->assertJsonPath('precio_unitario', '6.50')
            ->assertJsonPath('producto.id', $producto->id)
            ->assertJsonPath('proveedor.id', $proveedor->id)
            ->assertJsonPath('usuario.id', $usuario->id)
            ->assertJsonPath('motivo', 'Compra a proveedor')
            ->assertJsonStructure(['fecha']);

        $this->assertSame(14, $producto->refresh()->stock);
    }

    public function test_los_movimientos_se_relacionan_con_productos_usuarios_y_proveedores(): void
    {
        $usuario = $this->comoEmpleado();
        $producto = $this->crearProducto();
        $proveedor = Proveedor::factory()->create();

        $this->postJson('/api/movimientos/entradas', [
            'producto_id' => $producto->id, 'concepto' => 'compra', 'cantidad' => 3, 'proveedor_id' => $proveedor->id,
        ])->assertCreated();

        $movimiento = Movimiento::latest('id')->firstOrFail();

        $this->assertTrue($movimiento->producto->is($producto));
        $this->assertTrue($movimiento->usuario->is($usuario));
        $this->assertTrue($movimiento->proveedor->is($proveedor));
        $this->assertTrue($producto->movimientos()->whereKey($movimiento->id)->exists());
        $this->assertTrue($usuario->movimientos()->whereKey($movimiento->id)->exists());
        $this->assertTrue($proveedor->movimientos()->whereKey($movimiento->id)->exists());
    }

    public function test_todo_movimiento_queda_con_motivo_en_el_historial(): void
    {
        $this->comoAdministrador();
        $producto = $this->crearProducto(stockInicial: 10);

        // Sin motivo escrito: se registra el motivo predeterminado del concepto.
        $this->postJson('/api/movimientos/salidas', [
            'producto_id' => $producto->id, 'concepto' => 'venta', 'cantidad' => 1,
        ])->assertCreated()->assertJsonPath('motivo', 'Venta a cliente');

        $this->postJson('/api/movimientos/entradas', [
            'producto_id' => $producto->id, 'concepto' => 'reposicion', 'cantidad' => 1, 'motivo' => '   ',
        ])->assertCreated()->assertJsonPath('motivo', 'Reposición de inventario');

        // Con motivo escrito: se conserva el del usuario, sin espacios sobrantes.
        $this->postJson('/api/movimientos/salidas', [
            'producto_id' => $producto->id, 'concepto' => 'venta', 'cantidad' => 1, 'motivo' => '  Venta mayorista a escuela  ',
        ])->assertCreated()->assertJsonPath('motivo', 'Venta mayorista a escuela');

        $this->assertSame(0, Movimiento::query()->whereNull('motivo')->orWhere('motivo', '')->count());
    }

    public function test_la_compra_exige_un_proveedor_activo(): void
    {
        $this->comoAdministrador();
        $producto = $this->crearProducto();
        $inactivo = Proveedor::factory()->inactivo()->create();

        $this->postJson('/api/movimientos/entradas', [
            'producto_id' => $producto->id, 'concepto' => 'compra', 'cantidad' => 5,
        ])->assertUnprocessable()->assertJsonValidationErrors('proveedor_id');

        $this->postJson('/api/movimientos/entradas', [
            'producto_id' => $producto->id, 'concepto' => 'compra', 'cantidad' => 5, 'proveedor_id' => $inactivo->id,
        ])->assertUnprocessable()->assertJsonValidationErrors('proveedor_id');

        $this->assertSame(0, $producto->refresh()->stock);
    }

    public function test_la_reposicion_admite_proveedor_opcional(): void
    {
        $this->comoAdministrador();
        $producto = $this->crearProducto();

        $this->postJson('/api/movimientos/entradas', [
            'producto_id' => $producto->id, 'concepto' => 'reposicion', 'cantidad' => 3,
        ])->assertCreated()->assertJsonPath('proveedor', null);

        $this->assertSame(3, $producto->refresh()->stock);
    }

    public function test_la_devolucion_exige_motivo_y_no_admite_proveedor(): void
    {
        $this->comoAdministrador();
        $producto = $this->crearProducto();
        $proveedor = Proveedor::factory()->create();

        $this->postJson('/api/movimientos/entradas', [
            'producto_id' => $producto->id, 'concepto' => 'devolucion', 'cantidad' => 1,
        ])->assertUnprocessable()->assertJsonValidationErrors('motivo');

        $this->postJson('/api/movimientos/entradas', [
            'producto_id' => $producto->id, 'concepto' => 'devolucion', 'cantidad' => 1,
            'motivo' => 'Cliente devolvió el producto', 'proveedor_id' => $proveedor->id,
        ])->assertUnprocessable()->assertJsonValidationErrors('proveedor_id');

        $this->postJson('/api/movimientos/entradas', [
            'producto_id' => $producto->id, 'concepto' => 'devolucion', 'cantidad' => 1,
            'motivo' => 'Cliente devolvió el producto',
        ])->assertCreated();
    }

    public function test_el_endpoint_de_entradas_rechaza_conceptos_de_salida(): void
    {
        $this->comoAdministrador();
        $producto = $this->crearProducto(stockInicial: 5);

        $this->postJson('/api/movimientos/entradas', [
            'producto_id' => $producto->id, 'concepto' => 'venta', 'cantidad' => 1,
        ])->assertUnprocessable()->assertJsonValidationErrors('concepto');

        $this->postJson('/api/movimientos/salidas', [
            'producto_id' => $producto->id, 'concepto' => 'compra', 'cantidad' => 1,
        ])->assertUnprocessable()->assertJsonValidationErrors('concepto');
    }

    // ---------------------------------------------------------------
    // Salidas
    // ---------------------------------------------------------------

    public function test_una_venta_descuenta_el_stock_y_conserva_el_precio_vigente(): void
    {
        $this->comoEmpleado();
        $producto = $this->crearProducto(['precio' => '12.75'], stockInicial: 10);

        $this->postJson('/api/movimientos/salidas', [
            'producto_id' => $producto->id, 'concepto' => 'venta', 'cantidad' => 4,
        ])
            ->assertCreated()
            ->assertJsonPath('tipo', 'salida')
            ->assertJsonPath('stock_anterior', 10)
            ->assertJsonPath('stock_resultante', 6)
            ->assertJsonPath('precio_unitario', '12.75');

        $this->assertSame(6, $producto->refresh()->stock);
    }

    public function test_una_salida_no_puede_superar_las_existencias(): void
    {
        $this->comoAdministrador();
        $producto = $this->crearProducto(stockInicial: 3);
        $movimientosPrevios = Movimiento::count();

        $this->postJson('/api/movimientos/salidas', [
            'producto_id' => $producto->id, 'concepto' => 'venta', 'cantidad' => 4,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['cantidad' => 'La salida supera las existencias disponibles (3 unidades).']);

        $this->assertSame(3, $producto->refresh()->stock);
        $this->assertSame($movimientosPrevios, Movimiento::count());
    }

    public function test_una_salida_puede_agotar_exactamente_el_stock(): void
    {
        $this->comoAdministrador();
        $producto = $this->crearProducto(stockInicial: 2);

        $this->postJson('/api/movimientos/salidas', [
            'producto_id' => $producto->id, 'concepto' => 'venta', 'cantidad' => 2,
        ])->assertCreated()->assertJsonPath('stock_resultante', 0);

        $this->assertSame(0, $producto->refresh()->stock);
    }

    #[DataProvider('conceptosQueExigenMotivo')]
    public function test_las_perdidas_danos_y_ajustes_exigen_motivo(string $concepto): void
    {
        $this->comoAdministrador();
        $producto = $this->crearProducto(stockInicial: 5);

        $this->postJson('/api/movimientos/salidas', [
            'producto_id' => $producto->id, 'concepto' => $concepto, 'cantidad' => 1,
        ])->assertUnprocessable()->assertJsonValidationErrors('motivo');

        $this->postJson('/api/movimientos/salidas', [
            'producto_id' => $producto->id, 'concepto' => $concepto, 'cantidad' => 1, 'motivo' => 'Revisión de inventario',
        ])->assertCreated()->assertJsonPath('concepto', $concepto);
    }

    public static function conceptosQueExigenMotivo(): array
    {
        return [
            'pérdida' => ['perdida'],
            'daño' => ['dano'],
            'ajuste' => ['ajuste'],
        ];
    }

    public function test_las_salidas_no_admiten_proveedor(): void
    {
        $this->comoAdministrador();
        $producto = $this->crearProducto(stockInicial: 5);
        $proveedor = Proveedor::factory()->create();

        $this->postJson('/api/movimientos/salidas', [
            'producto_id' => $producto->id, 'concepto' => 'venta', 'cantidad' => 1, 'proveedor_id' => $proveedor->id,
        ])->assertUnprocessable()->assertJsonValidationErrors('proveedor_id');
    }

    public function test_solo_el_administrador_registra_ajustes(): void
    {
        $this->comoEmpleado();
        $producto = $this->crearProducto(stockInicial: 5);

        $this->postJson('/api/movimientos/salidas', [
            'producto_id' => $producto->id, 'concepto' => 'ajuste', 'cantidad' => 1, 'motivo' => 'Conteo físico',
        ])
            ->assertForbidden()
            ->assertJsonPath('message', 'Solo un Administrador puede registrar ajustes de inventario.');

        $this->assertSame(5, $producto->refresh()->stock);
    }

    // ---------------------------------------------------------------
    // Validaciones generales
    // ---------------------------------------------------------------

    #[DataProvider('cantidadesInvalidas')]
    public function test_la_cantidad_debe_ser_un_entero_positivo(mixed $cantidad): void
    {
        $this->comoAdministrador();
        $producto = $this->crearProducto(stockInicial: 5);

        $this->postJson('/api/movimientos/salidas', [
            'producto_id' => $producto->id, 'concepto' => 'venta', 'cantidad' => $cantidad,
        ])->assertUnprocessable()->assertJsonValidationErrors('cantidad');

        $this->assertSame(5, $producto->refresh()->stock);
    }

    public static function cantidadesInvalidas(): array
    {
        return [
            'cero' => [0],
            'negativa' => [-3],
            'decimal' => [1.5],
            'texto' => ['diez'],
            'vacía' => [null],
        ];
    }

    public function test_rechaza_fechas_futuras_referencias_duplicadas_y_productos_inexistentes(): void
    {
        $this->comoAdministrador();
        $producto = $this->crearProducto();

        $this->postJson('/api/movimientos/entradas', [
            'producto_id' => $producto->id, 'concepto' => 'reposicion', 'cantidad' => 1, 'referencia' => 'REP-1',
        ])->assertCreated();

        $this->postJson('/api/movimientos/entradas', [
            'producto_id' => 999999,
            'concepto' => 'reposicion',
            'cantidad' => 1,
            'referencia' => 'REP-1',
            'fecha' => now()->addDay()->toDateTimeString(),
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['producto_id', 'referencia', 'fecha']);
    }

    public function test_permite_registrar_movimientos_con_fecha_pasada(): void
    {
        $this->comoAdministrador();
        $producto = $this->crearProducto();

        $this->postJson('/api/movimientos/entradas', [
            'producto_id' => $producto->id, 'concepto' => 'reposicion', 'cantidad' => 1, 'fecha' => '2026-01-15 09:30:00',
        ])->assertCreated();

        $this->assertDatabaseHas('movimientos', ['producto_id' => $producto->id, 'fecha' => '2026-01-15 09:30:00']);
    }

    public function test_un_usuario_inactivo_no_registra_movimientos(): void
    {
        $producto = $this->crearProducto();
        $this->actingAs($this->crearUsuario('Empleado', 'inactivo'));

        $this->postJson('/api/movimientos/entradas', [
            'producto_id' => $producto->id, 'concepto' => 'reposicion', 'cantidad' => 1,
        ])->assertForbidden();
    }

    // ---------------------------------------------------------------
    // Integridad del historial
    // ---------------------------------------------------------------

    public function test_los_movimientos_son_inmutables(): void
    {
        $producto = $this->crearProducto(stockInicial: 5);
        $movimiento = Movimiento::firstOrFail();

        try {
            $movimiento->update(['cantidad' => 99]);
            $this->fail('Se permitió modificar un movimiento.');
        } catch (LogicException) {
        }

        try {
            $movimiento->delete();
            $this->fail('Se permitió eliminar un movimiento.');
        } catch (LogicException) {
        }

        $this->assertDatabaseHas('movimientos', ['id' => $movimiento->id, 'cantidad' => 5]);
        $this->assertSame(5, $producto->refresh()->stock);
    }

    public function test_el_stock_no_se_puede_editar_desde_el_catalogo(): void
    {
        $this->comoAdministrador();
        $producto = $this->crearProducto(stockInicial: 5);

        $this->putJson("/api/productos/{$producto->id}", [
            'categoria_id' => $producto->categoria_id,
            'codigo' => $producto->codigo,
            'nombre' => $producto->nombre,
            'precio' => '10.00',
            'stock_minimo' => 2,
            'stock' => 500,
        ])->assertUnprocessable()->assertJsonValidationErrors('stock');

        $this->assertSame(5, $producto->refresh()->stock);
    }

    public function test_un_producto_con_movimientos_no_se_puede_eliminar(): void
    {
        $this->comoAdministrador();
        $producto = $this->crearProducto(stockInicial: 1);

        $this->postJson('/api/movimientos/salidas', [
            'producto_id' => $producto->id, 'concepto' => 'venta', 'cantidad' => 1,
        ])->assertCreated();

        $this->deleteJson("/api/productos/{$producto->id}")->assertConflict();
        $this->assertDatabaseHas('productos', ['id' => $producto->id]);
    }

    public function test_publica_el_catalogo_de_conceptos_con_sus_reglas(): void
    {
        $this->comoEmpleado();

        $this->getJson('/api/movimientos/conceptos')
            ->assertOk()
            ->assertJsonCount(7)
            ->assertJsonFragment([
                'valor' => 'compra', 'tipo' => 'entrada', 'requiere_proveedor' => true,
                'admite_proveedor' => true, 'requiere_motivo' => false, 'solo_administrador' => false,
                'etiqueta' => 'Compra',
            ])
            ->assertJsonFragment([
                'valor' => 'ajuste', 'tipo' => 'salida', 'requiere_proveedor' => false,
                'admite_proveedor' => false, 'requiere_motivo' => true, 'solo_administrador' => true,
                'etiqueta' => 'Ajuste autorizado',
            ]);
    }
}
