# API de inventario: proveedores, movimientos, existencias y reportes

Este documento describe el módulo de inventario del backend. Incluye los endpoints, las reglas de negocio y la forma de verificar que funciona.

Todas las rutas usan el prefijo `/api` y requieren una sesión iniciada con Sanctum (cookie). El usuario debe tener estado `activo`.

## Modelo de datos

```
proveedores 1 ──< movimientos >── 1 productos
                     │
                     └──── 1 users (usuario que registró)
```

| Tabla | Campos principales |
|---|---|
| `proveedores` | `codigo` (único), `nombre`, `contacto`, `email`, `telefono`, `direccion`, `estado` (`activo` \| `inactivo`) |
| `movimientos` | `producto_id`, `proveedor_id`, `usuario_id`, `tipo`, `concepto`, `cantidad`, `stock_anterior`, `stock_resultante`, `precio_unitario`, `fecha`, `referencia` (única), `motivo` |

### Principios

1. **El stock solo cambia mediante movimientos.** `productos.stock` no se puede editar desde el catálogo. Cada movimiento se registra en una transacción que bloquea la fila del producto (`SELECT … FOR UPDATE`). Así, dos operaciones simultáneas no pueden partir del mismo saldo.
2. **El historial es inmutable.** Un movimiento no se edita ni se elimina. Una corrección se registra como un movimiento nuevo, por ejemplo un ajuste.
3. **Trazabilidad.** Todo movimiento tiene siempre fecha, producto, usuario, cantidad y motivo; las cinco columnas son `NOT NULL`. Si el concepto no exige motivo y no se escribe uno, se guarda el motivo predeterminado del concepto. Cada movimiento guarda también quién lo registró, el stock antes y después, y el precio unitario. En las ventas, ese precio es el vigente al momento de vender.
4. **Los proveedores no se eliminan, se desactivan.** Un proveedor inactivo no puede usarse en nuevos movimientos.
5. **Un producto con movimientos no se puede eliminar**, para conservar el historial.

## Conceptos de movimiento

| Tipo | Concepto | Proveedor | Motivo | Quién puede registrarlo |
|---|---|---|---|---|
| entrada | `compra` | **Obligatorio** (activo) | Opcional; por defecto «Compra a proveedor» | Administrador, Empleado |
| entrada | `reposicion` | Opcional (activo) | Opcional; por defecto «Reposición de inventario» | Administrador, Empleado |
| entrada | `devolucion` | No admitido | **Obligatorio** | Administrador, Empleado |
| salida | `venta` | No admitido | Opcional; por defecto «Venta a cliente» | Administrador, Empleado |
| salida | `perdida` | No admitido | **Obligatorio** | Administrador, Empleado |
| salida | `dano` | No admitido | **Obligatorio** | Administrador, Empleado |
| salida | `ajuste` | No admitido | **Obligatorio** | **Solo Administrador** |

Validaciones comunes:

- **`cantidad`:** entero entre 1 y 1 000 000.
- **Salidas:** no pueden superar las existencias disponibles.
- **`fecha`:** opcional; por defecto es el momento actual. No puede ser futura.
- **`referencia`:** opcional, máximo 80 caracteres y única. Sirve, por ejemplo, para el número de factura.

## Endpoints

### Proveedores

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/proveedores?buscar=&estado=` | Todos | Lista ordenada por nombre, con `movimientos_count` |
| GET | `/proveedores/{id}` | Todos | Detalle |
| POST | `/proveedores` | Administrador | Registro (queda `activo`) |
| PUT | `/proveedores/{id}` | Administrador | Edición. El estado no se cambia aquí |
| PATCH | `/proveedores/{id}/estado` | Administrador | `{"estado": "activo" \| "inactivo"}` |

### Movimientos

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/movimientos/entradas` | Todos* | Registra una compra, reposición o devolución |
| POST | `/movimientos/salidas` | Todos* | Registra una venta, pérdida, daño o ajuste |
| GET | `/movimientos` | Todos | Historial paginado, del más reciente al más antiguo |
| GET | `/movimientos/{id}` | Todos | Detalle con producto, proveedor y usuario |
| GET | `/movimientos/conceptos` | Todos | Catálogo de conceptos y sus reglas, para construir formularios |

\* Los ajustes requieren el rol Administrador. Si los registra otro rol, la respuesta es `403`.

Ejemplo de entrada:

```http
POST /api/movimientos/entradas
{
  "producto_id": 12,
  "concepto": "compra",
  "cantidad": 24,
  "proveedor_id": 3,
  "precio_unitario": "4.50",
  "referencia": "FAC-000123",
  "fecha": "2026-11-20 10:30:00"
}
```

Respuesta `201`:

```json
{
  "id": 361, "tipo": "entrada", "concepto": "compra", "cantidad": 24,
  "stock_anterior": 6, "stock_resultante": 30, "precio_unitario": "4.50",
  "fecha": "2026-11-20T10:30:00.000000Z", "referencia": "FAC-000123", "motivo": "Compra a proveedor",
  "producto": { "id": 12, "codigo": "LIB-012", "nombre": "…", "stock": 30, "stock_minimo": 5 },
  "proveedor": { "id": 3, "codigo": "PROV-03", "nombre": "…" },
  "usuario": { "id": 1, "name": "Administrador Principal", "usuario": "admin" }
}
```

Si una salida supera el stock, la respuesta es `422`:

```json
{ "message": "La salida supera las existencias disponibles (6 unidades).",
  "errors": { "cantidad": ["La salida supera las existencias disponibles (6 unidades)."] } }
```

#### Filtros del historial (`GET /movimientos`)

| Parámetro | Ejemplo | Descripción |
|---|---|---|
| `producto_id` | `12` | Movimientos de un producto |
| `proveedor_id` | `3` | Movimientos de un proveedor |
| `usuario_id` | `2` | Movimientos registrados por un usuario |
| `tipo` | `entrada` | `entrada` o `salida` |
| `concepto` | `venta` | Cualquier concepto de la tabla anterior |
| `desde`, `hasta` | `2026-11-01` | Rango de fechas inclusivo (`Y-m-d`) |
| `buscar` | `FAC-0001` | Código o nombre del producto, referencia o motivo |
| `por_pagina`, `page` | `25`, `2` | Paginación (máximo 100 por página) |

### Alertas de existencias

`GET /inventario/alertas` (todos los roles):

- **Agotados:** `stock = 0`.
- **Stock bajo:** `0 < stock ≤ stock_minimo`. Incluye `faltante = stock_minimo − stock` y se ordena de mayor a menor urgencia.

```json
{ "resumen": { "agotados": 19, "stock_bajo": 9, "total": 28 },
  "agotados": [ … ], "stock_bajo": [ … ] }
```

### Reportes (solo Administrador)

| Ruta | Contenido |
|---|---|
| `GET /reportes/inventario` | Totales (productos, unidades, valor del inventario, agotados, stock bajo) y desglose por categoría |
| `GET /reportes/existencias?estado=&categoria_id=` | Existencias actuales por producto, con estado (`agotado`, `stock_bajo`, `disponible`) y valor. El filtro `estado` acepta `agotados`, `stock_bajo` o `disponibles` |
| `GET /reportes/movimientos?desde=&hasta=` | Movimientos, unidades e importe por concepto; totales de entradas, salidas y variación neta; y `por_dia` con **todos** los días del periodo, incluidos los días sin movimientos |
| `GET /reportes/ventas?desde=&hasta=&limite=` | Totales de ventas, evolución diaria y productos más vendidos |
| `GET /reportes/rotacion?desde=&hasta=&limite=` | Productos de poca rotación: con existencias, ordenados de menos a más vendidos en el periodo (primero los que no tuvieron ventas). Incluye valor inmovilizado, última venta y días sin venta |

Si no se indican fechas, el periodo son los últimos 30 días. El periodo máximo es de 366 días.

Para el filtro "Registrado por" del historial, `GET /movimientos/usuarios` devuelve los usuarios que han registrado al menos un movimiento. Está disponible para todos los roles.

### Zona horaria de los reportes

Las fechas se guardan en UTC, que es la zona de la aplicación. Los filtros por día del historial y de los reportes interpretan cada día en la zona horaria del negocio:

```dotenv
INVENTARIO_ZONA_HORARIA=America/El_Salvador   # valor por defecto
```

Así, una venta registrada a las 8:30 p. m. cuenta en ese día local y no en el día siguiente, que sería su fecha en UTC. La agrupación por día usa `CONVERT_TZ` con desplazamientos numéricos (`+00:00` → `-06:00`), por lo que no hace falta cargar las tablas de zonas horarias de MySQL/MariaDB.

## Frontend

| Pantalla | Rol | Contenido |
|---|---|---|
| Proveedores | Administrador | Lista con búsqueda y filtro por estado, registro, edición y activación/desactivación con confirmación |
| Movimientos | Todos | Registro de entradas y salidas con existencia visible, advertencia si no hay inventario suficiente y paso de confirmación; alertas de existencias mínimas; historial con filtros por fecha, producto, tipo, concepto, usuario y texto |
| Reportes | Administrador | Pestañas de indicadores, existencias (todas, agotadas o con stock bajo), ventas y rotación, y movimientos por periodo. Incluye gráficos y exportación a PDF y Excel |

La exportación se genera en el navegador con `jspdf`, `jspdf-autotable` y `exceljs`. Estas librerías se cargan solo al exportar, así que no aumentan la carga inicial. Cada reporte se describe una sola vez en `src/reportes/definiciones.js`, y la pantalla, el PDF y el Excel usan esa misma descripción. En el Excel, los números y las fechas se guardan como valores nativos (se pueden sumar y filtrar), con encabezado fijo, filtros y fila de totales.

## Consistencia del inventario

```bash
php artisan inventario:verificar
```

Compara el stock de cada producto con el saldo de sus movimientos (entradas menos salidas). Lista las diferencias y termina con código de error si encuentra alguna. Sirve para auditorías periódicas o después de importar datos.

## Pruebas

Las pruebas usan MySQL: las consultas de reportes y los bloqueos de fila se validan sobre el mismo motor que producción. Antes de ejecutarlas, crea una base vacía **exclusiva para pruebas**, porque las pruebas la vacían en cada ejecución:

```sql
CREATE DATABASE libreria_independencia2_testing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Luego, desde `backend`:

```powershell
$env:DB_CONNECTION="mysql"; $env:DB_DATABASE="libreria_independencia2_testing"; php artisan test
```

La suite `tests/Feature/Inventario` cubre:

- CRUD y permisos de proveedores.
- Cada concepto de entrada y salida, con sus validaciones.
- Salidas mayores al stock y cantidades no válidas.
- Inmutabilidad del historial.
- Filtros y paginación del historial.
- Clasificación de alertas.
- Cifras de los reportes.
- Una simulación de 200 operaciones que verifica que el stock final coincide con el historial.
- Los reportes de existencias, rotación y movimientos por día.
- El conteo de días en la hora local del negocio.

Pruebas del frontend (cálculos de reportes, validación de periodos y exportaciones a PDF y Excel), desde `frontend`:

```powershell
npm test
```

Estas pruebas no necesitan la base de datos. Cada Excel generado se vuelve a abrir para verificar sus celdas, formatos y totales, y en cada PDF se revisan las páginas, los textos y la numeración.
