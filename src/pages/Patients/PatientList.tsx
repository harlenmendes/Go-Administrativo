import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, UserPlus } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { calcularIdade, obterIniciaisNome } from '@/lib/utils'
import { usePacientesStore } from '@/stores/usePacientesStore'
import type { Paciente } from '@/types'

import { MoreVertical, Edit2, Copy, Trash2 } from 'lucide-react'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { softDeletePaciente } from '@/lib/api'

function PatientCard({ paciente }: { paciente: Paciente }) {
  const navigate = useNavigate()
  const [showMenu, setShowMenu] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const iniciais = obterIniciaisNome(paciente.nome)
  const idade = calcularIdade(paciente.data_nascimento)

  const isDeleted = !!paciente.deleted_at

  const { fetchPacientes } = usePacientesStore()

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await softDeletePaciente(paciente.id)
      setShowDeleteModal(false)
      fetchPacientes()
    } catch (e) {
      console.error(e)
    } finally {
      setIsDeleting(false)
    }
  }

  // Gradient colors per patient based on id for visual variety
  const gradients = [
    'from-primary to-blue-600',
    'from-emerald-600 to-teal-700',
    'from-violet-600 to-purple-700',
  ]
  const gradientIdx = paciente.id.length > 5 ? 0 : parseInt(paciente.id.replace(/\D/g, '') || '0', 10)
  const gradient = gradients[gradientIdx % gradients.length]

  return (
    <div className={`relative flex items-center bg-white rounded-2xl shadow-sm border border-slate-100 mb-3 ${isDeleted ? 'opacity-50 grayscale bg-slate-50' : ''}`}>
      
      {/* Dropdown Menu */}
      <div className="absolute top-1/2 -translate-y-1/2 right-2 z-20">
        <button 
          onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu) }}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400"
        >
          <MoreVertical size={16} />
        </button>

        {showMenu && (
          <div className="absolute right-0 top-9 w-40 bg-white rounded-xl shadow-lg border border-slate-100 py-1 overflow-hidden">
            <button 
              onClick={(e) => { e.stopPropagation(); navigate(`/novo-paciente?edit=${paciente.id}`) }}
              className="w-full text-left px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <Edit2 size={14} /> Editar
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); navigate(`/novo-paciente?clone=${paciente.id}`) }}
              className="w-full text-left px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <Copy size={14} /> Duplicar
            </button>
            {!isDeleted && (
              <button 
                onClick={(e) => { e.stopPropagation(); setShowMenu(false); setShowDeleteModal(true) }}
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
        title="Excluir Paciente"
        message="Tem certeza que deseja excluir este paciente? Ele ficará oculto e marcado como inativo."
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
        isLoading={isDeleting}
      />

      <button
        id={`patient-card-${paciente.id}`}
        onClick={() => navigate(`/pacientes/${paciente.id}`)}
        className="w-full text-left p-4 flex items-start gap-3.5 pr-12"
      >
        {/* Avatar */}
        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
          <span className="text-lg font-bold text-white">{iniciais}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-col mb-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-primary text-sm leading-tight truncate">{paciente.nome}</h3>
              {isDeleted && <span className="text-[10px] font-bold text-danger">INATIVO</span>}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{idade} anos · {paciente.profissao}</p>
          </div>
        </div>
      </button>
    </div>
  )
}

export function PatientList() {
  const navigate = useNavigate()
  const [busca, setBusca] = useState('')
  const { pacientes, fetchPacientes, isLoading } = usePacientesStore()

  useEffect(() => {
    fetchPacientes()
  }, [fetchPacientes])

  const pacientesFiltrados = pacientes.filter((p) =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (p.profissao && p.profissao.toLowerCase().includes(busca.toLowerCase()))
  )

  return (
    <div className="animate-fade-in flex flex-col min-h-[100dvh]">
      <TopBar
        title="Pacientes"
        subtitle={`${pacientes.length} pacientes ativos`}
        rightSlot={
          <button
            id="btn-novo-paciente-topbar"
            onClick={() => navigate('/novo-paciente')}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-secondary text-white hover:bg-secondary-600 active:scale-95 transition-all shadow-sm"
            aria-label="Novo Paciente"
          >
            <UserPlus size={18} strokeWidth={2.5} />
          </button>
        }
      />

      <div className="flex-1 w-full max-w-4xl mx-auto px-4 pt-4 pb-24 space-y-4">
        {/* Busca */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" strokeWidth={2} />
          <input
            id="busca-pacientes"
            type="search"
            placeholder="Buscar por nome ou profissão..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="input-base pl-10"
          />
        </div>

        {/* Filtros rápidos */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {['Todos', 'Cervical', 'Lombar', 'Joelho', 'Ombro'].map((f) => (
            <button
              key={f}
              id={`filtro-${f.toLowerCase()}`}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150
                         ${f === 'Todos' ? 'bg-primary text-white border-primary' : 'border-slate-200 text-slate-500 hover:border-primary hover:text-primary active:scale-95'}`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="space-y-3 animate-slide-up">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : pacientesFiltrados.length === 0 ? (
            <div className="text-center p-8 text-slate-400 font-medium">Nenhum paciente encontrado.</div>
          ) : (
            pacientesFiltrados.map((p) => <PatientCard key={p.id} paciente={p} />)
          )}
        </div>
      </div>

      {/* CTA flutuante */}
      <button
        id="fab-novo-paciente"
        onClick={() => navigate('/novo-paciente')}
        className="fixed bottom-20 right-4 w-14 h-14 bg-secondary text-white rounded-full shadow-lg flex items-center justify-center hover:bg-secondary-600 active:scale-90 transition-all z-10"
        aria-label="Adicionar Novo Paciente"
      >
        <UserPlus size={24} strokeWidth={2.5} />
      </button>
    </div>
  )
}
