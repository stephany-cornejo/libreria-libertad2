<?php

namespace Tests\Concerns;

use App\Models\Categoria;
use App\Models\Producto;
use App\Models\Rol;
use App\Models\User;
use App\Services\InventarioService;
use Illuminate\Support\Str;

trait CreaDatosDeInventario
{
    protected function crearUsuario(string $rol = 'Administrador', string $estado = 'activo'): User
    {
        $rolModelo = Rol::firstOrCreate(['nombre' => $rol]);

        return User::create([
            'name' => "Usuario {$rol}",
            'usuario' => Str::lower($rol).'_'.Str::random(6),
            'password' => 'secreto123',
            'id_rol' => $rolModelo->id,
            'estado' => $estado,
        ]);
    }

    protected function comoAdministrador(): User
    {
        $usuario = $this->crearUsuario('Administrador');
        $this->actingAs($usuario);

        return $usuario;
    }

    protected function comoEmpleado(): User
    {
        $usuario = $this->crearUsuario('Empleado');
        $this->actingAs($usuario);

        return $usuario;
    }

    protected function crearProducto(array $atributos = [], int $stockInicial = 0): Producto
    {
        $categoria = Categoria::firstOrCreate(['nombre' => $atributos['categoria'] ?? 'Literatura']);
        unset($atributos['categoria']);

        $producto = Producto::create(array_merge([
            'categoria_id' => $categoria->id,
            'codigo' => 'PRD-'.Str::upper(Str::random(8)),
            'nombre' => 'Producto de prueba',
            'precio' => '10.00',
            'stock_minimo' => 5,
        ], $atributos));

        if ($stockInicial > 0) {
            app(InventarioService::class)->registrar($this->crearUsuario(), [
                'producto_id' => $producto->id,
                'concepto' => 'reposicion',
                'cantidad' => $stockInicial,
            ]);
        }

        return $producto->refresh();
    }
}
