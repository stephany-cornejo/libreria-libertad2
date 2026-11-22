<?php

namespace Database\Seeders;

use App\Models\Categoria;
use Illuminate\Database\Seeder;

class CategoriasSeeder extends Seeder
{
    public function run(): void
    {
        $categorias = [
            'Literatura' => 'Narrativa, poesía y lecturas para distintas edades.',
            'Libros infantiles' => 'Lecturas ilustradas y actividades para niñas y niños.',
            'Textos escolares' => 'Guías y materiales de apoyo para el aula.',
            'Cuadernos' => 'Cuadernos y libretas para estudio y trabajo.',
            'Escritura' => 'Instrumentos de escritura y marcado.',
            'Arte y dibujo' => 'Materiales para dibujo, pintura y manualidades.',
            'Papel y cartulina' => 'Papel para impresión, archivo y manualidades.',
            'Oficina' => 'Suministros de escritorio y archivo.',
            'Geometría' => 'Instrumentos de medición y trazado.',
            'Manualidades' => 'Accesorios para recortar, pegar y decorar.',
            'Agendas y planificación' => 'Agendas, calendarios y organizadores.',
            'Material didáctico' => 'Juegos y recursos de aprendizaje.',
        ];

        foreach ($categorias as $nombre => $descripcion) {
            Categoria::firstOrCreate(['nombre' => $nombre], ['descripcion' => $descripcion]);
        }
    }
}
