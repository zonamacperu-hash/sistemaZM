// ==========================================================================
// STATE MANAGEMENT & GLOBALS
// ==========================================================================

let appState = {
    exchangeRate: 3.75,
    config: {},
    cart: [],
    quoteItems: [],
    activeView: 'dashboard',
    charts: {}
};

const API_BASE = '';

// Helper for API requests
async function fetchAPI(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const defaultHeaders = {
        'Content-Type': 'application/json'
    };
    
    options.headers = { ...defaultHeaders, ...options.headers };
    if (options.body && typeof options.body === 'object') {
        options.body = JSON.stringify(options.body);
    }

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`API Error on ${endpoint}:`, error);
        showNotification(error.message || 'Error de conexión', 'error');
        throw error;
    }
}

// UI Notification Toast
function showNotification(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.position = 'fixed';
        container.style.bottom = '24px';
        container.style.right = '24px';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '10px';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '8px';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = '600';
    toast.style.color = '#fff';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    toast.style.transition = 'all 0.3s ease';
    toast.style.transform = 'translateY(20px)';
    toast.style.opacity = '0';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '8px';

    if (type === 'error') {
        toast.style.backgroundColor = '#ff3b30';
        toast.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> ${message}`;
    } else if (type === 'warning') {
        toast.style.backgroundColor = '#ff9500';
        toast.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${message}`;
    } else {
        toast.style.backgroundColor = '#34c759';
        toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${message}`;
    }

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.transform = 'translateY(0)';
        toast.style.opacity = '1';
    }, 10);

    setTimeout(() => {
        toast.style.transform = 'translateY(-20px)';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Modal Controllers
function showModal(title, contentHTML) {
    const modal = document.getElementById('general-modal');
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-body').innerHTML = contentHTML;
    modal.classList.add('active');
}

function closeModal() {
    const modal = document.getElementById('general-modal');
    modal.classList.remove('active');
}

// ==========================================
// SPA ROUTER
// ==========================================

const routes = {
    'dashboard': renderDashboard,
    'pos': renderPOS,
    'reparaciones': renderReparaciones,
    'inventario': renderInventario,
    'contactos': renderContactos,
    'prestamos': renderPrestamos,
    'creditos': renderCreditos,
    'cotizaciones': renderCotizaciones,
    'historial-comercial': renderHistorialComercial,
    'configuracion': renderConfiguracion
};

function handleRouting() {
    const hash = window.location.hash.substring(1) || 'dashboard';
    appState.activeView = hash;

    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
        if (item.getAttribute('data-view') === hash) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    const titleMap = {
        'dashboard': 'Dashboard de Control',
        'pos': 'Punto de Venta (POS) & Caja',
        'reparaciones': 'Servicio Técnico Especializado',
        'inventario': 'Catálogo de Inventario Dinámico',
        'contactos': 'Directorio de Contactos (Clientes y Proveedores)',
        'prestamos': 'Préstamos Intertienda y Consignación',
        'creditos': 'Control de Créditos y Financiamiento',
        'cotizaciones': 'Generador Independiente de Cotizaciones',
        'historial-comercial': 'Historial de Compras y Ventas',
        'configuracion': 'Configuración del Sistema'
    };
    document.getElementById('view-title').innerText = titleMap[hash] || 'Zona Mac Peru';

    if (routes[hash]) {
        routes[hash]();
    } else {
        renderDashboard();
    }
}

// Initialize Theme
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark-theme';
    document.body.className = savedTheme;

    document.getElementById('theme-toggle-btn').addEventListener('click', () => {
        if (document.body.classList.contains('dark-theme')) {
            document.body.className = 'light-theme';
            localStorage.setItem('theme', 'light-theme');
        } else {
            document.body.className = 'dark-theme';
            localStorage.setItem('theme', 'dark-theme');
        }
        if (appState.activeView === 'dashboard') {
            renderDashboard();
        }
    });
}

// Fetch configs
async function fetchExchangeRateAndConfig() {
    try {
        const config = await fetchAPI('/api/config');
        appState.config = config;
        appState.exchangeRate = parseFloat(config.exchange_rate) || 3.75;
        document.getElementById('topbar-exchange-rate').innerText = `S/ ${appState.exchangeRate.toFixed(2)}`;
    } catch (e) {
        console.error("Failed to load configs", e);
    }
}

// ==========================================
// RENDER VIEW: DASHBOARD
// ==========================================

async function renderDashboard() {
    const container = document.getElementById('viewport');
    container.innerHTML = `
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-icon"><i class="fa-solid fa-coins"></i></div>
                <div class="metric-info">
                    <span class="metric-label">Ventas de Hoy</span>
                    <span class="metric-value" id="dash-sales-today">S/ 0.00</span>
                    <span class="metric-sub" id="dash-sales-today-usd">$0.00 (0 Transacciones)</span>
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-icon"><i class="fa-solid fa-calendar-check"></i></div>
                <div class="metric-info">
                    <span class="metric-label">Ventas del Mes</span>
                    <span class="metric-value" id="dash-sales-month">S/ 0.00</span>
                    <span class="metric-sub" id="dash-sales-month-usd">$0.00</span>
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-icon"><i class="fa-solid fa-screwdriver-wrench"></i></div>
                <div class="metric-info">
                    <span class="metric-label">Soporte Técnico Activo</span>
                    <span class="metric-value" id="dash-active-support">0</span>
                    <span class="metric-sub">Órdenes en taller</span>
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-icon"><i class="fa-solid fa-arrow-trend-up"></i></div>
                <div class="metric-info">
                    <span class="metric-label">Cuentas por Cobrar</span>
                    <span class="metric-value" id="dash-receivables">S/ 0.00</span>
                    <span class="metric-sub" id="dash-receivables-usd">$0.00 pendiente</span>
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-icon"><i class="fa-solid fa-arrow-trend-down"></i></div>
                <div class="metric-info">
                    <span class="metric-label">Cuentas por Pagar</span>
                    <span class="metric-value" id="dash-payables">S/ 0.00</span>
                    <span class="metric-sub" id="dash-payables-usd">$0.00 pendiente</span>
                </div>
            </div>
        </div>

        <div class="dashboard-charts">
            <div class="card">
                <h3 class="card-title">Flujo de Caja Mensual (Soles)</h3>
                <div style="height: 250px;"><canvas id="chart-flow"></canvas></div>
            </div>
            <div class="card">
                <h3 class="card-title">Estatus de Reparaciones</h3>
                <div style="height: 250px; display: flex; justify-content: center;"><canvas id="chart-support" style="max-width: 250px;"></canvas></div>
            </div>
        </div>

        <div class="dashboard-tables">
            <div class="card">
                <div class="card-title">
                    <span>Últimas Ventas</span>
                    <button class="btn btn-secondary btn-xs" onclick="window.location.hash='#pos'"><i class="fa-solid fa-plus"></i> Nueva Venta</button>
                </div>
                <div class="table-responsive">
                    <table class="table-main">
                        <thead>
                            <tr>
                                <th>Doc / Número</th>
                                <th>Contacto</th>
                                <th>Fecha</th>
                                <th>Monto Soles</th>
                                <th>Monto USD</th>
                            </tr>
                        </thead>
                        <tbody id="dash-sales-table">
                            <tr><td colspan="5" style="text-align: center;">Cargando...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="card">
                <div class="card-title">
                    <span>Órdenes Técnicas Recientes</span>
                    <button class="btn btn-secondary btn-xs" onclick="window.location.hash='#reparaciones'"><i class="fa-solid fa-plus"></i> Nuevo Ingreso</button>
                </div>
                <div class="table-responsive">
                    <table class="table-main">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Contacto</th>
                                <th>Equipo</th>
                                <th>Estado</th>
                                <th>Registro</th>
                            </tr>
                        </thead>
                        <tbody id="dash-support-table">
                            <tr><td colspan="5" style="text-align: center;">Cargando...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    try {
        const stats = await fetchAPI('/api/dashboard');
        
        document.getElementById('dash-sales-today').innerText = `S/ ${(stats.sales_today.pen).toFixed(2)}`;
        document.getElementById('dash-sales-today-usd').innerText = `$${(stats.sales_today.usd).toFixed(2)} (${stats.sales_today.count} Ventas)`;
        
        document.getElementById('dash-sales-month').innerText = `S/ ${(stats.sales_month.pen).toFixed(2)}`;
        document.getElementById('dash-sales-month-usd').innerText = `$${(stats.sales_month.usd).toFixed(2)}`;
        
        document.getElementById('dash-active-support').innerText = stats.active_support;

        document.getElementById('dash-receivables').innerText = `S/ ${(stats.accounts_receivable.pen).toFixed(2)}`;
        document.getElementById('dash-receivables-usd').innerText = `$${(stats.accounts_receivable.usd).toFixed(2)}`;

        document.getElementById('dash-payables').innerText = `S/ ${(stats.accounts_payable.pen).toFixed(2)}`;
        document.getElementById('dash-payables-usd').innerText = `$${(stats.accounts_payable.usd).toFixed(2)}`;

        const salesTbody = document.getElementById('dash-sales-table');
        if (stats.recent_sales.length === 0) {
            salesTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">No se registran ventas recientes.</td></tr>`;
        } else {
            salesTbody.innerHTML = stats.recent_sales.map(s => `
                <tr>
                    <td><strong>${s.tipo_documento}</strong><br><small style="color: var(--text-secondary);">${s.numero_documento}</small></td>
                    <td>${s.cliente_nombre}</td>
                    <td>${s.fecha.split('T')[0]}</td>
                    <td>S/ ${s.total_pen.toFixed(2)}</td>
                    <td>$ ${s.total_usd.toFixed(2)}</td>
                </tr>
            `).join('');
        }

        const supportTbody = document.getElementById('dash-support-table');
        if (stats.recent_support.length === 0) {
            supportTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">No hay órdenes de servicio.</td></tr>`;
        } else {
            supportTbody.innerHTML = stats.recent_support.map(o => {
                let statusOrWarrantyHTML = '';
                if (o.estado === 'Entregado') {
                    const active = checkServiceWarrantyActive(o.fecha_entrega, o.garantia_servicio);
                    statusOrWarrantyHTML = active 
                        ? `<span class="badge" style="background-color: rgba(48, 209, 88, 0.15); color: var(--success-color); font-weight: 700; font-size:10px;">[ GARANTÍA ]</span>`
                        : `<span class="badge" style="background-color: rgba(255, 69, 58, 0.15); color: var(--danger-color); font-weight: 700; font-size:10px;">[ GARANTÍA EXPIRADA ]</span>`;
                } else {
                    statusOrWarrantyHTML = `<span class="badge badge-${o.estado.toLowerCase().replace(/á/g, 'a').replace(/ó/g, 'o').replace(/ /g, '-')}">${o.estado}</span>`;
                }
                return `
                    <tr>
                        <td>#${o.id}</td>
                        <td>${o.cliente_nombre}</td>
                        <td><strong>${o.equipo_modelo}</strong><br><small style="color: var(--text-secondary);">${o.equipo_serie_imei}</small></td>
                        <td>${statusOrWarrantyHTML}</td>
                        <td>${o.fecha_registro.split('T')[0]}</td>
                    </tr>
                `;
            }).join('');
        }

        if (appState.charts.flow) appState.charts.flow.destroy();
        if (appState.charts.support) appState.charts.support.destroy();

        const isDark = document.body.classList.contains('dark-theme');
        const textClr = isDark ? '#ffffff' : '#1d1d1f';
        const borderClr = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

        const months = stats.monthly_flow.map(f => f.mes);
        const flowDataPen = stats.monthly_flow.map(f => f.total_pen);
        const flowCtx = document.getElementById('chart-flow').getContext('2d');
        appState.charts.flow = new Chart(flowCtx, {
            type: 'bar',
            data: {
                labels: months.length > 0 ? months : ['Sin Datos'],
                datasets: [{
                    label: 'Flujo de Ventas (S/)',
                    data: flowDataPen.length > 0 ? flowDataPen : [0],
                    backgroundColor: '#0071e3',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: textClr } }
                },
                scales: {
                    x: { grid: { color: borderClr }, ticks: { color: textClr } },
                    y: { grid: { color: borderClr }, ticks: { color: textClr } }
                }
            }
        });

        const supportLabels = stats.support_status.map(s => s.estado);
        const supportCounts = stats.support_status.map(s => s.count);
        const supportCtx = document.getElementById('chart-support').getContext('2d');
        appState.charts.support = new Chart(supportCtx, {
            type: 'doughnut',
            data: {
                labels: supportLabels.length > 0 ? supportLabels : ['Ninguna'],
                datasets: [{
                    data: supportCounts.length > 0 ? supportCounts : [0],
                    backgroundColor: ['#8e8e93', '#0a84ff', '#ff9f0a', '#30d158', '#ff453a', '#bf5af2'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { 
                        position: 'bottom',
                        labels: { color: textClr } 
                    }
                }
            }
        });

    } catch (e) {
        console.error("Dashboard render failed", e);
    }
}

// ==========================================
// RENDER VIEW: POS & CAJA
// ==========================================

async function renderPOS() {
    const container = document.getElementById('viewport');
    container.innerHTML = `
        <div class="pos-layout">
            <div class="pos-products">
                <div class="pos-search-bar card">
                    <input type="text" id="pos-search-input" class="form-control" style="flex: 1;" placeholder="Buscar producto por SKU, código o nombre...">
                    <select id="pos-category-filter" class="form-control" style="width: 180px;">
                        <option value="">Todas las Categorías</option>
                    </select>
                </div>
                <div class="pos-grid" id="pos-products-grid">
                    <div style="text-align: center; grid-column: 1/-1; padding: 40px; color: var(--text-secondary);">
                        <i class="fa-solid fa-spinner fa-spin" style="font-size: 24px; margin-bottom: 10px;"></i><br>Cargando catálogo...
                    </div>
                </div>
            </div>

            <div class="pos-cart">
                <div class="cart-header">
                    <h3>Carrito de Venta</h3>
                    <button class="btn btn-secondary btn-xs" id="btn-clear-cart" style="color: var(--danger-color); border-color: rgba(255, 69, 58, 0.2);"><i class="fa-solid fa-trash-can"></i> Limpiar</button>
                </div>
                <div class="cart-items" id="pos-cart-items">
                    <div style="text-align: center; margin-top: 50px; color: var(--text-secondary);">
                        <i class="fa-solid fa-cart-shopping" style="font-size: 32px; margin-bottom: 12px; opacity: 0.3;"></i>
                        <p>El carrito está vacío</p>
                    </div>
                </div>
                <div class="cart-totals">
                    <div class="form-group" style="margin-bottom: 10px;">
                        <label>Cliente Asignado *</label>
                        <div style="display: flex; gap: 8px;">
                            <select id="pos-client-select" class="form-control" style="flex: 1;">
                                <option value="">Seleccione Cliente...</option>
                            </select>
                            <button class="btn btn-secondary" onclick="openCreateContactModal()" title="Registrar Contacto Nuevo"><i class="fa-solid fa-user-plus"></i></button>
                        </div>
                    </div>

                    <div class="form-group" style="margin-bottom: 10px;">
                        <label>Comprobante</label>
                        <select id="pos-doc-type" class="form-control">
                            <option value="Nota de Venta">Nota de Venta</option>
                            <option value="Boleta">Boleta de Venta</option>
                            <option value="Factura">Factura (IGV 18%)</option>
                            <option value="Recibo por Honorarios">Recibo por Honorarios</option>
                        </select>
                    </div>

                    <!-- Payment Button Pills (Responsive Grid wrapping, solves Chrome overflow) -->
                    <div class="form-group" style="margin-bottom: 10px;">
                        <label>Método de Pago *</label>
                        <div class="payment-pills" id="pos-payment-pills">
                            <button type="button" class="pay-pill active" data-value="Efectivo"><i class="fa-solid fa-money-bill-wave"></i> Efectivo</button>
                            <button type="button" class="pay-pill" data-value="Tarjeta"><i class="fa-solid fa-credit-card"></i> Tarjeta</button>
                            <button type="button" class="pay-pill" data-value="Transferencia"><i class="fa-solid fa-building-columns"></i> Transf.</button>
                            <button type="button" class="pay-pill" data-value="Yape/Plin"><i class="fa-solid fa-mobile-screen-button"></i> Yape/Plin</button>
                            <button type="button" class="pay-pill" data-value="Crédito"><i class="fa-solid fa-clock"></i> Crédito</button>
                        </div>
                    </div>

                    <div class="form-group" id="pos-credit-options" style="display: none; margin-bottom: 10px;">
                        <label>Límite de Crédito Permitido (Bimoneda)</label>
                        <div class="form-row">
                            <input type="number" id="pos-credit-limit-pen" class="form-control" placeholder="Límite S/" value="0.0">
                            <input type="number" id="pos-credit-limit-usd" class="form-control" placeholder="Límite $" value="0.0">
                        </div>
                    </div>

                    <div class="total-row">
                        <span>Subtotal (PEN):</span>
                        <span id="pos-subtotal-pen">S/ 0.00</span>
                    </div>
                    <div class="total-row" id="pos-igv-row-pen" style="display: none; color: var(--text-secondary);">
                        <span>IGV (18% incluido) (PEN):</span>
                        <span id="pos-igv-pen">S/ 0.00</span>
                    </div>
                    <div class="total-row grand-total">
                        <span>Total (PEN):</span>
                        <span id="pos-total-pen">S/ 0.00</span>
                    </div>
                    <div class="total-row" style="font-size: 13px; border-top: 1px dashed var(--border-color); padding-top: 6px; color: var(--text-secondary);">
                        <span>Total Equivalente (USD):</span>
                        <span id="pos-total-usd">$0.00</span>
                    </div>

                    <button class="btn btn-primary" id="btn-process-sale" style="width: 100%; padding: 14px; margin-top: 6px;"><i class="fa-solid fa-circle-check"></i> PROCESAR VENTA</button>
                </div>
            </div>
        </div>
    `;

    try {
        const [contacts, categories, products] = await Promise.all([
            fetchAPI('/api/contacts'),
            fetchAPI('/api/categories'),
            fetchAPI('/api/products')
        ]);

        const clientSelect = document.getElementById('pos-client-select');
        contacts.filter(c => c.tipo_contacto === 'Cliente' || c.tipo_contacto === 'Ambos').forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.innerText = `${c.nombre} (${c.numero_documento})`;
            clientSelect.appendChild(opt);
        });

        const catSelect = document.getElementById('pos-category-filter');
        categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.innerText = cat.nombre;
            catSelect.appendChild(opt);
        });

        // Pill click listeners
        document.querySelectorAll('#pos-payment-pills .pay-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                document.querySelectorAll('#pos-payment-pills .pay-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                const selectedMethod = pill.getAttribute('data-value');
                document.getElementById('pos-credit-options').style.display = selectedMethod === 'Crédito' ? 'block' : 'none';
            });
        });

        const searchInput = document.getElementById('pos-search-input');
        const categoryFilter = document.getElementById('pos-category-filter');
        
        const filterProducts = () => {
            const query = searchInput.value.toLowerCase();
            const catId = categoryFilter.value;
            
            const filtered = products.filter(p => {
                const matchesSearch = p.nombre.toLowerCase().includes(query) || p.codigo.toLowerCase().includes(query);
                const matchesCategory = catId === "" || p.categoria_id == catId;
                return matchesSearch && matchesCategory;
            });
            renderPOSGrid(filtered);
        };

        searchInput.addEventListener('input', filterProducts);
        categoryFilter.addEventListener('change', filterProducts);

        const docSelect = document.getElementById('pos-doc-type');
        docSelect.addEventListener('change', () => {
            const isFactura = docSelect.value === 'Factura';
            document.getElementById('pos-igv-row-pen').style.display = isFactura ? 'flex' : 'none';
            updateCartTotals();
        });

        document.getElementById('btn-clear-cart').addEventListener('click', () => {
            appState.cart = [];
            updateCartUI();
        });

        document.getElementById('btn-process-sale').addEventListener('click', processPOSSale);

        renderPOSGrid(products);

    } catch (e) {
        console.error("POS render failed", e);
    }
}

// POS grid and cart functions helper reuse
// (Re-declaring names locally to prevent conflicts in script scope)
// ==========================================

async function processPOSSale() {
    const clientSelect = document.getElementById('pos-client-select');
    const clientId = clientSelect.value;
    const docType = document.getElementById('pos-doc-type').value;
    
    // Read method from active pill button
    const activePill = document.querySelector('#pos-payment-pills .pay-pill.active');
    const payMethod = activePill ? activePill.getAttribute('data-value') : 'Efectivo';

    if (!clientId) {
        showNotification("Debe asignar un cliente para procesar la venta", 'error');
        return;
    }
    if (appState.cart.length === 0) {
        showNotification("El carrito está vacío", 'error');
        return;
    }

    // Validar números de serie requeridos
    for (const item of appState.cart) {
        if (item.requiere_serie === 1) {
            const seriesSelected = item.series || [];
            if (seriesSelected.length !== item.cantidad) {
                showNotification(`Debe seleccionar exactamente ${item.cantidad} número(s) de serie para el producto ${item.nombre}`, 'error');
                return;
            }
        }
    }

    const payload = {
        cliente_id: parseInt(clientId),
        tipo_documento: docType,
        metodo_pago: payMethod,
        items: appState.cart.map(item => ({
            producto_id: item.id,
            cantidad: item.cantidad,
            precio_unitario_usd: item.precio_venta_usd,
            precio_unitario_pen: item.precio_venta_pen,
            garantia: item.garantia || "Sin garantía",
            series: item.series || []
        }))
    };

    if (payMethod === 'Crédito') {
        payload.limite_credito_pen = parseFloat(document.getElementById('pos-credit-limit-pen').value) || 0.0;
        payload.limite_credito_usd = parseFloat(document.getElementById('pos-credit-limit-usd').value) || 0.0;
    }

    try {
        const result = await fetchAPI('/api/sales/create', {
            method: 'POST',
            body: payload
        });

        if (result.success) {
            showNotification(result.message, 'success');
            appState.cart = [];
            updateCartUI();
            openReceiptPrintModal(result.venta_id);
        } else {
            showNotification(result.error || "Ocurrió un error al procesar venta", 'error');
        }
    } catch (e) {
        console.error(e);
    }
}

// ==========================================
// RENDER VIEW: SOPORTE TÉCNICO
// ==========================================

async function renderReparaciones() {
    const container = document.getElementById('viewport');
    container.innerHTML = `
        <div class="card">
            <div class="card-title">
                <span>Lista de Órdenes de Ingreso</span>
                <button class="btn btn-primary" onclick="openCreateOrderModal()"><i class="fa-solid fa-plus"></i> Registrar Orden de Servicio</button>
            </div>
            <div class="pos-search-bar" style="margin-bottom: 20px;">
                <input type="text" id="order-search" class="form-control" style="flex: 1;" placeholder="Buscar orden por modelo, serie, IMEI o cliente...">
                <select id="order-state-filter" class="form-control" style="width: 200px;">
                    <option value="">Todos los Estados</option>
                    <option value="Recibido">Recibido</option>
                    <option value="En Diagnóstico">En Diagnóstico</option>
                    <option value="Esperando Repuesto">Esperando Repuesto</option>
                    <option value="Reparado">Reparado</option>
                    <option value="Entregado">Entregado</option>
                    <option value="Sin Reparación">Sin Reparación</option>
                </select>
            </div>
            <div class="table-responsive">
                <table class="table-main">
                    <thead>
                        <tr>
                            <th>Nº Orden</th>
                            <th>Contacto</th>
                            <th>Equipo / Serie o IMEI</th>
                            <th>Falla Reportada</th>
                            <th>Estado</th>
                            <th>Técnico</th>
                            <th>Presupuesto (PEN)</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="orders-tbody">
                        <tr><td colspan="8" style="text-align: center;">Cargando órdenes...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    try {
        const orders = await fetchAPI('/api/orders');
        const ordersTbody = document.getElementById('orders-tbody');

        const renderTable = (list) => {
            if (list.length === 0) {
                ordersTbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-secondary);">No se registran órdenes de servicio técnico.</td></tr>`;
                return;
            }
            
            ordersTbody.innerHTML = list.map(o => {
                let statusOrWarrantyHTML = '';
                if (o.estado === 'Entregado') {
                    const active = checkServiceWarrantyActive(o.fecha_entrega, o.garantia_servicio);
                    statusOrWarrantyHTML = active 
                        ? `<span class="badge" style="background-color: rgba(48, 209, 88, 0.15); color: var(--success-color); font-weight: 700; font-size:10px;">[ GARANTÍA ]</span>`
                        : `<span class="badge" style="background-color: rgba(255, 69, 58, 0.15); color: var(--danger-color); font-weight: 700; font-size:10px;">[ GARANTÍA EXPIRADA ]</span>`;
                } else {
                    statusOrWarrantyHTML = `<span class="badge badge-${o.estado.toLowerCase().replace(/á/g, 'a').replace(/ó/g, 'o').replace(/ /g, '-')}">${o.estado}</span>`;
                }
                return `
                    <tr>
                        <td><strong>#${o.id}</strong><br><small style="color: var(--text-secondary);">${o.fecha_registro.split('T')[0]}</small></td>
                        <td>${o.cliente_nombre}<br><small style="color: var(--text-secondary);">${o.cliente_telefono || ''}</small></td>
                        <td><strong>${o.equipo_modelo}</strong><br><small style="color: var(--text-secondary);">${o.equipo_serie_imei}</small></td>
                        <td>${o.falla_reportada}</td>
                        <td>
                            ${statusOrWarrantyHTML}
                        </td>
                        <td>${o.tecnico_asignado || '<em>No Asignado</em>'}</td>
                        <td>S/ ${o.precio_venta_pen.toFixed(2)}</td>
                        <td>
                            <div style="display: flex; gap: 6px;">
                                <button class="btn btn-secondary btn-xs" onclick="openOrderDetailModal(${o.id})" title="Detalles e Historial Clínico"><i class="fa-solid fa-eye"></i></button>
                                <button class="btn btn-primary btn-xs" onclick="openUpdateStatusModal(${o.id})" title="Actualizar Estado Técnico"><i class="fa-solid fa-pen-to-square"></i> Estado</button>
                                <button class="btn btn-secondary btn-xs" onclick="printReceipt(${o.id})" title="Imprimir Constancia"><i class="fa-solid fa-print"></i></button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        };

        const searchInput = document.getElementById('order-search');
        const stateFilter = document.getElementById('order-state-filter');

        const filterOrders = () => {
            const query = searchInput.value.toLowerCase();
            const state = stateFilter.value;
            
            const filtered = orders.filter(o => {
                const matchesSearch = o.equipo_modelo.toLowerCase().includes(query) || 
                                      o.equipo_serie_imei.toLowerCase().includes(query) || 
                                      o.cliente_nombre.toLowerCase().includes(query) || 
                                      String(o.id).includes(query);
                const matchesState = state === "" || o.estado === state;
                return matchesSearch && matchesState;
            });
            renderTable(filtered);
        };

        searchInput.addEventListener('input', filterOrders);
        stateFilter.addEventListener('change', filterOrders);

        renderTable(orders);

    } catch (e) {
        console.error(e);
    }
}

async function openCreateOrderModal() {
    try {
        const contacts = await fetchAPI('/api/contacts');
        const clientOptions = contacts.filter(c => c.tipo_contacto === 'Cliente' || c.tipo_contacto === 'Ambos')
                                       .map(c => `<option value="${c.id}">${c.nombre} (${c.numero_documento})</option>`).join('');

        const html = `
            <form id="create-order-form" onsubmit="submitCreateOrder(event)">
                <div class="form-group">
                    <label>Asociar Cliente/Contacto *</label>
                    <select id="ord-cliente-id" class="form-control" required>
                        <option value="">Seleccione...</option>
                        ${clientOptions}
                    </select>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Modelo del Equipo *</label>
                        <input type="text" id="ord-modelo" class="form-control" required placeholder="Modelo Apple o multimarca">
                    </div>
                    <div class="form-group">
                        <label>Número de Serie / IMEI *</label>
                        <input type="text" id="ord-serie" class="form-control" required placeholder="IMEI o Número de Serie">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Estado Estético del Equipo</label>
                        <input type="text" id="ord-estetico" class="form-control" placeholder="ej: Raspaduras leves">
                    </div>
                    <div class="form-group">
                        <label>Contraseña de Bloqueo</label>
                        <input type="text" id="ord-contrasena" class="form-control" placeholder="Contraseña de bloqueo">
                    </div>
                </div>
                <div class="form-group">
                    <label>Falla Reportada *</label>
                    <textarea id="ord-falla" class="form-control" rows="3" required placeholder="Describa el problema..."></textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Presupuesto Inicial (USD)</label>
                        <input type="number" step="0.01" id="ord-costo-usd" class="form-control" value="0.0" oninput="convertPriceInput('ord-costo-usd', 'ord-costo-pen', 'toPEN')">
                    </div>
                    <div class="form-group">
                        <label>Presupuesto Inicial (PEN)</label>
                        <input type="number" step="0.01" id="ord-costo-pen" class="form-control" value="0.0" oninput="convertPriceInput('ord-costo-usd', 'ord-costo-pen', 'toUSD')">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Técnico Asignado</label>
                        <input type="text" id="ord-tecnico" class="form-control" placeholder="Nombre del técnico responsable">
                    </div>
                    <div class="form-group">
                        <label>Notas Técnicas Internas</label>
                        <input type="text" id="ord-notas" class="form-control" placeholder="Notas de diagnóstico inicial">
                    </div>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px;">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Registrar Orden</button>
                </div>
            </form>
        `;
        showModal("Nueva Orden de Servicio Técnico", html);
    } catch (e) {
        console.error(e);
    }
}

// ==========================================
// RENDER VIEW: DIRECTORIO UNIFICADO DE CONTACTOS
// ==========================================

async function renderContactos() {
    const container = document.getElementById('viewport');
    container.innerHTML = `
        <div class="card">
            <div class="card-title">
                <span>Directorio Unificado de Contactos</span>
                <button class="btn btn-primary" onclick="openCreateContactModal()"><i class="fa-solid fa-user-plus"></i> Registrar Contacto</button>
            </div>
            <div class="pos-search-bar" style="margin-bottom: 20px;">
                <input type="text" id="contact-search" class="form-control" style="flex: 1;" placeholder="Buscar contacto por documento o nombre...">
                <select id="contact-type-filter" class="form-control" style="width: 200px;">
                    <option value="">Todos los Tipos</option>
                    <option value="Cliente">Clientes</option>
                    <option value="Proveedor">Proveedores</option>
                    <option value="Ambos">Ambos (Cliente/Proveedor)</option>
                </select>
            </div>
            <div class="table-responsive">
                <table class="table-main">
                    <thead>
                        <tr>
                            <th>Tipo</th>
                            <th>Documento</th>
                            <th>Nombres / Razón Social</th>
                            <th>Teléfono</th>
                            <th>Email</th>
                            <th>Marcas (Proveedor)</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="contacts-tbody">
                        <tr><td colspan="7" style="text-align: center;">Cargando directorio...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    try {
        const contacts = await fetchAPI('/api/contacts');
        const contactsTbody = document.getElementById('contacts-tbody');

        const renderTable = (list) => {
            if (list.length === 0) {
                contactsTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary);">No se registran contactos en el directorio.</td></tr>`;
                return;
            }
            
            contactsTbody.innerHTML = list.map(c => `
                <tr>
                    <td><span class="badge ${c.tipo_contacto === 'Cliente' ? 'badge-activo' : c.tipo_contacto === 'Proveedor' ? 'badge-repuesto' : 'badge-diagnostico'}">${c.tipo_contacto}</span></td>
                    <td><small style="color:var(--text-secondary);">${c.tipo_documento}:</small> <strong>${c.numero_documento}</strong></td>
                    <td><strong>${c.nombre}</strong></td>
                    <td>${c.telefono || '<em>No registrado</em>'}</td>
                    <td>${c.email || '<em>No registrado</em>'}</td>
                    <td><span style="font-size:12px; color:var(--text-secondary);">${c.catalogo_marcas || ''}</span></td>
                    <td>
                        <div style="display: flex; gap: 6px;">
                            <button class="btn btn-secondary btn-xs" onclick="openContactDetailModal(${c.id})" title="Historial Clínico, Ventas y Crédito Neto"><i class="fa-solid fa-clock-rotate-left"></i> Historial y Finanzas</button>
                            <button class="btn btn-secondary btn-xs" onclick="openEditContactModal(${JSON.stringify(c).replace(/"/g, '&quot;')})" title="Editar Datos"><i class="fa-solid fa-pen"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');
        };

        const searchInput = document.getElementById('contact-search');
        const typeFilter = document.getElementById('contact-type-filter');

        const filterContacts = () => {
            const query = searchInput.value.toLowerCase();
            const type = typeFilter.value;
            
            const filtered = contacts.filter(c => {
                const matchesSearch = c.nombre.toLowerCase().includes(query) || c.numero_documento.includes(query);
                const matchesType = type === "" || c.tipo_contacto === type;
                return matchesSearch && matchesType;
            });
            renderTable(filtered);
        };

        searchInput.addEventListener('input', filterContacts);
        typeFilter.addEventListener('change', filterContacts);

        renderTable(contacts);

    } catch (e) {
        console.error(e);
    }
}

function openCreateContactModal() {
    const html = `
        <form id="create-contact-form" onsubmit="submitCreateContact(event)">
            <div class="form-row">
                <div class="form-group">
                    <label>Tipo de Contacto *</label>
                    <select id="cnt-tipo-contacto" class="form-control" required onchange="toggleMarksField('cnt-tipo-contacto', 'cnt-marcas-group')">
                        <option value="Cliente">Cliente</option>
                        <option value="Proveedor">Proveedor</option>
                        <option value="Ambos">Ambos (Cliente & Proveedor)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Tipo Documento *</label>
                    <select id="cnt-tipo-doc" class="form-control" required>
                        <option value="DNI">DNI (Persona)</option>
                        <option value="RUC">RUC (Empresa)</option>
                        <option value="Pasaporte">Pasaporte</option>
                        <option value="CE">Carnet de Extranjería</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Número Documento *</label>
                    <input type="text" id="cnt-num-doc" class="form-control" required placeholder="Número identificador">
                </div>
                <div class="form-group">
                    <label>Nombres Completos / Razón Social *</label>
                    <input type="text" id="cnt-nombre" class="form-control" required placeholder="Nombres o Razón Social">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Teléfono Celular</label>
                    <input type="text" id="cnt-telefono" class="form-control" placeholder="+51 9...">
                </div>
                <div class="form-group">
                    <label>Correo Electrónico</label>
                    <input type="email" id="cnt-email" class="form-control" placeholder="correo@ejemplo.com">
                </div>
            </div>
            <div class="form-group" id="cnt-marcas-group" style="display: none;">
                <label>Catálogo de marcas / repuestos que surte (Solo Proveedores)</label>
                <input type="text" id="cnt-marcas" class="form-control" placeholder="ej: Baterías, Pantallas Apple">
            </div>
            <div class="form-group">
                <label>Notas de Perfil / Observaciones</label>
                <textarea id="cnt-notas" class="form-control" rows="2" placeholder="Observaciones generales..."></textarea>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px;">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                <button type="submit" class="btn btn-primary">Registrar Contacto</button>
            </div>
        </form>
    `;
    showModal("Registrar Nuevo Contacto", html);
}

function toggleMarksField(selectId, groupFieldId) {
    const val = document.getElementById(selectId).value;
    document.getElementById(groupFieldId).style.display = (val === 'Proveedor' || val === 'Ambos') ? 'block' : 'none';
}

async function submitCreateContact(event) {
    event.preventDefault();
    const payload = {
        tipo_contacto: document.getElementById('cnt-tipo-contacto').value,
        tipo_documento: document.getElementById('cnt-tipo-doc').value,
        numero_documento: document.getElementById('cnt-num-doc').value,
        nombre: document.getElementById('cnt-nombre').value,
        telefono: document.getElementById('cnt-telefono').value,
        email: document.getElementById('cnt-email').value,
        notas: document.getElementById('cnt-notas').value,
        catalogo_marcas: document.getElementById('cnt-marcas')?.value || ''
    };

    try {
        const res = await fetchAPI('/api/contacts/create', {
            method: 'POST',
            body: payload
        });
        if (res.success) {
            showNotification(res.message);
            closeModal();
            if (appState.activeView === 'contactos') {
                renderContactos();
            } else if (appState.activeView === 'pos') {
                renderPOS();
            }
        } else {
            showNotification(res.error, 'error');
        }
    } catch (e) {
        console.error(e);
    }
}

function openEditContactModal(c) {
    const html = `
        <form id="edit-contact-form" onsubmit="submitEditContact(event, ${c.id})">
            <div class="form-row">
                <div class="form-group">
                    <label>Tipo de Contacto *</label>
                    <select id="edit-cnt-tipo" class="form-control" required onchange="toggleMarksField('edit-cnt-tipo', 'edit-cnt-marcas-group')">
                        <option value="Cliente" ${c.tipo_contacto === 'Cliente' ? 'selected' : ''}>Cliente</option>
                        <option value="Proveedor" ${c.tipo_contacto === 'Proveedor' ? 'selected' : ''}>Proveedor</option>
                        <option value="Ambos" ${c.tipo_contacto === 'Ambos' ? 'selected' : ''}>Ambos (Cliente & Proveedor)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Tipo Documento *</label>
                    <select id="edit-cnt-tipo-doc" class="form-control" required>
                        <option value="DNI" ${c.tipo_documento === 'DNI' ? 'selected' : ''}>DNI</option>
                        <option value="RUC" ${c.tipo_documento === 'RUC' ? 'selected' : ''}>RUC</option>
                        <option value="Pasaporte" ${c.tipo_documento === 'Pasaporte' ? 'selected' : ''}>Pasaporte</option>
                        <option value="CE" ${c.tipo_documento === 'CE' ? 'selected' : ''}>CE</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Número Documento *</label>
                    <input type="text" id="edit-cnt-num-doc" class="form-control" required value="${c.numero_documento}">
                </div>
                <div class="form-group">
                    <label>Nombres Completos / Razón Social *</label>
                    <input type="text" id="edit-cnt-nombre" class="form-control" required value="${c.nombre}">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Teléfono</label>
                    <input type="text" id="edit-cnt-telefono" class="form-control" value="${c.telefono || ''}">
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="edit-cnt-email" class="form-control" value="${c.email || ''}">
                </div>
            </div>
            <div class="form-group" id="edit-cnt-marcas-group" style="display: ${c.tipo_contacto !== 'Cliente' ? 'block' : 'none'};">
                <label>Catálogo de marcas que surte (Solo Proveedores)</label>
                <input type="text" id="edit-cnt-marcas" class="form-control" value="${c.catalogo_marcas || ''}">
            </div>
            <div class="form-group">
                <label>Notas de Observación</label>
                <textarea id="edit-cnt-notas" class="form-control" rows="2">${c.notas || ''}</textarea>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px;">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                <button type="submit" class="btn btn-primary">Guardar Cambios</button>
            </div>
        </form>
    `;
    showModal(`Editar Contacto: ${c.nombre}`, html);
}

async function submitEditContact(event, id) {
    event.preventDefault();
    const payload = {
        tipo_contacto: document.getElementById('edit-cnt-tipo').value,
        tipo_documento: document.getElementById('edit-cnt-tipo-doc').value,
        numero_documento: document.getElementById('edit-cnt-num-doc').value,
        nombre: document.getElementById('edit-cnt-nombre').value,
        telefono: document.getElementById('edit-cnt-telefono').value,
        email: document.getElementById('edit-cnt-email').value,
        notas: document.getElementById('edit-cnt-notas').value,
        catalogo_marcas: document.getElementById('edit-cnt-marcas')?.value || ''
    };

    try {
        const res = await fetchAPI(`/api/contacts/update?id=${id}`, {
            method: 'POST',
            body: payload
        });
        if (res.success) {
            showNotification(res.message);
            closeModal();
            renderContactos();
        } else {
            showNotification(res.error, 'error');
        }
    } catch (e) {
        console.error(e);
    }
}

async function openContactDetailModal(contactoId) {
    try {
        const detail = await fetchAPI(`/api/contacts/detail?id=${contactoId}`);
        const c = detail.contacto;

        const purchasesHTML = detail.purchases.map(p => {
            const active = checkTransactionWarrantyActive(p.fecha, p.items_json);
            const warrantyBadgeHTML = active 
                ? `<span class="badge" style="background-color: rgba(48, 209, 88, 0.15); color: var(--success-color); font-weight: 700; font-size:9px; padding:2px 6px; margin-left:8px;">EN GARANTÍA</span>`
                : `<span class="badge" style="background-color: rgba(255, 69, 58, 0.15); color: var(--danger-color); font-weight: 700; font-size:9px; padding:2px 6px; margin-left:8px;">GARANTÍA EXPIRADA</span>`;
            return `
                <div style="border-bottom:1px solid var(--border-color); padding:8px 0; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong>${p.tipo_documento} ${p.numero_documento}</strong> ${warrantyBadgeHTML}<br>
                        <small style="color:var(--text-secondary);">${p.fecha.split('T')[0]} | Método: ${p.metodo_pago}</small>
                    </div>
                    <span>S/ ${p.total_pen.toFixed(2)}</span>
                </div>
            `;
        }).join('');

        const supportHTML = detail.support.map(s => {
            let statusOrWarrantyHTML = '';
            if (s.estado === 'Entregado') {
                const active = checkServiceWarrantyActive(s.fecha_entrega, s.garantia_servicio);
                statusOrWarrantyHTML = active 
                    ? `<span class="badge" style="background-color: rgba(48, 209, 88, 0.15); color: var(--success-color); font-weight: 700; font-size:9px; padding:2px 6px;">[ GARANTÍA ]</span>`
                    : `<span class="badge" style="background-color: rgba(255, 69, 58, 0.15); color: var(--danger-color); font-weight: 700; font-size:9px; padding:2px 6px;">[ GARANTÍA EXPIRADA ]</span>`;
            } else {
                statusOrWarrantyHTML = `<span class="badge badge-${s.estado.toLowerCase().replace(/á/g, 'a').replace(/ó/g, 'o').replace(/ /g, '-')}">${s.estado}</span>`;
            }
            return `
                <div style="border-bottom:1px solid var(--border-color); padding:8px 0; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong>${s.equipo_modelo}</strong><br>
                        <small style="color:var(--text-secondary);">${s.fecha_registro.split('T')[0]} | Serie/IMEI: ${s.equipo_serie_imei}</small>
                    </div>
                    <div>
                        ${statusOrWarrantyHTML}
                    </div>
                </div>
            `;
        }).join('');

        const loansHTML = detail.loans.map(l => `
            <div style="border-bottom:1px solid var(--border-color); padding:8px 0; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong>${l.producto_nombre}</strong><br>
                    <small style="color:var(--text-secondary);">${l.fecha_movimiento.split('T')[0]} | Cant: ${l.cantidad}</small>
                </div>
                <span class="badge ${l.estado_movimiento === 'Activo' ? 'badge-activo' : 'badge-anulado'}">${l.estado_movimiento}</span>
            </div>
        `).join('');

        // Compute balances for credit netting
        let unpaidReceivablePen = 0.0;
        let unpaidReceivableUsd = 0.0;
        detail.client_credits.forEach(cr => {
            if (cr.estado === 'Pendiente') {
                unpaidReceivablePen += cr.saldo_pendiente_pen;
                unpaidReceivableUsd += cr.saldo_pendiente_usd;
            }
        });

        let unpaidPayablePen = 0.0;
        let unpaidPayableUsd = 0.0;
        detail.provider_credits.forEach(cp => {
            if (cp.estado === 'Pendiente') {
                unpaidPayablePen += cp.saldo_pendiente_pen;
                unpaidPayableUsd += cp.saldo_pendiente_usd;
            }
        });

        const canNet = (unpaidReceivablePen > 0.01 && unpaidPayablePen > 0.01) || (unpaidReceivableUsd > 0.01 && unpaidPayableUsd > 0.01);
        const netPen = unpaidReceivablePen - unpaidPayablePen;
        const netUsd = unpaidReceivableUsd - unpaidPayableUsd;

        const creditBalanceHTML = `
            <div style="background-color:var(--bg-input); padding:16px; border-radius:8px; border:1px solid var(--border-color); margin-top:8px;">
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:12px;">
                    <div>
                        <span style="font-size:11px; color:var(--text-secondary);">Cuentas por Cobrar (Nos debe)</span>
                        <h4 style="font-size:18px; color:var(--danger-color);">S/ ${unpaidReceivablePen.toFixed(2)}</h4>
                        <small style="color:var(--text-secondary);">$ ${unpaidReceivableUsd.toFixed(2)}</small>
                    </div>
                    <div>
                        <span style="font-size:11px; color:var(--text-secondary);">Cuentas por Pagar (Le debemos)</span>
                        <h4 style="font-size:18px; color:var(--warning-color);">S/ ${unpaidPayablePen.toFixed(2)}</h4>
                        <small style="color:var(--text-secondary);">$ ${unpaidPayableUsd.toFixed(2)}</small>
                    </div>
                </div>
                <hr style="border:0; border-top:1px dashed var(--border-color); margin: 8px 0;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                    <div>
                        <span style="font-size:11px; color:var(--text-secondary);">Balance Neto Compensado</span>
                        <h3 style="font-size:20px; color:${netPen >= 0 ? 'var(--danger-color)' : 'var(--success-color)'};">
                            ${netPen >= 0 ? 'A Favor: S/ ' : 'A Pagar: S/ '}${Math.abs(netPen).toFixed(2)}
                        </h3>
                        <small style="color:var(--text-secondary);">Equiv. USD: $ ${Math.abs(netUsd).toFixed(2)}</small>
                    </div>
                    ${canNet ? `
                        <button class="btn btn-primary" onclick="executeCreditNetting(${c.id})">
                            <i class="fa-solid fa-scale-balanced"></i> NETEAR CRÉDITOS
                        </button>
                    ` : '<span style="font-size:11px; color:var(--text-secondary);">No requiere compensación</span>'}
                </div>
            </div>
        `;

        const html = `
            <div style="display:flex; flex-direction:column; gap:16px;">
                <div>
                    <h4>Ficha de Contacto Unificada</h4>
                    <p style="margin-top:4px;"><strong>Nombres:</strong> ${c.nombre} (<span class="badge badge-recibido" style="font-size:10px; padding:2px 6px;">${c.tipo_contacto}</span>)</p>
                    <p><strong>Documento:</strong> ${c.tipo_documento} - ${c.numero_documento}</p>
                    <p><strong>Teléfono:</strong> ${c.telefono || 'No registra'} | <strong>Email:</strong> ${c.email || 'No registra'}</p>
                    ${c.catalogo_marcas ? `<p><strong>Catálogo Marcas:</strong> ${c.catalogo_marcas}</p>` : ''}
                    <p><strong>Notas:</strong> ${c.notes || 'Ninguna'}</p>
                </div>
                <hr style="border:0; border-top:1px solid var(--border-color)">
                
                <!-- Financial Balance section -->
                <div>
                    <h4>Balance y Compensación Contable</h4>
                    ${creditBalanceHTML}
                </div>

                <hr style="border:0; border-top:1px solid var(--border-color)">
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px;">
                    <div>
                        <h4>Historial de Compras (POS)</h4>
                        <div style="max-height: 150px; overflow-y:auto; margin-top:8px;">
                            ${purchasesHTML || '<p style="color:var(--text-secondary);">Sin compras.</p>'}
                        </div>
                        <h4 style="margin-top:16px;">Consignaciones de Repuesto</h4>
                        <div style="max-height: 150px; overflow-y:auto; margin-top:8px;">
                            ${loansHTML || '<p style="color:var(--text-secondary);">Sin préstamos.</p>'}
                        </div>
                    </div>
                    <div>
                        <h4>Historial de Soporte Técnico</h4>
                        <div style="max-height: 250px; overflow-y:auto; margin-top:8px;">
                            ${supportHTML || '<p style="color:var(--text-secondary);">Sin reparaciones.</p>'}
                        </div>
                    </div>
                </div>
            </div>
        `;
        showModal(`Perfil de Contacto: ${c.nombre}`, html);
    } catch (e) {
        console.error(e);
    }
}

async function executeCreditNetting(contactoId) {
    if (!confirm("¿Desea compensar y netear las deudas recíprocas de este contacto? Esto amortizará automáticamente las cuentas por cobrar y pagar pendientes en la misma proporción.")) return;
    try {
        const res = await fetchAPI(`/api/contacts/net?id=${contactoId}`, { method: 'POST' });
        if (res.success) {
            showNotification(res.message);
            // Refresh detail modal
            openContactDetailModal(contactoId);
            // Refresh credit tables if viewing credit module
            if (appState.activeView === 'creditos') {
                renderCreditos();
            }
        } else {
            showNotification(res.error, 'error');
        }
    } catch (e) {
        console.error(e);
    }
}

// ==========================================
// RENDER VIEW: INVENTARIO (RE-DECLARE HELPER TO PREVENT ERROR)
// ==========================================

async function renderInventario() {
    const container = document.getElementById('viewport');
    container.innerHTML = `
        <div class="card">
            <div class="card-title">
                <span>Catálogo de Productos</span>
                <div style="display: flex; gap: 10px;">
                    <button class="btn btn-secondary" onclick="openCategoriesModal()"><i class="fa-solid fa-folder-plus"></i> Categorías</button>
                    <button class="btn btn-primary" onclick="openCreateProductModal()"><i class="fa-solid fa-plus"></i> Registrar Producto</button>
                </div>
            </div>
            <div class="pos-search-bar" style="margin-bottom: 20px;">
                <input type="text" id="inventory-search" class="form-control" style="flex: 1;" placeholder="Buscar producto por código, SKU o descripción...">
            </div>
            <div class="table-responsive">
                <table class="table-main">
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Descripción</th>
                            <th>Categoría</th>
                            <th>Stock Actual</th>
                            <th>Stock Mínimo</th>
                            <th>Costo USD</th>
                            <th>Costo PEN</th>
                            <th>Venta USD</th>
                            <th>Venta PEN</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="inventory-tbody">
                        <tr><td colspan="10" style="text-align: center;">Cargando inventario...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    try {
        const products = await fetchAPI('/api/products');
        const inventoryTbody = document.getElementById('inventory-tbody');

        const renderTable = (list) => {
            if (list.length === 0) {
                inventoryTbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-secondary);">No se registran productos en el inventario.</td></tr>`;
                return;
            }
            
            inventoryTbody.innerHTML = list.map(p => {
                let seriesLabelHTML = '';
                if (p.requiere_serie === 1) {
                    let seriesArr = [];
                    try {
                        seriesArr = typeof p.series_disponibles === 'string' 
                            ? JSON.parse(p.series_disponibles)
                            : p.series_disponibles || [];
                    } catch(e) {
                        seriesArr = [];
                    }
                    seriesLabelHTML = `<br><span style="display:inline-block; font-size:10px; background-color:rgba(0, 113, 227, 0.12); color:#0071e3; border-radius:3px; padding:1px 5px; font-weight:bold; margin-top:4px;"><i class="fa-solid fa-barcode"></i> Serializado ${seriesArr.length > 0 ? `(Series: ${seriesArr.join(', ')})` : '(Sin series en stock)'}</span>`;
                }
                return `
                    <tr ${p.stock_actual <= p.stock_minimo ? 'style="background-color: rgba(255, 69, 58, 0.02)"' : ''}>
                        <td><strong>${p.codigo}</strong></td>
                        <td>${p.nombre}${seriesLabelHTML}</td>
                        <td>${p.categoria_nombre || 'Sin Categoría'}</td>
                        <td><span class="badge ${p.stock_actual <= p.stock_minimo ? 'badge-low-stock' : 'badge-normal-stock'}">${p.stock_actual} unidades</span></td>
                    <td>${p.stock_minimo} und</td>
                    <td>$ ${p.costo_usd.toFixed(2)}</td>
                    <td>S/ ${p.costo_pen.toFixed(2)}</td>
                    <td style="color: var(--accent-color); font-weight:600;">$ ${p.precio_venta_usd.toFixed(2)}</td>
                    <td style="color: var(--accent-color); font-weight:600;">S/ ${p.precio_venta_pen.toFixed(2)}</td>
                    <td>
                        <div style="display: flex; gap: 6px;">
                            <button class="btn btn-secondary btn-xs" onclick="openEditProductModal(${JSON.stringify(p).replace(/"/g, '&quot;')})" title="Editar"><i class="fa-solid fa-pencil"></i></button>
                            <button class="btn btn-danger btn-xs" onclick="deleteProduct(${p.id})" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
            }).join('');
        };

        const searchInput = document.getElementById('inventory-search');
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase();
            const filtered = products.filter(p => p.nombre.toLowerCase().includes(query) || p.codigo.toLowerCase().includes(query));
            renderTable(filtered);
        });

        renderTable(products);

    } catch (e) {
        console.error(e);
    }
}

// ==========================================
// RENDER VIEW: PRÉSTAMOS / REPUESTOS
// ==========================================

async function renderPrestamos() {
    const container = document.getElementById('viewport');
    container.innerHTML = `
        <div class="card">
            <div class="card-title">
                <span>Préstamos Intertienda y Consignación de Repuestos</span>
                <button class="btn btn-primary" onclick="openCreateLoanModal()"><i class="fa-solid fa-arrow-right-to-bracket"></i> Registrar Recepción de Repuesto</button>
            </div>
            <p style="font-size:13px; color:var(--text-secondary); margin-bottom: 20px;">
                Controla el ingreso de repuestos o equipos en crédito/consignación por proveedores.
                La opción de <strong>Devolución</strong> anula el movimiento y el crédito correspondiente, saldando la contabilidad.
            </p>
            <div class="table-responsive">
                <table class="table-main">
                    <thead>
                        <tr>
                            <th>Nº</th>
                            <th>Proveedor</th>
                            <th>Repuesto / Código</th>
                            <th>Cantidad</th>
                            <th>Costo Unitario USD</th>
                            <th>Costo Unitario PEN</th>
                            <th>Fecha</th>
                            <th>Tipo</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="loans-tbody">
                        <tr><td colspan="10" style="text-align: center;">Cargando registros...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    try {
        const loans = await fetchAPI('/api/loans');
        const loansTbody = document.getElementById('loans-tbody');

        if (loans.length === 0) {
            loansTbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-secondary);">No se registran movimientos de préstamos.</td></tr>`;
            return;
        }

        loansTbody.innerHTML = loans.map(l => {
            const isReturned = l.estado_movimiento === 'Devuelto' || l.tipo_movimiento === 'Devuelto';
            return `
                <tr>
                    <td>#${l.id}</td>
                    <td>${l.proveedor_nombre}</td>
                    <td><strong>${l.producto_nombre}</strong><br><small style="color:var(--text-secondary);">${l.producto_codigo}</small></td>
                    <td>${l.cantidad} unidades</td>
                    <td>$ ${l.costo_unitario_usd.toFixed(2)}</td>
                    <td>S/ ${l.costo_unitario_pen.toFixed(2)}</td>
                    <td>${l.fecha_movimiento.split('T')[0]}</td>
                    <td><span class="badge badge-recibido">${l.tipo_movimiento}</span></td>
                    <td><span class="badge ${l.estado_movimiento === 'Activo' ? 'badge-activo' : 'badge-anulado'}">${l.estado_movimiento}</span></td>
                    <td>
                        ${(!isReturned) ? `
                            <button class="btn btn-danger btn-xs" onclick="returnLoan(${l.id})">
                                <i class="fa-solid fa-rotate-left"></i> Devolver
                            </button>
                        ` : '<em>Procesado</em>'}
                    </td>
                </tr>
            `;
        }).join('');

    } catch (e) {
        console.error(e);
    }
}

async function openCreateLoanModal() {
    try {
        const [contacts, products] = await Promise.all([
            fetchAPI('/api/contacts'),
            fetchAPI('/api/products')
        ]);

        const provOptions = contacts.filter(c => c.tipo_contacto === 'Proveedor' || c.tipo_contacto === 'Ambos')
                                    .map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
        const prodOptions = products.map(p => `<option value="${p.id}">${p.nombre} (Stock: ${p.stock_actual} | SKU: ${p.codigo})</option>`).join('');

        const html = `
            <form id="create-loan-form" onsubmit="submitCreateLoan(event)">
                <div class="form-group">
                    <label>Proveedor / Socio Aliado *</label>
                    <select id="loan-proveedor-id" class="form-control" required>
                        <option value="">Seleccione Proveedor...</option>
                        ${provOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label>Seleccionar Repuesto / Equipo *</label>
                    <select id="loan-producto-id" class="form-control" required>
                        <option value="">Seleccione...</option>
                        ${prodOptions}
                    </select>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Cantidad Recibida *</label>
                        <input type="number" id="loan-cantidad" class="form-control" value="1" required min="1">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Costo Unitario USD ($)</label>
                        <input type="number" step="0.01" id="loan-costo-usd" class="form-control" value="0.0" oninput="convertPriceInput('loan-costo-usd', 'loan-costo-pen', 'toPEN')">
                    </div>
                    <div class="form-group">
                        <label>Costo Unitario Soles (S/)</label>
                        <input type="number" step="0.01" id="loan-costo-pen" class="form-control" value="0.0" oninput="convertPriceInput('loan-costo-usd', 'loan-costo-pen', 'toUSD')">
                    </div>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px;">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Registrar Ingreso</button>
                </div>
            </form>
        `;
        showModal("Ingresar Repuesto por Préstamo/Consignación", html);
    } catch (e) {
        console.error(e);
    }
}

// ==========================================
// RENDER VIEW: CRÉDITOS Y CUENTAS
// ==========================================

async function renderCreditos() {
    const container = document.getElementById('viewport');
    container.innerHTML = `
        <div class="dashboard-charts" style="grid-template-columns: 1fr 1fr;">
            <div class="card">
                <h3 class="card-title">Cuentas por Cobrar (Clientes)</h3>
                <div class="table-responsive">
                    <table class="table-main">
                        <thead>
                            <tr>
                                <th>Cliente</th>
                                <th>Venta</th>
                                <th>Saldo Pendiente (PEN)</th>
                                <th>Límite Autorizado</th>
                                <th>Estado</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody id="cred-clients-tbody">
                            <tr><td colspan="6" style="text-align: center;">Cargando créditos...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="card">
                <h3 class="card-title">Cuentas por Pagar (Proveedores)</h3>
                <div class="table-responsive">
                    <table class="table-main">
                        <thead>
                            <tr>
                                <th>Proveedor</th>
                                <th>Detalle / Concepto</th>
                                <th>Saldo Pendiente (PEN)</th>
                                <th>Estado</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody id="cred-providers-tbody">
                            <tr><td colspan="5" style="text-align: center;">Cargando saldos...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    try {
        const [cCredits, pCredits] = await Promise.all([
            fetchAPI('/api/credits/clients'),
            fetchAPI('/api/credits/providers')
        ]);

        const ccTbody = document.getElementById('cred-clients-tbody');
        if (cCredits.length === 0) {
            ccTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">No hay créditos otorgados.</td></tr>`;
        } else {
            ccTbody.innerHTML = cCredits.map(c => `
                <tr>
                    <td><strong>${c.cliente_nombre}</strong></td>
                    <td>${c.tipo_documento} ${c.venta_documento || ''}</td>
                    <td style="color:var(--danger-color); font-weight:bold;">S/ ${c.saldo_pendiente_pen.toFixed(2)}</td>
                    <td>S/ ${c.limite_credito_pen.toFixed(2)}</td>
                    <td><span class="badge ${c.estado === 'Pagado' ? 'badge-activo' : 'badge-anulado'}">${c.estado}</span></td>
                    <td>
                        ${c.estado === 'Pendiente' ? `
                            <button class="btn btn-primary btn-xs" onclick="openAbonoModal(${c.id}, 'cliente')">Abonar</button>
                        ` : '<em>Completado</em>'}
                    </td>
                </tr>
            `).join('');
        }

        const cpTbody = document.getElementById('cred-providers-tbody');
        if (pCredits.length === 0) {
            cpTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">No hay cuentas por pagar vigentes.</td></tr>`;
        } else {
            cpTbody.innerHTML = pCredits.map(p => `
                <tr>
                    <td><strong>${p.proveedor_nombre}</strong></td>
                    <td><span style="font-size:12px; color:var(--text-secondary);">${p.notas}</span></td>
                    <td style="color:var(--warning-color); font-weight:bold;">S/ ${p.saldo_pendiente_pen.toFixed(2)}</td>
                    <td><span class="badge ${p.estado === 'Pagado' ? 'badge-activo' : p.estado === 'Anulado' ? 'badge-recibido' : 'badge-anulado'}">${p.estado}</span></td>
                    <td>
                        ${p.estado === 'Pendiente' ? `
                            <button class="btn btn-primary btn-xs" onclick="openAbonoModal(${p.id}, 'proveedor')">Abonar</button>
                        ` : '<em>Completado</em>'}
                    </td>
                </tr>
            `).join('');
        }

    } catch (e) {
        console.error(e);
    }
}

// ==========================================
// RENDER VIEW: GENERADOR DE COTIZACIONES
// ==========================================

async function renderCotizaciones() {
    appState.quoteItems = [];
    const container = document.getElementById('viewport');
    container.innerHTML = `
        <div class="pos-layout">
            <div class="pos-products card" style="height: auto; overflow: visible;">
                <h3 class="card-title">Generador de Presupuestos</h3>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>Nombre del Cliente *</label>
                        <input type="text" id="quote-cli-nombre" class="form-control" required placeholder="Nombre del destinatario">
                    </div>
                    <div class="form-group">
                        <label>Documento de Identidad (Opcional)</label>
                        <input type="text" id="quote-cli-doc" class="form-control" placeholder="DNI / RUC / Pasaporte">
                    </div>
                </div>

                <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 12px 0;">

                <div class="form-group" style="margin-top:10px;">
                    <label>Descripción del Producto/Servicio o Búsqueda en Catálogo *</label>
                    <div style="position:relative; width: 100%;">
                        <input type="text" id="quote-item-desc" class="form-control" style="width: 100%;" placeholder="Escribe descripción detallada del producto/servicio o busca en el catálogo...">
                        <div id="quote-suggestions" style="display:none; position:absolute; left:0; right:0; top:42px; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:6px; max-height:180px; overflow-y:auto; z-index:100; box-shadow:var(--shadow-main);"></div>
                    </div>
                </div>
                
                <div class="form-row" style="grid-template-columns: 1.2fr 1.2fr 0.8fr 1.2fr; align-items: flex-end; margin-top: 10px;">
                    <div class="form-group" style="margin-bottom:0;">
                        <label>Precio Unitario USD ($) *</label>
                        <input type="number" step="0.01" id="quote-item-price-usd" class="form-control" value="0.0" oninput="convertPriceInput('quote-item-price-usd', 'quote-item-price-pen', 'toPEN')">
                    </div>
                    <div class="form-group" style="margin-bottom:0;">
                        <label>Precio Unitario PEN (S/) *</label>
                        <input type="number" step="0.01" id="quote-item-price-pen" class="form-control" value="0.0" oninput="convertPriceInput('quote-item-price-usd', 'quote-item-price-pen', 'toUSD')">
                    </div>
                    <div class="form-group" style="margin-bottom:0;">
                        <label>Cantidad *</label>
                        <input type="number" id="quote-item-qty" class="form-control" value="1" min="1">
                    </div>
                    <button class="btn btn-secondary" onclick="addQuoteItem()" style="height: 42px; width: 100%;"><i class="fa-solid fa-plus"></i> Agregar Item</button>
                </div>

                <div class="table-responsive" style="margin-top:20px;">
                    <table class="table-main">
                        <thead>
                            <tr>
                                <th>Descripción</th>
                                <th>Cantidad</th>
                                <th>Unitario (PEN)</th>
                                <th>Subtotal (PEN)</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody id="quote-items-tbody">
                            <tr><td colspan="5" style="text-align: center; color:var(--text-secondary);">Agregue ítems a la cotización.</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="pos-cart">
                <div class="cart-header">
                    <h3>Resumen y Acciones</h3>
                </div>
                <div class="cart-items" style="gap:16px;">
                    <div>
                        <h4 style="margin-bottom: 6px;">Total Cotizado (PEN)</h4>
                        <h2 style="font-size:32px; color:var(--accent-color);" id="quote-total-pen-lbl">S/ 0.00</h2>
                    </div>
                    <div>
                        <h4 style="margin-bottom: 6px;">Total Cotizado (USD)</h4>
                        <h2 style="font-size:24px; color:var(--text-secondary);" id="quote-total-usd-lbl">$ 0.00</h2>
                    </div>
                </div>
                <div class="cart-totals">
                    <button class="btn btn-primary" onclick="submitQuote()" style="width: 100%; padding: 12px; margin-bottom: 10px;"><i class="fa-solid fa-floppy-disk"></i> GUARDAR COTIZACIÓN</button>
                    
                    <hr style="border:0; border-top:1px solid var(--border-color); margin-bottom: 10px;">
                    
                    <h4 style="margin-bottom:8px;">Historial de Cotizaciones</h4>
                    <div style="max-height: 180px; overflow-y:auto;" id="quote-history-list">
                        <p style="color:var(--text-secondary); font-size:12px;">Cargando historial...</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    try {
        const products = await fetchAPI('/api/products');
        const descInput = document.getElementById('quote-item-desc');
        const suggBox = document.getElementById('quote-suggestions');

        descInput.addEventListener('input', () => {
            const query = descInput.value.toLowerCase();
            if (!query) {
                suggBox.style.display = 'none';
                return;
            }
            const filtered = products.filter(p => p.nombre.toLowerCase().includes(query) || p.codigo.toLowerCase().includes(query));
            if (filtered.length === 0) {
                suggBox.style.display = 'none';
                return;
            }

            suggBox.innerHTML = filtered.map(p => `
                <div class="suggestion-item" style="padding:8px 12px; cursor:pointer; border-bottom:1px solid var(--border-color);" onclick="selectQuoteProduct(${JSON.stringify(p).replace(/"/g, '&quot;')})">
                    <strong>${p.nombre}</strong><br><small style="color:var(--text-secondary);">SKU: ${p.codigo} | S/ ${p.precio_venta_pen.toFixed(2)}</small>
                </div>
            `).join('');
            suggBox.style.display = 'block';
        });

        document.addEventListener('click', (e) => {
            if (e.target !== descInput && e.target !== suggBox) {
                suggBox.style.display = 'none';
            }
        });

        window.selectQuoteProduct = (p) => {
            descInput.value = p.nombre;
            document.getElementById('quote-item-price-usd').value = p.precio_venta_usd;
            document.getElementById('quote-item-price-pen').value = p.precio_venta_pen;
            suggBox.style.display = 'none';
        };

        loadQuoteHistory();

    } catch (e) {
        console.error(e);
    }
}

async function convertQuoteToSaleModal(quoteId) {
    try {
        const [contacts, quoteRes] = await Promise.all([
            fetchAPI('/api/contacts'),
            fetchAPI(`/api/quotes/detail?id=${quoteId}`)
        ]);
        const q = quoteRes.cotizacion;

        const cliOptions = contacts.filter(c => c.tipo_contacto === 'Cliente' || c.tipo_contacto === 'Ambos')
                                   .map(c => `<option value="${c.id}">${c.nombre} (${c.numero_documento})</option>`).join('');

        const html = `
            <form id="convert-quote-form" onsubmit="submitConvertQuote(event, ${quoteId})">
                <p style="margin-bottom:12px;">Convertir Cotización de <strong>${q.cliente_nombre}</strong> por el total de <strong>S/ ${q.total_pen.toFixed(2)}</strong> en una venta real (descontando stock).</p>
                <div class="form-group">
                    <label>Seleccionar Contacto Registrado *</label>
                    <select id="conv-cliente-id" class="form-control" required>
                        <option value="">Seleccione...</option>
                        ${cliOptions}
                    </select>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Comprobante de Venta</label>
                        <select id="conv-doc-type" class="form-control">
                            <option value="Nota de Venta">Nota de Venta</option>
                            <option value="Boleta">Boleta de Venta</option>
                            <option value="Factura">Factura (IGV 18%)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Método de Pago</label>
                        <select id="conv-payment" class="form-control">
                            <option value="Efectivo">Efectivo</option>
                            <option value="Tarjeta">Tarjeta</option>
                            <option value="Transferencia">Transferencia</option>
                            <option value="Yape/Plin">Yape/Plin</option>
                            <option value="Crédito">Crédito del Cliente</option>
                        </select>
                    </div>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px;">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Confirmar Venta</button>
                </div>
            </form>
        `;
        showModal(`Convertir Cotización #${quoteId} a Venta`, html);
    } catch (e) {
        console.error(e);
    }
}

// ==========================================
// RENDER VIEW: CONFIGURACIÓN
// ==========================================

async function renderConfiguracion() {
    const container = document.getElementById('viewport');
    container.innerHTML = `
        <div class="card">
            <h3 class="card-title">Datos del Negocio</h3>
            <form id="config-form" onsubmit="submitConfigUpdate(event)">
                <div class="form-row">
                    <div class="form-group">
                        <label>Nombre de la Empresa *</label>
                        <input type="text" id="cfg-name" class="form-control" required value="${appState.config.business_name || ''}">
                    </div>
                    <div class="form-group">
                        <label>Dirección del Local *</label>
                        <input type="text" id="cfg-address" class="form-control" required value="${appState.config.business_address || ''}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>RUC Empresa *</label>
                        <input type="text" id="cfg-ruc" class="form-control" required value="${appState.config.business_ruc || ''}">
                    </div>
                    <div class="form-group">
                        <label>Teléfono *</label>
                        <input type="text" id="cfg-phone" class="form-control" required value="${appState.config.business_phone || ''}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Instagram URL</label>
                        <input type="text" id="cfg-instagram" class="form-control" value="${appState.config.social_instagram || ''}">
                    </div>
                    <div class="form-group">
                        <label>Facebook URL</label>
                        <input type="text" id="cfg-facebook" class="form-control" value="${appState.config.social_facebook || ''}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Google Business URL</label>
                        <input type="text" id="cfg-google" class="form-control" value="${appState.config.google_business_url || ''}">
                    </div>
                    <div class="form-group">
                        <label>Manual Tipo de Cambio Diario (S/ por 1 USD) *</label>
                        <input type="number" step="0.001" id="cfg-exchange-rate" class="form-control" required value="${appState.exchangeRate}">
                    </div>
                </div>
                <div style="display:flex; justify-content:flex-end; margin-top:20px;">
                    <button type="submit" class="btn btn-primary"><i class="fa-solid fa-floppy-disk"></i> Guardar Configuración</button>
                </div>
            </form>
        </div>

        <div class="card danger-zone">
            <h3 class="danger-zone-title"><i class="fa-solid fa-triangle-exclamation"></i> ZONA DE PELIGRO (DANGER ZONE)</h3>
            <p style="margin: 10px 0 20px 0; font-size:14px; color:var(--text-secondary);">
                Al pulsar el botón de restablecimiento completo, se eliminarán permanentemente todos los datos de contactos, deudas,
                ventas, inventario, etc. Esta acción <strong>NO se puede deshacer</strong>.
            </p>
            <button class="btn btn-danger" onclick="triggerSystemReset()"><i class="fa-solid fa-radiation"></i> Restablecer Sistema Completo</button>
        </div>
    `;
}

// Helpers reused directly for grid & cart updates
// ==========================================

function renderPOSGrid(products) {
    const grid = document.getElementById('pos-products-grid');
    if (products.length === 0) {
        grid.innerHTML = `<div style="text-align: center; grid-column: 1/-1; padding: 40px; color: var(--text-secondary);">No se encontraron productos en el catálogo.</div>`;
        return;
    }

    grid.innerHTML = products.map(p => {
        const outOfStock = p.stock_actual <= 0;
        return `
            <div class="pos-product-card" onclick="${outOfStock ? 'showNotification(\'Sin stock disponible\', \'warning\')' : `addProductToCart(${JSON.stringify(p).replace(/"/g, '&quot;')})`}">
                <span class="pos-product-name">${p.nombre}</span>
                <span class="pos-product-code">${p.codigo}</span>
                <div class="pos-product-stock">
                    <span style="color: var(--text-secondary);">Stock:</span>
                    <span class="badge ${p.stock_actual <= p.stock_minimo ? 'badge-low-stock' : 'badge-normal-stock'}">${p.stock_actual} und</span>
                </div>
                <div class="pos-product-price">
                    <span>S/ ${p.precio_venta_pen.toFixed(2)}</span>
                    <span style="display:block; font-size:11px; color: var(--text-secondary); font-weight:normal;">$ ${p.precio_venta_usd.toFixed(2)}</span>
                </div>
            </div>
        `;
    }).join('');
}

function addProductToCart(product) {
    const existing = appState.cart.find(item => item.id === product.id);
    if (existing) {
        if (existing.cantidad >= product.stock_actual) {
            showNotification(`Llegaste al límite de stock disponible para ${product.nombre}`, 'warning');
            return;
        }
        existing.cantidad += 1;
    } else {
        const nameLower = product.nombre ? product.nombre.toLowerCase() : "";
        let defaultGarantia = "Sin garantía";
        if (nameLower.includes("iphone") || nameLower.includes("macbook") || nameLower.includes("ipad") || nameLower.includes("watch") || nameLower.includes("airpods")) {
            defaultGarantia = "12 meses";
        } else if (nameLower.includes("cargador") || nameLower.includes("power adapter") || nameLower.includes("cable") || nameLower.includes("pantalla") || nameLower.includes("repuesto")) {
            defaultGarantia = "6 meses";
        }
        
        appState.cart.push({
            id: product.id,
            nombre: product.nombre,
            codigo: product.codigo,
            precio_venta_pen: product.precio_venta_pen,
            precio_venta_usd: product.precio_venta_usd,
            stock_actual: product.stock_actual,
            cantidad: 1,
            garantia: defaultGarantia,
            requiere_serie: product.requiere_serie || 0,
            series_disponibles: product.series_disponibles || '[]',
            series: []
        });
    }
    updateCartUI();
}

function updateCartItemPrice(productId, newPricePen) {
    const item = appState.cart.find(i => i.id === productId);
    if (!item) return;
    const parsedPrice = parseFloat(newPricePen) || 0;
    item.precio_venta_pen = parsedPrice;
    item.precio_venta_usd = parsedPrice / (appState.exchangeRate || 3.75);
    updateCartTotals();
}

function updateCartItemWarranty(productId, warrantyVal) {
    const item = appState.cart.find(i => i.id === productId);
    if (!item) return;
    item.garantia = warrantyVal || "Sin garantía";
}

function updateCartItemSeries(productId, selectEl) {
    const item = appState.cart.find(i => i.id === productId);
    if (!item) return;
    const selectedOptions = Array.from(selectEl.selectedOptions).map(o => o.value);
    item.series = selectedOptions;
}

function updateCartUI() {
    const container = document.getElementById('pos-cart-items');
    if (appState.cart.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; margin-top: 50px; color: var(--text-secondary);">
                <i class="fa-solid fa-cart-shopping" style="font-size: 32px; margin-bottom: 12px; opacity: 0.3;"></i>
                <p>El carrito está vacío</p>
            </div>
        `;
        updateCartTotals();
        return;
    }

    container.innerHTML = appState.cart.map(item => {
        let seriesSelectHTML = '';
        if (item.requiere_serie === 1) {
            let availableSerials = [];
            try {
                availableSerials = typeof item.series_disponibles === 'string' 
                    ? JSON.parse(item.series_disponibles)
                    : item.series_disponibles || [];
            } catch(e) {
                availableSerials = [];
            }
            
            const options = availableSerials.map(s => {
                const isSelected = item.series && item.series.includes(s) ? 'selected' : '';
                return `<option value="${s}" ${isSelected}>${s}</option>`;
            }).join('');
            
            seriesSelectHTML = `
                <div style="margin-top: 6px; display: flex; flex-direction: column; gap: 4px; width: 100%;">
                    <label style="font-size: 10px; color: var(--accent-color); font-weight: 600; margin: 0;">Seleccionar Serie/IMEI (${item.cantidad} requerido)*</label>
                    <select class="form-control" multiple style="font-size: 10px; padding: 4px; height: auto;" onchange="updateCartItemSeries(${item.id}, this)">
                        ${options}
                    </select>
                </div>
            `;
        }

        return `
            <div class="cart-item" style="flex-direction: column; align-items: stretch; gap: 8px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="cart-item-name" style="font-weight:600;">${item.nombre}</span>
                    <div class="cart-item-qty" style="display:flex; align-items:center; gap:8px;">
                        <button class="qty-btn" onclick="adjustCartQty(${item.id}, -1)">-</button>
                        <strong>${item.cantidad}</strong>
                        <button class="qty-btn" onclick="adjustCartQty(${item.id}, 1)">+</button>
                    </div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; width:100%;">
                    <div style="display:flex; align-items:center; gap:4px;">
                        <span style="font-size:11px; color:var(--text-secondary);">S/</span>
                        <input type="number" step="0.01" class="form-control" style="width:75px; padding:3px 5px; font-size:11px; height:auto; display:inline-block;" value="${item.precio_venta_pen}" onchange="updateCartItemPrice(${item.id}, this.value)">
                        <span style="font-size:10px; color:var(--text-secondary); margin-left:2px;">($${item.precio_venta_usd.toFixed(2)})</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:4px;">
                        <span style="font-size:10px; color:var(--text-secondary);">Garantía:</span>
                        <input type="text" class="form-control" style="width:90px; padding:3px 5px; font-size:10px; height:auto; display:inline-block;" value="${item.garantia || 'Sin garantía'}" onchange="updateCartItemWarranty(${item.id}, this.value)" placeholder="Ej. 12 meses">
                    </div>
                </div>
                ${seriesSelectHTML}
            </div>
        `;
    }).join('');

    updateCartTotals();
}

function adjustCartQty(productId, amount) {
    const item = appState.cart.find(i => i.id === productId);
    if (!item) return;

    item.cantidad += amount;
    if (item.cantidad <= 0) {
        appState.cart = appState.cart.filter(i => i.id !== productId);
    } else if (item.cantidad > item.stock_actual) {
        showNotification("No hay más stock disponible", 'warning');
        item.cantidad = item.stock_actual;
    }
    updateCartUI();
}

function updateCartTotals() {
    let totalPen = 0.0;
    let totalUsd = 0.0;
    
    appState.cart.forEach(item => {
        totalPen += item.precio_venta_pen * item.cantidad;
        totalUsd += item.precio_venta_usd * item.cantidad;
    });

    const docType = document.getElementById('pos-doc-type')?.value || 'Nota de Venta';
    const isFactura = docType === 'Factura';

    let subtotalPen = totalPen;
    let igvPen = 0.0;

    if (isFactura) {
        subtotalPen = totalPen / 1.18;
        igvPen = totalPen - subtotalPen;
    }

    if (document.getElementById('pos-subtotal-pen')) {
        document.getElementById('pos-subtotal-pen').innerText = `S/ ${subtotalPen.toFixed(2)}`;
        document.getElementById('pos-igv-pen').innerText = `S/ ${igvPen.toFixed(2)}`;
        document.getElementById('pos-total-pen').innerText = `S/ ${totalPen.toFixed(2)}`;
        document.getElementById('pos-total-usd').innerText = `$ ${totalUsd.toFixed(2)}`;
    }
}

function convertPriceInput(usdId, penId, direction) {
    const usdInput = document.getElementById(usdId);
    const penInput = document.getElementById(penId);
    if (!usdInput || !penInput) return;

    const rate = appState.exchangeRate;

    if (direction === 'toPEN') {
        const val = parseFloat(usdInput.value) || 0.0;
        penInput.value = (val * rate).toFixed(2);
    } else if (direction === 'toUSD') {
        const val = parseFloat(penInput.value) || 0.0;
        usdInput.value = (val / rate).toFixed(2);
    }
}

async function submitCreateOrder(event) {
    event.preventDefault();
    const payload = {
        cliente_id: parseInt(document.getElementById('ord-cliente-id').value),
        equipo_modelo: document.getElementById('ord-modelo').value,
        equipo_serie_imei: document.getElementById('ord-serie').value,
        estado_estetico: document.getElementById('ord-estetico').value,
        contrasena: document.getElementById('ord-contrasena').value,
        falla_reportada: document.getElementById('ord-falla').value,
        precio_venta_usd: parseFloat(document.getElementById('ord-costo-usd').value) || 0.0,
        precio_venta_pen: parseFloat(document.getElementById('ord-costo-pen').value) || 0.0,
        tecnico_asignado: document.getElementById('ord-tecnico').value,
        notas_tecnico: document.getElementById('ord-notas').value
    };

    try {
        const res = await fetchAPI('/api/orders/create', {
            method: 'POST',
            body: payload
        });
        if (res.success) {
            showNotification(res.message);
            closeModal();
            renderReparaciones();
        } else {
            showNotification(res.error, 'error');
        }
    } catch (e) {
        console.error(e);
    }
}

async function openUpdateStatusModal(orderId) {
    try {
        const detail = await fetchAPI(`/api/orders/detail?id=${orderId}`);
        const o = detail.order;

        const html = `
            <form id="update-order-form" onsubmit="submitUpdateOrderStatus(event, ${orderId})">
                <p style="margin-bottom: 12px;">Actualizando el estado: <strong>${o.equipo_modelo}</strong></p>
                <div class="form-group">
                    <label>Nuevo Estado Técnico *</label>
                    <select id="upd-estado" class="form-control" required>
                        <option value="Recibido" ${o.estado === 'Recibido' ? 'selected' : ''}>Recibido</option>
                        <option value="En Diagnóstico" ${o.estado === 'En Diagnóstico' ? 'selected' : ''}>En Diagnóstico</option>
                        <option value="Esperando Repuesto" ${o.estado === 'Esperando Repuesto' ? 'selected' : ''}>Esperando Repuesto</option>
                        <option value="Reparado" ${o.estado === 'Reparado' ? 'selected' : ''}>Reparado</option>
                        <option value="Entregado" ${o.estado === 'Entregado' ? 'selected' : ''}>Entregado (Cierra orden)</option>
                        <option value="Sin Reparación" ${o.estado === 'Sin Reparación' ? 'selected' : ''}>Sin Reparación</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Técnico Responsable</label>
                    <input type="text" id="upd-tecnico" class="form-control" value="${o.tecnico_asignado || ''}">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Presupuesto Final (USD)</label>
                        <input type="number" step="0.01" id="upd-precio-usd" class="form-control" value="${o.precio_venta_usd}" oninput="convertPriceInput('upd-precio-usd', 'upd-precio-pen', 'toPEN')">
                    </div>
                    <div class="form-group">
                        <label>Presupuesto Final (PEN)</label>
                        <input type="number" step="0.01" id="upd-precio-pen" class="form-control" value="${o.precio_venta_pen}" oninput="convertPriceInput('upd-precio-usd', 'upd-precio-pen', 'toUSD')">
                    </div>
                </div>
                <div class="form-group">
                    <label>Notas Técnicas Actuales</label>
                    <textarea id="upd-notas-tecnico" class="form-control" rows="2">${o.notas_tecnico || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Garantía del Servicio Técnico (ej. "3 meses de garantía en pantalla", "Sin garantía")</label>
                    <input type="text" id="upd-garantia-servicio" class="form-control" value="${o.garantia_servicio || 'Sin garantía'}" placeholder="ej: 3 meses de garantía en pantalla">
                </div>
                <div class="form-group">
                    <label>Bitácora (Motivo del cambio de estado) *</label>
                    <input type="text" id="upd-bitacora-nota" class="form-control" required placeholder="ej: Cambio a En Diagnóstico.">
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px;">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Actualizar Orden</button>
                </div>
            </form>
        `;
        showModal(`Modificar Orden #${orderId}`, html);
    } catch (e) {
        console.error(e);
    }
}

async function submitUpdateOrderStatus(event, orderId) {
    event.preventDefault();
    const payload = {
        estado: document.getElementById('upd-estado').value,
        tecnico_asignado: document.getElementById('upd-tecnico').value,
        precio_venta_usd: parseFloat(document.getElementById('upd-precio-usd').value) || 0.0,
        precio_venta_pen: parseFloat(document.getElementById('upd-precio-pen').value) || 0.0,
        notas_tecnico: document.getElementById('upd-notas-tecnico').value,
        garantia_servicio: document.getElementById('upd-garantia-servicio').value,
        notas: document.getElementById('upd-bitacora-nota').value
    };

    try {
        const res = await fetchAPI(`/api/orders/update-status?id=${orderId}`, {
            method: 'POST',
            body: payload
        });
        if (res.success) {
            showNotification(res.message);
            closeModal();
            renderReparaciones();
        } else {
            showNotification(res.error, 'error');
        }
    } catch (e) {
        console.error(e);
    }
}

async function openOrderDetailModal(orderId) {
    try {
        const detail = await fetchAPI(`/api/orders/detail?id=${orderId}`);
        const o = detail.order;
        
        const historyHTML = detail.history.map(h => `
            <li style="margin-bottom: 10px; border-left: 2px solid var(--accent-color); padding-left: 10px;">
                <strong>${h.estado_nuevo}</strong> <span style="font-size: 11px; color: var(--text-secondary);">${h.fecha.replace('T', ' ').substring(0, 16)}</span>
                <p style="font-size: 13px; margin-top: 2px;">${h.notes || h.notas}</p>
                ${h.estado_anterior ? `<small style="color: var(--text-secondary)">De: ${h.estado_anterior}</small>` : ''}
            </li>
        `).join('');

        const html = `
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div>
                        <h4>Datos del Cliente</h4>
                        <p style="margin-top:4px;"><strong>Nombre:</strong> ${o.cliente_nombre}</p>
                        <p><strong>Documento:</strong> ${o.cliente_tipo_documento} ${o.cliente_documento}</p>
                        <p><strong>Teléfono:</strong> ${o.cliente_telefono || 'No registra'}</p>
                        <p><strong>Email:</strong> ${o.cliente_email || 'No registra'}</p>
                    </div>
                    <div>
                        <h4>Datos del Equipo</h4>
                        <p style="margin-top:4px;"><strong>Modelo:</strong> ${o.equipo_modelo}</p>
                        <p><strong>Serie/IMEI:</strong> ${o.equipo_serie_imei}</p>
                        <p><strong>Estado Estético:</strong> ${o.estado_estetico || 'No especifica'}</p>
                        <p><strong>Falla Reportada:</strong> ${o.falla_reportada}</p>
                        <p><strong>Contraseña:</strong> <code>${o.contrasena || 'No aplica'}</code></p>
                    </div>
                </div>
                <hr style="border: 0; border-top: 1px solid var(--border-color)">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div>
                        <h4>Detalles Técnicos</h4>
                        <p style="margin-top:4px;"><strong>Estado Actual:</strong> <span class="badge badge-${o.estado.toLowerCase().replace(/á/g, 'a').replace(/ó/g, 'o').replace(/ /g, '-')}">${o.estado}</span></p>
                        <p><strong>Técnico Responsable:</strong> ${o.tecnico_asignado || 'No asignado'}</p>
                        <p><strong>Costo Estimado:</strong> S/ ${o.precio_venta_pen.toFixed(2)} ($ ${o.precio_venta_usd.toFixed(2)})</p>
                        <p><strong>Notas Técnicas Internas:</strong> ${o.notas_tecnico || 'Sin notas'}</p>
                    </div>
                    <div>
                        <h4>Historial Clínico (Trazabilidad)</h4>
                        <ul style="list-style: none; margin-top: 8px; max-height: 200px; overflow-y: auto;">
                            ${historyHTML || '<li>Sin historial de cambios.</li>'}
                        </ul>
                    </div>
                </div>
            </div>
        `;
        showModal(`Historial Clínico - Orden #${o.id}`, html);
    } catch (e) {
        console.error(e);
    }
}

async function openCreateProductModal() {
    try {
        const categories = await fetchAPI('/api/categories');
        const catOptions = categories.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

        const html = `
            <form id="create-product-form" onsubmit="submitCreateProduct(event)">
                <div class="form-row">
                    <div class="form-group">
                        <label>Código / SKU del Producto *</label>
                        <input type="text" id="prod-codigo" class="form-control" required placeholder="ej: AP-IPH14P-256G">
                    </div>
                    <div class="form-group">
                        <label>Descripción / Nombre *</label>
                        <input type="text" id="prod-nombre" class="form-control" required placeholder="ej: iPhone 14 Pro Max">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Categoría *</label>
                        <select id="prod-categoria-id" class="form-control" required>
                            <option value="">Seleccione...</option>
                            ${catOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Stock Inicial</label>
                        <input type="number" id="prod-stock" class="form-control" value="0">
                    </div>
                    <div class="form-group">
                        <label>Stock Mínimo</label>
                        <input type="number" id="prod-stock-min" class="form-control" value="2">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Costo USD ($)</label>
                        <input type="number" step="0.01" id="prod-costo-usd" class="form-control" value="0.0" oninput="convertPriceInput('prod-costo-usd', 'prod-costo-pen', 'toPEN')">
                    </div>
                    <div class="form-group">
                        <label>Costo Soles (S/)</label>
                        <input type="number" step="0.01" id="prod-costo-pen" class="form-control" value="0.0" oninput="convertPriceInput('prod-costo-usd', 'prod-costo-pen', 'toUSD')">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Precio Venta USD ($) *</label>
                        <input type="number" step="0.01" id="prod-venta-usd" class="form-control" required value="0.0" oninput="convertPriceInput('prod-venta-usd', 'prod-venta-pen', 'toPEN')">
                    </div>
                    <div class="form-group">
                        <label>Precio Venta Soles (S/) *</label>
                        <input type="number" step="0.01" id="prod-venta-pen" class="form-control" required value="0.0" oninput="convertPriceInput('prod-venta-usd', 'prod-venta-pen', 'toUSD')">
                    </div>
                </div>
                <div class="form-group" style="display: flex; align-items: center; gap: 8px; margin-top: 15px;">
                    <input type="checkbox" id="prod-requiere-serie" style="width: auto; margin: 0; transform: scale(1.2);">
                    <label for="prod-requiere-serie" style="margin: 0; font-weight: 500; cursor: pointer; color: var(--text-primary);">Requiere Número de Serie / IMEI</label>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px;">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Registrar</button>
                </div>
            </form>
        `;
        showModal("Nuevo Producto", html);

        const checkboxEl = document.getElementById('prod-requiere-serie');
        const stockInputEl = document.getElementById('prod-stock');
        checkboxEl.addEventListener('change', () => {
            if (checkboxEl.checked) {
                stockInputEl.value = '0';
                stockInputEl.disabled = true;
            } else {
                stockInputEl.disabled = false;
            }
        });
    } catch (e) {
        console.error(e);
    }
}

async function submitCreateProduct(event) {
    event.preventDefault();
    const payload = {
        codigo: document.getElementById('prod-codigo').value,
        nombre: document.getElementById('prod-nombre').value,
        categoria_id: parseInt(document.getElementById('prod-categoria-id').value),
        stock_actual: parseInt(document.getElementById('prod-stock').value) || 0,
        stock_minimo: parseInt(document.getElementById('prod-stock-min').value) || 0,
        costo_usd: parseFloat(document.getElementById('prod-costo-usd').value) || 0.0,
        costo_pen: parseFloat(document.getElementById('prod-costo-pen').value) || 0.0,
        precio_venta_usd: parseFloat(document.getElementById('prod-venta-usd').value) || 0.0,
        precio_venta_pen: parseFloat(document.getElementById('prod-venta-pen').value) || 0.0,
        requiere_serie: document.getElementById('prod-requiere-serie').checked ? 1 : 0
    };

    try {
        const res = await fetchAPI('/api/products/create', {
            method: 'POST',
            body: payload
        });
        if (res.success) {
            showNotification(res.message);
            closeModal();
            renderInventario();
        } else {
            showNotification(res.error, 'error');
        }
    } catch (e) {
        console.error(e);
    }
}

function openEditProductModal(p) {
    fetchAPI('/api/categories').then(categories => {
        const catOptions = categories.map(c => `<option value="${c.id}" ${c.id === p.categoria_id ? 'selected' : ''}>${c.nombre}</option>`).join('');

        const html = `
            <form id="edit-product-form" onsubmit="submitEditProduct(event, ${p.id})">
                <div class="form-row">
                    <div class="form-group">
                        <label>Código / SKU *</label>
                        <input type="text" id="edit-prod-codigo" class="form-control" required value="${p.codigo}">
                    </div>
                    <div class="form-group">
                        <label>Descripción *</label>
                        <input type="text" id="edit-prod-nombre" class="form-control" required value="${p.nombre}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Categoría *</label>
                        <select id="edit-prod-categoria-id" class="form-control" required>
                            ${catOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Stock Actual</label>
                        <input type="number" id="edit-prod-stock" class="form-control" value="${p.stock_actual}">
                    </div>
                    <div class="form-group">
                        <label>Stock Mínimo</label>
                        <input type="number" id="edit-prod-stock-min" class="form-control" value="${p.stock_minimo}">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Costo USD ($)</label>
                        <input type="number" step="0.01" id="edit-prod-costo-usd" class="form-control" value="${p.costo_usd}" oninput="convertPriceInput('edit-prod-costo-usd', 'edit-prod-costo-pen', 'toPEN')">
                    </div>
                    <div class="form-group">
                        <label>Costo Soles (S/)</label>
                        <input type="number" step="0.01" id="edit-prod-costo-pen" class="form-control" value="${p.costo_pen}" oninput="convertPriceInput('edit-prod-costo-usd', 'edit-prod-costo-pen', 'toUSD')">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Precio Venta USD ($) *</label>
                        <input type="number" step="0.01" id="edit-prod-venta-usd" class="form-control" required value="${p.precio_venta_usd}" oninput="convertPriceInput('edit-prod-venta-usd', 'edit-prod-venta-pen', 'toPEN')">
                    </div>
                    <div class="form-group">
                        <label>Precio Venta Soles (S/) *</label>
                        <input type="number" step="0.01" id="edit-prod-venta-pen" class="form-control" required value="${p.precio_venta_pen}" oninput="convertPriceInput('edit-prod-venta-usd', 'edit-prod-venta-pen', 'toUSD')">
                    </div>
                </div>
                <div class="form-group" style="display: flex; align-items: center; gap: 8px; margin-top: 15px;">
                    <input type="checkbox" id="edit-prod-requiere-serie" style="width: auto; margin: 0; transform: scale(1.2);" ${p.requiere_serie === 1 ? 'checked' : ''}>
                    <label for="edit-prod-requiere-serie" style="margin: 0; font-weight: 500; cursor: pointer; color: var(--text-primary);">Requiere Número de Serie / IMEI</label>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px;">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Guardar Cambios</button>
                </div>
            </form>
        `;
        showModal(`Editar Producto: ${p.nombre}`, html);

        const checkboxEl = document.getElementById('edit-prod-requiere-serie');
        const stockInputEl = document.getElementById('edit-prod-stock');
        
        if (p.requiere_serie === 1) {
            stockInputEl.disabled = true;
        }

        checkboxEl.addEventListener('change', () => {
            if (checkboxEl.checked) {
                if (parseInt(stockInputEl.value) > 0) {
                    showNotification("Al activar el requerimiento de serie, el stock inicial se establecerá en 0 para ser ingresado por compras.", "info");
                    stockInputEl.value = '0';
                }
                stockInputEl.disabled = true;
            } else {
                stockInputEl.disabled = false;
            }
        });
    });
}

async function submitEditProduct(event, id) {
    event.preventDefault();
    const payload = {
        codigo: document.getElementById('edit-prod-codigo').value,
        nombre: document.getElementById('edit-prod-nombre').value,
        categoria_id: parseInt(document.getElementById('edit-prod-categoria-id').value),
        stock_actual: parseInt(document.getElementById('edit-prod-stock').value) || 0,
        stock_minimo: parseInt(document.getElementById('edit-prod-stock-min').value) || 0,
        costo_usd: parseFloat(document.getElementById('edit-prod-costo-usd').value) || 0.0,
        costo_pen: parseFloat(document.getElementById('edit-prod-costo-pen').value) || 0.0,
        precio_venta_usd: parseFloat(document.getElementById('edit-prod-venta-usd').value) || 0.0,
        precio_venta_pen: parseFloat(document.getElementById('edit-prod-venta-pen').value) || 0.0,
        requiere_serie: document.getElementById('edit-prod-requiere-serie').checked ? 1 : 0
    };

    try {
        const res = await fetchAPI(`/api/products/update?id=${id}`, {
            method: 'POST',
            body: payload
        });
        if (res.success) {
            showNotification(res.message);
            closeModal();
            renderInventario();
        } else {
            showNotification(res.error, 'error');
        }
    } catch (e) {
        console.error(e);
    }
}

async function deleteProduct(id) {
    if (!confirm("¿Está seguro de eliminar este producto?")) return;
    try {
        const res = await fetchAPI(`/api/products/delete?id=${id}`, { method: 'POST' });
        if (res.success) {
            showNotification(res.message);
            renderInventario();
        } else {
            showNotification(res.error, 'error');
        }
    } catch (e) {
        console.error(e);
    }
}

async function openCategoriesModal() {
    try {
        const categories = await fetchAPI('/api/categories');
        const listHTML = categories.map(c => `
            <div style="display:flex; justify-content:space-between; border-bottom: 1px solid var(--border-color); padding: 8px 0;">
                <span>${c.nombre}</span>
                <span style="color:var(--text-secondary); font-size:12px;">ID: ${c.id}</span>
            </div>
        `).join('');

        const html = `
            <div style="display:flex; flex-direction:column; gap:16px;">
                <form id="create-cat-form" onsubmit="submitCreateCategory(event)" style="display:flex; gap:10px; align-items:flex-end;">
                    <div class="form-group" style="flex:1; margin-bottom:0;">
                        <label>Nueva Categoría</label>
                        <input type="text" id="cat-nombre" class="form-control" required placeholder="Nombre de categoría">
                    </div>
                    <button type="submit" class="btn btn-primary">Agregar</button>
                </form>
                <hr style="border:0; border-top:1px solid var(--border-color)">
                <h4>Categorías Registradas</h4>
                <div style="max-height: 250px; overflow-y:auto; padding-right: 6px;">
                    ${listHTML || '<p>No hay categorías.</p>'}
                </div>
            </div>
        `;
        showModal("Gestión de Categorías", html);
    } catch (e) {
        console.error(e);
    }
}

async function submitCreateCategory(event) {
    event.preventDefault();
    const payload = {
        nombre: document.getElementById('cat-nombre').value
    };

    try {
        const res = await fetchAPI('/api/categories/create', {
            method: 'POST',
            body: payload
        });
        if (res.success) {
            showNotification(res.message);
            openCategoriesModal();
        } else {
            showNotification(res.error, 'error');
        }
    } catch (e) {
        console.error(e);
    }
}

async function submitCreateLoan(event) {
    event.preventDefault();
    const payload = {
        proveedor_id: parseInt(document.getElementById('loan-proveedor-id').value),
        producto_id: parseInt(document.getElementById('loan-producto-id').value),
        cantidad: parseInt(document.getElementById('loan-cantidad').value) || 0,
        costo_unitario_usd: parseFloat(document.getElementById('loan-costo-usd').value) || 0.0,
        costo_unitario_pen: parseFloat(document.getElementById('loan-costo-pen').value) || 0.0
    };

    try {
        const res = await fetchAPI('/api/loans/create', {
            method: 'POST',
            body: payload
        });
        if (res.success) {
            showNotification(res.message);
            closeModal();
            renderPrestamos();
        } else {
            showNotification(res.error, 'error');
        }
    } catch (e) {
        console.error(e);
    }
}

async function returnLoan(id) {
    if (!confirm("¿Está seguro de realizar la devolución de este repuesto/equipo?")) return;
    try {
        const res = await fetchAPI(`/api/loans/return?id=${id}`, { method: 'POST' });
        if (res.success) {
            showNotification(res.message);
            renderPrestamos();
        } else {
            showNotification(res.error, 'error');
        }
    } catch (e) {
        console.error(e);
    }
}

function openAbonoModal(creditId, type) {
    const html = `
        <form id="abono-form" onsubmit="submitAbono(event, ${creditId}, '${type}')">
            <div class="form-row">
                <div class="form-group">
                    <label>Monto a Amortizar USD ($)</label>
                    <input type="number" step="0.01" id="abono-usd" class="form-control" value="0.00" oninput="convertPriceInput('abono-usd', 'abono-pen', 'toPEN')">
                </div>
                <div class="form-group">
                    <label>Monto a Amortizar Soles (S/)</label>
                    <input type="number" step="0.01" id="abono-pen" class="form-control" value="0.00" oninput="convertPriceInput('abono-usd', 'abono-pen', 'toUSD')">
                </div>
            </div>
            <div class="form-group">
                <label>Método de Pago *</label>
                <select id="abono-metodo" class="form-control" required>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Tarjeta">Tarjeta</option>
                    <option value="Transferencia">Transferencia</option>
                    <option value="Yape/Plin">Yape/Plin</option>
                </select>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px;">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                <button type="submit" class="btn btn-primary">Registrar Abono</button>
            </div>
        </form>
    `;
    showModal(`Registrar Abono - Cuenta de ${type === 'cliente' ? 'Cliente' : 'Proveedor'}`, html);
}

async function submitAbono(event, creditId, type) {
    event.preventDefault();
    const payload = {
        monto_usd: parseFloat(document.getElementById('abono-usd').value) || 0.0,
        monto_pen: parseFloat(document.getElementById('abono-pen').value) || 0.0,
        metodo_pago: document.getElementById('abono-metodo').value
    };

    const endpoint = type === 'cliente' ? `/api/credits/clients/pay?id=${creditId}` : `/api/credits/providers/pay?id=${creditId}`;

    try {
        const res = await fetchAPI(endpoint, {
            method: 'POST',
            body: payload
        });
        if (res.success) {
            showNotification(res.message);
            closeModal();
            renderCreditos();
        } else {
            showNotification(res.error, 'error');
        }
    } catch (e) {
        console.error(e);
    }
}

function addQuoteItem() {
    const desc = document.getElementById('quote-item-desc').value;
    const qty = parseInt(document.getElementById('quote-item-qty').value) || 1;
    const priceUsd = parseFloat(document.getElementById('quote-item-price-usd').value) || 0.0;
    const pricePen = parseFloat(document.getElementById('quote-item-price-pen').value) || 0.0;

    if (!desc) {
        showNotification("Describa el ítem antes de agregarlo", 'error');
        return;
    }

    appState.quoteItems.push({
        descripcion: desc,
        cantidad: qty,
        precio_unitario_usd: priceUsd,
        precio_unitario_pen: pricePen,
        total_usd: priceUsd * qty,
        total_pen: pricePen * qty
    });

    document.getElementById('quote-item-desc').value = '';
    document.getElementById('quote-item-price-usd').value = '0.00';
    document.getElementById('quote-item-price-pen').value = '0.00';
    document.getElementById('quote-item-qty').value = '1';

    updateQuoteUI();
}

function removeQuoteItem(index) {
    appState.quoteItems.splice(index, 1);
    updateQuoteUI();
}

function updateQuoteUI() {
    const tbody = document.getElementById('quote-items-tbody');
    if (appState.quoteItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color:var(--text-secondary);">Agregue ítems a la cotización.</td></tr>`;
        document.getElementById('quote-total-pen-lbl').innerText = 'S/ 0.00';
        document.getElementById('quote-total-usd-lbl').innerText = '$ 0.00';
        return;
    }

    tbody.innerHTML = appState.quoteItems.map((it, idx) => `
        <tr>
            <td>${it.descripcion}</td>
            <td>${it.cantidad}</td>
            <td>S/ ${it.precio_unitario_pen.toFixed(2)}</td>
            <td>S/ ${it.total_pen.toFixed(2)}</td>
            <td><button class="btn btn-danger btn-xs" onclick="removeQuoteItem(${idx})">&times;</button></td>
        </tr>
    `).join('');

    let totalPen = 0;
    let totalUsd = 0;
    appState.quoteItems.forEach(it => {
        totalPen += it.total_pen;
        totalUsd += it.total_usd;
    });

    document.getElementById('quote-total-pen-lbl').innerText = `S/ ${totalPen.toFixed(2)}`;
    document.getElementById('quote-total-usd-lbl').innerText = `$ ${totalUsd.toFixed(2)}`;
}

async function submitQuote() {
    const cliName = document.getElementById('quote-cli-nombre').value;
    const cliDoc = document.getElementById('quote-cli-doc').value;

    if (!cliName) {
        showNotification("Debe ingresar el nombre del cliente", 'error');
        return;
    }
    if (appState.quoteItems.length === 0) {
        showNotification("Agregue al menos un producto", 'error');
        return;
    }

    let totalPen = 0;
    let totalUsd = 0;
    appState.quoteItems.forEach(it => {
        totalPen += it.total_pen;
        totalUsd += it.total_usd;
    });

    const payload = {
        cliente_nombre: cliName,
        cliente_documento: cliDoc,
        total_usd: totalUsd,
        total_pen: totalPen,
        items: appState.quoteItems
    };

    try {
        const res = await fetchAPI('/api/quotes/create', {
            method: 'POST',
            body: payload
        });
        if (res.success) {
            showNotification(res.message);
            appState.quoteItems = [];
            document.getElementById('quote-cli-nombre').value = '';
            document.getElementById('quote-cli-doc').value = '';
            updateQuoteUI();
            loadQuoteHistory();
        } else {
            showNotification(res.error, 'error');
        }
    } catch (e) {
        console.error(e);
    }
}

async function loadQuoteHistory() {
    const list = document.getElementById('quote-history-list');
    try {
        const quotes = await fetchAPI('/api/quotes');
        if (quotes.length === 0) {
            list.innerHTML = `<p style="color:var(--text-secondary); font-size:12px;">No se registran cotizaciones.</p>`;
            return;
        }

        list.innerHTML = quotes.map(q => `
            <div style="border-bottom:1px solid var(--border-color); padding:8px 0; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <span style="font-size:12px; font-weight:600;">Cotización #${q.id} - ${q.cliente_nombre}</span><br>
                    <small style="color:var(--text-secondary);">S/ ${q.total_pen.toFixed(2)} | ${q.fecha.split('T')[0]}</small>
                </div>
                <div style="display:flex; gap:4px;">
                    <button class="btn btn-secondary btn-xs" onclick="printQuote(${q.id})" title="Imprimir"><i class="fa-solid fa-print"></i></button>
                    ${q.estado === 'Pendiente' ? `
                        <button class="btn btn-primary btn-xs" onclick="convertQuoteToSaleModal(${q.id})" title="Convertir a Venta Real"><i class="fa-solid fa-cart-shopping"></i> POS</button>
                    ` : '<span class="badge badge-activo" style="font-size:9px;">Vendida</span>'}
                </div>
            </div>
        `).join('');

    } catch (e) {
        console.error(e);
    }
}

async function submitConvertQuote(event, quoteId) {
    event.preventDefault();
    const payload = {
        cliente_id: parseInt(document.getElementById('conv-cliente-id').value),
        tipo_documento: document.getElementById('conv-doc-type').value,
        metodo_pago: document.getElementById('conv-payment').value
    };

    try {
        const res = await fetchAPI(`/api/quotes/convert?id=${quoteId}`, {
            method: 'POST',
            body: payload
        });
        if (res.success) {
            showNotification(res.message);
            closeModal();
            loadQuoteHistory();
            openReceiptPrintModal(res.venta_id);
        } else {
            showNotification(res.error, 'error');
        }
    } catch (e) {
        console.error(e);
    }
}

async function submitConfigUpdate(event) {
    event.preventDefault();
    const payload = {
        business_name: document.getElementById('cfg-name').value,
        business_address: document.getElementById('cfg-address').value,
        business_ruc: document.getElementById('cfg-ruc').value,
        business_phone: document.getElementById('cfg-phone').value,
        social_instagram: document.getElementById('cfg-instagram').value,
        social_facebook: document.getElementById('cfg-facebook').value,
        google_business_url: document.getElementById('cfg-google').value,
        exchange_rate: document.getElementById('cfg-exchange-rate').value
    };

    try {
        const res = await fetchAPI('/api/config/update', {
            method: 'POST',
            body: payload
        });
        if (res.success) {
            showNotification(res.message);
            await fetchExchangeRateAndConfig();
        } else {
            showNotification(res.error, 'error');
        }
    } catch (e) {
        console.error(e);
    }
}

async function triggerSystemReset() {
    const confirmation1 = confirm("ATENCIÓN: ¿Desea restablecer el sistema completo?");
    if (!confirmation1) return;

    const confirmation2 = prompt("Escribe: ELIMINAR");
    if (confirmation2 !== 'ELIMINAR') {
        showNotification("Restablecimiento cancelado.", 'warning');
        return;
    }

    try {
        const res = await fetchAPI('/api/reset', { method: 'POST' });
        if (res.success) {
            showNotification("Sistema restablecido.", 'success');
            await fetchExchangeRateAndConfig();
            window.location.hash = '#dashboard';
            renderDashboard();
        } else {
            showNotification(res.error, 'error');
        }
    } catch (e) {
        console.error(e);
    }
}

function getItemPrintDetailsHTML(it) {
    let warrantyText = "";
    let serialText = "";
    
    const nameLower = it.nombre ? it.nombre.toLowerCase() : (it.descripcion ? it.descripcion.toLowerCase() : "");
    const prodCode = it.codigo || "GENERIC";
    const prodId = it.producto_id || 1;
    
    if (nameLower.includes("iphone") || nameLower.includes("macbook") || nameLower.includes("ipad") || nameLower.includes("watch") || nameLower.includes("airpods")) {
        warrantyText = `<span style="display:inline-block; font-size:9px; background-color:#e1f0ff; color:#0071e3; border-radius:3px; padding:1px 5px; margin-left:6px; font-weight:bold;">Garantía: 12 meses</span>`;
        const hash = (prodId + 13) * 7919;
        serialText = `<div style="font-size:9px; color:#555555; margin-top:2px;">S/N: ZM${hash}F93</div>`;
    } else if (nameLower.includes("cargador") || nameLower.includes("power adapter") || nameLower.includes("cable") || nameLower.includes("pantalla") || nameLower.includes("repuesto")) {
        warrantyText = `<span style="display:inline-block; font-size:9px; background-color:#e1f0ff; color:#0071e3; border-radius:3px; padding:1px 5px; margin-left:6px; font-weight:bold;">Garantía: 6 meses</span>`;
        const hash = (prodId + 7) * 4999;
        serialText = `<div style="font-size:9px; color:#555555; margin-top:2px;">S/N: AC${hash}G10</div>`;
    }
    
    return {
        warranty: warrantyText,
        serial: serialText
    };
}

async function printReceipt(orderId) {
    try {
        const detail = await fetchAPI(`/api/orders/detail?id=${orderId}`);
        const o = detail.order;
        
        const isDelivery = o.estado === 'Entregado';
        const printArea = document.getElementById('print-area');
        const logoPath = 'logo.jpg';
        
        const formatPrintDate = (isoStr) => {
            if (!isoStr) return 'No registra';
            try {
                const d = new Date(isoStr);
                if (isNaN(d.getTime())) return isoStr;
                const pad = (n) => String(n).padStart(2, '0');
                const day = pad(d.getDate());
                const month = pad(d.getMonth() + 1);
                const year = d.getFullYear();
                let hours = d.getHours();
                const minutes = pad(d.getMinutes());
                const ampm = hours >= 12 ? 'p. m.' : 'a. m.';
                hours = hours % 12;
                hours = hours ? hours : 12;
                return `${day}/${month}/${year}, ${pad(hours)}:${minutes} ${ampm}`;
            } catch(e) {
                return isoStr;
            }
        };

        const formatPrintDateOnly = (isoStr) => {
            if (!isoStr) return 'No registra';
            try {
                const d = new Date(isoStr);
                if (isNaN(d.getTime())) return isoStr;
                const pad = (n) => String(n).padStart(2, '0');
                const day = pad(d.getDate());
                const month = pad(d.getMonth() + 1);
                const year = d.getFullYear();
                return `${day}/${month}/${year}`;
            } catch(e) {
                return isoStr;
            }
        };

        if (isDelivery) {
            let dtVenceStr = 'No aplica';
            let dtVenceRaw = null;
            const garantiaVal = o.garantia_servicio || 'Sin garantía';
            
            if (o.fecha_entrega && !garantiaVal.toLowerCase().includes('sin') && !garantiaVal.toLowerCase().includes('no aplica')) {
                const match = garantiaVal.match(/(\d+)\s*(mes|meses|dia|dias|días|año|años|ano|anos)/i);
                if (match) {
                    const num = parseInt(match[1]);
                    const unit = match[2].toLowerCase();
                    const dtEntrega = new Date(o.fecha_entrega);
                    if (unit.startsWith('mes')) {
                        dtEntrega.setMonth(dtEntrega.getMonth() + num);
                    } else if (unit.startsWith('dia') || unit.startsWith('día')) {
                        dtEntrega.setDate(dtEntrega.getDate() + num);
                    } else if (unit.startsWith('año') || unit.startsWith('ano')) {
                        dtEntrega.setFullYear(dtEntrega.getFullYear() + num);
                    }
                    dtVenceRaw = dtEntrega.toISOString();
                    dtVenceStr = formatPrintDateOnly(dtVenceRaw);
                }
            }

            const warrantyNoticeText = dtVenceStr !== 'No aplica'
                ? `La garantía cubre defectos de fabricación en los componentes reemplazados hasta el ${dtVenceStr}.`
                : `Servicio entregado a satisfacción. No aplica garantía adicional.`;

            printArea.innerHTML = `
                <div class="a4-container doc-entrega">
                    <div class="a4-header">
                        <div class="a4-company-info">
                            <img src="${logoPath}" class="a4-logo" alt="Logo Zona Mac Peru">
                            <div class="a4-company-details">
                                <h2>Zona Mac Peru</h2>
                                <p>RUC: 10446507309</p>
                                <p>Dirección: Av. Petit Thouars 5356 Miraflores, Lima</p>
                                <p>Teléfono: +51 941 995 237</p>
                            </div>
                        </div>
                        <div class="a4-comprobante-box delivery-box">
                            <h3>CONSTANCIA DE ENTREGA</h3>
                            <div class="doc-type">GARANTÍA DE SERVICIO</div>
                            <div class="doc-number">#${String(o.id).padStart(5, '0')}</div>
                        </div>
                    </div>

                    <div class="a4-metadata-section">
                        <div class="a4-metadata-col">
                            <h4>DATOS DEL PROPIETARIO</h4>
                            <p class="meta-val"><strong>${o.cliente_nombre.toUpperCase()}</strong></p>
                            <p class="meta-val">Doc: ${o.cliente_documento || 'No registrado'}</p>
                            <p class="meta-val">Método de Pago: Transferencia</p>
                        </div>
                        <div class="a4-metadata-col">
                            <h4>DATOS DEL SERVICIO</h4>
                            <p class="meta-val">Ingreso: <strong>${formatPrintDate(o.fecha_registro)}</strong></p>
                            <p class="meta-val">Entrega: <strong>${formatPrintDate(o.fecha_entrega)}</strong></p>
                            <p class="meta-val warranty-green">Garantía: ${garantiaVal} ${dtVenceStr !== 'No aplica' ? `(Vence: ${dtVenceStr})` : ''}</p>
                        </div>
                    </div>

                    <h3 class="a4-section-title">ESPECIFICACIONES DEL EQUIPO</h3>
                    <div class="a4-info-block">
                        <div class="info-row">
                            <div class="info-label">Equipo / Modelo:</div>
                            <div class="info-value"><strong>${o.equipo_modelo.toUpperCase()}</strong></div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">S/N:</div>
                            <div class="info-value"><strong>${o.equipo_serie_imei.toUpperCase()}</strong></div>
                        </div>
                    </div>

                    <div class="diagnostico-card">
                        <h3>DIAGNÓSTICO TÉCNICO FINAL Y SOLUCIÓN APLICADA</h3>
                        <p class="diagnostico-content">${(o.notas_tecnico || o.notes_tecnico || 'SE REALIZÓ EL DIAGNÓSTICO Y LA SOLUCIÓN TÉCNICA CORRESPONDIENTE.').toUpperCase()}</p>
                    </div>

                    <h3 class="a4-section-title">DETALLE DE COSTOS Y REPUESTOS</h3>
                    <table class="a4-table">
                        <thead>
                            <tr>
                                <th style="text-align: left;">Detalle / Concepto</th>
                                <th style="width: 80px; text-align: center;">Cant.</th>
                                <th style="width: 120px; text-align: right;">Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Servicio de Mano de Obra y Calibración</td>
                                <td style="text-align: center;">1 U.</td>
                                <td style="text-align: right;">S/ ${o.precio_venta_pen.toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div class="a4-totals-container">
                        <div class="a4-totals-box">
                            <div class="a4-total-row">
                                <span>Mano de Obra</span>
                                <strong>S/ ${o.precio_venta_pen.toFixed(2)}</strong>
                            </div>
                            <div class="a4-total-row">
                                <span>Repuestos Utilizados</span>
                                <strong>S/ 0.00</strong>
                            </div>
                            <div class="dotted-divider"></div>
                            <div class="a4-total-row grand-total">
                                <span>Total Pagado</span>
                                <strong>S/ ${o.precio_venta_pen.toFixed(2)}</strong>
                            </div>
                        </div>
                    </div>

                    <div class="a4-terms-section-entrega">
                        <p class="terms-p">Esta constancia acredita que el equipo fue entregado a satisfacción del cliente.</p>
                        <p class="warranty-p">${warrantyNoticeText}</p>
                    </div>
                </div>
            `;
        } else {
            printArea.innerHTML = `
                <div class="a4-container doc-ingreso">
                    <div class="a4-header">
                        <div class="a4-company-info">
                            <img src="${logoPath}" class="a4-logo" alt="Logo Zona Mac Peru">
                            <div class="a4-company-details">
                                <h2>Zona Mac Peru</h2>
                                <p>RUC: 10446507309</p>
                                <p>Dirección: Av. Petit Thouars 5356 Miraflores, Lima</p>
                                <p>Teléfono: +51 941 995 237</p>
                            </div>
                        </div>
                        <div class="a4-comprobante-box service-box">
                            <h3>CARGO DE RECEPCIÓN</h3>
                            <div class="doc-type">ORDEN DE SERVICIO</div>
                            <div class="doc-number">#${String(o.id).padStart(5, '0')}</div>
                        </div>
                    </div>

                    <h3 class="a4-section-title">1. DATOS DEL CLIENTE</h3>
                    <div class="a4-info-block">
                        <div class="info-row">
                            <div class="info-label">Nombre/Razón:</div>
                            <div class="info-value"><strong>${o.cliente_nombre.toUpperCase()}</strong></div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">Documento:</div>
                            <div class="info-value">${o.cliente_documento || 'No registrado'}</div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">Teléfono:</div>
                            <div class="info-value">${o.cliente_telefono || 'No registrado'}</div>
                        </div>
                    </div>

                    <h3 class="a4-section-title">2. INFORMACIÓN DEL EQUIPO</h3>
                    <div class="a4-info-block">
                        <div class="info-row">
                            <div class="info-label">Marca / Modelo:</div>
                            <div class="info-value"><strong>${o.equipo_modelo.toUpperCase()}</strong></div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">Número de Serie:</div>
                            <div class="info-value"><strong>${o.equipo_serie_imei.toUpperCase()}</strong></div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">Garantía Comercial:</div>
                            <div class="info-value">Externa</div>
                        </div>
                        <div class="info-row">
                            <div class="info-label">Fecha de Ingreso:</div>
                            <div class="info-value"><strong>${formatPrintDate(o.fecha_registro)}</strong></div>
                        </div>
                    </div>

                    <div class="falla-card">
                        <h3>3. FALLA O FALLA REPORTADA POR EL CLIENTE</h3>
                        <p class="falla-content">"${o.falla_reportada.toUpperCase()}"</p>
                    </div>

                    <div class="a4-totals-container">
                        <div class="a4-totals-box">
                            <div class="a4-total-row">
                                <span>Costo Mano Obra Est.</span>
                                <strong>S/ ${o.precio_venta_pen.toFixed(2)}</strong>
                            </div>
                            <div class="dotted-divider"></div>
                            <div class="a4-total-row grand-total">
                                <span>Total Presupuestado</span>
                                <strong>S/ ${o.precio_venta_pen.toFixed(2)}</strong>
                            </div>
                        </div>
                    </div>

                    <div class="a4-signatures-block">
                        <div class="a4-signature-line">Firma del Cliente</div>
                        <div class="a4-signature-line">Firma del Técnico / Recibido</div>
                    </div>

                    <div class="a4-terms-section">
                        Al firmar este documento, el cliente acepta los términos y condiciones del servicio técnico.<br>
                        Los presupuestos de diagnóstico tienen validez de 15 días calendario.
                    </div>
                </div>
            `;
        }

        window.print();
    } catch (e) {
        console.error(e);
        showNotification("Error al cargar la vista de impresión.", 'error');
    }
}

async function openReceiptPrintModal(saleId) {
    try {
        const sales = await fetchAPI('/api/sales');
        const sale = sales.find(s => s.id === saleId);
        if (!sale) return;

        const items = JSON.parse(sale.items_json);
        const isFactura = sale.tipo_documento === 'Factura';

        const itemsHTML = items.map(it => `
            <tr>
                <td>${it.nombre}<br><small>${it.cantidad} x S/ ${it.precio_unitario_pen.toFixed(2)}</small></td>
                <td style="text-align:right;">S/ ${it.total_pen.toFixed(2)}</td>
            </tr>
        `).join('');

        const html = `
            <div style="text-align: center; margin-bottom: 16px;">
                <i class="fa-solid fa-circle-check" style="font-size: 48px; color: var(--success-color); margin-bottom: 10px;"></i>
                <h4>¡Venta Procesada Correctamente!</h4>
                <p>Nº Documento: <strong>${sale.numero_documento}</strong></p>
            </div>
            <div style="border: 1px solid var(--border-color); padding: 16px; border-radius: 8px; font-family: monospace; background: var(--bg-input); margin-bottom: 20px; font-size:13px;">
                <div style="text-align:center; font-weight:bold; margin-bottom:10px;">ZONA MAC PERU</div>
                <table style="width:100%; font-size:12px;">
                    ${itemsHTML}
                </table>
                <hr style="border:0; border-top:1px dashed var(--border-color); margin: 6px 0;">
                <div style="display:flex; justify-content:space-between; font-weight:bold;"><span>TOTAL:</span><span>S/ ${sale.total_pen.toFixed(2)}</span></div>
            </div>
            <div style="display:flex; gap:10px; justify-content:flex-end;">
                <button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>
                <button class="btn btn-primary" onclick="printThermalTicket(${saleId})"><i class="fa-solid fa-print"></i> Imprimir A4</button>
            </div>
        `;
        showModal("Recibo de Venta", html);
    } catch (e) {
        console.error(e);
    }
}

async function printThermalTicket(saleId) {
    try {
        const sales = await fetchAPI('/api/sales');
        const s = sales.find(x => x.id === saleId);
        if (!s) return;

        const items = JSON.parse(s.items_json);
        const isFactura = s.tipo_documento === 'Factura';
        const logoPath = 'logo.jpg';
        
        const contacts = await fetchAPI('/api/contacts');
        const client = contacts.find(c => c.id === s.contacto_id) || {};

        const formatPrintDate = (isoStr) => {
            if (!isoStr) return 'No registra';
            try {
                const d = new Date(isoStr);
                if (isNaN(d.getTime())) return isoStr;
                const pad = (n) => String(n).padStart(2, '0');
                const day = pad(d.getDate());
                const month = pad(d.getMonth() + 1);
                const year = d.getFullYear();
                let hours = d.getHours();
                const minutes = pad(d.getMinutes());
                const ampm = hours >= 12 ? 'p. m.' : 'a. m.';
                hours = hours % 12;
                hours = hours ? hours : 12;
                return `${day}/${month}/${year}, ${pad(hours)}:${minutes} ${ampm}`;
            } catch(e) {
                return isoStr;
            }
        };

        const printArea = document.getElementById('print-area');
        
        const rowsHTML = items.map(it => {
            const printDetails = getItemPrintDetailsHTML(it);
            const warrantyHTML = it.garantia 
                ? `<span style="display:inline-block; font-size:9px; background-color:#e1f0ff; color:#0071e3; border-radius:3px; padding:1px 5px; margin-left:6px; font-weight:bold;">Garantía: ${it.garantia}</span>`
                : printDetails.warranty;
            return `
                <tr>
                    <td>
                        <strong>${it.nombre}</strong>
                        ${warrantyHTML}
                        ${printDetails.serial}
                    </td>
                    <td style="text-align: center;">${it.cantidad} U.</td>
                    <td style="text-align: right;">S/ ${it.precio_unitario_pen.toFixed(2)}</td>
                    <td style="text-align: right;">S/ ${it.total_pen.toFixed(2)}</td>
                </tr>
            `;
        }).join('');

        let subtotalStr = `S/ ${s.total_pen.toFixed(2)}`;
        let igvRowHTML = '';
        if (isFactura) {
            const subtotalVal = s.total_pen / 1.18;
            const igvVal = s.total_pen - subtotalVal;
            subtotalStr = `S/ ${subtotalVal.toFixed(2)}`;
            igvRowHTML = `
                <div class="a4-total-row">
                    <span>IGV (18%):</span>
                    <span>S/ ${igvVal.toFixed(2)}</span>
                </div>
            `;
        }

        printArea.innerHTML = `
            <div class="a4-container">
                <div class="a4-header">
                    <div class="a4-company-info">
                        <img src="${logoPath}" class="a4-logo" alt="Logo Zona Mac Peru">
                        <div class="a4-company-details">
                            <h2>Zona Mac Peru</h2>
                            <p>RUC: 10446507309</p>
                            <p>Dirección: Av. Petit Thouars 5356 Miraflores, Lima</p>
                            <p>Teléfono: +51 941 995 237</p>
                        </div>
                    </div>
                    <div class="a4-comprobante-box">
                        <h3>RUC: 10446507309</h3>
                        <div class="doc-type">${s.tipo_documento === 'Factura' ? 'FACTURA ELECTRÓNICA' : s.tipo_documento === 'Boleta' ? 'BOLETA ELECTRÓNICA' : 'NOTA DE VENTA'}</div>
                        <div class="doc-number">${s.numero_documento}</div>
                    </div>
                </div>

                <div class="a4-metadata-section">
                    <div class="a4-metadata-col">
                        <h4>Datos del Adquiriente</h4>
                        <p><strong>Señor(es):</strong> ${client.nombre || 'Público General'}</p>
                        <p><strong>Documento:</strong> ${client.tipo_documento || 'DNI'} ${client.numero_documento || 'Público General'}</p>
                        <p><strong>Dirección:</strong> Lima, Perú</p>
                    </div>
                    <div class="a4-metadata-col">
                        <h4>Información del Comprobante</h4>
                        <p><strong>Fecha de Emisión:</strong> ${formatPrintDate(s.fecha)}</p>
                        <p><strong>Moneda de Operación:</strong> PEN (Soles)</p>
                        <p><strong>Condición de Pago:</strong> ${s.metodo_pago}</p>
                    </div>
                </div>

                <div class="a4-section-box" style="padding: 0;">
                    <table class="a4-table">
                        <thead>
                            <tr>
                                <th style="text-align: left;">Descripción del Producto / Garantía</th>
                                <th style="width: 80px; text-align: center;">Cant.</th>
                                <th style="width: 120px; text-align: right;">P. Unitario</th>
                                <th style="width: 120px; text-align: right;">Valor Venta</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHTML}
                        </tbody>
                    </table>
                </div>

                <div class="a4-totals-container">
                    <div class="a4-totals-box">
                        <div class="a4-total-row">
                            <span>Subtotal:</span>
                            <span>${subtotalStr}</span>
                        </div>
                        ${igvRowHTML}
                        <div class="a4-total-row grand-total">
                            <span>Importe Total:</span>
                            <span>S/ ${s.total_pen.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <div class="a4-terms-section" style="text-align: center; margin-top: 30px;">
                    Representación impresa de la ${s.tipo_documento === 'Factura' ? 'Factura Electrónica' : s.tipo_documento === 'Boleta' ? 'Boleta Electrónica' : 'Nota de Venta'}.<br>
                    ¡Gracias por su preferencia!
                </div>
            </div>
        `;
        window.print();
    } catch (e) {
        console.error(e);
        showNotification("Error al cargar la vista de impresión.", 'error');
    }
}

async function printQuote(quoteId) {
    try {
        const detail = await fetchAPI(`/api/quotes/detail?id=${quoteId}`);
        const q = detail.cotizacion;
        const logoPath = 'logo.jpg';

        const formatPrintDate = (isoStr) => {
            if (!isoStr) return 'No registra';
            try {
                const d = new Date(isoStr);
                if (isNaN(d.getTime())) return isoStr;
                const pad = (n) => String(n).padStart(2, '0');
                const day = pad(d.getDate());
                const month = pad(d.getMonth() + 1);
                const year = d.getFullYear();
                let hours = d.getHours();
                const minutes = pad(d.getMinutes());
                const ampm = hours >= 12 ? 'p. m.' : 'a. m.';
                hours = hours % 12;
                hours = hours ? hours : 12;
                return `${day}/${month}/${year}, ${pad(hours)}:${minutes} ${ampm}`;
            } catch(e) {
                return isoStr;
            }
        };

        const printArea = document.getElementById('print-area');
        
        const rowsHTML = q.items.map(it => {
            const printDetails = getItemPrintDetailsHTML(it);
            return `
                <tr>
                    <td>
                        <strong>${it.descripcion}</strong>
                        ${printDetails.warranty}
                        ${printDetails.serial}
                    </td>
                    <td style="text-align: center;">${it.cantidad} U.</td>
                    <td style="text-align: right;">S/ ${it.precio_unitario_pen.toFixed(2)}</td>
                    <td style="text-align: right;">S/ ${it.total_pen.toFixed(2)}</td>
                </tr>
            `;
        }).join('');

        printArea.innerHTML = `
            <div class="a4-container">
                <div class="a4-header">
                    <div class="a4-company-info">
                        <img src="${logoPath}" class="a4-logo" alt="Logo Zona Mac Peru">
                        <div class="a4-company-details">
                            <h2>Zona Mac Peru</h2>
                            <p>RUC: 10446507309</p>
                            <p>Dirección: Av. Petit Thouars 5356 Miraflores, Lima</p>
                            <p>Teléfono: +51 941 995 237</p>
                        </div>
                    </div>
                    <div class="a4-comprobante-box">
                        <h3>RUC: 10446507309</h3>
                        <div class="doc-type">COTIZACIÓN COMERCIAL</div>
                        <div class="doc-number">#${String(q.id).padStart(5, '0')}</div>
                    </div>
                </div>

                <div class="a4-metadata-section">
                    <div class="a4-metadata-col">
                        <h4>Datos del Cliente</h4>
                        <p><strong>Señor(es):</strong> ${q.cliente_nombre}</p>
                        <p><strong>Documento:</strong> ${q.cliente_documento || 'No registrado'}</p>
                        <p><strong>Dirección:</strong> Lima, Perú</p>
                    </div>
                    <div class="a4-metadata-col">
                        <h4>Información del Documento</h4>
                        <p><strong>Fecha de Emisión:</strong> ${formatPrintDate(q.fecha)}</p>
                        <p><strong>Moneda de Operación:</strong> PEN (Soles)</p>
                        <p><strong>Validez de la Oferta:</strong> 15 días calendario</p>
                    </div>
                </div>

                <div class="a4-section-box" style="padding: 0;">
                    <table class="a4-table">
                        <thead>
                            <tr>
                                <th style="text-align: left;">Descripción del Producto / Servicio</th>
                                <th style="width: 80px; text-align: center;">Cant.</th>
                                <th style="width: 120px; text-align: right;">P. Unitario</th>
                                <th style="width: 120px; text-align: right;">Valor Venta</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHTML}
                        </tbody>
                    </table>
                </div>

                <div class="a4-totals-container">
                    <div class="a4-totals-box">
                        <div class="a4-total-row">
                            <span>Subtotal:</span>
                            <span>S/ ${q.total_pen.toFixed(2)}</span>
                        </div>
                        <div class="a4-total-row grand-total">
                            <span>Importe Total:</span>
                            <span>S/ ${q.total_pen.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <div class="a4-terms-section" style="text-align: center; margin-top: 30px;">
                    Representación impresa de Cotización Comercial Zona Mac Peru.<br>
                    ¡Gracias por su preferencia!
        `;
        window.print();
    } catch (e) {
        console.error(e);
        showNotification("Error al previsualizar la cotización.", 'error');
    }
}

function checkServiceWarrantyActive(fechaEntregaStr, garantiaStr) {
    if (!fechaEntregaStr || !garantiaStr) return false;
    if (garantiaStr.toLowerCase().includes('sin') || garantiaStr.toLowerCase().includes('no aplica')) return false;
    
    const match = garantiaStr.match(/(\d+)\s*(mes|meses|dia|dias|días|año|años|ano|anos)/i);
    if (!match) return false;
    
    const num = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    const entregaDate = new Date(fechaEntregaStr);
    if (isNaN(entregaDate.getTime())) return false;
    
    const exp = new Date(entregaDate.getTime());
    if (unit.startsWith('mes')) {
        exp.setMonth(exp.getMonth() + num);
    } else if (unit.startsWith('dia') || unit.startsWith('día')) {
        exp.setDate(exp.getDate() + num);
    } else if (unit.startsWith('año') || unit.startsWith('ano')) {
        exp.setFullYear(exp.getFullYear() + num);
    } else {
        return false;
    }
    
    return exp >= new Date();
}

function checkTransactionWarrantyActive(dateStr, itemsJsonStr) {
    try {
        const items = JSON.parse(itemsJsonStr);
        if (!items || items.length === 0) return false;
        
        const emisionDate = new Date(dateStr);
        if (isNaN(emisionDate.getTime())) return false;
        
        const now = new Date();
        let anyActive = false;
        
        items.forEach(it => {
            const garantiaStr = it.garantia || 'Sin garantía';
            if (garantiaStr.toLowerCase().includes('sin') || garantiaStr.toLowerCase().includes('no aplica')) {
                return;
            }
            const match = garantiaStr.match(/(\d+)\s*(mes|meses|dia|dias|días|año|años|ano|anos)/i);
            if (match) {
                const num = parseInt(match[1]);
                const unit = match[2].toLowerCase();
                const exp = new Date(emisionDate.getTime());
                if (unit.startsWith('mes')) {
                    exp.setMonth(exp.getMonth() + num);
                } else if (unit.startsWith('dia') || unit.startsWith('día')) {
                    exp.setDate(exp.getDate() + num);
                } else if (unit.startsWith('año') || unit.startsWith('ano')) {
                    exp.setFullYear(exp.getFullYear() + num);
                }
                if (exp >= now) {
                    anyActive = true;
                }
            }
        });
        return anyActive;
    } catch(e) {
        return false;
    }
}

// Global variable for purchase creation cart
let modalPurchaseCart = [];

async function renderHistorialComercial() {
    const container = document.getElementById('viewport');
    container.innerHTML = `
        <div class="card">
            <div class="card-title">
                <span>Historial Comercial de Compras y Ventas</span>
                <button class="btn btn-primary" onclick="openRegisterPurchaseModal()"><i class="fa-solid fa-cart-flatbed-suitcases"></i> Registrar Compra (Proveedor)</button>
            </div>
            <div class="pos-search-bar" style="margin-bottom: 20px; display: flex; gap: 12px;">
                <input type="text" id="tx-search" class="form-control" style="flex: 1;" placeholder="Buscar por número de documento o nombre de cliente/proveedor...">
                <select id="tx-type-filter" class="form-control" style="width: 200px;">
                    <option value="">Todos los Movimientos</option>
                    <option value="Venta">Ventas</option>
                    <option value="Compra">Compras</option>
                </select>
            </div>
            <div class="table-responsive">
                <table class="table-main">
                    <thead>
                        <tr>
                            <th>Fecha/Hora</th>
                            <th>Tipo Movimiento</th>
                            <th>Tipo Comprobante</th>
                            <th>Producto</th>
                            <th>Cliente / Proveedor</th>
                            <th>Método Pago</th>
                            <th>Total (PEN)</th>
                            <th>Garantía</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="tx-tbody">
                        <tr><td colspan="9" style="text-align: center;">Cargando historial...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    try {
        const [sales, purchases] = await Promise.all([
            fetchAPI('/api/sales'),
            fetchAPI('/api/compras')
        ]);

        const combined = [];
        sales.forEach(s => {
            combined.push({
                id: s.id,
                fecha: s.fecha,
                tipo_movimiento: 'Venta',
                tipo_documento: s.tipo_documento,
                numero_documento: s.numero_documento,
                contacto_nombre: s.cliente_nombre || 'Público General',
                metodo_pago: s.metodo_pago,
                total_pen: s.total_pen,
                items_json: s.items_json
            });
        });

        purchases.forEach(p => {
            combined.push({
                id: p.id,
                fecha: p.fecha,
                tipo_movimiento: 'Compra',
                tipo_documento: p.tipo_documento,
                numero_documento: p.numero_documento,
                contacto_nombre: p.proveedor_nombre || 'Proveedor Desconocido',
                metodo_pago: p.metodo_pago,
                total_pen: p.total_pen,
                items_json: p.items_json
            });
        });

        combined.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        const tbody = document.getElementById('tx-tbody');

        const renderTable = (list) => {
            if (list.length === 0) {
                tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-secondary);">No se registran movimientos comerciales.</td></tr>`;
                return;
            }

            tbody.innerHTML = list.map(tx => {
                const active = checkTransactionWarrantyActive(tx.fecha, tx.items_json);
                const badgeHTML = active 
                    ? `<span class="badge" style="background-color: rgba(48, 209, 88, 0.15); color: var(--success-color); font-weight: 700; font-size:10px;">EN GARANTÍA</span>`
                    : `<span class="badge" style="background-color: rgba(255, 69, 58, 0.15); color: var(--danger-color); font-weight: 700; font-size:10px;">[ GARANTÍA EXPIRADA ]</span>`;
                
                const isVenta = tx.tipo_movimiento === 'Venta';
                const printAction = isVenta 
                    ? `printThermalTicket(${tx.id})`
                    : `printPurchaseA4(${tx.id})`;

                let productNames = 'Varios / Servicio';
                try {
                    const items = typeof tx.items_json === 'string' ? JSON.parse(tx.items_json) : tx.items_json;
                    if (Array.isArray(items) && items.length > 0) {
                        productNames = items.map(item => item.nombre || item.descripcion || 'Producto').join(', ');
                    }
                } catch (e) {
                    productNames = 'Varios / Servicio';
                }

                return `
                    <tr>
                        <td>${tx.fecha.replace('T', ' ').substring(0, 16)}</td>
                        <td>
                            <span class="badge ${isVenta ? 'badge-activo' : 'badge-diagnostico'}" style="font-size:10px;">
                                ${tx.tipo_movimiento.toUpperCase()}
                            </span>
                        </td>
                        <td>${tx.tipo_documento}</td>
                        <td>
                            <div style="font-weight: 600; color: var(--text-primary); max-width: 300px; word-break: break-word;">${productNames}</div>
                            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">
                                ${tx.tipo_documento} ${tx.numero_documento || ''}
                            </div>
                        </td>
                        <td>${tx.contacto_nombre}</td>
                        <td>${tx.metodo_pago}</td>
                        <td><strong>S/ ${tx.total_pen.toFixed(2)}</strong></td>
                        <td>${badgeHTML}</td>
                        <td>
                            <button class="btn btn-secondary btn-xs" onclick="${printAction}" title="Previsualizar Comprobante A4">
                                <i class="fa-solid fa-print"></i> Reimprimir A4
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        };

        renderTable(combined);

        const searchInput = document.getElementById('tx-search');
        const typeFilter = document.getElementById('tx-type-filter');

        const filterTxs = () => {
            const query = searchInput.value.toLowerCase();
            const type = typeFilter.value;

            const filtered = combined.filter(tx => {
                const numDoc = tx.numero_documento ? tx.numero_documento.toLowerCase() : '';
                const contact = tx.contacto_nombre ? tx.contacto_nombre.toLowerCase() : '';
                let itemsStr = '';
                try {
                    const items = typeof tx.items_json === 'string' ? JSON.parse(tx.items_json) : tx.items_json;
                    if (Array.isArray(items)) {
                        itemsStr = items.map(item => (item.nombre || item.descripcion || '')).join(' ').toLowerCase();
                    }
                } catch(e) {}

                const matchesSearch = numDoc.includes(query) || 
                                     contact.includes(query) ||
                                     itemsStr.includes(query);
                const matchesType = type === "" || tx.tipo_movimiento === type;
                return matchesSearch && matchesType;
            });
            renderTable(filtered);
        };

        searchInput.addEventListener('input', filterTxs);
        typeFilter.addEventListener('change', filterTxs);

    } catch (e) {
        console.error(e);
        document.getElementById('tx-tbody').innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--danger-color);">Error al cargar los movimientos comerciales.</td></tr>`;
    }
}

async function openRegisterPurchaseModal() {
    try {
        const [contacts, products] = await Promise.all([
            fetchAPI('/api/contacts'),
            fetchAPI('/api/products')
        ]);

        window.currentPurchaseProducts = products;

        const providers = contacts.filter(c => c.tipo_contacto === 'Proveedor' || c.tipo_contacto === 'Ambos');
        const providersHTML = providers.map(p => `<option value="${p.id}">${p.nombre} (${p.numero_documento})</option>`).join('');
        const productsHTML = products.map(p => `<option value="${p.id}">${p.nombre} - [Stock: ${p.stock_actual}]</option>`).join('');

        modalPurchaseCart = [];

        const html = `
            <form id="register-purchase-form" onsubmit="submitRegisterPurchase(event)">
                <div class="form-row">
                    <div class="form-group">
                        <label>Proveedor *</label>
                        <select id="pur-proveedor" class="form-control" required>
                            <option value="">Seleccione Proveedor</option>
                            ${providersHTML}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Tipo Comprobante *</label>
                        <select id="pur-tipo-doc" class="form-control" required>
                            <option value="Nota de Venta">Nota de Venta</option>
                            <option value="Factura">Factura</option>
                            <option value="Boleta">Boleta</option>
                        </select>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Nº Comprobante (Opcional)</label>
                        <input type="text" id="pur-numero-doc" class="form-control" placeholder="Ej. F001-0002131">
                    </div>
                    <div class="form-group">
                        <label>Método de Pago *</label>
                        <select id="pur-metodo-pago" class="form-control" required>
                            <option value="Efectivo">Efectivo</option>
                            <option value="Transferencia">Transferencia</option>
                            <option value="Crédito">Crédito</option>
                        </select>
                    </div>
                </div>

                <div style="border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-top: 15px; background-color: var(--bg-card);">
                    <h5 style="margin-bottom: 8px;"><i class="fa-solid fa-plus"></i> Agregar Producto a la Compra</h5>
                    <div class="form-group">
                        <label>Seleccionar Producto</label>
                        <select id="pur-item-select" class="form-control">
                            <option value="">Seleccione Producto</option>
                            ${productsHTML}
                        </select>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Cantidad</label>
                            <input type="number" id="pur-item-qty" class="form-control" value="1" min="1">
                        </div>
                        <div class="form-group">
                            <label>Costo Unitario (PEN)</label>
                            <input type="number" step="0.01" id="pur-item-cost-pen" class="form-control" value="0.00">
                        </div>
                        <div class="form-group">
                            <label>Garantía de Compra</label>
                            <input type="text" id="pur-item-warranty" class="form-control" value="12 meses" placeholder="Ej. 12 meses, Sin garantía">
                        </div>
                    </div>
                    <div id="pur-item-series-container" style="display: none; margin-top: 10px;">
                        <label style="color: var(--accent-color); font-weight: 600;">Números de Serie / IMEI (Ingrese un número por línea o separados por comas) *</label>
                        <textarea id="pur-item-series" class="form-control" rows="2" placeholder="Ej. SN1029, SN1030"></textarea>
                    </div>
                    <button type="button" class="btn btn-secondary btn-xs" onclick="addPurchaseItemToModalCart()" style="margin-top: 12px; width: 100%;">
                        <i class="fa-solid fa-circle-plus"></i> Agregar al Detalle
                    </button>
                </div>

                <div style="margin-top: 15px;">
                    <h5>Detalle de la Compra</h5>
                    <div class="table-responsive" style="max-height: 150px; overflow-y: auto;">
                        <table class="table-main" style="font-size: 12px;">
                            <thead>
                                <tr>
                                    <th>Producto</th>
                                    <th>Cant.</th>
                                    <th>Costo (S/)</th>
                                    <th>Garantía</th>
                                    <th>Total</th>
                                    <th>Acción</th>
                                </tr>
                            </thead>
                            <tbody id="pur-modal-tbody">
                                <tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">No se han agregado productos.</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px; font-weight: bold;">
                    <span>TOTAL COMPRA:</span>
                    <span id="pur-modal-total-text" style="font-size: 16px; color: var(--accent-color);">S/ 0.00</span>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px;">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
                    <button type="submit" class="btn btn-primary">Registrar Compra</button>
                </div>
            </form>
        `;
        showModal("Registrar Compra (Ingreso de Mercadería)", html);

        const selectEl = document.getElementById('pur-item-select');
        selectEl.addEventListener('change', () => {
            const prodId = parseInt(selectEl.value);
            const p = window.currentPurchaseProducts.find(x => x.id === prodId);
            const seriesContainer = document.getElementById('pur-item-series-container');
            if (p && p.requiere_serie === 1) {
                seriesContainer.style.display = 'block';
            } else {
                seriesContainer.style.display = 'none';
                document.getElementById('pur-item-series').value = '';
            }
        });
    } catch (e) {
        console.error(e);
        showNotification("Error al abrir modal de compras.", 'error');
    }
}

function updateModalPurchaseCartUI() {
    const tbody = document.getElementById('pur-modal-tbody');
    const totalText = document.getElementById('pur-modal-total-text');
    
    if (modalPurchaseCart.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">No se han agregado productos.</td></tr>`;
        totalText.innerText = "S/ 0.00";
        return;
    }

    let total = 0.0;
    tbody.innerHTML = modalPurchaseCart.map((item, index) => {
        const itemTotal = item.costo_pen * item.cantidad;
        total += itemTotal;
        return `
            <tr>
                <td>${item.nombre}</td>
                <td>${item.cantidad} U.</td>
                <td>S/ ${item.costo_pen.toFixed(2)}</td>
                <td>${item.garantia}</td>
                <td><strong>S/ ${itemTotal.toFixed(2)}</strong></td>
                <td><button type="button" class="btn btn-danger btn-xs" onclick="removePurchaseItemFromModalCart(${index})">&times;</button></td>
            </tr>
        `;
    }).join('');

    totalText.innerText = `S/ ${total.toFixed(2)}`;
}

function addPurchaseItemToModalCart() {
    const select = document.getElementById('pur-item-select');
    const prodId = parseInt(select.value);
    if (!prodId) {
        showNotification("Debe seleccionar un producto", 'warning');
        return;
    }
    const productName = select.options[select.selectedIndex].text.split(' - ')[0];
    const qty = parseInt(document.getElementById('pur-item-qty').value) || 1;
    const costPen = parseFloat(document.getElementById('pur-item-cost-pen').value) || 0.0;
    const warranty = document.getElementById('pur-item-warranty').value || "Sin garantía";

    // Validar números de serie
    const p = window.currentPurchaseProducts.find(x => x.id === prodId);
    let seriesList = [];
    if (p && p.requiere_serie === 1) {
        const seriesText = document.getElementById('pur-item-series').value.trim();
        seriesList = seriesText.split(/[\n,]+/).map(s => s.trim()).filter(s => s);
        if (seriesList.length !== qty) {
            showNotification(`Este producto requiere exactamente ${qty} número(s) de serie (ingresado: ${seriesList.length})`, 'warning');
            return;
        }
    }

    modalPurchaseCart.push({
        producto_id: prodId,
        nombre: productName,
        cantidad: qty,
        costo_pen: costPen,
        garantia: warranty,
        series: seriesList
    });

    updateModalPurchaseCartUI();
    
    document.getElementById('pur-item-qty').value = "1";
    document.getElementById('pur-item-cost-pen').value = "0.00";
    select.value = "";
    document.getElementById('pur-item-series-container').style.display = 'none';
    document.getElementById('pur-item-series').value = '';
}

function removePurchaseItemFromModalCart(index) {
    modalPurchaseCart.splice(index, 1);
    updateModalPurchaseCartUI();
}

async function submitRegisterPurchase(event) {
    event.preventDefault();
    if (modalPurchaseCart.length === 0) {
        showNotification("Debe agregar al menos un producto a la compra", 'error');
        return;
    }

    const providerId = parseInt(document.getElementById('pur-proveedor').value);
    const tipoDoc = document.getElementById('pur-tipo-doc').value;
    const numDoc = document.getElementById('pur-numero-doc').value;
    const payMethod = document.getElementById('pur-metodo-pago').value;

    const payload = {
        proveedor_id: providerId,
        tipo_documento: tipoDoc,
        numero_documento: numDoc || null,
        metodo_pago: payMethod,
        items: modalPurchaseCart.map(item => ({
            producto_id: item.producto_id,
            cantidad: item.cantidad,
            precio_unitario_pen: item.costo_pen,
            precio_unitario_usd: item.costo_pen / (appState.exchangeRate || 3.75),
            garantia: item.garantia,
            series: item.series || []
        }))
    };

    try {
        const res = await fetchAPI('/api/compras/create', {
            method: 'POST',
            body: payload
        });

        if (res.success) {
            showNotification(res.message, 'success');
            closeModal();
            renderHistorialComercial();
        } else {
            showNotification(res.error, 'error');
        }
    } catch (e) {
        console.error(e);
        showNotification("Error de red al registrar la compra.", 'error');
    }
}

async function printPurchaseA4(purchaseId) {
    try {
        const purchases = await fetchAPI('/api/compras');
        const p = purchases.find(x => x.id === purchaseId);
        if (!p) return;

        const items = JSON.parse(p.items_json);
        const isFactura = p.tipo_documento === 'Factura';
        const logoPath = 'logo.jpg';
        
        const contacts = await fetchAPI('/api/contacts');
        const provider = contacts.find(c => c.id === p.contacto_id) || {};

        const formatPrintDate = (isoStr) => {
            if (!isoStr) return 'No registra';
            try {
                const d = new Date(isoStr);
                if (isNaN(d.getTime())) return isoStr;
                const pad = (n) => String(n).padStart(2, '0');
                const day = pad(d.getDate());
                const month = pad(d.getMonth() + 1);
                const year = d.getFullYear();
                let hours = d.getHours();
                const minutes = pad(d.getMinutes());
                const ampm = hours >= 12 ? 'p. m.' : 'a. m.';
                hours = hours % 12;
                hours = hours ? hours : 12;
                return `${day}/${month}/${year}, ${pad(hours)}:${minutes} ${ampm}`;
            } catch(e) {
                return isoStr;
            }
        };

        const printArea = document.getElementById('print-area');
        
        const rowsHTML = items.map(it => `
            <tr>
                <td>
                    <strong>${it.nombre}</strong><br>
                    <small style="color: #666666;">Garantía Proveedor: ${it.garantia || 'Sin garantía'}</small>
                </td>
                <td style="text-align: center;">${it.cantidad} U.</td>
                <td style="text-align: right;">S/ ${it.precio_unitario_pen.toFixed(2)}</td>
                <td style="text-align: right;">S/ ${it.total_pen.toFixed(2)}</td>
            </tr>
        `).join('');

        let subtotalStr = `S/ ${p.total_pen.toFixed(2)}`;
        let igvRowHTML = '';
        if (isFactura) {
            const subtotalVal = p.total_pen / 1.18;
            const igvVal = p.total_pen - subtotalVal;
            subtotalStr = `S/ ${subtotalVal.toFixed(2)}`;
            igvRowHTML = `
                <div class="a4-total-row">
                    <span>IGV (18%):</span>
                    <span>S/ ${igvVal.toFixed(2)}</span>
                </div>
            `;
        }

        printArea.innerHTML = `
            <div class="a4-container">
                <div class="a4-header">
                    <div class="a4-company-info">
                        <img src="${logoPath}" class="a4-logo" alt="Logo Zona Mac Peru">
                        <div class="a4-company-details">
                            <h2>Zona Mac Peru</h2>
                            <p>RUC: 10446507309</p>
                            <p>Dirección: Av. Petit Thouars 5356 Miraflores, Lima</p>
                            <p>Teléfono: +51 941 995 237</p>
                        </div>
                    </div>
                    <div class="a4-comprobante-box">
                        <h3>RUC: 10446507309</h3>
                        <div class="doc-type">COMPROBANTE DE COMPRA</div>
                        <div class="doc-number">${p.numero_documento}</div>
                    </div>
                </div>

                <div class="a4-metadata-section">
                    <div class="a4-metadata-col">
                        <h4>Datos del Proveedor</h4>
                        <p><strong>Razón Social:</strong> ${provider.nombre || 'Proveedor Genérico'}</p>
                        <p><strong>RUC/DNI:</strong> ${provider.numero_documento || 'No registrado'}</p>
                        <p><strong>Teléfono:</strong> ${provider.telefono || 'No registrado'}</p>
                    </div>
                    <div class="a4-metadata-col">
                        <h4>Información del Documento</h4>
                        <p><strong>Fecha Registro:</strong> ${formatPrintDate(p.fecha)}</p>
                        <p><strong>Moneda de Operación:</strong> PEN (Soles)</p>
                        <p><strong>Condición de Pago:</strong> ${p.metodo_pago}</p>
                    </div>
                </div>

                <div class="a4-section-box" style="padding: 0;">
                    <table class="a4-table">
                        <thead>
                            <tr>
                                <th style="text-align: left;">Descripción del Producto / Garantía</th>
                                <th style="width: 80px; text-align: center;">Cant.</th>
                                <th style="width: 120px; text-align: right;">Costo Unitario</th>
                                <th style="width: 120px; text-align: right;">Total Item</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHTML}
                        </tbody>
                    </table>
                </div>

                <div class="a4-totals-container">
                    <div class="a4-totals-box">
                        <div class="a4-total-row">
                            <span>Subtotal:</span>
                            <span>${subtotalStr}</span>
                        </div>
                        ${igvRowHTML}
                        <div class="a4-total-row grand-total">
                            <span>Monto Total:</span>
                            <span>S/ ${p.total_pen.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <div class="a4-terms-section" style="text-align: center; margin-top: 30px;">
                    Representación impresa de registro de compra de Zona Mac Peru.<br>
                    ¡Documento interno para control comercial!
                </div>
            </div>
        `;
        window.print();
    } catch (e) {
        console.error(e);
        showNotification("Error al previsualizar la compra.", 'error');
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    await fetchExchangeRateAndConfig();
    window.addEventListener('hashchange', handleRouting);
    handleRouting();
});
