import urllib.request
import json
import sys

BASE_URL = "http://localhost:8000"

def send_post(endpoint, payload):
    url = f"{BASE_URL}{endpoint}"
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read().decode('utf-8'))
    except Exception as e:
        print(f"Error on POST {endpoint}: {e}")
        return {"success": False, "error": str(e)}

def send_get(endpoint):
    url = f"{BASE_URL}{endpoint}"
    try:
        with urllib.request.urlopen(url) as res:
            return json.loads(res.read().decode('utf-8'))
    except Exception as e:
        print(f"Error on GET {endpoint}: {e}")
        return None

def test_flow():
    print("=== INICIANDO INTEGRATION TESTS DE API UNIFICADA ZONA MAC ===")

    # 1. Test Contact Registration (type: Cliente)
    print("\n1. Test: Registro de Contacto Cliente...")
    cli_payload = {
        "tipo_contacto": "Cliente",
        "tipo_documento": "DNI",
        "numero_documento": "44556677",
        "nombre": "Test Client API",
        "telefono": "999888777",
        "email": "testclient@api.com",
        "notas": "Notas de test"
    }
    res = send_post("/api/contacts/create", cli_payload)
    print("Respuesta:", res)
    assert res.get("success") == True

    # Find ID of newly created contact
    contacts = send_get("/api/contacts")
    contact_id = [c['id'] for c in contacts if c['numero_documento'] == '44556677'][0]
    print(f"Contacto Cliente Registrado con ID: {contact_id}")

    # 2. Test Contact Registration (type: Proveedor)
    print("\n2. Test: Registro de Contacto Proveedor...")
    prov_payload = {
        "tipo_contacto": "Proveedor",
        "tipo_documento": "RUC",
        "numero_documento": "20601234567",
        "nombre": "Test Proveedor SAC",
        "telefono": "911222333",
        "email": "prov@api.com",
        "catalogo_marcas": "Repuestos Apple"
    }
    res = send_post("/api/contacts/create", prov_payload)
    print("Respuesta:", res)
    assert res.get("success") == True

    provider_id = [p['id'] for p in contacts if p['numero_documento'] == '20601234567']
    if not provider_id:
        # fetch again
        contacts = send_get("/api/contacts")
        provider_id = [p['id'] for p in contacts if p['numero_documento'] == '20601234567'][0]
    else:
        provider_id = provider_id[0]
    print(f"Contacto Proveedor Registrado con ID: {provider_id}")

    # 3. Test Product Registration
    print("\n3. Test: Registro de Producto...")
    prod_payload = {
        "codigo": "TEST-IPH15",
        "nombre": "Test iPhone 15 Pro",
        "categoria_id": 1,
        "stock_actual": 10,
        "stock_minimo": 2,
        "costo_usd": 800.0,
        "costo_pen": 3000.0,
        "precio_venta_usd": 1000.0,
        "precio_venta_pen": 3750.0
    }
    res = send_post("/api/products/create", prod_payload)
    print("Respuesta:", res)
    assert res.get("success") == True

    products = send_get("/api/products")
    product_id = [p['id'] for p in products if p['codigo'] == 'TEST-IPH15'][0]
    print(f"Producto Registrado con ID: {product_id}")

    # 4. Test Support Order
    print("\n4. Test: Registro de Orden de Servicio Técnico...")
    order_payload = {
        "cliente_id": contact_id,
        "equipo_modelo": "iPhone 15 Pro Test",
        "equipo_serie_imei": "IMEI-TEST-9999",
        "falla_reportada": "Pantalla parpadea",
        "precio_venta_usd": 150.0,
        "precio_venta_pen": 562.50
    }
    res = send_post("/api/orders/create", order_payload)
    print("Respuesta:", res)
    assert res.get("success") == True
    order_id = res.get("order_id")

    # 5. Test Loans and Devolution
    print("\n5. Test: Registro de Préstamo/Consignación...")
    loan_payload = {
        "proveedor_id": provider_id,
        "producto_id": product_id,
        "cantidad": 5,
        "costo_unitario_usd": 80.0,
        "costo_unitario_pen": 300.0
    }
    res = send_post("/api/loans/create", loan_payload)
    print("Respuesta:", res)
    assert res.get("success") == True

    # 6. Test POS Sale and IGV Logic (Factura requires 18% IGV)
    print("\n6. Test: Procesar Venta POS con Factura (Cálculo de IGV)...")
    sale_payload = {
        "cliente_id": contact_id,
        "tipo_documento": "Factura",
        "metodo_pago": "Tarjeta",
        "items": [{
            "producto_id": product_id,
            "cantidad": 2,
            "precio_unitario_usd": 1000.0,
            "precio_unitario_pen": 3750.0
        }]
    }
    res = send_post("/api/sales/create", sale_payload)
    print("Respuesta Venta:", res)
    assert res.get("success") == True

    # 7. Test Quotes and Quote to Sale conversion
    print("\n7. Test: Registro de Cotización Comercial...")
    quote_payload = {
        "cliente_nombre": "Carlos Torres Test",
        "total_usd": 1000.0,
        "total_pen": 3750.0,
        "items": [{
            "descripcion": "Test Item Manual",
            "cantidad": 1,
            "precio_unitario_usd": 1000.0,
            "precio_unitario_pen": 3750.0,
            "total_usd": 1000.0,
            "total_pen": 3750.0
        }]
    }
    res = send_post("/api/quotes/create", quote_payload)
    print("Respuesta Cotización:", res)
    assert res.get("success") == True

    # Get quotes
    quotes = send_get("/api/quotes")
    quote_id = [q['id'] for q in quotes if q['cliente_nombre'] == 'Carlos Torres Test'][0]

    print("\n7.1 Test: Convertir Cotización a Venta POS...")
    convert_payload = {
        "cliente_id": contact_id,
        "tipo_documento": "Boleta",
        "metodo_pago": "Efectivo"
    }
    res = send_post(f"/api/quotes/convert?id={quote_id}", convert_payload)
    print("Respuesta Conversión:", res)
    assert res.get("success") == True

    # 8. Test Credit Netting (Neteo de Créditos) for a contact of type 'Ambos'
    print("\n8. Test: Neteo de Créditos Cruzados (Contacto tipo 'Ambos')...")
    # Maria Alva Castro was seeded with a credit receivable of S/ 375.00 and a credit payable of S/ 300.00
    maria_contact = [c for c in contacts if c['nombre'] == 'Maria Alva Castro'][0]
    maria_id = maria_contact['id']
    
    # Query details before netting
    detail_before = send_get(f"/api/contacts/detail?id={maria_id}")
    
    pending_recv_pen = sum(cr['saldo_pendiente_pen'] for cr in detail_before['client_credits'] if cr['estado'] == 'Pendiente')
    pending_pay_pen = sum(cp['saldo_pendiente_pen'] for cp in detail_before['provider_credits'] if cp['estado'] == 'Pendiente')
    print(f"Antes del Neteo - Cuentas por Cobrar: S/ {pending_recv_pen:.2f}, Cuentas por Pagar: S/ {pending_pay_pen:.2f}")

    assert pending_recv_pen > 0
    assert pending_pay_pen > 0

    # Trigger netting
    net_res = send_post(f"/api/contacts/net?id={maria_id}", {})
    print("Respuesta Neteo:", net_res)
    assert net_res.get("success") == True

    # Query details after netting
    detail_after = send_get(f"/api/contacts/detail?id={maria_id}")
    pending_recv_pen_after = sum(cr['saldo_pendiente_pen'] for cr in detail_after['client_credits'] if cr['estado'] == 'Pendiente')
    pending_pay_pen_after = sum(cp['saldo_pendiente_pen'] for cp in detail_after['provider_credits'] if cp['estado'] == 'Pendiente')
    print(f"Después del Neteo - Cuentas por Cobrar: S/ {pending_recv_pen_after:.2f}, Cuentas por Pagar: S/ {pending_pay_pen_after:.2f}")

    # Accounts Payable (S/ 300) should be fully netted to 0, Accounts Receivable should net from S/ 375 to S/ 75
    assert abs(pending_pay_pen_after - 0.0) < 0.01
    assert abs(pending_recv_pen_after - 75.0) < 0.01

    print("\n=== TODOS LOS TESTS SE EJECUTARON SATISFACTORIAMENTE ===")

if __name__ == '__main__':
    test_flow()
