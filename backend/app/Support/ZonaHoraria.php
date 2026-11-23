<?php

namespace App\Support;

use Illuminate\Support\Carbon;

/**
 * Conversión entre días locales del negocio y fechas guardadas en la base.
 *
 * Las columnas de fecha se guardan en la zona de la aplicación (config app.timezone).
 * Los filtros y reportes trabajan con días locales (config inventario.zona_horaria).
 */
class ZonaHoraria
{
    public static function local(): string
    {
        return config('inventario.zona_horaria', 'America/El_Salvador');
    }

    public static function app(): string
    {
        return config('app.timezone', 'UTC');
    }

    /** Fecha y hora actual en la zona local. */
    public static function ahora(): Carbon
    {
        return Carbon::now(self::local());
    }

    /** Inicio de un día local ('Y-m-d'), expresado en la zona de la base. */
    public static function inicioDelDia(string $fecha): Carbon
    {
        return Carbon::parse($fecha, self::local())->startOfDay()->setTimezone(self::app());
    }

    /** Fin de un día local ('Y-m-d'), expresado en la zona de la base. */
    public static function finDelDia(string $fecha): Carbon
    {
        return Carbon::parse($fecha, self::local())->endOfDay()->setTimezone(self::app());
    }

    /** Copia de un instante expresado en la zona de la base (para consultas). */
    public static function enBase(Carbon $instante): Carbon
    {
        return $instante->copy()->setTimezone(self::app());
    }

    /**
     * Expresión SQL que convierte una columna de fecha de la base a la hora local.
     * Usa desplazamientos numéricos (+00:00 → -06:00): no requiere cargar las
     * tablas de zonas horarias de MySQL/MariaDB.
     */
    public static function columnaLocal(string $columna): string
    {
        $desde = Carbon::now(self::app())->format('P');
        $hacia = Carbon::now(self::local())->format('P');

        if (\Illuminate\Support\Facades\DB::connection()->getDriverName() === 'sqlite') {
            $segundos = Carbon::now(self::local())->offset - Carbon::now(self::app())->offset;
            return "datetime({$columna}, '{$segundos} seconds')";
        }
        return $desde === $hacia ? $columna : "CONVERT_TZ({$columna}, '{$desde}', '{$hacia}')";
    }
}
