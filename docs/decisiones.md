# Registro de Decisiones del Proyecto

Este documento registra las decisiones arquitectónicas, técnicas y de dominio tomadas por el grupo para el sistema de gestión de restaurantes (**Restaurante · ISFPP 2026**).

Su objetivo es mantener un criterio común de desarrollo, evitar contradicciones entre las distintas Historias de Usuario (HU) y documentar los motivos detrás de las decisiones tomadas.

## 1. Criterio general del proyecto

La base del proyecto contiene **únicamente lo mínimo e indispensable para que el sistema funcione**. Cada HU puede incorporar las entidades, funcionalidades, roles y componentes que necesite, respetando las convenciones generales establecidas por el grupo.

Las decisiones que afecten a varios módulos deben acordarse grupalmente antes de implementarse.

## 2. Índice de decisiones

| ID | Decisión | Categoría | Estado | Fecha |
|---|---|---|---|---|
| ADR-001 | Arquitectura en capas y separación por módulos | Arquitectura | Aceptado | 11/10/2026 |
| ADR-002 | Persistencia con SQLite (WAL y sin migraciones) | Datos | Aceptado | 11/10/2026 |
| ADR-003 | Modelo de dominio y estructura inicial de datos | Dominio | Aceptado | 11/10/2026 |
| ADR-004 | Autenticación JWT y modelo de roles | Seguridad | Aceptado | 11/10/2026 |
| ADR-005 | Manejo centralizado de errores de dominio | Backend | Aceptado | 11/10/2026 |
| ADR-006 | Stack frontend y sistema de diseño | Frontend | Aceptado | 11/10/2026 |
| ADR-007 | Convenciones de API y formatos de datos | Backend | Aceptado | 11/10/2026 |
| ADR-008 | Estrategia de pruebas y calidad de código | Calidad | Aceptado | 11/10/2026 |

---

## 3. Decisiones arquitectónicas y técnicas

### ADR-001: Arquitectura en capas y separación por módulos

- **Estado:** Aceptado.
- **Fecha:** 11/10/2026.
- **Contexto:** El proyecto será desarrollado por varios integrantes en paralelo. Es necesario evitar el acoplamiento excesivo y reducir los conflictos durante la integración.
- **Decisión:**
  - Organizar el backend por módulos dentro de `app/modules/`.
  - Cada módulo tendrá las siguientes capas: `router.py`, `service.py`, `repository.py` y `schemas.py`.
  - Los modelos de SQLAlchemy estarán centralizados en `app/models/`.
  - Los routers del backend quedarán registrados en `app/api.py`.
  - En el frontend, las rutas existirán como placeholder (`PendientePage`); cada HU reemplazará la suya y ajustará el menú (`navItems.ts`) cuando corresponda.
- **Consecuencias:**
  - **Positivas:** Facilita el trabajo paralelo, separa las responsabilidades y permite mantener las reglas de negocio independientes de HTTP y de la persistencia.
  - **Negativas:** Requiere respetar la separación de responsabilidades para evitar dependencias entre capas.

### ADR-002: Persistencia con SQLite (modo WAL y sin migraciones)

- **Estado:** Aceptado.
- **Fecha:** 11/10/2026.
- **Contexto:** SQLite simplifica la instalación y el despliegue del proyecto. Sin embargo, es necesario contemplar la concurrencia y los cambios frecuentes en el modelo de datos durante el desarrollo.
- **Decisión:**
  - Utilizar SQLite como motor de base de datos.
  - Habilitar el modo WAL (`PRAGMA journal_mode=WAL`).
  - Activar las claves foráneas en cada conexión (`PRAGMA foreign_keys=ON`).
  - No utilizar Alembic ni herramientas de migración en la base inicial.
  - Inicializar las tablas mediante `Base.metadata.create_all(engine)`.
  - Utilizar `python -m app.seed` para recrear y poblar la base de desarrollo cuando sea necesario.
- **Consecuencias:**
  - **Positivas:** Simplifica la configuración, permite trabajar con una base compartida de criterios y evita conflictos de migraciones durante el desarrollo paralelo.
  - **Negativas:** `create_all` no modifica automáticamente las tablas existentes cuando cambia su estructura. Los cambios de esquema requieren un procedimiento de actualización o recreación, pudiendo perderse los datos de prueba.

### ADR-003: Modelo de dominio y estructura inicial de datos

- **Estado:** Aceptado.
- **Fecha:** 11/10/2026.
- **Contexto:** El sistema contempla diferentes áreas de gestión gastronómica, como salones, personal, clientes, cartas, comandas, reservas y facturación. Es necesario establecer una estructura inicial sin implementar anticipadamente todas las entidades.
- **Decisión:**
  - Tomar como referencia el diagrama de clases y el modelo de datos acordado por el grupo.
  - La base inicial contará únicamente con las 8 tablas mínimas definidas en [modelo-datos.md](modelo-datos.md).
  - Cada HU incorporará las entidades y relaciones adicionales que necesite. A la fecha, el modelo ya incluye tablas de HU-01, HU-02, HU-03, HU-04, HU-05, HU-07, HU-08 y HU-10, además de la reserva mínima creada por HU-01b.
  - Los modelos estarán centralizados en `app/models/` para facilitar las relaciones entre módulos.
  - Los estados de Comanda serán los definidos por HU-05:
    - `ABIERTA`
    - `CERRADA`
    - `FACTURADA`
    - `ANULADA`
  - Las HUs que utilicen otros nombres deberán alinearse con esta decisión.
- **Consecuencias:**
  - **Positivas:** Evita implementar entidades innecesarias desde el inicio y mantiene una referencia común para el modelo de dominio.
  - **Negativas:** Será necesario coordinar las modificaciones de modelos y relaciones entre las HUs que compartan entidades.

### ADR-004: Autenticación JWT y modelo de roles

- **Estado:** Aceptado.
- **Fecha:** 11/10/2026.
- **Actualizado:** 06/11/2026.
- **Contexto:** El sistema necesita controlar el acceso a los endpoints y a las distintas funcionalidades según las responsabilidades de cada usuario.
- **Decisión:**
  - Implementar autenticación mediante JSON Web Tokens (JWT).
  - Establecer una expiración de 8 horas (`JWT_EXPIRE_MINUTES=480`).
  - La base inicial incorporó los roles `ADMINISTRADOR` y `MOZO`.
  - Roles incorporados en el backend: `CAJERO` (HU-08) y `RECEPCIONISTA` (HU-10).
  - El frontend refleja solo los roles que usa la interfaz (por ahora `ADMINISTRADOR`, `MOZO` y `RECEPCIONISTA`).
  - Quedan pendientes `ENCARGADO_GENERAL` (HU-09) y `COCINERO` (HU-09b).
  - Cada HU agregará sus roles en un commit aparte, actualizando `app/core/enums.py` y, si la interfaz lo necesita, `frontend/src/lib/roles.ts`.
  - Utilizar dependencias de autorización en FastAPI, como `require_roles`.
- **Consecuencias:**
  - **Positivas:** Permite centralizar la autenticación y controlar los permisos de manera uniforme.
  - **Negativas:** La incorporación de nuevos roles requiere coordinar los cambios entre backend y frontend.

### ADR-005: Manejo centralizado de errores de dominio

- **Estado:** Aceptado.
- **Fecha:** 11/10/2026.
- **Contexto:** Las diferentes funcionalidades necesitan rechazar operaciones inválidas y comunicar los motivos al usuario de manera consistente.
- **Decisión:**
  - Implementar excepciones personalizadas de dominio en `app/core/exceptions.py`:
    - `NotFoundError`
    - `ConflictError`
    - `BusinessRuleError`
  - Las excepciones se lanzarán desde la capa de servicios.
  - Un manejador global las transformará en respuestas JSON con el siguiente formato:

  ```json
  {
    "detail": "Descripción del error",
    "code": "CODIGO_ERROR"
  }
  ```

  - Este formato aplica a los errores de dominio. Los errores de validación de Pydantic (422) mantienen `detail` como lista de errores y no incluyen `code`; el frontend une los mensajes para mostrarlos.
- **Consecuencias:**
  - **Positivas:** Unifica las respuestas de error y simplifica su interpretación en el frontend.
  - **Negativas:** Todos los módulos deben utilizar las excepciones y códigos establecidos para mantener la consistencia.

### ADR-006: Stack frontend y sistema de diseño

- **Estado:** Aceptado.
- **Fecha:** 11/10/2026.
- **Contexto:** Se necesita una interfaz moderna, tipada y coherente con los prototipos de diseño realizados en Stitch.
- **Decisión:**
  - Utilizar React 19 con TypeScript y Vite.
  - Utilizar Tailwind CSS 4 para los estilos.
  - Utilizar React Router para la navegación.
  - Incorporar los tokens de diseño de Stitch en la configuración de estilos del proyecto.
  - Centralizar las solicitudes HTTP en `api/client.ts`, incluyendo la gestión del token JWT y los errores de API.
  - Utilizar Context API para el estado global de sesión. El resto del estado será administrado por cada pantalla o componente.
- **Consecuencias:**
  - **Positivas:** Facilita la reutilización de componentes, el mantenimiento y la adaptación de los prototipos a la aplicación.
  - **Negativas:** Es necesario respetar las convenciones de estilos y componentes para mantener la coherencia visual.

### ADR-007: Convenciones de API y formatos de datos

- **Estado:** Aceptado.
- **Fecha:** 11/10/2026.
- **Contexto:** Los diferentes módulos deben comunicarse utilizando una estructura uniforme para evitar conversiones y diferencias entre implementaciones.
- **Decisión:**
  - Todas las rutas de la API estarán bajo `/api/v1/`.
  - Los datos JSON utilizarán `snake_case`.
  - Los tipos y propiedades de TypeScript seguirán la misma convención para los datos intercambiados con el backend.
  - Los montos monetarios utilizarán `Numeric(12,2)` en SQLAlchemy y `Decimal` en la lógica de negocio, evitando utilizar `float` para cálculos monetarios.
- **Consecuencias:**
  - **Positivas:** Facilita la integración entre frontend y backend y evita diferencias de nomenclatura.
  - **Negativas:** Todos los integrantes deben respetar las convenciones al implementar sus endpoints y modelos.

### ADR-008: Estrategia de pruebas y calidad de código

- **Estado:** Aceptado.
- **Fecha:** 11/10/2026.
- **Contexto:** Es necesario establecer herramientas comunes para detectar errores, mantener la calidad del código y verificar el funcionamiento de las funcionalidades desarrolladas.
- **Decisión:**
  - Backend:
    - Pytest para pruebas automatizadas.
    - Black para formateo.
    - Flake8 para análisis de estilo.
  - Frontend:
    - Vitest para pruebas.
    - Testing Library para pruebas de componentes.
    - oxlint para análisis estático. Se usa porque es el linter que trae la plantilla de Vite y cumple el mismo rol que ESLint; si el grupo prefiere ESLint, se cambia en un commit aparte.
    - Prettier para formateo.
  - Fijar las versiones de dependencias mediante `requirements*.txt`, `package-lock.json` y `frontend/.nvmrc`.
- **Consecuencias:**
  - **Positivas:** Facilita la detección temprana de errores y permite que todos trabajen con las mismas herramientas y versiones.
  - **Negativas:** Requiere ejecutar las verificaciones correspondientes antes de integrar cambios.

---

## 4. Decisiones generales del grupo

Además de las decisiones arquitectónicas anteriores, se establecieron los siguientes criterios para el desarrollo:

| ID | Tema | Decisión | Referencia |
|---|---|---|---|
| D1 | Estados de Comanda | Se utilizan los estados de HU-05: `ABIERTA`, `CERRADA`, `FACTURADA`, `ANULADA`. | ADR-003 |
| D2 | Modelo inicial | La base inicial tenía únicamente las 8 tablas mínimas. El resto se incorpora mediante las HUs. | ADR-003 |
| D3 | Estrategia de Git | Se define grupalmente, fuera de la estructura base. | — |
| D4 | Roles | La base inicial tenía `ADMINISTRADOR` y `MOZO`. Cada HU agrega los roles que necesita. | ADR-004 |
| D5 | Entidad Seña | No se incorpora inicialmente. Su tratamiento queda pendiente de definición grupal. | — |
| D6 | Usuario y Mozo | En la base inicial son entidades independientes, sin relación establecida. Su vínculo queda pendiente para HU-02. | — |

---

## 5. Decisiones pendientes y líneas de trabajo futuras

Los siguientes temas todavía requieren definición o implementación. No deben considerarse decisiones arquitectónicas aceptadas hasta que se acuerden formalmente.

| Tema | Estado actual | Responsable / HU |
|---|---|---|
| Estrategia de ramas, PR, revisión e integración (GitFlow u otra) | Pendiente | Grupo / Entregable 3.4 |
| Pipeline de CI con GitHub Actions (lint y pruebas) | Pendiente | Grupo / Entregable 3.4 |
| Vínculo entre `Usuario` y `Mozo` y autenticación del personal | Pendiente | HU-02 |
| Entidad `Seña` y tratamiento de menús acordados | Pendiente | Grupo |
| Revisar alineación de los estados de Comanda en HU-02 CA3 y HU-06 | En revisión (HU-06 ya usa `EstadoComanda`) | Seba |
| Roles `ENCARGADO_GENERAL` (HU-09) y `COCINERO` (HU-09b) | Pendiente | HU-09 y HU-09b |
| Momento del descuento de stock: carga o entrega del producto | Pendiente | HU-04d / HU-05 / HU-06 |
| Componentes reutilizables para ABM (tabla, modal, formulario y alertas) | A definir según necesidad; HU-10 reutilizó los existentes | Primera HU que los requiera |
| Implementación de los 6 reportes obligatorios | Pendiente | Grupo |

---

## 6. Criterios para incorporar nuevas decisiones

Para mantener este documento actualizado, se establecen las siguientes pautas:

1. Las decisiones que afecten a la arquitectura, seguridad, persistencia o estructura general del sistema deberán documentarse como ADR.
2. Cada nueva decisión tendrá un identificador consecutivo (`ADR-009`, `ADR-010`, etc.).
3. Los ADR deberán incluir contexto, decisión y consecuencias.
4. Los cambios sobre decisiones ya aceptadas deberán actualizar su estado y dejar constancia de la nueva resolución, sin borrar el registro histórico. Si una decisión reemplaza a otra, la anterior se marcará como “Superado por ADR-XXX”.
5. Las decisiones particulares de una HU que no afecten al resto del sistema podrán documentarse directamente en la documentación de esa HU.
6. Los temas pendientes deberán actualizarse cuando el grupo llegue a una resolución.

**Última actualización:** 07/11/2026
**Proyecto:** Sistema de Gestión de Restaurantes · ISFPP 2026
