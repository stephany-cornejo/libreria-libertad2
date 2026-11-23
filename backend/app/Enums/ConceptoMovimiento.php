<?php

namespace App\Enums;

/**
 * Motivo de negocio de un movimiento de inventario.
 *
 * Cada concepto pertenece a un único tipo (entrada o salida) y define
 * qué datos adicionales exige al registrarse.
 */
enum ConceptoMovimiento: string
{
    // Entradas
    case Compra = 'compra';
    case Reposicion = 'reposicion';
    case Devolucion = 'devolucion';

    // Salidas
    case Venta = 'venta';
    case Perdida = 'perdida';
    case Dano = 'dano';
    case Ajuste = 'ajuste';

    public function tipo(): TipoMovimiento
    {
        return match ($this) {
            self::Compra, self::Reposicion, self::Devolucion => TipoMovimiento::Entrada,
            self::Venta, self::Perdida, self::Dano, self::Ajuste => TipoMovimiento::Salida,
        };
    }

    public function etiqueta(): string
    {
        return match ($this) {
            self::Compra => 'Compra',
            self::Reposicion => 'Reposición',
            self::Devolucion => 'Devolución',
            self::Venta => 'Venta',
            self::Perdida => 'Pérdida',
            self::Dano => 'Daño',
            self::Ajuste => 'Ajuste autorizado',
        };
    }

    /** La compra siempre debe identificar al proveedor. */
    public function requiereProveedor(): bool
    {
        return $this === self::Compra;
    }

    /** Solo las entradas de mercadería de un proveedor pueden asociarlo. */
    public function admiteProveedor(): bool
    {
        return in_array($this, [self::Compra, self::Reposicion], true);
    }

    /** Conceptos que alteran el inventario sin una operación comercial deben justificarse. */
    public function requiereMotivo(): bool
    {
        return in_array($this, [self::Devolucion, self::Perdida, self::Dano, self::Ajuste], true);
    }

    /** Los ajustes solo pueden registrarlos usuarios con rol Administrador. */
    public function requiereAutorizacion(): bool
    {
        return $this === self::Ajuste;
    }

    /**
     * @return list<string>
     */
    public static function valores(): array
    {
        return array_column(self::cases(), 'value');
    }
}
