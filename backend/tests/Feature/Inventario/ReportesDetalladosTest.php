<?php

namespace Tests\Feature\Inventario;

use App\Models\Categoria;
use App\Models\Producto;
use App\Models\Proveedor;
use App\Services\InventarioService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreaDatosDeInventario;
use Tests\TestCase;

class ReportesDetalladosTest extends TestCase
{
    use CreaDatosDeInventario, RefreshDatabase;

    public function test_reporte_de_existencias_clasifica_y_valoriza_cada_producto(): void
    {
        $this->comoAdministrador();
        $this->crearProducto(['codigo' => 'AGO', 'nombre' => 'Agotado', 'categoria' => 'Cuadernos', 'precio' => '3.00', 'stock_minimo' => 2]);
        $this->crearProducto(['codigo' => 'BAJ', 'nombre' => 'Bajo', 'categoria' => 'Cuadernos', 'precio' => '2.50', 'stock_minimo' => 5], stockInicial: 4);
        $this->crearProducto(['codigo' => 'DIS', 'nombre' => 'Disponible', 'categoria' => 'Escritura', 'precio' => '1.20', 'stock_minimo' => 5], stockInicial: 10);

        $this->getJson('/api/reportes/existencias')
            ->assertOk()
            ->assertJsonPath('totales', ['productos' => 3, 'unidades' => 14, 'valor' => '22.00', 'agotados' => 1, 'stock_bajo' => 1])
            ->assertJsonPath('productos.0', [
                'id' => Producto::where('codigo', 'AGO')->value('id'),
                'codigo' => 'AGO', 'nombre' => 'Agotado', 'categoria' => 'Cuadernos', 'precio' => '3.00',
                'stock' => 0, 'stock_minimo' => 2, 'valor' => '0.00', 'estado' => 'agotado',
            ])
            ->assertJsonPath('productos.1.estado', 'stock_bajo')
            ->assertJsonPath('productos.1.valor', '10.00')
            ->assertJsonPath('productos.2.estado', 'disponible');
    }

    public function test_reporte_de_existencias_filtra_por_estado_y_categoria(): void
    {
        $this->comoAdministrador();
        $this->crearProducto(['codigo' => 'AGO', 'categoria' => 'Cuadernos', 'stock_minimo' => 2]);
        $this->crearProducto(['codigo' => 'BAJ', 'categoria' => 'Cuadernos', 'stock_minimo' => 5], stockInicial: 4);
        $this->crearProducto(['codigo' => 'DIS', 'categoria' => 'Escritura', 'stock_minimo' => 5], stockInicial: 10);
        $cuadernos = Categoria::where('nombre', 'Cuadernos')->value('id');

        $this->getJson('/api/reportes/existencias?estado=agotados')->assertJsonCount(1, 'productos')->assertJsonPath('productos.0.codigo', 'AGO');
        $this->getJson('/api/reportes/existencias?estado=stock_bajo')->assertJsonCount(1, 'productos')->assertJsonPath('productos.0.codigo', 'BAJ');
        $this->getJson('/api/reportes/existencias?estado=disponibles')->assertJsonCount(1, 'productos')->assertJsonPath('productos.0.codigo', 'DIS');
        $this->getJson("/api/reportes/existencias?categoria_id={$cuadernos}")->assertJsonCount(2, 'productos')->assertJsonPath('totales.unidades', 4);
        $this->getJson('/api/reportes/existencias?estado=vencidos&categoria_id=999999')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['estado', 'categoria_id']);
    }

    public function test_reporte_de_poca_rotacion_prioriza_productos_sin_ventas(): void
    {
        $admin = $this->comoAdministrador();
        $servicio = app(InventarioService::class);
        $estrella = $this->crearProducto(['codigo' => 'EST', 'nombre' => 'Muy vendido', 'precio' => '2.00'], stockInicial: 50);
        $lento = $this->crearProducto(['codigo' => 'LEN', 'nombre' => 'Lento', 'precio' => '4.00'], stockInicial: 20);
        $this->crearProducto(['codigo' => 'NUL', 'nombre' => 'Sin ventas', 'precio' => '5.00'], stockInicial: 8);
        $this->crearProducto(['codigo' => 'AGO', 'nombre' => 'Agotado sin ventas']);

        $servicio->registrar($admin, ['producto_id' => $estrella->id, 'concepto' => 'venta', 'cantidad' => 30, 'fecha' => '2026-11-10 10:00:00']);
        $servicio->registrar($admin, ['producto_id' => $lento->id, 'concepto' => 'venta', 'cantidad' => 1, 'fecha' => '2026-11-05 10:00:00']);
        // Venta fuera del periodo: no cuenta para la rotación, pero sí como última venta.
        $servicio->registrar($admin, ['producto_id' => $lento->id, 'concepto' => 'venta', 'cantidad' => 5, 'fecha' => '2026-09-01 10:00:00']);

        $this->getJson('/api/reportes/rotacion?desde=2026-11-01&hasta=2026-11-30')
            ->assertOk()
            ->assertJsonCount(3, 'productos')
            ->assertJsonPath('productos.0.codigo', 'NUL')
            ->assertJsonPath('productos.0.unidades_vendidas', 0)
            ->assertJsonPath('productos.0.ultima_venta', null)
            ->assertJsonPath('productos.0.dias_sin_venta', null)
            ->assertJsonPath('productos.0.valor_inmovilizado', '40.00')
            ->assertJsonPath('productos.1.codigo', 'LEN')
            ->assertJsonPath('productos.1.unidades_vendidas', 1)
            ->assertJsonPath('productos.1.dias_sin_venta', 25)
            ->assertJsonPath('productos.2.codigo', 'EST')
            ->assertJsonPath('productos.2.unidades_vendidas', 30);

        $this->getJson('/api/reportes/rotacion?desde=2026-11-01&hasta=2026-11-30&limite=1')->assertJsonCount(1, 'productos');
    }

    public function test_reporte_de_movimientos_incluye_todos_los_dias_del_periodo(): void
    {
        $admin = $this->comoAdministrador();
        $servicio = app(InventarioService::class);
        $proveedor = Proveedor::factory()->create();
        $producto = $this->crearProducto();

        $servicio->registrar($admin, ['producto_id' => $producto->id, 'concepto' => 'compra', 'cantidad' => 20, 'proveedor_id' => $proveedor->id, 'fecha' => '2026-11-02 09:00:00']);
        $servicio->registrar($admin, ['producto_id' => $producto->id, 'concepto' => 'venta', 'cantidad' => 3, 'fecha' => '2026-11-02 15:00:00']);
        $servicio->registrar($admin, ['producto_id' => $producto->id, 'concepto' => 'venta', 'cantidad' => 4, 'fecha' => '2026-11-04 12:00:00']);

        $this->getJson('/api/reportes/movimientos?desde=2026-11-01&hasta=2026-11-05')
            ->assertOk()
            ->assertJsonPath('totales', [
                'movimientos_entrada' => 1, 'movimientos_salida' => 2,
                'unidades_entrada' => 20, 'unidades_salida' => 7, 'variacion_neta' => 13,
            ])
            ->assertJsonPath('por_dia', [
                ['fecha' => '2026-11-01', 'entradas' => 0, 'salidas' => 0],
                ['fecha' => '2026-11-02', 'entradas' => 20, 'salidas' => 3],
                ['fecha' => '2026-11-03', 'entradas' => 0, 'salidas' => 0],
                ['fecha' => '2026-11-04', 'entradas' => 0, 'salidas' => 4],
                ['fecha' => '2026-11-05', 'entradas' => 0, 'salidas' => 0],
            ]);
    }

    public function test_lista_los_usuarios_que_registraron_movimientos(): void
    {
        $admin = $this->crearUsuario('Administrador');
        $empleado = $this->comoEmpleado();
        $this->crearUsuario('Empleado'); // sin movimientos
        $producto = $this->crearProducto();

        app(InventarioService::class)->registrar($admin, ['producto_id' => $producto->id, 'concepto' => 'reposicion', 'cantidad' => 2]);
        app(InventarioService::class)->registrar($empleado, ['producto_id' => $producto->id, 'concepto' => 'venta', 'cantidad' => 1]);

        $this->getJson('/api/movimientos/usuarios')
            ->assertOk()
            ->assertJsonCount(2)
            ->assertJsonFragment(['id' => $admin->id, 'usuario' => $admin->usuario])
            ->assertJsonFragment(['id' => $empleado->id, 'usuario' => $empleado->usuario]);

        $this->getJson("/api/movimientos?usuario_id={$empleado->id}")->assertJsonPath('total', 1);
    }

    public function test_los_dias_se_cuentan_en_la_hora_local_del_negocio(): void
    {
        config(['inventario.zona_horaria' => 'America/El_Salvador']); // UTC-6
        $admin = $this->comoAdministrador();
        $producto = $this->crearProducto(['precio' => '10.00'], stockInicial: 10);

        // 2026-11-10 02:30 UTC = 9 de noviembre, 8:30 p. m. en El Salvador.
        app(InventarioService::class)->registrar($admin, [
            'producto_id' => $producto->id, 'concepto' => 'venta', 'cantidad' => 2, 'fecha' => '2026-11-10T02:30:00Z',
        ]);

        $this->getJson('/api/reportes/ventas?desde=2026-11-09&hasta=2026-11-09')
            ->assertJsonPath('totales.unidades', 2)
            ->assertJsonPath('por_dia.0.fecha', '2026-11-09');
        $this->getJson('/api/reportes/ventas?desde=2026-11-10&hasta=2026-11-10')->assertJsonPath('totales.unidades', 0);
        $this->getJson('/api/reportes/movimientos?desde=2026-11-09&hasta=2026-11-10')
            ->assertJsonPath('por_dia.0', ['fecha' => '2026-11-09', 'entradas' => 0, 'salidas' => 2])
            ->assertJsonPath('por_dia.1', ['fecha' => '2026-11-10', 'entradas' => 0, 'salidas' => 0]);

        $this->getJson('/api/movimientos?concepto=venta&desde=2026-11-09&hasta=2026-11-09')->assertJsonPath('total', 1);
        $this->getJson('/api/movimientos?concepto=venta&desde=2026-11-10')->assertJsonPath('total', 0);
    }

    public function test_los_reportes_detallados_son_exclusivos_del_administrador(): void
    {
        $this->comoEmpleado();

        $this->getJson('/api/reportes/existencias')->assertForbidden();
        $this->getJson('/api/reportes/rotacion')->assertForbidden();
    }
}
