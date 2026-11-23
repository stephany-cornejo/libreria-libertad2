<?php

namespace App\Models;

use Database\Factories\ProveedorFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Proveedor extends Model
{
    /** @use HasFactory<ProveedorFactory> */
    use HasFactory;

    public const ACTIVO = 'activo';

    public const INACTIVO = 'inactivo';

    protected $table = 'proveedores';

    protected $attributes = ['estado' => self::ACTIVO];

    protected $fillable = ['codigo', 'nombre', 'contacto', 'email', 'telefono', 'direccion'];

    public function movimientos(): HasMany
    {
        return $this->hasMany(Movimiento::class);
    }

    public function estaActivo(): bool
    {
        return $this->estado === self::ACTIVO;
    }

    public function scopeActivos(Builder $query): Builder
    {
        return $query->where('estado', self::ACTIVO);
    }
}
