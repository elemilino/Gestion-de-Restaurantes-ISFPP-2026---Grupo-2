# Guía: cómo implementar una HU

Paso a paso para completar una HU sobre el proyecto base, con un ejemplo y la lista de control.
Antes de empezar, tené a mano el texto de tu HU (datos y criterios de aceptación) y mirá en el
[README](../README.md#mapa-hu--dónde-se-trabaja) qué módulo y qué ruta te tocan.

## Resumen

```
1. Rama nueva para la HU (desde la versión actualizada del repo)
2. Modelo: agregar atributos/entidades que pida la HU   → backend/app/models/
3. Backend: schemas → repository → service → router      → backend/app/modules/<modulo>/
4. Pruebas del backend: un test por CA como mínimo        → backend/tests/<modulo>/
5. Frontend: types → api → página → ruta                  → frontend/src/features/<modulo>/
6. Verificar: pytest, black, flake8, npm test, lint, build
```

La estrategia de ramas, PR e integración la define el grupo. Mientras tanto: **una rama por HU**
y no mezclar cambios de varias HU en la misma rama.

---

## Ejemplo completo: crear y listar sectores

> **Es solo un ejemplo ilustrativo** para mostrar el patrón. Cubre una parte de HU-01a (CA1, CA2 y
> el listado); la implementación real la hace su responsable. El código está probado: pasa las
> pruebas, Black y Flake8.

### 1. Schemas: `app/modules/salon/schemas.py`

Validaciones de **formato** (vacío, largo, rangos). Las de negocio van en el service.

```python
"""Contratos de entrada y salida del módulo salón."""

from pydantic import BaseModel, ConfigDict, Field


class SectorCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=50)
    descripcion: str | None = None


class SectorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
```

### 2. Repository: `app/modules/salon/repository.py`

Solo consultas.

```python
"""Consultas del módulo salón."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.salon import Sector


class SectorRepository:
    def __init__(self, db: Session):
        self.db = db

    def listar_activos(self) -> list[Sector]:
        consulta = select(Sector).where(Sector.activo).order_by(Sector.nombre)
        return list(self.db.scalars(consulta))

    def buscar_activo_por_nombre(self, nombre: str) -> Sector | None:
        consulta = select(Sector).where(
            Sector.activo, func.lower(Sector.nombre) == nombre.lower()
        )
        return self.db.scalars(consulta).first()
```

### 3. Service: `app/modules/salon/service.py`

Las reglas de los CA. Si algo no se puede hacer, **lanza una excepción de dominio** (ver
[arquitectura.md](arquitectura.md#errores-formato-común)). El `commit` se hace acá, al terminar la
operación (transacciones cortas, RNF de SQLite).

```python
"""Reglas de negocio del módulo salón."""

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError
from app.models.salon import Sector
from app.modules.salon.repository import SectorRepository
from app.modules.salon.schemas import SectorCreate


class SectorService:
    def __init__(self, db: Session):
        self.db = db
        self.sectores = SectorRepository(db)

    def listar(self) -> list[Sector]:
        return self.sectores.listar_activos()

    def crear(self, datos: SectorCreate) -> Sector:
        """HU-01a CA1 y CA2: crea el sector si no hay otro activo con ese nombre."""
        if self.sectores.buscar_activo_por_nombre(datos.nombre):
            raise ConflictError(
                "Ya existe un sector con ese nombre", "SECTOR_DUPLICADO"
            )
        sector = Sector(nombre=datos.nombre)
        self.db.add(sector)
        self.db.commit()
        return sector
```

### 4. Router: `app/modules/salon/router.py`

El router ya existe y está registrado con el prefijo `/api/v1/salon`. Solo se agregan endpoints.

```python
"""Módulo salon: sectores y mesas del salón (HU-01a, HU-01b)."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles
from app.core.enums import Rol
from app.modules.salon.schemas import SectorCreate, SectorOut
from app.modules.salon.service import SectorService

router = APIRouter()
solo_admin = [Depends(require_roles(Rol.ADMINISTRADOR))]


@router.get(
    "/sectores",
    response_model=list[SectorOut],
    dependencies=solo_admin,
    summary="Listar sectores",
)
def listar_sectores(db: Session = Depends(get_db)):
    return SectorService(db).listar()


@router.post(
    "/sectores",
    response_model=SectorOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=solo_admin,
    summary="Crear sector",
)
def crear_sector(datos: SectorCreate, db: Session = Depends(get_db)):
    return SectorService(db).crear(datos)
```

Con el backend levantado, los endpoints aparecen en http://localhost:8000/docs y se pueden probar
desde ahí (botón **Authorize** con el token de `/auth/login`).

### 5. Pruebas: `tests/salon/test_hu01a_sectores.py`

Nombre del archivo: `test_hu<id>_<tema>.py`. Nombre de cada test: `test_hu<id>_ca<n>_<qué verifica>`,
así cada CA queda trazado con su prueba (sirve para el entregable de casos de prueba).

```python
from app.core.enums import Rol

URL = "/api/v1/salon/sectores"


def test_hu01a_ca1_crea_sector_y_aparece_en_el_listado(client, headers):
    h = headers(Rol.ADMINISTRADOR)
    r = client.post(URL, json={"nombre": "Terraza"}, headers=h)
    assert r.status_code == 201
    assert [s["nombre"] for s in client.get(URL, headers=h).json()] == ["Terraza"]


def test_hu01a_ca2_rechaza_nombre_duplicado(client, headers):
    h = headers(Rol.ADMINISTRADOR)
    client.post(URL, json={"nombre": "Terraza"}, headers=h)
    r = client.post(URL, json={"nombre": "terraza"}, headers=h)
    assert r.status_code == 409
    assert r.json()["code"] == "SECTOR_DUPLICADO"


def test_hu01a_mozo_no_puede_crear_sectores(client, headers):
    r = client.post(URL, json={"nombre": "Patio"}, headers=headers(Rol.MOZO))
    assert r.status_code == 403
```

Si tu HU necesita datos de otra entidad que todavía no tiene endpoints (ej. la comanda necesita una
mesa), crealos directo con la fixture `db`:

```python
from app.models.salon import Mesa, Sector


def test_hu05a_ca1_crea_comanda(client, headers, db):
    sector = Sector(nombre="Salón")
    db.add(sector)
    db.flush()
    db.add(Mesa(numero=1, capacidad=4, sector_id=sector.id))
    db.commit()
    ...
```

### 6. Frontend: `src/features/salon/`

**Tipos** (`types.ts`), iguales a los `schemas` de salida del backend:

```ts
/** Debe coincidir con SectorOut del backend. */
export interface Sector {
  id: number
  nombre: string
}
```

**Llamadas a la API** (`api.ts`):

```ts
import { apiGet, apiPost } from '../../api/client'
import type { Sector } from './types'

export const listarSectores = () => apiGet<Sector[]>('/salon/sectores')

export const crearSector = (nombre: string) => apiPost<Sector>('/salon/sectores', { nombre })
```

**Página** (`SectoresPage.tsx`), con el mensaje de error del backend:

```tsx
import { useEffect, useState } from 'react'

import { ApiError } from '../../api/client'
import { Button } from '../../components/Button'
import { crearSector, listarSectores } from './api'
import type { Sector } from './types'

export function SectoresPage() {
  const [sectores, setSectores] = useState<Sector[]>([])
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listarSectores().then(setSectores)
  }, [])

  async function agregar() {
    setError(null)
    try {
      await crearSector(nombre)
      setNombre('')
      setSectores(await listarSectores())
    } catch (e) {
      // ApiError trae el `detail` del backend, ej. "Ya existe un sector con ese nombre"
      setError(e instanceof ApiError ? e.message : 'Error inesperado')
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-borde p-6 flex flex-col gap-4">
      <h1 className="text-xl font-bold text-slate-900">Sectores</h1>
      <div className="flex gap-2">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre del sector"
          className="h-9 px-3 border border-borde rounded-lg text-sm flex-1"
        />
        <Button icono="add_circle" onClick={agregar}>
          Nuevo sector
        </Button>
      </div>
      {error && <p className="text-sm text-status-busy-text">{error}</p>}
      <ul className="divide-y divide-borde">
        {sectores.map((s) => (
          <li key={s.id} className="py-2 text-sm">
            {s.nombre}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

**Ruta** (`src/App.tsx`): reemplazar el `PendientePage` de tu sección o agregar una subruta.

```tsx
<Route path="/configuracion" element={<PendientePage />} />          {/* antes */}
<Route path="/configuracion/sectores" element={<SectoresPage />} />  {/* subruta nueva */}
```

Las subrutas heredan los permisos de su sección en `navItems.ts` (acá, `/configuracion` → solo
Administrador). Para el diseño, partí de la pantalla de Stitch de tu HU y usá los tokens y
componentes de [arquitectura.md](arquitectura.md#diseño-stitch); `MesasPage` y `MesaCard` son el
ejemplo de cómo pasar el HTML de Stitch a React.

---

## Archivos compartidos: cuidado al tocarlos

Estos archivos los usan todas las HU. Si tu HU necesita cambiarlos, hacelo **en un commit separado
y avisá al grupo** (son los que más conflictos generan al integrar):

| Archivo | Cuándo se toca |
|---|---|
| `backend/app/models/*.py` | Agregar atributos o entidades (ver [modelo-datos.md](modelo-datos.md)). |
| `backend/app/models/__init__.py` | Registrar un archivo de modelo nuevo. |
| `backend/app/core/enums.py` y `frontend/src/lib/roles.ts` | Agregar un rol o un valor de enumerado (los roles van en los dos). |
| `backend/app/seed.py` | Agregar tus datos de ejemplo en una función `seed_<modulo>`. |
| `backend/requirements*.txt`, `frontend/package.json` | Agregar una dependencia (con versión fija). |
| `frontend/src/App.tsx` | Agregar tus rutas (una línea por ruta). |
| `frontend/src/layout/navItems.ts` | Cambiar roles de una sección del menú. |
| `frontend/src/components/` | Agregar un componente reutilizable. |

**No hace falta tocar** `app/api.py` ni `app/main.py`: tu router ya está registrado.

## Lista de control antes de dar la HU por terminada

- [ ] Todos los CA de la HU implementados (backend y frontend).
- [ ] Al menos un test por CA en `backend/tests/<modulo>/test_hu<id>_*.py`.
- [ ] Endpoints con `summary` (aparecen claros en Swagger) y docstring en los métodos del service.
- [ ] Permisos con `require_roles` en el backend y roles correctos en `navItems.ts`.
- [ ] Errores de negocio con `NotFoundError` / `ConflictError` / `BusinessRuleError` y mensajes en español.
- [ ] Backend: `pytest`, `black --check .` y `flake8` sin errores.
- [ ] Frontend: `npm test`, `npm run lint` y `npm run build` sin errores (`npm run format` antes de subir).
- [ ] Si cambiaste el modelo: probaste con `python -m app.seed` y avisaste al grupo.
- [ ] No subiste `.env`, `restaurante.db`, `.venv/` ni `node_modules/` (ya están en `.gitignore`).
- [ ] Reemplazaste los `MOCK` que correspondían a tu HU (buscalos con `grep -rn MOCK frontend/src`).
