<?php

namespace App\Enums;

enum TipoMovimiento: string
{
    case Entrada = 'entrada';
    case Salida = 'salida';

    public function etiqueta(): string
    {
        return match ($this) {
            self::Entrada => 'Entrada',
            self::Salida => 'Salida',
        };
    }

    /**
     * @return list<ConceptoMovimiento>
     */
    public function conceptos(): array
    {
        return array_values(array_filter(
            ConceptoMovimiento::cases(),
            fn (ConceptoMovimiento $concepto) => $concepto->tipo() === $this,
        ));
    }
}
