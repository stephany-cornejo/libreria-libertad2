<?php

namespace Tests\Feature\Inventario;

use App\Models\Proveedor;
use App\Models\User;
use App\Services\InventarioService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreaDatosDeInventario;
use Tests\TestCase;

class HistorialMovimientosTest extends TestCase
{
    use CreaDatosDeInventario, RefreshDatabase;

    private User $administrador;

    private User $empleado;

    protected function setUp(): void
    {
        parent::setUp();

        $this->administrador = $this->crearUsuario('Administrador');
        $this->empleado = $this->crearUsuario('Empleado');
    }

    private function registrar(User $usuario, array $datos): void
    {
        app(InventarioService::class)->registrar($usuario, $datos);
    }

    /**
     * Escenario: 2 productos, 1 proveedor, 5 movimientos en fechas distintas.
     */
    private function prepararHistorial(): array
    {
        $cuaderno = $this->crearProducto(['codigo' => 'CUA-01', 'nombre' => 'Cuaderno universitario']);
        $lapiz = $this->crearProducto(['codigo' => 'LAP-01', 'nombre' => 'Lápiz HB']);
        $proveedor = Proveedor::factory()->create();

        $this->registrar($this->administrador, ['producto_id' => $cuaderno->id, 'concepto' => 'compra', 'cantidad' => 20, 'proveedor_id' => $proveedor->id, 'fecha' => '2026-11-01 08:00:00', 'referencia' => 'FAC-100']);
        $this->registrar($this->administrador, ['producto_id' => $lapiz->id, 'concepto' => 'compra', 'cantidad' => 50, 'proveedor_id' => $proveedor->id, 'fecha' => '2026-11-02 08:00:00', 'referencia' => 'FAC-101']);
        $this->registrar($this->empleado, ['producto_id' => $cuaderno->id, 'concepto' => 'venta', 'cantidad' => 3, 'fecha' => '2026-11-10 15:00:00']);
        $this->registrar($this->empleado, ['producto_id' => $lapiz->id, 'concepto' => 'venta', 'cantidad' => 10, 'fecha' => '2026-11-15 11:00:00']);
        $this->registrar($this->administrador, ['producto_id' => $lapiz->id, 'concepto' => 'dano', 'cantidad' => 2, 'motivo' => 'Caja mojada', 'fecha' => '2026-11-20 17:45:00']);

        return [$cuaderno, $lapiz, $proveedor];
    }

    public function test_lista_el_historial_del_mas_reciente_al_mas_antiguo_con_sus_relaciones(): void
    {
        $this->prepararHistorial();
        $this->actingAs($this->empleado);

        $this->getJson('/api/movimientos')
            ->assertOk()
            ->assertJsonPath('total', 5)
            ->assertJsonPath('data.0.concepto', 'dano')
            ->assertJsonPath('data.0.motivo', 'Caja mojada')
            ->assertJsonPath('data.0.producto.codigo', 'LAP-01')
            ->assertJsonPath('data.0.usuario.id', $this->administrador->id)
            ->assertJsonPath('data.4.referencia', 'FAC-100')
            ->assertJsonStructure(['data' => [[
                'id', 'tipo', 'concepto', 'cantidad', 'stock_anterior', 'stock_resultante', 'fecha', 'motivo', 'referencia',
                'producto' => ['id', 'codigo', 'nombre'],
                'usuario' => ['id', 'name', 'usuario'],
            ]], 'current_page', 'last_page', 'per_page', 'total']);
    }

    public function test_filtra_por_producto_tipo_concepto_usuario_y_proveedor(): void
    {
        [$cuaderno, $lapiz, $proveedor] = $this->prepararHistorial();
        $this->actingAs($this->administrador);

        $this->getJson("/api/movimientos?producto_id={$lapiz->id}")->assertJsonPath('total', 3);
        $this->getJson('/api/movimientos?tipo=entrada')->assertJsonPath('total', 2);
        $this->getJson('/api/movimientos?tipo=salida&concepto=venta')->assertJsonPath('total', 2);
        $this->getJson("/api/movimientos?usuario_id={$this->empleado->id}")->assertJsonPath('total', 2);
        $this->getJson("/api/movimientos?proveedor_id={$proveedor->id}")->assertJsonPath('total', 2);
        $this->getJson("/api/movimientos?producto_id={$cuaderno->id}&concepto=venta")
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.cantidad', 3);
    }

    public function test_filtra_por_rango_de_fechas_inclusivo(): void
    {
        $this->prepararHistorial();
        $this->actingAs($this->administrador);

        $this->getJson('/api/movimientos?desde=2026-11-10&hasta=2026-11-15')->assertJsonPath('total', 2);
        $this->getJson('/api/movimientos?desde=2026-11-20')->assertJsonPath('total', 1);
        $this->getJson('/api/movimientos?hasta=2026-11-01')->assertJsonPath('total', 1);
    }

    public function test_busca_por_codigo_nombre_referencia_o_motivo(): void
    {
        $this->prepararHistorial();
        $this->actingAs($this->administrador);

        $this->getJson('/api/movimientos?buscar=cuaderno')->assertJsonPath('total', 2);
        $this->getJson('/api/movimientos?buscar=LAP-01')->assertJsonPath('total', 3);
        $this->getJson('/api/movimientos?buscar=FAC-101')->assertJsonPath('total', 1);
        $this->getJson('/api/movimientos?buscar=mojada')->assertJsonPath('total', 1);
        $this->getJson('/api/movimientos?buscar=%25')->assertJsonPath('total', 0);
    }

    public function test_pagina_los_resultados(): void
    {
        $this->prepararHistorial();
        $this->actingAs($this->administrador);

        $this->getJson('/api/movimientos?por_pagina=2&page=3')
            ->assertJsonPath('per_page', 2)
            ->assertJsonPath('last_page', 3)
            ->assertJsonCount(1, 'data');
    }

    public function test_valida_los_filtros(): void
    {
        $this->actingAs($this->administrador);

        $this->getJson('/api/movimientos?tipo=traslado&concepto=regalo&desde=2026-11-20&hasta=2026-11-01&por_pagina=500')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['tipo', 'concepto', 'hasta', 'por_pagina']);
    }

    public function test_muestra_el_detalle_de_un_movimiento(): void
    {
        [$cuaderno] = $this->prepararHistorial();
        $this->actingAs($this->empleado);
        $id = $cuaderno->movimientos()->where('concepto', 'compra')->value('id');

        $this->getJson("/api/movimientos/{$id}")
            ->assertOk()
            ->assertJsonPath('referencia', 'FAC-100')
            ->assertJsonPath('stock_anterior', 0)
            ->assertJsonPath('stock_resultante', 20);

        $this->getJson('/api/movimientos/999999')->assertNotFound();
    }
}
