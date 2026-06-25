import os
import json
import asyncio
from urllib.parse import urlparse, parse_qs
from http.server import HTTPServer, BaseHTTPRequestHandler
from db_manager import DatabaseManager
import controllers

# Initialize Database once globally
db = DatabaseManager()
asyncio.run(db.init_db())

class APIRequestHandler(BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        query = parse_qs(parsed_url.query)

        if path.startswith('/api/'):
            asyncio.run(self.handle_api_get(path, query))
        else:
            self.handle_static_file(path)

    def do_POST(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        query = parse_qs(parsed_url.query)

        if path.startswith('/api/'):
            content_length = int(self.headers.get('Content-Length', 0))
            body_data = b''
            if content_length > 0:
                body_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(body_data.decode('utf-8')) if body_data else {}
            except json.JSONDecodeError:
                data = {}

            asyncio.run(self.handle_api_post(path, query, data))
        else:
            self.send_error_response(404, "Not Found")

    # ==========================================
    # API ROUTING - GET
    # ==========================================
    async def handle_api_get(self, path, query):
        try:
            result = None
            
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
            elif path == '/api/reports':
                result = await controllers.list_reportes(db)
            elif path == '/api/reports/generate':
                start_date = query.get('start_date', [''])[0]
                end_date = query.get('end_date', [''])[0]
                result = await controllers.calcular_reporte(db, start_date, end_date)
            else:
                self.send_error_response(404, "Endpoint no encontrado")
                return

            self.send_json_response(200, result)

        except Exception as e:
            self.send_json_response(500, {"success": False, "error": str(e)})

    # ==========================================
    # API ROUTING - POST
    # ==========================================
    async def handle_api_post(self, path, query, data):
        try:
            result = None
            
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
            elif path == '/api/reports/save':
                now_str = controllers.now_timestamp()
                await db.execute(
                    """
                    INSERT INTO reportes_financieros (tipo, fecha_inicio, fecha_fin, ingresos_pen, ingresos_usd, egresos_pen, egresos_usd, ganancia_pen, ganancia_usd, fecha_generacion)
                    VALUES ('Manual', ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    [
                        data.get('fecha_inicio'),
                        data.get('fecha_fin'),
                        data.get('ingresos_pen', 0.0),
                        data.get('ingresos_usd', 0.0),
                        data.get('egresos_pen', 0.0),
                        data.get('egresos_usd', 0.0),
                        data.get('ganancia_pen', 0.0),
                        data.get('ganancia_usd', 0.0),
                        now_str
                    ]
                )
                result = {"success": True, "message": "Reporte guardado exitosamente"}
            elif path == '/api/reset':
                await db.reset_system()
                result = {"success": True, "message": "Sistema restablecido por completo"}
            else:
                self.send_error_response(404, "Endpoint no encontrado")
                return

            self.send_json_response(200, result)

        except Exception as e:
            self.send_json_response(500, {"success": False, "error": str(e)})

    # ==========================================
    # STATIC FILE HANDLING
    # ==========================================
    def handle_static_file(self, path):
        relative_path = path.lstrip('/')
        if relative_path == '':
            relative_path = 'index.html'

        normalized_path = os.path.normpath(relative_path)
        if normalized_path.startswith('..') or os.path.isabs(normalized_path):
            self.send_error_response(403, "Acceso Prohibido")
            return

        file_path = os.path.join('frontend', normalized_path)
        if not os.path.exists(file_path) or not os.path.isfile(file_path):
            file_path = normalized_path

        if os.path.exists(file_path) and os.path.isfile(file_path):
            content_type = 'text/plain'
            if file_path.endswith('.html'):
                content_type = 'text/html; charset=utf-8'
            elif file_path.endswith('.css'):
                content_type = 'text/css; charset=utf-8'
            elif file_path.endswith('.js'):
                content_type = 'application/javascript; charset=utf-8'
            elif file_path.endswith('.json'):
                content_type = 'application/json; charset=utf-8'
            elif file_path.endswith('.png'):
                content_type = 'image/png'
            elif file_path.endswith('.jpg') or file_path.endswith('.jpeg'):
                content_type = 'image/jpeg'
            elif file_path.endswith('.svg'):
                content_type = 'image/svg+xml'
            elif file_path.endswith('.ico'):
                content_type = 'image/x-icon'

            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', os.path.getsize(file_path))
            self.end_headers()

            with open(file_path, 'rb') as f:
                self.wfile.write(f.read())
        else:
            if '.' not in path.split('/')[-1]:
                self.handle_static_file('/')
            else:
                self.send_error_response(404, "Archivo No Encontrado")

    def send_json_response(self, status, payload):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        response_bytes = json.dumps(payload).encode('utf-8')
        self.send_header('Content-Length', len(response_bytes))
        self.end_headers()
        self.wfile.write(response_bytes)

    def send_error_response(self, status, message):
        self.send_json_response(status, {"success": False, "error": message})

def run(port=8000):
    server_address = ('', port)
    httpd = HTTPServer(server_address, APIRequestHandler)
    print(f"Servidor Zona Mac Peru ejecutándose en http://localhost:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")

if __name__ == '__main__':
    port = int(os.getenv('PORT', 8000))
    run(port)
