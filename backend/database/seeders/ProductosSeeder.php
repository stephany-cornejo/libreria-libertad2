<?php

namespace Database\Seeders;

use App\Models\Categoria;
use App\Models\Producto;
use Illuminate\Database\Seeder;

class ProductosSeeder extends Seeder
{
    public const PREFIJO = 'SKU-';

    public function run(): void
    {
        $catalogo = [
            'LIB' => [
                'categoria' => 'Literatura',
                'precios' => [425, 1850],
                'productos' => [
                    'Antología de cuentos',
                    'Novela de aventuras',
                    'Poesía breve',
                    'Relatos fantásticos',
                    'Novela histórica',
                    'Fábulas ilustradas',
                    'Cuentos de misterio',
                    'Teatro contemporáneo',
                    'Leyendas latinoamericanas',
                    'Narrativa juvenil',
                ],
            ],
            'INF' => [
                'categoria' => 'Libros infantiles',
                'precios' => [250, 1275],
                'productos' => [
                    'Abecedario ilustrado',
                    'Animales de la granja',
                    'Cuentos para dormir',
                    'Mi primer atlas',
                    'Libro de texturas',
                    'Historias del bosque',
                    'Busca y encuentra',
                    'Rimas para jugar',
                    'Mi primer diccionario',
                    'Actividades preescolares',
                ],
            ],
            'ESC' => [
                'categoria' => 'Textos escolares',
                'precios' => [375, 1590],
                'productos' => [
                    'Matemática básica',
                    'Lenguaje y lectura',
                    'Ciencias naturales',
                    'Estudios sociales',
                    'Inglés inicial',
                    'Guía de ortografía',
                    'Ejercicios de geometría',
                    'Educación ambiental',
                    'Lectura comprensiva',
                    'Práctica de caligrafía',
                ],
            ],
            'CUA' => [
                'categoria' => 'Cuadernos',
                'precios' => [85, 650],
                'productos' => [
                    'Rayado 100 hojas',
                    'Cuadriculado 100 hojas',
                    'Español pentagramado',
                    'Espiral universitario',
                    'Libreta de bolsillo',
                    'Bitácora punteada',
                    'Tapa dura rayado',
                    'Dibujo escolar',
                    'Cosido 50 hojas',
                    'Cuaderno de caligrafía',
                ],
            ],
            'ESC2' => [
                'categoria' => 'Escritura',
                'precios' => [20, 495],
                'productos' => [
                    'Bolígrafo azul',
                    'Bolígrafo negro',
                    'Bolígrafo rojo',
                    'Lápiz grafito HB',
                    'Portaminas 0.7 mm',
                    'Resaltadores pastel',
                    'Marcador permanente',
                    'Marcadores de pizarra',
                    'Pluma de gel',
                    'Rotulador punta fina',
                ],
            ],
            'ART' => [
                'categoria' => 'Arte y dibujo',
                'precios' => [95, 1390],
                'productos' => [
                    'Acuarelas 12 colores',
                    'Témperas escolares',
                    'Crayones de cera',
                    'Lápices de colores',
                    'Pinceles surtidos',
                    'Bloc para acuarela',
                    'Carboncillos',
                    'Paleta de mezcla',
                    'Pintura acrílica',
                    'Pasteles secos',
                ],
            ],
            'PAP' => [
                'categoria' => 'Papel y cartulina',
                'precios' => [45, 875],
                'productos' => [
                    'Resma carta',
                    'Resma oficio',
                    'Papel bond de colores',
                    'Cartulina blanca',
                    'Cartulina negra',
                    'Papel construcción',
                    'Papel crepé surtido',
                    'Papel opalina',
                    'Papel vegetal',
                    'Papel kraft',
                ],
            ],
            'OFI' => [
                'categoria' => 'Oficina',
                'precios' => [35, 1250],
                'productos' => [
                    'Grapadora mediana',
                    'Caja de grapas',
                    'Perforadora doble',
                    'Clips metálicos',
                    'Carpeta de anillos',
                    'Sobre manila carta',
                    'Archivador de palanca',
                    'Notas adhesivas',
                    'Cinta transparente',
                    'Etiquetas adhesivas',
                ],
            ],
            'GEO' => [
                'categoria' => 'Geometría',
                'precios' => [45, 720],
                'productos' => [
                    'Regla 30 cm',
                    'Escuadra 45 grados',
                    'Cartabón',
                    'Transportador',
                    'Compás metálico',
                    'Juego de geometría',
                    'Regla flexible',
                    'Regla triangular',
                    'Plantilla de círculos',
                    'Cinta métrica escolar',
                ],
            ],
            'MAN' => [
                'categoria' => 'Manualidades',
                'precios' => [30, 560],
                'productos' => [
                    'Tijera escolar',
                    'Pegamento en barra',
                    'Adhesivo líquido',
                    'Silicón frío',
                    'Espuma de colores',
                    'Palitos de madera',
                    'Ojos móviles',
                    'Limpiapipas surtidos',
                    'Cinta decorativa',
                    'Pompón surtido',
                ],
            ],
            'PLA' => [
                'categoria' => 'Agendas y planificación',
                'precios' => [225, 975],
                'productos' => [
                    'Agenda semanal',
                    'Agenda diaria',
                    'Calendario de escritorio',
                    'Planificador mensual',
                    'Planificador escolar',
                    'Registro de notas',
                    'Agenda académica',
                    'Calendario mural',
                    'Lista de tareas',
                    'Organizador de bolsillo',
                ],
            ],
            'DID' => [
                'categoria' => 'Material didáctico',
                'precios' => [175, 1125],
                'productos' => [
                    'Memoria de animales',
                    'Tarjetas de sílabas',
                    'Rompecabezas de mapas',
                    'Dominó de números',
                    'Ábaco escolar',
                    'Tarjetas bilingües',
                    'Set de figuras geométricas',
                    'Lotería de palabras',
                    'Reloj didáctico',
                    'Dados de operaciones',
                ],
            ],
        ];

        foreach ($catalogo as $linea => $grupo) {
            $categoria = Categoria::where('nombre', $grupo['categoria'])->firstOrFail();
            [$minimo, $maximo] = $grupo['precios'];

            foreach ($grupo['productos'] as $indice => $nombre) {
                $codigo = sprintf('%s%s-%02d', self::PREFIJO, $linea, $indice + 1);
                $precioEnCentavos = $minimo + intdiv(($maximo - $minimo) * $indice, count($grupo['productos']) - 1);

                Producto::firstOrCreate(['codigo' => $codigo], [
                    'categoria_id' => $categoria->id,
                    'nombre' => $nombre,
                    'precio' => sprintf('%d.%02d', intdiv($precioEnCentavos, 100), $precioEnCentavos % 100),
                    'stock_minimo' => 3 + $indice % 6,
                ]);
            }
        }
    }
}
