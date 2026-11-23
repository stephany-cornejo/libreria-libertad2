<?php

namespace App\Models;

use App\Enums\ConceptoMovimiento;
use App\Enums\TipoMovimiento;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

/**
 * Registro inmutable de una entrada o salida de inventario.
 *
 * Los movimientos solo se crean mediante App\Services\InventarioService,
 * que actualiza las existencias del producto en la misma transacción.
 * Una corrección se registra como un nuevo movimiento, nunca editando uno existente.
 */
class Movimiento extends Model
{
    protected $table = 'movimientos';

    protected $fillable = [
        'producto_id',
        'proveedor_id',
        'usuario_id',
        'tipo',
        'concepto',
        'cantidad',
        'stock_anterior',
        'stock_resultante',
        'precio_unitario',
        'fecha',
        'referencia',
        'motivo',
    ];

    protected function casts(): array
    {
        return [
            'tipo' => TipoMovimiento::class,
            'concepto' => ConceptoMovimiento::class,
            'cantidad' => 'integer',
            'stock_anterior' => 'integer',
            'stock_resultante' => 'integer',
            'precio_unitario' => 'decimal:2',
            'fecha' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Los movimientos de inventario no se pueden modificar.'));
        static::deleting(fn () => throw new LogicException('Los movimientos de inventario no se pueden eliminar.'));
    }

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class);
    }

    public function proveedor(): BelongsTo
    {
        return $this->belongsTo(Proveedor::class);
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }
}
