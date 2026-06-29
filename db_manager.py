import os
import sqlite3

class DatabaseManager:
    def __init__(self, env=None):
        self.env = env
        if env and hasattr(env, 'DB') and env.DB is not None:
            self.mode = 'cloudflare'
            self.db = env.DB
        else:
            self.mode = 'local'
            db_path = os.getenv('DATABASE_URL', 'sistema_zm.db')
            self.conn = sqlite3.connect(db_path, check_same_thread=False)
            self.conn.row_factory = sqlite3.Row

    async def execute(self, sql, params=None):
        if params is None:
            params = []
        safe_params = []
        for p in params:
            if isinstance(p, bool):
                safe_params.append(1 if p else 0)
            else:
                safe_params.append(p)

        if self.mode == 'cloudflare':
            stmt = self.db.prepare(sql)
            if safe_params:
                stmt = stmt.bind(*safe_params)
            await stmt.run()
        else:
            cursor = self.conn.cursor()
            cursor.execute(sql, safe_params)
            self.conn.commit()

    async def query(self, sql, params=None):
        if params is None:
            params = []
        safe_params = []
        for p in params:
            if isinstance(p, bool):
                safe_params.append(1 if p else 0)
            else:
                safe_params.append(p)

        if self.mode == 'cloudflare':
            stmt = self.db.prepare(sql)
            if safe_params:
                stmt = stmt.bind(*safe_params)
            res = await stmt.all()
            results = res.results
            if not isinstance(results, list):
                results = list(results)
            return [dict(r) for r in results]
        else:
            cursor = self.conn.cursor()
            cursor.execute(sql, safe_params)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    async def init_db(self):
        # Self-healing migrations for existing tables (run unconditionally)
        try:
            # Check if table exists
            table_check = await self.query("SELECT name FROM sqlite_master WHERE type='table' AND name='ordenes_servicio'")
            if table_check:
                cols = await self.query("PRAGMA table_info(ordenes_servicio)")
                col_names = [col['name'] for col in cols]
                if 'cliente_nombre' not in col_names:
                    # SQLite table reconstruction migration to make contacto_id nullable and add new columns
                    migration_queries = [
                        "ALTER TABLE ordenes_servicio RENAME TO ordenes_servicio_old",
                        """
                        CREATE TABLE ordenes_servicio (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            contacto_id INTEGER,
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
                            cliente_nombre TEXT,
                            cliente_telefono TEXT,
                            cliente_email TEXT,
                            cliente_tipo_documento TEXT,
                            cliente_documento TEXT,
                            repuesto_id INTEGER,
                            repuesto_cantidad INTEGER DEFAULT 0,
                            repuesto_costo_usd REAL DEFAULT 0.0,
                            repuesto_costo_pen REAL DEFAULT 0.0,
                            FOREIGN KEY(contacto_id) REFERENCES contactos(id),
                            FOREIGN KEY(repuesto_id) REFERENCES productos(id)
                        );
                        """,
                        """
                        INSERT INTO ordenes_servicio (
                            id, contacto_id, equipo_modelo, equipo_serie_imei, estado_estetico, falla_reportada,
                            contrasena, estado, notas_tecnico, tecnico_asignado, costo_estimado_usd,
                            costo_estimado_pen, precio_venta_usd, precio_venta_pen, fecha_registro, fecha_entrega, garantia_servicio
                        )
                        SELECT 
                            id, contacto_id, equipo_modelo, equipo_serie_imei, estado_estetico, falla_reportada,
                            contrasena, estado, notas_tecnico, tecnico_asignado, costo_estimado_usd,
                            costo_estimado_pen, precio_venta_usd, precio_venta_pen, fecha_registro, fecha_entrega, garantia_servicio
                        FROM ordenes_servicio_old;
                        """,
                        "DROP TABLE ordenes_servicio_old"
                    ]
                    for mq in migration_queries:
                        await self.execute(mq)
        except Exception as e:
            print(f"Error migrating table ordenes_servicio: {e}")

        try:
            await self.execute("ALTER TABLE ordenes_servicio ADD COLUMN garantia_servicio TEXT DEFAULT 'Sin garantía'")
        except Exception:
            pass
        try:
            await self.execute("ALTER TABLE productos ADD COLUMN requiere_serie INTEGER DEFAULT 0")
        except Exception:
            pass
        try:
            await self.execute("ALTER TABLE productos ADD COLUMN series_disponibles TEXT DEFAULT '[]'")
        except Exception:
            pass
        try:
            await self.execute("ALTER TABLE ordenes_servicio ADD COLUMN tipo_comprobante TEXT")
        except Exception:
            pass
        try:
            await self.execute("ALTER TABLE ordenes_servicio ADD COLUMN numero_comprobante TEXT")
        except Exception:
            pass

        # Quick check if database is already initialized
        try:
            await self.query("SELECT 1 FROM reportes_financieros LIMIT 1")
            return
        except Exception:
            pass

        # Create all tables in proper order (dependencies first)
        queries = [
            """
            CREATE TABLE IF NOT EXISTS configuracion (
                clave TEXT PRIMARY KEY,
                valor TEXT
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS categorias (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT UNIQUE NOT NULL
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS contactos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tipo_contacto TEXT NOT NULL, -- 'Cliente', 'Proveedor', 'Ambos'
                tipo_documento TEXT NOT NULL, -- 'DNI', 'RUC', 'Pasaporte', 'CE'
                numero_documento TEXT UNIQUE NOT NULL,
                nombre TEXT NOT NULL,
                telefono TEXT,
                email TEXT,
                notas TEXT,
                catalogo_marcas TEXT
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS productos (
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
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS ordenes_servicio (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                contacto_id INTEGER,
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
                cliente_nombre TEXT,
                cliente_telefono TEXT,
                cliente_email TEXT,
                cliente_tipo_documento TEXT,
                cliente_documento TEXT,
                repuesto_id INTEGER,
                repuesto_cantidad INTEGER DEFAULT 0,
                repuesto_costo_usd REAL DEFAULT 0.0,
                repuesto_costo_pen REAL DEFAULT 0.0,
                FOREIGN KEY(contacto_id) REFERENCES contactos(id),
                FOREIGN KEY(repuesto_id) REFERENCES productos(id)
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS historial_ordenes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                orden_id INTEGER NOT NULL,
                estado_anterior TEXT,
                estado_nuevo TEXT NOT NULL,
                notas TEXT,
                fecha TEXT NOT NULL,
                FOREIGN KEY(orden_id) REFERENCES ordenes_servicio(id)
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS prestamos_repuestos (
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
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS ventas (
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
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS compras (
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
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS creditos_clientes (
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
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS abonos_clientes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                credito_id INTEGER NOT NULL,
                monto_usd REAL DEFAULT 0.0,
                monto_pen REAL DEFAULT 0.0,
                metodo_pago TEXT NOT NULL,
                fecha TEXT NOT NULL,
                FOREIGN KEY(credito_id) REFERENCES creditos_clientes(id)
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS creditos_proveedores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                contacto_id INTEGER NOT NULL,
                monto_total_usd REAL DEFAULT 0.0,
                monto_total_pen REAL DEFAULT 0.0,
                saldo_pendiente_usd REAL DEFAULT 0.0,
                saldo_pendiente_pen REAL DEFAULT 0.0,
                notas TEXT,
                estado TEXT NOT NULL,
                FOREIGN KEY(contacto_id) REFERENCES contactos(id)
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS abonos_proveedores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                credito_id INTEGER NOT NULL,
                monto_usd REAL DEFAULT 0.0,
                monto_pen REAL DEFAULT 0.0,
                metodo_pago TEXT NOT NULL,
                fecha TEXT NOT NULL,
                FOREIGN KEY(credito_id) REFERENCES creditos_proveedores(id)
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS cotizaciones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cliente_nombre TEXT NOT NULL,
                cliente_documento TEXT,
                fecha TEXT NOT NULL,
                total_usd REAL DEFAULT 0.0,
                total_pen REAL DEFAULT 0.0,
                items_json TEXT NOT NULL,
                estado TEXT DEFAULT 'Pendiente'
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS reportes_financieros (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tipo TEXT NOT NULL,
                rango_fechas TEXT NOT NULL,
                fecha_inicio TEXT NOT NULL,
                fecha_fin TEXT NOT NULL,
                ingresos REAL DEFAULT 0.0,
                ingresos_usd REAL DEFAULT 0.0,
                egresos REAL DEFAULT 0.0,
                egresos_usd REAL DEFAULT 0.0,
                ganancia_neta REAL DEFAULT 0.0,
                ganancia_neta_usd REAL DEFAULT 0.0,
                creado_en TEXT NOT NULL
            );
            """
        ]
        # Execute table creation queries sequentially and swallow exceptions to prevent crashing the worker
        try:
            for q in queries:
                await self.execute(q)

            # Migrations already performed at startup
            pass

            # Seed initial categories if table is empty
            cat_count = await self.query("SELECT COUNT(*) as count FROM categorias")
            if cat_count[0]['count'] == 0:
                default_categories = ['iPhone', 'Mac', 'iPad', 'AirPods', 'Apple Watch', 'Accesorios Apple', 'Genéricos', 'Repuestos', 'Otros']
                for cat in default_categories:
                    await self.execute("INSERT OR IGNORE INTO categorias (nombre) VALUES (?)", [cat])

            # Seed initial configuration if table is empty
            config_count = await self.query("SELECT COUNT(*) as count FROM configuracion")
            if config_count[0]['count'] == 0:
                default_config = {
                    'business_name': 'Zona Mac Peru',
                    'business_address': 'Av. Petit Thouars 5356 Miraflores, Lima',
                    'business_ruc': '10446507309',
                    'business_phone': '+51 941 995 237',
                    'social_instagram': 'https://instagram.com/zonamacperu',
                    'social_facebook': 'https://facebook.com/zonamacperu',
                    'google_business_url': 'https://g.page/zonamacperu',
                    'logo_url': 'logo.jpg',
                    'exchange_rate': '3.75'
                }
                for k, v in default_config.items():
                    await self.execute("INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?, ?)", [k, v])
        except Exception as e:
            print(f"Error silenciado durante init_db: {e}")
    async def reset_system(self):
        tables_to_drop = [
            "abonos_clientes", "creditos_clientes",
            "abonos_proveedores", "creditos_proveedores",
            "prestamos_repuestos", "historial_ordenes",
            "ordenes_servicio", "productos", "contactos",
            "categorias", "ventas", "compras", "cotizaciones", "configuracion", "reportes_financieros"
        ]
        for t in tables_to_drop:
            try:
                await self.execute(f"DROP TABLE IF EXISTS {t}")
            except Exception:
                pass
        
        await self.init_db()
