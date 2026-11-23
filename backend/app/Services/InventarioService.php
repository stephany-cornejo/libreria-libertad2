<?php

namespace App\Services;

use App\Enums\ConceptoMovimiento;
use App\Enums\TipoMovimiento;
use App\Models\Movimiento;
use App\Models\Producto;
use App\Models\Proveedor;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Único punto de entrada para modificar las existencias de un producto.
 *
 * Cada movimiento se registra en una transacción que bloquea la fila del
 * producto (SELECT ... FOR UPDATE), de modo que dos operaciones simultáneas
 * nunca calculen el stock a partir del mismo valor anterior.
 */
class InventarioService
{
    /** Límite de la columna UNSIGNED INT de MySQL. */
    private const STOCK_MAXIMO = 4294967295;

    /**
     * @param  array{
     *     producto_id: int,
     *     concepto: string|ConceptoMovimiento,
     *     cantidad: int,
     *     proveedor_id?: int|null,
     *     precio_unitario?: string|float|null,
     *     fecha?: string|\DateTimeInterface|null,
     *     referencia?: string|null,
     *     motivo?: string|null,
     * }  $datos
     *
     * @throws AuthorizationException Si el concepto exige un rol que el usuario no tiene.
     * @throws ValidationException Si la operación viola una regla de inventario.
     */
    public function registrar(User $usuario, array $datos): Movimiento
    {
        $concepto = $datos['concepto'] instanceof ConceptoMovimiento
            ? $datos['concepto']
            : ConceptoMovimiento::from($datos['concepto']);

        $this->verificarReglas($usuario, $concepto, $datos);

        return DB::transaction(function () use ($usuario, $concepto, $datos) {
            $producto = Producto::query()->lockForUpdate()->findOrFail($datos['producto_id']);

            $cantidad = (int) $datos['cantidad'];
            $stockAnterior = $producto->stock;
            $stockResultante = $this->calcularStock($concepto->tipo(), $stockAnterior, $cantidad);

            $producto->forceFill(['stock' => $stockResultante])->save();

            return Movimiento::create([
                'producto_id' => $producto->id,
                'proveedor_id' => $datos['proveedor_id'] ?? null,
                'usuario_id' => $usuario->id,
                'tipo' => $concepto->tipo(),
                'concepto' => $concepto,
                'cantidad' => $cantidad,
                'stock_anterior' => $stockAnterior,
                'stock_resultante' => $stockResultante,
                'precio_unitario' => $this->precioUnitario($concepto, $producto, $datos),
                'fecha' => isset($datos['fecha']) ? Carbon::parse($datos['fecha']) : now(),
                'referencia' => $datos['referencia'] ?? null,
                'motivo' => $datos['motivo'] ?? null,
            ]);
        }, attempts: 3);
    }

    private function verificarReglas(User $usuario, ConceptoMovimiento $concepto, array $datos): void
    {
        if ($concepto->requiereAutorizacion() && ! $usuario->esAdministrador()) {
            throw new AuthorizationException('Solo un Administrador puede registrar ajustes de inventario.');
        }

        if ((int) ($datos['cantidad'] ?? 0) < 1) {
            throw ValidationException::withMessages([
                'cantidad' => 'La cantidad debe ser un número entero mayor que cero.',
            ]);
        }

        $proveedorId = $datos['proveedor_id'] ?? null;

        if ($proveedorId === null && $concepto->requiereProveedor()) {
            throw ValidationException::withMessages([
                'proveedor_id' => 'Debes indicar el proveedor de la compra.',
            ]);
        }

        if ($proveedorId !== null && ! $concepto->admiteProveedor()) {
            throw ValidationException::withMessages([
                'proveedor_id' => "El concepto {$concepto->etiqueta()} no admite proveedor.",
            ]);
        }

        if ($proveedorId !== null && ! Proveedor::query()->activos()->whereKey($proveedorId)->exists()) {
            throw ValidationException::withMessages([
                'proveedor_id' => 'El proveedor seleccionado no existe o está inactivo.',
            ]);
        }

        if ($concepto->requiereMotivo() && blank($datos['motivo'] ?? null)) {
            throw ValidationException::withMessages([
                'motivo' => "Debes indicar el motivo de la {$concepto->tipo()->value} por {$concepto->etiqueta()}.",
            ]);
        }
    }

    private function calcularStock(TipoMovimiento $tipo, int $stockAnterior, int $cantidad): int
    {
        if ($tipo === TipoMovimiento::Salida) {
            if ($cantidad > $stockAnterior) {
                throw ValidationException::withMessages([
                    'cantidad' => "La salida supera las existencias disponibles ({$stockAnterior} ".
                        ($stockAnterior === 1 ? 'unidad' : 'unidades').').',
                ]);
            }

            return $stockAnterior - $cantidad;
        }

        if ($stockAnterior + $cantidad > self::STOCK_MAXIMO) {
            throw ValidationException::withMessages([
                'cantidad' => 'La entrada supera la capacidad máxima de existencias del producto.',
            ]);
        }

        return $stockAnterior + $cantidad;
    }

    /**
     * Las ventas guardan el precio vigente del producto si no se indica otro,
     * para que los reportes de ventas no cambien cuando el precio se actualice.
     */
    private function precioUnitario(ConceptoMovimiento $concepto, Producto $producto, array $datos): ?string
    {
        if (isset($datos['precio_unitario'])) {
            return (string) $datos['precio_unitario'];
        }

        return $concepto === ConceptoMovimiento::Venta ? (string) $producto->precio : null;
    }
}
