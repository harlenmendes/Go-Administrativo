import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Users, Calendar, Activity, ChevronRight, ArrowLeft } from 'lucide-react'
import { getAtendimentosHoje } from '@/lib/api'
import { usePacientesStore } from '@/stores/usePacientesStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { obterIniciaisNome } from '@/lib/utils'

export function Dashboard() {
  const navigate = useNavigate()
  const { pacientes, fetchPacientes, isLoading } = usePacientesStore()
  const { user } = useAuthStore()

  const [atendimentosHoje, setAtendimentosHoje] = useState(0)
  const [hojeLoading, setHojeLoading] = useState(true)

  useEffect(() => {
    fetchPacientes()
    getAtendimentosHoje()
      .then((count) => {
        setAtendimentosHoje(count)
        setHojeLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setHojeLoading(false)
      })
  }, [fetchPacientes])

  const hoje = new Date()
  const saudacao =
    hoje.getHours() < 12 ? 'Bom dia' : hoje.getHours() < 18 ? 'Boa tarde' : 'Boa noite'
  const userName = user?.user_metadata?.name || 'Doutor(a)'

  return (
    <div className="flex flex-col min-h-full bg-background">
      {/* Header clínico com identidade Go Fisioterapia */}
      <header className="bg-gradient-to-br from-primary-800 via-primary to-primary-500 text-white px-5 sm:px-6 pt-5 pb-8 rounded-b-[2rem] shadow-sm relative overflow-hidden animate-fade-in">
        <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />

        <div className="max-w-4xl mx-auto relative z-10">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary-300 hover:text-white transition-colors"
            >
              <ArrowLeft size={15} />
              Voltar ao Portal
            </button>
            <span className="text-[11px] font-medium tracking-[0.18em] uppercase text-secondary-300">
              Acompanhamento Clínico
            </span>
          </div>

          <p className="text-primary-200 font-medium mb-1 text-sm">{saudacao},</p>
          <h1 className="font-editorial text-3xl sm:text-4xl font-medium tracking-tight mb-6">
            Dr(a). <em className="italic text-secondary-300">{userName}</em>
          </h1>

          {/* Métricas Principais */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15">
              <div className="flex items-center gap-2 text-secondary-300 mb-1">
                <Users size={16} />
                <span className="text-xs font-medium uppercase tracking-wider">Pacientes Ativos</span>
              </div>
              <p className="text-3xl font-semibold">{isLoading ? '—' : pacientes.length}</p>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15">
              <div className="flex items-center gap-2 text-secondary-300 mb-1">
                <Activity size={16} />
                <span className="text-xs font-medium uppercase tracking-wider">Atendimentos Hoje</span>
              </div>
              <p className="text-3xl font-semibold">{hojeLoading ? '—' : atendimentosHoje}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 mt-6 space-y-8 animate-slide-up pb-8">
        {/* Ações Rápidas */}
        <section>
          <div className="grid grid-cols-2 gap-3.5">
            <button
              id="cta-novo-paciente"
              onClick={() => navigate('/novo-paciente')}
              className="card-hover flex flex-col items-center justify-center gap-2 p-5"
            >
              <div className="w-12 h-12 bg-secondary-50 text-secondary-700 rounded-2xl flex items-center justify-center mb-1 border border-secondary-200">
                <Plus size={24} />
              </div>
              <span className="text-sm font-semibold text-primary">Novo Paciente</span>
              <span className="text-xs text-brand-muted">Cadastrar ficha clínica</span>
            </button>

            <button
              id="cta-nova-evolucao"
              onClick={() => navigate('/pacientes')}
              className="card-hover flex flex-col items-center justify-center gap-2 p-5"
            >
              <div className="w-12 h-12 bg-primary-50 text-primary rounded-2xl flex items-center justify-center mb-1 border border-primary-100">
                <Calendar size={24} />
              </div>
              <span className="text-sm font-semibold text-primary">Nova Sessão</span>
              <span className="text-xs text-brand-muted">Selecionar paciente</span>
            </button>
          </div>
        </section>

        {/* Últimos Pacientes */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-brand-muted uppercase tracking-[0.15em]">
              Últimos Pacientes
            </h2>
            <button
              onClick={() => navigate('/pacientes')}
              className="text-xs font-semibold text-secondary-700 hover:text-primary flex items-center gap-0.5"
            >
              Ver todos <ChevronRight size={14} />
            </button>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <div className="card p-6 text-center text-sm text-brand-muted">Carregando...</div>
            ) : pacientes.length === 0 ? (
              <div className="card p-6 text-center text-sm text-brand-muted">
                Nenhum paciente cadastrado ainda.
              </div>
            ) : (
              pacientes.slice(0, 5).map((paciente) => (
                <div
                  key={paciente.id}
                  onClick={() => navigate(`/pacientes/${paciente.id}`)}
                  className="card-hover p-3.5 flex items-center gap-3.5"
                >
                  <div className="w-11 h-11 rounded-xl bg-primary-50 text-primary flex items-center justify-center font-semibold text-sm flex-shrink-0">
                    {obterIniciaisNome(paciente.nome)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-primary text-sm truncate">{paciente.nome}</h3>
                    <p className="text-xs text-brand-muted mt-0.5">{paciente.telefone}</p>
                  </div>
                  <ChevronRight size={16} className="text-brand-muted" />
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
