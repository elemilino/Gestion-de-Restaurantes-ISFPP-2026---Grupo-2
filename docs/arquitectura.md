# Arquitectura del proyecto base

Este documento describe **qué está hecho** en la base y cómo funciona cada parte. Para saber cómo
agregar una HU, ver [guia-hu.md](guia-hu.md).

## Visión general

Cliente-Servidor con una **API REST** (decisión de la wiki de Taiga):

```
Navegador (React, puerto 5173)
   │  fetch /api/v1/...  (con token JWT)
   ▼
Vite (en desarrollo redirige /api → localhost:8000)
   ▼
FastAPI (puerto 8000) ── router → service → repository ── SQLAlchemy ── SQLite (restaurante.db)
```

| Parte | Tecnología |
|---|---|
| Backend | Python ≥ 3.12, FastAPI, SQLAlchemy 2, Pydantic 2, PyJWT, bcrypt |
| Base de datos | SQLite (archivo `backend/restaurante.db`), modo WAL |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, React Router |
| Pruebas | Pytest (back), Vitest + Testing Library (front) |
| Calidad | Black + Flake8 (back), oxlint + Prettier (front) |

---

## Backend

### Capas

Cada módulo sigue las capas que define la wiki (*Layered Architecture*):

| Capa | Archivo | Responsabilidad | No hace |
|---|---|---|---|
| Presentación | `router.py` | Define los endpoints, recibe y devuelve `schemas`, aplica permisos con `require_roles`. | Reglas de negocio ni consultas. |
| Negocio | `service.py` | Las reglas de la HU (validaciones, bloqueos, cambios de estado). Lanza errores de dominio. | No conoce HTTP. |
| Datos | `repository.py` | Consultas con SQLAlchemy. | Reglas de negocio. |
| Contratos | `schemas.py` | Modelos Pydantic de entrada (`XCreate`, `XUpdate`) y salida (`XOut`), con validaciones de formato. | |

El módulo **`app/modules/auth/`** está implementado con las 4 capas y es el **ejemplo a seguir**.
Los demás módulos tienen solo `router.py` con un `APIRouter` vacío, ya registrado en `app/api.py`.

### Núcleo (`app/core/`)

| Archivo | Qué hace |
|---|---|
| `config.py` | Lee la configuración de `.env`: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRE_MINUTES`, `CORS_ORIGINS`. |
| `database.py` | Crea el engine, la clase `Base` de los modelos y `get_db()` (una sesión por request). En cada conexión activa `PRAGMA journal_mode=WAL` (RNF de concurrencia) y `PRAGMA foreign_keys=ON` (para que SQLite controle las relaciones). |
| `security.py` | Hash de contraseñas con bcrypt y creación/lectura de tokens JWT. |
| `deps.py` | `get_current_user()` (usuario del token) y `require_roles(*roles)` (permisos). |
| `exceptions.py` | Errores de dominio y el handler que los convierte en respuestas HTTP. |
| `enums.py` | Enumerados compartidos: `Rol`, `TipoProducto`, `EstadoComanda`. |

### Arranque

- `app/main.py` crea la app con `create_app()`: CORS, handler de errores, routers y `/api/health`.
- Al iniciar ejecuta `Base.metadata.create_all(engine)`: crea las tablas que falten. **No hay
  migraciones**: si cambia una tabla existente, se recrea la base con `python -m app.seed`.
- Todas las rutas de la API cuelgan de **`/api/v1`**, con un prefijo por módulo
  (`/api/v1/carta`, `/api/v1/comandas`, ...). Ver la tabla en el [README](../README.md#mapa-hu--dónde-se-trabaja).

### Autenticación y roles

| Endpoint | Entrada | Salida |
|---|---|---|
| `POST /api/v1/auth/login` | `{"username": "admin", "password": "1234"}` | `{"access_token": "...", "token_type": "bearer", "usuario": {"id", "username", "nombre", "rol"}}` |
| `GET /api/v1/auth/me` | Header `Authorization: Bearer <token>` | `{"id", "username", "nombre", "rol"}` |

- El token dura `JWT_EXPIRE_MINUTES` (480 = 8 horas) e incluye el id y el rol del usuario.
- Para proteger un endpoint:

```python
from fastapi import Depends
from app.core.deps import get_current_user, require_roles
from app.core.enums import Rol

# Solo administradores:
@router.post("/secciones", dependencies=[Depends(require_roles(Rol.ADMINISTRADOR))])
def crear_seccion(...): ...

# Cualquier usuario con sesión, y necesito saber quién es:
@router.get("/comandas")
def listar(usuario: Usuario = Depends(get_current_user)): ...
```

- Respuestas: **401** si no hay token o está vencido; **403** si el rol no tiene permiso.
- Roles en la base: solo `ADMINISTRADOR` y `MOZO` (ver [decisiones.md](decisiones.md)).

### Errores: formato común

Todas las reglas de negocio que "rechazan e informan" (duplicados, bloqueos, estados inválidos)
se resuelven **lanzando una excepción en el service**. El handler la convierte siempre en:

```json
{ "detail": "Ya existe una sección con ese nombre", "code": "SECCION_DUPLICADA" }
```

| Excepción | HTTP | Cuándo usarla | `code` por defecto |
|---|---|---|---|
| `NotFoundError` | 404 | El recurso no existe o está dado de baja. | `NO_ENCONTRADO` |
| `ConflictError` | 409 | Duplicados y eliminaciones bloqueadas por otros datos (ej. sector con mesas activas). | `CONFLICTO` |
| `BusinessRuleError` | 422 | Otra regla de la HU (ej. cerrar una comanda con productos sin entregar). | `REGLA_DE_NEGOCIO` |

```python
from app.core.exceptions import ConflictError
raise ConflictError("No se puede eliminar el sector: tiene 4 mesas activas", "SECTOR_CON_MESAS")
```

- `detail` es el mensaje que ve el usuario (en español).
- `code` es un identificador en MAYÚSCULAS para que el front o las pruebas distingan el caso.
- Los errores de **formato** (campo vacío, número negativo, texto largo) los valida Pydantic en
  `schemas.py` y FastAPI responde 422 con su propio formato (`detail` es una lista); el front
  ya sabe leer los dos formatos.

### Datos iniciales (`app/seed.py`)

`python -m app.seed` **borra la base**, crea todas las tablas y carga los usuarios `admin` y
`mozo` (contraseña `1234`). Cada HU puede agregar sus datos de ejemplo con una función
`seed_<modulo>(db)` llamada desde `main()`.

### Pruebas (`tests/`)

`conftest.py` tiene fixtures listas para usar:

| Fixture | Qué da |
|---|---|
| `db` | Sesión sobre una base SQLite **en memoria**, nueva en cada test (no toca `restaurante.db`). |
| `client` | `TestClient` de la app usando esa base. |
| `crear_usuario(username, rol, password)` | Crea un usuario. |
| `headers(rol)` | Header `Authorization` listo para un usuario de ese rol. |

Pruebas incluidas: `test_health.py` y `test_auth.py` (login correcto e incorrecto, `/me`,
401 sin token, 403 por rol y formato común de errores).

---

## Frontend

### Estructura de la pantalla

`AppLayout` reproduce el prototipo de Stitch y envuelve todas las pantallas con sesión:

```
┌──────────┬───────────────────────────────────────────────┐
│          │ Topbar: sectores · turno · buscador · caja · 🔔 │
│ Sidebar  ├───────────────────────────────────────────────┤
│ (menú    │                                               │
│ por rol) │   <Outlet />  ← la página de la ruta actual    │
│          │                                               │
│ usuario  ├───────────────────────────────────────────────┤
│ + salir  │ StatusBar: turno                              │
└──────────┴───────────────────────────────────────────────┘
```

Los datos de `Topbar` (sectores, turno, caja) y `StatusBar` son **fijos de prueba**, marcados con
`MOCK` en el código y con la HU que los tiene que reemplazar.

### Rutas, menú y roles

- **`src/App.tsx`** tiene todas las rutas. Las secciones sin implementar muestran
  `<PendientePage />`, que indica la HU y el responsable.
- **`src/layout/navItems.ts`** define el menú lateral: ruta, ícono, etiqueta, **roles que lo ven** y
  HU/responsable. Es la única fuente de los permisos del front.
- **`ProtectedRoute`**: sin sesión redirige a `/login`. Con sesión, si la ruta (o una subruta, ej.
  `/carta/productos`) pertenece a una sección cuyo rol no tiene el usuario, lo redirige a la
  primera sección que sí puede ver.

| Ruta | Pantalla en la base | Roles |
|---|---|---|
| `/login` | Login (funciona) | — |
| `/mesas` | Tablero de Mesas de Stitch con datos de prueba | Admin, Mozo |
| `/carta`, `/historial` | Pendiente | Admin, Mozo |
| `/reservas`, `/clientes`, `/caja`, `/reportes`, `/configuracion` | Pendiente | Admin |

### Sesión y cliente HTTP

- `auth/AuthProvider` (en `AuthContext.tsx`) guarda la sesión (token + usuario) en `localStorage`.
- `auth/useAuth.ts`: `const { usuario, login, logout } = useAuth()` desde cualquier componente.
- **`api/client.ts`**: `apiGet`, `apiPost`, `apiPut`, `apiDelete`. Agregan `/api/v1` y el token
  solos. Si el backend responde con error lanzan un **`ApiError`** con `message` (el `detail`),
  `status` y `code`. Si responde 401 con sesión iniciada, cierra la sesión y vuelve al login.

```ts
import { apiGet, ApiError } from '../../api/client'

try {
  const secciones = await apiGet<Seccion[]>('/carta/secciones')
} catch (e) {
  if (e instanceof ApiError) mostrarError(e.message) // "Ya existe una sección con ese nombre"
}
```

> Los montos (`Decimal` en el backend) llegan como **texto** (`"5500.00"`). `formatMoneda` acepta
> número o texto.

### Diseño (Stitch)

Los tokens del prototipo están en **`src/index.css`** (`@theme` de Tailwind) y se usan como clases:

| Clase | Valor |
|---|---|
| `bg-brand-600` / `hover:bg-brand-700` | Ámbar de acción principal `#d97706` / hover `#b45309` (escala `brand-50` a `brand-900`) |
| `bg-canvas`, `border-borde` | Fondo crema `#faf7f2` y borde suave de tarjetas `#ebe5dc` |
| `status-free`, `status-busy`, `status-waiting`, `status-reserved`, `status-inactive` (+ `-bg`, `-border`, `-text`) | Semáforo: verde libre, rojo ocupado/error, ámbar pendiente, azul reservado, gris inactivo |
| `font-sans` | Plus Jakarta Sans |
| `tabular` | Cifras tabulares para montos |

Íconos: **Material Symbols Outlined** con `<Icon name="table_restaurant" />`
(nombres en https://fonts.google.com/icons).

El prototipo completo de referencia (HTML, captura y guía de estilo `DESIGN.md`) está en el banco de
trabajo del grupo, en `nuevo-contexto/stitch_gastropos_restaurant_management_system/`.

### Componentes comunes (`src/components/`)

| Componente | Uso |
|---|---|
| `Icon` | `<Icon name="add_circle" className="text-base" />` |
| `Button` | `variante`: `primario` (ámbar), `secundario` (ámbar claro), `reserva` (azul). `icono` opcional. Es `type="button"` salvo que se pase `type="submit"`. |
| `StatusBadge` | `<StatusBadge tono="libre">Libre</StatusBadge>`. Tonos: `libre`, `ocupado`, `pendiente`, `reservado`, `inactivo`. |
| `FilterChip` | Chip de filtro con contador (`etiqueta`, `cantidad`, `tono`, `activo`, `onClick`). |
| `tonos.ts` | Clases de color de cada tono, para reutilizar en otros componentes. |

Son solo los que usa la base. Los que hagan falta para los ABM (tabla, modal, formulario,
mensajes) los crea la primera HU que los necesite **en `src/components/`**, para que los reusen
los demás.

### Pantalla de Mesas (`src/features/salon/`)

- `mesas.mock.ts`: las 12 mesas del prototipo y el tipo `MesaVista`.
- `MesaCard.tsx`: tarjeta con las 4 variantes (libre, ocupada, esperando cobro, reservada) y la
  acción de cada una (Abrir comanda / Ver comanda / Facturar / Registrar llegada).
- `MesasPage.tsx`: filtros por estado y grilla.

Es la **referencia de cómo pasar una pantalla de Stitch a React**. Los botones todavía no hacen
nada; los datos se reemplazan por la API en HU-01b (mesas), HU-05/06 (comandas) y HU-11b (reservas).

### Pruebas (`src/test/`)

- `format.test.ts`: formato de moneda.
- `ProtectedRoute.test.tsx`: redirección sin sesión y permisos por rol.

`setup.ts` carga los matchers de `jest-dom` y limpia el `localStorage` después de cada test.
