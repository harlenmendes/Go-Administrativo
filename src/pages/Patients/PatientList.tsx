import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  UserPlus,
  MoreVertical,
  Edit2,
  Copy,
  Trash2,
  Phone,
  Briefcase,
  ChevronRight,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { calcularIdade, obterIniciaisNome } from '@/lib/utils'
import { usePacientesStore } from '@/stores/usePacientesStore'
import type { Paciente } from '@/types'
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

  return (
    <div
      className={`relative flex items-center bg-white rounded-3xl border border-brand-border shadow-card hover:shadow-card-hover hover:border-secondary-300 transition-all ${
        isDeleted ? 'opacity-50 grayscale bg-slate-50' : ''
      }`}
    >
      {/* Menu de Ações */}
      <div className="absolute top-1/2 -translate-y-1/2 right-4 z-20">
        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowMenu(!showMenu)
          }}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-brand-cream text-brand-muted hover:text-primary transition-colors"
          aria-label="Opções do paciente"
        >
          <MoreVertical size={17} />
        </button>

        {showMenu && (
          <div className="absolute right-0 top-11 w-44 bg-white rounded-2xl shadow-lg border border-brand-border py-1.5 overflow-hidden z-30">
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/novo-paciente?edit=${paciente.id}`)
              }}
              className="w-full text-left px-4 py-2.5 text-xs font-semibold text-primary hover:bg-brand-cream flex items-center gap-2.5"
            >
              <Edit2 size={14} /> Editar
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/novo-paciente?clone=${paciente.id}`)
              }}
              className="w-full text-left px-4 py-2.5 text-xs font-semibold text-primary hover:bg-brand-cream flex items-center gap-2.5"
            >
              <Copy size={14} /> Duplicar
            </button>
            {!isDeleted && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowMenu(false)
                  setShowDeleteModal(true)
                }}
                className="w-full text-left px-4 py-2.5 text-xs font-semibold text-danger hover:bg-red-50 flex items-center gap-2.5"
              >
                <Trash2 size={14} /> Excluir
              </button>
            )}
          </div>
        )}
      </div>

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
        className="w-full text-left p-5 sm:p-6 flex items-center gap-4 pr-16"
      >
        <div className="w-13 h-13 w-12 h-12 rounded-2xl bg-primary-50 text-primary flex items-center justify-center flex-shrink-0 font-bold text-base">
          {iniciais}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-primary text-base truncate">{paciente.nome}</h3>
            {isDeleted && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-danger">
                Inativo
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-brand-muted mt-1.5">
            <span>{idade} anos</span>
            {paciente.profissao && (
              <span className="inline-flex items-center gap-1">
                <Briefcase size={12} />
                {paciente.profissao}
              </span>
            )}
            {paciente.telefone && (
              <span className="inline-flex items-center gap-1">
                <Phone size={12} />
                {paciente.telefone}
              </span>
            )}
          </div>
        </div>

        <ChevronRight size={18} className="text-brand-muted hidden sm:block" />
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

  const pacientesFiltrados = pacientes.filter(
    (p) =>
      p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (p.profissao && p.profissao.toLowerCase().includes(busca.toLowerCase()))
  )

  return (
    <div className="space-y-8 animate-fade-in">
      <TopBar
        title="Pacientes"
        subtitle={`${pacientes.length} pacientes cadastrados`}
        rightSlot={
          <button
            id="btn-novo-paciente-topbar"
            onClick={() => navigate('/novo-paciente')}
            className="btn-primary"
          >
            <UserPlus size={18} />
            <span className="hidden sm:inline">Novo Paciente</span>
          </button>
        }
      />

      {/* Barra de Busca Confortável */}
      <div className="relative">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted"
          strokeWidth={2}
        />
        <input
          id="busca-pacientes"
          type="search"
          placeholder="Buscar paciente por nome ou profissão..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="input-base pl-12 py-4 rounded-2xl bg-white shadow-xs"
        />
      </div>

      {/* Lista de Pacientes */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : pacientesFiltrados.length === 0 ? (
          <div className="bg-white rounded-3xl border border-brand-border p-12 text-center space-y-3">
            <p className="text-sm font-medium text-brand-muted">
              Nenhum paciente encontrado.
            </p>
            <button
              onClick={() => navigate('/novo-paciente')}
              className="btn-secondary text-xs py-2.5 px-4"
            >
              <UserPlus size={15} />
              Cadastrar Paciente
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {pacientesFiltrados.map((p) => (
              <PatientCard key={p.id} paciente={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
