import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Phone, Activity, Plus, Download, FileText, MapPin
} from 'lucide-react'
import { calcularIdade, formatarData, obterIniciaisNome } from '@/lib/utils'
import { exportarProntuarioParaPDF } from '@/lib/exportPdf'
import { EvolucaoTimeline } from '@/components/patients/EvolucaoTimeline'
import { AvaliacaoCard } from '@/components/patients/AvaliacaoCard'
import { AnexosGaleria } from '@/components/patients/AnexosGaleria'
import { TopBar } from '@/components/layout/TopBar'
import { getPacienteById } from '@/lib/api'
import { useProntuarioStore } from '@/stores/useProntuarioStore'
import type { Paciente } from '@/types'

type TabId = 'avaliacoes' | 'evolucoes'

export function PatientProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabId>('evolucoes')
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [loadingPaciente, setLoadingPaciente] = useState(true)
  const [isExporting, setIsExporting] = useState(false)

  const { avaliacoes, evolucoes, fetchProntuario, isLoading: loadingProntuario } = useProntuarioStore()

  useEffect(() => {
    if (!id) return
    let isMounted = true
    
    // Buscar paciente
    getPacienteById(id).then(data => {
      if (isMounted) {
        setPaciente(data)
        setLoadingPaciente(false)
      }
    }).catch(err => {
      console.error(err)
      if (isMounted) setLoadingPaciente(false)
    })

    // Buscar avaliações e evoluções
    fetchProntuario(id)

    return () => { isMounted = false }
  }, [id, fetchProntuario])

  const handleExportPDF = async () => {
    if (!paciente) return
    setIsExporting(true)
    // Pequeno delay para garantir re-render (se precisar)
    setTimeout(async () => {
      await exportarProntuarioParaPDF('prontuario-content', paciente.nome)
      setIsExporting(false)
    }, 100)
  }

  if (loadingPaciente) {
    return <div className="flex items-center justify-center h-screen">Carregando...</div>
  }

  if (!paciente) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-slate-400">Paciente não encontrado.</p>
        <button onClick={() => navigate(-1)} className="btn-secondary">Voltar</button>
      </div>
    )
  }

  // Pega a avaliação inicial (a mais recente se tiver mais de uma)
  const avaliacao = avaliacoes.length > 0 ? avaliacoes[0] : undefined
  const iniciais = obterIniciaisNome(paciente.nome)
  const idade = calcularIdade(paciente.data_nascimento)

  return (
    <div className="animate-fade-in" id="prontuario-content">
      <TopBar
        title={paciente.nome.split(' ')[0]}
        subtitle="Perfil do Paciente"
        showBack
        rightSlot={
          <button
            id="btn-exportar-pdf"
            onClick={handleExportPDF}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-primary text-primary text-xs font-bold hover:bg-primary hover:text-white transition-all active:scale-95 disabled:opacity-50"
          >
            {isExporting ? (
               <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
               <Download size={13} strokeWidth={2.5} />
            )}
            PDF
          </button>
        }
      />

      {/* Hero do paciente */}
      <div className="bg-gradient-to-br from-primary-800 via-primary to-primary-600 px-4 pt-5 pb-6">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <div className="w-20 h-20 rounded-3xl bg-white/10 border-2 border-white/20 flex flex-col items-center justify-center shadow-inner backdrop-blur-sm">
            <span className="text-3xl font-black text-white">{iniciais}</span>
          </div>
          <div className="flex-1 text-white">
            <h1 className="font-editorial text-2xl font-semibold mb-1">{paciente.nome}</h1>
            <p className="text-primary-100 text-sm">{idade} anos • {paciente.profissao || 'Não informada'}</p>
            <span className="inline-block mt-2 px-2 py-0.5 rounded-md bg-white/10 text-xs font-bold text-white border border-white/20">
              {paciente.origem_encaminhamento || 'Particular'}
            </span>
          </div>
        </div>
      </div>

      {/* Info Cards Rápidos */}
      <div className="max-w-4xl mx-auto px-4 -mt-4 mb-6 space-y-2">
        <div className="card p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center">
              <Phone size={15} className="text-secondary" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Telefone</p>
              <p className="text-sm font-bold text-primary">{paciente.telefone}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Paciente desde</p>
            <p className="text-xs font-bold text-primary">{formatarData(paciente.data_criacao)}</p>
          </div>
        </div>

        {paciente.endereco && (
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(paciente.endereco)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="card p-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <MapPin size={15} className="text-emerald-600" strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Endereço</p>
                <p className="text-xs font-bold text-primary truncate leading-tight mt-0.5">{paciente.endereco}</p>
              </div>
            </div>
          </a>
        )}
      </div>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-4">
          {([
            { id: 'evolucoes', label: 'Evoluções', icon: Activity },
            { id: 'avaliacoes', label: 'Avaliação Inicial', icon: FileText },
          ] as { id: TabId; label: string; icon: typeof Activity }[]).map(({ id: tabId, label, icon: Icon }) => (
            <button
              key={tabId}
              id={`tab-${tabId}`}
              onClick={() => setActiveTab(tabId)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                activeTab === tabId
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {loadingProntuario ? (
           <div className="flex justify-center p-8">
             <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
           </div>
        ) : activeTab === 'evolucoes' ? (
          <div className="animate-fade-in space-y-4">
            <button
              id="btn-nova-evolucao"
              onClick={() => navigate('/nova-evolucao?paciente=' + paciente.id)}
              className="w-full card-hover flex items-center justify-center gap-2 p-4 text-secondary font-bold text-sm bg-secondary/5 border-secondary/20 border-dashed border-2"
            >
              <Plus size={18} strokeWidth={3} />
              Adicionar Nova Evolução
            </button>

            {evolucoes.length > 0 ? (
              <EvolucaoTimeline evolucoes={evolucoes} onUpdated={() => fetchProntuario(paciente.id)} />
            ) : (
              <div className="text-center p-8 text-slate-400 font-medium">Nenhuma evolução registrada.</div>
            )}
          </div>
        ) : (
          <div className="animate-fade-in space-y-4">
            {avaliacao ? (
              <>
                <AvaliacaoCard avaliacao={avaliacao as any} paciente={paciente} compact={true} onUpdated={() => fetchProntuario(paciente.id)} />

                {/* Seções Adicionais da Avaliação */}
                <div className="card p-4">
                  <h4 className="section-title mb-3">Histórico da Queixa</h4>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                    {avaliacao.historia_queixa || 'Não informado'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="card p-4 bg-danger/5 border-danger/10">
                    <h4 className="text-xs font-bold text-danger uppercase tracking-wider mb-2">Agravantes</h4>
                    <p className="text-sm text-slate-700">{avaliacao.fatores_agravantes || '-'}</p>
                  </div>
                  <div className="card p-4 bg-secondary/5 border-secondary/10">
                    <h4 className="text-xs font-bold text-secondary uppercase tracking-wider mb-2">Aliviantes</h4>
                    <p className="text-sm text-slate-700">{avaliacao.fatores_aliviantes || '-'}</p>
                  </div>
                </div>

                <div className="card p-4 space-y-4">
                  <h4 className="section-title mb-1">Exame Físico & Hipótese Clínica</h4>
                  
                  <div>
                    <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Exame Físico Completo</h5>
                    <p className="text-sm font-medium leading-relaxed text-slate-700 whitespace-pre-wrap">{avaliacao.exame_fisico || 'Não informado'}</p>
                  </div>

                  <div>
                    <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Hipótese Clínica</h5>
                    <p className="text-sm font-semibold leading-relaxed text-primary">{avaliacao.hipotese_clinica || 'Não informada'}</p>
                  </div>
                </div>

                {/* Objetivos Terapêuticos (SMART) */}
                {avaliacao.objetivos && (avaliacao.objetivos.curto_prazo || avaliacao.objetivos.medio_prazo || avaliacao.objetivos.longo_prazo) && (
                  <div className="card p-4 space-y-3">
                    <h4 className="section-title mb-1">Objetivos Terapêuticos (SMART)</h4>
                    
                    {avaliacao.objetivos.curto_prazo && (
                      <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100">
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block mb-0.5">Curto Prazo</span>
                        <p className="text-xs text-emerald-900 font-medium">{avaliacao.objetivos.curto_prazo}</p>
                      </div>
                    )}

                    {avaliacao.objetivos.medio_prazo && (
                      <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-100">
                        <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block mb-0.5">Médio Prazo</span>
                        <p className="text-xs text-amber-900 font-medium">{avaliacao.objetivos.medio_prazo}</p>
                      </div>
                    )}

                    {avaliacao.objetivos.longo_prazo && (
                      <div className="bg-primary-50/60 p-2.5 rounded-xl border border-primary-100">
                        <span className="text-[10px] font-bold text-primary-700 uppercase tracking-wider block mb-0.5">Longo Prazo</span>
                        <p className="text-xs text-primary-900 font-medium">{avaliacao.objetivos.longo_prazo}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Plano de tratamento / Abordagens Planejadas */}
                {avaliacao.plano_tratamento && avaliacao.plano_tratamento.length > 0 && (
                  <div className="card p-4">
                    <h4 className="section-title mb-3">Abordagens Planejadas</h4>
                    <div className="flex flex-wrap gap-2">
                      {avaliacao.plano_tratamento.map((c: string) => (
                        <span
                          key={c}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-primary text-white shadow-sm flex items-center gap-1"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Galeria de Exames e Fotos da Avaliação */}
                {avaliacao.anexos && avaliacao.anexos.length > 0 && (
                  <AnexosGaleria
                    anexos={avaliacao.anexos}
                    titulo="Exames, Imagens e Laudos"
                  />
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <FileText size={24} className="text-slate-300" />
                </div>
                <p className="text-sm font-semibold text-slate-400">Nenhuma avaliação inicial</p>
                <button
                  id="btn-nova-avaliacao-perfil"
                  onClick={() => navigate('/nova-avaliacao?paciente=' + paciente.id)}
                  className="btn-primary"
                >
                  <Plus size={16} />
                  Iniciar Avaliação
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Espaço extra no final */}
      <div className="h-6" />
    </div>
  )
}
