-- ============================================================================
-- SCRIPT SQL PARA O SUPABASE (SQL Editor) - CONTROLE DE PACOTES (go_fechamento)
-- ============================================================================
-- Execute este script no SQL Editor do Supabase (projeto de Produção).
-- Ele cria as tabelas necessárias dentro do schema `go_fechamento` com
-- vínculo para `public.pacientes(id)`, índices e políticas RLS.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS go_fechamento;

-- 1. Vínculo 1 para N: Paciente Único (public.pacientes) <-> Nomes na Agenda
CREATE TABLE IF NOT EXISTS go_fechamento.patient_calendar_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
    calendar_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_patient_calendar_links_name UNIQUE (calendar_name)
);

CREATE INDEX IF NOT EXISTS idx_patient_calendar_links_paciente
    ON go_fechamento.patient_calendar_links (paciente_id);

-- 2. Pacotes de Atendimento (paciente_id pode ser NULL ao desvincular o paciente único)
-- Se você já criou esta tabela anteriormente com NOT NULL, execute no SQL Editor:
--   ALTER TABLE go_fechamento.packages ALTER COLUMN paciente_id DROP NOT NULL;
CREATE TABLE IF NOT EXISTS go_fechamento.packages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    paciente_id UUID NULL REFERENCES public.pacientes(id) ON DELETE SET NULL,
    package_type TEXT NOT NULL CHECK (package_type IN ('5', '10', 'individual', 'personalizado')),
    label TEXT,
    total_sessions INTEGER NOT NULL CHECK (total_sessions > 0),
    session_price DOUBLE PRECISION NOT NULL DEFAULT 0,
    start_date DATE NULL,
    initial_offset INTEGER NOT NULL DEFAULT 0 CHECK (initial_offset >= 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    is_paid BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_packages_paciente
    ON go_fechamento.packages (paciente_id, start_date);

-- 3. Sessões Vinculadas a um Pacote
CREATE TABLE IF NOT EXISTS go_fechamento.package_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    package_id UUID NOT NULL REFERENCES go_fechamento.packages(id) ON DELETE CASCADE,
    calendar_event_id TEXT NOT NULL,
    event_date DATE NOT NULL,
    event_datetime TIMESTAMPTZ,
    calendar_summary TEXT NOT NULL,
    calendar_name TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_package_sessions_event UNIQUE (calendar_event_id)
);

CREATE INDEX IF NOT EXISTS idx_package_sessions_package
    ON go_fechamento.package_sessions (package_id, event_date);

-- 4. Sessões Removidas/Pendentes ou Desconsideradas (evita re-vinculação automática indesejada)
CREATE TABLE IF NOT EXISTS go_fechamento.package_session_exclusions (
    calendar_event_id TEXT PRIMARY KEY,
    paciente_id UUID REFERENCES public.pacientes(id) ON DELETE SET NULL,
    event_date DATE,
    calendar_summary TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ignored')),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_package_session_exclusions_paciente
    ON go_fechamento.package_session_exclusions (paciente_id);

-- 5. Habilitar RLS em todas as novas tabelas
ALTER TABLE go_fechamento.patient_calendar_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE go_fechamento.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE go_fechamento.package_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE go_fechamento.package_session_exclusions ENABLE ROW LEVEL SECURITY;

-- 6. Permissões de schema e tabelas
GRANT USAGE ON SCHEMA go_fechamento TO authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA go_fechamento TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA go_fechamento TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA go_fechamento TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA go_fechamento TO authenticated;

-- 7. Políticas RLS para usuários autenticados
DROP POLICY IF EXISTS "authenticated_all_calendar_links" ON go_fechamento.patient_calendar_links;
CREATE POLICY "authenticated_all_calendar_links"
    ON go_fechamento.patient_calendar_links
    FOR ALL
    TO authenticated
    USING ((SELECT auth.uid()) IS NOT NULL)
    WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "authenticated_all_packages" ON go_fechamento.packages;
CREATE POLICY "authenticated_all_packages"
    ON go_fechamento.packages
    FOR ALL
    TO authenticated
    USING ((SELECT auth.uid()) IS NOT NULL)
    WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "authenticated_all_package_sessions" ON go_fechamento.package_sessions;
CREATE POLICY "authenticated_all_package_sessions"
    ON go_fechamento.package_sessions
    FOR ALL
    TO authenticated
    USING ((SELECT auth.uid()) IS NOT NULL)
    WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "authenticated_all_package_exclusions" ON go_fechamento.package_session_exclusions;
CREATE POLICY "authenticated_all_package_exclusions"
    ON go_fechamento.package_session_exclusions
    FOR ALL
    TO authenticated
    USING ((SELECT auth.uid()) IS NOT NULL)
    WITH CHECK ((SELECT auth.uid()) IS NOT NULL);
