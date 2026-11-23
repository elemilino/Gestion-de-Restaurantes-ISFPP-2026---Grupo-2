"""Medición real de RNF-02: 5 usuarios concurrentes, 10 ciclos por usuario.

Se ejecuta contra la API local (FastAPI en 127.0.0.1:8000):

    cd backend && .venv/bin/python ../tests/performance/test_rnf02.py

Requiere `httpx` (ya está en el entorno del backend). El seed base no trae 5
mozos ni 5 mesas libres, así que el propio script prepara ese escenario con el
usuario administrador antes de arrancar la barrera de medición.

Notas sobre el plan original:
- Las rutas del plan (`/api/comandas`, `/api/facturas`, ...) no existen. Las
  rutas reales están bajo `/api/v1` y se usan acá.
- `POST /api/v1/facturacion` exige rol ADMINISTRADOR o CAJERO, mientras que
  `POST /api/v1/comandas` exige MOZO o ADMINISTRADOR. Para que un mismo VU
  complete el ciclo se usa un token de administrador compartido; la identidad
  del mozo se envía en `dni_mozo` (los 5 DNIs del plan) y cada VU opera su mesa.
- La barrera es una sola (arranque simultáneo), no una por ciclo: así un error
  en un VU no deja a los demás esperando en la siguiente barrera.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import statistics
import time
from dataclasses import dataclass, field

import httpx

BASE_URL = "http://127.0.0.1:8000"
API = "/api/v1"
VUS = 5
CICLOS_POR_VU = 10
SECTOR = "Salón Principal"
DNIS = ["30111222", "30222333", "30333444", "30444555", "30555666"]
MESAS = [10, 11, 12, 13, 14]
UMBRAL_MS = 500.0

COMANDAS = "POST /api/v1/comandas"
FACTURAS = "POST /api/v1/facturacion"
MEASURED = (COMANDAS, FACTURAS)


def percentil(valores: list[float], porcentaje: float) -> float | None:
    """Percentil lineal (equivalente a numpy.percentile, sin dependencias)."""
    if not valores:
        return None
    ordenados = sorted(valores)
    if len(ordenados) == 1:
        return ordenados[0]
    posicion = (len(ordenados) - 1) * porcentaje / 100
    inferior = int(posicion)
    superior = min(inferior + 1, len(ordenados) - 1)
    fraccion = posicion - inferior
    return ordenados[inferior] + fraccion * (ordenados[superior] - ordenados[inferior])


@dataclass
class Resultado:
    tiempos: dict[str, list[float]] = field(
        default_factory=lambda: {COMANDAS: [], FACTURAS: []}
    )
    errores_http: list[str] = field(default_factory=list)
    errores_bd: list[str] = field(default_factory=list)
    errores_red: list[str] = field(default_factory=list)
    ciclos_completos: int = 0

    def registrar_error(self, etiqueta: str, respuesta: httpx.Response | None, exc: Exception | None) -> None:
        if exc is not None:
            self.errores_red.append(f"{etiqueta}: {type(exc).__name__}: {exc}")
            return
        if respuesta is None:
            return
        texto = respuesta.text.lower()
        if "database is locked" in texto:
            self.errores_bd.append(f"{etiqueta}: {respuesta.status_code} {respuesta.text[:200]}")
        if respuesta.status_code >= 400:
            self.errores_http.append(
                f"{etiqueta}: {respuesta.status_code} {respuesta.text[:200]}"
            )

    def resumen(self, etiqueta: str) -> dict:
        datos = self.tiempos[etiqueta]
        return {
            "endpoint": etiqueta,
            "iteraciones": len(datos),
            "avg_ms": round(statistics.mean(datos), 2) if datos else None,
            "min_ms": round(min(datos), 2) if datos else None,
            "max_ms": round(max(datos), 2) if datos else None,
            "p95_ms": round(percentil(datos, 95), 2) if datos else None,
        }


async def request(
    cliente: httpx.AsyncClient,
    resultado: Resultado,
    metodo: str,
    ruta: str,
    *,
    etiqueta: str | None = None,
    json_body: dict | None = None,
    headers: dict | None = None,
    medir: bool = False,
) -> tuple[httpx.Response | None, float | None]:
    """Envía una request, captura errores y devuelve (respuesta, ms si midió)."""
    nombre = etiqueta or f"{metodo} {ruta}"
    inicio = time.perf_counter()
    respuesta: httpx.Response | None = None
    exc: Exception | None = None
    try:
        respuesta = await cliente.request(metodo, ruta, json=json_body, headers=headers)
    except Exception as error:  # noqa: BLE001 - queremos seguir con otros VUs
        exc = error
    elapsed = (time.perf_counter() - inicio) * 1000
    resultado.registrar_error(nombre, respuesta, exc)
    return respuesta, (elapsed if medir and exc is None else None)


async def preparar_escenario(cliente: httpx.AsyncClient) -> dict:
    """Login admin, 5 mesas libres y 5 mozos con los DNIs del plan."""
    respuesta, _ = await request(
        cliente,
        Resultado(),
        "POST",
        f"{API}/auth/login",
        json_body={"username": "admin", "password": "1234"},
    )
    if respuesta is None or respuesta.status_code != 200:
        raise RuntimeError(f"No se pudo iniciar sesión: {respuesta.text if respuesta else 'sin respuesta'}")
    headers = {"Authorization": f"Bearer {respuesta.json()['access_token']}"}

    sectores = await cliente.get(f"{API}/salon/sectores", headers=headers)
    sectores.raise_for_status()
    sector = next((s for s in sectores.json() if s["nombre"] == SECTOR), None)
    if sector is None:
        raise RuntimeError(f"No existe el sector {SECTOR!r}")
    sector_id = sector["id"]

    mesas = await cliente.get(f"{API}/salon/mesas", headers=headers)
    mesas.raise_for_status()
    numeros_existentes = {m["numero"] for m in mesas.json()}
    for numero in MESAS:
        if numero in numeros_existentes:
            continue
        creada = await cliente.post(
            f"{API}/salon/mesas",
            headers=headers,
            json={"numero": numero, "capacidad": 4, "sector_id": sector_id},
        )
        if creada.status_code != 201:
            raise RuntimeError(f"No se pudo crear la mesa {numero}: {creada.text}")

    mozos = await cliente.get(f"{API}/mozos", headers=headers)
    mozos.raise_for_status()
    por_dni = {m["dni"]: m for m in mozos.json()}
    for indice, dni in enumerate(DNIS, start=1):
        if dni in por_dni:
            continue
        creado = await cliente.post(
            f"{API}/mozos",
            headers=headers,
            json={
                "nombre": "RNF02",
                "apellido": f"VU{indice}",
                "dni": dni,
                "telefono": "1122334455",
                "sector_id": sector_id,
                "username": f"rnf02_vu{indice}",
                "password": "1234",
            },
        )
        if creado.status_code != 201:
            raise RuntimeError(f"No se pudo crear el mozo {dni}: {creado.text}")

    carta = await cliente.get(f"{API}/carta", headers=headers)
    carta.raise_for_status()
    producto = next(
        (
            p
            for seccion in carta.json()["secciones"]
            for p in seccion["productos"]
            if p["disponible"]
        ),
        None,
    )
    if producto is None:
        raise RuntimeError("La carta no tiene productos disponibles para el escenario")
    return {"headers": headers, "producto_id": producto["id"]}


async def ciclo_vu(
    cliente: httpx.AsyncClient,
    barrera: asyncio.Barrier,
    resultado: Resultado,
    dni: str,
    mesa: int,
    contexto: dict,
) -> None:
    headers = contexto["headers"]
    producto_id = contexto["producto_id"]
    try:
        await barrera.wait()
    except asyncio.BrokenBarrierError:
        return

    for _ in range(CICLOS_POR_VU):
        respuesta, ms = await request(
            cliente,
            resultado,
            "POST",
            f"{API}/comandas",
            etiqueta=COMANDAS,
            json_body={
                "dni_mozo": dni,
                "cantidad_comensales": 2,
                "numeros_mesa": [mesa],
            },
            headers=headers,
            medir=True,
        )
        if ms is not None:
            resultado.tiempos[COMANDAS].append(ms)
        if respuesta is None or respuesta.status_code != 201:
            continue
        comanda_id = respuesta.json()["id"]

        detalle, _ = await request(
            cliente,
            resultado,
            "POST",
            f"{API}/comandas/{comanda_id}/detalles",
            json_body={"producto_id": producto_id, "cantidad": 1},
            headers=headers,
        )
        if detalle is None or detalle.status_code != 200:
            continue
        detalle_id = detalle.json()["detalles"][-1]["id"]

        entrega, _ = await request(
            cliente,
            resultado,
            "PATCH",
            f"{API}/comandas/{comanda_id}/detalles/{detalle_id}/entrega",
            json_body={"entregado": True},
            headers=headers,
        )
        if entrega is None or entrega.status_code != 200:
            continue

        cierre, _ = await request(
            cliente,
            resultado,
            "POST",
            f"{API}/comandas/{comanda_id}/cierre",
            headers=headers,
        )
        if cierre is None or cierre.status_code != 200:
            continue

        respuesta, ms = await request(
            cliente,
            resultado,
            "POST",
            f"{API}/facturacion",
            etiqueta=FACTURAS,
            json_body={"comanda_id": comanda_id},
            headers=headers,
            medir=True,
        )
        if ms is not None:
            resultado.tiempos[FACTURAS].append(ms)
        if respuesta is not None and respuesta.status_code == 201:
            resultado.ciclos_completos += 1


async def main(base_url: str = BASE_URL) -> dict:
    resultado = Resultado()
    async with httpx.AsyncClient(base_url=base_url, timeout=20) as cliente:
        contexto = await preparar_escenario(cliente)
        barrera = asyncio.Barrier(VUS)
        await asyncio.gather(
            *(
                ciclo_vu(cliente, barrera, resultado, dni, mesa, contexto)
                for dni, mesa in zip(DNIS, MESAS, strict=True)
            )
        )

    resumen = {
        "base_url": base_url,
        "vus": VUS,
        "ciclos_por_vu": CICLOS_POR_VU,
        "ciclos_completos": resultado.ciclos_completos,
        "mediciones": [resultado.resumen(nombre) for nombre in MEASURED],
        "umbral_p95_ms": UMBRAL_MS,
        "cumple": all(
            (item["p95_ms"] or float("inf")) < UMBRAL_MS
            for item in (resultado.resumen(n) for n in MEASURED)
        )
        and not resultado.errores_http
        and not resultado.errores_bd
        and not resultado.errores_red,
        "errores_http": resultado.errores_http,
        "database_is_locked": resultado.errores_bd,
        "errores_red": resultado.errores_red,
    }
    print(json.dumps(resumen, indent=2, ensure_ascii=False))
    return resumen


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Medición RNF-02")
    parser.add_argument("--base-url", default=BASE_URL)
    args = parser.parse_args()
    asyncio.run(main(args.base_url))
