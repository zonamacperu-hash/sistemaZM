let dbInitialized = false;

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS Headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response("", { status: 200, headers: corsHeaders });
  }

  function jsonResponse(status, payload) {
    const headers = { 
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders
    };
    return new Response(JSON.stringify(payload), { status, headers });
  }

  // Si no es una ruta de API, dejar que Pages sirva los estáticos directamente
  if (!path.startsWith('/api/')) {
    return await context.next();
  }

  // Verificar enlace de base de datos D1
  if (!env.DB) {
    return jsonResponse(500, {
      success: false,
      error: "Error de Configuración: El binding de base de datos D1 'DB' no está disponible o no está enlazado a Pages."
    });
  }

  // Inicializar base de datos si es necesario (con caché global en memoria por instancia)
  if (!dbInitialized) {
    try {
      await initDb(env.DB);
      dbInitialized = true;
    } catch (e) {
      console.error("Database initialization error:", e);
    }
  }

  const query = Object.fromEntries(url.searchParams.entries());
  const method = request.method;

  try {
    if (method === "GET") {
      if (path === '/api/dashboard') {
        const stats = await getDashboardStats(env.DB);
        return jsonResponse(200, stats);
      }
      
      if (path === '/api/config') {
        const config = await getConfig(env.DB);
        return jsonResponse(200, config);
      }
      
      if (path === '/api/exchange-rate') {
        const res = await env.DB.prepare("SELECT valor FROM configuracion WHERE clave = 'exchange_rate'").first();
        return jsonResponse(200, { exchange_rate: parseFloat(res?.valor || "3.75") });
      }
      
      if (path === '/api/contacts') {
        const { results } = await env.DB.prepare("SELECT * FROM contactos ORDER BY nombre ASC").all();
        return jsonResponse(200, results);
      }
      
      if (path === '/api/contacts/detail') {
        const id = parseInt(query.id || "0");
        const details = await getContactoDetail(env.DB, id);
        return jsonResponse(200, details);
      }
      
      if (path === '/api/categories') {
        const { results } = await env.DB.prepare("SELECT * FROM categorias ORDER BY nombre ASC").all();
        return jsonResponse(200, results);
      }
      
      if (path === '/api/products') {
        const { results } = await env.DB.prepare(`
          SELECT p.*, c.nombre as categoria_nombre 
          FROM productos p 
          LEFT JOIN categorias c ON p.categoria_id = c.id 
          ORDER BY p.nombre ASC
        `).all();
        return jsonResponse(200, results);
      }
      
      if (path === '/api/orders') {
        const { results } = await env.DB.prepare(`
          SELECT o.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono, c.numero_documento as cliente_documento
          FROM ordenes_servicio o 
          JOIN contactos c ON o.contacto_id = c.id 
          ORDER BY o.id DESC
        `).all();
        return jsonResponse(200, results);
      }
      
      if (path === '/api/orders/detail') {
        const id = parseInt(query.id || "0");
        const details = await getOrderDetail(env.DB, id);
        return jsonResponse(200, details);
      }
      
      if (path === '/api/loans') {
        const { results } = await env.DB.prepare(`
          SELECT p.*, prov.nombre as proveedor_nombre, prod.nombre as producto_nombre, prod.codigo as producto_codigo
          FROM prestamos_repuestos p 
          JOIN contactos prov ON p.contacto_id = prov.id 
          JOIN productos prod ON p.producto_id = prod.id 
          ORDER BY p.fecha_movimiento DESC
        `).all();
        return jsonResponse(200, results);
      }
      
      if (path === '/api/credits/clients') {
        const { results } = await env.DB.prepare(`
          SELECT cc.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono, v.tipo_documento, v.numero_documento as venta_documento
          FROM creditos_clientes cc
          JOIN contactos c ON cc.contacto_id = c.id
          LEFT JOIN ventas v ON cc.venta_id = v.id
          ORDER BY cc.id DESC
        `).all();
        return jsonResponse(200, results);
      }
      
      if (path === '/api/credits/providers') {
        const { results } = await env.DB.prepare(`
          SELECT cp.*, p.nombre as proveedor_nombre, p.telefono as proveedor_telefono
          FROM creditos_proveedores cp
          JOIN contactos p ON cp.contacto_id = p.id
          ORDER BY cp.id DESC
        `).all();
        return jsonResponse(200, results);
      }
      
      if (path === '/api/quotes') {
        const { results } = await env.DB.prepare("SELECT * FROM cotizaciones ORDER BY id DESC").all();
        return jsonResponse(200, results);
      }
      
      if (path === '/api/quotes/detail') {
        const id = parseInt(query.id || "0");
        const res = await env.DB.prepare("SELECT * FROM cotizaciones WHERE id = ?").bind(id).first();
        if (!res) return jsonResponse(404, { success: false, error: "Cotización no encontrada" });
        try {
          res.items = JSON.parse(res.items_json);
        } catch (e) {
          res.items = [];
        }
        return jsonResponse(200, { success: true, cotizacion: res });
      }
      
      if (path === '/api/sales') {
        const { results } = await env.DB.prepare(`
          SELECT v.*, c.nombre as cliente_nombre, c.numero_documento as cliente_documento 
          FROM ventas v 
          JOIN contactos c ON v.contacto_id = c.id 
          ORDER BY v.id DESC
        `).all();
        return jsonResponse(200, results);
      }
      
      if (path === '/api/compras') {
        const { results } = await env.DB.prepare(`
          SELECT cp.*, c.nombre as proveedor_nombre, c.numero_documento as proveedor_documento 
          FROM compras cp 
          JOIN contactos c ON cp.contacto_id = c.id 
          ORDER BY cp.id DESC
        `).all();
        return jsonResponse(200, results);
      }

      if (path === '/api/reports') {
        await lazyGenerarReportes(env.DB);
        const { results } = await env.DB.prepare("SELECT * FROM reportes_financieros ORDER BY fecha_inicio DESC").all();
        return jsonResponse(200, results);
      }

      if (path === '/api/reports/generate') {
        const start = query.start_date;
        const end = query.end_date;
        const result = await calcularReporte(env.DB, start, end);
        return jsonResponse(200, result);
      }
      
      return jsonResponse(404, { success: false, error: "Endpoint no encontrado" });

    } else if (method === "POST") {
      let data = {};
      try {
        data = await request.json();
      } catch (e) {}

      if (path === '/api/config/update') {
        const result = await updateConfig(env.DB, data);
        return jsonResponse(200, result);
      }
      
      if (path === '/api/contacts/create') {
        const result = await createContacto(env.DB, data);
        return jsonResponse(200, result);
      }
      
      if (path === '/api/contacts/update') {
        const id = parseInt(query.id || "0");
        const result = await updateContacto(env.DB, id, data);
        return jsonResponse(200, result);
      }
      
      if (path === '/api/contacts/net') {
        const id = parseInt(query.id || "0");
        const result = await netCredits(env.DB, id);
        return jsonResponse(200, result);
      }
      
      if (path === '/api/categories/create') {
        if (!data.nombre) return jsonResponse(200, { success: false, error: "Nombre es obligatorio" });
        try {
          await env.DB.prepare("INSERT INTO categorias (nombre) VALUES (?)").bind(data.nombre).run();
          return jsonResponse(200, { success: true, message: "Categoría creada" });
        } catch (e) {
          return jsonResponse(200, { success: false, error: "La categoría ya existe" });
        }
      }
      
      if (path === '/api/products/create') {
        const result = await createProducto(env.DB, data);
        return jsonResponse(200, result);
      }
      
      if (path === '/api/products/update') {
        const id = parseInt(query.id || "0");
        const result = await updateProducto(env.DB, id, data);
        return jsonResponse(200, result);
      }
      
      if (path === '/api/products/delete') {
        const id = parseInt(query.id || "0");
        try {
          await env.DB.prepare("DELETE FROM productos WHERE id = ?").bind(id).run();
          return jsonResponse(200, { success: true, message: "Producto eliminado" });
        } catch (e) {
          return jsonResponse(200, { success: false, error: "No se puede eliminar el producto, puede tener historial asociado." });
        }
      }
      
      if (path === '/api/orders/create') {
        const result = await createOrder(env.DB, data);
        return jsonResponse(200, result);
      }
      
      if (path === '/api/orders/update-status') {
        const id = parseInt(query.id || "0");
        const result = await updateOrderStatus(env.DB, id, data);
        return jsonResponse(200, result);
      }
      
      if (path === '/api/loans/create') {
        const result = await createLoan(env.DB, data);
        return jsonResponse(200, result);
      }
      
      if (path === '/api/loans/return') {
        const id = parseInt(query.id || "0");
        const result = await returnLoan(env.DB, id);
        return jsonResponse(200, result);
      }
      
      if (path === '/api/credits/clients/pay') {
        const id = parseInt(query.id || "0");
        const result = await payClientCredit(env.DB, id, data);
        return jsonResponse(200, result);
      }
      
      if (path === '/api/credits/providers/pay') {
        const id = parseInt(query.id || "0");
        const result = await payProviderCredit(env.DB, id, data);
        return jsonResponse(200, result);
      }
      
      if (path === '/api/quotes/create') {
        const result = await createQuote(env.DB, data);
        return jsonResponse(200, result);
      }
      
      if (path === '/api/quotes/convert') {
        const id = parseInt(query.id || "0");
        const result = await convertQuoteToSale(env.DB, id, data);
        return jsonResponse(200, result);
      }
      
      if (path === '/api/sales/create') {
        const result = await createVenta(env.DB, data);
        return jsonResponse(200, result);
      }
      
      if (path === '/api/compras/create') {
        const result = await createCompra(env.DB, data);
        return jsonResponse(200, result);
      }

      if (path === '/api/reports/save') {
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
        await env.DB.prepare(`
          INSERT INTO reportes_financieros (tipo, fecha_inicio, fecha_fin, ingresos_pen, ingresos_usd, egresos_pen, egresos_usd, ganancia_pen, ganancia_usd, fecha_generacion)
          VALUES ('Manual', ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          data.fecha_inicio,
          data.fecha_fin,
          parseFloat(data.ingresos_pen || 0.0),
          parseFloat(data.ingresos_usd || 0.0),
          parseFloat(data.egresos_pen || 0.0),
          parseFloat(data.egresos_usd || 0.0),
          parseFloat(data.ganancia_pen || 0.0),
          parseFloat(data.ganancia_usd || 0.0),
          now
        ).run();
        return jsonResponse(200, { success: true, message: "Reporte guardado exitosamente" });
      }
      
      if (path === '/api/reset') {
        const tables = [
          "abonos_clientes", "creditos_clientes", "abonos_proveedores", "creditos_proveedores",
          "prestamos_repuestos", "historial_ordenes", "ordenes_servicio", "productos",
          "contactos", "categorias", "ventas", "compras", "cotizaciones", "configuracion", "reportes_financieros"
        ];
        for (const t of tables) {
          try {
            await env.DB.prepare(`DROP TABLE IF EXISTS ${t}`).run();
          } catch(e) {}
        }
        await initDb(env.DB);
        return jsonResponse(200, { success: true, message: "Sistema restablecido por completo" });
      }
      
      return jsonResponse(404, { success: false, error: "Endpoint no encontrado" });
    }

    return jsonResponse(405, { success: false, error: "Método no permitido" });

  } catch (e) {
    return jsonResponse(500, { success: false, error: e.message || String(e) });
  }
}

// ============================================================================
// 1. CONFIGURACIÓN Y TIPO DE CAMBIO
// ============================================================================

async function getConfig(db) {
  const { results } = await db.prepare("SELECT clave, valor FROM configuracion").all();
  const config = {};
  for (const r of results) {
    config[r.clave] = r.valor;
  }
  return config;
}

async function updateConfig(db, data) {
  for (const [k, v] of Object.entries(data)) {
    await db.prepare("INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)")
            .bind(k, String(v))
            .run();
  }
  return { success: true, message: "Configuración actualizada correctamente" };
}

// ============================================================================
// 2. DASHBOARD DE CONTROL
// ============================================================================

async function getDashboardStats(db) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentMonth = today.substring(0, 7);

  const salesToday = await db.prepare(
    "SELECT SUM(total_usd) as total_usd, SUM(total_pen) as total_pen, COUNT(*) as count FROM ventas WHERE date(fecha) = date(?)"
  ).bind(today).first();

  const salesMonth = await db.prepare(
    "SELECT SUM(total_usd) as total_usd, SUM(total_pen) as total_pen, COUNT(*) as count FROM ventas WHERE strftime('%Y-%m', fecha) = ?"
  ).bind(currentMonth).first();

  const activeSupport = await db.prepare(
    "SELECT COUNT(*) as count FROM ordenes_servicio WHERE estado NOT IN ('Entregado', 'Sin Reparación')"
  ).first();

  const accountsReceivable = await db.prepare(
    "SELECT SUM(saldo_pendiente_usd) as usd, SUM(saldo_pendiente_pen) as pen FROM creditos_clientes WHERE estado = 'Pendiente'"
  ).first();

  const accountsPayable = await db.prepare(
    "SELECT SUM(saldo_pendiente_usd) as usd, SUM(saldo_pendiente_pen) as pen FROM creditos_proveedores WHERE estado = 'Pendiente'"
  ).first();

  const { results: recentSales } = await db.prepare(`
    SELECT v.*, c.nombre as cliente_nombre 
    FROM ventas v 
    JOIN contactos c ON v.contacto_id = c.id 
    ORDER BY v.fecha DESC LIMIT 5
  `).all();

  const { results: recentSupport } = await db.prepare(`
    SELECT o.*, c.nombre as cliente_nombre 
    FROM ordenes_servicio o 
    JOIN contactos c ON o.contacto_id = c.id 
    ORDER BY o.fecha_registro DESC LIMIT 5
  `).all();

  const { results: supportStatus } = await db.prepare(
    "SELECT estado, COUNT(*) as count FROM ordenes_servicio GROUP BY estado"
  ).all();

  const { results: monthlyFlow } = await db.prepare(`
    SELECT strftime('%Y-%m', fecha) as mes, SUM(total_pen) as total_pen, SUM(total_usd) as total_usd
    FROM ventas 
    GROUP BY mes 
    ORDER BY mes DESC 
    LIMIT 6
  `).all();

  return {
    sales_today: {
      usd: salesToday?.total_usd || 0.0,
      pen: salesToday?.total_pen || 0.0,
      count: salesToday?.count || 0
    },
    sales_month: {
      usd: salesMonth?.total_usd || 0.0,
      pen: salesMonth?.total_pen || 0.0,
      count: salesMonth?.count || 0
    },
    active_support: activeSupport?.count || 0,
    accounts_receivable: {
      usd: accountsReceivable?.usd || 0.0,
      pen: accountsReceivable?.pen || 0.0
    },
    accounts_payable: {
      usd: accountsPayable?.usd || 0.0,
      pen: accountsPayable?.pen || 0.0
    },
    recent_sales: recentSales || [],
    recent_support: recentSupport || [],
    support_status: supportStatus || [],
    monthly_flow: (monthlyFlow || []).reverse()
  };
}

// ============================================================================
// 3. CONTACTOS
// ============================================================================

async function createContacto(db, data) {
  const dup = await db.prepare("SELECT id FROM contactos WHERE numero_documento = ?").bind(data.numero_documento).first();
  if (dup) {
    return { success: false, error: "El número de documento ya se encuentra registrado" };
  }
  await db.prepare(`
    INSERT INTO contactos (tipo_contacto, tipo_documento, numero_documento, nombre, telefono, email, notas, catalogo_marcas)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.tipo_contacto,
    data.tipo_documento,
    data.numero_documento,
    data.nombre,
    data.telefono || null,
    data.email || null,
    data.notas || null,
    data.catalogo_marcas || null
  ).run();
  return { success: true, message: "Contacto registrado correctamente" };
}

async function updateContacto(db, id, data) {
  await db.prepare(`
    UPDATE contactos 
    SET tipo_contacto = ?, tipo_documento = ?, numero_documento = ?, nombre = ?, 
        telefono = ?, email = ?, notas = ?, catalogo_marcas = ?
    WHERE id = ?
  `).bind(
    data.tipo_contacto,
    data.tipo_documento,
    data.numero_documento,
    data.nombre,
    data.telefono || null,
    data.email || null,
    data.notas || null,
    data.catalogo_marcas || null,
    id
  ).run();
  return { success: true, message: "Contacto actualizado correctamente" };
}

async function getContactoDetail(db, id) {
  const contacto = await db.prepare("SELECT * FROM contactos WHERE id = ?").bind(id).first();
  if (!contacto) return { success: false, error: "Contacto no encontrado" };

  const { results: purchases } = await db.prepare("SELECT * FROM ventas WHERE contacto_id = ? ORDER BY fecha DESC").bind(id).all();
  const { results: support } = await db.prepare("SELECT * FROM ordenes_servicio WHERE contacto_id = ? ORDER BY fecha_registro DESC").bind(id).all();
  
  const { results: loans } = await db.prepare(`
    SELECT p.*, prod.nombre as producto_nombre 
    FROM prestamos_repuestos p 
    JOIN productos prod ON p.producto_id = prod.id 
    WHERE p.contacto_id = ? 
    ORDER BY p.fecha_movimiento DESC
  `).bind(id).all();

  const { results: client_credits } = await db.prepare(`
    SELECT cc.*, v.tipo_documento, v.numero_documento as venta_documento 
    FROM creditos_clientes cc 
    LEFT JOIN ventas v ON cc.venta_id = v.id 
    WHERE cc.contacto_id = ? 
    ORDER BY cc.id DESC
  `).bind(id).all();

  const { results: provider_credits } = await db.prepare("SELECT * FROM creditos_proveedores WHERE contacto_id = ? ORDER BY id DESC").bind(id).all();

  return {
    success: true,
    contacto,
    purchases,
    support,
    loans,
    client_credits,
    provider_credits
  };
}

// ============================================================================
// 4. PRODUCTOS
// ============================================================================

async function createProducto(db, data) {
  if (!data.codigo) return { success: false, error: "El código del producto es obligatorio" };
  const dup = await db.prepare("SELECT id FROM productos WHERE codigo = ?").bind(data.codigo).first();
  if (dup) return { success: false, error: "Ya existe un producto con este código" };

  await db.prepare(`
    INSERT INTO productos (codigo, nombre, categoria_id, stock_minimo, stock_actual, costo_usd, costo_pen, precio_venta_usd, precio_venta_pen, requiere_serie)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.codigo,
    data.nombre,
    data.categoria_id || null,
    data.stock_minimo || 0,
    data.stock_actual || 0,
    parseFloat(data.costo_usd || "0.0"),
    parseFloat(data.costo_pen || "0.0"),
    parseFloat(data.precio_venta_usd || "0.0"),
    parseFloat(data.precio_venta_pen || "0.0"),
    data.requiere_serie || 0
  ).run();

  return { success: true, message: "Producto creado correctamente" };
}

async function updateProducto(db, id, data) {
  await db.prepare(`
    UPDATE productos 
    SET codigo = ?, nombre = ?, categoria_id = ?, stock_minimo = ?, stock_actual = ?, 
        costo_usd = ?, costo_pen = ?, precio_venta_usd = ?, precio_venta_pen = ?, requiere_serie = ?
    WHERE id = ?
  `).bind(
    data.codigo,
    data.nombre,
    data.categoria_id || null,
    data.stock_minimo || 0,
    data.stock_actual || 0,
    parseFloat(data.costo_usd || "0.0"),
    parseFloat(data.costo_pen || "0.0"),
    parseFloat(data.precio_venta_usd || "0.0"),
    parseFloat(data.precio_venta_pen || "0.0"),
    data.requiere_serie || 0,
    id
  ).run();

  return { success: true, message: "Producto actualizado correctamente" };
}

// ============================================================================
// 5. ORDENES DE SERVICIO
// ============================================================================

async function createOrder(db, data) {
  const contacto_id = data.cliente_id || data.contacto_id;
  if (!contacto_id) return { success: false, error: "Seleccione un cliente/contacto" };

  const now = new Date().toISOString();

  await db.prepare(`
    INSERT INTO ordenes_servicio (
        contacto_id, equipo_modelo, equipo_serie_imei, estado_estetico, falla_reportada, 
        contrasena, estado, notas_tecnico, tecnico_asignado, costo_estimado_usd, 
        costo_estimado_pen, precio_venta_usd, precio_venta_pen, fecha_registro
    ) VALUES (?, ?, ?, ?, ?, ?, 'Recibido', ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    contacto_id,
    data.equipo_modelo,
    data.equipo_serie_imei,
    data.estado_estetico || null,
    data.falla_reportada,
    data.contrasena || null,
    data.notas_tecnico || null,
    data.tecnico_asignado || null,
    parseFloat(data.costo_estimado_usd || "0.0"),
    parseFloat(data.costo_estimado_pen || "0.0"),
    parseFloat(data.precio_venta_usd || "0.0"),
    parseFloat(data.precio_venta_pen || "0.0"),
    now
  ).run();

  const lastIdRow = await db.prepare("SELECT last_insert_rowid() as id").first();
  const order_id = lastIdRow ? lastIdRow.id : 0;

  await db.prepare(`
    INSERT INTO historial_ordenes (orden_id, estado_anterior, estado_nuevo, notas, fecha)
    VALUES (?, NULL, 'Recibido', 'Equipo ingresado al sistema.', ?)
  `).bind(order_id, now).run();

  return { success: true, message: "Orden de servicio técnico registrada", order_id };
}

async function updateOrderStatus(db, id, data) {
  const current = await db.prepare("SELECT estado FROM ordenes_servicio WHERE id = ?").bind(id).first();
  if (!current) return { success: false, error: "Orden no encontrada" };

  const prev_state = current.estado;
  const new_state = data.estado;
  const notas = data.notas || '';
  const now = new Date().toISOString();

  const tecnico_asignado = data.tecnico_asignado;
  const notas_tecnico = data.notas_tecnico;
  const costo_usd = data.costo_estimado_usd;
  const costo_pen = data.costo_estimado_pen;
  const precio_usd = data.precio_venta_usd;
  const precio_pen = data.precio_venta_pen;
  const garantia_servicio = data.garantia_servicio;

  let updateQuery = "UPDATE ordenes_servicio SET estado = ?";
  const params = [new_state];

  if (tecnico_asignado !== undefined) { updateQuery += ", tecnico_asignado = ?"; params.push(tecnico_asignado); }
  if (notas_tecnico !== undefined) { updateQuery += ", notas_tecnico = ?"; params.push(notas_tecnico); }
  if (costo_usd !== undefined) { updateQuery += ", costo_estimado_usd = ?"; params.push(costo_usd); }
  if (costo_pen !== undefined) { updateQuery += ", costo_estimado_pen = ?"; params.push(costo_pen); }
  if (precio_usd !== undefined) { updateQuery += ", precio_venta_usd = ?"; params.push(precio_usd); }
  if (precio_pen !== undefined) { updateQuery += ", precio_venta_pen = ?"; params.push(precio_pen); }
  if (garantia_servicio !== undefined) { updateQuery += ", garantia_servicio = ?"; params.push(garantia_servicio); }

  if (new_state === 'Entregado') {
    updateQuery += ", fecha_entrega = ?";
    params.push(now);
  }

  updateQuery += " WHERE id = ?";
  params.push(id);

  await db.prepare(updateQuery).bind(...params).run();

  await db.prepare(`
    INSERT INTO historial_ordenes (orden_id, estado_anterior, estado_nuevo, notas, fecha)
    VALUES (?, ?, ?, ?, ?)
  `).bind(id, prev_state, new_state, notas || `Cambio de estado a ${new_state}.`, now).run();

  return { success: true, message: "Estado de la orden actualizado correctamente" };
}

async function getOrderDetail(db, id) {
  const order = await db.prepare(`
    SELECT o.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono, 
           c.email as cliente_email, c.tipo_documento as cliente_tipo_documento, c.numero_documento as cliente_documento
    FROM ordenes_servicio o 
    JOIN contactos c ON o.contacto_id = c.id 
    WHERE o.id = ?
  `).bind(id).first();
  if (!order) return { success: false, error: "Orden de servicio no encontrada" };

  const { results: history } = await db.prepare("SELECT * FROM historial_ordenes WHERE orden_id = ? ORDER BY fecha DESC").bind(id).all();

  return {
    success: true,
    order,
    history
  };
}

// ============================================================================
// 6. PRESTAMOS
// ============================================================================

async function createLoan(db, data) {
  const contacto_id = data.proveedor_id || data.contacto_id;
  const prod_id = data.producto_id;
  const qty = parseInt(data.cantidad || "0");
  const costo_usd = parseFloat(data.costo_unitario_usd || "0.0");
  const costo_pen = parseFloat(data.costo_unitario_pen || "0.0");

  if (qty <= 0) return { success: false, error: "Cantidad debe ser mayor a cero" };
  const now = new Date().toISOString();

  await db.prepare(`
    INSERT INTO prestamos_repuestos (contacto_id, producto_id, cantidad, costo_unitario_usd, costo_unitario_pen, tipo_movimiento, fecha_movimiento, estado_movimiento)
    VALUES (?, ?, ?, ?, ?, 'Recibido', ?, 'Activo')
  `).bind(contacto_id, prod_id, qty, costo_usd, costo_pen, now).run();

  await db.prepare("UPDATE productos SET stock_actual = stock_actual + ? WHERE id = ?").bind(qty, prod_id).run();

  const total_usd = costo_usd * qty;
  const total_pen = costo_pen * qty;

  await db.prepare(`
    INSERT INTO creditos_proveedores (contacto_id, monto_total_usd, monto_total_pen, saldo_pendiente_usd, saldo_pendiente_pen, notas, estado)
    VALUES (?, ?, ?, ?, ?, ?, 'Pendiente')
  `).bind(contacto_id, total_usd, total_pen, total_usd, total_pen, `Ingreso de repuesto por préstamo intertienda/consignación. Qty: ${qty}.`).run();

  return { success: true, message: "Préstamo registrado. Stock incrementado y cuenta por pagar generada." };
}

async function returnLoan(db, prestamo_id) {
  const prestamo = await db.prepare("SELECT * FROM prestamos_repuestos WHERE id = ?").bind(prestamo_id).first();
  if (!prestamo) return { success: false, error: "Préstamo no encontrado" };
  if (prestamo.estado_movimiento === 'Devuelto') {
    return { success: false, error: "Este préstamo ya ha sido devuelto anteriormente" };
  }

  const prod_id = prestamo.producto_id;
  const qty = prestamo.cantidad;
  const contacto_id = prestamo.contacto_id;

  const prod = await db.prepare("SELECT stock_actual, nombre FROM productos WHERE id = ?").bind(prod_id).first();
  if (!prod || prod.stock_actual < qty) {
    return {
      success: false,
      error: `Stock insuficiente del producto '${prod?.nombre || 'Desconocido'}' para realizar la devolución (Stock actual: ${prod?.stock_actual || 0}, Requiere: ${qty})`
    };
  }

  const now = new Date().toISOString();

  await db.prepare("UPDATE prestamos_repuestos SET estado_movimiento = 'Devuelto' WHERE id = ?").bind(prestamo_id).run();
  await db.prepare("UPDATE productos SET stock_actual = stock_actual - ? WHERE id = ?").bind(qty, prod_id).run();
  
  await db.prepare(`
    INSERT INTO prestamos_repuestos (contacto_id, producto_id, cantidad, costo_unitario_usd, costo_unitario_pen, tipo_movimiento, fecha_movimiento, estado_movimiento)
    VALUES (?, ?, ?, ?, ?, 'Devuelto', ?, 'Activo')
  `).bind(contacto_id, prod_id, qty, prestamo.costo_unitario_usd, prestamo.costo_unitario_pen, now).run();

  const total_usd = prestamo.costo_unitario_usd * qty;
  const match_credit = await db.prepare(`
    SELECT id FROM creditos_proveedores 
    WHERE contacto_id = ? AND estado = 'Pendiente' AND ABS(monto_total_usd - ?) < 0.01 
    ORDER BY id DESC LIMIT 1
  `).bind(contacto_id, total_usd).first();

  if (match_credit) {
    await db.prepare("UPDATE creditos_proveedores SET saldo_pendiente_usd = 0, saldo_pendiente_pen = 0, estado = 'Anulado', notas = notas || ' (Anulado por devolución de equipo)' WHERE id = ?").bind(match_credit.id).run();
  } else {
    await db.prepare(`
      INSERT INTO creditos_proveedores (contacto_id, monto_total_usd, monto_total_pen, saldo_pendiente_usd, saldo_pendiente_pen, notas, estado)
      VALUES (?, ?, ?, 0, 0, ?, 'Pagado')
    `).bind(contacto_id, -total_usd, -total_usd * 3.75, `Ajuste contable negativo por devolución de repuesto de ID préstamo: ${prestamo_id}`).run();
  }

  return { success: true, message: "Devolución registrada exitosamente. Inventario y contabilidad saneados." };
}

// ============================================================================
// 7. ABONOS Y CREDITO
// ============================================================================

async function payClientCredit(db, credito_id, data) {
  const monto_usd = parseFloat(data.monto_usd || "0.0");
  const monto_pen = parseFloat(data.monto_pen || "0.0");
  const metodo = data.metodo_pago || 'Efectivo';
  const now = new Date().toISOString();

  const cred = await db.prepare("SELECT * FROM creditos_clientes WHERE id = ?").bind(credito_id).first();
  if (!cred) return { success: false, error: "Crédito no encontrado" };

  const new_usd_pending = Math.max(0.0, cred.saldo_pendiente_usd - monto_usd);
  const new_pen_pending = Math.max(0.0, cred.saldo_pendiente_pen - monto_pen);
  const estado = (new_usd_pending <= 0.001 && new_pen_pending <= 0.001) ? 'Pagado' : 'Pendiente';

  await db.prepare(`
    INSERT INTO abonos_clientes (credito_id, monto_usd, monto_pen, metodo_pago, fecha)
    VALUES (?, ?, ?, ?, ?)
  `).bind(credito_id, monto_usd, monto_pen, metodo, now).run();

  await db.prepare("UPDATE creditos_clientes SET saldo_pendiente_usd = ?, saldo_pendiente_pen = ?, estado = ? WHERE id = ?").bind(new_usd_pending, new_pen_pending, estado, credito_id).run();

  return { success: true, message: "Abono registrado correctamente" };
}

async function payProviderCredit(db, credito_id, data) {
  const monto_usd = parseFloat(data.monto_usd || "0.0");
  const monto_pen = parseFloat(data.monto_pen || "0.0");
  const metodo = data.metodo_pago || 'Efectivo';
  const now = new Date().toISOString();

  const cred = await db.prepare("SELECT * FROM creditos_proveedores WHERE id = ?").bind(credito_id).first();
  if (!cred) return { success: false, error: "Cuenta por pagar no encontrada" };

  const new_usd_pending = Math.max(0.0, cred.saldo_pendiente_usd - monto_usd);
  const new_pen_pending = Math.max(0.0, cred.saldo_pendiente_pen - monto_pen);
  const estado = (new_usd_pending <= 0.001 && new_pen_pending <= 0.001) ? 'Pagado' : 'Pendiente';

  await db.prepare(`
    INSERT INTO abonos_proveedores (credito_id, monto_usd, monto_pen, metodo_pago, fecha)
    VALUES (?, ?, ?, ?, ?)
  `).bind(credito_id, monto_usd, monto_pen, metodo, now).run();

  await db.prepare("UPDATE creditos_proveedores SET saldo_pendiente_usd = ?, saldo_pendiente_pen = ?, estado = ? WHERE id = ?").bind(new_usd_pending, new_pen_pending, estado, credito_id).run();

  return { success: true, message: "Abono registrado correctamente" };
}

// ============================================================================
// 8. COTIZACIONES
// ============================================================================

async function createQuote(db, data) {
  const cliente_nombre = data.cliente_nombre;
  if (!cliente_nombre) return { success: false, error: "Nombre de cliente es requerido" };
  
  const items = data.items || [];
  if (items.length === 0) return { success: false, error: "La cotización debe tener al menos un ítem" };

  const total_usd = parseFloat(data.total_usd || "0.0");
  const total_pen = parseFloat(data.total_pen || "0.0");
  const now = new Date().toISOString();

  await db.prepare(`
    INSERT INTO cotizaciones (cliente_nombre, cliente_documento, fecha, total_usd, total_pen, items_json, estado)
    VALUES (?, ?, ?, ?, ?, ?, 'Pendiente')
  `).bind(
    cliente_nombre,
    data.cliente_documento || '',
    now,
    total_usd,
    total_pen,
    JSON.stringify(items)
  ).run();

  return { success: true, message: "Cotización creada con éxito" };
}

// ============================================================================
// DATABASE & TRANSACTIONS INITIALIZATION AND MIGRATIONS
// ============================================================================

async function initDb(db) {
  try {
    await db.prepare("SELECT 1 FROM configuracion LIMIT 1").first();
    return;
  } catch (e) {}

  const queries = [
    `CREATE TABLE IF NOT EXISTS configuracion (
        clave TEXT PRIMARY KEY,
        valor TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS categorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT UNIQUE NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS contactos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo_contacto TEXT NOT NULL,
        tipo_documento TEXT NOT NULL,
        numero_documento TEXT UNIQUE NOT NULL,
        nombre TEXT NOT NULL,
        telefono TEXT,
        email TEXT,
        notas TEXT,
        catalogo_marcas TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS productos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT UNIQUE NOT NULL,
        nombre TEXT NOT NULL,
        categoria_id INTEGER,
        stock_minimo INTEGER DEFAULT 0,
        stock_actual INTEGER DEFAULT 0,
        costo_usd REAL DEFAULT 0.0,
        costo_pen REAL DEFAULT 0.0,
        precio_venta_usd REAL DEFAULT 0.0,
        precio_venta_pen REAL DEFAULT 0.0,
        requiere_serie INTEGER DEFAULT 0,
        series_disponibles TEXT DEFAULT '[]',
        FOREIGN KEY(categoria_id) REFERENCES categorias(id)
    );`,
    `CREATE TABLE IF NOT EXISTS ordenes_servicio (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contacto_id INTEGER NOT NULL,
        equipo_modelo TEXT NOT NULL,
        equipo_serie_imei TEXT NOT NULL,
        estado_estetico TEXT,
        falla_reportada TEXT NOT NULL,
        contrasena TEXT,
        estado TEXT NOT NULL,
        notas_tecnico TEXT,
        tecnico_asignado TEXT,
        costo_estimado_usd REAL DEFAULT 0.0,
        costo_estimado_pen REAL DEFAULT 0.0,
        precio_venta_usd REAL DEFAULT 0.0,
        precio_venta_pen REAL DEFAULT 0.0,
        fecha_registro TEXT NOT NULL,
        fecha_entrega TEXT,
        garantia_servicio TEXT DEFAULT 'Sin garantía',
        FOREIGN KEY(contacto_id) REFERENCES contactos(id)
    );`,
    `CREATE TABLE IF NOT EXISTS historial_ordenes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orden_id INTEGER NOT NULL,
        estado_anterior TEXT,
        estado_nuevo TEXT NOT NULL,
        notas TEXT,
        fecha TEXT NOT NULL,
        FOREIGN KEY(orden_id) REFERENCES ordenes_servicio(id)
    );`,
    `CREATE TABLE IF NOT EXISTS prestamos_repuestos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contacto_id INTEGER NOT NULL,
        producto_id INTEGER NOT NULL,
        cantidad INTEGER NOT NULL,
        costo_unitario_usd REAL DEFAULT 0.0,
        costo_unitario_pen REAL DEFAULT 0.0,
        tipo_movimiento TEXT NOT NULL,
        fecha_movimiento TEXT NOT NULL,
        estado_movimiento TEXT NOT NULL,
        FOREIGN KEY(contacto_id) REFERENCES contactos(id),
        FOREIGN KEY(producto_id) REFERENCES productos(id)
    );`,
    `CREATE TABLE IF NOT EXISTS ventas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contacto_id INTEGER NOT NULL,
        tipo_documento TEXT NOT NULL,
        numero_documento TEXT NOT NULL,
        subtotal_usd REAL DEFAULT 0.0,
        subtotal_pen REAL DEFAULT 0.0,
        igv_usd REAL DEFAULT 0.0,
        igv_pen REAL DEFAULT 0.0,
        total_usd REAL DEFAULT 0.0,
        total_pen REAL DEFAULT 0.0,
        metodo_pago TEXT NOT NULL,
        fecha TEXT NOT NULL,
        items_json TEXT NOT NULL,
        FOREIGN KEY(contacto_id) REFERENCES contactos(id)
    );`,
    `CREATE TABLE IF NOT EXISTS compras (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contacto_id INTEGER NOT NULL,
        tipo_documento TEXT NOT NULL,
        numero_documento TEXT NOT NULL,
        subtotal_usd REAL DEFAULT 0.0,
        subtotal_pen REAL DEFAULT 0.0,
        igv_usd REAL DEFAULT 0.0,
        igv_pen REAL DEFAULT 0.0,
        total_usd REAL DEFAULT 0.0,
        total_pen REAL DEFAULT 0.0,
        metodo_pago TEXT NOT NULL,
        fecha TEXT NOT NULL,
        items_json TEXT NOT NULL,
        FOREIGN KEY(contacto_id) REFERENCES contactos(id)
    );`,
    `CREATE TABLE IF NOT EXISTS creditos_clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contacto_id INTEGER NOT NULL,
        venta_id INTEGER,
        monto_total_usd REAL DEFAULT 0.0,
        monto_total_pen REAL DEFAULT 0.0,
        saldo_pendiente_usd REAL DEFAULT 0.0,
        saldo_pendiente_pen REAL DEFAULT 0.0,
        limite_credito_usd REAL DEFAULT 0.0,
        limite_credito_pen REAL DEFAULT 0.0,
        notas TEXT,
        estado TEXT NOT NULL,
        FOREIGN KEY(contacto_id) REFERENCES contactos(id),
        FOREIGN KEY(venta_id) REFERENCES ventas(id)
    );`,
    `CREATE TABLE IF NOT EXISTS abonos_clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        credito_id INTEGER NOT NULL,
        monto_usd REAL DEFAULT 0.0,
        monto_pen REAL DEFAULT 0.0,
        metodo_pago TEXT NOT NULL,
        fecha TEXT NOT NULL,
        FOREIGN KEY(credito_id) REFERENCES creditos_clientes(id)
    );`,
    `CREATE TABLE IF NOT EXISTS creditos_proveedores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contacto_id INTEGER NOT NULL,
        monto_total_usd REAL DEFAULT 0.0,
        monto_total_pen REAL DEFAULT 0.0,
        saldo_pendiente_usd REAL DEFAULT 0.0,
        saldo_pendiente_pen REAL DEFAULT 0.0,
        notas TEXT,
        estado TEXT NOT NULL,
        FOREIGN KEY(contacto_id) REFERENCES contactos(id)
    );`,
    `CREATE TABLE IF NOT EXISTS abonos_proveedores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        credito_id INTEGER NOT NULL,
        monto_usd REAL DEFAULT 0.0,
        monto_pen REAL DEFAULT 0.0,
        metodo_pago TEXT NOT NULL,
        fecha TEXT NOT NULL,
        FOREIGN KEY(credito_id) REFERENCES creditos_proveedores(id)
    );`,
    `CREATE TABLE IF NOT EXISTS cotizaciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_nombre TEXT NOT NULL,
        cliente_documento TEXT,
        fecha TEXT NOT NULL,
        total_usd REAL DEFAULT 0.0,
        total_pen REAL DEFAULT 0.0,
        items_json TEXT NOT NULL,
        estado TEXT DEFAULT 'Pendiente'
    );`,
    `CREATE TABLE IF NOT EXISTS reportes_financieros (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo TEXT NOT NULL,
        fecha_inicio TEXT NOT NULL,
        fecha_fin TEXT NOT NULL,
        ingresos_pen REAL DEFAULT 0.0,
        ingresos_usd REAL DEFAULT 0.0,
        egresos_pen REAL DEFAULT 0.0,
        egresos_usd REAL DEFAULT 0.0,
        ganancia_pen REAL DEFAULT 0.0,
        ganancia_usd REAL DEFAULT 0.0,
        fecha_generacion TEXT NOT NULL
    );`
  ];

  for (const q of queries) {
    try {
      await db.prepare(q).run();
    } catch (e) {}
  }

  const migrations = [
    "ALTER TABLE ordenes_servicio ADD COLUMN garantia_servicio TEXT DEFAULT 'Sin garantía'",
    "ALTER TABLE productos ADD COLUMN requiere_serie INTEGER DEFAULT 0",
    "ALTER TABLE productos ADD COLUMN series_disponibles TEXT DEFAULT '[]'"
  ];
  for (const m of migrations) {
    try {
      await db.prepare(m).run();
    } catch (e) {}
  }

  const catCount = await db.prepare("SELECT COUNT(*) as count FROM categorias").first();
  if (!catCount || catCount.count === 0) {
    const defaultCategories = ['iPhone', 'Mac', 'iPad', 'AirPods', 'Apple Watch', 'Accesorios Apple', 'Genéricos', 'Repuestos', 'Otros'];
    for (const cat of defaultCategories) {
      await db.prepare("INSERT OR IGNORE INTO categorias (nombre) VALUES (?)").bind(cat).run();
    }
  }

  const configCount = await db.prepare("SELECT COUNT(*) as count FROM configuracion").first();
  if (!configCount || configCount.count === 0) {
    const defaultConfig = {
      'business_name': 'Zona Mac Peru',
      'business_address': 'Av. Petit Thouars 5356 Miraflores, Lima',
      'business_ruc': '10446507309',
      'business_phone': '+51 941 995 237',
      'social_instagram': 'https://instagram.com/zonamacperu',
      'social_facebook': 'https://facebook.com/zonamacperu',
      'google_business_url': 'https://g.page/zonamacperu',
      'logo_url': 'logo.jpg',
      'exchange_rate': '3.75'
    };
    for (const [k, v] of Object.entries(defaultConfig)) {
      await db.prepare("INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?, ?)").bind(k, v).run();
    }
  }
}

// Helper implementations for POS and other methods

async function createVenta(db, data) {
  const contacto_id = data.cliente_id || data.contacto_id;
  const tipo_doc = data.tipo_documento || 'Nota de Venta';
  const metodo_pago = data.metodo_pago || 'Efectivo';
  const items = data.items || [];

  if (!contacto_id) return { success: false, error: "Cliente/Contacto requerido" };
  if (items.length === 0) return { success: false, error: "Debe agregar productos al carrito" };

  const cli = await db.prepare("SELECT nombre, numero_documento FROM contactos WHERE id = ?").bind(contacto_id).first();
  if (!cli) return { success: false, error: "Contacto no registrado" };

  let prefix = 'NV01';
  if (tipo_doc === 'Factura') prefix = 'F001';
  else if (tipo_doc === 'Boleta') prefix = 'B001';
  else if (tipo_doc === 'Recibo por Honorarios') prefix = 'R001';

  const countRes = await db.prepare("SELECT COUNT(*) as count FROM ventas WHERE tipo_documento = ?").bind(tipo_doc).first();
  const countVal = countRes ? countRes.count : 0;
  const doc_number = `${prefix}-${String(countVal + 1).padStart(8, '0')}`;

  let total_usd = 0.0;
  let total_pen = 0.0;
  const processed_items = [];

  for (const item of items) {
    const prod_id = item.producto_id;
    const qty = parseInt(item.cantidad || 1);

    const prod = await db.prepare("SELECT * FROM productos WHERE id = ?").bind(prod_id).first();
    if (!prod) return { success: false, error: `Producto con ID ${prod_id} no existe` };

    if (prod.stock_actual < qty) {
      return { success: false, error: `Stock insuficiente para ${prod.nombre} (Disponibles: ${prod.stock_actual}, Requerido: ${qty})` };
    }

    // Deduct stock
    await db.prepare("UPDATE productos SET stock_actual = stock_actual - ? WHERE id = ?").bind(qty, prod_id).run();

    const p_usd = parseFloat(item.precio_unitario_usd !== undefined ? item.precio_unitario_usd : prod.precio_venta_usd);
    const p_pen = parseFloat(item.precio_unitario_pen !== undefined ? item.precio_unitario_pen : prod.precio_venta_pen);
    const garantia = item.garantia || 'Sin garantía';

    let item_series = item.series || [];
    if (typeof item_series === 'string') {
      item_series = item_series.split(',').map(s => s.trim()).filter(Boolean);
    }

    if (prod.requiere_serie === 1) {
      if (item_series.length !== qty) {
        return { success: false, error: `Debe seleccionar exactamente ${qty} número(s) de serie para ${prod.nombre}` };
      }

      let existing_series = [];
      try {
        existing_series = JSON.parse(prod.series_disponibles || '[]');
      } catch (e) {
        existing_series = [];
      }

      for (const s of item_series) {
        if (!existing_series.includes(s)) {
          return { success: false, error: `El número de serie '${s}' no está disponible para el producto ${prod.nombre}` };
        }
      }

      // Remove from available series
      existing_series = existing_series.filter(s => !item_series.includes(s));
      await db.prepare("UPDATE productos SET series_disponibles = ? WHERE id = ?").bind(JSON.stringify(existing_series), prod_id).run();
    }

    const item_total_usd = p_usd * qty;
    const item_total_pen = p_pen * qty;

    total_usd += item_total_usd;
    total_pen += item_total_pen;

    processed_items.push({
      producto_id: prod_id,
      codigo: prod.codigo,
      nombre: prod.nombre,
      cantidad: qty,
      precio_unitario_usd: p_usd,
      precio_unitario_pen: p_pen,
      total_usd: item_total_usd,
      total_pen: item_total_pen,
      garantia: garantia,
      series: prod.requiere_serie === 1 ? item_series : []
    });
  }

  let subtotal_usd = total_usd;
  let subtotal_pen = total_pen;
  let igv_usd = 0.0;
  let igv_pen = 0.0;

  if (tipo_doc === 'Factura') {
    subtotal_usd = Math.round((total_usd / 1.18) * 100) / 100;
    subtotal_pen = Math.round((total_pen / 1.18) * 100) / 100;
    igv_usd = Math.round((total_usd - subtotal_usd) * 100) / 100;
    igv_pen = Math.round((total_pen - subtotal_pen) * 100) / 100;
  }

  const now = new Date().toISOString();

  await db.prepare(`
    INSERT INTO ventas (
        contacto_id, tipo_documento, numero_documento, subtotal_usd, subtotal_pen, 
        igv_usd, igv_pen, total_usd, total_pen, metodo_pago, fecha, items_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
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
    JSON.stringify(processed_items)
  ).run();

  const saleIdRes = await db.prepare("SELECT last_insert_rowid() as id").first();
  const sale_id = saleIdRes ? saleIdRes.id : 0;

  if (metodo_pago === 'Crédito') {
    const limite_usd = parseFloat(data.limite_credito_usd || 0.0);
    const limite_pen = parseFloat(data.limite_credito_pen || 0.0);

    await db.prepare(`
      INSERT INTO creditos_clientes (
          contacto_id, venta_id, monto_total_usd, monto_total_pen, saldo_pendiente_usd, 
          saldo_pendiente_pen, limite_credito_usd, limite_credito_pen, notas, estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente')
    `).bind(
      contacto_id,
      sale_id,
      total_usd,
      total_pen,
      total_usd,
      total_pen,
      limite_usd,
      limite_pen,
      `Crédito por venta del documento ${doc_number}.`
    ).run();
  }

  const pse_payload = {
    cabecera: {
      tipDocUsuario: tipo_doc === 'Factura' ? "6" : "1",
      numDocUsuario: cli.numero_documento,
      nomUsuario: cli.nombre,
      tipDocEmisor: "6",
      numDocEmisor: "20608754129",
      nomEmisor: "ZONA MAC PERU S.A.C.",
      tipComp: tipo_doc === 'Factura' ? "01" : tipo_doc === 'Boleta' ? "03" : "00",
      numSerie: prefix,
      numCorrelativo: doc_number.split('-')[1],
      fecEmision: now.split('T')[0],
      moneda: "PEN",
      montoSubtotal: subtotal_pen,
      montoIgv: igv_pen,
      montoTotal: total_pen
    },
    detalles: processed_items.map(it => ({
      codItem: it.codigo,
      desItem: it.nombre,
      mtoValorUnitario: tipo_doc === 'Factura' ? Math.round((it.precio_unitario_pen / 1.18) * 100) / 100 : it.precio_unitario_pen,
      mtoIgvItem: tipo_doc === 'Factura' ? Math.round((it.total_pen - (it.total_pen / 1.18)) * 100) / 100 : 0.0,
      mtoPrecioVentaItem: it.precio_unitario_pen,
      mtoValorVentaItem: tipo_doc === 'Factura' ? Math.round((it.total_pen / 1.18) * 100) / 100 : it.total_pen,
      cantItem: it.cantidad
    }))
  };

  return {
    success: true,
    message: "Venta procesada exitosamente",
    documento: doc_number,
    venta_id: sale_id,
    pse_payload
  };
}

async function createCompra(db, data) {
  const contacto_id = data.proveedor_id || data.contacto_id;
  const tipo_doc = data.tipo_documento || 'Nota de Venta';
  const metodo_pago = data.metodo_pago || 'Efectivo';
  const items = data.items || [];
  const fecha = data.fecha || new Date().toISOString();

  if (!contacto_id) return { success: false, error: "Proveedor/Contacto requerido" };
  if (items.length === 0) return { success: false, error: "Debe agregar productos a la compra" };

  const prov = await db.prepare("SELECT nombre, numero_documento FROM contactos WHERE id = ?").bind(contacto_id).first();
  if (!prov) return { success: false, error: "Proveedor no registrado" };

  let doc_number = data.numero_documento;
  if (!doc_number) {
    const prefix = tipo_doc === 'Factura' ? 'FC01' : tipo_doc === 'Boleta' ? 'BC01' : 'NC01';
    const countRes = await db.prepare("SELECT COUNT(*) as count FROM compras WHERE tipo_documento = ?").bind(tipo_doc).first();
    const countVal = countRes ? countRes.count : 0;
    doc_number = `${prefix}-${String(countVal + 1).padStart(8, '0')}`;
  }

  let total_usd = 0.0;
  let total_pen = 0.0;
  const processed_items = [];

  for (const item of items) {
    const prod_id = item.producto_id;
    const qty = parseInt(item.cantidad || 1);

    const prod = await db.prepare("SELECT * FROM productos WHERE id = ?").bind(prod_id).first();
    if (!prod) return { success: false, error: `Producto con ID ${prod_id} no existe` };

    // Increase stock
    await db.prepare("UPDATE productos SET stock_actual = stock_actual + ? WHERE id = ?").bind(qty, prod_id).run();

    const p_usd = parseFloat(item.precio_unitario_usd !== undefined ? item.precio_unitario_usd : (prod.costo_usd || 0.0));
    const p_pen = parseFloat(item.precio_unitario_pen !== undefined ? item.precio_unitario_pen : (prod.costo_pen || 0.0));
    const garantia = item.garantia || 'Sin garantía';

    let item_series = item.series || [];
    if (typeof item_series === 'string') {
      item_series = item_series.split(',').map(s => s.trim()).filter(Boolean);
    }

    if (prod.requiere_serie === 1) {
      if (item_series.length !== qty) {
        return { success: false, error: `El producto ${prod.nombre} requiere exactamente ${qty} número(s) de serie` };
      }

      let existing_series = [];
      try {
        existing_series = JSON.parse(prod.series_disponibles || '[]');
      } catch (e) {
        existing_series = [];
      }

      for (const s of item_series) {
        if (existing_series.includes(s)) {
          return { success: false, error: `El número de serie '${s}' ya existe en el inventario para el producto ${prod.nombre}` };
        }
      }

      existing_series.push(...item_series);
      await db.prepare("UPDATE productos SET series_disponibles = ? WHERE id = ?").bind(JSON.stringify(existing_series), prod_id).run();
    }

    const item_total_usd = p_usd * qty;
    const item_total_pen = p_pen * qty;

    total_usd += item_total_usd;
    total_pen += item_total_pen;

    processed_items.push({
      producto_id: prod_id,
      codigo: prod.codigo,
      nombre: prod.nombre,
      cantidad: qty,
      precio_unitario_usd: p_usd,
      precio_unitario_pen: p_pen,
      total_usd: item_total_usd,
      total_pen: item_total_pen,
      garantia: garantia,
      series: prod.requiere_serie === 1 ? item_series : []
    });
  }

  let subtotal_usd = total_usd;
  let subtotal_pen = total_pen;
  let igv_usd = 0.0;
  let igv_pen = 0.0;

  if (tipo_doc === 'Factura') {
    subtotal_usd = Math.round((total_usd / 1.18) * 100) / 100;
    subtotal_pen = Math.round((total_pen / 1.18) * 100) / 100;
    igv_usd = Math.round((total_usd - subtotal_usd) * 100) / 100;
    igv_pen = Math.round((total_pen - subtotal_pen) * 100) / 100;
  }

  if (metodo_pago === 'Crédito') {
    await db.prepare(`
      INSERT INTO creditos_proveedores (contacto_id, monto_total_usd, monto_total_pen, saldo_pendiente_usd, saldo_pendiente_pen, notas, estado)
      VALUES (?, ?, ?, ?, ?, ?, 'Pendiente')
    `).bind(contacto_id, total_usd, total_pen, total_usd, total_pen, `Compra a crédito ${doc_number}`).run();
  }

  await db.prepare(`
    INSERT INTO compras (
        contacto_id, tipo_documento, numero_documento, subtotal_usd, subtotal_pen, 
        igv_usd, igv_pen, total_usd, total_pen, metodo_pago, fecha, items_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
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
    JSON.stringify(processed_items)
  ).run();

  const purchaseIdRes = await db.prepare("SELECT last_insert_rowid() as id").first();
  const compra_id = purchaseIdRes ? purchaseIdRes.id : 0;

  return { success: true, message: "Compra registrada exitosamente", compra_id, documento: doc_number };
}

async function convertQuoteToSale(db, cot_id, data) {
  const cot = await db.prepare("SELECT * FROM cotizaciones WHERE id = ?").bind(cot_id).first();
  if (!cot) return { success: false, error: "Cotización no encontrada" };
  if (cot.estado === 'Aceptada') return { success: false, error: "Esta cotización ya fue convertida a venta" };

  const contacto_id = data.cliente_id || data.contacto_id;
  const metodo_pago = data.metodo_pago || 'Efectivo';
  const tipo_doc = data.tipo_documento || 'Nota de Venta';

  if (!contacto_id) return { success: false, error: "Debe asociar un contacto real para registrar la venta" };

  let items = [];
  try {
    items = JSON.parse(cot.items_json);
  } catch (e) {
    items = [];
  }

  const resolved_items = [];
  for (const item of items) {
    const prod_id = item.producto_id;
    const code = item.codigo;
    let p_id = null;

    if (prod_id) {
      const p_res = await db.prepare("SELECT id FROM productos WHERE id = ?").bind(prod_id).first();
      if (p_res) p_id = p_res.id;
    } else if (code) {
      const p_res = await db.prepare("SELECT id FROM productos WHERE codigo = ?").bind(code).first();
      if (p_res) p_id = p_res.id;
    }

    if (!p_id) {
      const gen_res = await db.prepare("SELECT id FROM productos WHERE codigo = 'GENERIC'").first();
      if (!gen_res) {
        await db.prepare(`
          INSERT INTO productos (codigo, nombre, categoria_id, stock_minimo, stock_actual, costo_usd, costo_pen, precio_venta_usd, precio_venta_pen)
          VALUES ('GENERIC', 'Producto Genérico', 1, 0, 9999, 0.0, 0.0, 0.0, 0.0)
        `).run();
        const gen_id_res = await db.prepare("SELECT last_insert_rowid() as id").first();
        p_id = gen_id_res ? gen_id_res.id : 1;
      } else {
        p_id = gen_res.id;
      }
    }

    resolved_items.push({
      producto_id: p_id,
      cantidad: parseInt(item.cantidad || 1),
      precio_unitario_usd: parseFloat(item.precio_unitario_usd || item.precio || 0.0),
      precio_unitario_pen: parseFloat(item.precio_unitario_pen || (parseFloat(item.precio || 0.0) * 3.75))
    });
  }

  const sale_data = {
    cliente_id: contacto_id,
    tipo_documento: tipo_doc,
    metodo_pago: metodo_pago,
    items: resolved_items,
    limite_credito_usd: data.limite_credito_usd || 0.0,
    limite_credito_pen: data.limite_credito_pen || 0.0
  };

  const res = await createVenta(db, sale_data);
  if (res.success) {
    await db.prepare("UPDATE cotizaciones SET estado = 'Aceptada' WHERE id = ?").bind(cot_id).run();
  }
  return res;
}

async function netCredits(db, contacto_id) {
  const client_res = await db.prepare("SELECT SUM(saldo_pendiente_usd) as usd, SUM(saldo_pendiente_pen) as pen FROM creditos_clientes WHERE contacto_id = ? AND estado = 'Pendiente'").bind(contacto_id).first();
  const provider_res = await db.prepare("SELECT SUM(saldo_pendiente_usd) as usd, SUM(saldo_pendiente_pen) as pen FROM creditos_proveedores WHERE contacto_id = ? AND estado = 'Pendiente'").bind(contacto_id).first();

  const c_pen = client_res?.pen || 0.0;
  const c_usd = client_res?.usd || 0.0;
  const p_pen = provider_res?.pen || 0.0;
  const p_usd = provider_res?.usd || 0.0;

  const net_pen = Math.min(c_pen, p_pen);
  const net_usd = Math.min(c_usd, p_usd);

  if (net_pen <= 0.001 && net_usd <= 0.001) {
    return { success: false, error: "No se registran saldos pendientes mutuos en soles o dólares para netear." };
  }

  const now = new Date().toISOString();

  if (net_pen > 0.01) {
    let pending_pen = net_pen;
    const { results: c_credits } = await db.prepare("SELECT * FROM creditos_clientes WHERE contacto_id = ? AND estado = 'Pendiente' AND saldo_pendiente_pen > 0 ORDER BY id ASC").bind(contacto_id).all();
    for (const cred of c_credits) {
      if (pending_pen <= 0.001) break;
      const to_pay = Math.min(pending_pen, cred.saldo_pendiente_pen);
      const new_bal = cred.saldo_pendiente_pen - to_pay;
      const new_state = new_bal <= 0.01 ? 'Pagado' : 'Pendiente';

      await db.prepare("INSERT INTO abonos_clientes (credito_id, monto_usd, monto_pen, metodo_pago, fecha) VALUES (?, 0, ?, 'Neteo', ?)").bind(cred.id, to_pay, now).run();
      await db.prepare("UPDATE creditos_clientes SET saldo_pendiente_pen = ?, estado = ? WHERE id = ?").bind(new_bal, new_state, cred.id).run();
      pending_pen -= to_pay;
    }

    pending_pen = net_pen;
    const { results: p_credits } = await db.prepare("SELECT * FROM creditos_proveedores WHERE contacto_id = ? AND estado = 'Pendiente' AND saldo_pendiente_pen > 0 ORDER BY id ASC").bind(contacto_id).all();
    for (const cred of p_credits) {
      if (pending_pen <= 0.001) break;
      const to_pay = Math.min(pending_pen, cred.saldo_pendiente_pen);
      const new_bal = cred.saldo_pendiente_pen - to_pay;
      const new_state = new_bal <= 0.01 ? 'Pagado' : 'Pendiente';

      await db.prepare("INSERT INTO abonos_proveedores (credito_id, monto_usd, monto_pen, metodo_pago, fecha) VALUES (?, 0, ?, 'Neteo', ?)").bind(cred.id, to_pay, now).run();
      await db.prepare("UPDATE creditos_proveedores SET saldo_pendiente_pen = ?, estado = ? WHERE id = ?").bind(new_bal, new_state, cred.id).run();
      pending_pen -= to_pay;
    }
  }

  if (net_usd > 0.01) {
    let pending_usd = net_usd;
    const { results: c_credits } = await db.prepare("SELECT * FROM creditos_clientes WHERE contacto_id = ? AND estado = 'Pendiente' AND saldo_pendiente_usd > 0 ORDER BY id ASC").bind(contacto_id).all();
    for (const cred of c_credits) {
      if (pending_usd <= 0.001) break;
      const to_pay = Math.min(pending_usd, cred.saldo_pendiente_usd);
      const new_bal = cred.saldo_pendiente_usd - to_pay;
      const new_state = new_bal <= 0.01 ? 'Pagado' : 'Pendiente';

      await db.prepare("INSERT INTO abonos_clientes (credito_id, monto_usd, monto_pen, metodo_pago, fecha) VALUES (?, ?, 0, 'Neteo', ?)").bind(cred.id, to_pay, now).run();
      await db.prepare("UPDATE creditos_clientes SET saldo_pendiente_usd = ?, estado = ? WHERE id = ?").bind(new_bal, new_state, cred.id).run();
      pending_usd -= to_pay;
    }

    pending_usd = net_usd;
    const { results: p_credits } = await db.prepare("SELECT * FROM creditos_proveedores WHERE contacto_id = ? AND estado = 'Pendiente' AND saldo_pendiente_usd > 0 ORDER BY id ASC").bind(contacto_id).all();
    for (const cred of p_credits) {
      if (pending_usd <= 0.001) break;
      const to_pay = Math.min(pending_usd, cred.saldo_pendiente_usd);
      const new_bal = cred.saldo_pendiente_usd - to_pay;
      const new_state = new_bal <= 0.01 ? 'Pagado' : 'Pendiente';

      await db.prepare("INSERT INTO abonos_proveedores (credito_id, monto_usd, monto_pen, metodo_pago, fecha) VALUES (?, ?, 0, 'Neteo', ?)").bind(cred.id, to_pay, now).run();
      await db.prepare("UPDATE creditos_proveedores SET saldo_pendiente_usd = ?, estado = ? WHERE id = ?").bind(new_bal, new_state, cred.id).run();
      pending_usd -= to_pay;
    }
  }

  return {
    success: true,
    message: `Neteo de créditos procesado con éxito. Se compensaron S/ ${net_pen.toFixed(2)} y $ ${net_usd.toFixed(2)} mutuos.`
  };
}

async function calcularReporte(db, start_date, end_date) {
  // 1. Ventas
  const ventas = await db.prepare(
    "SELECT SUM(total_pen) as pen, SUM(total_usd) as usd FROM ventas WHERE date(fecha) >= date(?) AND date(fecha) <= date(?)"
  ).bind(start_date, end_date).first();
  const v_pen = ventas?.pen || 0.0;
  const v_usd = ventas?.usd || 0.0;

  // 2. Soporte Técnico - Ingresos (precio_venta de ordenes entregadas)
  const soporteIng = await db.prepare(
    "SELECT SUM(precio_venta_pen) as pen, SUM(precio_venta_usd) as usd FROM ordenes_servicio WHERE estado = 'Entregado' AND date(fecha_entrega) >= date(?) AND date(fecha_entrega) <= date(?)"
  ).bind(start_date, end_date).first();
  const s_ing_pen = soporteIng?.pen || 0.0;
  const s_ing_usd = soporteIng?.usd || 0.0;

  // 3. Compras
  const compras = await db.prepare(
    "SELECT SUM(total_pen) as pen, SUM(total_usd) as usd FROM compras WHERE date(fecha) >= date(?) AND date(fecha) <= date(?)"
  ).bind(start_date, end_date).first();
  const c_pen = compras?.pen || 0.0;
  const c_usd = compras?.usd || 0.0;

  // 4. Soporte Técnico - Egresos (costo_estimado de ordenes entregadas)
  const soporteEgr = await db.prepare(
    "SELECT SUM(costo_estimado_pen) as pen, SUM(costo_estimado_usd) as usd FROM ordenes_servicio WHERE estado = 'Entregado' AND date(fecha_entrega) >= date(?) AND date(fecha_entrega) <= date(?)"
  ).bind(start_date, end_date).first();
  const s_egr_pen = soporteEgr?.pen || 0.0;
  const s_egr_usd = soporteEgr?.usd || 0.0;

  const ingresos_pen = v_pen + s_ing_pen;
  const ingresos_usd = v_usd + s_ing_usd;
  const egresos_pen = c_pen + s_egr_pen;
  const egresos_usd = c_usd + s_egr_usd;
  const ganancia_pen = ingresos_pen - egresos_pen;
  const ganancia_usd = ingresos_usd - egresos_usd;

  return {
    fecha_inicio: start_date,
    fecha_fin: end_date,
    ingresos_pen: Math.round(ingresos_pen * 100) / 100,
    ingresos_usd: Math.round(ingresos_usd * 100) / 100,
    egresos_pen: Math.round(egresos_pen * 100) / 100,
    egresos_usd: Math.round(egresos_usd * 100) / 100,
    ganancia_pen: Math.round(ganancia_pen * 100) / 100,
    ganancia_usd: Math.round(ganancia_usd * 100) / 100
  };
}

async function lazyGenerarReportes(db) {
  const today = new Date();
  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

  // 1. Reporte Semanal
  const currentDay = today.getDay();
  const isoWeekday = currentDay === 0 ? 6 : currentDay - 1;
  const currentMonday = new Date(today);
  currentMonday.setDate(today.getDate() - isoWeekday);
  const prevMonday = new Date(currentMonday);
  prevMonday.setDate(currentMonday.getDate() - 7);
  const prevSunday = new Date(prevMonday);
  prevSunday.setDate(prevMonday.getDate() + 6);

  const pmStr = prevMonday.toISOString().split('T')[0];
  const psStr = prevSunday.toISOString().split('T')[0];

  const weeklyExists = await db.prepare(
    "SELECT id FROM reportes_financieros WHERE tipo = 'Semanal' AND fecha_inicio = ?"
  ).bind(pmStr).first();

  if (!weeklyExists) {
    const rep = await calcularReporte(db, pmStr, psStr);
    await db.prepare(`
      INSERT INTO reportes_financieros (tipo, fecha_inicio, fecha_fin, ingresos_pen, ingresos_usd, egresos_pen, egresos_usd, ganancia_pen, ganancia_usd, fecha_generacion)
      VALUES ('Semanal', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(pmStr, psStr, rep.ingresos_pen, rep.ingresos_usd, rep.egresos_pen, rep.egresos_usd, rep.ganancia_pen, rep.ganancia_usd, nowStr).run();
  }

  // 2. Reporte Mensual
  const firstThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastPrevMonth = new Date(firstThisMonth);
  lastPrevMonth.setDate(firstThisMonth.getDate() - 1);
  const firstPrevMonth = new Date(lastPrevMonth.getFullYear(), lastPrevMonth.getMonth(), 1);

  const fpmStr = firstPrevMonth.toISOString().split('T')[0];
  const lpmStr = lastPrevMonth.toISOString().split('T')[0];

  const monthlyExists = await db.prepare(
    "SELECT id FROM reportes_financieros WHERE tipo = 'Mensual' AND fecha_inicio = ?"
  ).bind(fpmStr).first();

  if (!monthlyExists) {
    const rep = await calcularReporte(db, fpmStr, lpmStr);
    await db.prepare(`
      INSERT INTO reportes_financieros (tipo, fecha_inicio, fecha_fin, ingresos_pen, ingresos_usd, egresos_pen, egresos_usd, ganancia_pen, ganancia_usd, fecha_generacion)
      VALUES ('Mensual', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(fpmStr, lpmStr, rep.ingresos_pen, rep.ingresos_usd, rep.egresos_pen, rep.egresos_usd, rep.ganancia_pen, rep.ganancia_usd, nowStr).run();
  }

  // 3. Reporte Anual
  const prevYear = today.getFullYear() - 1;
  const fpyStr = `${prevYear}-01-01`;
  const lpyStr = `${prevYear}-12-31`;

  const annualExists = await db.prepare(
    "SELECT id FROM reportes_financieros WHERE tipo = 'Anual' AND fecha_inicio = ?"
  ).bind(fpyStr).first();

  if (!annualExists) {
    const rep = await calcularReporte(db, fpyStr, lpyStr);
    await db.prepare(`
      INSERT INTO reportes_financieros (tipo, fecha_inicio, fecha_fin, ingresos_pen, ingresos_usd, egresos_pen, egresos_usd, ganancia_pen, ganancia_usd, fecha_generacion)
      VALUES ('Anual', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(fpyStr, lpyStr, rep.ingresos_pen, rep.ingresos_usd, rep.egresos_pen, rep.egresos_usd, rep.ganancia_pen, rep.ganancia_usd, nowStr).run();
  }
}


