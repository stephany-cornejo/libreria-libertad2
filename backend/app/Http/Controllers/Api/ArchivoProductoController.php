<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Producto;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ArchivoProductoController extends Controller
{
    public function index(Producto $producto)
    {
        return DB::table('archivos_producto')->where('producto_id', $producto->id)
            ->orderBy('id')->get(['id', 'nombre', 'mime']);
    }

    public function store(Request $request, Producto $producto)
    {
        $request->validate(['archivo' => ['required', 'file', 'max:2048', 'mimetypes:application/pdf,image/png,image/jpeg']]);
        $file = $request->file('archivo');
        $name = mb_substr(basename($file->getClientOriginalName()), 0, 200);
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($file->getRealPath());
        if (!in_array($mime, ['application/pdf', 'image/png', 'image/jpeg'], true)) {
            throw \Illuminate\Validation\ValidationException::withMessages(['archivo' => 'El contenido debe ser PDF, JPG o PNG.']);
        }
        $id = DB::table('archivos_producto')->insertGetId([
            'producto_id' => $producto->id,
            'nombre' => $name,
            'mime' => $mime,
            'contenido' => base64_encode($file->getContent()),
        ]);
        return response()->json(['id' => $id, 'nombre' => $name, 'mime' => $mime], 201);
    }

    public function show(Producto $producto, int $archivo)
    {
        $row = DB::table('archivos_producto')->where('producto_id', $producto->id)->find($archivo);
        abort_unless($row, 404);
        return response(base64_decode($row->contenido), 200, [
            'Content-Type' => $row->mime, 'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store', 'Content-Disposition' => 'attachment',
        ]);
    }
}
