import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Paciente, AvaliacaoInicial } from '@/types'
import { formatarData, getCorIrritabilidade } from '@/lib/utils'
import { MapPin, Zap, Target, MoreVertical, Edit2, Copy, Trash2 } from 'lucide-react'
import { AnexosGaleria } from './AnexosGaleria'
import { ConfirmModal } from '../ui/ConfirmModal'
import { softDeleteAvaliacao } from '@/lib/api'

interface AvaliacaoCardProps {
  avaliacao: AvaliacaoInicial
  paciente: Paciente
  compact?: boolean
  onUpdated?: () => void
}

export function AvaliacaoCard({ avaliacao, paciente, compact = false, onUpdated }: AvaliacaoCardProps) {
  const navigate = useNavigate()
  const [showMenu, setShowMenu] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const isDeleted = !!avaliacao.deleted_at

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await softDeleteAvaliacao(avaliacao.id)
      setShowDeleteModal(false)
      if (onUpdated) onUpdated()
    } catch (e) {
      console.error(e)
    } finally {
      setIsDeleting(false)
    }
  }

  if (compact) {
    return (
      <div className={`card p-4 space-y-3 relative ${isDeleted ? 'opacity-50 grayscale bg-slate-50' : ''}`}>
        
        {/* Dropdown Menu */}
        <div className="absolute top-4 right-4 z-10">
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400"
          >
            <MoreVertical size={16} />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-9 w-40 bg-white rounded-xl shadow-lg border border-slate-100 py-1 overflow-hidden">
              <button 
                onClick={() => navigate(`/nova-avaliacao?paciente_id=${paciente.id}&edit=${avaliacao.id}`)}
                className="w-full text-left px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <Edit2 size={14} /> Editar
              </button>
              <button 
                onClick={() => navigate(`/nova-avaliacao?paciente_id=${paciente.id}&clone=${avaliacao.id}`)}
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
          title="Excluir Avaliação"
          message="Tem certeza que deseja excluir esta avaliação? Ela ficará oculta e marcada como inativa."
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          isLoading={isDeleting}
        />

        <div className="flex items-start justify-between gap-2 pr-8">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">
              Avaliação · {formatarData(avaliacao.data_avaliacao)}
              {isDeleted && <span className="ml-2 text-danger">INATIVA</span>}
            </p>
            <h3 className="text-sm font-bold text-primary leading-tight">{avaliacao.queixa_principal}</h3>
          </div>
          {!isDeleted && (
            <span className={`badge border text-[10px] ${getCorIrritabilidade(avaliacao.irritabilidade)}`}>
              {avaliacao.irritabilidade}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <MapPin size={12} className="text-secondary" strokeWidth={2.5} />
            <span className="text-xs text-slate-600 font-medium">{avaliacao.regiao_sintomas} · {avaliacao.lado_acometido}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold"
            style={{ backgroundColor: '#FEF9EC', color: '#854D0E', border: '1px solid #FDE68A' }}
          >
            <Zap size={10} />
            Dor pior: {avaliacao.comportamento_sintomas.dor_pior}/10
          </div>
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold"
            style={{ backgroundColor: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0' }}
          >
            Dor atual: {avaliacao.comportamento_sintomas.dor_atual}/10
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
            Hipótese Clínica
          </p>
          <p className="text-xs text-primary font-medium leading-relaxed">{avaliacao.hipotese_clinica}</p>
        </div>

        <div className="bg-secondary-50 rounded-xl p-3 border border-secondary-100">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Target size={12} className="text-secondary" strokeWidth={2.5} />
            <p className="text-[10px] font-bold text-secondary-700 uppercase tracking-wide">
              Objetivo do Paciente
            </p>
          </div>
          <p className="text-xs text-secondary-800 font-medium italic leading-relaxed">
            &ldquo;{avaliacao.objetivo_paciente}&rdquo;
          </p>
        </div>

        {/* Objetivos Terapêuticos SMART */}
        {avaliacao.objetivos && (avaliacao.objetivos.curto_prazo || avaliacao.objetivos.medio_prazo || avaliacao.objetivos.longo_prazo) && (
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Target size={12} className="text-primary" strokeWidth={2.5} />
              <p className="text-[10px] font-bold text-primary uppercase tracking-wide">
                Objetivos Terapêuticos (SMART)
              </p>
            </div>
            {avaliacao.objetivos.curto_prazo && (
              <div className="text-xs flex items-start gap-1">
                <span className="font-bold text-emerald-600 text-[10px] uppercase min-w-[75px]">Curto Prazo:</span>
                <span className="text-slate-700 font-medium">{avaliacao.objetivos.curto_prazo}</span>
              </div>
            )}
            {avaliacao.objetivos.medio_prazo && (
              <div className="text-xs flex items-start gap-1">
                <span className="font-bold text-amber-600 text-[10px] uppercase min-w-[75px]">Médio Prazo:</span>
                <span className="text-slate-700 font-medium">{avaliacao.objetivos.medio_prazo}</span>
              </div>
            )}
            {avaliacao.objetivos.longo_prazo && (
              <div className="text-xs flex items-start gap-1">
                <span className="font-bold text-primary text-[10px] uppercase min-w-[75px]">Longo Prazo:</span>
                <span className="text-slate-700 font-medium">{avaliacao.objetivos.longo_prazo}</span>
              </div>
            )}
          </div>
        )}

        {/* Abordagens Planejadas */}
        {avaliacao.plano_tratamento && avaliacao.plano_tratamento.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
              Abordagens Planejadas
            </p>
            <div className="flex flex-wrap gap-1.5">
              {avaliacao.plano_tratamento.map((item: string) => (
                <span
                  key={item}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-100"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Galeria de Anexos (Exames e Fotos) */}
        {avaliacao.anexos && avaliacao.anexos.length > 0 && (
          <AnexosGaleria
            anexos={avaliacao.anexos}
            titulo="Exames e Fotos da Avaliação"
          />
        )}

        {/* Rodapé de Auditoria */}
        <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[10px] font-semibold text-slate-400">
          <p>
            Criado em {new Date(avaliacao.data_avaliacao).toLocaleDateString('pt-BR')} 
            {avaliacao.updated_by && ' • Editado'}
          </p>
          {isDeleted && <p className="text-danger">Excluído</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="card p-4">
      <p className="text-xs text-slate-400">Avaliação completa — ver detalhe</p>
    </div>
  )
}
