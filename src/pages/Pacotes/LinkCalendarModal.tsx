import { useEffect, useState } from 'react'
import { Link2, Loader2, Search, UserPlus, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Paciente } from '@/types'
import { linkCalendarNames } from '@/lib/pacotesApi'

interface LinkCalendarModalProps {
  isOpen: boolean
  onClose: () => void
  onLinked: (message: string) => void
  pacientes: Paciente[]
  calendarNames: string[]
  defaultPacienteId?: string | null
}

export function LinkCalendarModal({
  isOpen,
  onClose,
  onLinked,
  pacientes,
  calendarNames,
  defaultPacienteId,
}: LinkCalendarModalProps) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [selectedPacienteId, setSelectedPacienteId] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setSearch('')
    setErrorMsg('')
    setSelectedPacienteId(defaultPacienteId || '')
  }, [isOpen, defaultPacienteId])

  if (!isOpen) return null

  const filteredPacientes = pacientes
    .filter((p) => p.nome.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.nome.localeCompare(b.nome))

  const handleConfirm = async () => {
    if (!selectedPacienteId || calendarNames.length === 0) {
      setErrorMsg('Selecione o paciente único do prontuário para vincular.')
      return
    }
    setSaving(true)
    setErrorMsg('')
    try {
      await linkCalendarNames(selectedPacienteId, calendarNames)
      onLinked(
        calendarNames.length === 1
          ? `Nome "${calendarNames[0]}" vinculado ao paciente!`
          : `${calendarNames.length} nomes da agenda vinculados ao paciente!`
      )
      onClose()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao vincular paciente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-primary-900/50 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl border border-brand-border shadow-xl w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden animate-scale-in"
      >
        <div className="p-6 border-b border-brand-border flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary-50 text-primary flex items-center justify-center">
              <Link2 size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-primary">Vincular Agenda ao Paciente</h3>
              <p className="text-xs text-brand-muted">
                Relação 1 Paciente Único para {calendarNames.length} nome(s) da agenda
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-brand-cream flex items-center justify-center text-brand-muted"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
              {errorMsg}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-muted">
              Nome(s) vindo(s) do Google Calendar
            </p>
            <div className="flex flex-wrap gap-2">
              {calendarNames.map((n) => (
                <span
                  key={n}
                  className="px-3 py-1.5 rounded-xl bg-secondary-50 text-secondary-800 border border-secondary-200 text-xs font-bold"
                >
                  #{n}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-muted">
                Escolha o Paciente Único (Avaliação)
              </p>
              <button
                type="button"
                onClick={() => navigate('/novo-paciente')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-secondary-700 hover:text-primary"
              >
                <UserPlus size={14} />
                Novo Paciente
              </button>
            </div>

            <div className="relative">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-muted"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar paciente cadastrado..."
                className="input-base pl-10"
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {filteredPacientes.length === 0 ? (
                <p className="text-xs text-brand-muted text-center py-6">
                  Nenhum paciente encontrado.
                </p>
              ) : (
                filteredPacientes.map((p) => {
                  const selected = selectedPacienteId === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPacienteId(p.id)}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                        selected
                          ? 'bg-primary-50 border-primary text-primary shadow-xs'
                          : 'bg-white border-brand-border hover:border-secondary-300 text-primary'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-bold">{p.nome}</p>
                        <p className="text-xs text-brand-muted">{p.telefone}</p>
                      </div>
                      {selected && (
                        <span className="px-2.5 py-1 rounded-full bg-primary text-white text-[11px] font-bold">
                          Selecionado
                        </span>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-brand-border flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-outline py-2.5 px-5 text-xs">
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving || !selectedPacienteId}
            onClick={handleConfirm}
            className="btn-primary py-2.5 px-6 text-xs"
          >
            {saving ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Vinculando...
              </>
            ) : (
              <>
                <Link2 size={15} />
                Confirmar Vínculo
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
