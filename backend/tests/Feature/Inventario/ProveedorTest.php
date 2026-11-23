<?php

namespace Tests\Feature\Inventario;

use App\Models\Proveedor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreaDatosDeInventario;
use Tests\TestCase;

class ProveedorTest extends TestCase
{
    use CreaDatosDeInventario, RefreshDatabase;

    private function datosValidos(array $cambios = []): array
    {
        return array_merge([
            'codigo' => 'PROV-001',
            'nombre' => 'Distribuidora Papel y Tinta',
            'contacto' => 'Ana López',
            'email' => 'ventas@papelytinta.test',
            'telefono' => '+503 2222-3333',
            'direccion' => 'San Salvador',
        ], $cambios);
    }

    public function test_el_administrador_registra_un_proveedor_activo(): void
    {
        $this->comoAdministrador();

        $this->postJson('/api/proveedores', $this->datosValidos())
            ->assertCreated()
            ->assertJsonPath('codigo', 'PROV-001')
            ->assertJsonPath('estado', 'activo');

        $this->assertDatabaseHas('proveedores', ['codigo' => 'PROV-001', 'estado' => 'activo']);
    }

    public function test_valida_los_datos_del_proveedor(): void
    {
        $this->comoAdministrador();
        Proveedor::factory()->create(['codigo' => 'PROV-001']);

        $this->postJson('/api/proveedores', $this->datosValidos([
            'nombre' => '',
            'email' => 'no-es-un-correo',
            'telefono' => 'llamar mañana',
            'estado' => 'inactivo',
        ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['codigo', 'nombre', 'email', 'telefono', 'estado']);
    }

    public function test_el_administrador_edita_un_proveedor_conservando_su_codigo(): void
    {
        $this->comoAdministrador();
        $proveedor = Proveedor::factory()->create(['codigo' => 'PROV-001']);

        $this->putJson("/api/proveedores/{$proveedor->id}", $this->datosValidos(['nombre' => 'Nuevo nombre']))
            ->assertOk()
            ->assertJsonPath('nombre', 'Nuevo nombre');
    }

    public function test_el_administrador_desactiva_y_reactiva_un_proveedor(): void
    {
        $this->comoAdministrador();
        $proveedor = Proveedor::factory()->create();

        $this->patchJson("/api/proveedores/{$proveedor->id}/estado", ['estado' => 'inactivo'])
            ->assertOk()
            ->assertJsonPath('estado', 'inactivo');

        $this->patchJson("/api/proveedores/{$proveedor->id}/estado", ['estado' => 'activo'])
            ->assertOk()
            ->assertJsonPath('estado', 'activo');

        $this->patchJson("/api/proveedores/{$proveedor->id}/estado", ['estado' => 'eliminado'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('estado');
    }

    public function test_la_consulta_filtra_por_texto_y_estado(): void
    {
        $this->comoAdministrador();
        Proveedor::factory()->create(['nombre' => 'Editorial Puente de Letras']);
        Proveedor::factory()->create(['nombre' => 'Papelería Prisma']);
        Proveedor::factory()->inactivo()->create(['nombre' => 'Editorial Cerrada']);

        $this->getJson('/api/proveedores?buscar=editorial')
            ->assertOk()
            ->assertJsonCount(2);

        $this->getJson('/api/proveedores?buscar=editorial&estado=activo')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.nombre', 'Editorial Puente de Letras');
    }

    public function test_el_empleado_consulta_proveedores_pero_no_los_gestiona(): void
    {
        $this->comoEmpleado();
        $proveedor = Proveedor::factory()->create();

        $this->getJson('/api/proveedores')->assertOk()->assertJsonCount(1);
        $this->getJson("/api/proveedores/{$proveedor->id}")->assertOk();

        $this->postJson('/api/proveedores', $this->datosValidos())->assertForbidden();
        $this->putJson("/api/proveedores/{$proveedor->id}", $this->datosValidos())->assertForbidden();
        $this->patchJson("/api/proveedores/{$proveedor->id}/estado", ['estado' => 'inactivo'])->assertForbidden();
    }

    public function test_un_visitante_sin_sesion_no_accede(): void
    {
        $this->getJson('/api/proveedores')->assertUnauthorized();
    }
}
