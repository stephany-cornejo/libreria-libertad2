<?php

namespace Tests\Feature\Inventario;

use App\Models\Categoria;
use App\Models\Proveedor;
use App\Services\InventarioService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreaDatosDeInventario;
use Tests\TestCase;

class AlertasYReportesTest extends TestCase
{
    use CreaDatosDeInventario, RefreshDatabase;

    public function test_clasifica_productos_agotados_y_con_stock_bajo(): void
    {
        $this->comoEmpleado();
        $this->crearProducto(['codigo' => 'AGO', 'nombre' => 'Agotado', 'stock_minimo' => 5]);
        $this->crearProducto(['codigo' => 'BAJ', 'nombre' => 'Bajo', 'stock_minimo' => 5], stockInicial: 2);
        $this->crearProducto(['codigo' => 'LIM', 'nombre' => 'En el límite', 'stock_minimo' => 5], stockInicial: 5);
        $this->crearProducto(['codigo' => 'OK', 'nombre' => 'Suficiente', 'stock_minimo' => 5], stockInicial: 6);
        $this->crearProducto(['codigo' => 'SMI', 'nombre' => 'Sin mínimo', 'stock_minimo' => 0], stockInicial: 1);

        $this->getJson('/api/inventario/alertas')
            ->assertOk()
            ->assertJsonPath('resumen', ['agotados' => 1, 'stock_bajo' => 2, 'total' => 3])
            ->assertJsonPath('agotados.0.codigo', 'AGO')
            ->assertJsonPath('agotados.0.categoria.nombre', 'Literatura')
            ->assertJsonPath('stock_bajo.0.codigo', 'BAJ')
            ->assertJsonPath('stock_bajo.0.faltante', 3)
            ->assertJsonPath('stock_bajo.1.codigo', 'LIM')
            ->assertJsonPath('stock_bajo.1.faltante', 0);
    }

    public function test_las_alertas_reflejan_los_movimientos_al_instante(): void
    {
        $this->comoAdministrador();
        $producto = $this->crearProducto(['stock_minimo' => 3], stockInicial: 10);

        $this->getJson('/api/inventario/alertas')->assertJsonPath('resumen.total', 0);

        $this->postJson('/api/movimientos/salidas', ['producto_id' => $producto->id, 'concepto' => 'venta', 'cantidad' => 8]);
        $this->getJson('/api/inventario/alertas')->assertJsonPath('resumen.stock_bajo', 1);

        $this->postJson('/api/movimientos/salidas', ['producto_id' => $producto->id, 'concepto' => 'venta', 'cantidad' => 2]);
        $this->getJson('/api/inventario/alertas')->assertJsonPath('resumen.agotados', 1)->assertJsonPath('resumen.stock_bajo', 0);
    }

    public function test_reporte_de_inventario_valoriza_existencias_por_categoria(): void
    {
        $this->comoAdministrador();
        $this->crearProducto(['categoria' => 'Cuadernos', 'precio' => '2.50', 'stock_minimo' => 1], stockInicial: 10);
        $this->crearProducto(['categoria' => 'Cuadernos', 'precio' => '4.00', 'stock_minimo' => 1]);
        $this->crearProducto(['categoria' => 'Escritura', 'precio' => '0.75', 'stock_minimo' => 1], stockInicial: 4);

        $this->getJson('/api/reportes/inventario')
            ->assertOk()
            ->assertJsonPath('totales', [
                'productos' => 3, 'productos_disponibles' => 2, 'unidades' => 14,
                'valor' => '28.00', 'agotados' => 1, 'stock_bajo' => 0,
            ])
            ->assertJsonPath('por_categoria.0', [
                'id' => Categoria::where('nombre', 'Cuadernos')->value('id'),
                'nombre' => 'Cuadernos', 'productos' => 2, 'unidades' => 10, 'valor' => '25.00', 'agotados' => 1,
            ])
            ->assertJsonPath('por_categoria.1.valor', '3.00');
    }

    public function test_reporte_de_movimientos_y_de_ventas_por_periodo(): void
    {
        $admin = $this->comoAdministrador();
        $servicio = app(InventarioService::class);
        $proveedor = Proveedor::factory()->create();
        $libro = $this->crearProducto(['codigo' => 'LIB', 'nombre' => 'Libro', 'precio' => '15.00']);
        $regla = $this->crearProducto(['codigo' => 'REG', 'nombre' => 'Regla', 'precio' => '1.25']);

        $servicio->registrar($admin, ['producto_id' => $libro->id, 'concepto' => 'compra', 'cantidad' => 10, 'proveedor_id' => $proveedor->id, 'precio_unitario' => '9.00', 'fecha' => '2026-11-01 09:00:00']);
        $servicio->registrar($admin, ['producto_id' => $regla->id, 'concepto' => 'compra', 'cantidad' => 30, 'proveedor_id' => $proveedor->id, 'precio_unitario' => '0.50', 'fecha' => '2026-11-01 09:00:00']);
        $servicio->registrar($admin, ['producto_id' => $libro->id, 'concepto' => 'venta', 'cantidad' => 2, 'fecha' => '2026-11-05 10:00:00']);
        $servicio->registrar($admin, ['producto_id' => $regla->id, 'concepto' => 'venta', 'cantidad' => 6, 'fecha' => '2026-11-05 16:00:00']);
        $servicio->registrar($admin, ['producto_id' => $libro->id, 'concepto' => 'venta', 'cantidad' => 1, 'fecha' => '2026-11-06 12:00:00']);
        $servicio->registrar($admin, ['producto_id' => $regla->id, 'concepto' => 'perdida', 'cantidad' => 1, 'motivo' => 'Extravío', 'fecha' => '2026-11-07 12:00:00']);
        // Fuera del periodo consultado
        $servicio->registrar($admin, ['producto_id' => $libro->id, 'concepto' => 'venta', 'cantidad' => 1, 'fecha' => '2026-10-15 12:00:00']);

        $this->getJson('/api/reportes/movimientos?desde=2026-11-01&hasta=2026-11-30')
            ->assertOk()
            ->assertJsonPath('periodo', ['desde' => '2026-11-01', 'hasta' => '2026-11-30'])
            ->assertJsonPath('totales', ['unidades_entrada' => 40, 'unidades_salida' => 10])
            ->assertJsonFragment(['concepto' => 'compra', 'movimientos' => 2, 'unidades' => 40, 'importe' => '105.00'])
            ->assertJsonFragment(['concepto' => 'venta', 'movimientos' => 3, 'unidades' => 9, 'importe' => '52.50'])
            ->assertJsonFragment(['concepto' => 'perdida', 'movimientos' => 1, 'unidades' => 1, 'importe' => '0.00']);

        $this->getJson('/api/reportes/ventas?desde=2026-11-01&hasta=2026-11-30')
            ->assertOk()
            ->assertJsonPath('totales', ['ventas' => 3, 'unidades' => 9, 'importe' => '52.50'])
            ->assertJsonPath('por_dia', [
                ['fecha' => '2026-11-05', 'ventas' => 2, 'unidades' => 8, 'importe' => '37.50'],
                ['fecha' => '2026-11-06', 'ventas' => 1, 'unidades' => 1, 'importe' => '15.00'],
            ])
            ->assertJsonPath('mas_vendidos.0.codigo', 'REG')
            ->assertJsonPath('mas_vendidos.0.unidades', 6)
            ->assertJsonPath('mas_vendidos.1', ['id' => $libro->id, 'codigo' => 'LIB', 'nombre' => 'Libro', 'unidades' => 3, 'importe' => '45.00']);
    }

    public function test_los_reportes_validan_el_periodo(): void
    {
        $this->comoAdministrador();

        $this->getJson('/api/reportes/ventas?desde=2026-11-30&hasta=2026-11-01')->assertUnprocessable()->assertJsonValidationErrors('hasta');
        $this->getJson('/api/reportes/ventas?desde=2024-01-01&hasta=2026-11-01')->assertUnprocessable()->assertJsonValidationErrors('desde');
        $this->getJson('/api/reportes/movimientos?desde=01/11/2026')->assertUnprocessable()->assertJsonValidationErrors('desde');
        $this->getJson('/api/reportes/ventas')->assertOk()->assertJsonStructure(['periodo' => ['desde', 'hasta'], 'totales', 'por_dia', 'mas_vendidos']);
    }

    public function test_los_reportes_son_exclusivos_del_administrador(): void
    {
        $this->comoEmpleado();

        $this->getJson('/api/reportes/inventario')->assertForbidden();
        $this->getJson('/api/reportes/movimientos')->assertForbidden();
        $this->getJson('/api/reportes/ventas')->assertForbidden();
    }
}
