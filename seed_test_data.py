import sqlite3
import json
from datetime import datetime, timedelta

def seed():
    import os
    db_path = os.getenv('DATABASE_URL', 'sistema_zm.db')
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    tables_to_clear = [
        "abonos_clientes", "creditos_clientes", "abonos_proveedores", "creditos_proveedores",
        "prestamos_repuestos", "historial_ordenes", "ordenes_servicio", "productos",
        "contactos", "ventas", "cotizaciones"
    ]
    for t in tables_to_clear:
        cursor.execute(f"DELETE FROM {t}")
        cursor.execute(f"DELETE FROM sqlite_sequence WHERE name='{t}'")

    # 1. Seed Contactos (Clientes, Proveedores, Ambos)
    contacts = [
        # tipo_contacto, tipo_doc, num_doc, nombre, telf, email, notas, marcas
        ('Cliente', 'DNI', '72049182', 'Daniel Gómez Sánchez', '+51 983 746 123', 'daniel.gomez@gmail.com', 'Cliente de Miraflores. Frecuente.', None),
        ('Ambos', 'RUC', '20109482715', 'Maria Alva Castro', '+51 912 345 678', 'maria.alva@outlook.com', 'Cliente corporativo y provee accesorios de cuero.', 'Accesorios Cuero Premium'),
        ('Cliente', 'Pasaporte', 'P109482', 'John Doe', '+1 415 902 3421', 'johndoe@apple.com', 'Turista.', None),
        ('Proveedor', 'RUC', '20603418529', 'Importadora Mac Parts S.A.C.', '+51 992 837 465', 'carlos@macparts.com', 'Importador repuestos.', 'Pantallas, baterías OEM'),
        ('Proveedor', 'RUC', '20549281530', 'Apple Latin Distributors S.A.', '+51 988 776 554', 'sofia@applelatin.com', 'Equipos nuevos.', 'Equipos nuevos, AirPods'),
    ]
    cursor.executemany(
        """
        INSERT INTO contactos (tipo_contacto, tipo_documento, numero_documento, nombre, telefono, email, notas, catalogo_marcas) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, 
        contacts
    )

    # Resolve IDs in order to insert foreign keys
    cursor.execute("SELECT id, nombre FROM contactos")
    contact_map = {row[1]: row[0] for row in cursor.fetchall()}
    
    id_daniel = contact_map['Daniel Gómez Sánchez']
    id_maria = contact_map['Maria Alva Castro']
    id_john = contact_map['John Doe']
    id_macparts = contact_map['Importadora Mac Parts S.A.C.']

    # 2. Seed Productos
    products = [
        ('AP-IPH15P-128', 'iPhone 15 Pro 128GB Titanium Black', 1, 2, 5, 850.0, 3187.5, 1150.0, 4312.5),
        ('AP-MACM3-256', 'MacBook Air 13" M3 8GB/256GB Silver', 2, 1, 3, 900.0, 3375.0, 1250.0, 4687.5),
        ('AP-IPAD11-128', 'iPad Air 11" M2 128GB Space Gray', 3, 1, 2, 500.0, 1875.0, 699.0, 2621.25),
        ('AP-AIRP2', 'AirPods Pro (2nd Generation) USB-C', 4, 3, 10, 170.0, 637.5, 249.0, 933.75),
        ('GEN-CHG-30W', 'Cargador Carga Rápida 30W compatible Apple', 7, 5, 15, 8.0, 30.0, 25.0, 93.75),
        ('REP-IPH13-SCRN', 'Pantalla Repuesto Original para iPhone 13', 8, 2, 4, 80.0, 300.0, 150.0, 562.5),
    ]
    cursor.executemany(
        """
        INSERT INTO productos (codigo, nombre, categoria_id, stock_minimo, stock_actual, costo_usd, costo_pen, precio_venta_usd, precio_venta_pen)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        products
    )

    cursor.execute("SELECT id, codigo FROM productos")
    product_map = {row[1]: row[0] for row in cursor.fetchall()}
    id_charger = product_map['GEN-CHG-30W']
    id_airpods = product_map['AP-AIRP2']

    # 3. Seed Support Orders
    now = datetime.now()
    orders = [
        (id_daniel, 'iPhone 13', 'IMEI: 359182736451928', 'Raspaduras menores en bordes. Pantalla rota.', 'Pantalla rota por caída.', '1234', 'Reparado', 'Se cambió pantalla original.', 'Técnico Andrés', 80.0, 300.0, 150.0, 562.5, (now - timedelta(days=2)).isoformat(), None),
        (id_maria, 'MacBook Pro 16" M1 Pro', 'S/N: C02FP428Q05D', 'Excelente estado.', 'No enciende. Fallo en placa madre.', 'password', 'En Diagnóstico', 'Revisando componentes de alimentación.', 'Técnico Andrés', 150.0, 562.5, 350.0, 1312.5, (now - timedelta(days=1)).isoformat(), None),
        (id_john, 'iPad Pro 11" 2020', 'S/N: DMPY9281Q5', 'Esquinas golpeadas.', 'Batería se descarga rápido.', '', 'Recibido', 'Reemplazo de batería.', 'Técnico Luis', 40.0, 150.0, 90.0, 337.5, now.isoformat(), None),
    ]
    cursor.executemany(
        """
        INSERT INTO ordenes_servicio (
            contacto_id, equipo_modelo, equipo_serie_imei, estado_estetico, falla_reportada, 
            contrasena, estado, notas_tecnico, tecnico_asignado, costo_estimado_usd, 
            costo_estimado_pen, precio_venta_usd, precio_venta_pen, fecha_registro, fecha_entrega
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        orders
    )

    # Support history logs
    history = [
        (1, None, 'Recibido', 'Equipo ingresado al taller.', (now - timedelta(days=2)).isoformat()),
        (1, 'Recibido', 'En Diagnóstico', 'Iniciando cambio de pantalla.', (now - timedelta(days=1.9)).isoformat()),
        (1, 'En Diagnóstico', 'Reparado', 'Cambio de pantalla completado con éxito.', (now - timedelta(days=1)).isoformat()),
        (2, None, 'Recibido', 'Equipo ingresado al taller.', (now - timedelta(days=1)).isoformat()),
        (2, 'Recibido', 'En Diagnóstico', 'Se procedió al desarme para diagnóstico en placa.', (now - timedelta(hours=5)).isoformat()),
        (3, None, 'Recibido', 'Equipo ingresado al taller.', now.isoformat()),
    ]
    cursor.executemany("INSERT INTO historial_ordenes (orden_id, estado_anterior, estado_nuevo, notas, fecha) VALUES (?, ?, ?, ?, ?)", history)

    # 4. Seed Consignment Loan (From Maria - she is type Ambos!)
    loans = [
        (id_maria, id_charger, 10, 8.0, 30.0, 'Recibido', (now - timedelta(days=3)).isoformat(), 'Activo'),
    ]
    cursor.executemany(
        """
        INSERT INTO prestamos_repuestos (contacto_id, producto_id, cantidad, costo_unitario_usd, costo_unitario_pen, tipo_movimiento, fecha_movimiento, estado_movimiento)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        loans
    )

    # Accounts Payable (Credits with Providers) for the loan
    credits_prov = [
        (id_maria, 80.0, 300.0, 80.0, 300.0, 'Ingreso de repuesto por préstamo intertienda/consignación. Qty: 10.', 'Pendiente')
    ]
    cursor.executemany(
        """
        INSERT INTO creditos_proveedores (contacto_id, monto_total_usd, monto_total_pen, saldo_pendiente_usd, saldo_pendiente_pen, notas, estado)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        credits_prov
    )

    # 5. Seed Sales
    items_json_1 = json.dumps([{
        "producto_id": id_airpods,
        "codigo": "AP-AIRP2",
        "nombre": "AirPods Pro (2nd Generation) USB-C",
        "cantidad": 1,
        "precio_unitario_usd": 249.0,
        "precio_unitario_pen": 933.75,
        "total_usd": 249.0,
        "total_pen": 933.75
    }])
    
    items_json_2 = json.dumps([{
        "producto_id": id_charger,
        "codigo": "GEN-CHG-30W",
        "nombre": "Cargador Carga Rápida 30W compatible Apple",
        "cantidad": 4,
        "precio_unitario_usd": 25.0,
        "precio_unitario_pen": 93.75,
        "total_usd": 100.0,
        "total_pen": 375.0
    }])

    sales = [
        (id_daniel, 'Boleta', 'B001-000001', 933.75, 933.75, 0.0, 0.0, 933.75, 933.75, 'Efectivo', (now - timedelta(days=3)).isoformat(), items_json_1),
        (id_maria, 'Factura', 'F001-000001', 317.80, 317.80, 57.20, 57.20, 375.00, 375.00, 'Crédito', (now - timedelta(days=2)).isoformat(), items_json_2),
    ]
    cursor.executemany(
        """
        INSERT INTO ventas (
            contacto_id, tipo_documento, numero_documento, subtotal_usd, subtotal_pen, 
            igv_usd, igv_pen, total_usd, total_pen, metodo_pago, fecha, items_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        sales
    )

    # Client Credit for the credit sale
    credits_cli = [
        (id_maria, 2, 375.0, 375.0, 375.0, 375.0, 500.0, 1875.0, 'Crédito por venta del documento F001-000001.', 'Pendiente')
    ]
    cursor.executemany(
        """
        INSERT INTO creditos_clientes (
            contacto_id, venta_id, monto_total_usd, monto_total_pen, saldo_pendiente_usd, 
            saldo_pendiente_pen, limite_credito_usd, limite_credito_pen, notas, estado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        credits_cli
    )

    # 6. Seed Cotizaciones
    quote_items = json.dumps([
        {
            "descripcion": "MacBook Air 13 M3 8GB/256GB Silver",
            "cantidad": 1,
            "precio_unitario_usd": 1250.0,
            "precio_unitario_pen": 4687.5,
            "total_usd": 1250.0,
            "total_pen": 4687.5
        }
    ])
    cursor.execute(
        """
        INSERT INTO cotizaciones (cliente_nombre, cliente_documento, fecha, total_usd, total_pen, items_json, estado)
        VALUES ('Gonzalo Torres', '46892716', ?, 1250.0, 4687.5, ?, 'Pendiente')
        """,
        [now.isoformat(), quote_items]
    )

    conn.commit()
    conn.close()
    print("Base de datos sistema_zm.db poblada exitosamente con contactos y deudas cruzadas.")

if __name__ == '__main__':
    seed()
