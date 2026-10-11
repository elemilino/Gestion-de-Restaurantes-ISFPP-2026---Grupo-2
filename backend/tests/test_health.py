def test_health_responde_ok(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_openapi_publica_los_endpoints_de_auth(client):
    tags = {
        tag
        for ruta in client.get("/openapi.json").json()["paths"].values()
        for operacion in ruta.values()
        for tag in operacion.get("tags", [])
    }
    assert "Autenticación" in tags
