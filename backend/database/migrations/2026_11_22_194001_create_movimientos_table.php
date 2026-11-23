<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('movimientos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('producto_id')->constrained('productos')->restrictOnDelete();
            $table->foreignId('proveedor_id')->nullable()->constrained('proveedores')->restrictOnDelete();
            $table->foreignId('usuario_id')->constrained('users')->restrictOnDelete();
            $table->enum('tipo', ['entrada', 'salida']);
            $table->enum('concepto', ['compra', 'reposicion', 'devolucion', 'venta', 'perdida', 'dano', 'ajuste']);
            $table->unsignedInteger('cantidad');
            $table->unsignedInteger('stock_anterior');
            $table->unsignedInteger('stock_resultante');
            $table->decimal('precio_unitario', 10, 2)->nullable();
            $table->dateTime('fecha');
            $table->string('referencia', 80)->nullable()->unique();
            $table->string('motivo', 250);
            $table->timestamps();

            $table->index(['producto_id', 'fecha']);
            $table->index(['tipo', 'concepto', 'fecha']);
            $table->index(['usuario_id', 'fecha']);
            $table->index('fecha');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('movimientos');
    }
};
