# Decisiones del proyecto base

Criterio general: la base trae **solo lo mínimo e indispensable para que todo funcione**. Lo demás
lo agrega cada HU o lo decide el grupo.

## Decisiones del grupo (11/10/2026)

| # | Tema | Decisión |
|---|---|---|
| D1 | Estados de Comanda | Los de HU-05: `ABIERTA`, `CERRADA`, `FACTURADA`, `ANULADA`. (HU-02 CA3 y HU-06 usaban otros nombres: hay que alinearlos con estos.) |
| D2 | Modelo de dominio en la base | Solo lo mínimo para arrancar: 8 tablas (ver [modelo-datos.md](modelo-datos.md)). El resto lo construye cada HU. |
| D3 | Estrategia de Git (ramas, PR, CI) | Fuera de la base. Se define después en grupo. |
| D4 | Roles | Solo los mínimos: `ADMINISTRADOR` y `MOZO`. Cada HU agrega el suyo. |
| D5 | Entidad Seña | Fuera de la base. Se decide después. |
| D6 | Usuario vs. Mozo | Pendiente para HU-02. En la base, `Usuario` (login) y `Mozo` (dato del dominio) no están relacionados. |

## Decisiones técnicas

| Decisión | Motivo |
|---|---|
| Backend organizado **por módulo** y, dentro de cada uno, en capas router → service → repository + schemas. | Respeta la arquitectura en capas de la wiki y cada integrante trabaja en su carpeta, con menos conflictos al integrar. |
| **Routers y rutas del front ya registrados** para todas las secciones. | Nadie tiene que editar `app/api.py` ni el menú para empezar su HU. |
| **Modelos centralizados** en `app/models/`. | Las entidades se relacionan entre módulos (la comanda usa mesa, mozo y producto); juntas evitan importaciones circulares. |
| SQLite en **modo WAL** y con **claves foráneas activadas**. | RNF de concurrencia de la wiki; sin `foreign_keys=ON`, SQLite no controla las relaciones. |
| **Sin migraciones**: `create_all` al iniciar + `python -m app.seed` para recrear. | Con 6 personas cambiando el modelo en paralelo, las migraciones generan conflictos en cada integración. Se puede agregar Alembic más adelante si hace falta conservar datos. |
| **Login JWT** con roles incluido en la base. | Es transversal (RNF de seguridad) y ninguna HU lo cubre; sin él, los roles no tendrían efecto. |
| **Formato de error común** `{detail, code}` con 3 excepciones de dominio. | Casi todas las HU tienen CA del tipo "rechaza e informa"; así todas responden igual y el front muestra el mensaje sin lógica especial. |
| API en `/api/v1/...` con JSON en `snake_case` (también en los tipos de TypeScript). | Una sola convención, sin conversiones. |
| Montos como `Numeric(12,2)` / `Decimal`. | Evita errores de redondeo de `float`. |
| Frontend en **TypeScript** con la plantilla oficial de Vite. | El enunciado pide estándares para React/TypeScript; la plantilla trae la configuración lista. |
| **Tailwind** con los tokens del prototipo de Stitch. | El HTML de Stitch ya usa clases de Tailwind: pasarlo a React es casi directo. |
| Estado global solo con **Context API** (sesión). | Lo propone la wiki; cada pantalla maneja su propio estado. |
| Linters: **Black + Flake8** (back) y **oxlint + Prettier** (front). | Black y Flake8 los nombra la wiki de RNF. En el front se usa **oxlint** porque es el que trae hoy la plantilla de Vite (cumple el mismo rol que ESLint). Si el grupo prefiere ESLint, se cambia en un commit aparte. |
| Pruebas: **Pytest** (back) y **Vitest + Testing Library** (front). | Pytest lo nombra el enunciado; Vitest es compatible con Jest y viene integrado con Vite. |
| Versiones fijadas (`requirements*.txt` con `==`, `package-lock.json`, `.nvmrc`). | Que todo el grupo trabaje con las mismas versiones. |

## Pendientes para el grupo

| Tema | Quién / cuándo |
|---|---|
| Estrategia de ramas, PR, revisión e integración (GitFlow, entregable 3.4) | Grupo (D3) |
| Pipeline de CI (GitHub Actions con lint y pruebas, entregable 3.4) | Grupo (D3) |
| Entidad Seña | Grupo (D5) |
| Vínculo Usuario ↔ Mozo y cómo inicia sesión el mozo | HU-02 (D6) |
| Alinear estados de comanda en HU-02 CA3 y HU-06 con D1 | Seba |
| Roles Cajero, Recepcionista, Encargado General y Cocinero | HU-08, HU-10/11, HU-09 |
| Si el stock se descuenta al cargar o al entregar el producto | HU-04d con HU-05/HU-06 |
| Componentes para ABM (tabla, modal, formulario, alertas) | La primera HU que los necesite, en `src/components/` |
| Los 6 reportes | Grupo |
