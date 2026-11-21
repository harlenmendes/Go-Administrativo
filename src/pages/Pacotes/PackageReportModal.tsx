import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRightLeft,
  CalendarPlus,
  CalendarRange,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  Pencil,
  Trash2,
  Unlink,
  UserCheck,
  X,
} from 'lucide-react'
import { exportarProntuarioParaPDF } from '@/lib/exportPdf'
import {
  assignSessionToPackage,
  detachSessionFromPackage,
  moveSessionToPackage,
  updatePackage,
} from '@/lib/pacotesApi'
import type { Paciente } from '@/types'
import {
  formatBRL,
  formatISODateToBR,
  getPackageTypeLabel,
  type ComputedPackage,
  type ComputedSessionItem,
  type ResolvedCalendarEvent,
} from './pacotesHelpers'

interface PackageReportModalProps {
  isOpen: boolean
  onClose: () => void
  onChanged: (message: string) => void
  computedPkg: ComputedPackage | null
  otherPatientPackages: ComputedPackage[]
  allActivePackages: ComputedPackage[]
  pacientes: Paciente[]
  patientPendingAndLegacyEvents: ResolvedCalendarEvent[]
  linkedCalendarNames: string[]
  onOpenAgendaPicker: (replacingSession: ComputedSessionItem | null) => void
  onEditPackage: (cp: ComputedPackage) => void
  onDeletePackage: (cp: ComputedPackage) => void
}

export function PackageReportModal({
  isOpen,
  onClose,
  onChanged,
  computedPkg,
  otherPatientPackages,
  allActivePackages,
  pacientes,
  patientPendingAndLegacyEvents,
  linkedCalendarNames,
  onOpenAgendaPicker,
  onEditPackage,
  onDeletePackage,
}: PackageReportModalProps) {
  const [busyEventId, setBusyEventId] = useState<string | null>(null)
  const [movingEventId, setMovingEventId] = useState<string | null>(null)
  const [exportingPdf, setExportingPdf] = useState(false)

  // Controle de vínculo do Paciente Único do pacote
  const [showPatientSwitch, setShowPatientSwitch] = useState(false)
  const [selectedPacienteId, setSelectedPacienteId] = useState('')
  const [clearSessionsOnChange, setClearSessionsOnChange] = useState(true)
  const [savingOwner, setSavingOwner] = useState(false)
  const [togglingPaid, setTogglingPaid] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !computedPkg) return
    setShowPatientSwitch(false)
    setSelectedPacienteId(computedPkg.pkg.paciente_id || '')
    setClearSessionsOnChange(true)
    setMovingEventId(null)
    setActionError(null)
  }, [isOpen, computedPkg])

  const linkedLowerSet = useMemo(
    () => new Set(linkedCalendarNames.map((n) => n.toLowerCase().trim())),
    [linkedCalendarNames]
  )

  const otherPatientsPackages = useMemo(() => {
    if (!computedPkg) return []
    const sameIds = new Set(otherPatientPackages.map((o) => o.pkg.id))
    return allActivePackages.filter(
      (cp) =>
        cp.pkg.id !== computedPkg.pkg.id &&
        !sameIds.has(cp.pkg.id) &&
        cp.pkg.status !== 'cancelled'
    )
  }, [allActivePackages, otherPatientPackages, computedPkg])

  if (!isOpen || !computedPkg) return null

  const {
    pkg,
    paciente,
    sessions,
    usedTotal,
    completedCount,
    scheduledFutureCount,
    remainingCount,
    effectiveSessionPrice,
    totalValue,
  } = computedPkg

  const progressPct = Math.min(100, Math.round((usedTotal / pkg.total_sessions) * 100))

  const handleDetach = async (eventId: string, eventDate: string, summary: string) => {
    if (
      !confirm(
        `Tirar o atendimento de ${formatISODateToBR(eventDate)} deste pacote?\nEle voltará para a fila de pendentes e todo o pacote será recalculado.`
      )
    ) {
      return
    }
    setBusyEventId(eventId)
    setActionError(null)
    try {
      await detachSessionFromPackage({
        calendar_event_id: eventId,
        paciente_id: pkg.paciente_id,
        event_date: eventDate,
        calendar_summary: summary,
      })
      onChanged('Sessão removida do pacote e deixada como pendente.')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao remover sessão.')
    } finally {
      setBusyEventId(null)
    }
  }

  const handleMove = async (eventId: string, targetPkgId: string) => {
    if (!targetPkgId) return
    setBusyEventId(eventId)
    setActionError(null)
    try {
      await moveSessionToPackage(eventId, targetPkgId)
      setMovingEventId(null)
      onChanged('Sessão movida para o pacote selecionado e contagem recalculada!')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao mover sessão.')
    } finally {
      setBusyEventId(null)
    }
  }

  const handleAssignEvent = async (ev: ResolvedCalendarEvent) => {
    if (
      !confirm(
        `Vincular o atendimento de ${ev.displayDate} (${ev.rawSummary}) a este pacote de ${
          paciente?.nome || 'sem titular'
        }?`
      )
    ) {
      return
    }
    setBusyEventId(ev.eventId)
    setActionError(null)
    try {
      await assignSessionToPackage(pkg.id, ev)
      onChanged(`Atendimento de ${ev.displayDate} vinculado ao pacote!`)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao vincular sessão.')
    } finally {
      setBusyEventId(null)
    }
  }

  const handleUnlinkOwner = async () => {
    const sessMsg =
      sessions.length > 0 && clearSessionsOnChange
        ? `\nAs ${sessions.length} sessão(ões) vinculada(s) serão liberadas para a fila pendente.`
        : ''
    if (
      !confirm(
        `Desvincular ${paciente?.nome || 'este paciente'} deste pacote?${sessMsg}\nO pacote continuará salvo aguardando um paciente.`
      )
    ) {
      return
    }
    setSavingOwner(true)
    setActionError(null)
    try {
      await updatePackage(pkg.id, {
        paciente_id: null,
        clear_sessions: sessions.length > 0 && clearSessionsOnChange,
      })
      setShowPatientSwitch(false)
      onChanged('Paciente desvinculado do pacote.')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao desvincular paciente.')
    } finally {
      setSavingOwner(false)
    }
  }

  const handleSaveNewOwner = async () => {
    if (!selectedPacienteId) {
      await handleUnlinkOwner()
      return
    }
    if (selectedPacienteId === pkg.paciente_id) {
      setShowPatientSwitch(false)
      return
    }
    setSavingOwner(true)
    setActionError(null)
    try {
      await updatePackage(pkg.id, {
        paciente_id: selectedPacienteId,
        clear_sessions: sessions.length > 0 && clearSessionsOnChange,
      })
      setShowPatientSwitch(false)
      onChanged('Paciente do pacote atualizado com sucesso!')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao alterar paciente.')
    } finally {
      setSavingOwner(false)
    }
  }

  const handleTogglePaid = async () => {
    setTogglingPaid(true)
    setActionError(null)
    try {
      await updatePackage(pkg.id, { is_paid: !pkg.is_paid })
      onChanged(!pkg.is_paid ? 'Pacote marcado como pago.' : 'Pagamento marcado como em aberto.')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao atualizar pagamento.')
    } finally {
      setTogglingPaid(false)
    }
  }

  const handleExportPdf = async () => {
    setExportingPdf(true)
    try {
      await exportarProntuarioParaPDF(
        'pacote-report-printable',
        paciente?.nome || 'Pacote_Sem_Paciente',
        'Relatorio_Pacote'
      )
    } finally {
      setExportingPdf(false)
    }
  }

  const hasOwnerChange = selectedPacienteId !== (pkg.paciente_id || '')

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-primary-900/50 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl border border-brand-border shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-scale-in"
      >
        {/* Top Bar do Modal */}
        <div className="p-6 border-b border-brand-border flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-secondary-700">
              Relatório &amp; Sessões do Pacote
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <h3 className="text-xl font-bold text-primary truncate">
                {paciente?.nome || 'Sem paciente vinculado'}
              </h3>
              {!pkg.paciente_id && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                  Aguardando paciente
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenAgendaPicker(null)}
              className="btn-primary py-2 px-3.5 text-xs"
              title="Abrir agenda semanal para vincular atendimentos (inclusive de familiar/outra pessoa)"
            >
              <CalendarRange size={14} />
              Vincular da Agenda
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exportingPdf}
              className="btn-outline py-2 px-3.5 text-xs"
            >
              {exportingPdf ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Download size={15} />
              )}
              PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl hover:bg-brand-cream flex items-center justify-center text-brand-muted"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Barra de ações rápidas do pacote */}
        <div className="px-6 py-3 border-b border-brand-border bg-brand-offwhite/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPatientSwitch((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-brand-border hover:border-secondary-400 text-primary text-xs font-semibold transition-colors"
            >
              {pkg.paciente_id ? <Unlink size={13} /> : <UserCheck size={13} />}
              {pkg.paciente_id ? 'Trocar / Desvincular Paciente' : 'Vincular Paciente Único'}
            </button>

            <button
              type="button"
              disabled={togglingPaid}
              onClick={handleTogglePaid}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                pkg.is_paid
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-white border-brand-border text-brand-body hover:border-secondary-400'
              }`}
            >
              <CheckCircle2 size={13} />
              {pkg.is_paid ? 'Pago' : 'Marcar como Pago'}
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                onClose()
                onEditPackage(computedPkg)
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-brand-border hover:bg-brand-cream text-primary text-xs font-semibold"
            >
              <Pencil size={13} />
              Editar
            </button>
            <button
              type="button"
              onClick={() => {
                onClose()
                onDeletePackage(computedPkg)
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 text-xs font-semibold"
            >
              <Trash2 size={13} />
              Excluir Pacote
            </button>
          </div>
        </div>

        {/* Painel inline de troca / desvinculação do Paciente Único */}
        {showPatientSwitch && (
          <div className="px-6 py-4 border-b border-amber-200 bg-amber-50/70 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-primary">
                Alterar ou desvincular Paciente Único deste pacote
              </p>
              <button
                type="button"
                onClick={() => setShowPatientSwitch(false)}
                className="text-brand-muted hover:text-primary"
              >
                <X size={15} />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <select
                value={selectedPacienteId}
                onChange={(e) => setSelectedPacienteId(e.target.value)}
                className="input-base bg-white flex-1 py-2 text-xs"
              >
                <option value="">— Sem paciente vinculado —</option>
                {pacientes
                  .slice()
                  .sort((a, b) => a.nome.localeCompare(b.nome))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
              </select>

              <button
                type="button"
                disabled={savingOwner || !hasOwnerChange}
                onClick={handleSaveNewOwner}
                className="btn-primary py-2 px-4 text-xs disabled:opacity-50"
              >
                {savingOwner ? 'Salvando...' : 'Aplicar Paciente'}
              </button>

              {pkg.paciente_id && (
                <button
                  type="button"
                  disabled={savingOwner}
                  onClick={handleUnlinkOwner}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
                >
                  <Unlink size={13} />
                  Desvincular Paciente
                </button>
              )}
            </div>

            {sessions.length > 0 && (
              <label className="inline-flex items-center gap-2 text-xs font-medium text-amber-950 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearSessionsOnChange}
                  onChange={(e) => setClearSessionsOnChange(e.target.checked)}
                  className="w-4 h-4 accent-primary rounded"
                />
                Liberar as {sessions.length} sessão(ões) vinculadas da agenda ao trocar/desvincular
              </label>
            )}
          </div>
        )}

        {/* Corpo Exportável */}
        <div id="pacote-report-printable" className="p-6 overflow-y-auto space-y-6 bg-white">
          {actionError && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
              {actionError}
            </div>
          )}

          {/* Resumo do Pacote */}
          <div className="rounded-3xl bg-brand-offwhite border border-brand-border p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-bold text-primary">
                    {getPackageTypeLabel(pkg.package_type, pkg.total_sessions)}
                  </span>
                  {pkg.label && (
                    <span className="px-2.5 py-0.5 rounded-full bg-primary-50 text-primary text-xs font-semibold">
                      {pkg.label}
                    </span>
                  )}
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      pkg.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-secondary-50 text-secondary-700'
                    }`}
                  >
                    {pkg.status === 'completed' ? 'Concluído' : 'Em andamento'}
                  </span>
                </div>
                <p className="text-xs text-brand-muted mt-1">
                  Titular: <strong className="text-primary">{paciente?.nome || 'Sem paciente'}</strong> · Início:{' '}
                  <strong className="text-primary">{formatISODateToBR(pkg.start_date)}</strong>
                  {linkedCalendarNames.length > 0 && (
                    <> · Nomes na agenda: {linkedCalendarNames.map((n) => `#${n}`).join(', ')}</>
                  )}
                </p>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-xs text-brand-muted">
                  Sessão: <strong className="text-primary">{formatBRL(effectiveSessionPrice)}</strong>
                </p>
                <p className="text-base font-bold text-primary">
                  Total: {formatBRL(totalValue)}
                </p>
                <p className="text-[11px] font-semibold text-brand-muted mt-0.5">
                  {pkg.is_paid ? 'Pago' : 'Pagamento em aberto'}
                </p>
              </div>
            </div>

            {/* Barra de Progresso */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-primary">
                  {usedTotal} de {pkg.total_sessions} sessões alocadas ({completedCount} realizadas
                  {scheduledFutureCount > 0 ? ` + ${scheduledFutureCount} agendadas` : ''})
                </span>
                <span className="text-secondary-700">
                  {remainingCount} {remainingCount === 1 ? 'vaga restante' : 'vagas restantes'}
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-white border border-brand-border overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    pkg.status === 'completed' ? 'bg-emerald-500' : 'bg-secondary-600'
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Lista de Sessões */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-widest text-brand-muted">
                Sessões Registradas no Pacote
              </h4>
              <button
                type="button"
                onClick={() => onOpenAgendaPicker(null)}
                className="text-xs font-bold text-secondary-700 hover:text-primary inline-flex items-center gap-1"
              >
                <CalendarPlus size={13} />
                + Incluir pela Agenda
              </button>
            </div>

            {pkg.initial_offset > 0 && (
              <div className="p-4 rounded-2xl bg-brand-cream/70 border border-brand-border flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-primary">
                    Sessões 1 a {pkg.initial_offset} de {pkg.total_sessions}
                  </span>
                  <p className="text-brand-muted mt-0.5">
                    Sessões anteriores já realizadas antes do início vinculado nesta janela da agenda.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                  <CheckCircle2 size={12} />
                  Histórico
                </span>
              </div>
            )}

            {sessions.length === 0 ? (
              <div className="p-8 rounded-2xl border border-dashed border-brand-border text-center space-y-3">
                <p className="text-sm text-brand-muted">
                  Nenhuma sessão da agenda vinculada a este pacote ainda.
                </p>
                <button
                  type="button"
                  onClick={() => onOpenAgendaPicker(null)}
                  className="btn-secondary py-2 px-4 text-xs inline-flex"
                >
                  <CalendarRange size={14} />
                  Abrir Agenda para Vincular
                </button>
              </div>
            ) : (
              <div className="border border-brand-border rounded-2xl overflow-hidden divide-y divide-brand-border">
                {sessions.map((s) => {
                  const isBusy = busyEventId === s.calendar_event_id
                  const isMoving = movingEventId === s.calendar_event_id
                  const isThirdParty =
                    linkedLowerSet.size > 0 &&
                    !linkedLowerSet.has((s.calendar_name || '').toLowerCase().trim())

                  return (
                    <div
                      key={s.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-brand-offwhite/60 transition-colors"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-primary-50 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {s.sessionNumber}/{pkg.total_sessions}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-primary">
                              {s.displayDate}
                            </span>
                            {s.isCompleted ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700">
                                <CheckCircle2 size={11} />
                                Realizada
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700">
                                <Clock size={11} />
                                Agendada
                              </span>
                            )}
                            {isThirdParty && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                Outro nome
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-brand-muted truncate mt-0.5">
                            {s.calendar_summary}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => onOpenAgendaPicker(s)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-secondary-50 hover:bg-secondary-100 text-secondary-800 text-xs font-semibold transition-colors"
                          title="Abrir visualizador da agenda para trocar este vínculo por outro atendimento"
                        >
                          <CalendarRange size={13} />
                          Mudar vínculo
                        </button>

                        {(otherPatientPackages.length > 0 || otherPatientsPackages.length > 0) &&
                          (isMoving ? (
                            <div className="flex items-center gap-1.5">
                              <select
                                defaultValue=""
                                onChange={(e) => {
                                  if (e.target.value) handleMove(s.calendar_event_id, e.target.value)
                                }}
                                disabled={isBusy}
                                className="px-2.5 py-1.5 rounded-xl border border-secondary text-xs font-semibold text-primary bg-white max-w-[200px]"
                              >
                                <option value="">Escolher pacote...</option>
                                {otherPatientPackages.length > 0 && (
                                  <optgroup label="Mesmo paciente">
                                    {otherPatientPackages.map((op) => (
                                      <option key={op.pkg.id} value={op.pkg.id}>
                                        {getPackageTypeLabel(op.pkg.package_type, op.pkg.total_sessions)} (
                                        {op.usedTotal}/{op.pkg.total_sessions})
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                                {otherPatientsPackages.length > 0 && (
                                  <optgroup label="Outros pacientes">
                                    {otherPatientsPackages.map((op) => (
                                      <option key={op.pkg.id} value={op.pkg.id}>
                                        {op.paciente?.nome || 'Sem paciente'} ·{' '}
                                        {getPackageTypeLabel(op.pkg.package_type, op.pkg.total_sessions)} (
                                        {op.usedTotal}/{op.pkg.total_sessions})
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                              </select>
                              <button
                                type="button"
                                onClick={() => setMovingEventId(null)}
                                className="p-1.5 rounded-lg text-brand-muted hover:text-primary"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => setMovingEventId(s.calendar_event_id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-brand-cream hover:bg-primary-50 text-primary text-xs font-semibold transition-colors"
                              title="Mover esta sessão para outro pacote"
                            >
                              <ArrowRightLeft size={13} />
                              Mover
                            </button>
                          ))}

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            handleDetach(s.calendar_event_id, s.event_date, s.calendar_summary)
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition-colors"
                          title="Excluir sessão do pacote e deixar o dia pendente"
                        >
                          {isBusy ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Trash2 size={13} />
                          )}
                          Excluir
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Sessões livres / pendentes deste paciente para vincular manualmente */}
          {patientPendingAndLegacyEvents.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-brand-border">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-widest text-brand-muted">
                  Vincular Atendimento Livre do Titular a Este Pacote
                </h4>
                <button
                  type="button"
                  onClick={() => onOpenAgendaPicker(null)}
                  className="text-xs font-semibold text-secondary-700 hover:text-primary"
                >
                  Buscar em outra semana ou outra pessoa →
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {patientPendingAndLegacyEvents.map((ev) => (
                  <button
                    key={ev.eventId}
                    type="button"
                    disabled={busyEventId === ev.eventId}
                    onClick={() => handleAssignEvent(ev)}
                    className="p-3 rounded-2xl border border-brand-border hover:border-secondary-400 bg-brand-offwhite hover:bg-secondary-50/50 text-left flex items-center justify-between gap-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-primary">
                        {ev.displayDate} · {ev.startTime}
                      </p>
                      <p className="text-[11px] text-brand-muted truncate">{ev.rawSummary}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white border border-brand-border text-[11px] font-bold text-secondary-700 flex-shrink-0">
                      <CalendarPlus size={12} />
                      Incluir
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
