import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Stethoscope,
  Receipt,
  ArrowRight,
  Users,
  Activity,
  Calendar,
  Package,
  Clock,
  CheckCircle2,
  UserPlus,
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

  return (
    <div className="min-h-full bg-background animate-fade-in">
      {/* Banner Editorial Go Fisioterapia */}
      <section className="bg-gradient-to-br from-primary-800 via-primary to-primary-500 text-white relative overflow-hidden">
        <div className="absolute -top-24 -right-20 w-80 h-80 bg-secondary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-8 md:py-11 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3 md:hidden">
                <div className="w-10 h-10 rounded-xl bg-white p-1.5 shadow-md">
                  <img src="/logo.png" alt="Go Fisioterapia" className="w-full h-full object-contain" />
                </div>
                <span className="text-[11px] font-medium tracking-[0.2em] uppercase text-secondary-300">
                  Go Administrativo
                </span>
              </div>

              <p className="hidden md:inline-flex items-center gap-3 text-xs font-medium tracking-[0.2em] uppercase text-secondary-300 mb-2">
                <span className="w-8 h-px bg-secondary-300/70" />
                Portal de Gestão Integrada
              </p>

              <h1 className="font-editorial text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight leading-tight">
                {saudacao}, <em className="italic text-secondary-300">Dr(a). {userName}</em>
              </h1>
              <p className="text-primary-100/85 text-sm sm:text-base mt-2 max-w-xl">
                Escolha abaixo se deseja acompanhar a evolução clínica dos seus pacientes ou realizar o fechamento mensal dos atendimentos.
              </p>
            </div>

            {/* Resumo rápido */}
            <div className="grid grid-cols-2 gap-3 sm:min-w-[280px]">
              <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3.5">
                <div className="flex items-center gap-1.5 text-secondary-300 text-xs font-medium mb-1">
                  <Users size={14} />
                  <span>Pacientes Ativos</span>
                </div>
                <p className="text-2xl font-semibold">
                  {isLoading ? '—' : pacientes.length}
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-3.5">
                <div className="flex items-center gap-1.5 text-secondary-300 text-xs font-medium mb-1">
                  <Activity size={14} />
                  <span>Sessões Hoje</span>
                </div>
                <p className="text-2xl font-semibold">{atendimentosHoje}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Conteúdo Principal: Escolha de Módulo */}
      <div className="max-w-6xl mx-auto px-5 sm:px-6 -mt-5 relative z-20 space-y-8 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card 1: Acompanhamento de Pacientes */}
          <div
            onClick={() => navigate('/acompanhamento')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && navigate('/acompanhamento')}
            className="group card-hover p-6 sm:p-7 flex flex-col justify-between bg-white relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-36 h-36 bg-secondary-50 rounded-bl-[4rem] -mr-4 -mt-4 transition-transform duration-300 group-hover:scale-105" />

            <div className="relative z-10">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center shadow-sm group-hover:bg-primary-800 transition-colors">
                  <Stethoscope size={26} strokeWidth={1.8} />
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-secondary-50 text-secondary-700 border border-secondary-200">
                  Clínico · Prontuário
                </span>
              </div>

              <h2 className="font-editorial text-2xl sm:text-3xl font-semibold text-primary mb-2">
                Acompanhar Paciente
              </h2>
              <p className="text-sm text-brand-body leading-relaxed">
                Acesse prontuários, registre avaliações iniciais, conduza evoluções pelo método Teste &amp; Reteste e exporte relatórios em PDF.
              </p>
            </div>

            <div className="relative z-10 mt-6 pt-5 border-t border-brand-border flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate('/novo-paciente')
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-cream hover:bg-secondary-100 text-primary text-xs font-medium transition-colors"
                >
                  <UserPlus size={14} />
                  Novo Paciente
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate('/pacientes')
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-cream hover:bg-secondary-100 text-primary text-xs font-medium transition-colors"
                >
                  <Users size={14} />
                  Lista
                </button>
              </div>

              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary group-hover:text-secondary-600 transition-colors">
                Abrir módulo
                <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </div>

          {/* Card 2: Fechamento de Atendimentos */}
          <div
            onClick={() => navigate('/fechamento')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && navigate('/fechamento')}
            className="group card-hover p-6 sm:p-7 flex flex-col justify-between bg-white relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-36 h-36 bg-primary-50 rounded-bl-[4rem] -mr-4 -mt-4 transition-transform duration-300 group-hover:scale-105" />

            <div className="relative z-10">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div className="w-14 h-14 rounded-2xl bg-secondary-600 text-white flex items-center justify-center shadow-sm group-hover:bg-secondary-700 transition-colors">
                  <Receipt size={26} strokeWidth={1.8} />
                </div>

                {googleStatus?.googleConnected ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 size={13} />
                    Google Agenda conectado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary-50 text-primary border border-primary-100">
                    <Calendar size={13} />
                    Financeiro · Calendar
                  </span>
                )}
              </div>

              <h2 className="font-editorial text-2xl sm:text-3xl font-semibold text-primary mb-2">
                Fazer Fechamento
              </h2>
              <p className="text-sm text-brand-body leading-relaxed">
                Importe os atendimentos do Google Calendar por mês, configure valores por paciente, agrupe nomes, controle pagamentos e gere a planilha no Google Sheets.
              </p>
            </div>

            <div className="relative z-10 mt-6 pt-5 border-t border-brand-border flex items-center justify-between gap-3">
              <span className="text-xs text-brand-muted">
                {googleStatus?.googleConnected && googleStatus.email
                  ? `Agenda: ${googleStatus.email}`
                  : 'Conecta com Google Calendar dentro do módulo'}
              </span>

              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary-700 group-hover:text-primary transition-colors">
                Abrir módulo
                <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </div>
        </div>

        {/* Seção de Evolução Futura (Discreta e informativa) */}
        <section className="animate-slide-up">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-brand-muted">
              Próximas Evoluções do Portal
            </span>
            <span className="flex-1 h-px bg-brand-border" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-dashed border-[#D1DBD6] bg-white/70 p-4 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-brand-cream text-brand-muted flex items-center justify-center flex-shrink-0">
                <Calendar size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-primary truncate">
                    Visualizador da Semana
                  </h3>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-brand-cream text-brand-muted">
                    <Clock size={10} /> Em breve
                  </span>
                </div>
                <p className="text-xs text-brand-muted mt-0.5">
                  Grade semanal de atendimentos sincronizada diretamente com o Google Calendar.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-[#D1DBD6] bg-white/70 p-4 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-brand-cream text-brand-muted flex items-center justify-center flex-shrink-0">
                <Package size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-primary truncate">
                    Controle de Pacotes
                  </h3>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-brand-cream text-brand-muted">
                    <Clock size={10} /> Em breve
                  </span>
                </div>
                <p className="text-xs text-brand-muted mt-0.5">
                  Acompanhamento de sessões contratadas, realizadas e saldo por paciente.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

