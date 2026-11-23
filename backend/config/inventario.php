<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Zona horaria del negocio
    |--------------------------------------------------------------------------
    |
    | Las fechas se guardan en la zona horaria de la aplicación (UTC). Los
    | reportes y filtros por día del inventario interpretan "un día" según
    | esta zona, para que una venta de las 8:00 p. m. cuente en ese día local
    | y no en el siguiente.
    |
    */

    'zona_horaria' => env('INVENTARIO_ZONA_HORARIA', 'America/El_Salvador'),

];
