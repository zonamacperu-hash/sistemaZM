-- Script de migración SQL para crear la tabla reportes_financieros en Cloudflare D1
-- Database: sistemazm-db (sistemazm_db)

CREATE TABLE IF NOT EXISTS reportes_financieros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL,                  -- 'Semanal', 'Mensual', 'Anual', 'Manual'
    rango_fechas TEXT NOT NULL,          -- Rango formateado para el usuario (ej. '2026-06-01 al 2026-06-25')
    fecha_inicio TEXT NOT NULL,          -- Utilizado para indexado y ordenamiento de consultas (YYYY-MM-DD)
    fecha_fin TEXT NOT NULL,             -- Utilizado para indexado y ordenamiento de consultas (YYYY-MM-DD)
    ingresos REAL DEFAULT 0.0,           -- Total de ingresos del periodo (Soles - PEN)
    ingresos_usd REAL DEFAULT 0.0,       -- Total de ingresos del periodo (Dólares - USD)
    egresos REAL DEFAULT 0.0,            -- Total de egresos del periodo (Soles - PEN)
    egresos_usd REAL DEFAULT 0.0,        -- Total de egresos del periodo (Dólares - USD)
    ganancia_neta REAL DEFAULT 0.0,      -- Margen de ganancia neta (Soles - PEN)
    ganancia_neta_usd REAL DEFAULT 0.0,  -- Margen de ganancia neta (Dólares - USD)
    creado_en TEXT NOT NULL              -- Timestamp de generación (YYYY-MM-DD HH:MM:SS)
);
