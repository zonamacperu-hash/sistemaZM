import json
from datetime import datetime, timedelta, date

# Helper to get current ISO timestamp
def now_timestamp():
    return datetime.now().isoformat()

# ==========================================
# 1. CONFIGURACIÓN Y TIPO DE CAMBIO
# ==========================================

async def get_config(db):
    rows = await db.query("SELECT clave, valor FROM configuracion")
    return {r['clave']: r['valor'] for r in rows}

async def update_config(db, data):
    for k, v in data.items():
        await db.execute(
            "INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)",
            [k, str(v)]
        )
    return {"success": True, "message": "Configuración actualizada correctamente"}

async def get_exchange_rate(db):
    res = await db.query("SELECT valor FROM configuracion WHERE clave = 'exchange_rate'")
    if res:
        try:
            return float(res[0]['valor'])
        except ValueError:
            return 3.75
    return 3.75

# ==========================================
# 2. DASHBOARD DE CONTROL
# ==========================================

async def get_dashboard_stats(db):
    # Today's sales
    today = datetime.now().strftime('%Y-%m-%d')
    sales_today = await db.query(
        "SELECT SUM(total_usd) as total_usd, SUM(total_pen) as total_pen, COUNT(*) as count FROM ventas WHERE date(fecha) = date(?)",
        [today]
    )
    
    # Month's sales
    current_month = datetime.now().strftime('%Y-%m')
    sales_month = await db.query(
        "SELECT SUM(total_usd) as total_usd, SUM(total_pen) as total_pen, COUNT(*) as count FROM ventas WHERE strftime('%Y-%m', fecha) = ?",
        [current_month]
    )

    # Active support orders (states not 'Entregado' and not 'Sin Reparación')
    active_support = await db.query(
        "SELECT COUNT(*) as count FROM ordenes_servicio WHERE estado NOT IN ('Entregado', 'Sin Reparación')"
    )

    # Accounts receivable (Credits from Clients)
    accounts_receivable = await db.query(
        "SELECT SUM(saldo_pendiente_usd) as usd, SUM(saldo_pendiente_pen) as pen FROM creditos_clientes WHERE estado = 'Pendiente'"
    )

    # Accounts payable (Credits from Providers)
    accounts_payable = await db.query(
        "SELECT SUM(saldo_pendiente_usd) as usd, SUM(saldo_pendiente_pen) as pen FROM creditos_proveedores WHERE estado = 'Pendiente'"
    )

    # Recent sales (last 5)
    recent_sales = await db.query(
        """
        SELECT v.*, c.nombre as cliente_nombre 
        FROM ventas v 
        JOIN contactos c ON v.contacto_id = c.id 
        ORDER BY v.fecha DESC LIMIT 5
        """
    )

    # Recent support orders (last 5)
    recent_support = await db.query(
        """
        SELECT o.*, c.nombre as cliente_nombre 
        FROM ordenes_servicio o 
        JOIN contactos c ON o.contacto_id = c.id 
        ORDER BY o.fecha_registro DESC LIMIT 5
        """
    )

    # Charts data
    # Support by status
    support_status = await db.query(
        "SELECT estado, COUNT(*) as count FROM ordenes_servicio GROUP BY estado"
    )

    # Monthly cash flow (last 6 months sales)
    monthly_flow = await db.query(
        """
        SELECT strftime('%Y-%m', fecha) as mes, SUM(total_pen) as total_pen, SUM(total_usd) as total_usd
        FROM ventas 
        GROUP BY mes 
        ORDER BY mes DESC 
        LIMIT 6
        """
    )

    return {
        "sales_today": {
            "usd": sales_today[0]['total_usd'] or 0.0,
            "pen": sales_today[0]['total_pen'] or 0.0,
            "count": sales_today[0]['count'] or 0
        },
        "sales_month": {
            "usd": sales_month[0]['total_usd'] or 0.0,
            "pen": sales_month[0]['total_pen'] or 0.0,
            "count": sales_month[0]['count'] or 0
        },
        "active_support": active_support[0]['count'] or 0,
        "accounts_receivable": {
            "usd": accounts_receivable[0]['usd'] or 0.0,
            "pen": accounts_receivable[0]['pen'] or 0.0
        },
        "accounts_payable": {
            "usd": accounts_payable[0]['usd'] or 0.0,
            "pen": accounts_payable[0]['pen'] or 0.0
        },
        "recent_sales": recent_sales,
        "recent_support": recent_support,
        "support_status": support_status,
        "monthly_flow": list(reversed(monthly_flow))
    }

# ==========================================
# 3. GESTIÓN UNIFICADA DE CONTACTOS (CLIENTES/PROVEEDORES)
# ==========================================

async def list_contactos(db):
    return await db.query("SELECT * FROM contactos ORDER BY nombre ASC")

async def create_contacto(db, data):
    dup = await db.query("SELECT id FROM contactos WHERE numero_documento = ?", [data.get('numero_documento')])
    if dup:
        return {"success": False, "error": "El número de documento ya se encuentra registrado"}

    await db.execute(
        """
        INSERT INTO contactos (tipo_contacto, tipo_documento, numero_documento, nombre, telefono, email, notas, catalogo_marcas)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            data.get('tipo_contacto'), # 'Cliente', 'Proveedor', 'Ambos'
            data.get('tipo_documento'),
            data.get('numero_documento'),
            data.get('nombre'),
            data.get('telefono'),
            data.get('email'),
            data.get('notas'),
            data.get('catalogo_marcas')
        ]
    )
    return {"success": True, "message": "Contacto registrado correctamente"}

async def update_contacto(db, id, data):
    await db.execute(
        """
        UPDATE contactos 
        SET tipo_contacto = ?, tipo_documento = ?, numero_documento = ?, nombre = ?, 
            telefono = ?, email = ?, notas = ?, catalogo_marcas = ?
        WHERE id = ?
        """,
        [
            data.get('tipo_contacto'),
            data.get('tipo_documento'),
            data.get('numero_documento'),
            data.get('nombre'),
            data.get('telefono'),
            data.get('email'),
            data.get('notas'),
            data.get('catalogo_marcas'),
            id
        ]
    )
    return {"success": True, "message": "Contacto actualizado correctamente"}

async def get_contacto_detail(db, id):
    cont = await db.query("SELECT * FROM contactos WHERE id = ?", [id])
    if not cont:
        return {"success": False, "error": "Contacto no encontrado"}
    
    contacto = cont[0]

    # Purchases (ventas registered under this contact)
    purchases = await db.query(
        "SELECT * FROM ventas WHERE contacto_id = ? ORDER BY fecha DESC", [id]
    )
    
    # Technical Service Orders
    support = await db.query(
        "SELECT * FROM ordenes_servicio WHERE contacto_id = ? ORDER BY fecha_registro DESC", [id]
    )

    # Consignments / Provider Loans
    loans = await db.query(
        """
        SELECT p.*, prod.nombre as producto_nombre 
        FROM prestamos_repuestos p 
        JOIN productos prod ON p.producto_id = prod.id 
        WHERE p.contacto_id = ? 
        ORDER BY p.fecha_movimiento DESC
        """, [id]
    )

    # Accounts Receivable (Client side credit)
    client_credits = await db.query(
        """
        SELECT cc.*, v.tipo_documento, v.numero_documento as venta_documento 
        FROM creditos_clientes cc 
        LEFT JOIN ventas v ON cc.venta_id = v.id 
        WHERE cc.contacto_id = ? 
        ORDER BY cc.id DESC
        """, [id]
    )

    # Accounts Payable (Provider side credit)
    provider_credits = await db.query(
        "SELECT * FROM creditos_proveedores WHERE contacto_id = ? ORDER BY id DESC", [id]
    )

    return {
        "success": True,
        "contacto": contacto,
        "purchases": purchases,
        "support": support,
        "loans": loans,
        "client_credits": client_credits,
        "provider_credits": provider_credits
    }

# ==========================================
# 4. LÓGICA DE NETEO DE CRÉDITOS (NETTING)
# ==========================================

async def net_credits(db, contacto_id):
    # Fetch sum of pending balances
    client_res = await db.query(
        "SELECT SUM(saldo_pendiente_usd) as usd, SUM(saldo_pendiente_pen) as pen FROM creditos_clientes WHERE contacto_id = ? AND estado = 'Pendiente'",
        [contacto_id]
    )
    provider_res = await db.query(
        "SELECT SUM(saldo_pendiente_usd) as usd, SUM(saldo_pendiente_pen) as pen FROM creditos_proveedores WHERE contacto_id = ? AND estado = 'Pendiente'",
        [contacto_id]
    )

    c_pen = client_res[0]['pen'] or 0.0
    c_usd = client_res[0]['usd'] or 0.0
    p_pen = provider_res[0]['pen'] or 0.0
    p_usd = provider_res[0]['usd'] or 0.0

    net_pen = min(c_pen, p_pen)
    net_usd = min(c_usd, p_usd)

    if net_pen <= 0.001 and net_usd <= 0.001:
        return {"success": False, "error": "No se registran saldos pendientes mutuos en soles o dólares para netear."}

    now = now_timestamp()

    # Amortize PEN Credits
    if net_pen > 0.01:
        # Client side PEN amortization
        pending_pen = net_pen
        c_credits = await db.query(
            "SELECT * FROM creditos_clientes WHERE contacto_id = ? AND estado = 'Pendiente' AND saldo_pendiente_pen > 0 ORDER BY id ASC",
            [contacto_id]
        )
        for cred in c_credits:
            if pending_pen <= 0.001:
                break
            to_pay = min(pending_pen, cred['saldo_pendiente_pen'])
            new_bal = cred['saldo_pendiente_pen'] - to_pay
            new_state = 'Pagado' if new_bal <= 0.01 else 'Pendiente'
            
            await db.execute(
                "INSERT INTO abonos_clientes (credito_id, monto_usd, monto_pen, metodo_pago, fecha) VALUES (?, 0, ?, 'Neteo', ?)",
                [cred['id'], to_pay, now]
            )
            await db.execute(
                "UPDATE creditos_clientes SET saldo_pendiente_pen = ?, estado = ? WHERE id = ?",
                [new_bal, new_state, cred['id']]
            )
            pending_pen -= to_pay

        # Provider side PEN amortization
        pending_pen = net_pen
        p_credits = await db.query(
            "SELECT * FROM creditos_proveedores WHERE contacto_id = ? AND estado = 'Pendiente' AND saldo_pendiente_pen > 0 ORDER BY id ASC",
            [contacto_id]
        )
        for cred in p_credits:
            if pending_pen <= 0.001:
                break
            to_pay = min(pending_pen, cred['saldo_pendiente_pen'])
            new_bal = cred['saldo_pendiente_pen'] - to_pay
            new_state = 'Pagado' if new_bal <= 0.01 else 'Pendiente'
            
            await db.execute(
                "INSERT INTO abonos_proveedores (credito_id, monto_usd, monto_pen, metodo_pago, fecha) VALUES (?, 0, ?, 'Neteo', ?)",
                [cred['id'], to_pay, now]
            )
            await db.execute(
                "UPDATE creditos_proveedores SET saldo_pendiente_pen = ?, estado = ? WHERE id = ?",
                [new_bal, new_state, cred['id']]
            )
            pending_pen -= to_pay

    # Amortize USD Credits
    if net_usd > 0.01:
        # Client side USD amortization
        pending_usd = net_usd
        c_credits = await db.query(
            "SELECT * FROM creditos_clientes WHERE contacto_id = ? AND estado = 'Pendiente' AND saldo_pendiente_usd > 0 ORDER BY id ASC",
            [contacto_id]
        )
        for cred in c_credits:
            if pending_usd <= 0.001:
                break
            to_pay = min(pending_usd, cred['saldo_pendiente_usd'])
            new_bal = cred['saldo_pendiente_usd'] - to_pay
            new_state = 'Pagado' if new_bal <= 0.01 else 'Pendiente'
            
            await db.execute(
                "INSERT INTO abonos_clientes (credito_id, monto_usd, monto_pen, metodo_pago, fecha) VALUES (?, ?, 0, 'Neteo', ?)",
                [cred['id'], to_pay, now]
            )
            await db.execute(
                "UPDATE creditos_clientes SET saldo_pendiente_usd = ?, estado = ? WHERE id = ?",
                [new_bal, new_state, cred['id']]
            )
            pending_usd -= to_pay

        # Provider side USD amortization
        pending_usd = net_usd
        p_credits = await db.query(
            "SELECT * FROM creditos_proveedores WHERE contacto_id = ? AND estado = 'Pendiente' AND saldo_pendiente_usd > 0 ORDER BY id ASC",
            [contacto_id]
        )
        for cred in p_credits:
            if pending_usd <= 0.001:
                break
            to_pay = min(pending_usd, cred['saldo_pendiente_usd'])
            new_bal = cred['saldo_pendiente_usd'] - to_pay
            new_state = 'Pagado' if new_bal <= 0.01 else 'Pendiente'
            
            await db.execute(
                "INSERT INTO abonos_proveedores (credito_id, monto_usd, monto_pen, metodo_pago, fecha) VALUES (?, ?, 0, 'Neteo', ?)",
                [cred['id'], to_pay, now]
            )
            await db.execute(
                "UPDATE creditos_proveedores SET saldo_pendiente_usd = ?, estado = ? WHERE id = ?",
                [new_bal, new_state, cred['id']]
            )
            pending_usd -= to_pay

    return {
        "success": True, 
        "message": f"Neteo de créditos procesado con éxito. Se compensaron S/ {net_pen:.2f} y $ {net_usd:.2f} mutuos."
    }

# ==========================================
# 5. INVENTARIO BAJO DEMANDA Y CATÁLOGO
# ==========================================

async def list_categorias(db):
    return await db.query("SELECT * FROM categorias ORDER BY nombre ASC")

async def create_categoria(db, data):
    name = data.get('nombre')
    if not name:
        return {"success": False, "error": "Nombre es obligatorio"}
    try:
        await db.execute("INSERT INTO categorias (nombre) VALUES (?)", [name])
        return {"success": True, "message": "Categoría creada"}
    except Exception:
        return {"success": False, "error": "La categoría ya existe"}

async def list_productos(db):
    return await db.query(
        """
        SELECT p.*, c.nombre as categoria_nombre 
        FROM productos p 
        LEFT JOIN categorias c ON p.categoria_id = c.id 
        ORDER BY p.nombre ASC
        """
    )

async def create_producto(db, data):
    code = data.get('codigo')
    if not code:
        return {"success": False, "error": "El código del producto es obligatorio"}
        
    dup = await db.query("SELECT id FROM productos WHERE codigo = ?", [code])
    if dup:
        return {"success": False, "error": "Ya existe un producto con este código"}

    await db.execute(
        """
        INSERT INTO productos (codigo, nombre, categoria_id, stock_minimo, stock_actual, costo_usd, costo_pen, precio_venta_usd, precio_venta_pen, requiere_serie)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            code,
            data.get('nombre'),
            data.get('categoria_id'),
            data.get('stock_minimo', 0),
            data.get('stock_actual', 0),
            data.get('costo_usd', 0.0),
            data.get('costo_pen', 0.0),
            data.get('precio_venta_usd', 0.0),
            data.get('precio_venta_pen', 0.0),
            data.get('requiere_serie', 0)
        ]
    )
    return {"success": True, "message": "Producto creado correctamente"}

async def update_producto(db, id, data):
    await db.execute(
        """
        UPDATE productos 
        SET codigo = ?, nombre = ?, categoria_id = ?, stock_minimo = ?, stock_actual = ?, 
            costo_usd = ?, costo_pen = ?, precio_venta_usd = ?, precio_venta_pen = ?, requiere_serie = ?
        WHERE id = ?
        """,
        [
            data.get('codigo'),
            data.get('nombre'),
            data.get('categoria_id'),
            data.get('stock_minimo', 0),
            data.get('stock_actual', 0),
            data.get('costo_usd', 0.0),
            data.get('costo_pen', 0.0),
            data.get('precio_venta_usd', 0.0),
            data.get('precio_venta_pen', 0.0),
            data.get('requiere_serie', 0),
            id
        ]
    )
    return {"success": True, "message": "Producto actualizado correctamente"}

async def delete_producto(db, id):
    try:
        await db.execute("DELETE FROM productos WHERE id = ?", [id])
        return {"success": True, "message": "Producto eliminado"}
    except Exception:
        return {"success": False, "error": "No se puede eliminar el producto, puede tener historial asociado."}

# ==========================================
# 6. SERVICIO TÉCNICO
# ==========================================

async def list_ordenes(db):
    return await db.query(
        """
        SELECT o.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono, c.numero_documento as cliente_documento
        FROM ordenes_servicio o 
        JOIN contactos c ON o.contacto_id = c.id 
        ORDER BY o.id DESC
        """
    )

async def create_orden(db, data):
    contacto_id = data.get('cliente_id') or data.get('contacto_id') # handle both key names
    if not contacto_id:
        return {"success": False, "error": "Seleccione un cliente/contacto"}

    now = now_timestamp()
    
    # Save support order
    await db.execute(
        """
        INSERT INTO ordenes_servicio (
            contacto_id, equipo_modelo, equipo_serie_imei, estado_estetico, falla_reportada, 
            contrasena, estado, notas_tecnico, tecnico_asignado, costo_estimado_usd, 
            costo_estimado_pen, precio_venta_usd, precio_venta_pen, fecha_registro
        ) VALUES (?, ?, ?, ?, ?, ?, 'Recibido', ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            contacto_id,
            data.get('equipo_modelo'),
            data.get('equipo_serie_imei'),
            data.get('estado_estetico'),
            data.get('falla_reportada'),
            data.get('contrasena'),
            data.get('notas_tecnico'),
            data.get('tecnico_asignado'),
            data.get('costo_estimado_usd', 0.0),
            data.get('costo_estimado_pen', 0.0),
            data.get('precio_venta_usd', 0.0),
            data.get('precio_venta_pen', 0.0),
            now
        ]
    )

    # Get last inserted id
    last_id_res = await db.query("SELECT last_insert_rowid() as id")
    order_id = last_id_res[0]['id']

    # Insert clinical history log
    await db.execute(
        """
        INSERT INTO historial_ordenes (orden_id, estado_anterior, estado_nuevo, notas, fecha)
        VALUES (?, NULL, 'Recibido', 'Equipo ingresado al sistema.', ?)
        """,
        [order_id, now]
    )

    return {"success": True, "message": "Orden de servicio técnico registrada", "order_id": order_id}

async def update_orden_estado(db, id, data):
    current = await db.query("SELECT estado FROM ordenes_servicio WHERE id = ?", [id])
    if not current:
        return {"success": False, "error": "Orden no encontrada"}
    
    prev_state = current[0]['estado']
    new_state = data.get('estado')
    notas = data.get('notas', '')
    now = now_timestamp()

    # Determine update attributes
    tecnico_asignado = data.get('tecnico_asignado')
    notas_tecnico = data.get('notas_tecnico')
    costo_usd = data.get('costo_estimado_usd')
    costo_pen = data.get('costo_estimado_pen')
    precio_usd = data.get('precio_venta_usd')
    precio_pen = data.get('precio_venta_pen')
    garantia_servicio = data.get('garantia_servicio')
    
    fecha_entrega_clause = ""
    params = [new_state]
    
    if tecnico_asignado is not None:
        fecha_entrega_clause += ", tecnico_asignado = ?"
        params.append(tecnico_asignado)
    if notas_tecnico is not None:
        fecha_entrega_clause += ", notas_tecnico = ?"
        params.append(notas_tecnico)
    if costo_usd is not None:
        fecha_entrega_clause += ", costo_estimado_usd = ?"
        params.append(costo_usd)
    if costo_pen is not None:
        fecha_entrega_clause += ", costo_estimado_pen = ?"
        params.append(costo_pen)
    if precio_usd is not None:
        fecha_entrega_clause += ", precio_venta_usd = ?"
        params.append(precio_usd)
    if precio_pen is not None:
        fecha_entrega_clause += ", precio_venta_pen = ?"
        params.append(precio_pen)
    if garantia_servicio is not None:
        fecha_entrega_clause += ", garantia_servicio = ?"
        params.append(garantia_servicio)

    if new_state == 'Entregado':
        fecha_entrega_clause += ", fecha_entrega = ?"
        params.append(now)

    params.append(id)

    # Perform update
    await db.execute(
        f"UPDATE ordenes_servicio SET estado = ? {fecha_entrega_clause} WHERE id = ?",
        params
    )

    # Record history log
    await db.execute(
        """
        INSERT INTO historial_ordenes (orden_id, estado_anterior, estado_nuevo, notas, fecha)
        VALUES (?, ?, ?, ?, ?)
        """,
        [id, prev_state, new_state, notas or f"Cambio de estado a {new_state}.", now]
    )

    return {"success": True, "message": "Estado de la orden actualizado correctamente"}

async def get_orden_detail(db, id):
    order = await db.query(
        """
        SELECT o.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono, 
               c.email as cliente_email, c.tipo_documento as cliente_tipo_documento, c.numero_documento as cliente_documento
        FROM ordenes_servicio o 
        JOIN contactos c ON o.contacto_id = c.id 
        WHERE o.id = ?
        """, [id]
    )
    if not order:
        return {"success": False, "error": "Orden de servicio no encontrada"}

    history = await db.query(
        "SELECT * FROM historial_ordenes WHERE orden_id = ? ORDER BY fecha DESC", [id]
    )

    return {
        "success": True,
        "order": order[0],
        "history": history
    }

# ==========================================
# 7. PRÉSTAMOS INTERTIENDA Y GESTIÓN DE REPUESTOS
# ==========================================

async def list_prestamos(db):
    return await db.query(
        """
        SELECT p.*, prov.nombre as proveedor_nombre, prod.nombre as producto_nombre, prod.codigo as producto_codigo
        FROM prestamos_repuestos p 
        JOIN contactos prov ON p.contacto_id = prov.id 
        JOIN productos prod ON p.producto_id = prod.id 
        ORDER BY p.fecha_movimiento DESC
        """
    )

async def create_prestamo(db, data):
    contacto_id = data.get('proveedor_id') or data.get('contacto_id')
    prod_id = data.get('producto_id')
    qty = int(data.get('cantidad', 0))
    costo_usd = float(data.get('costo_unitario_usd', 0.0))
    costo_pen = float(data.get('costo_unitario_pen', 0.0))
    
    if qty <= 0:
        return {"success": False, "error": "Cantidad debe ser mayor a cero"}

    now = now_timestamp()
    
    # 1. Register Loan Transaction
    await db.execute(
        """
        INSERT INTO prestamos_repuestos (contacto_id, producto_id, cantidad, costo_unitario_usd, costo_unitario_pen, tipo_movimiento, fecha_movimiento, estado_movimiento)
        VALUES (?, ?, ?, ?, ?, 'Recibido', ?, 'Activo')
        """,
        [contacto_id, prod_id, qty, costo_usd, costo_pen, now]
    )

    # 2. Update Product Stock
    await db.execute(
        "UPDATE productos SET stock_actual = stock_actual + ? WHERE id = ?",
        [qty, prod_id]
    )

    # 3. Add to Provider Credit (Accounts Payable)
    total_usd = costo_usd * qty
    total_pen = costo_pen * qty
    await db.execute(
        """
        INSERT INTO creditos_proveedores (contacto_id, monto_total_usd, monto_total_pen, saldo_pendiente_usd, saldo_pendiente_pen, notas, estado)
        VALUES (?, ?, ?, ?, ?, ?, 'Pendiente')
        """,
        [
            contacto_id,
            total_usd,
            total_pen,
            total_usd,
            total_pen,
            f"Ingreso de repuesto por préstamo intertienda/consignación. Qty: {qty}."
        ]
    )

    return {"success": True, "message": "Préstamo registrado. Stock incrementado y cuenta por pagar generada."}

async def devolver_prestamo(db, prestamo_id):
    prestamo_res = await db.query(
        "SELECT * FROM prestamos_repuestos WHERE id = ?", [prestamo_id]
    )
    if not prestamo_res:
        return {"success": False, "error": "Préstamo no encontrado"}
    
    prestamo = prestamo_res[0]
    if prestamo['estado_movimiento'] == 'Devuelto':
        return {"success": False, "error": "Este préstamo ya ha sido devuelto anteriormente"}

    prod_id = prestamo['producto_id']
    qty = prestamo['cantidad']
    contacto_id = prestamo['contacto_id']
    
    # Check if stock permits return
    prod_res = await db.query("SELECT stock_actual, nombre FROM productos WHERE id = ?", [prod_id])
    if not prod_res or prod_res[0]['stock_actual'] < qty:
        return {
            "success": False, 
            "error": f"Stock insuficiente del producto '{prod_res[0]['nombre']}' para realizar la devolución (Stock actual: {prod_res[0]['stock_actual']}, Requiere: {qty})"
        }

    now = now_timestamp()

    # 1. Update Loan status to Devuelto
    await db.execute(
        "UPDATE prestamos_repuestos SET estado_movimiento = 'Devuelto' WHERE id = ?",
        [prestamo_id]
    )

    # 2. Subtract stock
    await db.execute(
        "UPDATE productos SET stock_actual = stock_actual - ? WHERE id = ?",
        [qty, prod_id]
    )

    # 3. Log a reverse movement in prestamos
    await db.execute(
        """
        INSERT INTO prestamos_repuestos (contacto_id, producto_id, cantidad, costo_unitario_usd, costo_unitario_pen, tipo_movimiento, fecha_movimiento, estado_movimiento)
        VALUES (?, ?, ?, ?, ?, 'Devuelto', ?, 'Activo')
        """,
        [
            contacto_id,
            prod_id,
            qty,
            prestamo['costo_unitario_usd'],
            prestamo['costo_unitario_pen'],
            now
        ]
    )

    # 4. Void accounts payable credit record with provider
    total_usd = prestamo['costo_unitario_usd'] * qty
    
    # Look for matching unpaid credits for this provider
    match_credit = await db.query(
        """
        SELECT id FROM creditos_proveedores 
        WHERE contacto_id = ? AND estado = 'Pendiente' AND ABS(monto_total_usd - ?) < 0.01 
        ORDER BY id DESC LIMIT 1
        """,
        [contacto_id, total_usd]
    )
    
    if match_credit:
        credit_id = match_credit[0]['id']
        await db.execute(
            "UPDATE creditos_proveedores SET saldo_pendiente_usd = 0, saldo_pendiente_pen = 0, estado = 'Anulado', notas = notas || ' (Anulado por devolución de equipo)' WHERE id = ?",
            [credit_id]
        )
    else:
        # If no exact match found, insert a negative credit adjust
        await db.execute(
            """
            INSERT INTO creditos_proveedores (contacto_id, monto_total_usd, monto_total_pen, saldo_pendiente_usd, saldo_pendiente_pen, notas, estado)
            VALUES (?, ?, ?, 0, 0, ?, 'Pagado')
            """,
            [contacto_id, -total_usd, -total_usd * 3.75, f"Ajuste contable negativo por devolución de repuesto de ID préstamo: {prestamo_id}"]
        )

    return {"success": True, "message": "Devolución registrada exitosamente. Inventario y contabilidad saneados."}

# ==========================================
# 8. CUENTAS, CRÉDITOS Y FINANCIAMIENTO
# ==========================================

async def list_creditos_clientes(db):
    return await db.query(
        """
        SELECT cc.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono, v.tipo_documento, v.numero_documento as venta_documento
        FROM creditos_clientes cc
        JOIN contactos c ON cc.contacto_id = c.id
        LEFT JOIN ventas v ON cc.venta_id = v.id
        ORDER BY cc.id DESC
        """
    )

async def add_abono_cliente(db, credito_id, data):
    monto_usd = float(data.get('monto_usd', 0.0))
    monto_pen = float(data.get('monto_pen', 0.0))
    metodo = data.get('metodo_pago', 'Efectivo')
    now = now_timestamp()

    cred = await db.query("SELECT * FROM creditos_clientes WHERE id = ?", [credito_id])
    if not cred:
        return {"success": False, "error": "Crédito no encontrado"}

    credito = cred[0]
    new_usd_pending = max(0.0, credito['saldo_pendiente_usd'] - monto_usd)
    new_pen_pending = max(0.0, credito['saldo_pendiente_pen'] - monto_pen)
    
    estado = 'Pendiente'
    if new_usd_pending <= 0.001 and new_pen_pending <= 0.001:
        estado = 'Pagado'

    # Save payment
    await db.execute(
        """
        INSERT INTO abonos_clientes (credito_id, monto_usd, monto_pen, metodo_pago, fecha)
        VALUES (?, ?, ?, ?, ?)
        """,
        [credito_id, monto_usd, monto_pen, metodo, now]
    )

    # Update balance
    await db.execute(
        "UPDATE creditos_clientes SET saldo_pendiente_usd = ?, saldo_pendiente_pen = ?, estado = ? WHERE id = ?",
        [new_usd_pending, new_pen_pending, estado, credito_id]
    )

    return {"success": True, "message": "Abono registrado correctamente"}

async def list_creditos_proveedores(db):
    return await db.query(
        """
        SELECT cp.*, p.nombre as proveedor_nombre, p.telefono as proveedor_telefono
        FROM creditos_proveedores cp
        JOIN contactos p ON cp.contacto_id = p.id
        ORDER BY cp.id DESC
        """
    )

async def add_abono_proveedor(db, credito_id, data):
    monto_usd = float(data.get('monto_usd', 0.0))
    monto_pen = float(data.get('monto_pen', 0.0))
    metodo = data.get('metodo_pago', 'Efectivo')
    now = now_timestamp()

    cred = await db.query("SELECT * FROM creditos_proveedores WHERE id = ?", [credito_id])
    if not cred:
        return {"success": False, "error": "Cuenta por pagar no encontrada"}

    credito = cred[0]
    new_usd_pending = max(0.0, credito['saldo_pendiente_usd'] - monto_usd)
    new_pen_pending = max(0.0, credito['saldo_pendiente_pen'] - monto_pen)

    estado = 'Pendiente'
    if new_usd_pending <= 0.001 and new_pen_pending <= 0.001:
        estado = 'Pagado'

    # Save payment
    await db.execute(
        """
        INSERT INTO abonos_proveedores (credito_id, monto_usd, monto_pen, metodo_pago, fecha)
        VALUES (?, ?, ?, ?, ?)
        """,
        [credito_id, monto_usd, monto_pen, metodo, now]
    )

    # Update balance
    await db.execute(
        "UPDATE credited_providers_dummy_fix: UPDATE creditos_proveedores SET saldo_pendiente_usd = ?, saldo_pendiente_pen = ?, estado = ? WHERE id = ?",
        [new_usd_pending, new_pen_pending, estado, credito_id]
    )

    # Note: Clean SQL for providers update
    await db.execute(
        "UPDATE creditos_proveedores SET saldo_pendiente_usd = ?, saldo_pendiente_pen = ?, estado = ? WHERE id = ?",
        [new_usd_pending, new_pen_pending, estado, credito_id]
    )

    return {"success": True, "message": "Abono registrado correctamente"}

# ==========================================
# 9. MÓDULO DE COTIZACIONES
# ==========================================

async def list_cotizaciones(db):
    return await db.query("SELECT * FROM cotizaciones ORDER BY id DESC")

async def create_cotizacion(db, data):
    cliente_nombre = data.get('cliente_nombre')
    if not cliente_nombre:
        return {"success": False, "error": "Nombre de cliente es requerido"}
    
    items = data.get('items', [])
    if not items:
        return {"success": False, "error": "La cotización debe tener al menos un ítem"}

    total_usd = float(data.get('total_usd', 0.0))
    total_pen = float(data.get('total_pen', 0.0))
    now = now_timestamp()

    await db.execute(
        """
        INSERT INTO cotizaciones (cliente_nombre, cliente_documento, fecha, total_usd, total_pen, items_json, estado)
        VALUES (?, ?, ?, ?, ?, ?, 'Pendiente')
        """,
        [
            cliente_nombre,
            data.get('cliente_documento', ''),
            now,
            total_usd,
            total_pen,
            json.dumps(items),
        ]
    )
    return {"success": True, "message": "Cotización creada con éxito"}

async def get_cotizacion(db, id):
    res = await db.query("SELECT * FROM cotizaciones WHERE id = ?", [id])
    if not res:
        return {"success": False, "error": "Cotización no encontrada"}
    
    cot = res[0]
    try:
        cot['items'] = json.loads(cot['items_json'])
    except Exception:
        cot['items'] = []
        
    return {"success": True, "cotizacion": cot}

# ==========================================
# 10. PUNTO DE VENTA (POS) Y FACTURACIÓN
# ==========================================

async def list_ventas(db):
    return await db.query(
        """
        SELECT v.*, c.nombre as cliente_nombre, c.numero_documento as cliente_documento 
        FROM ventas v 
        JOIN contactos c ON v.contacto_id = c.id 
        ORDER BY v.id DESC
        """
    )

async def create_venta(db, data):
    contacto_id = data.get('cliente_id') or data.get('contacto_id')
    tipo_doc = data.get('tipo_documento', 'Nota de Venta')
    metodo_pago = data.get('metodo_pago', 'Efectivo')
    items = data.get('items', [])
    
    if not contacto_id:
        return {"success": False, "error": "Cliente/Contacto requerido"}
    if not items:
        return {"success": False, "error": "Debe agregar productos al carrito"}

    # Fetch client to verify
    cli = await db.query("SELECT nombre, numero_documento FROM contactos WHERE id = ?", [contacto_id])
    if not cli:
        return {"success": False, "error": "Contacto no registrado"}

    # Generate document series/number
    prefix = 'NV01'
    if tipo_doc == 'Factura':
        prefix = 'F001'
    elif tipo_doc == 'Boleta':
        prefix = 'B001'
    elif tipo_doc == 'Recibo por Honorarios':
        prefix = 'R001'

    count_res = await db.query("SELECT COUNT(*) as count FROM ventas WHERE tipo_documento = ?", [tipo_doc])
    doc_number = f"{prefix}-{str(count_res[0]['count'] + 1).zfill(8)}"

    total_usd = 0.0
    total_pen = 0.0
    
    processed_items = []
    for item in items:
        prod_id = item.get('producto_id')
        qty = int(item.get('cantidad', 1))
        
        prod_res = await db.query("SELECT * FROM productos WHERE id = ?", [prod_id])
        if not prod_res:
            return {"success": False, "error": f"Producto con ID {prod_id} no existe"}
        
        prod = prod_res[0]
        if prod['stock_actual'] < qty:
            return {"success": False, "error": f"Stock insuficiente para {prod['nombre']} (Disponibles: {prod['stock_actual']}, Requerido: {qty})"}

        # Subtract stock
        await db.execute("UPDATE productos SET stock_actual = stock_actual - ? WHERE id = ?", [qty, prod_id])

        p_usd = float(item.get('precio_unitario_usd', prod['precio_venta_usd']))
        p_pen = float(item.get('precio_unitario_pen', prod['precio_venta_pen']))
        garantia = item.get('garantia', 'Sin garantía')
        
        # Manejo de números de serie para la venta
        item_series = item.get('series') or []
        if isinstance(item_series, str):
            item_series = [s.strip() for s in item_series.split(',') if s.strip()]
            
        if prod.get('requiere_serie') == 1:
            if not item_series or len(item_series) != qty:
                return {"success": False, "error": f"Debe seleccionar exactamente {qty} número(s) de serie para {prod['nombre']}"}
            
            existing_series_json = prod.get('series_disponibles') or '[]'
            try:
                existing_series = json.loads(existing_series_json)
            except Exception:
                existing_series = []
                
            for s in item_series:
                if s not in existing_series:
                    return {"success": False, "error": f"El número de serie '{s}' no está disponible para el producto {prod['nombre']}"}
            
            # Remover de series disponibles
            for s in item_series:
                existing_series.remove(s)
                
            await db.execute("UPDATE productos SET series_disponibles = ? WHERE id = ?", [json.dumps(existing_series), prod_id])
        
        item_total_usd = p_usd * qty
        item_total_pen = p_pen * qty

        total_usd += item_total_usd
        total_pen += item_total_pen

        processed_items.append({
            "producto_id": prod_id,
            "codigo": prod['codigo'],
            "nombre": prod['nombre'],
            "cantidad": qty,
            "precio_unitario_usd": p_usd,
            "precio_unitario_pen": p_pen,
            "total_usd": item_total_usd,
            "total_pen": item_total_pen,
            "garantia": garantia,
            "series": item_series if prod.get('requiere_serie') == 1 else []
        })

    # IGV calculations
    subtotal_usd = total_usd
    subtotal_pen = total_pen
    igv_usd = 0.0
    igv_pen = 0.0

    if tipo_doc == 'Factura':
        subtotal_usd = round(total_usd / 1.18, 2)
        subtotal_pen = round(total_pen / 1.18, 2)
        igv_usd = round(total_usd - subtotal_usd, 2)
        igv_pen = round(total_pen - subtotal_pen, 2)

    now = now_timestamp()

    # Save Sale Record
    await db.execute(
        """
        INSERT INTO ventas (
            contacto_id, tipo_documento, numero_documento, subtotal_usd, subtotal_pen, 
            igv_usd, igv_pen, total_usd, total_pen, metodo_pago, fecha, items_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            contacto_id,
            tipo_doc,
            doc_number,
            subtotal_usd,
            subtotal_pen,
            igv_usd,
            igv_pen,
            total_usd,
            total_pen,
            metodo_pago,
            now,
            json.dumps(processed_items)
        ]
    )

    # Get sale id
    sale_id_res = await db.query("SELECT last_insert_rowid() as id")
    sale_id = sale_id_res[0]['id']

    # Handle Credit
    if metodo_pago == 'Crédito':
        limite_usd = float(data.get('limite_credito_usd', 0.0))
        limite_pen = float(data.get('limite_credito_pen', 0.0))
        await db.execute(
            """
            INSERT INTO creditos_clientes (
                contacto_id, venta_id, monto_total_usd, monto_total_pen, saldo_pendiente_usd, 
                saldo_pendiente_pen, limite_credito_usd, limite_credito_pen, notas, estado
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente')
            """,
            [
                contacto_id,
                sale_id,
                total_usd,
                total_pen,
                total_usd,
                total_pen,
                limite_usd,
                limite_pen,
                f"Crédito por venta del documento {doc_number}."
            ]
        )

    # PSE structures
    pse_payload = {
        "cabecera": {
            "tipDocUsuario": "6" if tipo_doc == 'Factura' else "1",
            "numDocUsuario": cli[0]['numero_documento'],
            "nomUsuario": cli[0]['nombre'],
            "tipDocEmisor": "6",
            "numDocEmisor": "20608754129",
            "nomEmisor": "ZONA MAC PERU S.A.C.",
            "tipComp": "01" if tipo_doc == 'Factura' else "03" if tipo_doc == 'Boleta' else "00",
            "numSerie": prefix,
            "numCorrelativo": doc_number.split('-')[1],
            "fecEmision": now.split('T')[0],
            "moneda": "PEN",
            "montoSubtotal": subtotal_pen,
            "montoIgv": igv_pen,
            "montoTotal": total_pen
        },
        "detalles": [
            {
                "codItem": it['codigo'],
                "desItem": it['nombre'],
                "mtoValorUnitario": round(it['precio_unitario_pen'] / 1.18, 2) if tipo_doc == 'Factura' else it['precio_unitario_pen'],
                "mtoIgvItem": round(it['total_pen'] - (it['total_pen'] / 1.18), 2) if tipo_doc == 'Factura' else 0.0,
                "mtoPrecioVentaItem": it['precio_unitario_pen'],
                "mtoValorVentaItem": round(it['total_pen'] / 1.18, 2) if tipo_doc == 'Factura' else it['total_pen'],
                "cantItem": it['cantidad']
            } for it in processed_items
        ]
    }

    return {
        "success": True, 
        "message": "Venta procesada exitosamente", 
        "documento": doc_number,
        "venta_id": sale_id,
        "pse_payload": pse_payload
    }

async def convert_cotizacion_to_venta(db, cot_id, data):
    cot_res = await db.query("SELECT * FROM cotizaciones WHERE id = ?", [cot_id])
    if not cot_res:
        return {"success": False, "error": "Cotización no encontrada"}
    
    cot = cot_res[0]
    if cot['estado'] == 'Aceptada':
        return {"success": False, "error": "Esta cotización ya fue convertida a venta"}

    contacto_id = data.get('cliente_id') or data.get('contacto_id')
    metodo_pago = data.get('metodo_pago', 'Efectivo')
    tipo_doc = data.get('tipo_documento', 'Nota de Venta')

    if not contacto_id:
        return {"success": False, "error": "Debe asociar un contacto real para registrar la venta"}

    items = json.loads(cot['items_json'])
    
    resolved_items = []
    for item in items:
        prod_id = item.get('producto_id')
        code = item.get('codigo')
        
        if prod_id:
            p_res = await db.query("SELECT id FROM productos WHERE id = ?", [prod_id])
        elif code:
            p_res = await db.query("SELECT id FROM productos WHERE codigo = ?", [code])
        else:
            p_res = None
            
        if not p_res:
            gen_res = await db.query("SELECT id FROM productos WHERE codigo = 'GENERIC'")
            if not gen_res:
                await db.execute(
                    """
                    INSERT INTO productos (codigo, nombre, categoria_id, stock_minimo, stock_actual, costo_usd, costo_pen, precio_venta_usd, precio_venta_pen)
                    VALUES ('GENERIC', 'Producto Genérico', 1, 0, 9999, 0.0, 0.0, 0.0, 0.0)
                    """
                )
                gen_id_res = await db.query("SELECT last_insert_rowid() as id")
                p_id = gen_id_res[0]['id']
            else:
                p_id = gen_res[0]['id']
        else:
            p_id = p_res[0]['id']

        resolved_items.append({
            "producto_id": p_id,
            "cantidad": int(item.get('cantidad', 1)),
            "precio_unitario_usd": float(item.get('precio_unitario_usd', 0.0) or item.get('precio', 0.0)),
            "precio_unitario_pen": float(item.get('precio_unitario_pen', 0.0) or (float(item.get('precio', 0.0)) * 3.75))
        })

    sale_data = {
        "contacto_id": contacto_id,
        "tipo_documento": tipo_doc,
        "metodo_pago": metodo_pago,
        "items": resolved_items,
        "limite_credito_usd": data.get('limite_credito_usd', 0.0),
        "limite_credito_pen": data.get('limite_credito_pen', 0.0)
    }

    res = await create_venta(db, sale_data)
    if res['success']:
        await db.execute("UPDATE cotizaciones SET estado = 'Aceptada' WHERE id = ?", [cot_id])
    
    return res

# ==========================================
# 11. GESTIÓN DE COMPRAS A PROVEEDORES
# ==========================================

async def list_compras(db):
    return await db.query(
        """
        SELECT cp.*, c.nombre as proveedor_nombre, c.numero_documento as proveedor_documento 
        FROM compras cp 
        JOIN contactos c ON cp.contacto_id = c.id 
        ORDER BY cp.id DESC
        """
    )

async def create_compra(db, data):
    contacto_id = data.get('proveedor_id') or data.get('contacto_id')
    tipo_doc = data.get('tipo_documento', 'Nota de Venta')
    metodo_pago = data.get('metodo_pago', 'Efectivo')
    items = data.get('items', [])
    fecha = data.get('fecha') or now_timestamp()
    
    if not contacto_id:
        return {"success": False, "error": "Proveedor/Contacto requerido"}
    if not items:
        return {"success": False, "error": "Debe agregar productos a la compra"}

    # Fetch provider
    prov = await db.query("SELECT nombre, numero_documento FROM contactos WHERE id = ?", [contacto_id])
    if not prov:
        return {"success": False, "error": "Proveedor no registrado"}

    # Use specified document number or generate one
    doc_number = data.get('numero_documento')
    if not doc_number:
        prefix = 'FC01' if tipo_doc == 'Factura' else 'BC01' if tipo_doc == 'Boleta' else 'NC01'
        count_res = await db.query("SELECT COUNT(*) as count FROM compras WHERE tipo_documento = ?", [tipo_doc])
        doc_number = f"{prefix}-{str(count_res[0]['count'] + 1).zfill(8)}"

    total_usd = 0.0
    total_pen = 0.0
    processed_items = []
    
    for item in items:
        prod_id = item.get('producto_id')
        qty = int(item.get('cantidad', 1))
        
        prod_res = await db.query("SELECT * FROM productos WHERE id = ?", [prod_id])
        if not prod_res:
            return {"success": False, "error": f"Producto con ID {prod_id} no existe"}
        prod = prod_res[0]
        
        # Incrementar stock
        await db.execute("UPDATE productos SET stock_actual = stock_actual + ? WHERE id = ?", [qty, prod_id])
        
        p_usd = float(item.get('precio_unitario_usd', prod['costo_usd'] or 0.0))
        p_pen = float(item.get('precio_unitario_pen', prod['costo_pen'] or 0.0))
        garantia = item.get('garantia', 'Sin garantía')
        
        # Manejo de números de serie
        item_series = item.get('series') or []
        if isinstance(item_series, str):
            item_series = [s.strip() for s in item_series.split(',') if s.strip()]
            
        if prod.get('requiere_serie') == 1:
            if not item_series or len(item_series) != qty:
                return {"success": False, "error": f"El producto {prod['nombre']} requiere exactamente {qty} número(s) de serie"}
                
            existing_series_json = prod.get('series_disponibles') or '[]'
            try:
                existing_series = json.loads(existing_series_json)
            except Exception:
                existing_series = []
                
            for s in item_series:
                if s in existing_series:
                    return {"success": False, "error": f"El número de serie '{s}' ya existe en el inventario para el producto {prod['nombre']}"}
            
            existing_series.extend(item_series)
            await db.execute("UPDATE productos SET series_disponibles = ? WHERE id = ?", [json.dumps(existing_series), prod_id])
        
        item_total_usd = p_usd * qty
        item_total_pen = p_pen * qty
        total_usd += item_total_usd
        total_pen += item_total_pen
        
        processed_items.append({
            "producto_id": prod_id,
            "codigo": prod['codigo'],
            "nombre": prod['nombre'],
            "cantidad": qty,
            "precio_unitario_usd": p_usd,
            "precio_unitario_pen": p_pen,
            "total_usd": item_total_usd,
            "total_pen": item_total_pen,
            "garantia": garantia,
            "series": item_series if prod.get('requiere_serie') == 1 else []
        })

    # IGV calculations
    subtotal_usd = total_usd
    subtotal_pen = total_pen
    igv_usd = 0.0
    igv_pen = 0.0
    
    if tipo_doc == 'Factura':
        subtotal_usd = round(total_usd / 1.18, 2)
        subtotal_pen = round(total_pen / 1.18, 2)
        igv_usd = round(total_usd - subtotal_usd, 2)
        igv_pen = round(total_pen - subtotal_pen, 2)

    # If method is Credit, register a provider debt
    if metodo_pago == 'Crédito':
        await db.execute(
            """
            INSERT INTO creditos_proveedores (contacto_id, monto_total_usd, monto_total_pen, saldo_pendiente_usd, saldo_pendiente_pen, notas, estado)
            VALUES (?, ?, ?, ?, ?, ?, 'Pendiente')
            """,
            [contacto_id, total_usd, total_pen, total_usd, total_pen, f"Compra a crédito {doc_number}"]
        )

    # Save Purchase
    await db.execute(
        """
        INSERT INTO compras (
            contacto_id, tipo_documento, numero_documento, subtotal_usd, subtotal_pen, 
            igv_usd, igv_pen, total_usd, total_pen, metodo_pago, fecha, items_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            contacto_id,
            tipo_doc,
            doc_number,
            subtotal_usd,
            subtotal_pen,
            igv_usd,
            igv_pen,
            total_usd,
            total_pen,
            metodo_pago,
            fecha,
            json.dumps(processed_items)
        ]
    )
    
    # Get last insert id
    return {"success": True, "message": "Compra registrada exitosamente", "compra_id": compra_id, "documento": doc_number}


# ==========================================
# 12. MÓDULO DE REPORTES Y AUDITORÍA
# ==========================================

async def calcular_reporte(db, start_date, end_date):
    # 1. Ventas
    ventas_res = await db.query(
        "SELECT SUM(total_pen) as pen, SUM(total_usd) as usd FROM ventas WHERE date(fecha) >= date(?) AND date(fecha) <= date(?)",
        [start_date, end_date]
    )
    v_pen = ventas_res[0]['pen'] or 0.0
    v_usd = ventas_res[0]['usd'] or 0.0

    # 2. Soporte Técnico - Ingresos (precio_venta de ordenes entregadas)
    soporte_ing_res = await db.query(
        "SELECT SUM(precio_venta_pen) as pen, SUM(precio_venta_usd) as usd FROM ordenes_servicio WHERE estado = 'Entregado' AND date(fecha_entrega) >= date(?) AND date(fecha_entrega) <= date(?)",
        [start_date, end_date]
    )
    s_ing_pen = soporte_ing_res[0]['pen'] or 0.0
    s_ing_usd = soporte_ing_res[0]['usd'] or 0.0

    # 3. Compras
    compras_res = await db.query(
        "SELECT SUM(total_pen) as pen, SUM(total_usd) as usd FROM compras WHERE date(fecha) >= date(?) AND date(fecha) <= date(?)",
        [start_date, end_date]
    )
    c_pen = compras_res[0]['pen'] or 0.0
    c_usd = compras_res[0]['usd'] or 0.0

    # 4. Soporte Técnico - Egresos (costo_estimado de ordenes entregadas)
    soporte_egr_res = await db.query(
        "SELECT SUM(costo_estimado_pen) as pen, SUM(costo_estimado_usd) as usd FROM ordenes_servicio WHERE estado = 'Entregado' AND date(fecha_entrega) >= date(?) AND date(fecha_entrega) <= date(?)",
        [start_date, end_date]
    )
    s_egr_pen = soporte_egr_res[0]['pen'] or 0.0
    s_egr_usd = soporte_egr_res[0]['usd'] or 0.0

    # Totales
    ingresos_pen = v_pen + s_ing_pen
    ingresos_usd = v_usd + s_ing_usd
    egresos_pen = c_pen + s_egr_pen
    egresos_usd = c_usd + s_egr_usd
    ganancia_pen = ingresos_pen - egresos_pen
    ganancia_usd = ingresos_usd - egresos_usd

    return {
        "fecha_inicio": start_date,
        "fecha_fin": end_date,
        "ingresos_pen": round(ingresos_pen, 2),
        "ingresos_usd": round(ingresos_usd, 2),
        "egresos_pen": round(egresos_pen, 2),
        "egresos_usd": round(egresos_usd, 2),
        "ganancia_pen": round(ganancia_pen, 2),
        "ganancia_usd": round(ganancia_usd, 2)
    }

async def list_reportes(db):
    # Primero ejecuta el lazy checker para generar reportes pendientes
    await lazy_generar_reportes(db)
    return await db.query("SELECT * FROM reportes_financieros ORDER BY fecha_inicio DESC")

async def lazy_generar_reportes(db):
    today = date.today()
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    # 1. Reporte Semanal (Lunes a Domingo de la semana pasada)
    current_monday = today - timedelta(days=today.weekday())
    prev_monday = current_monday - timedelta(days=7)
    prev_sunday = prev_monday + timedelta(days=6)
    
    pm_str = prev_monday.strftime('%Y-%m-%d')
    ps_str = prev_sunday.strftime('%Y-%m-%d')

    weekly_exists = await db.query(
        "SELECT id FROM reportes_financieros WHERE tipo = 'Semanal' AND fecha_inicio = ?",
        [pm_str]
    )
    if not weekly_exists:
        rep = await calcular_reporte(db, pm_str, ps_str)
        await db.execute(
            """
            INSERT INTO reportes_financieros (tipo, rango_fechas, fecha_inicio, fecha_fin, ingresos, ingresos_usd, egresos, egresos_usd, ganancia_neta, ganancia_neta_usd, creado_en)
            VALUES ('Semanal', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [f"{pm_str} al {ps_str}", pm_str, ps_str, rep['ingresos_pen'], rep['ingresos_usd'], rep['egresos_pen'], rep['egresos_usd'], rep['ganancia_pen'], rep['ganancia_usd'], now_str]
        )

    # 2. Reporte Mensual (Mes calendario anterior completo)
    first_this_month = today.replace(day=1)
    last_prev_month = first_this_month - timedelta(days=1)
    first_prev_month = last_prev_month.replace(day=1)

    fpm_str = first_prev_month.strftime('%Y-%m-%d')
    lpm_str = last_prev_month.strftime('%Y-%m-%d')

    monthly_exists = await db.query(
        "SELECT id FROM reportes_financieros WHERE tipo = 'Mensual' AND fecha_inicio = ?",
        [fpm_str]
    )
    if not monthly_exists:
        rep = await calcular_reporte(db, fpm_str, lpm_str)
        await db.execute(
            """
            INSERT INTO reportes_financieros (tipo, rango_fechas, fecha_inicio, fecha_fin, ingresos, ingresos_usd, egresos, egresos_usd, ganancia_neta, ganancia_neta_usd, creado_en)
            VALUES ('Mensual', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [f"{fpm_str} al {lpm_str}", fpm_str, lpm_str, rep['ingresos_pen'], rep['ingresos_usd'], rep['egresos_pen'], rep['egresos_usd'], rep['ganancia_pen'], rep['ganancia_usd'], now_str]
        )

    # 3. Reporte Anual (Año calendario anterior completo)
    prev_year = today.year - 1
    fpy_str = f"{prev_year}-01-01"
    lpy_str = f"{prev_year}-12-31"

    annual_exists = await db.query(
        "SELECT id FROM reportes_financieros WHERE tipo = 'Anual' AND fecha_inicio = ?",
        [fpy_str]
    )
    if not annual_exists:
        rep = await calcular_reporte(db, fpy_str, lpy_str)
        await db.execute(
            """
            INSERT INTO reportes_financieros (tipo, rango_fechas, fecha_inicio, fecha_fin, ingresos, ingresos_usd, egresos, egresos_usd, ganancia_neta, ganancia_neta_usd, creado_en)
            VALUES ('Anual', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [f"{fpy_str} al {lpy_str}", fpy_str, lpy_str, rep['ingresos_pen'], rep['ingresos_usd'], rep['egresos_pen'], rep['egresos_usd'], rep['ganancia_pen'], rep['ganancia_usd'], now_str]
        )


