# Librería Independencia

Sistema web de gestión de inventario para una librería. Permite administrar usuarios, categorías y productos, consultar existencias y ver el valor del inventario desde el Panel de Control.

El backend usa **Laravel, Sanctum y MySQL**. El frontend usa **React y Vite**. El Administrador gestiona usuarios y catálogo. El Empleado puede consultar los productos y el Panel de Control.

## Instalación local en Windows

Necesitas PHP 8.4 con `pdo_mysql` habilitado, Composer, Node.js 22.12 o superior y MySQL. Puedes iniciar MySQL desde WampServer.

Desde `backend`, instala las dependencias y prepara la configuración. Copia `.env.example` y genera la clave de aplicación solo en una instalación nueva.

```powershell
composer install
if (!(Test-Path .env)) {
    Copy-Item .env.example .env
    php artisan key:generate
}
```

Crea una base de datos vacía en MySQL y ajusta `.env` con su nombre y tus credenciales locales.

```dotenv
APP_URL=http://127.0.0.1:8000
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=libreria_independencia
DB_USERNAME=tu_usuario_mysql
DB_PASSWORD=tu_contraseña_mysql
```

```powershell
php artisan migrate
php artisan db:seed --class=RolesSeeder
php artisan serve --host=127.0.0.1 --port=8000
```

El seeder crea los roles Administrador y Empleado. En una instalación nueva, crea la primera cuenta activa con rol Administrador desde `php artisan tinker`, usando el modelo `App\Models\User` y una contraseña propia. Desde esa cuenta puedes registrar al resto de usuarios.

En otra terminal, desde `frontend`:

```powershell
npm ci
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Abre [Librería Independencia en modo local](http://127.0.0.1:5173). Usa `127.0.0.1` en ambos servicios para que las cookies de sesión y la configuración de CORS coincidan.

## Datos de demostración

En la rama `feature/stephany-datos-inventario`, ejecuta desde `backend`:

```powershell
php artisan migrate
php artisan db:seed --class=InventarioSeeder
```

La carga incluye 12 categorías, 15 proveedores, 120 productos y 360 movimientos. Puede ejecutarse de nuevo sin duplicar registros ni volver a ajustar el stock. Conserva los usuarios y roles existentes.
