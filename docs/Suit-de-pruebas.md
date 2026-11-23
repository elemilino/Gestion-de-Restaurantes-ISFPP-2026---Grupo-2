# Diseño de la Suite de Pruebas — Sistema de Gestión de Restaurantes (Grupo 2)

**Estado:** Diseño completo + medición real de RNF-01 y RNF-02 ejecutada el 22/11 (resultados en §6) + validación de cobertura y suites automatizadas y cierre de O-09/O-10/O-11/O-15 (22/11). Queda pendiente O-12 y el registro de resultados de los 233 casos funcionales.
**Fuentes:** historias de usuario y criterios de aceptación relevados para el proyecto; la estructura de la suite se documenta en el presente archivo.
**Fecha de referencia de las HU:** 12/11; resultados RNF incorporados el 22/11 (antes figuraban como "Pendiente de medir").
**Documento relacionado:** este archivo es complementario de `docs/arquitectura.md`, `docs/modelo-datos.md` y `docs/decisiones.md`.

---

## 1. Objetivo y alcance

Diseñar la estrategia de verificación completa del sistema, con trazabilidad directa desde cada **Criterio de Aceptación (CA)** hacia casos de prueba ejecutables.

Se cubren **4 niveles**:

| Nivel | Sección | Qué verifica | Técnica sugerida |
|---|---|---|---|
| 1 | §3 | Comportamiento funcional observable por CA | Caja negra (UI / API como caja negra) |
| 2 | §4 | Reglas de negocio puras y validaciones en aislamiento | Caja blanca (pytest / Vitest + mocks) |
| 3 | §5 | Integración real Controlador ↔ Servicio ↔ BD | Pruebas end-to-end sobre BD de prueba limpia (pytest + TestClient / httpx) |
| 4 | §6 | RNF-01 y RNF-02 | Playwright/Chromium con caché deshabilitada + script de carga `asyncio`/`httpx` (medido el 22/11) |

**Volumen planificado:** 31 HU relevadas · 179 CA · 233 casos funcionales · 30 pruebas unitarias · 16 pruebas de integración · 2 fichas de medición RNF.

> Nota: el relevamiento directo da 31 identificadores y 179 CA (ver §7, observación O-01), que se toman como referencia de esta suite.

---

## 2. Convenciones y trazabilidad

### 2.1 Convención de identificadores

- `CP-<HU>-<nn>`: Caso de prueba funcional. Ej.: `CP-05b-07` → HU-05b, caso 7.
- `PU-<nn>`: Prueba unitaria.
- `PI-<nn>`: Prueba de integración.
- `RNF-01 / RNF-02`: fichas de medición no funcional.
- `CA-E<n>` / `CA-D<n>`: en HU-09b se usa `E` para menú **ejecutivo** y `D` para menú **del día**, porque el documento original repite la numeración CA1..CA4 y CA1..CA3 (ver O-06).
- En HU-05c, el último criterio figurado como "CA2 (Cierre bloqueado) – sin productos" se identifica aquí como **CA5** (ver O-03).

### 2.2 Convención de datos de prueba

- **BD de prueba:** base limpia creada por fixture antes de cada suite de integración. Datos base cargados con `python -m app.seed` para RNF-01.
- **Usuarios de prueba:** `Admin`, `Mozo A` (DNI 30111222, sector Salón), `Mozo B` (DNI 30222333, sector Terraza), `Cajero`, `Recepcionista`, `Encargado`, `Cocinero`.
- **Reloj de prueba:** se fija la fecha/hora (`freezegun` o equivalente) en todas las pruebas de vigencia, tolerancia y reportes. `HOY = 2026-11-22 21:00`.
- **Símbolo «→»** en resultados esperados indica secuencia de pasos dentro de un mismo caso.

### 2.3 Matriz de cobertura HU → CA → suite

| HU | Módulo | CA | CP funcionales | Unitarias | Integración |
|---|---|---:|---:|---|---|
| HU-01a | Sectores | 6 | 8 | PU-01, PU-06 | PI-01 |
| HU-01b | Mesas | 8 | 12 | PU-01, PU-20, PU-21 | PI-01, PI-11 |
| HU-02 | Mozos | 5 | 6 | PU-02, PU-19 | PI-07, PI-13 |
| HU-03a | Secciones de carta | 7 | 9 | PU-01, PU-06 | PI-02 |
| HU-03b | Ver carta | 6 | 6 | PU-24 | PI-02, RNF-01 |
| HU-04a | Platos | 8 | 12 | PU-04, PU-05, PU-25 | PI-02, PI-08 |
| HU-04b | Postres | 5 | 8 | PU-04, PU-25 | PI-02, PI-08 |
| HU-04c | Bebidas | 5 | 8 | PU-04, PU-05, PU-25 | PI-02, PI-08 |
| HU-04d | Stock y disponibilidad | 6 | 7 | PU-12, PU-24 | PI-02, PI-16 |
| HU-05a | Crear comanda | 8 | 11 | PU-19, PU-21 | PI-03, PI-05, RNF-02 |
| HU-05b | Modificar comanda | 12 | 14 | PU-19, PU-25 | PI-03, PI-14 |
| HU-05c | Cerrar comanda | 5 | 5 | PU-19 | PI-03, PI-04, PI-14 |
| HU-05d | Reabrir comanda | 4 | 4 | PU-19 | PI-03, PI-04 |
| HU-05e | Eliminar comanda | 3 | 3 | PU-19 | PI-14 |
| HU-05f | Listar comandas | 3 | 4 | PU-22 | PI-15 |
| HU-06 | Entrega en mesa | 4 | 5 | PU-19 | PI-03, PI-14 |
| HU-07a | Alta y listado de medios de pago | 2 | 4 | PU-01, PU-08 | PI-12 |
| HU-07b | Modificación y baja de medios de pago | 3 | 4 | PU-08, PU-23 | PI-12, PI-13 |
| HU-08a | Generación de factura | 5 | 7 | PU-02, PU-26, PU-27 | PI-04, PI-06, RNF-02 |
| HU-08b | Cobro y comprobante | 5 | 7 | PU-07, PU-23, PU-26 | PI-04, PI-12, PI-15 |
| HU-09a | Promociones | 5 | 10 | PU-03, PU-09, PU-29 | PI-09, PI-08 |
| HU-09b | Menús especiales | 7 | 9 | PU-29 | PI-08, PI-05 |
| HU-10 | Base de clientes | 7 | 11 | PU-02, PU-03, PU-01 | PI-10, PI-13 |
| HU-11a | Registro de reservas | 11 | 13 | PU-11, PU-29 | PI-05, PI-10 |
| HU-11b | Atención de reservas | 4 | 5 | PU-10 | PI-05, PI-10 |
| HU-12a | Reporte de ventas por período | 6 | 7 | PU-14, PU-22 | PI-06, PI-15 |
| HU-12b | Reporte de productos más vendidos | 6 | 8 | PU-17, PU-18, PU-22 | PI-06 |
| HU-12c | Reporte por mozo | 6 | 7 | PU-14, PU-22 | PI-06, PI-13 |
| HU-12d | Reporte de ocupación | 6 | 7 | PU-13, PU-15, PU-22 | PI-11 |
| HU-12e | Reporte de reservas y ausencias | 5 | 5 | PU-16, PU-28, PU-22 | PI-10 |
| HU-12f | Reporte de cobros por medio de pago | 6 | 7 | PU-07, PU-23, PU-22 | PI-06, PI-12 |
| **Total** | | **179** | **233** | **30** | **16 + 2 RNF** |

---

## 3. Nivel 1 — Casos de prueba funcionales (caja negra)

Para cada CA hay al menos un caso. Los patrones CRUD se agrupan pero se enumeran individualmente para conservar trazabilidad. Los casos marcados como **Edge** cubren límites deducidos de la regla de negocio; los marcados como **Decisión pendiente** dependen de una aclaración del equipo (ver §7).

**Convención de rutas reales (O-15 cerrada):** las operaciones de los casos se ejecutan bajo el prefijo `/api/v1`. Equivalencias: sectores `/api/v1/salon/sectores`, mesas `/api/v1/salon/mesas`, carta `/api/v1/carta`, comandas `/api/v1/comandas`, ítems `POST /api/v1/comandas/{id}/detalles`, entrega `PATCH /api/v1/comandas/{id}/detalles/{detalle_id}/entrega`, cierre `POST /api/v1/comandas/{id}/cierre`, facturas `/api/v1/facturacion`, cobros `POST /api/v1/facturacion/{id}/cobrar`, comprobante `GET /api/v1/facturacion/{id}/comprobante`. En la UI, Sectores está en `/configuracion/sectores`.

### 3.1 HU-01a — Gestión de Sectores

| ID | HU / CA | Escenario | Precondiciones | Datos de entrada | Resultado esperado |
|---|---|---|---|---|---|
| CP-01a-01 | CA1 | Creación exitosa | Admin autenticado. No existe "Terraza" | Nombre "Terraza"; Desc. "Patio externo" | Sector creado activo; aparece en listado con 0 mesas |
| CP-01a-02 | CA2 | Duplicado exacto | Existe sector activo "Salón" | Nombre "Salón" | Operación rechazada; mensaje de duplicado |
| CP-01a-03 | CA2 (Edge) | Duplicado con distinta capitalización | Existe "Salón" | Nombre "salón" | Rechazado por unicidad con trim + `casefold` + normalización NFD (O-11 cerrado) |
| CP-01a-04 | CA3 | Modificación válida | Existe "Terraza" | Cambiar descripción a "Patio techado" | Datos actualizados; listado refleja el cambio |
| CP-01a-05 | CA3 (Edge) | Límites de longitud y revalidación de duplicado | Existen "Salón", "Terraza" | Nombre 2 caracteres → 3 → 50 → 51; renombrar "Terraza" a "Salón" | 2 y 51 rechazados; 3 y 50 aceptados; renombrar a "Salón" rechazado por CA2 |
| CP-01a-06 | CA4 | Baja lógica sin mesas | Sector "Jardín" sin mesas activas | Eliminar "Jardín" | Sector inactivo; deja de mostrarse; no se borra físicamente |
| CP-01a-07 | CA5 | Eliminación bloqueada | Sector "Salón" con 2 mesas activas | Eliminar "Salón" | Bloquea; informa que debe reubicar o eliminar mesas primero |
| CP-01a-08 | CA6 | Listado | Existen "Salón" (2 mesas) y "Jardín" (0) | Abrir listado | Muestra nombre, descripción y cantidad de mesas de cada uno |

### 3.2 HU-01b — Gestión de Mesas de un Sector

| ID | HU / CA | Escenario | Precondiciones | Datos de entrada | Resultado esperado |
|---|---|---|---|---|---|
| CP-01b-01 | CA1 | Creación exitosa | Sector "Salón" activo; no existe mesa 10 activa | Número 10, capacidad 4, sector Salón | Mesa creada activa; visible en listado de Salón |
| CP-01b-02 | CA2 | Número duplicado entre activas | Mesa 10 activa en Salón | Crear mesa 10 en Terraza | Rechazado; informa duplicado (unicidad global entre activas) |
| CP-01b-03 | CA2 | Duplicado al modificar | Mesas 10 y 11 activas | Cambiar mesa 11 a número 10 | Rechazado; informa duplicado |
| CP-01b-04 | CA2 (Edge) | Reutilizar número de mesa dada de baja | Mesa 9 inactiva | Crear mesa 9 activa | Permitido (la unicidad aplica solo entre activas) |
| CP-01b-05 | CA3 | Capacidad inválida | Mesa activa sin comanda abierta | Capacidad 0 → -1 → 1 | 0 y -1 rechazados con mensaje; 1 aceptado |
| CP-01b-06 | CA4 | Modificación válida | Mesa 12 activa, sin comanda ni reserva | Cambiar número 13, capacidad 6, sector Terraza | Cambios guardados tras validar CA2 y CA3 |
| CP-01b-07 | CA5 | Reducción bloqueada por reserva | Mesa 4, capacidad 6, reserva Activa de 5 comensales | Nueva capacidad 4 | Bloquea; informa reserva afectada |
| CP-01b-08 | CA5 (Edge) | Reducción hasta el mínimo de la reserva | Mesa 4, capacidad 6, reserva Activa de 5 | Nueva capacidad 5 | Permitido (no queda por debajo de N) |
| CP-01b-09 | CA6 | Eliminación lógica | Mesa 13 sin reservas ni comanda | Eliminar mesa 13 | Marcada no activa; mensaje de baja; no se borra físicamente |
| CP-01b-10 | CA7 | Bloqueo por reserva Activa | Mesa 14 con reserva Activa | Eliminar mesa 14 | Bloquea; informa reservas pendientes |
| CP-01b-11 | CA7 | Bloqueo por comanda abierta | Mesa 15 con comanda Abierta | Eliminar mesa 15 | Bloquea; informa comanda pendiente |
| CP-01b-12 | CA8 | Listado y filtro | Mesas activas en Salón y Terraza; una inactiva | Abrir listado → filtrar por Salón → vaciar filtro | Muestra número, capacidad, sector y disponibilidad; filtro solo Salón; si no hay mesas, mensaje de listado vacío |

### 3.3 HU-02 — Gestión de Mozos

| ID | HU / CA | Escenario | Precondiciones | Datos de entrada | Resultado esperado |
|---|---|---|---|---|---|
| CP-02-01 | CA1 | Asignación a sector | Sectores Salón y Terraza activos | Crear mozo con sector Salón → cambiar a Terraza | Mozo vinculado y responsable de las mesas de Terraza |
| CP-02-02 | CA2 | Baja bloqueada con comanda abierta | Mozo DNI 30111222 con Comanda #10 Abierta | Dar de baja al mozo | No permite la baja hasta cerrar la comanda |
| CP-02-03 | CA3 | Baja lógica sin comandas abiertas | Mozo con comandas cerradas historizadas | Confirmar baja | Queda inactivo (no se borra); no aparece para asignar comandas nuevas; historial conservado |
| CP-02-04 | CA4 | Múltiples errores a la vez | Existe mozo con DNI 30111222 | Nombre "A", apellido vacío, DNI "12345", DNI repetido | Rechaza e informa **cada** error (largo, obligatorio, formato, duplicado) |
| CP-02-05 | CA4 (Edge) | DNI válido en ambos largos y teléfono opcional | Sin duplicados | DNI 3011122 (7) → 30111222 (8); teléfono vacío | Acepta ambos formatos; teléfono opcional sin error |
| CP-02-06 | CA5 | Listado | Mozos activos e inactivos | Abrir listado → luego base sin mozos | Muestra nombre, apellido, DNI, sector y estado; sin mozos, informa listado vacío |

### 3.4 HU-03a — Gestión de secciones de la carta

| ID | HU / CA | Escenario | Precondiciones | Datos de entrada | Resultado esperado |
|---|---|---|---|---|---|
| CP-03a-01 | CA1 | Creación de sección | No existe "Entradas" | Nombre "Entradas" | Queda activa, al final de la carta, disponible para productos |
| CP-03a-02 | CA1 (Edge) | Orden por defecto al final | Existen "Entradas" (orden 1) y "Platos" (orden 2) | Crear "Postres" sin orden | Queda con orden 3 (al final) |
| CP-03a-03 | CA2 | Duplicado case-insensitive | Existe sección activa "Entradas" | Crear "entradas" → renombrar otra a "Entradas" | Rechaza ambos con mensaje "Ya existe una sección con ese nombre" |
| CP-03a-04 | CA3 | Datos inválidos | — | Nombre vacío → 2 caracteres → 51 caracteres | No guarda; indica el error en cada caso |
| CP-03a-05 | CA4 | Modificación con productos asociados | Sección "Pastas" con 3 productos, orden 4 | Renombrar a "Pastas Frescas" y orden 1 | Guarda; productos siguen asociados; carta respeta nuevo orden |
| CP-03a-06 | CA5 | Baja lógica | Sección "Postres" sin productos; existe otra activa | Eliminar y confirmar | Pasa a inactiva; deja de aparecer en la carta |
| CP-03a-07 | CA6 | Bloqueo por productos activos | Sección "Pastas" con 3 productos activos | Eliminar | Rechaza e informa cantidad de productos |
| CP-03a-08 | CA6 | Bloqueo por única sección activa | Solo existe "Pastas" activa | Eliminar | Rechaza e informa que es la única sección |
| CP-03a-09 | CA7 | Listado ordenado | Secciones con 0, 1 y 3 productos | Listar secciones | Aparecen en orden de carta con cantidad de productos activos |

### 3.5 HU-03b — Ver carta

| ID | HU / CA | Escenario | Precondiciones | Datos de entrada | Resultado esperado |
|---|---|---|---|---|---|
| CP-03b-01 | CA1 | Carta agrupada y ordenada | Secciones "Entradas" (1), "Pastas" (2) con productos activos | Seleccionar "Ver carta" | Productos agrupados por sección, secciones en orden; se muestran nombre, descripción, precio, tipo y disponibilidad |
| CP-03b-02 | CA2 | Filtrar una sección | Carta cargada con varias secciones | Seleccionar sección "Pastas" | Solo productos de Pastas, ordenados por nombre |
| CP-03b-03 | CA3 | Producto eliminado | Producto "Flan" dado de baja | Abrir carta | "Flan" no aparece |
| CP-03b-04 | CA4 | Producto no disponible o sin stock | "Agua" con stock 0; "Cerveza" marcada no disponible | Abrir carta | Ambos aparecen con etiqueta "No disponible" |
| CP-03b-05 | CA5 | Secciones vacías y carta vacía | Sección "Pastas" sin productos; luego todas vacías | Abrir carta → vaciar todos los productos | "Pastas" no se muestra; con todo vacío, mensaje "La carta no tiene productos cargados" |
| CP-03b-06 | CA6 | Rendimiento de la carta (RNF-01) | BD cargada con `python -m app.seed`, red local, caché deshabilitada | 5 aperturas de "Ver carta" | Promedio y p95 < 2000 ms. Protocolo completo en §6.1 |

### 3.6 HU-04a — Gestión de platos

| ID | HU / CA | Escenario | Precondiciones | Datos de entrada | Resultado esperado |
|---|---|---|---|---|---|
| CP-04a-01 | CA1 | Creación exitosa | Sección activa "Pastas" | "Ñoquis con salsa", desc., $5.000, 350 g, sección Pastas | Plato activo, disponible y visible en esa sección |
| CP-04a-02 | CA1 (Edge) | Porción opcional vacía | Sección activa | Plato sin gramos | Creado sin error; campo gramos vacío |
| CP-04a-03 | CA2 | Duplicado | Existe plato activo "Ñoquis con salsa" | Crear otro con el mismo nombre | Rechaza con "Ya existe un plato con ese nombre" |
| CP-04a-04 | CA3 | Datos inválidos múltiples | Sin secciones inválidas | Precio vacío, 0 y -1; nombre 2 y 51; gramos 0, -1 y 5,5; sin sección | No guarda; informa cada error |
| CP-04a-05 | CA4 | Sin secciones activas | No hay secciones activas | Intentar crear plato | Informa que primero debe crear una sección |
| CP-04a-06 | CA5 | Precio histórico en comanda abierta | Plato "Ñoquis" a $5.000 en Comanda #15 Abierta | Admin cambia precio a $5.500 | Comanda #15 conserva $5.000; comandas nuevas toman $5.500 |
| CP-04a-07 | CA6 | Cambio de sección | Plato en "Minutas" | Mover a "Bien argentino" | Aparece solo en "Bien argentino" en la carta |
| CP-04a-08 | CA7 | Eliminación sin uso | Plato sin comandas ni promociones | Eliminar y confirmar | Desaparece de carta; no se puede agregar a comandas nuevas; sigue en comandas y facturas anteriores |
| CP-04a-09 | CA8 | Bloqueo por comanda abierta | Plato en Comanda #20 Abierta | Eliminar | Rechaza e informa la comanda |
| CP-04a-10 | CA8 | Bloqueo por menú vigente | Plato en menú ejecutivo o del día vigente | Eliminar | Rechaza e informa el menú (datos simulados si HU-09b no está integrada) |
| CP-04a-11 | CA8 | Bloqueo por promoción vigente | Plato en promoción vigente | Eliminar | Rechaza e informa la promoción (simulado con datos si HU-09a no está integrada) |
| CP-04a-12 | CA8 (Decisión pendiente) | Bloqueo por menú acordado de reserva | Plato en menú acordado de reserva **Activa** | Eliminar | Rechaza e informa la reserva. Ajustar a "Activa o Cumplida con comanda" según O-12 |

### 3.7 HU-04b — Gestión de postres

| ID | HU / CA | Escenario | Precondiciones | Datos de entrada | Resultado esperado |
|---|---|---|---|---|---|
| CP-04b-01 | CA1 | Creación exitosa | Sección "Postres" activa | "Flan casero", $3.000, sección Postres | Postre activo, disponible y visible en carta |
| CP-04b-02 | CA2 | Duplicado | Existe "Flan casero" activo | Crear otro igual | No guarda e informa error |
| CP-04b-03 | CA2 | Datos inválidos | — | Precio 0 y -1; sin sección | No guarda e indica cada error |
| CP-04b-04 | CA3 | Modificación de precio | Postre con comanda existente y futura | Cambiar $3.000 a $3.500 | Nuevas comandas toman $3.500; existentes conservan $3.000 |
| CP-04b-05 | CA4 | Eliminación sin uso | Postre sin usos activos | Eliminar | Desaparece de carta; no se agrega a comandas nuevas |
| CP-04b-06 | CA5 | Bloqueo por menú ejecutivo vigente | Postre en menú ejecutivo vigente | Eliminar | Rechaza e informa dónde está en uso (simulado con datos si HU-09b no está integrada) |
| CP-04b-07 | CA5 | Bloqueo por promoción vigente | Postre en promoción vigente | Eliminar | Rechaza e informa la promoción (simulado con datos si HU-09a no está integrada) |
| CP-04b-08 | CA5 | Bloqueo por comanda abierta | Postre en comanda Abierta | Eliminar | Rechaza e informa la comanda |

### 3.8 HU-04c — Gestión de bebidas

| ID | HU / CA | Escenario | Precondiciones | Datos de entrada | Resultado esperado |
|---|---|---|---|---|---|
| CP-04c-01 | CA1 | Creación exitosa | Sección "Cervezas" activa | "Cerveza tirada", 500 ml, alcohólica, $4.000 | Bebida activa, disponible y visible en carta |
| CP-04c-02 | CA2 | Duplicado mismo nombre y volumen | Existe "Cerveza tirada" 500 ml | Crear "Cerveza tirada" 500 ml | No guarda e informa error |
| CP-04c-03 | CA2 (Edge) | Mismo nombre, distinto volumen | Existe "Cerveza tirada" 500 ml | Crear 350 ml y 1000 ml | Ambos se crean correctamente |
| CP-04c-04 | CA2 | Datos inválidos | — | Volumen 0, -1 y 4,5; precio 0; sin sección | No guarda e indica cada error |
| CP-04c-05 | CA3 | Modificación de precio | Bebida con comandas existentes | Cambiar precio | Futuras comandas con precio nuevo; existentes conservan el anterior |
| CP-04c-06 | CA4 | Eliminación sin uso | Bebida sin usos activos | Eliminar | Desaparece de carta; no se agrega a comandas nuevas |
| CP-04c-07 | CA5 | Bloqueo por comanda abierta | Bebida en comanda Abierta | Eliminar | Rechaza e informa la comanda |
| CP-04c-08 | CA5 | Bloqueo por promoción vigente | Bebida en promoción "2x1 en cervezas" vigente | Eliminar | Rechaza e informa la promoción (simulado con datos si HU-09a no está integrada) |

### 3.9 HU-04d — Stock y disponibilidad

| ID | HU / CA | Escenario | Precondiciones | Datos de entrada | Resultado esperado |
|---|---|---|---|---|---|
| CP-04d-01 | CA1 | Marcar no disponible | Producto disponible | Admin marca "No disponible" | Aparece así en carta; no se puede agregar a comandas nuevas |
| CP-04d-02 | CA2 | Volver a disponible | Producto no disponible | Admin marca disponible | Vuelve a poder pedirse |
| CP-04d-03 | CA3 | Descuento de stock | Producto con stock 10 | Agregar 2 unidades a una comanda | Stock pasa a 8 **al cargar** el producto (O-09 cerrado) |
| CP-04d-04 | CA4 | Agotado | Producto con stock 1 | Agregar 1 → intentar agregar 1 más | Stock 0 al agregar; pasa a "No disponible"; rechaza la 2da unidad |
| CP-04d-05 | CA5 | Stock inválido | — | Stock -1, 3,5 y texto "diez" | No guarda; indica error en cada caso |
| CP-04d-06 | CA6 | Sin control de stock | Producto sin stock cargado | Agregar varias unidades a comandas | No descuenta nada; disponibilidad depende solo de marca manual |
| CP-04d-07 | CA3 (Edge) | Stock insuficiente para la cantidad pedida | Producto con stock 2 | Agregar 5 unidades | Rechaza la operación al cargar; stock queda en 2; informa falta de stock |

### 3.10 HU-05a — Crear Comanda

| ID | HU / CA | Escenario | Precondiciones | Datos de entrada | Resultado esperado |
|---|---|---|---|---|---|
| CP-05a-01 | CA1 | Creación exitosa | Mozo 30111222 activo, sector Salón; Mesa 2 libre, 4 sillas | DNI 30111222, 2 comensales, Mesa 2 | Comanda Abierta con fechaHoraApertura automática |
| CP-05a-02 | CA2 | Mesa ocupada | Mesa 2 con comanda Abierta | Crear comanda en Mesa 2 | Advierte que la mesa está ocupada |
| CP-05a-03 | CA3 | Mozo inexistente | — | DNI 40999999 | Advierte que no existe mozo con ese DNI |
| CP-05a-04 | CA4 | Mozo eliminado | Mozo dado de baja con DNI 30111222 | DNI 30111222 | Advierte que el mozo está eliminado |
| CP-05a-05 | CA5 | Mesa inexistente o inactiva | Mesa 99 no existe; Mesa 9 dada de baja | Mesa 99 → Mesa 9 | Advierte que debe ser una mesa libre/existente |
| CP-05a-06 | CA6 | Mesa de otro sector | Mozo de Salón; Mesa 8 de Terraza | DNI mozo Salón + Mesa 8 | Advierte que la mesa no está asignada al mozo |
| CP-05a-07 | CA7 | Exceso de comensales | Mesa 2 con 4 sillas | 5 comensales | Advierte que superan las sillas |
| CP-05a-08 | CA7 (Edge) | Comensales no positivos | Mesa 2 libre | 0 → -2 comensales | Rechaza ambas (la regla exige mayor a cero) |
| CP-05a-09 | CA8 | Comanda desde reserva cumplida | Reserva Cumplida sin comanda, 2 mesas, 4 comensales | Crear comanda eligiendo la reserva | Comanda Abierta asociada a la reserva, con sus mesas y comensales |
| CP-05a-10 | CA8 | Reserva con menú acordado | Reserva Cumplida con menú acordado (2 platos a precio acordado) | Crear comanda desde la reserva | Platos cargados con el precio acordado (congelado), no el de carta |
| CP-05a-11 | CA8 (Edge) | Reserva no cumplida o ya con comanda | Reserva Activa; otra Cumplida con comanda | Intentar crear desde ambas | Bloquea en ambos casos e informa el motivo |

### 3.11 HU-05b — Modificación de Comanda

| ID | HU / CA | Escenario | Precondiciones | Datos de entrada | Resultado esperado |
|---|---|---|---|---|---|
| CP-05b-01 | CA1 | Agregar producto nuevo | Comanda #21 Abierta | Agregar "Empanadas" (no estaban) | Producto asociado al detalle |
| CP-05b-02 | CA2 | Producto ya existente | Comanda con 2 "Empanadas" | Agregar 1 "Empanadas" | Cantidad actualizada a 3 (no duplica renglón) |
| CP-05b-03 | CA3 | Quitar producto | Comanda con 2 "Empanadas" pendientes | Quitar "Empanadas" | Producto eliminado del detalle |
| CP-05b-04 | CA4 | Cambiar cantidad | Comanda con 2 "Empanadas" | Cambiar a 4 | Cantidad actualizada |
| CP-05b-05 | CA5 | Cambiar comensales | Comanda Abierta, mesa de 4 sillas | Cambiar 2 → 3 comensales | Cantidad actualizada |
| CP-05b-06 | CA6 | Cambiar mozo | Comanda Abierta con Mozo A | Cambiar a Mozo B del mismo sector | Comanda atribuida al nuevo mozo |
| CP-05b-07 | CA7 | Aumentar cantidad de producto entregado | Comanda con 2 "Empanadas" entregadas | Subir a 3 | Cantidad 3; las 2 originales siguen entregadas y la nueva unidad queda pendiente |
| CP-05b-08 | CA8 | Comanda cerrada, facturada o anulada | Comandas en esos 3 estados | Intentar modificar cada una | Advierte que no es posible modificar una comanda cerrada |
| CP-05b-09 | CA9 | Producto eliminado | Producto dado de baja | Intentar agregarlo | Advierte que no es posible agregar el producto |
| CP-05b-10 | CA10 | Quitar producto entregado | Comanda con ítem entregado | Intentar quitarlo | Advierte que no es posible quitar un producto entregado |
| CP-05b-11 | CA11 | Comensales inválidos | Mesa de 4 sillas | 0 → -1 → 5 comensales | Bloquea los 3 e informa superan las sillas |
| CP-05b-12 | CA12 | Reducir producto entregado | Producto entregado con cantidad 3 | Bajar a 2 | Advierte que no es posible reducir un producto entregado |
| CP-05b-13 | CA6 (Edge) | Cambiar a mozo inactivo o inexistente | Comanda Abierta | DNI de mozo dado de baja → DNI inexistente | Bloquea ambos cambios |
| CP-05b-14 | CA2 (Edge) | Cantidad no positiva al agregar | Comanda Abierta | Cantidad 0 → -2 | Rechaza ambas |

### 3.12 HU-05c — Cierre de Comanda

| ID | HU / CA | Escenario | Precondiciones | Datos de entrada | Resultado esperado |
|---|---|---|---|---|---|
| CP-05c-01 | CA1 | Cierre exitoso | Comanda Abierta con todos sus productos entregados | Confirmar cierre | Estado Cerrada y fechaHoraCierre registrada |
| CP-05c-02 | CA2 | Comanda ya cerrada o facturada | Comanda Cerrada → Facturada | Confirmar cierre | Advierte que la comanda ya está cerrada |
| CP-05c-03 | CA3 | Comanda anulada | Comanda Anulada | Confirmar cierre | Advierte que no se puede cerrar una comanda anulada |
| CP-05c-04 | CA4 | Productos pendientes | Comanda Abierta con 1 ítem pendiente | Confirmar cierre → marcar entregado → confirmar | 1er intento bloquea; 2do cierra y setea fechaHoraCierre |
| CP-05c-05 | CA5 (ver O-03) | Comanda sin productos | Comanda Abierta sin ítems | Confirmar cierre | Advierte que no se puede cerrar sin productos |

### 3.13 HU-05d — Reabrir Comanda

| ID | HU / CA | Escenario | Precondiciones | Datos de entrada | Resultado esperado |
|---|---|---|---|---|---|
| CP-05d-01 | CA1 | Reapertura exitosa | Comanda Cerrada sin factura | Confirmar reapertura | fechaHoraCierre anulada (NULL) y estado Abierta |
| CP-05d-02 | CA2 | Ya abierta | Comanda Abierta | Reabrir | Advierte que ya está abierta |
| CP-05d-03 | CA3 | Facturada o Adeudada | Comanda Facturada; otra con factura Adeudada | Reabrir cada una | Bloquea en ambos casos e informa que está facturada |
| CP-05d-04 | CA4 | Anulada | Comanda Anulada | Reabrir | Bloquea e informa que está anulada |

### 3.14 HU-05e — Eliminar Comanda

| ID | HU / CA | Escenario | Precondiciones | Datos de entrada | Resultado esperado |
|---|---|---|---|---|---|
| CP-05e-01 | CA1 | Anulación de comanda | Comanda Abierta sin productos entregados | Confirmar eliminación | Comanda Anulada con motivo registrado |
| CP-05e-02 | CA2 | Comanda cerrada | Comanda Cerrada | Eliminar | Advierte que no se puede eliminar una comanda cerrada |
| CP-05e-03 | CA3 | Con productos entregados | Comanda Abierta con ítems entregados | Eliminar | Advierte que no se puede eliminar con productos entregados |

### 3.15 HU-05f — Listar Comandas

| ID | HU / CA | Escenario | Precondiciones | Datos de entrada | Resultado esperado |
|---|---|---|---|---|---|
| CP-05f-01 | CA1 | Listado con filtros | Comandas de 2 mozos en distintas fechas y estados | DNI Mozo A, desde/hasta, estado Abierta | Despliega solo las comandas de ese mozo, período y estado |
| CP-05f-02 | CA2 | Mozo eliminado o inexistente | Mozo dado de baja; DNI 40999999 | Aplicar filtro con cada DNI | Advierte que el mozo está eliminado o es inexistente |
| CP-05f-03 | CA3 | Rango inválido | — | Desde 20/11, hasta 15/11 | Rechaza con "El período seleccionado no es válido" |
| CP-05f-04 | CA1 (Edge) | Sin resultados | Filtro válido sin comandas | Aplicar filtro | Informa que no hay comandas para el filtro |

### 3.16 HU-06 — Entrega de Productos en Mesa

| ID | HU / CA | Escenario | Precondiciones | Datos de entrada | Resultado esperado |
|---|---|---|---|---|---|
| CP-06-01 | CA1 | Cargar producto | Cliente elige plato; comanda Abierta | Mozo agrega el ítem | Evento de carga ejecutado; detalle actualizado; comanda sigue Abierta |
| CP-06-02 | CA2 | Quitar producto | Ítem en comanda Abierta | Mozo quita el ítem | Ítem eliminado y detalle actualizado |
| CP-06-03 | CA3 | Cancelar sin productos | Interacción iniciada, sin ítems | Mozo cancela la operación | Comanda Anulada con motivo |
| CP-06-04 | CA4 | Marcar entrega | Producto pendiente | Mozo marca entrega | Producto pasa a estado "entregado" |
| CP-06-05 | CA1 (Edge) | Cantidad inválida | Comanda Abierta | Cantidad 0 → -1 | Rechaza ambas (entero mayor a 0) |

### 3.17 HU-07a — Alta y Listado de Medios de Pago

| ID | HU / CA | Escenario | Precondiciones | Datos de entrada | Resultado esperado |
|---|---|---|---|---|---|
| CP-07a-01 | CA1 | Creación exitosa | No existe "MercadoPago" | Nombre "MercadoPago", acreditación Inmediata, recargo 0 | Guarda y actualiza el listado |
| CP-07a-02 | CA1 | Creación con recargo y acreditación diferida | No existe "Tarjeta Visa" | "Tarjeta Visa", Diferida, recargo 10 % | Guarda con esos datos |
| CP-07a-03 | CA2 | Duplicado | Existe "Efectivo" | Crear "Efectivo" | Advierte que el medio de pago ya está registrado |
| CP-07a-04 | CA1 (Edge) | Listado tras altas y bajas | Medios activos e inactivos | Abrir listado | Muestra nombre, tipo, recargo y estado de cada uno |

### 3.18 HU-07b — Modificación y Baja de Medios de Pago

| ID | HU / CA | Escenario | Precondiciones | Datos de entrada | Resultado esperado |
|---|---|---|---|---|---|
| CP-07b-01 | CA1 | Baja lógica | Medio "MercadoPago" activo usado en facturas pasadas | Confirmar eliminación | Estado activo Falso; queda fuera de nuevas facturas; historial de cobros conservado |
| CP-07b-02 | CA2 | Modificación válida | Medio existente | Cambiar nombre, tipo de acreditación y recargo a 5 % | Datos actualizados y listado reflejado |
| CP-07b-03 | CA3 | Recargo negativo | Medio existente | Recargo -1 | Advierte que el recargo no puede ser negativo |
| CP-07b-04 | CA2 (Edge) | Recargo cero y nombre duplicado | Existe "Efectivo" | Recargo 0; renombrar otro medio a "Efectivo" | Recargo 0 aceptado; rename rechazado por duplicado |

### 3.19 HU-08a — Generación de Factura a partir de Comanda

| ID | HU / CA | Escenario | Precondiciones | Datos de entrada | Resultado esperado |
|---|---|---|---|---|---|
| CP-08a-01 | CA1 | Generación exitosa | Comanda #20 Cerrada con productos por $10.000 | Confirmar factura, tipo C | Subtotal calculado; Factura Adeudada creada y asociada |
| CP-08a-02 | CA2 | Comanda sin consumos | Comanda Cerrada sin productos o entregas | Generar factura | Advierte que no se puede facturar una comanda sin consumos |
| CP-08a-03 | CA3 | Comanda abierta | Comanda Abierta | Generar factura | Advierte que la comanda no está cerrada |
| CP-08a-04 | CA4 | Datos fiscales inválidos | — | CUIT "20123", DNI "12", tipo omitido | Rechaza e informa cada error |
| CP-08a-05 | CA4 (Edge) | Documentos válidos | — | CUIT 20123456789 (11), DNI 30111222 (8), DNI 3011122 (7) | Acepta los tres |
| CP-08a-06 | CA5 | Tipo de factura | Comanda cerrada | Tipo A → B → C → Consumidor Final | Factura creada con el tipo elegido en cada caso |
| CP-08a-07 | CA1 (Edge) | Cliente opcional | Comanda cerrada | Sin CUIT/DNI, tipo Consumidor Final | Factura generada correctamente |

### 3.20 HU-08b — Cobro de Factura y Generación de Comprobante

| ID | HU / CA | Escenario | Precondiciones | Datos de entrada | Resultado esperado |
|---|---|---|---|---|---|
| CP-08b-01 | CA1 | Cobro simple | Factura Adeudada $10.000; Efectivo activo sin recargo | Pagar $10.000 | Factura Pagada y comprobante descargable |
| CP-08b-02 | CA2 | Cobro con recargo | Factura Adeudada $10.000; Tarjeta con 10 % | Pagar $10.000 con tarjeta | Total a pagar $11.000; factura Pagada; comprobante |
| CP-08b-03 | CA3 | Pago parcial | Factura Adeudada $30.000 | Pagar $10.000 en efectivo | Permite agregar más medios por el resto |
| CP-08b-04 | CA4 | Cobro mixto con recargo | Factura Adeudada $30.000; Efectivo 0 %, Tarjeta 10 % | $10.000 efectivo + $20.000 tarjeta | Total a pagar $32.000; factura Pagada; comprobante; desglose correcto |
| CP-08b-05 | CA5 | Factura ya pagada | Factura Pagada | Registrar cobro | Advierte que la factura ya fue saldada |
| CP-08b-06 | CA1 (Edge) | Medio de pago inactivo | Medio dado de baja | Intentar cobrar con él | Bloquea el cobro |
| CP-08b-07 | CA3 (Edge) | Montos no positivos | Factura Adeudada | Monto 0 → -100 | Rechaza ambos |

### 3.21 HU-09a — Gestión de Promociones

| ID | HU / CA | Escenario | Precondiciones | Datos de entrada | Resultado esperado |
|---|---|---|---|---|---|
| CP-09a-01 | CA1 | Registro exitoso | Productos activos disponibles | Desc. "2x1 cervezas", 20 %, vigencia 22/11 a 30/11, producto Cerveza | Guarda con activo = SI y vincula al producto |
| CP-09a-02 | CA2 | Campos obligatorios ausentes | — | Sin descripción, sin descuento, sin fechas, sin productos | Rechaza e indica campos faltantes |
| CP-09a-03 | CA2 (Edge) | Límites del descuento | — | Descuento 0 → 100,99 → 1 → 100 | 0 y 100,99 rechazados; 1 y 100 aceptados |
| CP-09a-04 | CA3 | fecha_fin igual a fecha_inicio | — | Inicio 22/11, fin 22/11 | Rechaza; rango no válido |
| CP-09a-05 | CA3 | fecha_fin anterior a fecha_inicio | — | Inicio 25/11, fin 23/11 | Rechaza; rango no válido |
| CP-09a-06 | CA3 | Fecha de inicio pasada | Hoy 22/11 | Inicio 20/11, fin 30/11 | Rechaza; rango no válido |
| CP-09a-07 | CA4 | Modificación integral | Promoción existente | Cambiar descripción, porcentaje, vigencia y lista de productos | Actualiza y recalcula validez de descuentos |
| CP-09a-08 | CA5 | Desactivación manual | Promo activa = SI | Solicitar desactivar | Pasa a activo = NO; no aplica en nuevas comandas; historial conservado |
| CP-09a-09 | CA5 | Expiración automática | Promo con fecha_fin 21/11 | Avanzar reloj a 22/11 | Pasa a activo = NO sin perder historial |
| CP-09a-10 | CA1 (Edge) | Aplicación automática del descuento | Promo vigente sobre Cerveza | Agregar Cerveza $4.000 a comanda | Descuento 20 % aplicado ($3.200) |

### 3.22 HU-09b — Gestión de Menús Especiales

> Los casos usan `CA-E<n>` (menú ejecutivo) y `CA-D<n>` (menú del día) por la duplicación de numeración del documento original (O-06).

| ID | HU / CA | Escenario | Precondiciones | Datos de entrada | Resultado esperado |
|---|---|---|---|---|---|
| CP-09b-01 | CA-E1 | Crear menú ejecutivo | Plato y postre activos | Plato "Ñoquis", postre "Flan", precio $6.000, vigencia válida | Menú ejecutivo creado |
| CP-09b-02 | CA-E1 (Edge) | Precio inválido | Plato y postre activos | Precio 0 → -1 | Rechaza ambos |
| CP-09b-03 | CA-E2 | Intentar incluir bebida | Bebida activa | Agregar bebida al menú ejecutivo | No se considera parte del menú (se ignora o rechaza) |
| CP-09b-04 | CA-E3 | Modificar menú ejecutivo | Menú existente | Cambiar plato, postre, precio o vigencia | Menú actualizado |
| CP-09b-05 | CA-E4 | Eliminar menú ejecutivo | Menú activo | Solicitar eliminación | Baja lógica (inactivo); deja de ofrecerse; historial conservado |
| CP-09b-06 | CA-D1 | Crear menú del día | Plato activo | Plato "Milanesas", precio $5.500, vigencia válida | Menú del día creado |
| CP-09b-07 | CA-D1 (Edge) | Datos inválidos menú del día | — | Precio 0, plato inactivo/eliminado, fechas invertidas | Rechaza e informa cada error |
| CP-09b-08 | CA-D2 | Modificar menú del día | Menú existente | Cambiar datos | Menú actualizado |
| CP-09b-09 | CA-D3 | Eliminar menú del día | Menú activo | Solicitar eliminación | Baja lógica; deja de ofrecerse; historial conservado |

### 3.23 HU-10 — Gestión de Base de Clientes

| ID | HU / CA | Escenario | Precondiciones | Datos de entrada | Resultado esperado |
|---|---|---|---|---|---|
| CP-10-01 | CA1 | Registro exitoso | No existe DNI 30111222 | Nombre "Ana", apellido "Pérez", DNI 30111222, teléfono 1144444444, email válido | Cliente registrado con eliminado = NO |
| CP-10-02 | CA1 (Edge) | Email opcional | — | Registro sin email | Aceptado sin error |
| CP-10-03 | CA2 | Datos obligatorios ausentes | — | Sin nombre, sin apellido, sin teléfono | Rechaza e informa cuáles faltan |
| CP-10-04 | CA2 (Edge) | Formatos inválidos | — | Nombre 1 y 51 caracteres, teléfono con letras, email "mail" | Rechaza e informa cada error |
| CP-10-05 | CA3 | DNI duplicado | Existe cliente con DNI 30111222 | Registrar otro con ese DNI | Rechaza e informa que ya existe cliente asociado |
| CP-10-06 | CA4 | Modificación válida | Cliente existente | Cambiar teléfono y email | Datos actualizados |
| CP-10-07 | CA4 (Edge) | Cambio de DNI a uno existente | Dos clientes registrados | Cambiar DNI del primero por el del segundo | Rechaza por duplicado |
| CP-10-08 | CA5 | Baja lógica sin reservas activas | Cliente sin reservas activas | Eliminar | eliminado = SI; no se borra físicamente; conserva historial |
| CP-10-09 | CA6 | Baja bloqueada con reservas | Cliente con reserva asociada | Eliminar | Bloquea e informa reservas asociadas |
| CP-10-10 | CA7 | Consulta por DNI, nombre o apellido | Cliente con reservas | Buscar por cada criterio | Muestra datos registrados y reservas asociadas |
| CP-10-11 | CA7 (Edge) | Búsqueda sin resultados | — | DNI 40999999 | Informa que no se encontraron clientes |

### 3.24 HU-11a — Registro de Reservas

| ID | HU / CA | Escenario | Precondiciones | Datos de entrada | Resultado esperado |
|---|---|---|---|---|---|
| CP-11a-01 | CA1 | Creación exitosa | Mesa 2 disponible 21:00-23:00; cliente registrado; medio activo | Fecha 22/11, 21:00, 2 h, 4 comensales, Mesa 2, seña $5.000 | Reserva Activa, seña asociada, mesa bloqueada en el período |
| CP-11a-02 | CA2 | Solapamiento total | Mesa 2 reservada 21:00-23:00 | Reservar Mesa 2 21:30-22:30 | Rechaza e informa Mesa 2 no disponible |
| CP-11a-03 | CA2 (Edge) | Solapamiento parcial | Mesa 2 reservada 21:00-23:00 | Reservar 22:30-23:30 | Rechaza por superposición |
| CP-11a-04 | CA2 (Edge) | Reserva adyacente | Mesa 2 reservada 21:00-23:00 | Reservar 23:00-00:00 | Permitido (no solapa) |
| CP-11a-05 | CA3 | Capacidad insuficiente | Mesas 2 (4) y 3 (2) | 7 comensales | Rechaza e informa capacidad faltante (1) |
| CP-11a-06 | CA4 | Fecha u hora pasada | Hoy 22/11 21:00 | Reserva 21/11 20:00 → 22/11 20:00 | Rechaza ambas |
| CP-11a-07 | CA5 | Cliente inexistente o dado de baja | Cliente eliminado; DNI 40999999 | Crear reserva con cada cliente | Rechaza e informa que primero debe registrar el cliente |
| CP-11a-08 | CA6 | Seña inválida | Medio inactivo disponible | Sin seña → $0 → -500 → medio inactivo | Rechaza e indica el error en cada caso |
| CP-11a-09 | CA7 | Menú acordado válido | Platos activos | 2 × "Ñoquis" a $4.800 acordados | Guarda menú acordado asociado a la reserva |
| CP-11a-10 | CA8 | Menú acordado inválido | Plato eliminado | Plato eliminado → cantidad 0 → -1 | No guarda e indica el error |
| CP-11a-11 | CA9 | Modificación con revalidación | Reserva Activa | Cambiar horario a uno ocupado → luego a uno libre | 1ro rechaza por CA2; 2do guarda cambios (revalida CA2 a CA5) |
| CP-11a-12 | CA10 | Cancelación anticipada | Reserva Activa, antes del horario | Cancelar a pedido del cliente | Pasa a Cancelada, seña marcada devuelta, mesas disponibles |
| CP-11a-13 | CA11 | Listado con filtros y vacío | Reservas en distintas fechas, estados y clientes | Filtrar por fecha → estado → cliente → sin coincidencias | Muestra fecha, hora, cliente, comensales, mesas, estado y seña, ordenados; sin resultados, mensaje de vacío |

### 3.25 HU-11b — Atención de Reservas

| ID | HU / CA | Escenario | Precondiciones | Datos de entrada | Resultado esperado |
|---|---|---|---|---|---|
| CP-11b-01 | CA1 | Registrar llegada | Reserva Activa para 21:00, hoy 21:05 | Registrar llegada | Pasa a Cumplida; disponible para abrir comanda (HU-05a) |
| CP-11b-02 | CA1 (Edge) | Llegada en el borde de tolerancia | Hoy 21:14:59 | Registrar llegada | Aceptada (aún dentro de los 15 min) |
| CP-11b-03 | CA2 | Ausencia después de tolerancia | Reserva Activa 21:00, hoy 21:16 | Marcar ausencia | Pasa a Ausente; seña no devuelta; mesas libres |
| CP-11b-04 | CA3 | Ausencia antes de tolerancia | Reserva Activa 21:00, hoy 21:10 | Marcar ausencia | Bloquea e informa cuánto falta (5 min) |
| CP-11b-05 | CA4 | Reserva cerrada | Reservas Cumplida, Cancelada y Ausente | Modificar, cancelar y registrar llegada en cada una | Bloquea todas las acciones |

### 3.26 HU-12a — Reporte de ventas por período

| ID | HU / CA | Escenario | Precondiciones | Datos de entrada | Resultado esperado |
|---|---|---|---|---|---|
| CP-12a-01 | CA1 | Consulta con ventas | 2 facturas Pagadas ($10.000 y $20.000) en el período | Elegir período | Total $30.000, cantidad 2, ticket promedio $15.000, gráfico de línea por día |
| CP-12a-02 | CA2 | Facturas adeudadas | Facturas Pagadas + 1 Adeudada $15.000 | Generar reporte | Adeudada no suma al total; se muestra como "Pendiente de cobro" $15.000 |
| CP-12a-03 | CA3 | Período personalizado con extremos | Facturas el 01/11 y 15/11 | Desde 01/11, hasta 15/11 | Incluye ambas facturas de los días extremos |
| CP-12a-04 | CA4 | Período inválido | — | Desde 20/11, hasta 15/11 → fecha futura | Rechaza con "El período seleccionado no es válido" |
| CP-12a-05 | CA5 | Sin ventas | Período sin facturas Pagadas | Generar reporte | Totales en $0 y mensaje "No hay ventas en el período seleccionado" |
| CP-12a-06 | CA6 | Acceso restringido | Usuario rol Mozo | Ver menú → acceder directamente a la URL | No se muestra la opción y rechaza acceso directo |
| CP-12a-07 | CA1 (Edge) | Períodos predefinidos | Facturas hoy, esta semana y este mes | Hoy → Semana actual → Mes actual (default) | Cada período filtra correctamente por fecha de factura |

### 3.27 HU-12b — Reporte de productos más vendidos

| ID | HU / CA | Escenario | Precondiciones | Datos de entrada | Resultado esperado |
|---|---|---|---|---|---|
| CP-12b-01 | CA1 | Ranking y desempate | Productos con 10, 8 y 8 unidades; los dos segundos con importes distintos | Generar reporte | Orden por unidades; desempate por importe y luego por nombre |
| CP-12b-02 | CA1 (Edge) | Más de 10 productos | 14 productos facturados | Generar reporte | Solo el top 10 |
| CP-12b-03 | CA2 | Filtro por tipo | Productos de todos los tipos | Tipo "Bebida" | Solo bebidas |
| CP-12b-04 | CA2 | Filtro por sección | Productos en varias secciones | Sección "Cervezas" | Solo productos de Cervezas |
| CP-12b-05 | CA3 | Precio histórico | Plato vendido a $5.000 y luego a $5.500 en el período | Generar reporte | Importe calculado con precio unitario de cada detalle, no el actual |
| CP-12b-06 | CA4 | Producto dado de baja | Producto vendido y eliminado después | Generar reporte | Sigue en ranking con marca "Eliminado" |
| CP-12b-07 | CA5 | Comandas sin facturar | Comandas Abiertas y Cerradas sin factura | Generar reporte | Sus productos no cuentan como vendidos |
| CP-12b-08 | CA6 | Sin ventas o período inválido | — | Sin comandas facturadas → desde > hasta | Mensaje "No hay ventas..." / "El período seleccionado no es válido" |

### 3.28 HU-12c — Reporte de ventas y comandas por mozo

| ID | HU / CA | Escenario | Precondiciones | Datos de entrada | Resultado esperado |
|---|---|---|---|---|---|
| CP-12c-01 | CA1 | Consulta general | Comandas cerradas de 2 mozos con facturas Pagadas | Generar reporte | Por mozo: comandas, comensales, total facturado y promedio; ordenado por total desc. |
| CP-12c-02 | CA2 | Detalle de un mozo | Mozo existente | Filtrar por DNI | Solo ese mozo con detalle de fecha/hora de cierre, mesas, comensales e importe |
| CP-12c-03 | CA3 | Mozo dado de baja | Mozo con comandas en el período y baja posterior | Generar reporte | Sigue apareciendo con marca "Dado de baja" |
| CP-12c-04 | CA4 | DNI inexistente | — | DNI 40999999 | Informa que no existe mozo con ese DNI |
| CP-12c-05 | CA5 | Comandas abiertas | Mozo con comandas sin fecha de cierre | Generar reporte | Esas comandas no se cuentan |
| CP-12c-06 | CA6 | Sin datos o período inválido | — | Sin comandas cerradas → desde > hasta | "No hay comandas en el período seleccionado" / "El período seleccionado no es válido" |
| CP-12c-07 | CA1 (Edge) | Cambio de mozo durante la comanda | Comanda abierta con Mozo A, cerrada con Mozo B | Generar reporte | Atribuida a Mozo B (el que figura al cierre) |

### 3.29 HU-12d — Reporte de ocupación de mesas por franja horaria

| ID | HU / CA | Escenario | Precondiciones | Datos de entrada | Resultado esperado |
|---|---|---|---|---|---|
| CP-12d-01 | CA1 | Mapa de calor | Comandas en varias franjas y días | Generar reporte | Mapa día × franja, ocupación promedio y franja de mayor ocupación (ej. "Sábado 21-22 h: 85 %") |
| CP-12d-02 | CA2 | Cálculo por franja | Mesa 5: apertura 12:40, cierre 14:10 | Generar reporte | Mesa 5 ocupada en franjas 12, 13 y 14 h |
| CP-12d-03 | CA3 | Comanda con varias mesas | Comanda con mesas 3 y 4 | Generar reporte | Ambas mesas cuentan como ocupadas en esas franjas |
| CP-12d-04 | CA4 | Comanda abierta | Comanda sin fecha de cierre, ahora 13:20 | Generar reporte | Ocupada desde apertura hasta la hora actual |
| CP-12d-05 | CA5 | Filtro por sector | 10 mesas en Salón, 4 en Terraza | Filtrar sector Terraza | Porcentaje calculado solo sobre las 4 mesas activas de Terraza |
| CP-12d-06 | CA6 | Sin datos o período inválido | — | Sin comandas → desde > hasta | "No hay ocupación registrada..." / "El período seleccionado no es válido" |
| CP-12d-07 | CA1 (Edge) | Reservas sin comanda | Reserva Activa sin comanda | Generar reporte | No cuenta como ocupación (según dependencias de la HU) |

### 3.30 HU-12e — Reporte de reservas por estado y clientes con más ausencias

| ID | HU / CA | Escenario | Precondiciones | Datos de entrada | Resultado esperado |
|---|---|---|---|---|---|
| CP-12e-01 | CA1 | Reservas por estado | Reservas en los 4 estados | Generar reporte | Cantidad y porcentaje por estado sobre el total, con gráfico de dona |
| CP-12e-02 | CA2 | Ranking de ausencias | 12 clientes con ausencias, dos empatados | Generar reporte | Top 10 ordenado por ausencias; empate por ausencia más reciente; sin ausencias no aparecen |
| CP-12e-03 | CA3 | Señas retenidas | Reservas Ausentes con seña no devuelta | Generar reporte | Suma mostrada como "Señas retenidas" |
| CP-12e-04 | CA4 | Cliente dado de baja | Cliente con ausencias dado de baja | Generar reporte | Sigue en lista con marca "Dado de baja" |
| CP-12e-05 | CA5 | Sin datos o período inválido | — | Sin reservas → desde > hasta | "No hay reservas en el período seleccionado" / "El período seleccionado no es válido" |

### 3.31 HU-12f — Reporte de cobros por medio de pago

| ID | HU / CA | Escenario | Precondiciones | Datos de entrada | Resultado esperado |
|---|---|---|---|---|---|
| CP-12f-01 | CA1 | Consulta general | Facturas Pagadas con varios medios | Generar reporte | Por medio: pagos, monto abonado, recargo, total, porcentaje y dona; ordenado por total desc. |
| CP-12f-02 | CA2 | Factura con varios medios | Factura pagada $10.000 efectivo + $20.000 tarjeta | Generar reporte | Cada monto suma a su medio de pago |
| CP-12f-03 | CA3 | Recargos | Pago con tarjeta 10 % de recargo | Generar reporte | Recargo separado del monto abonado; total cobrado lo incluye |
| CP-12f-04 | CA4 | Factura adeudada con pagos parciales | Factura Adeudada con detalle de pago parcial | Generar reporte | Pagos parciales no se cuentan hasta que factura esté Pagada |
| CP-12f-05 | CA5 | Medio dado de baja | Medio usado en el período y dado de baja después | Generar reporte | Sigue apareciendo con marca "Dado de baja" |
| CP-12f-06 | CA6 | Sin datos o período inválido | — | Sin facturas Pagadas → desde > hasta | "No hay cobros en el período seleccionado" / "El período seleccionado no es válido" |
| CP-12f-07 | CA1 (Edge) | Señas de reservas | Reservas con seña en el período | Generar reporte | Las señas no se incluyen (se ven en HU-12e) |

---

## 4. Nivel 2 — Pruebas unitarias (caja blanca)

Validan lógica pura y validaciones en aislamiento, con dobles de BD. Los nombres de funciones son **sugeridos**: se ajustarán a la implementación real. Se usa `pytest` (backend) y `Vitest` (frontend) con `freezegun` / `vi.setSystemTime` para reloj fijo.

| ID | Función / método sugerido | Qué valida (lógica y edge cases) | Entradas de prueba | Salida / comportamiento esperado |
|---|---|---|---|---|
| PU-01 | `validar_longitud_campo(valor, min, max)` | Obligatoriedad y longitudes de sectores, secciones, mozos, clientes y productos | "", "AB", "ABC", 50 y 51 caracteres | False para vacío, 2 y 51; True para 3 y 50 |
| PU-02 | `validar_documento(doc)` | Formato fiscal de DNI (7-8) y CUIT (11) | "1234567", "30111222", "20123456789", "123", "20-123-A" | True para los 3 válidos; `ValidationError` para corto y con letras/guiones |
| PU-03 | `validar_email_y_telefono(email, tel)` | Opcionalidad y formato | "" (email), "ana@mail.com", "mail", "1144444444", "11aa4444" | Email vacío válido; formatos válidos True; inválidos False |
| PU-04 | `validar_precio(precio)` | Precio > 0 en platos, postres y bebidas | "", 0, -1, 5000, "5.000" | False para vacío, 0 y -1; True para 5000 y "5.000" normalizado |
| PU-05 | `validar_entero_positivo(valor)` | Gramas, ml, capacidad y cantidad | 0, -3, 5,5, 350, "500" | False para 0, negativo y decimal; True para 350 y "500" |
| PU-06 | `normalizar_nombre_unico(nombre)` | Unicidad con trim + `casefold` + NFD (O-11 cerrado) | "Salón", " salón ", "salon", "Terraza" | "Salón" e " salón " colisionan; "salon" y "Terraza" no |
| PU-07 | `calcular_total_pago(detalles)` | Suma de pagos parciales y recargos | `[{10000,0},{20000,10}]`, `[]`, `[{10000,-5}]` | 32000.0; 0 para lista vacía; error para recargo negativo |
| PU-08 | `validar_recargo(porcentaje)` | Recargo ≥ 0 en medios de pago | 0, 5, 10, -1, "abc" | True para 0, 5 y 10; False para -1 y no numérico |
| PU-09 | `aplicar_promocion(item, promo, hoy)` | Vigencia, estado activo, límites 1-100 y cálculo | Promo 20 % vigente; expirada; activo=NO; descuento 150 | Aplica 0,8 × precio solo vigente y activa; ignora las demás; rechaza 150 |
| PU-10 | `verificar_tolerancia_reserva(hora_res, ahora)` | Regla de 15 min de gracia, bordes inclusive | 21:00 vs 21:14:59 / 21:15:00 / 21:15:01 | False (faltan 1 s → ver O-08), True en el borde, True después |
| PU-11 | `hay_solapamiento_horario(r1, r2)` | Intervalos `[inicio, inicio+duración)`; adyacencia permitida | 20:00-22:00 vs 21:00-23:00 / 22:00-00:00 / 19:00-20:00 | True para 21:00-23:00; False para adyacentes |
| PU-12 | `descontar_stock(producto, cantidad)` | Inventario y autodeshabilitación (descuento al cargar, O-09 cerrado) | stock 5 cant 5; stock 5 cant 6; stock None cant 10; stock 2 cant 5 | Stock 0 y disponible=False; `StockInsuficienteError`; sin cambios; error |
| PU-13 | `obtener_franjas_ocupadas(apertura, cierre, ahora)` | Discretización horaria, comanda abierta | 12:40-14:10; abierta 12:40 con ahora 13:20 | `[12,13,14]`; `[12,13]` |
| PU-14 | `calcular_ticket_promedio(total, cantidad)` | Promedio y división por cero | (30000, 2), (0, 0) | 15000.0; 0 sin lanzar excepción |
| PU-15 | `calcular_porcentaje_ocupacion(ocupadas, activas)` | Denominador de mesas activas del sector | (1, 10), (0, 0), (4, 4) | 10.0; 0; 100.0 |
| PU-16 | `calcular_porcentaje_estados(conteos, total)` | Suma de porcentajes = 100 y redondeo | `{Activa:1, Cumplida:2, Cancelada:1, Ausente:1}`, total 5 | 20/40/20/20; sin residuo por redondeo |
| PU-17 | `ordenar_ranking(productos)` | Top 10 y desempate unidades → importe → nombre | 14 productos, dos con 8 unidades e importes 40000 y 38000 | Devuelve 10; el de 40000 precede al de 38000 |
| PU-18 | `calcular_importe_vendido(detalle)` | Precio histórico congelado | cant 2, precio_detalle 5000, precio_carta_actual 5500 | 10000 (usa precio del detalle) |
| PU-19 | `transicion_comanda(estado, accion)` | Máquina de estados de comandas | Abierta+cerrar; Cerrada+reabrir; Facturada+reabrir; Anulada+eliminar | Cerrada; Abierta; bloquea; bloquea |
| PU-20 | `validar_cambio_capacidad(cap_actual, cap_nueva, reservas)` | No bajar por debajo de comensales reservados | (6, 4, [5]), (6, 5, [5]), (6, 2, []) | Bloquea; permite; permite |
| PU-21 | `validar_comensales(comensales, sillas)` | Comensales > 0 y ≤ sillas | 0, -1, 5 con 4 sillas, 4 con 4 sillas | False, False, False, True |
| PU-22 | `validar_periodo(desde, hasta, hoy)` | Rango válido, extremos inclusivos y fechas futuras | 01/11-15/11; 20/11-15/11; hasta 30/11 (futura) | True; False con mensaje de período inválido; False |
| PU-23 | `calcular_recargo(monto, porcentaje)` | Recargo simple por pago | (20000, 10), (10000, 0) | 22000.0; 10000.0 |
| PU-24 | `agrupar_carta(secciones, productos)` | Orden de secciones, ocultar vacías y eliminados, marca No disponible | Sección vacía; producto eliminado; producto stock 0 | Sección vacía omitida; eliminado omitido; disponible=False en el resultado |
| PU-25 | `congelar_precio_item(precio_producto, precio_detalle)` | Inmutabilidad del precio en comandas ya creadas | producto 5500, detalle 5000 | Se conserva 5000 al renderizar/facturar la comanda |
| PU-26 | `validar_estado_factura_para_cobro(estado)` | Solo Adeudada admite cobro | Adeudada, Pagada | True; False con mensaje "ya fue saldada" |
| PU-27 | `validar_tipo_factura(tipo)` | Tipos A, B, C, Consumidor Final | "A", "B", "C", "Consumidor Final", "X", None | Válidos los 4; rechaza "X" y None |
| PU-28 | `calcular_señas_retenidas(reservas)` | Solo señas de Ausentes no devueltas | Ausente $5000 no devuelta; Cancelada devuelta; Ausente devuelta | 5000 |
| PU-29 | `validar_vigencia(fecha_inicio, fecha_fin, hoy)` | Vacía, borrada o ya finalizada al correr la fecha | 22/11-30/11; 25/11-23/11; 20/11-21/11 | True; False; False (pasó a inactivo) |
| PU-30 | `validar_unicidad_mesa(numero, mesas_activas, excluir_id=None)` | Unicidad global entre activas, permitiendo reutilizar bajas y excluir propia id | 10 con activa 10; 9 con inactiva 9; 11 excluyendo id propia | False; True; True |

---

## 5. Nivel 3 — Pruebas de integración

Verifican la interacción real **API (controladores) ↔ servicios ↔ base de datos**. Cada suite levanta una BD de prueba limpia (fixture) y usa `TestClient`/`httpx` contra el servidor local. Se comprueban tanto el código HTTP como el estado persistido.

| ID | Módulos / endpoints | Flujo end-to-end | Resultado esperado en BD y HTTP |
|---|---|---|---|
| PI-01 | Sectores + Mesas (HU-01a, HU-01b) | `POST /api/v1/salon/sectores` → `POST /api/v1/salon/mesas` → `DELETE /api/v1/salon/sectores/{id}` → `DELETE /api/v1/salon/mesas/{id}` → `DELETE /api/v1/salon/sectores/{id}` | 1er DELETE = 409 Conflict (mesa activa); tras baja de mesa, 200 OK con `activa=False`; sector nunca se borra físicamente |
| PI-02 | Carta + Productos + Stock (HU-03b, HU-04a, HU-04d) | Crear sección → crear plato con stock 1 → abrir comanda → agregar 2 unidades (descuento al cargar, O-09 cerrado) → `GET /api/v1/carta` | 2da unidad rechazada (409/400); `GET /api/v1/carta` 200 devuelve el plato agrupado con `disponible=false` y etiqueta "No disponible" |
| PI-03 | Ciclo de comanda (HU-05a/b/c/d, HU-06) | `POST /api/v1/comandas` → `POST /api/v1/comandas/{id}/detalles` → `POST /api/v1/comandas/{id}/cierre` (falla) → `PATCH /api/v1/comandas/{id}/detalles/{detalle_id}/entrega` → `POST /api/v1/comandas/{id}/cierre` → `POST /api/v1/comandas/{id}/reapertura` | Transiciones BD Abierta → Cerrada → Abierta; `fechaHoraCierre` NOT NULL al cerrar y NULL al reabrir; cierre sin entregas devuelve 409 |
| PI-04 | Comanda + Factura + Cobro (HU-05c, HU-08a/b, HU-05d) | `POST /api/v1/comandas/{id}/cierre` → `POST /api/v1/facturacion` → `POST /api/v1/facturacion/{id}/cobrar` con 2 medios → intentar `POST /api/v1/comandas/{id}/reapertura` → `GET /api/v1/facturacion/{id}/comprobante` | Factura Adeudada → Pagada; comanda → Facturada; reapertura devuelve 409; comprobante disponible (200 + PDF/JSON) |
| PI-05 | Reservas + Atención + Comanda (HU-11a/b, HU-05a) | Crear reserva con menú acordado → llegada (Cumplida) → `POST /api/v1/comandas` desde reserva | Comanda creada con mesas, comensales y platos del menú al precio acordado; reserva queda Cumplida; mesa sigue ocupada |
| PI-06 | Facturación + Reportes (HU-08a/b, HU-12a/b/c/f) | Generar 3 facturas (2 Pagadas, 1 Adeudada), cambiar precio de producto a mitad, pagar mixto con recargo → consultar 12a, 12b, 12c, 12f | Totales coherentes entre reportes; 12b usa precio histórico; 12a y 12f ignoran Adeudada; 12f separa recargo; 12c atribuye al mozo de cierre |
| PI-07 | Mozos + Comandas (HU-02, HU-05a) | Crear mozo → abrir comanda → intentar baja → cerrar comanda → baja → intentar abrir nueva comanda | Baja devuelve 409 mientras haya comanda abierta; luego `activo=False`; nuevo `POST /api/v1/comandas` con ese DNI devuelve 400 |
| PI-08 | Productos + usos (HU-04a/b/c, HU-09a/b, HU-11a) | Crear plato → usarlo en comanda abierta, promo vigente, menú vigente y menú acordado → intentar eliminar en cada caso | 409 con mensaje indicando el uso; tras liberar todos los usos, baja lógica 200 y producto ausente de `GET /api/v1/carta` |
| PI-09 | Promociones aplicadas (HU-09a, HU-05b, HU-08a) | Crear promo 20 % vigente sobre bebida → agregar a comanda → cerrar → facturar | Detalle guarda precio con descuento; factura refleja el precio descontado; promo expirada no descuenta en comanda nueva |
| PI-10 | Clientes + Reservas + Reportes (HU-10, HU-11a/b, HU-12e) | Registrar cliente → crear reserva → marcar ausencia → intentar baja → consultar 12e | Baja de cliente 409 por reserva; 12e muestra estado Ausente, seña retenida y cliente en top de ausencias |
| PI-11 | Ocupación (HU-01a/b, HU-05a/c, HU-12d) | 10 mesas (4 en Terraza) → comanda 12:40-14:10 en Mesa 5 con 2 mesas → comanda abierta → reporte con/sin filtro de sector | Franjas 12, 13, 14 para Mesa 5; comanda abierta hasta hora actual; Terraza calcula sobre 4 mesas activas |
| PI-12 | Medios de pago + Cobro + Reporte (HU-07a/b, HU-08b, HU-12f) | Alta de Efectivo y Tarjeta 10 % → cobro mixto → baja de Tarjeta → consultar 12f | Factura Pagada con total actualizado; 12f separa recargo y marca "Dado de baja"; medio inactivo rechazado en nuevas facturas |
| PI-13 | Bajas lógicas e historial (HU-02, HU-07b, HU-10, HU-12c/e/f) | Dar de baja mozo, cliente y medio usados en el período → consultar reportes 12c, 12e, 12f | Los tres siguen en reportes con marca "Dado de baja"; ningún registro se elimina físicamente |
| PI-14 | Modificaciones y anulaciones (HU-05b/c/e, HU-06) | Comanda con ítem entregado → subir cantidad (OK) → bajar (409) → quitar (409) → cerrar con pendientes (409) → entregar → anular (409) | Cada bloqueo con código 409 y mensaje específico; subida marca nueva unidad como pendiente; anulación solo antes de entregas |
| PI-15 | Validaciones HTTP y acceso (HU-05f, HU-08a/b, HU-12a) | DNI inexistente en filtro, CUIT corto, cobro a factura Pagada, acceso de Mozo a reportes | 400/404/409/403 según caso, con cuerpo de error descriptivo; sin stack traces ni 5xx |
| PI-16 | Seeds + carta + RNF (HU-03b, HU-01b, HU-01a, RNF-01) | `python -m app.seed` → `GET /api/v1/carta`, `GET /api/v1/comandas/tablero-mesas`, `GET /api/v1/salon/sectores` 5 veces cada una con caché deshabilitada (rutas UI: `/carta`, `/mesas`, `/configuracion/sectores`) | 200 en todos; consistencia de datos entre ejecuciones; tiempos registrados en ficha §6.1 |

**Convención de códigos esperados:** 200 operación OK · 400 validación de entrada · 403 acceso restringido · 404 inexistente · 409 conflicto de regla de negocio · 500 no esperado (fallo de la prueba).

---

## 6. Nivel 4 — Plan de medición de Requerimientos No Funcionales

Estas dos fichas cerraron el estado *Pendiente de medir* de los requerimientos RNF-01 y RNF-02, con mediciones reales del 22/11.

### 6.1 Ficha de medición RNF-01 — Tiempo de carga de listados

| Campo | Detalle |
|---|---|
| **Requerimiento** | Los listados de carta, mesas y sectores se muestran en menos de 2 segundos, en red local y con los datos del seed |
| **Objetivo** | Verificar que las 3 vistas carguen en < 2000 ms (promedio y p95) |
| **HU asociadas** | HU-03b (carta), HU-01b (mesas), HU-01a (sectores) |
| **Ambiente** | Backend FastAPI en `127.0.0.1:8000` y Vite en `127.0.0.1:5173`; BD poblada con el comando exacto `python -m app.seed`; red local (mismo host, sin VPN ni proxy) |
| **Herramienta** | Playwright + Chromium headless con `Network.setCacheDisabled=true`, script `tests/performance/medir_rnf01.py`. TTFB leído de Resource Timing y render del momento en que el listado está visible en el DOM |
| **Métricas** | **TTFB / API:** `responseStart - startTime` del `GET` correspondiente. **Load/Render:** `performance.now()` cuando el contenido de datos esperado ya está visible; se registró además `domContentLoaded` y `load` por ejecución |
| **Repeticiones** | 5 ejecuciones por vista (15 mediciones totales). Se descarta la 1ra como calentamiento y se promedian las 4 restantes; se reporta además p95 sobre las 5 |
| **Criterio de aceptación** | Promedio **y** p95 del tiempo total de visualización < 2000 ms para **cada una** de las 3 vistas. 0 errores HTTP |

**Procedimiento:**

1. Ejecutar `python -m app.seed` en `backend/` para asegurar el volumen estándar de datos.
2. Levantar backend (`uvicorn app.main:app --port 8000`) y frontend (`npm run dev -- --port 5173`). Si hace falta, instalar la herramienta con `backend/.venv/bin/pip install playwright` y `backend/.venv/bin/python -m playwright install chromium`.
3. Ejecutar `backend/.venv/bin/python tests/performance/medir_rnf01.py`. El script inicia sesión como `admin`, deshabilita la caché por CDP y navega 5 veces cada vista.
4. Vistas medidas: **Ver carta** `/carta` (`GET /api/v1/carta`), **Mesas** `/mesas` (`GET /api/v1/comandas/tablero-mesas`) y **Sectores** `/configuracion/sectores` (`GET /api/v1/salon/sectores`).
5. El script descarta la primera ejecución para el promedio y calcula p95 sobre las 5.
6. Los valores reales se volcaron en la plantilla de registro de abajo y se compararon contra 2000 ms.

**Plantilla de registro RNF-01:**

**Registro real (22/11, Playwright/Chromium, caché deshabilitada).** Las celdas "Ej n" son el render en ms; el TTFB promedio se calcula sobre las ejecuciones 2 a 5 y el p95 sobre las 5.

| Vista | Endpoint | Ej 1 (ms) | Ej 2 | Ej 3 | Ej 4 | Ej 5 | TTFB promedio | Render promedio | p95 | ¿Cumple < 2000 ms? |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Carta | `GET /api/v1/carta` | 190,60 | 171,20 | 172,90 | 163,30 | 169,00 | 7,98 ms | 169,10 ms | 187,06 ms | **Sí** |
| Mesas | `GET /api/v1/comandas/tablero-mesas` | 181,80 | 161,70 | 162,60 | 152,50 | 155,10 | 16,30 ms | 157,98 ms | 177,96 ms | **Sí** |
| Sectores | `GET /api/v1/salon/sectores` | 143,20 | 154,10 | 161,40 | 142,10 | 150,20 | 6,73 ms | 151,95 ms | 159,94 ms | **Sí** |

Detalle por ejecución (ms): TTFB / render — Carta: 13,5/190,6 · 7,7/171,2 · 7,9/172,9 · 8,8/163,3 · 7,5/169,0; Mesas: 23,6/181,8 · 16,3/161,7 · 16,7/162,6 · 16,7/152,5 · 15,5/155,1; Sectores: 9,1/143,2 · 6,9/154,1 · 5,9/161,4 · 7,2/142,1 · 6,9/150,2. `domContentLoaded` osciló entre 106,8 y 136,8 ms y `load` entre 107,6 y 137,3 ms. 0 errores HTTP.

> Nota: se toma el umbral **< 2000 ms** (ver O-07).

### 6.2 Ficha de medición RNF-02 — Concurrencia y tiempo de respuesta de escritura

| Campo | Detalle |
|---|---|
| **Requerimiento** | Crear una comanda o registrar una factura responde en menos de 500 ms con 5 mozos operando a la vez |
| **Objetivo** | Verificar p95 < 500 ms en `POST /api/v1/comandas` y `POST /api/v1/facturacion` bajo carga de 5 usuarios concurrentes |
| **HU asociadas** | HU-05a (crear comanda), HU-05b/c, HU-06, HU-08a (generar factura) |
| **Herramienta** | Script real `tests/performance/test_rnf02.py` (`asyncio` + `httpx`), ejecutado con `backend/.venv/bin/python tests/performance/test_rnf02.py` contra `http://127.0.0.1:8000` |
| **Usuarios virtuales** | 5 VUs con los DNIs del plan (30111222, 30222333, 30333444, 30444555, 30555666) y una mesa propia cada uno (10 a 14). El script crea esos mozos y mesas en el sector "Salón Principal" si no existen. Se usa un token de administrador compartido porque `POST /api/v1/facturacion` exige `ADMINISTRADOR`/`CAJERO` y no acepta rol MOZO (O-15 cerrada) |
| **Flujo por VU** | 1) `POST /api/v1/comandas` en mesa libre de su sector → 2) `POST /api/v1/comandas/{id}/detalles` y `PATCH /api/v1/comandas/{id}/detalles/{detalle_id}/entrega` → 3) `POST /api/v1/comandas/{id}/cierre` → 4) `POST /api/v1/facturacion` desde la comanda cerrada |
| **Duración / iteraciones** | 50 iteraciones totales = 10 ciclos completos por cada uno de los 5 mozos, lanzados en simultáneo (barrera de inicio común) |
| **Métricas capturadas** | avg / min / max / **p95** de `POST /api/v1/comandas` y `POST /api/v1/facturacion`; tasa de errores HTTP (0 % esperado); errores de BD (`database is locked`) y cualquier 5xx |
| **Criterio de aceptación** | p95 < 500 ms en **ambos** endpoints bajo 5 VUs; 0 % de errores HTTP; sin `OperationalError: database is locked` ni 5xx. Los endpoints intermedios (items, cierre) se ejecutan para armar el escenario pero **no** entran en el criterio |
| **Precondición técnica** | El código ya habilita `PRAGMA journal_mode=WAL` en cada conexión (`backend/app/core/database.py`); el script usa timeout de 20 s y prepara las 5 mesas/mozos después del `seed` |
| **Aislamiento** | Se ejecutó sobre la BD local restaurada con `python -m app.seed` inmediatamente antes de la corrida válida; el script crea los 5 mozos y 5 mesas de prueba dentro de esa BD |

**Script implementado:** `tests/performance/test_rnf02.py`. Mantiene el diseño del plan con estos ajustes al código real: `BASE_URL = http://127.0.0.1:8000`, prefijo `/api/v1`, payloads `{"dni_mozo", "cantidad_comensales", "numeros_mesa"}` y `{"comanda_id"}`, y marcado de entrega antes del cierre (obligatorio en HU-06). La barrera `asyncio.Barrier(5)` se usa **solo una vez** para el arranque simultáneo; si se rompe, los VUs salen limpiamente. Cada request se envuelve en `try/except` y registra el error sin detener a los otros workers. El percentil 95 se calcula por interpolación lineal (equivalente a `numpy.percentile`) y la salida es JSON.

```bash
cd backend
.venv/bin/python -m app.seed
.venv/bin/python ../tests/performance/test_rnf02.py
```

**Equivalente en Locust:** 5 `HttpUser` con `wait_time = constant(0)`, `task` que ejecuta el flujo completo y estadísticas personalizadas vía `self.environment.events.request.fire()` etiquetando `POST /api/v1/comandas` y `POST /api/v1/facturacion`.

**Plantilla de registro RNF-02:**

**Registro real (22/11, corrida válida de 50 ciclos completos, 0 errores):** el p95 se calcula sobre las 50 mediciones de cada endpoint; el máximo de 640,67 ms en comandas no rompe el criterio, que es de p95.

| Endpoint | Iteraciones | avg (ms) | min (ms) | max (ms) | p95 (ms) | Errores HTTP | `database is locked` | ¿Cumple < 500 ms? |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| `POST /api/v1/comandas` | 50 | 37,76 | 6,96 | 640,67 | 52,77 | 0 | 0 | **Sí** |
| `POST /api/v1/facturacion` | 50 | 38,97 | 9,52 | 269,46 | 71,95 | 0 | 0 | **Sí** |

Los 50 ciclos completaron las 5 etapas (comanda → detalle → entrega → cierre → factura). No hubo errores de red ni 5xx.

---

## 8. Criterios de cierre de la suite

La suite se considera completa cuando:

- [ ] Los 233 casos funcionales tienen resultado registrado (pasó / falló / bloqueado) con evidencia (captura o ID de ticket).
- [x] Los 179 CA tienen al menos un caso que los cubre; los CA dependientes de HU no implementadas se marcan **"simulado con datos"** (HU-04a CA8, HU-04b CA5, HU-04c CA5). Validado 22/11: 233/233 CP y 179/179 CA con cobertura; marca agregada en CP-04a-10/11, CP-04b-06/07 y CP-04c-08.
- [x] Las 30 pruebas unitarias pasan en CI (`pytest` + `Vitest`) con cobertura de las ramas de error. Validado 22/11: `pytest` 432 passed y `Vitest` 184 passed; `.github/workflows/ci.yml` ejecuta ambos. Los IDs PU/PI no están etiquetados en el código, así que la verificación es del conjunto de suites.
- [x] Las 16 pruebas de integración pasan contra BD limpia y validan código HTTP **y** estado persistido. Validado 22/11: `backend/tests/conftest.py` crea SQLite en memoria nueva por test y los tests consultan la BD con `db.get`/`select` además del código HTTP.
- [x] RNF-01: plantilla §6.1 completada con 15 mediciones; promedio y p95 < 2000 ms en las 3 vistas.
- [x] RNF-02: plantilla §6.2 completada con 50 + 50 mediciones; p95 < 500 ms, 0 errores HTTP, 0 `database is locked`.
- [ ] Decisiones: O-09, O-10, O-11 y O-15 están resueltas y reflejadas en los casos afectados (22/11). Falta **O-12**: alinear "menú acordado de reserva Activa" (HU-04a CA8) con la apertura de comanda desde reserva Cumplida (HU-05a). Afecta CP-04a-12 y PI-08.
- [x] RNF-01 y RNF-02 pasan de "Pendiente de medir" a "Medido – conforme" (o "Medido – no conforme" con plan de acción) y ese estado quedó registrado.


