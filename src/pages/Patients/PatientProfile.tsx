import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Phone, Activity, Plus, Download, FileText, MapPin, PackageCheck
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
    <div className="space-y-8 animate-fade-in" id="prontuario-content">
      <TopBar
        title={paciente.nome}
        subtitle="Prontuário do Paciente"
        showBack
        rightSlot={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(`/pacotes?tab=relatorio&paciente=${paciente.id}`)}
              className="btn-outline py-2.5 px-3.5 text-xs"
            >
              <PackageCheck size={15} strokeWidth={2.2} />
              Pacotes
            </button>
            <button
              id="btn-exportar-pdf"
              onClick={handleExportPDF}
              disabled={isExporting}
              className="btn-outline py-2.5 px-4 text-xs"
            >
              {isExporting ? (
                <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download size={15} strokeWidth={2.2} />
              )}
              PDF
            </button>
          </div>
        }
      />

      {/* Card Principal de Perfil do Paciente */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-brand-border shadow-card flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-primary text-white flex items-center justify-center shadow-sm flex-shrink-0">
            <span className="text-2xl sm:text-3xl font-bold">{iniciais}</span>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-bold text-primary">{paciente.nome}</h2>
              <span className="px-3 py-1 rounded-full bg-secondary-50 text-secondary-700 text-xs font-semibold">
                {paciente.origem_encaminhamento || 'Particular'}
              </span>
            </div>
            <p className="text-sm text-brand-muted mt-1">
              {idade} anos · {paciente.profissao || 'Profissão não informada'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-4 md:pt-0 border-t md:border-t-0 border-brand-border">
          <div className="flex items-center gap-3 bg-brand-offwhite px-4 py-3 rounded-2xl border border-brand-border">
            <div className="w-9 h-9 rounded-xl bg-secondary-50 flex items-center justify-center">
              <Phone size={16} className="text-secondary-700" />
            </div>
            <div>
              <p className="text-[11px] text-brand-muted font-medium">Telefone</p>
              <p className="text-xs font-bold text-primary">{paciente.telefone}</p>
            </div>
          </div>

          <div className="bg-brand-offwhite px-4 py-3 rounded-2xl border border-brand-border">
            <p className="text-[11px] text-brand-muted font-medium">Paciente desde</p>
            <p className="text-xs font-bold text-primary">{formatarData(paciente.data_criacao)}</p>
          </div>
        </div>
      </div>

      {paciente.endereco && (
        <a
          href={`https://maps.google.com/?q=${encodeURIComponent(paciente.endereco)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white rounded-3xl p-5 border border-brand-border shadow-card flex items-center gap-4 hover:border-secondary-300 transition-colors"
        >
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <MapPin size={18} className="text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-brand-muted font-medium">Endereço</p>
            <p className="text-sm font-semibold text-primary truncate mt-0.5">{paciente.endereco}</p>
          </div>
        </a>
      )}

      {/* Tabs */}
      <div className="space-y-6">
        <div className="inline-flex gap-1.5 p-1.5 bg-white border border-brand-border rounded-2xl shadow-xs">
          {([
            { id: 'evolucoes', label: 'Evoluções', icon: Activity },
            { id: 'avaliacoes', label: 'Avaliação Inicial', icon: FileText },
          ] as { id: TabId; label: string; icon: typeof Activity }[]).map(({ id: tabId, label, icon: Icon }) => (
            <button
              key={tabId}
              id={`tab-${tabId}`}
              onClick={() => setActiveTab(tabId)}
              className={`flex items-center justify-center gap-2 py-2.5 px-5 text-xs font-bold rounded-xl transition-all ${
                activeTab === tabId
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-brand-muted hover:text-primary'
              }`}
            >
              <Icon size={15} />
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
