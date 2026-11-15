import { useState } from 'react'
import {
  ArrowRightLeft,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  Trash2,
  X,
} from 'lucide-react'
import { exportarProntuarioParaPDF } from '@/lib/exportPdf'
import {
  assignSessionToPackage,
  detachSessionFromPackage,
  moveSessionToPackage,
} from '@/lib/pacotesApi'
import {
  formatBRL,
  formatISODateToBR,
  getPackageTypeLabel,
  type ComputedPackage,
  type ResolvedCalendarEvent,
} from './pacotesHelpers'

interface PackageReportModalProps {
  isOpen: boolean
  onClose: () => void
  onChanged: (message: string) => void
  computedPkg: ComputedPackage | null
  otherPatientPackages: ComputedPackage[]
  patientPendingAndLegacyEvents: ResolvedCalendarEvent[]
  linkedCalendarNames: string[]
}

export function PackageReportModal({
  isOpen,
  onClose,
  onChanged,
  computedPkg,
  otherPatientPackages,
  patientPendingAndLegacyEvents,
  linkedCalendarNames,
}: PackageReportModalProps) {
  const [busyEventId, setBusyEventId] = useState<string | null>(null)
  const [movingEventId, setMovingEventId] = useState<string | null>(null)
  const [exportingPdf, setExportingPdf] = useState(false)

  if (!isOpen || !computedPkg) return null

  const { pkg, paciente, sessions, usedTotal, completedCount, scheduledFutureCount, remainingCount, totalValue } =
    computedPkg

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
    try {
      await detachSessionFromPackage({
        calendar_event_id: eventId,
        paciente_id: pkg.paciente_id,
        event_date: eventDate,
        calendar_summary: summary,
      })
      onChanged('Sessão removida do pacote e deixada como pendente.')
    } finally {
      setBusyEventId(null)
    }
  }

  const handleMove = async (eventId: string, targetPkgId: string) => {
    if (!targetPkgId) return
    setBusyEventId(eventId)
    try {
      await moveSessionToPackage(eventId, targetPkgId)
      setMovingEventId(null)
      onChanged('Sessão movida para o pacote selecionado e contagem recalculada!')
    } finally {
      setBusyEventId(null)
    }
  }

  const handleAssignEvent = async (ev: ResolvedCalendarEvent) => {
    setBusyEventId(ev.eventId)
    try {
      await assignSessionToPackage(pkg.id, ev)
      onChanged(`Atendimento de ${ev.displayDate} vinculado ao pacote!`)
    } finally {
      setBusyEventId(null)
    }
  }

  const handleExportPdf = async () => {
    setExportingPdf(true)
    try {
      await exportarProntuarioParaPDF(
        'pacote-report-printable',
        paciente?.nome || 'Paciente',
        'Relatorio_Pacote'
      )
    } finally {
      setExportingPdf(false)
    }
  }

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
        <div className="p-6 border-b border-brand-border flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-secondary-700">
              Relatório &amp; Sessões do Pacote
            </p>
            <h3 className="text-xl font-bold text-primary">
              {paciente?.nome || 'Paciente'}
            </h3>
          </div>

          <div className="flex items-center gap-2.5">
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

        {/* Corpo Exportável */}
        <div id="pacote-report-printable" className="p-6 overflow-y-auto space-y-6 bg-white">
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
                  Início: <strong className="text-primary">{formatISODateToBR(pkg.start_date)}</strong>
                  {linkedCalendarNames.length > 0 && (
                    <> · Nomes na agenda: {linkedCalendarNames.map((n) => `#${n}`).join(', ')}</>
                  )}
                </p>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-xs text-brand-muted">
                  Sessão: <strong className="text-primary">{formatBRL(pkg.session_price)}</strong>
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
            <h4 className="text-xs font-semibold uppercase tracking-widest text-brand-muted">
              Sessões Registradas no Pacote
            </h4>

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
              <div className="p-8 rounded-2xl border border-dashed border-brand-border text-center text-sm text-brand-muted">
                Nenhuma sessão da agenda vinculada a este pacote ainda.
              </div>
            ) : (
              <div className="border border-brand-border rounded-2xl overflow-hidden divide-y divide-brand-border">
                {sessions.map((s) => {
                  const isBusy = busyEventId === s.calendar_event_id
                  const isMoving = movingEventId === s.calendar_event_id

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
                          </div>
                          <p className="text-xs text-brand-muted truncate mt-0.5">
                            {s.calendar_summary}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {otherPatientPackages.length > 0 && (
                          isMoving ? (
                            <div className="flex items-center gap-1.5">
                              <select
                                defaultValue=""
                                onChange={(e) => {
                                  if (e.target.value) handleMove(s.calendar_event_id, e.target.value)
                                }}
                                disabled={isBusy}
                                className="px-2.5 py-1.5 rounded-xl border border-secondary text-xs font-semibold text-primary bg-white"
                              >
                                <option value="">Escolher pacote...</option>
                                {otherPatientPackages.map((op) => (
                                  <option key={op.pkg.id} value={op.pkg.id}>
                                    {getPackageTypeLabel(op.pkg.package_type, op.pkg.total_sessions)} (
                                    {op.usedTotal}/{op.pkg.total_sessions})
                                  </option>
                                ))}
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
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-brand-cream hover:bg-primary-50 text-primary text-xs font-semibold transition-colors"
                              title="Mudar esta sessão para outro pacote"
                            >
                              <ArrowRightLeft size={13} />
                              Mudar
                            </button>
                          )
                        )}

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            handleDetach(s.calendar_event_id, s.event_date, s.calendar_summary)
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition-colors"
                          title="Tirar do pacote e deixar o dia pendente"
                        >
                          {isBusy ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Trash2 size={13} />
                          )}
                          Tirar
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Sessões livres / pendentes deste paciente para vincular manualmente (inclui anteriores ao mês 11) */}
          {remainingCount > 0 && patientPendingAndLegacyEvents.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-brand-border">
              <h4 className="text-xs font-semibold uppercase tracking-widest text-brand-muted">
                Vincular Atendimento Livre a Este Pacote
              </h4>
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
