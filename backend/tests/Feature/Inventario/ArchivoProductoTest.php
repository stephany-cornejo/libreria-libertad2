<?php

namespace Tests\Feature\Inventario;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\Concerns\CreaDatosDeInventario;
use Tests\TestCase;

class ArchivoProductoTest extends TestCase
{
    use CreaDatosDeInventario, RefreshDatabase;

    public function test_adjuntos_se_validan_y_se_consultan_por_producto_y_rol(): void
    {
        $ruta = '/api/productos/'.$this->crearProducto()->id.'/archivos';
        $contenido = "%PDF-1.4\n%%EOF";
        $pdf = fn () => UploadedFile::fake()->createWithContent('Ficha.pdf', $contenido);
        $this->getJson($ruta)->assertUnauthorized();
        $this->comoAdministrador();
        $this->postJson($ruta, ['archivo' => UploadedFile::fake()->createWithContent('Ficha.pdf', 'texto')])
            ->assertUnprocessable();
        $id = $this->postJson($ruta, ['archivo' => $pdf()])->assertCreated()->json('id');
        $this->comoEmpleado();
        $this->postJson($ruta, ['archivo' => $pdf()])->assertForbidden();
        $this->getJson($ruta)->assertOk()->assertJsonPath('0.nombre', 'Ficha.pdf');
        $this->assertSame($contenido, $this->get($ruta.'/'.$id)->assertOk()->getContent());
        $this->getJson('/api/productos/'.$this->crearProducto()->id.'/archivos/'.$id)->assertNotFound();
    }
}
