<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ReporteInventarioService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class ReporteController extends Controller
{
    /** Periodo por defecto cuando no se envían fechas. */
    private const DIAS_POR_DEFECTO = 30;

    /** Periodo máximo permitido para evitar consultas desproporcionadas. */
    private const DIAS_MAXIMOS = 366;

    public function __construct(private readonly ReporteInventarioService $reportes) {}

    public function inventario(): JsonResponse
    {
        return response()->json($this->reportes->inventario());
    }

    public function movimientos(Request $request): JsonResponse
    {
        [$desde, $hasta] = $this->periodo($request);

        return response()->json($this->reportes->movimientos($desde, $hasta));
    }

    public function ventas(Request $request): JsonResponse
    {
        [$desde, $hasta] = $this->periodo($request);
        $datos = $request->validate(['limite' => ['nullable', 'integer', 'min:1', 'max:50']]);

        return response()->json($this->reportes->ventas($desde, $hasta, (int) ($datos['limite'] ?? 10)));
    }

    /**
     * @return array{0: Carbon, 1: Carbon}
     */
    private function periodo(Request $request): array
    {
        $datos = $request->validate([
            'desde' => ['nullable', 'date_format:Y-m-d'],
            'hasta' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:desde'],
        ]);

        $hasta = isset($datos['hasta']) ? Carbon::parse($datos['hasta'])->endOfDay() : now()->endOfDay();
        $desde = isset($datos['desde'])
            ? Carbon::parse($datos['desde'])->startOfDay()
            : $hasta->copy()->subDays(self::DIAS_POR_DEFECTO - 1)->startOfDay();

        if ($desde->greaterThan($hasta)) {
            throw ValidationException::withMessages([
                'desde' => 'La fecha inicial no puede ser posterior a la fecha final.',
            ]);
        }

        if ($desde->diffInDays($hasta) > self::DIAS_MAXIMOS) {
            throw ValidationException::withMessages([
                'desde' => 'El periodo no puede superar '.self::DIAS_MAXIMOS.' días.',
            ]);
        }

        return [$desde, $hasta];
    }
}
