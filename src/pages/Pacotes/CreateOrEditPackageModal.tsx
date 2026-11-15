import { useEffect, useMemo, useState } from 'react'
import { Calendar, CheckCircle2, Loader2, PackageCheck, X } from 'lucide-react'
import type { Paciente } from '@/types'
import {
  createPackage,
  updatePackage,
  type CalendarEventItem,
  type PackageType,
} from '@/lib/pacotesApi'
import {
  formatBRL,
  formatISODateToBR,
  type ComputedPackage,
  type ResolvedCalendarEvent,
} from './pacotesHelpers'

interface CreateOrEditPackageModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: (message: string) => void
  pacientes: Paciente[]
  allEvents: ResolvedCalendarEvent[]
  editingPackage?: ComputedPackage | null
  seedPacienteId?: string | null
  seedEvent?: ResolvedCalendarEvent | null
}

export function CreateOrEditPackageModal({
  isOpen,
  onClose,
  onSaved,
  pacientes,
  allEvents,
  editingPackage,
  seedPacienteId,
  seedEvent,
}: CreateOrEditPackageModalProps) {
  const isEditing = Boolean(editingPackage)

  const [pacienteId, setPacienteId] = useState('')
  const [packageType, setPackageType] = useState<PackageType>('10')
  const [customTotal, setCustomTotal] = useState('8')
  const [sessionPrice, setSessionPrice] = useState('')
  const [label, setLabel] = useState('')
  const [hasStartDate, setHasStartDate] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [startingSessionNumber, setStartingSessionNumber] = useState(1)
  const [selectedPriorEventIds, setSelectedPriorEventIds] = useState<Set<string>>(new Set())
  const [isPaid, setIsPaid] = useState(false)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const effectiveTotalSessions = useMemo(() => {
    if (packageType === 'individual') return 1
    if (packageType === '5') return 5
    if (packageType === '10') return 10
    const parsed = parseInt(customTotal, 10)
    return isNaN(parsed) || parsed < 1 ? 1 : parsed
  }, [packageType, customTotal])

  // Atendimentos anteriores livres do paciente selecionado (para quando iniciar na sessão X > 1)
  const availablePriorEvents = useMemo(() => {
    if (!pacienteId || isEditing) return []
    const refDate = seedEvent?.date || startDate
    if (!refDate) return []
    return allEvents
      .filter(
        (ev) =>
          ev.pacienteId === pacienteId &&
          !ev.sessionRecord &&
          ev.eventId !== seedEvent?.eventId &&
          ev.date <= refDate
      )
      .sort((a, b) => b.eventDatetime.localeCompare(a.eventDatetime))
  }, [pacienteId, isEditing, seedEvent, startDate, allEvents])

  // Datas sugeridas da agenda para ajudar a definir data de início (ao editar pacote sem início)
  const suggestedDates = useMemo(() => {
    if (!pacienteId) return []
    const seen = new Set<string>()
    return allEvents
      .filter((ev) => ev.pacienteId === pacienteId && !ev.sessionRecord)
      .filter((ev) => {
        if (seen.has(ev.date)) return false
        seen.add(ev.date)
        return true
      })
      .slice(0, 8)
  }, [pacienteId, allEvents])

  useEffect(() => {
    if (!isOpen) return
    setErrorMsg('')

    if (editingPackage) {
      const p = editingPackage.pkg
      setPacienteId(p.paciente_id)
      setPackageType(p.package_type)
      setCustomTotal(String(p.total_sessions))
      setSessionPrice(p.session_price ? String(p.session_price) : '')
      setLabel(p.label || '')
      setHasStartDate(Boolean(p.start_date))
      setStartDate(p.start_date || '')
      setStartingSessionNumber((p.initial_offset || 0) + 1)
      setSelectedPriorEventIds(new Set())
      setIsPaid(Boolean(p.is_paid))
      setNotes(p.notes || '')
      return
    }

    const initialPacId = seedEvent?.pacienteId || seedPacienteId || pacientes[0]?.id || ''
    setPacienteId(initialPacId)
    setPackageType('10')
    setCustomTotal('8')
    setSessionPrice('')
    setLabel('')
    setHasStartDate(Boolean(seedEvent) || true)
    setStartDate(seedEvent?.date || '')
    setStartingSessionNumber(1)
    setSelectedPriorEventIds(new Set())
    setIsPaid(false)
    setNotes('')
  }, [isOpen, editingPackage, seedEvent, seedPacienteId, pacientes])

  // Quando usuário muda startingSessionNumber > 1, pré-seleciona automaticamente até (X - 1) atendimentos anteriores
  useEffect(() => {
    if (isEditing || startingSessionNumber <= 1) {
      setSelectedPriorEventIds(new Set())
      return
    }
    const needed = Math.max(0, startingSessionNumber - 1)
    const autoIds = availablePriorEvents.slice(0, needed).map((e) => e.eventId)
    setSelectedPriorEventIds(new Set(autoIds))
  }, [startingSessionNumber, availablePriorEvents, isEditing])

  if (!isOpen) return null

  const togglePriorEvent = (eventId: string) => {
    setSelectedPriorEventIds((prev) => {
      const next = new Set(prev)
      if (next.has(eventId)) next.delete(eventId)
      else next.add(eventId)
      return next
    })
  }

  const priorCountNeeded = Math.max(0, startingSessionNumber - 1)
  const selectedPriorList = availablePriorEvents.filter((e) => selectedPriorEventIds.has(e.eventId))
  const computedInitialOffset = isEditing
    ? Math.max(0, startingSessionNumber - 1)
    : Math.max(0, priorCountNeeded - selectedPriorList.length)

  const priceNum = parseFloat(sessionPrice.replace(',', '.')) || 0
  const totalPackageValue = effectiveTotalSessions * priceNum

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pacienteId) {
      setErrorMsg('Selecione o paciente.')
      return
    }
    if (hasStartDate && !startDate && !seedEvent) {
      setErrorMsg('Informe a data de início ou marque a opção para definir depois.')
      return
    }

    setSaving(true)
    setErrorMsg('')
    try {
      if (isEditing && editingPackage) {
        await updatePackage(editingPackage.pkg.id, {
          package_type: packageType,
          total_sessions: effectiveTotalSessions,
          session_price: priceNum,
          start_date: hasStartDate ? startDate || null : null,
          initial_offset: Math.max(0, startingSessionNumber - 1),
          label: label.trim() || null,
          is_paid: isPaid,
          notes: notes.trim() || null,
        })
        onSaved('Pacote atualizado com sucesso!')
      } else {
        const attachEvents: CalendarEventItem[] = []
        if (hasStartDate) {
          for (const ev of selectedPriorList) {
            attachEvents.push(ev)
          }
          if (seedEvent) {
            attachEvents.push(seedEvent)
          }
        }
        attachEvents.sort((a, b) => a.eventDatetime.localeCompare(b.eventDatetime))

        const finalStartDate = !hasStartDate
          ? null
          : attachEvents.length > 0
            ? attachEvents[0].date
            : startDate || null

        await createPackage({
          paciente_id: pacienteId,
          package_type: packageType,
          total_sessions: effectiveTotalSessions,
          session_price: priceNum,
          start_date: finalStartDate,
          initial_offset: hasStartDate ? computedInitialOffset : Math.max(0, startingSessionNumber - 1),
          label: label.trim() || undefined,
          is_paid: isPaid,
          notes: notes.trim() || undefined,
          attach_events: attachEvents,
        })
        onSaved('Pacote criado com sucesso!')
      }
      onClose()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar pacote.')
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
        className="bg-white rounded-3xl border border-brand-border shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in"
      >
        <div className="p-6 border-b border-brand-border flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-secondary-50 text-secondary-700 flex items-center justify-center">
              <PackageCheck size={22} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-primary">
                {isEditing ? 'Configurar Pacote' : 'Novo Pacote'}
              </h3>
              <p className="text-xs text-brand-muted">
                {seedEvent
                  ? `A partir do atendimento de ${seedEvent.displayDate} (${seedEvent.rawSummary})`
                  : 'Defina quantidade, valor por sessão e data de início'}
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

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
              {errorMsg}
            </div>
          )}

          {/* Paciente Único */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-brand-muted">
              Paciente Único (Prontuário) *
            </label>
            <select
              value={pacienteId}
              onChange={(e) => setPacienteId(e.target.value)}
              disabled={isEditing}
              className="input-base"
              required
            >
              <option value="">Selecione um paciente...</option>
              {pacientes
                .slice()
                .sort((a, b) => a.nome.localeCompare(b.nome))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
            </select>
          </div>

          {/* Tipo de Pacote */}
          <div className="space-y-2.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-brand-muted">
              Tipo de Pacote
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {(
                [
                  { id: '5', title: '5 Sessões' },
                  { id: '10', title: '10 Sessões' },
                  { id: 'individual', title: 'Individual' },
                  { id: 'personalizado', title: 'Personalizado' },
                ] as { id: PackageType; title: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPackageType(opt.id)}
                  className={`py-3 px-3 rounded-2xl border text-xs font-bold transition-all ${
                    packageType === opt.id
                      ? 'bg-primary text-white border-primary shadow-xs'
                      : 'bg-white text-primary border-brand-border hover:border-secondary-400'
                  }`}
                >
                  {opt.title}
                </button>
              ))}
            </div>

            {packageType === 'personalizado' && (
              <div className="pt-2">
                <label className="block text-xs font-medium text-brand-muted mb-1">
                  Quantidade de sessões do pacote personalizado
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={customTotal}
                  onChange={(e) => setCustomTotal(e.target.value)}
                  className="input-base w-40"
                />
              </div>
            )}
          </div>

          {/* Valor da sessão + Rótulo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-brand-muted">
                Valor por Sessão (para relatório)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-brand-muted">
                  R$
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={sessionPrice}
                  onChange={(e) => setSessionPrice(e.target.value)}
                  className="input-base pl-11"
                />
              </div>
              {priceNum > 0 && (
                <p className="text-[11px] font-semibold text-secondary-700">
                  Total do pacote ({effectiveTotalSessions}x): {formatBRL(totalPackageValue)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-brand-muted">
                Identificação (opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: 5º Pacote, Pós-operatório..."
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="input-base"
              />
            </div>
          </div>

          {/* Data de Início */}
          <div className="p-4 rounded-2xl bg-brand-offwhite border border-brand-border space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Calendar size={17} className="text-secondary-700" />
                <span className="text-sm font-bold text-primary">Início na Agenda</span>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-brand-body cursor-pointer">
                <input
                  type="checkbox"
                  checked={!hasStartDate}
                  onChange={(e) => setHasStartDate(!e.target.checked)}
                  className="w-4 h-4 accent-primary rounded"
                />
                Definir depois (deixar alerta)
              </label>
            </div>

            {hasStartDate ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-brand-muted mb-1.5">
                      {seedEvent ? 'Data deste atendimento' : 'Data de início do pacote'}
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="input-base bg-white"
                    />
                  </div>

                  {effectiveTotalSessions > 1 && (
                    <div>
                      <label className="block text-xs font-medium text-brand-muted mb-1.5">
                        {isEditing
                          ? 'Sessões já feitas antes da agenda'
                          : 'Este dia já é qual sessão?'}
                      </label>
                      {isEditing ? (
                        <input
                          type="number"
                          min={0}
                          max={effectiveTotalSessions - 1}
                          value={Math.max(0, startingSessionNumber - 1)}
                          onChange={(e) =>
                            setStartingSessionNumber(
                              Math.max(1, (parseInt(e.target.value, 10) || 0) + 1)
                            )
                          }
                          className="input-base bg-white"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            max={effectiveTotalSessions}
                            value={startingSessionNumber}
                            onChange={(e) =>
                              setStartingSessionNumber(
                                Math.min(
                                  effectiveTotalSessions,
                                  Math.max(1, parseInt(e.target.value, 10) || 1)
                                )
                              )
                            }
                            className="input-base bg-white w-24 text-center font-bold"
                          />
                          <span className="text-xs font-semibold text-brand-muted">
                            de {effectiveTotalSessions}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Sugestões rápidas de data da agenda quando está definindo início */}
                {!seedEvent && suggestedDates.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold text-brand-muted">
                      Atendimentos livres deste paciente na agenda (clique para usar como início):
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestedDates.map((ev) => (
                        <button
                          key={ev.eventId}
                          type="button"
                          onClick={() => setStartDate(ev.date)}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition-colors ${
                            startDate === ev.date
                              ? 'bg-secondary-600 text-white border-secondary-600'
                              : 'bg-white text-primary border-brand-border hover:border-secondary-400'
                          }`}
                        >
                          {ev.displayDate}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Seleção de atendimentos anteriores quando inicia na sessão X > 1 */}
                {!isEditing && startingSessionNumber > 1 && (
                  <div className="p-3.5 rounded-2xl bg-white border border-secondary-200 space-y-2.5">
                    <p className="text-xs font-bold text-primary">
                      Sessões anteriores para completar até a {startingSessionNumber}ª de{' '}
                      {effectiveTotalSessions}:
                    </p>
                    {availablePriorEvents.length > 0 ? (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {availablePriorEvents.map((ev) => {
                          const checked = selectedPriorEventIds.has(ev.eventId)
                          return (
                            <label
                              key={ev.eventId}
                              className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                                checked
                                  ? 'bg-secondary-50/70 border-secondary-300 text-primary'
                                  : 'bg-brand-offwhite border-brand-border text-brand-body'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => togglePriorEvent(ev.eventId)}
                                  className="w-4 h-4 accent-secondary-600 rounded"
                                />
                                <span className="font-semibold">{ev.displayDate}</span>
                                <span className="text-brand-muted">({ev.weekday})</span>
                              </div>
                              <span className="text-[11px] text-brand-muted truncate max-w-[160px]">
                                {ev.rawSummary}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-brand-muted">
                        Nenhum atendimento anterior livre foi encontrado nesta janela da agenda.
                      </p>
                    )}

                    <p className="text-[11px] text-secondary-700 font-medium">
                      {selectedPriorList.length} sessão(ões) da agenda vinculada(s) +{' '}
                      {computedInitialOffset} sessão(ões) anterior(es) no histórico inicial
                      {seedEvent ? ` + ${formatISODateToBR(seedEvent.date)} como sessão ${startingSessionNumber}/${effectiveTotalSessions}.` : '.'}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-amber-700 font-medium">
                Este pacote ficará salvo com alerta pendente até você escolher a data de início na agenda.
              </p>
            )}
          </div>

          {/* Pago + Observações */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <label className="inline-flex items-center gap-2.5 text-xs font-semibold text-primary cursor-pointer">
              <input
                type="checkbox"
                checked={isPaid}
                onChange={(e) => setIsPaid(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 rounded"
              />
              Pacote já marcado como Pago
            </label>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-brand-muted">
              Observações (opcional)
            </label>
            <textarea
              rows={2}
              placeholder="Anotações sobre o pacote..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-base resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-brand-border">
            <button type="button" onClick={onClose} className="btn-outline py-3 px-5 text-xs">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn-primary py-3 px-6 text-xs">
              {saving ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} />
                  {isEditing ? 'Salvar Alterações' : 'Criar Pacote'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
