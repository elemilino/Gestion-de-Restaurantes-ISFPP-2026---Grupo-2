"""Medición real de RNF-01 con Playwright + Chromium y caché deshabilitada.

    cd backend && .venv/bin/python ../tests/performance/medir_rnf01.py

Requiere `playwright` y `playwright install chromium` en el venv del backend.
Mide, para cada vista, el TTFB del `GET` de API y el momento en que el listado
ya está visible en el DOM (tiempo transcurrido desde navigationStart).
"""

from __future__ import annotations

import argparse
import json
import statistics
from playwright.sync_api import sync_playwright

BASE_URL = "http://127.0.0.1:5173"
UMBRAL_MS = 2000.0
REPETICIONES = 5

VISTAS = [
    {
        "nombre": "Carta",
        "ruta": "/carta",
        "endpoint": "GET /api/v1/carta",
        "api_match": "/api/v1/carta",
        "listo": """
            () => [...document.querySelectorAll('h2')]
                .some(el => el.textContent.trim() === 'Pastas')
                ? performance.now() : false
        """,
    },
    {
        "nombre": "Mesas",
        "ruta": "/mesas",
        "endpoint": "GET /api/v1/comandas/tablero-mesas",
        "api_match": "/api/v1/comandas/tablero-mesas",
        "listo": """
            () => document.body.innerText.includes('Capacidad')
                ? performance.now() : false
        """,
    },
    {
        "nombre": "Sectores",
        "ruta": "/configuracion/sectores",
        "endpoint": "GET /api/v1/salon/sectores",
        "api_match": "/api/v1/salon/sectores",
        "listo": """
            () => document.body.innerText.includes('Salón Principal')
                ? performance.now() : false
        """,
    },
]

PERF_JS = """
(match) => {
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const api = performance.getEntriesByType('resource')
        .filter(r => r.name.includes(match))
        .sort((a, b) => b.startTime - a.startTime)[0];
    return {
        ttfb_ms: api ? api.responseStart - api.startTime : null,
        api_total_ms: api ? api.duration : null,
        dom_content_loaded_ms: nav.domContentLoadedEventEnd || null,
        load_ms: nav.loadEventEnd || null,
    };
}
"""


def percentil(valores: list[float], porcentaje: float) -> float:
    ordenados = sorted(valores)
    if len(ordenados) == 1:
        return ordenados[0]
    posicion = (len(ordenados) - 1) * porcentaje / 100
    inferior = int(posicion)
    superior = min(inferior + 1, len(ordenados) - 1)
    fraccion = posicion - inferior
    return ordenados[inferior] + fraccion * (ordenados[superior] - ordenados[inferior])


def main(base_url: str = BASE_URL) -> dict:
    resultados = []
    errores_http = []
    with sync_playwright() as p:
        navegador = p.chromium.launch(headless=True)
        contexto = navegador.new_context(viewport={"width": 1440, "height": 900})
        pagina = contexto.new_page()
        pagina.on(
            "response",
            lambda r: errores_http.append(f"{r.status} {r.url}")
            if r.status >= 400 and "/api/v1/" in r.url
            else None,
        )
        cdp = contexto.new_cdp_session(pagina)
        cdp.send("Network.enable")
        cdp.send("Network.setCacheDisabled", {"cacheDisabled": True})

        pagina.goto(f"{base_url}/login", wait_until="domcontentloaded")
        pagina.get_by_label("Usuario").fill("admin")
        pagina.get_by_label("Contraseña").fill("1234")
        pagina.get_by_role("button", name="Ingresar").click()
        pagina.wait_for_url("**/mesas", timeout=15000)

        for vista in VISTAS:
            renders: list[float] = []
            ttfbs: list[float] = []
            detalles = []
            for _ in range(REPETICIONES):
                pagina.goto(f"{base_url}{vista['ruta']}", wait_until="domcontentloaded")
                # Se descarta la primera como calentamiento para el promedio,
                # pero se conserva para el p95 (ver plantilla §6.1).
                render_ms = pagina.wait_for_function(
                    vista["listo"], timeout=20000
                ).json_value()
                perf = pagina.evaluate(PERF_JS, vista["api_match"])
                renders.append(float(render_ms))
                if perf.get("ttfb_ms") is not None:
                    ttfbs.append(float(perf["ttfb_ms"]))
                detalles.append({"render_ms": round(float(render_ms), 2), **perf})
            resultados.append(
                {
                    "vista": vista["nombre"],
                    "ruta": vista["ruta"],
                    "endpoint": vista["endpoint"],
                    "detalles": detalles,
                    "ttfb_promedio_ms": round(statistics.mean(ttfbs[1:]), 2)
                    if len(ttfbs) > 1
                    else None,
                    "render_promedio_ms": round(statistics.mean(renders[1:]), 2),
                    "p95_render_ms": round(percentil(renders, 95), 2),
                    "cumple": statistics.mean(renders[1:]) < UMBRAL_MS
                    and percentil(renders, 95) < UMBRAL_MS,
                }
            )
        navegador.close()

    salida = {
        "base_url": base_url,
        "repeticiones_por_vista": REPETICIONES,
        "umbral_ms": UMBRAL_MS,
        "cache_deshabilitada": True,
        "resultados": resultados,
        "errores_http": errores_http,
        "cumple": all(r["cumple"] for r in resultados) and not errores_http,
    }
    print(json.dumps(salida, indent=2, ensure_ascii=False))
    return salida


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Medición RNF-01")
    parser.add_argument("--base-url", default=BASE_URL)
    args = parser.parse_args()
    main(args.base_url)
