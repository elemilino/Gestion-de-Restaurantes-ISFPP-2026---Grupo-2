"""Pruebas de HU-04d: stock y disponibilidad (endpoints e interfaz para HU-05)."""

import pytest

from app.core.enums import Rol, TipoProducto
from app.core.exceptions import BusinessRuleError, NotFoundError
from app.models.carta import Producto
from app.modules.carta.service import ProductoService

URL_PRODUCTOS = "/api/v1/carta/productos"


@pytest.fixture
def producto(crear_seccion, crear_producto):
    """Fábrica de un plato en la sección "Postres" con stock y marca opcionales."""
    seccion = crear_seccion("Postres")

    def _crear(stock: int | None = None, disponible: bool = True, **datos):
        return crear_producto(
            datos.pop("nombre", "Flan casero"),
            seccion,
            tipo=TipoProducto.POSTRE,
            stock=stock,
            disponible=disponible,
            **datos,
        )

    return _crear


def test_hu04d_ca1_marcar_no_disponible(client, headers, db, producto):
    flan = producto()
    r = client.patch(
        f"{URL_PRODUCTOS}/{flan.id}/disponibilidad",
        json={"disponible": False},
        headers=headers(),
    )
    assert r.status_code == 200
    assert r.json()["disponible"] is False
    assert r.json()["disponible_efectivo"] is False

    with pytest.raises(BusinessRuleError) as error:
        ProductoService(db).verificar_pedible(flan.id, 1)
    assert error.value.code == "PRODUCTO_NO_DISPONIBLE"
    assert error.value.detail == "Flan casero no está disponible"


def test_hu04d_ca2_volver_a_disponible(client, headers, db, producto):
    flan = producto(disponible=False)
    r = client.patch(
        f"{URL_PRODUCTOS}/{flan.id}/disponibilidad",
        json={"disponible": True},
        headers=headers(),
    )
    assert r.status_code == 200
    assert r.json()["disponible_efectivo"] is True
    assert ProductoService(db).verificar_pedible(flan.id, 1).id == flan.id


def test_hu04d_ca3_descuenta_stock(db, producto):
    flan = producto(stock=10)
    servicio = ProductoService(db)
    servicio.descontar_stock(flan, 2)
    db.commit()
    db.expire_all()
    assert db.get(Producto, flan.id).stock == 8


def test_hu04d_ca3_no_hace_commit(db, producto):
    flan = producto(stock=10)
    ProductoService(db).descontar_stock(flan, 2)
    db.rollback()
    assert db.get(Producto, flan.id).stock == 10


def test_hu04d_ca4_stock_cero_no_se_puede_pedir(client, headers, db, producto):
    flan = producto(stock=0)
    with pytest.raises(BusinessRuleError) as error:
        ProductoService(db).verificar_pedible(flan.id, 1)
    assert error.value.code == "PRODUCTO_SIN_STOCK"
    assert error.value.detail == "No hay stock suficiente de Flan casero (quedan 0)"

    datos = client.get(f"{URL_PRODUCTOS}/{flan.id}", headers=headers()).json()
    assert datos["disponible_efectivo"] is False
    assert datos["disponible"] is True


def test_hu04d_ca4_pedir_mas_que_el_stock(db, producto):
    flan = producto(stock=3)
    with pytest.raises(BusinessRuleError) as error:
        ProductoService(db).verificar_pedible(flan.id, 5)
    assert error.value.code == "PRODUCTO_SIN_STOCK"
    assert "quedan 3" in error.value.detail


def test_hu04d_ca4_descontar_mas_que_el_stock(db, producto):
    flan = producto(stock=1)
    with pytest.raises(BusinessRuleError):
        ProductoService(db).descontar_stock(flan, 2)
    assert flan.stock == 1


def test_hu04d_ca4_reponer_stock_vuelve_a_disponible(client, headers, producto):
    flan = producto(stock=0)
    r = client.patch(
        f"{URL_PRODUCTOS}/{flan.id}/stock", json={"stock": 5}, headers=headers()
    )
    assert r.status_code == 200
    assert r.json()["stock"] == 5
    assert r.json()["disponible_efectivo"] is True


@pytest.mark.parametrize("stock", [-1, 2.5, "abc"])
def test_hu04d_ca5_rechaza_stock_invalido(client, headers, producto, stock):
    flan = producto(stock=4)
    r = client.patch(
        f"{URL_PRODUCTOS}/{flan.id}/stock", json={"stock": stock}, headers=headers()
    )
    assert r.status_code == 422


def test_hu04d_ca5_null_deja_de_controlar(client, headers, producto):
    flan = producto(stock=4)
    r = client.patch(
        f"{URL_PRODUCTOS}/{flan.id}/stock", json={"stock": None}, headers=headers()
    )
    assert r.status_code == 200
    assert r.json()["stock"] is None


def test_hu04d_ca6_sin_control_no_descuenta(db, producto):
    flan = producto(stock=None)
    servicio = ProductoService(db)
    servicio.descontar_stock(flan, 5)
    db.commit()
    assert flan.stock is None
    assert servicio.verificar_pedible(flan.id, 100).id == flan.id


def test_hu04d_reponer_stock(db, producto):
    flan = producto(stock=8)
    ProductoService(db).reponer_stock(flan, 2)
    db.commit()
    db.expire_all()
    assert db.get(Producto, flan.id).stock == 10


def test_hu04d_reponer_sin_control_no_hace_nada(db, producto):
    flan = producto(stock=None)
    ProductoService(db).reponer_stock(flan, 2)
    assert flan.stock is None


def test_hu04d_producto_eliminado_no_es_pedible(client, headers, db, producto):
    flan = producto(activo=False)
    with pytest.raises(NotFoundError) as error:
        ProductoService(db).verificar_pedible(flan.id, 1)
    assert error.value.code == "PRODUCTO_NO_ENCONTRADO"
    r = client.patch(
        f"{URL_PRODUCTOS}/{flan.id}/stock", json={"stock": 3}, headers=headers()
    )
    assert r.status_code == 404
    r = client.patch(
        f"{URL_PRODUCTOS}/999/disponibilidad",
        json={"disponible": True},
        headers=headers(),
    )
    assert r.status_code == 404


def test_hu04d_mozo_no_puede_cambiar_stock(client, headers, producto):
    flan = producto(stock=4)
    r = client.patch(
        f"{URL_PRODUCTOS}/{flan.id}/stock", json={"stock": 1}, headers=headers(Rol.MOZO)
    )
    assert r.status_code == 403
    r = client.patch(
        f"{URL_PRODUCTOS}/{flan.id}/disponibilidad",
        json={"disponible": False},
        headers=headers(Rol.MOZO),
    )
    assert r.status_code == 403
