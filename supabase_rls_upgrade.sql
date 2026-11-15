-- ============================================================================
-- Go Administrativo — Recomendação de Segurança RLS para o schema `public`
-- ============================================================================
-- O projeto Avaliacao-Go originalmente usava políticas permissivas (`USING (true)`).
-- Como ambos os projetos agora convivem no Go-Administrativo com Supabase Auth,
-- execute este script no SQL Editor do Supabase para exigir usuário autenticado
-- nas tabelas clínicas (sem alterar dados nem tabelas existentes).
-- ============================================================================

-- 1. Pacientes
DROP POLICY IF EXISTS "Permitir tudo para pacientes" ON public.pacientes;
CREATE POLICY "authenticated_all_pacientes"
  ON public.pacientes
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- 2. Avaliações Iniciais
DROP POLICY IF EXISTS "Permitir tudo para avaliacoes" ON public.avaliacoes_iniciais;
CREATE POLICY "authenticated_all_avaliacoes"
  ON public.avaliacoes_iniciais
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- 3. Evoluções
DROP POLICY IF EXISTS "Permitir tudo para evolucoes" ON public.evolucoes;
CREATE POLICY "authenticated_all_evolucoes"
  ON public.evolucoes
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- 4. Movimentos e Testes
DROP POLICY IF EXISTS "Permitir tudo para movimentos_testes" ON public.movimentos_testes;
CREATE POLICY "authenticated_all_movimentos_testes"
  ON public.movimentos_testes
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

