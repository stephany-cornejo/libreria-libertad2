<?php

namespace Database\Factories;

use App\Models\Proveedor;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Proveedor>
 */
class ProveedorFactory extends Factory
{
    protected $model = Proveedor::class;

    public function definition(): array
    {
        return [
            'codigo' => 'PROV-'.fake()->unique()->numerify('####'),
            'nombre' => fake()->company(),
            'contacto' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'telefono' => fake()->numerify('+503 2###-####'),
            'direccion' => fake()->address(),
        ];
    }

    public function inactivo(): static
    {
        return $this->afterMaking(fn (Proveedor $proveedor) => $proveedor->estado = Proveedor::INACTIVO);
    }
}
