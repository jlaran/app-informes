-- ===========================================================================
-- Row-Level Security (RLS) para el plano de TENANT.
--
-- Prisma no modela políticas RLS, así que se aplican con esta migración SQL
-- manual DESPUÉS de la migración inicial de tablas:
--
--   psql "$DATABASE_URL" -f prisma/rls.sql
--
-- (o incorporándola como una `prisma migrate` SQL editada a mano).
--
-- Contrato: la API fija por transacción/sesión:
--     SET LOCAL app.current_tenant = '<uuid-del-tenant>';
-- y todas las tablas de tenant filtran por ese valor. El rol de aplicación
-- (informes_app) NO debe tener BYPASSRLS.
-- ===========================================================================

-- Helper: tenant actual de la sesión (NULL si no está fijado).
CREATE OR REPLACE FUNCTION app_current_tenant() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_tenant', true), '')::uuid
$$;

-- Aplica RLS a una tabla que tenga columna tenant_id.
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'tenants', 'users', 'alerts', 'alert_matches', 'saved_notices'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

-- La tabla `tenants` usa su propia columna id como llave de aislamiento.
DROP POLICY IF EXISTS tenant_isolation ON tenants;
CREATE POLICY tenant_isolation ON tenants
  USING (id = app_current_tenant())
  WITH CHECK (id = app_current_tenant());

-- Las demás tablas usan tenant_id.
DROP POLICY IF EXISTS tenant_isolation ON users;
CREATE POLICY tenant_isolation ON users
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

DROP POLICY IF EXISTS tenant_isolation ON alerts;
CREATE POLICY tenant_isolation ON alerts
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

DROP POLICY IF EXISTS tenant_isolation ON alert_matches;
CREATE POLICY tenant_isolation ON alert_matches
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

DROP POLICY IF EXISTS tenant_isolation ON saved_notices;
CREATE POLICY tenant_isolation ON saved_notices
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());

-- ---------------------------------------------------------------------------
-- Índices trigram para búsqueda difusa (nombres / ubicaciones / marcas).
-- Requiere la extensión pg_trgm (declarada en schema.prisma).
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_deceased_fullname_trgm
  ON deceased_persons USING gin (full_name_norm gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_company_name_trgm
  ON dissolved_companies USING gin (company_name_norm gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_property_location_trgm
  ON property_auctions USING gin (location_norm gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_vehicle_brand_trgm
  ON vehicle_auctions USING gin (brand_norm gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Rol de aplicación (ejecutar como superusuario al aprovisionar la BD).
-- La contraseña real proviene de Secrets Manager; aquí es un placeholder.
-- ---------------------------------------------------------------------------
-- CREATE ROLE informes_app LOGIN PASSWORD 'from-secrets-manager' NOBYPASSRLS;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO informes_app;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO informes_app;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public
--   GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO informes_app;
