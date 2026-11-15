import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  HeartPulse,
  Wallet,
  ArrowRight,
  UsersRound,
  Activity,
  CalendarCheck2,
  CalendarDays,
  CalendarRange,
  PackageCheck,
  UserPlus,
  Sparkles,
} from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { usePacientesStore } from '@/stores/usePacientesStore'
import { getAtendimentosHoje } from '@/lib/api'
import { getGoogleAuthStatus, type GoogleAuthStatus } from '@/lib/fechamentoApi'

export function Hub() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { pacientes, fetchPacientes, isLoading } = usePacientesStore()
  const [atendimentosHoje, setAtendimentosHoje] = useState<number>(0)
  const [googleStatus, setGoogleStatus] = useState<GoogleAuthStatus | null>(null)

  useEffect(() => {
    fetchPacientes()
    getAtendimentosHoje()
      .then(setAtendimentosHoje)
      .catch(() => setAtendimentosHoje(0))
    getGoogleAuthStatus()
      .then(setGoogleStatus)
      .catch(() => setGoogleStatus({ authenticated: false, googleConnected: false }))
  }, [fetchPacientes])

  const agora = new Date()
  const saudacao =
    agora.getHours() < 12 ? 'Bom dia' : agora.getHours() < 18 ? 'Boa tarde' : 'Boa noite'
  const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Doutor(a)'

  const dataFormatada = agora.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Cabeçalho Limpo e Confortável */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary-600 mb-1.5">
            Painel Principal
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary tracking-tight">
            {saudacao}, Dr(a). {userName}
          </h1>
        </div>

        <div className="inline-flex items-center gap-2.5 self-start sm:self-auto bg-white border border-brand-border rounded-2xl px-4 py-2.5 shadow-xs">
          <CalendarDays size={17} className="text-secondary-600" />
          <span className="text-xs font-semibold text-brand-body capitalize">
            {dataFormatada}
          </span>
        </div>
      </header>

      {/* Indicadores Rápidos (Espaçamento amplo e leitura rápida) */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div
          onClick={() => navigate('/pacientes')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/pacientes')}
          className="bg-white rounded-3xl p-6 border border-brand-border shadow-card hover:shadow-card-hover transition-all cursor-pointer flex items-center gap-5"
        >
          <div className="w-14 h-14 rounded-2xl bg-primary-50 text-primary flex items-center justify-center flex-shrink-0">
            <UsersRound size={24} strokeWidth={1.9} />
          </div>
          <div>
            <p className="text-xs font-medium text-brand-muted">Pacientes Ativos</p>
            <p className="text-3xl font-bold text-primary tracking-tight mt-0.5">
              {isLoading ? '—' : pacientes.length}
            </p>
          </div>
        </div>

        <div
          onClick={() => navigate('/acompanhamento')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/acompanhamento')}
          className="bg-white rounded-3xl p-6 border border-brand-border shadow-card hover:shadow-card-hover transition-all cursor-pointer flex items-center gap-5"
        >
          <div className="w-14 h-14 rounded-2xl bg-secondary-50 text-secondary-700 flex items-center justify-center flex-shrink-0">
            <Activity size={24} strokeWidth={1.9} />
          </div>
          <div>
            <p className="text-xs font-medium text-brand-muted">Sessões Hoje</p>
            <p className="text-3xl font-bold text-primary tracking-tight mt-0.5">
              {atendimentosHoje}
            </p>
          </div>
        </div>

        <div
          onClick={() => navigate('/fechamento')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/fechamento')}
          className="bg-white rounded-3xl p-6 border border-brand-border shadow-card hover:shadow-card-hover transition-all cursor-pointer flex items-center gap-5"
        >
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${
              googleStatus?.googleConnected
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-amber-50 text-amber-600'
            }`}
          >
            <CalendarCheck2 size={24} strokeWidth={1.9} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-brand-muted">Google Agenda</p>
            <p className="text-base font-bold text-primary truncate mt-1">
              {googleStatus?.googleConnected ? 'Sincronizado' : 'Conectar conta'}
            </p>
          </div>
        </div>
      </section>

      {/* Módulos Principais */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-brand-muted">
          Módulos do Sistema
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Card 1: Acompanhamento Clínico */}
          <div
            onClick={() => navigate('/acompanhamento')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && navigate('/acompanhamento')}
            className="group bg-white rounded-3xl p-7 sm:p-8 border border-brand-border shadow-card hover:shadow-card-hover hover:border-secondary-300 transition-all duration-200 cursor-pointer flex flex-col justify-between gap-8"
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <HeartPulse size={26} strokeWidth={1.9} />
                </div>
                <span className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-primary-50 text-primary">
                  Clínico
                </span>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-primary tracking-tight">
                  Acompanhar Paciente
                </h3>
                <p className="text-sm text-brand-muted mt-2 leading-relaxed">
                  Prontuários, avaliações iniciais e evoluções diárias.
                </p>
              </div>
            </div>

            <div className="pt-6 border-t border-brand-border flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate('/novo-paciente')
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-cream hover:bg-secondary-100 text-primary text-xs font-semibold transition-colors"
                >
                  <UserPlus size={15} />
                  Novo Paciente
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate('/pacientes')
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-cream hover:bg-secondary-100 text-primary text-xs font-semibold transition-colors"
                >
                  <UsersRound size={15} />
                  Pacientes
                </button>
              </div>

              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary group-hover:text-secondary-600 transition-colors">
                Acessar
                <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </div>

          {/* Card 2: Fechamento Mensal */}
          <div
            onClick={() => navigate('/fechamento')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && navigate('/fechamento')}
            className="group bg-white rounded-3xl p-7 sm:p-8 border border-brand-border shadow-card hover:shadow-card-hover hover:border-secondary-300 transition-all duration-200 cursor-pointer flex flex-col justify-between gap-8"
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div className="w-14 h-14 rounded-2xl bg-secondary-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <Wallet size={26} strokeWidth={1.9} />
                </div>
                <span className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-secondary-50 text-secondary-700">
                  Financeiro
                </span>
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-primary tracking-tight">
                  Fazer Fechamento
                </h3>
                <p className="text-sm text-brand-muted mt-2 leading-relaxed">
                  Importação do Google Agenda, valores por sessão e planilha no Sheets.
                </p>
              </div>
            </div>

            <div className="pt-6 border-t border-brand-border flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-brand-muted truncate">
                {googleStatus?.googleConnected && googleStatus.email
                  ? googleStatus.email
                  : 'Sincronização com Google Calendar'}
              </span>

              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary-700 group-hover:text-primary transition-colors flex-shrink-0">
                Acessar
                <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Em Breve (Visual limpo e discreto) */}
      <section className="space-y-4 pt-2">
        <div className="flex items-center gap-2 text-brand-muted">
          <Sparkles size={15} className="text-secondary-600" />
          <h2 className="text-xs font-semibold uppercase tracking-widest">
            Em Breve
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="rounded-3xl border border-dashed border-brand-border bg-white/60 p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-cream text-brand-muted flex items-center justify-center flex-shrink-0">
              <CalendarRange size={22} strokeWidth={1.8} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-primary">Agenda Semanal</h3>
              <p className="text-xs text-brand-muted mt-0.5">
                Visualização rápida dos horários da semana.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-dashed border-brand-border bg-white/60 p-6 flex items-center justify-center sm:justify-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-cream text-brand-muted flex items-center justify-center flex-shrink-0">
              <PackageCheck size={22} strokeWidth={1.8} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-primary">Controle de Pacotes</h3>
              <p className="text-xs text-brand-muted mt-0.5">
                Saldo de sessões contratadas e realizadas.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
