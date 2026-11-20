import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRightLeft,
  Calendar,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  UserCheck,
  X,
} from 'lucide-react'
import { fetchAgendaSemana, type AgendaEventItem, type AgendaNameMapping } from '@/lib/agendaApi'
import { getGoogleConnectUrl } from '@/lib/fechamentoApi'
import {
  assignSessionToPackage,
  replaceSessionInPackage,
  type CalendarEventItem,
  type PatientCalendarLink,
} from '@/lib/pacotesApi'
import { cn, obterIniciaisNome } from '@/lib/utils'
import {
  addDaysISO,
  buildWeekColumns,
  computeHourBounds,
  formatWeekRangeLabel,
  getLocalTodayISO,
  getMondayOfWeek,
  layoutDayTimedEvents,
  resolveAgendaEvents,
  type ResolvedAgendaEvent,
} from '@/pages/Agenda/agendaHelpers'
import type { Paciente } from '@/types'
import {
  formatISODateToBR,
  getPackageTypeLabel,
  type ComputedPackage,
  type ComputedSessionItem,
} from './pacotesHelpers'

const HOUR_HEIGHT_PX = 56

interface PackageAgendaPickerModalProps {
  isOpen: boolean
  onClose: () => void
  onChanged: (message: string) => void
  targetPackage: ComputedPackage | null
  replacingSession: ComputedSessionItem | null
  initialDate?: string
  allComputedPackages: ComputedPackage[]
  allLinks: PatientCalendarLink[]
  pacientes: Paciente[]
}

interface EventLinkLookup {
  packageId: string
  ownerName: string
  packageLabel: string
  sessionNumber: number
  totalSessions: number
  isTargetPackage: boolean
}

type FilterMode = 'todos' | 'livres' | 'titular'

function toCalendarEventItem(ev: ResolvedAgendaEvent | AgendaEventItem): CalendarEventItem {
  return {
    eventId: ev.eventId,
    date: ev.date,
    displayDate: ev.displayDate,
    weekday: ev.weekday,
    startTime: ev.startTime,
    eventDatetime: ev.eventDatetime,
    monthKey: ev.monthKey,
    rawSummary: ev.rawSummary,
    calendarName: ev.calendarName,
  }
}

export function PackageAgendaPickerModal({
  isOpen,
  onClose,
  onChanged,
  targetPackage,
  replacingSession,
  initialDate,
  allComputedPackages,
  allLinks,
  pacientes,
}: PackageAgendaPickerModalProps) {
  const [todayISO, setTodayISO] = useState<string>(() => getLocalTodayISO())
  const [weekMonday, setWeekMonday] = useState<string>(() =>
    getMondayOfWeek(initialDate || replacingSession?.event_date || getLocalTodayISO())
  )
  const [includeSunday, setIncludeSunday] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleConnected, setGoogleConnected] = useState(true)
  const [googleError, setGoogleError] = useState<string | null>(null)
  const [rawEvents, setRawEvents] = useState<AgendaEventItem[]>([])
  const [mappings, setMappings] = useState<AgendaNameMapping[]>([])

  const [localReplacing, setLocalReplacing] = useState<ComputedSessionItem | null>(replacingSession)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState<FilterMode>('todos')
  const [mobileDayISO, setMobileDayISO] = useState<string>(() => getLocalTodayISO())

  const [hoveredLinkedInfo, setHoveredLinkedInfo] = useState<{
    event: ResolvedAgendaEvent
    link: EventLinkLookup
  } | null>(null)
  const [pendingConfirmEvent, setPendingConfirmEvent] = useState<ResolvedAgendaEvent | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const loadWeek = useCallback(async (mondayISO: string) => {
    setLoading(true)
    setGoogleError(null)
    setHoveredLinkedInfo(null)
    try {
      const sundayISO = addDaysISO(mondayISO, 6)
      const data = await fetchAgendaSemana(mondayISO, sundayISO)
      setTodayISO(data.today || getLocalTodayISO())
      setGoogleConnected(data.googleConnected)
      setGoogleError(data.googleError)
      setRawEvents(data.events || [])
      setMappings(data.mappings || [])
    } catch (err) {
      setGoogleError(err instanceof Error ? err.message : 'Erro ao carregar agenda semanal.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Sincroniza estado inicial toda vez que o modal abre
  useEffect(() => {
    if (!isOpen) return
    const seedDate = replacingSession?.event_date || initialDate || getLocalTodayISO()
    const monday = getMondayOfWeek(seedDate)
    setLocalReplacing(replacingSession)
    setWeekMonday(monday)
    setMobileDayISO(seedDate)
    setSearchQuery('')
    setFilterMode('todos')
    setPendingConfirmEvent(null)
    setHoveredLinkedInfo(null)
    setActionError(null)
    loadWeek(monday)
  }, [isOpen, replacingSession, initialDate, loadWeek])

  // Lookup O(1) de todos os eventIds já vinculados a qualquer pacote
  const eventLinkMap = useMemo(() => {
    const map = new Map<string, EventLinkLookup>()
    const targetId = targetPackage?.pkg.id || ''
    for (const cp of allComputedPackages) {
      if (cp.pkg.status === 'cancelled') continue
      const ownerName = cp.paciente?.nome || 'Sem paciente vinculado'
      const pkgLabel = getPackageTypeLabel(cp.pkg.package_type, cp.pkg.total_sessions)
      for (const s of cp.sessions) {
        map.set(s.calendar_event_id, {
          packageId: cp.pkg.id,
          ownerName,
          packageLabel: pkgLabel,
          sessionNumber: s.sessionNumber,
          totalSessions: cp.pkg.total_sessions,
          isTargetPackage: cp.pkg.id === targetId,
        })
      }
    }
    return map
  }, [allComputedPackages, targetPackage])

  // Nomes de agenda pertencentes ao titular do pacote + resolução de todos links para identificar terceiros
  const ownerCalendarLowers = useMemo(() => {
    const set = new Set<string>()
    const targetPacienteId = targetPackage?.pkg.paciente_id
    if (!targetPacienteId) return set
    for (const l of allLinks) {
      if (l.paciente_id === targetPacienteId) {
        set.add(l.calendar_name.toLowerCase().trim())
      }
    }
    return set
  }, [allLinks, targetPackage])

  const ownerByCalendarLower = useMemo(() => {
    const pacById = new Map(pacientes.map((p) => [p.id, p.nome]))
    const map = new Map<string, { pacienteId: string; pacienteNome: string }>()
    for (const l of allLinks) {
      const nome = pacById.get(l.paciente_id)
      if (nome) {
        map.set(l.calendar_name.toLowerCase().trim(), {
          pacienteId: l.paciente_id,
          pacienteNome: nome,
        })
      }
    }
    return map
  }, [allLinks, pacientes])

  const isEventFromTargetOwner = useCallback(
    (ev: ResolvedAgendaEvent): boolean => {
      if (!targetPackage?.pkg.paciente_id) return false
      const calLow = ev.calendarName.toLowerCase().trim()
      const dispLow = ev.displayName.toLowerCase().trim()
      if (ownerCalendarLowers.has(calLow) || ownerCalendarLowers.has(dispLow)) return true
      const ownerFirst = (targetPackage.paciente?.nome || '').toLowerCase().split(/\s+/)[0]
      return Boolean(ownerFirst && ownerFirst.length >= 3 && calLow.includes(ownerFirst))
    },
    [targetPackage, ownerCalendarLowers]
  )

  const getEventThirdPartyName = useCallback(
    (ev: ResolvedAgendaEvent): string | null => {
      const calLow = ev.calendarName.toLowerCase().trim()
      const dispLow = ev.displayName.toLowerCase().trim()
      const found = ownerByCalendarLower.get(calLow) || ownerByCalendarLower.get(dispLow)
      if (!found) return null
      if (found.pacienteId === targetPackage?.pkg.paciente_id) return null
      return found.pacienteNome
    },
    [ownerByCalendarLower, targetPackage]
  )

  const resolvedEvents = useMemo(
    () => resolveAgendaEvents(rawEvents, mappings),
    [rawEvents, mappings]
  )

  const hasSundayEvents = useMemo(() => {
    const sundayISO = addDaysISO(weekMonday, 6)
    return resolvedEvents.some((ev) => ev.date === sundayISO)
  }, [resolvedEvents, weekMonday])

  const showSunday = includeSunday || hasSundayEvents
  const weekColumns = useMemo(
    () => buildWeekColumns(weekMonday, showSunday),
    [weekMonday, showSunday]
  )

  useEffect(() => {
    if (!weekColumns.some((c) => c.isoDate === mobileDayISO) && weekColumns.length > 0) {
      const todayCol = weekColumns.find((c) => c.isoDate === todayISO)
      setMobileDayISO(todayCol ? todayCol.isoDate : weekColumns[0].isoDate)
    }
  }, [weekColumns, mobileDayISO, todayISO])

  const filteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return resolvedEvents.filter((ev) => {
      if (q) {
        const hit =
          ev.displayName.toLowerCase().includes(q) ||
          ev.calendarName.toLowerCase().includes(q) ||
          ev.rawSummary.toLowerCase().includes(q)
        if (!hit) return false
      }
      if (filterMode === 'livres') {
        if (eventLinkMap.has(ev.eventId)) return false
      } else if (filterMode === 'titular') {
        if (!isEventFromTargetOwner(ev)) return false
      }
      return true
    })
  }, [resolvedEvents, searchQuery, filterMode, eventLinkMap, isEventFromTargetOwner])

  const visibleDateSet = useMemo(
    () => new Set(weekColumns.map((c) => c.isoDate)),
    [weekColumns]
  )

  const visibleEvents = useMemo(
    () => filteredEvents.filter((ev) => visibleDateSet.has(ev.date)),
    [filteredEvents, visibleDateSet]
  )

  const { startHour, endHour } = useMemo(
    () => computeHourBounds(resolvedEvents),
    [resolvedEvents]
  )
  const hoursList = useMemo(() => {
    const arr: number[] = []
    for (let h = startHour; h < endHour; h++) arr.push(h)
    return arr
  }, [startHour, endHour])

  const allDayByDate = useMemo(() => {
    const map: Record<string, ResolvedAgendaEvent[]> = {}
    for (const ev of visibleEvents) {
      if (!ev.isAllDay) continue
      if (!map[ev.date]) map[ev.date] = []
      map[ev.date].push(ev)
    }
    return map
  }, [visibleEvents])

  const timedLayoutByDate = useMemo(() => {
    const grouped: Record<string, ResolvedAgendaEvent[]> = {}
    for (const ev of visibleEvents) {
      if (ev.isAllDay) continue
      if (!grouped[ev.date]) grouped[ev.date] = []
      grouped[ev.date].push(ev)
    }
    const result: Record<string, ReturnType<typeof layoutDayTimedEvents>> = {}
    for (const col of weekColumns) {
      result[col.isoDate] = layoutDayTimedEvents(grouped[col.isoDate] || [])
    }
    return result
  }, [visibleEvents, weekColumns])

  if (!isOpen || !targetPackage) return null

  const navigateWeek = (nextMonday: string) => {
    setWeekMonday(nextMonday)
    loadWeek(nextMonday)
  }

  const goPrevWeek = () => navigateWeek(addDaysISO(weekMonday, -7))
  const goNextWeek = () => navigateWeek(addDaysISO(weekMonday, 7))
  const goTodayWeek = () => navigateWeek(getMondayOfWeek(todayISO))

  const weekEndDisplayISO = weekColumns[weekColumns.length - 1]?.isoDate || addDaysISO(weekMonday, 5)
  const weekRangeLabel = formatWeekRangeLabel(weekMonday, weekEndDisplayISO)
  const isCurrentWeek = weekMonday === getMondayOfWeek(todayISO)
  const hasAnyAllDay = Object.keys(allDayByDate).length > 0

  const handleSelectEvent = (ev: ResolvedAgendaEvent) => {
    const existingLink = eventLinkMap.get(ev.eventId)
    if (existingLink) {
      if (!existingLink.isTargetPackage) {
        setHoveredLinkedInfo({ event: ev, link: existingLink })
      }
      return
    }
    setActionError(null)
    setPendingConfirmEvent(ev)
  }

  const handleConfirmLink = async () => {
    if (!pendingConfirmEvent || !targetPackage) return
    setSubmitting(true)
    setActionError(null)
    try {
      const calEvent = toCalendarEventItem(pendingConfirmEvent)
      if (localReplacing) {
        await replaceSessionInPackage(
          targetPackage.pkg.id,
          localReplacing.calendar_event_id,
          calEvent
        )
        setPendingConfirmEvent(null)
        onChanged(
          `Vínculo trocado: ${formatISODateToBR(localReplacing.event_date)} → ${pendingConfirmEvent.displayDate} (${pendingConfirmEvent.rawSummary})!`
        )
        onClose()
      } else {
        await assignSessionToPackage(targetPackage.pkg.id, calEvent)
        setPendingConfirmEvent(null)
        onChanged(
          `Atendimento de ${pendingConfirmEvent.displayDate} (${pendingConfirmEvent.rawSummary}) vinculado ao pacote!`
        )
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao vincular atendimento.')
    } finally {
      setSubmitting(false)
    }
  }

  const targetOwnerLabel = targetPackage.paciente?.nome || 'Sem paciente vinculado'
  const pkgTypeLabel = getPackageTypeLabel(
    targetPackage.pkg.package_type,
    targetPackage.pkg.total_sessions
  )

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[60] bg-primary-900/55 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl border border-brand-border shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden animate-scale-in"
      >
        {/* Cabeçalho */}
        <div className="p-4 sm:p-6 border-b border-brand-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-brand-offwhite">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-secondary-700">
              {localReplacing
                ? 'Trocar Vínculo na Agenda Semanal'
                : 'Vincular Atendimento da Agenda ao Pacote'}
            </p>
            <h3 className="text-lg sm:text-xl font-bold text-primary truncate mt-0.5">
              {targetOwnerLabel} · {pkgTypeLabel}
            </h3>
            <p className="text-xs text-brand-muted mt-0.5">
              Uso atual: <strong className="text-primary">{targetPackage.usedTotal}/{targetPackage.pkg.total_sessions}</strong>
              {targetPackage.pkg.label ? ` · ${targetPackage.pkg.label}` : ''} · Clique em qualquer atendimento livre (inclusive de familiar/terceiro) para vincular.
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
            <button
              type="button"
              onClick={() => loadWeek(weekMonday)}
              disabled={loading}
              className="btn-outline py-2 px-3 text-xs bg-white"
              title="Recarregar semana do Google Calendar"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white border border-brand-border hover:bg-brand-cream flex items-center justify-center text-primary"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Banner modo troca */}
        {localReplacing && (
          <div className="px-4 sm:px-6 py-2.5 bg-amber-50 border-b border-amber-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-amber-950">
              <ArrowRightLeft size={15} className="text-amber-700 flex-shrink-0" />
              <span>
                Substituindo{' '}
                <strong>
                  Sessão {localReplacing.sessionNumber}/{targetPackage.pkg.total_sessions}
                </strong>{' '}
                ({localReplacing.displayDate} · <strong>{localReplacing.calendar_summary}</strong>). O dia antigo ficará livre/pendente.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setLocalReplacing(null)}
              className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-amber-900 font-semibold hover:bg-amber-100 transition-colors"
            >
              Apenas adicionar nova sessão
            </button>
          </div>
        )}

        {/* Barra de controles de semana e filtros */}
        <div className="px-4 sm:px-6 py-3 border-b border-brand-border bg-white space-y-2.5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center bg-brand-cream p-1 rounded-2xl border border-brand-border">
                <button
                  type="button"
                  onClick={goPrevWeek}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-primary hover:bg-white transition-colors"
                  title="Semana anterior"
                >
                  <ChevronLeft size={17} />
                </button>
                <button
                  type="button"
                  onClick={goTodayWeek}
                  className={cn(
                    'px-3 h-8 rounded-xl text-xs font-bold transition-colors',
                    isCurrentWeek ? 'bg-primary text-white' : 'text-primary hover:bg-white'
                  )}
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={goNextWeek}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-primary hover:bg-white transition-colors"
                  title="Próxima semana"
                >
                  <ChevronRight size={17} />
                </button>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-primary-50/70 border border-primary-100 text-primary text-xs font-bold">
                <CalendarDays size={14} className="text-secondary-600" />
                <span>{weekRangeLabel}</span>
              </div>

              <div className="inline-flex items-center bg-brand-cream p-0.5 rounded-xl border border-brand-border text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setIncludeSunday(false)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg transition-colors',
                    !showSunday ? 'bg-white text-primary shadow-sm' : 'text-brand-muted'
                  )}
                >
                  Seg–Sáb
                </button>
                <button
                  type="button"
                  onClick={() => setIncludeSunday(true)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg transition-colors',
                    showSunday ? 'bg-white text-primary shadow-sm' : 'text-brand-muted'
                  )}
                >
                  Seg–Dom
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center bg-brand-cream p-0.5 rounded-xl border border-brand-border text-[11px] font-bold">
                {(
                  [
                    { id: 'todos', label: 'Todos' },
                    { id: 'livres', label: 'Só livres' },
                    ...(targetPackage.pkg.paciente_id
                      ? [{ id: 'titular', label: 'Só do titular' }]
                      : []),
                  ] as { id: FilterMode; label: string }[]
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilterMode(f.id)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg transition-colors',
                      filterMode === f.id ? 'bg-white text-primary shadow-sm' : 'text-brand-muted'
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-52">
                <Search
                  size={13}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar paciente ou #..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-full border border-brand-border bg-brand-cream/60 text-xs text-primary placeholder:text-brand-muted focus:outline-none focus:ring-2 focus:ring-secondary-400"
                />
              </div>
            </div>
          </div>

          {/* Legenda rápida + Tooltip fixo sem cortes ao passar cursor sobre atendimento já vinculado */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex flex-wrap items-center gap-3 text-brand-muted">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-secondary-500 inline-block" />
                Disponível para vincular
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
                Neste pacote
              </span>
              <span className="inline-flex items-center gap-1 opacity-70">
                <Lock size={11} />
                Já vinculado a outro pacote (passe o cursor para ver qual)
              </span>
            </div>

            {hoveredLinkedInfo && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-white text-[11px] font-semibold animate-fade-in">
                <Lock size={11} className="text-amber-300 flex-shrink-0" />
                <span>
                  {hoveredLinkedInfo.event.displayName} ({hoveredLinkedInfo.event.startTime}) já está
                  vinculado a <strong>{hoveredLinkedInfo.link.ownerName}</strong> —{' '}
                  {hoveredLinkedInfo.link.packageLabel} (Sessão{' '}
                  {hoveredLinkedInfo.link.sessionNumber}/{hoveredLinkedInfo.link.totalSessions})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Corpo rolável com a grade */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-brand-offwhite/50">
          {!googleConnected && !loading ? (
            <div className="bg-white rounded-2xl border border-brand-border p-10 text-center space-y-3">
              <p className="text-sm font-semibold text-primary">
                Conecte sua conta Google Agenda para visualizar e vincular os atendimentos.
              </p>
              <a href={getGoogleConnectUrl('/pacotes')} className="btn-primary inline-flex text-xs">
                <Calendar size={15} />
                Conectar Google Agenda
              </a>
            </div>
          ) : googleError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-xs text-rose-800 flex flex-wrap items-center justify-between gap-3">
              <span>{googleError}</span>
              <div className="flex items-center gap-2">
                <a
                  href={getGoogleConnectUrl('/pacotes')}
                  className="px-3 py-1.5 rounded-xl bg-primary text-white font-semibold"
                >
                  Reconectar Google
                </a>
                <button
                  type="button"
                  onClick={() => loadWeek(weekMonday)}
                  className="px-3 py-1.5 rounded-xl bg-white border border-rose-200 font-semibold"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          ) : loading ? (
            <div className="bg-white rounded-2xl border border-brand-border py-16 flex flex-col items-center justify-center gap-2">
              <Loader2 size={26} className="animate-spin text-secondary-600" />
              <p className="text-xs font-medium text-brand-muted">
                Buscando atendimentos da semana no Google Agenda...
              </p>
            </div>
          ) : (
            <>
              {/* Desktop md+: Grade com setas laterais */}
              <div className="hidden md:flex items-start gap-2">
                <button
                  type="button"
                  onClick={goPrevWeek}
                  title="Semana anterior"
                  className="sticky top-1/2 -translate-y-1/2 w-9 h-12 rounded-2xl bg-white border border-brand-border shadow-sm hover:bg-primary hover:text-white text-primary flex items-center justify-center transition-colors flex-shrink-0"
                >
                  <ChevronLeft size={18} />
                </button>

                <div className="flex-1 min-w-0 bg-white rounded-2xl border border-brand-border shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <div className="min-w-[740px]">
                      {/* Cabeçalho dos dias */}
                      <div
                        className="grid border-b border-brand-border bg-brand-cream/40"
                        style={{
                          gridTemplateColumns: `60px repeat(${weekColumns.length}, minmax(0, 1fr))`,
                        }}
                      >
                        <div className="py-2.5 px-1 flex items-center justify-center border-r border-brand-border/70 text-[10px] font-bold text-brand-muted">
                          BRT
                        </div>
                        {weekColumns.map((col) => {
                          const isToday = col.isoDate === todayISO
                          return (
                            <div
                              key={col.isoDate}
                              className={cn(
                                'py-2.5 px-2 border-r last:border-r-0 border-brand-border/70 flex items-center justify-center gap-1.5',
                                isToday && 'bg-secondary-50/70'
                              )}
                            >
                              <span className="text-[11px] font-bold uppercase text-brand-muted">
                                {col.shortWeekday}
                              </span>
                              <span
                                className={cn(
                                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold tabular-nums',
                                  isToday ? 'bg-primary text-white' : 'text-primary'
                                )}
                              >
                                {col.dayNum}
                              </span>
                            </div>
                          )
                        })}
                      </div>

                      {/* Dia inteiro */}
                      {hasAnyAllDay && (
                        <div
                          className="grid border-b border-brand-border bg-brand-cream/25"
                          style={{
                            gridTemplateColumns: `60px repeat(${weekColumns.length}, minmax(0, 1fr))`,
                          }}
                        >
                          <div className="py-2 px-1 border-r border-brand-border/70 text-[10px] font-semibold text-brand-muted flex items-center justify-center">
                            Dia todo
                          </div>
                          {weekColumns.map((col) => (
                            <div
                              key={col.isoDate}
                              className="p-1 border-r last:border-r-0 border-brand-border/70 space-y-1"
                            >
                              {(allDayByDate[col.isoDate] || []).map((ev) => {
                                const link = eventLinkMap.get(ev.eventId)
                                const inOther = Boolean(link && !link.isTargetPackage)
                                const inThis = Boolean(link && link.isTargetPackage)
                                return (
                                  <button
                                    key={ev.eventId}
                                    type="button"
                                    onClick={() => handleSelectEvent(ev)}
                                    onMouseEnter={() =>
                                      inOther && link
                                        ? setHoveredLinkedInfo({ event: ev, link })
                                        : undefined
                                    }
                                    onMouseLeave={() => setHoveredLinkedInfo(null)}
                                    title={
                                      inOther && link
                                        ? `Já vinculado a outro pacote: ${link.ownerName} — ${link.packageLabel} (Sessão ${link.sessionNumber}/${link.totalSessions})`
                                        : inThis && link
                                          ? `Já está neste pacote (Sessão ${link.sessionNumber}/${link.totalSessions})`
                                          : `Clique para vincular ${ev.displayName}`
                                    }
                                    style={{
                                      backgroundColor: ev.color.bg,
                                      borderColor: ev.color.border,
                                      color: ev.color.text,
                                    }}
                                    className={cn(
                                      'w-full flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] font-bold text-left',
                                      inOther && 'opacity-40 grayscale cursor-not-allowed',
                                      inThis && 'ring-2 ring-emerald-500 cursor-default'
                                    )}
                                  >
                                    {inOther ? (
                                      <Lock size={10} className="flex-shrink-0" />
                                    ) : inThis ? (
                                      <CheckCircle2 size={10} className="text-emerald-700 flex-shrink-0" />
                                    ) : null}
                                    <span className="truncate">{ev.displayName}</span>
                                  </button>
                                )
                              })}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Grade de horários */}
                      <div
                        className="grid relative select-none"
                        style={{
                          gridTemplateColumns: `60px repeat(${weekColumns.length}, minmax(0, 1fr))`,
                          height: `${hoursList.length * HOUR_HEIGHT_PX}px`,
                        }}
                      >
                        <div className="relative border-r border-brand-border/70 bg-brand-cream/20">
                          {hoursList.map((hour, idx) => (
                            <div key={hour} style={{ height: `${HOUR_HEIGHT_PX}px` }} className="relative">
                              <span
                                className={cn(
                                  'absolute right-2 text-[10px] font-semibold text-brand-muted tabular-nums',
                                  idx === 0 ? 'top-1' : '-top-2'
                                )}
                              >
                                {String(hour).padStart(2, '0')}:00
                              </span>
                            </div>
                          ))}
                        </div>

                        {weekColumns.map((col) => {
                          const isToday = col.isoDate === todayISO
                          const positioned = timedLayoutByDate[col.isoDate] || []
                          return (
                            <div
                              key={col.isoDate}
                              className={cn(
                                'relative border-r last:border-r-0 border-brand-border/70',
                                isToday && 'bg-secondary-50/20'
                              )}
                            >
                              {hoursList.map((hour) => (
                                <div
                                  key={hour}
                                  style={{ height: `${HOUR_HEIGHT_PX}px` }}
                                  className="border-b border-brand-border/50 relative pointer-events-none"
                                >
                                  <div className="absolute inset-x-0 top-1/2 border-b border-dashed border-brand-border/30" />
                                </div>
                              ))}

                              {positioned.map((item) => {
                                const { event, startMin, endMin, lane, totalLanes } = item
                                const topPx = ((startMin - startHour * 60) / 60) * HOUR_HEIGHT_PX + 2
                                const rawH = ((endMin - startMin) / 60) * HOUR_HEIGHT_PX - 4
                                const heightPx = Math.max(rawH, 26)
                                const isCompact = heightPx < 42
                                const widthPct = 100 / totalLanes
                                const leftPct = lane * widthPct

                                const link = eventLinkMap.get(event.eventId)
                                const inOther = Boolean(link && !link.isTargetPackage)
                                const inThis = Boolean(link && link.isTargetPackage)
                                const isReplacingTarget =
                                  Boolean(localReplacing && localReplacing.calendar_event_id === event.eventId)
                                const isOwner = isEventFromTargetOwner(event)
                                const thirdParty = !isOwner ? getEventThirdPartyName(event) : null

                                const tooltipText = inOther && link
                                  ? `Já vinculado a outro pacote: ${link.ownerName} — ${link.packageLabel} (Sessão ${link.sessionNumber}/${link.totalSessions})`
                                  : inThis && link
                                    ? `Já está neste pacote (Sessão ${link.sessionNumber}/${link.totalSessions})`
                                    : `${event.displayName} • ${event.startTime} — Clique para vincular a este pacote`

                                return (
                                  <button
                                    key={event.eventId}
                                    type="button"
                                    onClick={() => handleSelectEvent(event)}
                                    onMouseEnter={() =>
                                      inOther && link
                                        ? setHoveredLinkedInfo({ event, link })
                                        : undefined
                                    }
                                    onMouseLeave={() => setHoveredLinkedInfo(null)}
                                    title={tooltipText}
                                    style={{
                                      top: `${topPx}px`,
                                      height: `${heightPx}px`,
                                      left: `calc(${leftPct}% + 3px)`,
                                      width: `calc(${widthPct}% - 6px)`,
                                      backgroundColor: event.color.bg,
                                      borderColor: isReplacingTarget
                                        ? '#D97706'
                                        : inThis
                                          ? '#059669'
                                          : event.color.border,
                                      color: event.color.text,
                                    }}
                                    className={cn(
                                      'group absolute z-10 border text-left transition-all duration-150 overflow-hidden',
                                      isCompact
                                        ? 'rounded-full px-2 flex items-center gap-1'
                                        : 'rounded-full px-2.5 py-1 flex items-center gap-1.5',
                                      inOther
                                        ? 'opacity-40 grayscale cursor-not-allowed'
                                        : isReplacingTarget
                                          ? 'ring-2 ring-amber-400 border-dashed cursor-default'
                                          : inThis
                                            ? 'ring-2 ring-emerald-500/70 cursor-default'
                                            : 'shadow-sm hover:shadow-md hover:z-30 hover:-translate-y-0.5 cursor-pointer'
                                    )}
                                  >
                                    <span
                                      style={{ backgroundColor: inOther ? '#64748B' : event.color.dot }}
                                      className={cn(
                                        'rounded-full text-white font-bold flex items-center justify-center flex-shrink-0',
                                        isCompact ? 'w-4 h-4 text-[8px]' : 'w-6 h-6 text-[10px]'
                                      )}
                                    >
                                      {inOther ? (
                                        <Lock size={9} />
                                      ) : inThis ? (
                                        <CheckCircle2 size={10} />
                                      ) : (
                                        obterIniciaisNome(event.displayName).slice(0, 2)
                                      )}
                                    </span>

                                    <div className="min-w-0 flex-1 leading-tight">
                                      <div className="flex items-center gap-1">
                                        <span
                                          className={cn(
                                            'font-bold truncate',
                                            isCompact ? 'text-[10px]' : 'text-[11px]'
                                          )}
                                        >
                                          {event.displayName}
                                        </span>
                                        {!inOther && !inThis && !isCompact && isOwner && (
                                          <UserCheck
                                            size={10}
                                            className="text-emerald-700 flex-shrink-0"
                                          />
                                        )}
                                      </div>
                                      {!isCompact && (
                                        <p
                                          style={{ color: event.color.subtext }}
                                          className="text-[9px] font-semibold truncate tabular-nums"
                                        >
                                          {inOther && link
                                            ? `Vinculado (${link.ownerName.split(' ')[0]})`
                                            : isReplacingTarget
                                              ? 'Trocando esta'
                                              : inThis && link
                                                ? `Neste pacote · ${link.sessionNumber}/${link.totalSessions}`
                                                : thirdParty
                                                  ? `${event.startTime} · ${thirdParty.split(' ')[0]}`
                                                  : event.startTime}
                                        </p>
                                      )}
                                    </div>
                                  </button>
                                )
                              })}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={goNextWeek}
                  title="Próxima semana"
                  className="sticky top-1/2 -translate-y-1/2 w-9 h-12 rounded-2xl bg-white border border-brand-border shadow-sm hover:bg-primary hover:text-white text-primary flex items-center justify-center transition-colors flex-shrink-0"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Mobile < md: Lista por dia */}
              <div className="md:hidden space-y-3">
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {weekColumns.map((col) => {
                    const active = col.isoDate === mobileDayISO
                    return (
                      <button
                        key={col.isoDate}
                        type="button"
                        onClick={() => setMobileDayISO(col.isoDate)}
                        className={cn(
                          'flex flex-col items-center justify-center min-w-[50px] py-1.5 px-2 rounded-2xl border text-xs',
                          active
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white text-primary border-brand-border'
                        )}
                      >
                        <span className="text-[10px] font-bold uppercase opacity-75">
                          {col.shortWeekday}
                        </span>
                        <span className="font-extrabold tabular-nums">{col.dayNum}</span>
                      </button>
                    )
                  })}
                </div>

                <div className="bg-white rounded-2xl border border-brand-border p-3 space-y-2">
                  {visibleEvents.filter((ev) => ev.date === mobileDayISO).length === 0 ? (
                    <p className="text-xs text-brand-muted text-center py-6">
                      Nenhum atendimento encontrado neste dia.
                    </p>
                  ) : (
                    visibleEvents
                      .filter((ev) => ev.date === mobileDayISO)
                      .sort((a, b) => a.eventDatetime.localeCompare(b.eventDatetime))
                      .map((ev) => {
                        const link = eventLinkMap.get(ev.eventId)
                        const inOther = Boolean(link && !link.isTargetPackage)
                        const inThis = Boolean(link && link.isTargetPackage)
                        return (
                          <button
                            key={ev.eventId}
                            type="button"
                            onClick={() => handleSelectEvent(ev)}
                            style={{
                              backgroundColor: ev.color.bg,
                              borderColor: ev.color.border,
                              color: ev.color.text,
                            }}
                            className={cn(
                              'w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-full border text-left',
                              inOther && 'opacity-45 grayscale'
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                style={{ backgroundColor: inOther ? '#64748B' : ev.color.dot }}
                                className="w-7 h-7 rounded-full text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0"
                              >
                                {inOther ? (
                                  <Lock size={11} />
                                ) : inThis ? (
                                  <CheckCircle2 size={12} />
                                ) : (
                                  obterIniciaisNome(ev.displayName).slice(0, 2)
                                )}
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs font-bold truncate">{ev.displayName}</p>
                                <p className="text-[10px] font-semibold opacity-80 truncate">
                                  {inOther && link
                                    ? `Já vinculado: ${link.ownerName} (${link.sessionNumber}/${link.totalSessions})`
                                    : inThis && link
                                      ? `Neste pacote (${link.sessionNumber}/${link.totalSessions})`
                                      : `${ev.startTime} · ${ev.rawSummary}`}
                                </p>
                              </div>
                            </div>
                            {!inOther && !inThis && (
                              <span className="px-2 py-0.5 rounded-full bg-white text-primary text-[10px] font-bold flex-shrink-0">
                                Selecionar
                              </span>
                            )}
                          </button>
                        )
                      })
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal interno de Confirmação do Vínculo */}
        {pendingConfirmEvent && (
          <div
            onClick={() => !submitting && setPendingConfirmEvent(null)}
            className="fixed inset-0 z-[70] bg-primary-900/55 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl border border-brand-border shadow-2xl max-w-md w-full overflow-hidden animate-scale-in"
            >
              <div className="p-5 border-b border-brand-border bg-brand-offwhite flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-secondary-50 text-secondary-700 flex items-center justify-center">
                    {localReplacing ? <ArrowRightLeft size={18} /> : <CalendarPlus size={18} />}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-primary">
                      {localReplacing ? 'Confirmar Troca de Vínculo' : 'Confirmar Vínculo ao Pacote'}
                    </h4>
                    <p className="text-[11px] text-brand-muted">
                      Confira os dados antes de gravar
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setPendingConfirmEvent(null)}
                  className="w-8 h-8 rounded-xl hover:bg-brand-cream flex items-center justify-center text-brand-muted"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                {actionError && (
                  <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 font-semibold">
                    {actionError}
                  </div>
                )}

                <div className="p-3.5 rounded-2xl bg-brand-cream/70 border border-brand-border space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">
                    Atendimento selecionado na agenda
                  </p>
                  <p className="text-sm font-bold text-primary">
                    {pendingConfirmEvent.displayName}{' '}
                    <span className="font-medium text-brand-muted">
                      ({pendingConfirmEvent.rawSummary})
                    </span>
                  </p>
                  <p className="text-brand-body flex items-center gap-1.5">
                    <Clock size={12} className="text-secondary-600" />
                    {pendingConfirmEvent.weekday}, {pendingConfirmEvent.displayDate} ·{' '}
                    {pendingConfirmEvent.startTime}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-primary-50/60 border border-primary-100 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary/70">
                    Pacote de destino
                  </p>
                  <p className="text-sm font-bold text-primary">{targetOwnerLabel}</p>
                  <p className="text-brand-body">
                    {pkgTypeLabel} · {targetPackage.usedTotal}/{targetPackage.pkg.total_sessions}{' '}
                    sessões
                  </p>
                </div>

                {localReplacing && (
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2">
                    <Info size={14} className="mt-0.5 flex-shrink-0 text-amber-700" />
                    <span>
                      A sessão anterior (<strong>{localReplacing.displayDate}</strong> ·{' '}
                      {localReplacing.calendar_summary}) será removida do pacote e voltará para os
                      atendimentos pendentes.
                    </span>
                  </div>
                )}

                {targetPackage.pkg.paciente_id && !isEventFromTargetOwner(pendingConfirmEvent) && (
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex items-start gap-2">
                    <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-amber-700" />
                    <span>
                      Este atendimento está na agenda como{' '}
                      <strong>{pendingConfirmEvent.rawSummary}</strong>
                      {getEventThirdPartyName(pendingConfirmEvent)
                        ? ` (vinculado a ${getEventThirdPartyName(pendingConfirmEvent)})`
                        : ' (outro nome/pessoa)'}
                      , diferente do titular deste pacote (<strong>{targetOwnerLabel}</strong>). Deseja vincular mesmo assim?
                    </span>
                  </div>
                )}

                {!targetPackage.pkg.start_date && (
                  <div className="p-3 rounded-2xl bg-sky-50 border border-sky-200 text-sky-900 flex items-start gap-2">
                    <Info size={14} className="mt-0.5 flex-shrink-0 text-sky-700" />
                    <span>
                      Como este pacote ainda estava sem início definido, a data de início será
                      definida automaticamente para <strong>{pendingConfirmEvent.displayDate}</strong>.
                    </span>
                  </div>
                )}

                {!localReplacing && targetPackage.remainingCount === 0 && (
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2">
                    <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-amber-700" />
                    <span>
                      Este pacote já atingiu {targetPackage.pkg.total_sessions} sessões. Ao
                      vincular mais uma, ele ficará com{' '}
                      <strong>
                        {targetPackage.usedTotal + 1}/{targetPackage.pkg.total_sessions}
                      </strong>
                      .
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-brand-border">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setPendingConfirmEvent(null)}
                    className="btn-outline py-2.5 px-4 text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleConfirmLink}
                    className="btn-primary py-2.5 px-5 text-xs"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Vinculando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={14} />
                        {localReplacing ? 'Confirmar Troca' : 'Confirmar Vínculo'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
