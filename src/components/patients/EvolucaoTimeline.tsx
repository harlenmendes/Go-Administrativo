import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { ChevronDown, ChevronUp, Activity, Dumbbell, FileText, MoreVertical, Edit2, Copy, Trash2 } from 'lucide-react'
import type { EvolucaoAtendimento } from '@/types'
import { formatarDataCurta, getCorEfeito, cn } from '@/lib/utils'
import { DorDeltaBadge } from './DorDeltaBadge'
import { EfeitoClinicoBadge } from './EfeitoClinicoBadge'
import { StarRating } from '@/components/ui/StarRating'
import { AnexosGaleria } from './AnexosGaleria'
import { ConfirmModal } from '../ui/ConfirmModal'
import { softDeleteEvolucao } from '@/lib/api'

interface EvolucaoTimelineProps {
  evolucoes: EvolucaoAtendimento[]
  onUpdated?: () => void
}

// ---- Tooltip customizado do gráfico ----
const CustomTooltip = ({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-3 text-xs min-w-[120px]">
        <p className="font-bold text-primary mb-1.5">{label}</p>
        {payload.map((p) => (
          <div key={p.name} className="flex items-center gap-1.5 mb-0.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-slate-500">{p.name}:</span>
            <span className="font-bold" style={{ color: p.color }}>{p.value}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

// ---- Card de um atendimento na timeline ----
interface EvolucaoCardProps {
  evolucao: EvolucaoAtendimento
  numero: number
  isLast: boolean
  onUpdated?: () => void
}

function EvolucaoCard({ evolucao, numero, isLast, onUpdated }: EvolucaoCardProps) {
  const navigate = useNavigate()
  const [expandido, setExpandido] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  
  const isDeleted = !!evolucao.deleted_at
  const cores = getCorEfeito(evolucao.efeito_clinico_intervencao)
  const dataFormatada = formatarDataCurta(evolucao.data)
  const admMelhorou = evolucao.adm_antes !== evolucao.adm_depois && evolucao.adm_depois !== 'Sem limitação'

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await softDeleteEvolucao(evolucao.id)
      setShowDeleteModal(false)
      if (onUpdated) onUpdated()
    } catch (e) {
      console.error(e)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className={`relative flex gap-3 ${isDeleted ? 'opacity-50 grayscale' : ''}`}>
      {/* Linha vertical da timeline */}
      {!isLast && (
        <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-slate-100 z-0" />
      )}

      {/* Marcador da timeline */}
      <div className="relative z-10 flex-shrink-0 mt-1">
        <div
          className="w-10 h-10 rounded-xl flex flex-col items-center justify-center text-white font-bold shadow-sm"
          style={{ backgroundColor: cores.bg === '#F8FAFC' ? '#94A3B8' : cores.text }}
        >
          <span className="text-[9px] font-semibold opacity-80 leading-none">{dataFormatada.split(' ')[1]?.toUpperCase()}</span>
          <span className="text-sm leading-none">{dataFormatada.split(' ')[0]}</span>
        </div>
      </div>

      {/* Conteúdo do card */}
      <div className="flex-1 mb-4 animate-slide-up relative" style={{ animationDelay: `${numero * 60}ms` }}>
        
        {/* Dropdown Menu (absolute to the card container) */}
        <div className="absolute top-2 right-2 z-20" onClick={e => e.stopPropagation()}>
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400"
          >
            <MoreVertical size={16} />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-9 w-40 bg-white rounded-xl shadow-lg border border-slate-100 py-1 overflow-hidden">
              <button 
                onClick={() => navigate(`/nova-evolucao?paciente_id=${evolucao.paciente_id}&edit=${evolucao.id}`)}
                className="w-full text-left px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <Edit2 size={14} /> Editar
              </button>
              <button 
                onClick={() => navigate(`/nova-evolucao?paciente_id=${evolucao.paciente_id}&clone=${evolucao.id}`)}
                className="w-full text-left px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <Copy size={14} /> Duplicar
              </button>
              {!isDeleted && (
                <button 
                  onClick={() => { setShowMenu(false); setShowDeleteModal(true) }}
                  className="w-full text-left px-4 py-2 text-sm font-semibold text-danger hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 size={14} /> Excluir
                </button>
              )}
            </div>
          )}
        </div>

        {/* Modal de Exclusão */}
        <ConfirmModal
          isOpen={showDeleteModal}
          title="Excluir Evolução"
          message="Tem certeza que deseja excluir esta evolução? Ela ficará oculta e marcada como inativa."
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          isLoading={isDeleting}
        />

        <div
          className={`bg-white rounded-2xl border shadow-card overflow-hidden transition-all duration-200 ${isDeleted ? 'bg-slate-50' : ''}`}
          style={{ borderColor: cores.border }}
        >
          {/* Cabeçalho do card - sempre visível */}
          <button
            id={`evolucao-card-${evolucao.id}`}
            className="w-full text-left p-3.5 pr-10 flex flex-col gap-2"
            onClick={() => setExpandido(!expandido)}
          >
            {/* Linha 1: Sessão + efeito + desempenho */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                  Sessão {numero}
                  {isDeleted && <span className="ml-2 text-danger">INATIVA</span>}
                </span>
                {!isDeleted && <EfeitoClinicoBadge efeito={evolucao.efeito_clinico_intervencao} />}
              </div>
              <div className="flex items-center gap-2">
                {!isDeleted && <StarRating value={evolucao.desempenho_paciente} size={12} />}
                {expandido
                  ? <ChevronUp size={14} className="text-slate-400" />
                  : <ChevronDown size={14} className="text-slate-400" />}
              </div>
            </div>

            {/* Linha 2: Movimento testado */}
            <div className="flex items-center gap-1.5">
              <Activity size={13} className="text-secondary flex-shrink-0" strokeWidth={2.5} />
              <span className="text-xs font-semibold text-primary leading-tight">
                {evolucao.movimento_teste_escolhido}
              </span>
            </div>

            {/* Linha 3: Dor Antes → Depois + ADM */}
            <div className="flex items-center gap-4">
              <DorDeltaBadge
                antes={evolucao.escala_dor_antes}
                depois={evolucao.escala_dor_depois}
                size="sm"
                showLabel
              />
              {evolucao.adm_antes !== 'Sem limitação' && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">ADM</span>
                  <span className="text-xs font-bold text-primary">
                    {evolucao.adm_antes}
                    <span className="text-slate-400 font-normal mx-1">→</span>
                    <span className={admMelhorou ? 'text-secondary' : ''}>
                      {evolucao.adm_depois}
                    </span>
                  </span>
                </div>
              )}
            </div>
          </button>

          {/* Conteúdo expandido */}
          {expandido && (
            <div
              className="border-t px-3.5 pb-3.5 pt-3 space-y-3"
              style={{ borderColor: cores.border, backgroundColor: cores.bg + '40' }}
            >
              {/* Condutas realizadas */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Dumbbell size={12} className="text-primary" strokeWidth={2.5} />
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wide">
                    Condutas realizadas
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {evolucao.condutas_realizadas.map((c) => (
                    <span
                      key={c}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/8 text-primary border border-primary/15"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              {/* Relato livre */}
              {evolucao.relato_livre && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <FileText size={12} className="text-slate-500" strokeWidth={2.5} />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                      Evolução clínica
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{evolucao.relato_livre}</p>
                </div>
              )}

              {/* Fotos e documentos */}
              {evolucao.anexos.length > 0 && (
                <AnexosGaleria
                  anexos={evolucao.anexos}
                  titulo="Fotos e Documentos da Sessão"
                  compacto
                />
              )}
            </div>
          )}

          {/* Rodapé de Auditoria */}
          {expandido && (
            <div className="bg-slate-50 px-3.5 py-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-semibold text-slate-400">
              <p>
                Salvo em {dataFormatada} 
                {evolucao.updated_by && ' • Editado'}
              </p>
              {isDeleted && <p className="text-danger">Excluído</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Componente principal da Timeline
// ============================================================
export function EvolucaoTimeline({ evolucoes, onUpdated }: EvolucaoTimelineProps) {
  const [viewMode, setViewMode] = useState<'timeline' | 'grafico'>('timeline')
  
  // Apenas as ativas para as estatísticas e gráfico
  const evolucoesAtivas = evolucoes.filter(e => !e.deleted_at)

  if (evolucoes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
          <Activity size={24} className="text-slate-300" />
        </div>
        <p className="text-sm font-semibold text-slate-400">Nenhuma evolução registrada ainda</p>
        <p className="text-xs text-slate-300 text-center">
          Registre a primeira sessão para começar o acompanhamento
        </p>
      </div>
    )
  }

  // Dados para o gráfico (apenas ativas)
  const dadosGrafico = [...evolucoesAtivas].reverse().map((e, i) => ({
    sessao: `S${i + 1}`,
    'Dor Antes': e.escala_dor_antes,
    'Dor Depois': e.escala_dor_depois,
    data: formatarDataCurta(e.data),
  }))

  const melhoriaTotal = evolucoesAtivas.length >= 2
    ? evolucoesAtivas[evolucoesAtivas.length - 1].escala_dor_antes - evolucoesAtivas[0].escala_dor_depois
    : 0

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Resumo estatístico */}
      <div className="grid grid-cols-3 gap-2">
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-primary">{evolucoes.length}</p>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Sessões</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-secondary">{Math.max(0, melhoriaTotal)}</p>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Melhora EVA</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-primary">
            {evolucoes.filter(e =>
              e.efeito_clinico_intervencao === 'Melhora importante' ||
              e.efeito_clinico_intervencao === 'Melhora moderada'
            ).length}
          </p>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Melhoras</p>
        </div>
      </div>

      {/* Toggle Timeline / Gráfico */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
        <button
          id="toggle-timeline-view"
          onClick={() => setViewMode('timeline')}
          className={cn(
            'flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200',
            viewMode === 'timeline'
              ? 'bg-white text-primary shadow-sm'
              : 'text-slate-400 hover:text-slate-600',
          )}
        >
          Timeline
        </button>
        <button
          id="toggle-grafico-view"
          onClick={() => setViewMode('grafico')}
          className={cn(
            'flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200',
            viewMode === 'grafico'
              ? 'bg-white text-primary shadow-sm'
              : 'text-slate-400 hover:text-slate-600',
          )}
        >
          Gráfico de Dor
        </button>
      </div>

      {/* Gráfico de evolução */}
      {viewMode === 'grafico' && (
        <div className="card p-4 animate-fade-in">
          <h3 className="text-sm font-bold text-primary mb-3">Evolução da Dor (EVA 0-10)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dadosGrafico} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis
                dataKey="sessao"
                tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 600 }}
                axisLine={{ stroke: '#E2E8F0' }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 10]}
                ticks={[0, 2, 4, 6, 8, 10]}
                tick={{ fontSize: 10, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '11px', fontWeight: 600, paddingTop: '8px' }}
              />
              <ReferenceLine y={4} stroke="#4CAF50" strokeDasharray="3 3" strokeOpacity={0.5} />
              <Line
                type="monotone"
                dataKey="Dor Antes"
                stroke="#EF4444"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#EF4444', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="Dor Depois"
                stroke="#4CAF50"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#4CAF50', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6 }}
                strokeDasharray="5 2"
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-slate-400 text-center mt-1">
            Linha verde pontilhada = meta ≤ 4 EVA
          </p>
        </div>
      )}

      {/* Timeline de cards */}
      {viewMode === 'timeline' && (
        <div className="pt-1">
          {[...evolucoes].reverse().map((evolucao, idx) => (
            <EvolucaoCard
              key={evolucao.id}
              evolucao={evolucao}
              numero={evolucoes.length - idx}
              isLast={idx === evolucoes.length - 1}
              onUpdated={onUpdated}
            />
          ))}
        </div>
      )}
    </div>
  )
}
