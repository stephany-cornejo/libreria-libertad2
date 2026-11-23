<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Producto extends Model
{
    protected $table = 'productos';

    protected $attributes = ['stock' => 0, 'stock_minimo' => 0];

    protected $fillable = ['categoria_id', 'codigo', 'nombre', 'descripcion', 'precio', 'stock_minimo'];

    protected function casts(): array
    {
        return [
            'precio' => 'decimal:2',
            'stock' => 'integer',
            'stock_minimo' => 'integer',
        ];
    }

    public function categoria(): BelongsTo
    {
        return $this->belongsTo(Categoria::class);
    }

    public function movimientos(): HasMany
    {
        return $this->hasMany(Movimiento::class);
    }

    /** Productos sin unidades disponibles. */
    public function scopeAgotados(Builder $query): Builder
    {
        return $query->where('stock', 0);
    }

    /** Productos con unidades disponibles, pero en o por debajo de su stock mínimo. */
    public function scopeStockBajo(Builder $query): Builder
    {
        return $query->where('stock', '>', 0)->whereColumn('stock', '<=', 'stock_minimo');
    }
}
