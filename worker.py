from workers import WorkerEntrypoint, Response
import json
from urllib.parse import urlparse, parse_qs
from db_manager import DatabaseManager
import controllers

class Default(WorkerEntrypoint):
    async def fetch(self, request):
        db = DatabaseManager(self.env)
        await db.init_db()

        url = urlparse(request.url)
        path = url.path
        query = parse_qs(url.query)
        method = request.method

        cors_headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        }

        if method == "OPTIONS":
            return Response("", status=200, headers=cors_headers)

        def json_response(status, payload):
            headers = {"Content-Type": "application/json; charset=utf-8"}
            headers.update(cors_headers)
            return Response(json.dumps(payload), status=status, headers=headers)

        try:
            if method == "GET":
                if path == '/api/dashboard':
                    result = await controllers.get_dashboard_stats(db)
                elif path == '/api/config':
                    result = await controllers.get_config(db)
                elif path == '/api/exchange-rate':
                    rate = await controllers.get_exchange_rate(db)
                    result = {"exchange_rate": rate}
                elif path == '/api/contacts':
                    result = await controllers.list_contactos(db)
                elif path == '/api/contacts/detail':
                    contacto_id = int(query.get('id', [0])[0])
                    result = await controllers.get_contacto_detail(db, contacto_id)
                elif path == '/api/categories':
                    result = await controllers.list_categorias(db)
                elif path == '/api/products':
                    result = await controllers.list_productos(db)
                elif path == '/api/orders':
                    result = await controllers.list_ordenes(db)
                elif path == '/api/orders/detail':
                    order_id = int(query.get('id', [0])[0])
                    result = await controllers.get_orden_detail(db, order_id)
                elif path == '/api/loans':
                    result = await controllers.list_prestamos(db)
                elif path == '/api/credits/clients':
                    result = await controllers.list_creditos_clientes(db)
                elif path == '/api/credits/providers':
                    result = await controllers.list_creditos_proveedores(db)
                elif path == '/api/quotes':
                    result = await controllers.list_cotizaciones(db)
                elif path == '/api/quotes/detail':
                    quote_id = int(query.get('id', [0])[0])
                    result = await controllers.get_cotizacion(db, quote_id)
                elif path == '/api/sales':
                    result = await controllers.list_ventas(db)
                elif path == '/api/compras':
                    result = await controllers.list_compras(db)
                else:
                    return json_response(404, {"success": False, "error": "Endpoint no encontrado"})
                
                return json_response(200, result)

            elif method == "POST":
                body_text = await request.text()
                try:
                    data = json.loads(body_text) if body_text else {}
                except json.JSONDecodeError:
                    data = {}

                if path == '/api/config/update':
                    result = await controllers.update_config(db, data)
                elif path == '/api/contacts/create':
                    result = await controllers.create_contacto(db, data)
                elif path == '/api/contacts/update':
                    contacto_id = int(query.get('id', [0])[0])
                    result = await controllers.update_contacto(db, contacto_id, data)
                elif path == '/api/contacts/net':
                    contacto_id = int(query.get('id', [0])[0])
                    result = await controllers.net_credits(db, contacto_id)
                elif path == '/api/categories/create':
                    result = await controllers.create_categoria(db, data)
                elif path == '/api/products/create':
                    result = await controllers.create_producto(db, data)
                elif path == '/api/products/update':
                    prod_id = int(query.get('id', [0])[0])
                    result = await controllers.update_producto(db, prod_id, data)
                elif path == '/api/products/delete':
                    prod_id = int(query.get('id', [0])[0])
                    result = await controllers.delete_producto(db, prod_id)
                elif path == '/api/orders/create':
                    result = await controllers.create_orden(db, data)
                elif path == '/api/orders/update-status':
                    order_id = int(query.get('id', [0])[0])
                    result = await controllers.update_orden_estado(db, order_id, data)
                elif path == '/api/loans/create':
                    result = await controllers.create_prestamo(db, data)
                elif path == '/api/loans/return':
                    prestamo_id = int(query.get('id', [0])[0])
                    result = await controllers.devolver_prestamo(db, prestamo_id)
                elif path == '/api/credits/clients/pay':
                    credito_id = int(query.get('id', [0])[0])
                    result = await controllers.add_abono_cliente(db, credito_id, data)
                elif path == '/api/credits/providers/pay':
                    credito_id = int(query.get('id', [0])[0])
                    result = await controllers.add_abono_proveedor(db, credito_id, data)
                elif path == '/api/quotes/create':
                    result = await controllers.create_cotizacion(db, data)
                elif path == '/api/quotes/convert':
                    quote_id = int(query.get('id', [0])[0])
                    result = await controllers.convert_cotizacion_to_venta(db, quote_id, data)
                elif path == '/api/sales/create':
                    result = await controllers.create_venta(db, data)
                elif path == '/api/compras/create':
                    result = await controllers.create_compra(db, data)
                elif path == '/api/reset':
                    await db.reset_system()
                    result = {"success": True, "message": "Sistema restablecido por completo"}
                else:
                    return json_response(404, {"success": False, "error": "Endpoint no encontrado"})

                return json_response(200, result)

            else:
                return json_response(405, {"success": False, "error": "Método no permitido"})

        except Exception as e:
            return json_response(500, {"success": False, "error": str(e)})
