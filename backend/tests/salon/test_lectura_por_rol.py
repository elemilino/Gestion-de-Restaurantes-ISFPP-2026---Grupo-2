"""Lectura de sectores y mesas para los roles que las necesitan.

La recepcionista arma reservas (HU-11a) y el encargado general filtra el reporte
de ocupación por sector (HU-12d). Solo lectura: el ABM sigue siendo del
administrador, y el mozo usa el tablero de mesas (HU-01a/b ya prueban su 403).
"""

import pytest

from app.core.enums import Rol

URL = "/api/v1/salon"


@pytest.mark.parametrize(
    "rol", [Rol.RECEPCIONISTA, Rol.ENCARGADO_GENERAL, Rol.ADMINISTRADOR]
)
def test_roles_de_lectura_listan_sectores_y_mesas(client, headers, rol):
    h = headers(rol)
    assert client.get(f"{URL}/sectores", headers=h).status_code == 200
    assert client.get(f"{URL}/mesas", headers=h).status_code == 200


def test_solo_el_administrador_crea_sectores(client, headers):
    r = client.post(
        f"{URL}/sectores",
        json={"nombre": "Patio", "descripcion": None},
        headers=headers(Rol.RECEPCIONISTA),
    )
    assert r.status_code == 403
