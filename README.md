# Restaurante · ISFPP 2026 (IS3, Grupo 2): proyecto base

Esqueleto del sistema de gestión del restaurante con el stack **React + FastAPI + SQLite**.
**No tiene ninguna HU implementada**: trae lo mínimo para que back y front funcionen juntos,
haya login con roles y cada uno pueda empezar su HU en su propia carpeta.

> Para entender cómo está hecho y cómo trabajar una HU, leé la carpeta [`docs/`](docs/)
> (está pensada también para usarla como contexto con un asistente de IA).

| Documento | Para qué |
|---|---|
| [docs/arquitectura.md](docs/arquitectura.md) | Qué hay hecho en el backend y el frontend y cómo funciona cada parte. |
| [docs/modelo-datos.md](docs/modelo-datos.md) | Las 8 tablas mínimas, los enumerados y qué agrega cada HU. |
| [docs/guia-hu.md](docs/guia-hu.md) | Paso a paso para implementar una HU (back, front y pruebas), con un ejemplo. |
| [docs/decisiones.md](docs/decisiones.md) | Qué se decidió para la base y qué quedó pendiente para el grupo. |

---

## Requisitos

- **Python 3.12 o superior**
- **Node.js 22** (LTS)
- Git

## Inicio rápido (la primera vez)

### 0. Bajar el repositorio

```bash
git clone <URL-del-repo>
cd <carpeta-del-repo>
```

Después abrí **dos terminales** en esa carpeta: una para el backend y otra para el frontend.

### 1. Backend (`backend/`)

```bash
cd backend
python -m venv .venv               # en Linux/Mac puede ser: python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env               # Windows: copy .env.example .env
python -m app.seed                 # crea restaurante.db con los usuarios de prueba
uvicorn app.main:app --reload      # http://localhost:8000
```

> **Windows (PowerShell):** si al activar el entorno aparece un error de "ejecución de scripts
> deshabilitada", correr una vez `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` y volver a
> intentar. También se puede usar la terminal `cmd` en lugar de PowerShell.
>
> Cuando el entorno está activado, el prompt empieza con `(.venv)`.

- Swagger (documentación interactiva de la API): http://localhost:8000/docs
- Estado del servicio: http://localhost:8000/api/health

### 2. Frontend (`frontend/`)

```bash
cd frontend
npm install
npm run dev                        # http://localhost:5173
```

En desarrollo, Vite redirige todo lo que empieza con `/api` al backend en el puerto 8000,
así que no hace falta configurar URLs ni CORS.

### 3. Ingresar

| Usuario | Contraseña | Rol | Ve en el menú |
|---|---|---|---|
| `admin` | `1234` | Administrador | Todas las secciones |
| `mozo` | `1234` | Mozo | Mesas, Carta y Menú, Historial |

Son usuarios **solo para desarrollo**. `python -m app.seed` borra la base y los vuelve a crear.

## Las veces siguientes

No hace falta instalar de nuevo. Alcanza con:

```bash
# Terminal 1
cd backend
source .venv/bin/activate          # Windows: .venv\Scripts\activate
uvicorn app.main:app --reload

# Terminal 2
cd frontend
npm run dev
```

Para cortar los servidores: `Ctrl+C` en cada terminal.

## Después de bajar cambios de otros (`git pull` o cambiar de rama)

Por las dudas, correr lo siguiente (si no hubo cambios, no hace nada):

```bash
# backend, con el entorno activado
pip install -r requirements-dev.txt   # por si alguien agregó una dependencia
python -m app.seed                    # por si cambió el modelo (borra los datos de prueba)

# frontend
npm install                           # por si alguien agregó una dependencia
```

> **El seed es obligatorio si cambió algo en `backend/app/models/`.** No hay migraciones: sin
> recrear la base, el backend falla con `no such column`. Los cambios de modelo que lo requieren
> están en [docs/modelo-datos.md](docs/modelo-datos.md#cambios-del-modelo-que-requieren-seed).
> Ojo: `python -m app.seed` se corre **con el entorno activado** (el prompt muestra `(.venv)`).

## Problemas comunes

| Síntoma | Solución |
|---|---|
| El login dice "No se pudo conectar con el servidor". | El backend no está corriendo (terminal 1). |
| Error del backend del tipo `no such column` o `no such table`. | Cambió el modelo: correr `python -m app.seed`. |
| `ModuleNotFoundError` (ej. `No module named 'sqlalchemy'`) al levantar el backend o correr el seed. | El entorno no está activado (`source .venv/bin/activate`) o falta `pip install -r requirements-dev.txt`. |
| `python: command not found`. | Usar `python3` (Linux/Mac) o `py` (Windows). |
| El puerto 8000 o 5173 está ocupado. | Quedó otro servidor abierto: cerrarlo. |

---

## Comandos

| | Backend (`backend/`, con el venv activado) | Frontend (`frontend/`) |
|---|---|---|
| Levantar | `uvicorn app.main:app --reload` | `npm run dev` |
| Recrear la base | `python -m app.seed` | — |
| Pruebas | `pytest` | `npm test` |
| Formato | `black .` | `npm run format` |
| Lint | `flake8` | `npm run lint` |
| Build | — | `npm run build` (también chequea tipos) |

Antes de subir cambios, correr **pruebas, formato y lint** en las dos partes.

---

## Estructura

```
proyecto-base/
├── README.md
├── docs/                    ← documentación para el grupo
├── backend/                 ← FastAPI + SQLAlchemy + SQLite
│   ├── app/
│   │   ├── main.py          ← arma la app (CORS, errores, rutas, /api/health)
│   │   ├── api.py           ← registra los routers de TODOS los módulos
│   │   ├── seed.py          ← recrea la base con datos de prueba
│   │   ├── core/            ← configuración, base de datos, seguridad, errores, enumerados
│   │   ├── models/          ← modelo de dominio mínimo (8 tablas)
│   │   └── modules/         ← un módulo por grupo de HU (auth ya implementado)
│   └── tests/               ← Pytest (fixtures en conftest.py)
└── frontend/                ← React + Vite + TypeScript + Tailwind
    └── src/
        ├── App.tsx          ← todas las rutas
        ├── index.css        ← tokens de diseño de Stitch
        ├── api/client.ts    ← cliente HTTP con token y manejo de errores
        ├── auth/            ← login, sesión, rutas protegidas
        ├── layout/          ← barra lateral, cabecera, barra de estado, menú (navItems.ts)
        ├── components/      ← componentes visuales comunes (Button, StatusBadge, ...)
        ├── features/salon/  ← pantalla de Mesas de Stitch con datos de prueba
        ├── pages/           ← PendientePage y NotFoundPage
        ├── lib/             ← formato de moneda y roles
        └── test/            ← pruebas de Vitest
```

---

## Mapa HU → dónde se trabaja

| HU | Responsable | Backend `app/modules/` | API (`/api/v1/...`) | Front (ruta) |
|---|---|---|---|---|
| HU-01a Sectores, HU-01b Mesas | Emi | `salon` | `/salon` | `/configuracion`, `/mesas` |
| HU-02 Mozos | Seba | `mozos` | `/mozos` | `/configuracion` |
| HU-03a/b Secciones y carta, HU-04a–d Productos y stock | Juan | `carta` | `/carta` | `/carta` |
| HU-05a–f Comanda | Gaston | `comandas` | `/comandas` | `/mesas`, `/historial` |
| HU-06 Entrega de productos | Seba | `comandas` | `/comandas` | `/mesas` |
| HU-07a/b Medios de pago | Cris | `medios_pago` | `/medios-pago` | `/configuracion` |
| HU-08a/b Factura y cobro | Cris | `facturacion` | `/facturacion` | `/caja` |
| HU-09a Promociones, HU-09b Menús | Gonza | `promociones` | `/promociones` | `/carta` |
| HU-10 Clientes | Gonza | `clientes` | `/clientes` | `/clientes` |
| HU-11a/b Reservas | Emi | `reservas` | `/reservas` | `/reservas`, `/mesas` |
| Reportes (mínimo 6) | a definir | `reportes` | `/reportes` | `/reportes` |

Los routers del backend y las rutas del frontend **ya están registrados**: para empezar no hace
falta tocar `app/api.py` ni agregar la sección al menú. Ver [docs/guia-hu.md](docs/guia-hu.md).
