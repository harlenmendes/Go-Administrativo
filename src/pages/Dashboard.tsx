import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UserPlus,
  UsersRound,
  CalendarPlus,
  Activity,
  ChevronRight,
  Phone,
} from 'lucide-react'
import { getAtendimentosHoje } from '@/lib/api'
import { usePacientesStore } from '@/stores/usePacientesStore'
import { obterIniciaisNome } from '@/lib/utils'

export function Dashboard() {
  const navigate = useNavigate()
  const { pacientes, fetchPacientes, isLoading } = usePacientesStore()

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

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Cabeçalho da Página */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary-600 mb-1.5">
            Módulo Clínico
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary tracking-tight">
            Acompanhamento
          </h1>
        </div>

        <button
          id="cta-novo-paciente-header"
          onClick={() => navigate('/novo-paciente')}
          className="btn-primary self-start sm:self-auto"
        >
          <UserPlus size={18} />
          Novo Paciente
        </button>
      </header>

      {/* Indicadores + Atalhos Rápidos */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-3xl p-6 border border-brand-border shadow-card flex items-center gap-4">
          <div className="w-13 h-13 w-12 h-12 rounded-2xl bg-primary-50 text-primary flex items-center justify-center flex-shrink-0">
            <UsersRound size={22} strokeWidth={1.9} />
          </div>
          <div>
            <p className="text-xs font-medium text-brand-muted">Pacientes Ativos</p>
            <p className="text-2xl font-bold text-primary mt-0.5">
              {isLoading ? '—' : pacientes.length}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-brand-border shadow-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-secondary-50 text-secondary-700 flex items-center justify-center flex-shrink-0">
            <Activity size={22} strokeWidth={1.9} />
          </div>
          <div>
            <p className="text-xs font-medium text-brand-muted">Sessões Hoje</p>
            <p className="text-2xl font-bold text-primary mt-0.5">
              {hojeLoading ? '—' : atendimentosHoje}
            </p>
          </div>
        </div>

        <button
          id="cta-novo-paciente"
          onClick={() => navigate('/novo-paciente')}
          className="bg-white rounded-3xl p-6 border border-brand-border shadow-card hover:shadow-card-hover hover:border-secondary-300 transition-all text-left flex items-center gap-4 group"
        >
          <div className="w-12 h-12 rounded-2xl bg-secondary-600 text-white flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
            <UserPlus size={21} strokeWidth={2} />
          </div>
          <div>
            <p className="text-sm font-bold text-primary">Cadastrar</p>
            <p className="text-xs text-brand-muted mt-0.5">Nova ficha clínica</p>
          </div>
        </button>

        <button
          id="cta-nova-evolucao"
          onClick={() => navigate('/pacientes')}
          className="bg-white rounded-3xl p-6 border border-brand-border shadow-card hover:shadow-card-hover hover:border-secondary-300 transition-all text-left flex items-center gap-4 group"
        >
          <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
            <CalendarPlus size={21} strokeWidth={2} />
          </div>
          <div>
            <p className="text-sm font-bold text-primary">Nova Sessão</p>
            <p className="text-xs text-brand-muted mt-0.5">Registrar evolução</p>
          </div>
        </button>
      </section>

      {/* Pacientes Recentes */}
      <section className="bg-white rounded-3xl border border-brand-border shadow-card p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-primary">Pacientes Recentes</h2>
            <p className="text-xs text-brand-muted mt-0.5">
              Clique em um paciente para abrir o prontuário
            </p>
          </div>

          <button
            onClick={() => navigate('/pacientes')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-secondary-700 hover:text-primary transition-colors"
          >
            Ver todos
            <ChevronRight size={15} />
          </button>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-brand-muted">
              Carregando pacientes...
            </div>
          ) : pacientes.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-sm text-brand-muted">Nenhum paciente cadastrado ainda.</p>
              <button
                onClick={() => navigate('/novo-paciente')}
                className="btn-secondary text-xs py-2.5 px-4"
              >
                <UserPlus size={15} />
                Cadastrar Primeiro Paciente
              </button>
            </div>
          ) : (
            pacientes.slice(0, 6).map((paciente) => (
              <div
                key={paciente.id}
                onClick={() => navigate(`/pacientes/${paciente.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/pacientes/${paciente.id}`)}
                className="p-4 rounded-2xl border border-brand-border hover:border-secondary-300 hover:bg-brand-offwhite transition-all cursor-pointer flex items-center gap-4 group"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {obterIniciaisNome(paciente.nome)}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-primary text-sm sm:text-base truncate">
                    {paciente.nome}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-brand-muted mt-1">
                    <span className="inline-flex items-center gap-1">
                      <Phone size={12} />
                      {paciente.telefone}
                    </span>
                    {paciente.profissao && (
                      <span className="hidden sm:inline">· {paciente.profissao}</span>
                    )}
                  </div>
                </div>

                <ChevronRight
                  size={18}
                  className="text-brand-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all"
                />
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
