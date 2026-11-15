import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Hash,
  Loader2,
  PackageCheck,
  RefreshCw,
  Search,
  Sparkles,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { fetchAgendaSemana } from '@/lib/agendaApi'
import { getGoogleConnectUrl } from '@/lib/fechamentoApi'
import { cn, obterIniciaisNome } from '@/lib/utils'
import {
  addDaysISO,
  buildWeekColumns,
  computeHourBounds,
  formatWeekRangeLabel,
  getLocalTodayISO,
  getMondayOfWeek,
  getSaoPauloNowMinutes,
  layoutDayTimedEvents,
  resolveAgendaEvents,
  type PatientColorTheme,
  type ResolvedAgendaEvent,
} from './agendaHelpers'

const HOUR_HEIGHT_PX = 64

export function AgendaSemanal() {
  const navigate = useNavigate()

  const [todayISO, setTodayISO] = useState<string>(() => getLocalTodayISO())
  const [weekMonday, setWeekMonday] = useState<string>(() => getMondayOfWeek(getLocalTodayISO()))
  const [includeSunday, setIncludeSunday] = useState(false)

  const [loading, setLoading] = useState(true)
  const [googleConnected, setGoogleConnected] = useState(true)
  const [googleError, setGoogleError] = useState<string | null>(null)
  const [rawEvents, setRawEvents] = useState<Awaited<ReturnType<typeof fetchAgendaSemana>>['events']>([])
  const [mappings, setMappings] = useState<Awaited<ReturnType<typeof fetchAgendaSemana>>['mappings']>([])

  const [selectedPatientKey, setSelectedPatientKey] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileDayISO, setMobileDayISO] = useState<string>(() => getLocalTodayISO())
  const [mobileShowAllDays, setMobileShowAllDays] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<ResolvedAgendaEvent | null>(null)
  const [nowMinutes, setNowMinutes] = useState<number>(() => getSaoPauloNowMinutes())

  // Atualiza relógio da linha "Agora" a cada minuto
  useEffect(() => {
    const id = window.setInterval(() => {
      setNowMinutes(getSaoPauloNowMinutes())
    }, 60_000)
    return () => window.clearInterval(id)
  }, [])

  const loadWeek = useCallback(async (mondayISO: string) => {
    setLoading(true)
    setGoogleError(null)
    try {
      const sundayISO = addDaysISO(mondayISO, 6)
      const data = await fetchAgendaSemana(mondayISO, sundayISO)
      setTodayISO(data.today || getLocalTodayISO())
      setGoogleConnected(data.googleConnected)
      setGoogleError(data.googleError)
      setRawEvents(data.events || [])
      setMappings(data.mappings || [])
    } catch (err) {
      setGoogleError(err instanceof Error ? err.message : 'Falha ao carregar agenda da semana.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadWeek(weekMonday)
  }, [weekMonday, loadWeek])

  // Resolve nomes + atribui cor única por paciente
  const resolvedEvents = useMemo(
    () => resolveAgendaEvents(rawEvents, mappings),
    [rawEvents, mappings],
  )

  // Detecta se há eventos no domingo para exibir botão / inclusão automática
  const hasSundayEvents = useMemo(() => {
    const sundayISO = addDaysISO(weekMonday, 6)
    return resolvedEvents.some((ev) => ev.date === sundayISO)
  }, [resolvedEvents, weekMonday])

  const showSunday = includeSunday || hasSundayEvents
  const weekColumns = useMemo(
    () => buildWeekColumns(weekMonday, showSunday),
    [weekMonday, showSunday],
  )

  // Garante que o dia selecionado no mobile pertença à semana visível
  useEffect(() => {
    const valid = weekColumns.some((c) => c.isoDate === mobileDayISO)
    if (!valid && weekColumns.length > 0) {
      const hasToday = weekColumns.find((c) => c.isoDate === todayISO)
      setMobileDayISO(hasToday ? hasToday.isoDate : weekColumns[0].isoDate)
    }
  }, [weekColumns, mobileDayISO, todayISO])

  // Legenda de pacientes únicos na semana com contagem e cor única
  const patientLegend = useMemo(() => {
    const map = new Map<
      string,
      { key: string; name: string; count: number; color: PatientColorTheme }
    >()
    for (const ev of resolvedEvents) {
      const key = ev.displayName.toLowerCase()
      const existing = map.get(key)
      if (existing) {
        existing.count += 1
      } else {
        map.set(key, {
          key,
          name: ev.displayName,
          count: 1,
          color: ev.color,
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'))
  }, [resolvedEvents])

  // Eventos filtrados por busca textual ou pílula selecionada
  const filteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return resolvedEvents.filter((ev) => {
      if (selectedPatientKey && ev.displayName.toLowerCase() !== selectedPatientKey) {
        return false
      }
      if (q) {
        return (
          ev.displayName.toLowerCase().includes(q) ||
          ev.rawSummary.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [resolvedEvents, selectedPatientKey, searchQuery])

  // Eventos visíveis dentro das colunas ativas da semana (Seg-Sáb ou Seg-Dom)
  const visibleDateSet = useMemo(
    () => new Set(weekColumns.map((c) => c.isoDate)),
    [weekColumns],
  )

  const visibleEvents = useMemo(
    () => filteredEvents.filter((ev) => visibleDateSet.has(ev.date)),
    [filteredEvents, visibleDateSet],
  )

  const totalWeekAll = resolvedEvents.length
  const totalWeekVisible = visibleEvents.length
  const isFiltered = Boolean(selectedPatientKey || searchQuery.trim())

  const activeDaysCount = useMemo(() => {
    return new Set(visibleEvents.map((e) => e.date)).size
  }, [visibleEvents])

  const { startHour, endHour } = useMemo(
    () => computeHourBounds(resolvedEvents),
    [resolvedEvents],
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

  const hasAnyAllDay = Object.keys(allDayByDate).length > 0

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

  const countByDate = useMemo(() => {
    const map: Record<string, number> = {}
    for (const ev of visibleEvents) {
      map[ev.date] = (map[ev.date] || 0) + 1
    }
    return map
  }, [visibleEvents])

  const weekEndDisplayISO = weekColumns[weekColumns.length - 1]?.isoDate || addDaysISO(weekMonday, 5)
  const weekRangeLabel = formatWeekRangeLabel(weekMonday, weekEndDisplayISO)
  const isCurrentWeek = weekMonday === getMondayOfWeek(todayISO)

  const goPrevWeek = () => {
    setSelectedPatientKey(null)
    setWeekMonday((prev) => addDaysISO(prev, -7))
  }

  const goNextWeek = () => {
    setSelectedPatientKey(null)
    setWeekMonday((prev) => addDaysISO(prev, 7))
  }

  const goTodayWeek = () => {
    setSelectedPatientKey(null)
    setWeekMonday(getMondayOfWeek(todayISO))
    setMobileDayISO(todayISO)
  }

  const nowTopPx = useMemo(() => {
    const minFromStart = nowMinutes - startHour * 60
    const maxMin = (endHour - startHour) * 60
    if (minFromStart < 0 || minFromStart > maxMin) return null
    return (minFromStart / 60) * HOUR_HEIGHT_PX
  }, [nowMinutes, startHour, endHour])

  const selectedPatientCountInWeek = useMemo(() => {
    if (!selectedEvent) return 0
    const key = selectedEvent.displayName.toLowerCase()
    return resolvedEvents.filter((e) => e.displayName.toLowerCase() === key).length
  }, [selectedEvent, resolvedEvents])

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabeçalho */}
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-secondary-600 mb-1">
            Visualizador Semanal
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary tracking-tight flex items-center gap-2.5">
            <span>Agenda da Semana</span>
          </h1>
          <p className="text-sm text-brand-muted mt-1">
            Atendimentos iniciados com <span className="font-semibold text-primary">#</span> no Google Agenda em cores únicas por paciente.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!googleConnected ? (
            <a
              href={getGoogleConnectUrl('/agenda')}
              className="btn-secondary text-xs sm:text-sm"
            >
              <Calendar size={16} />
              Conectar Google Agenda
            </a>
          ) : (
            <button
              type="button"
              onClick={() => loadWeek(weekMonday)}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-brand-border text-primary text-xs font-semibold hover:bg-brand-cream transition-colors shadow-sm disabled:opacity-60"
            >
              <RefreshCw size={15} className={cn(loading && 'animate-spin')} />
              Atualizar
            </button>
          )}
        </div>
      </header>

      {/* Barra de Navegação Semanal + Contadores */}
      <section className="bg-white rounded-3xl border border-brand-border shadow-card p-4 sm:p-5 space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          {/* Controles da Semana */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center bg-brand-cream p-1 rounded-2xl border border-brand-border">
              <button
                type="button"
                onClick={goPrevWeek}
                title="Semana anterior"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-primary hover:bg-white transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={goTodayWeek}
                className={cn(
                  'px-3.5 h-9 rounded-xl text-xs font-bold transition-colors',
                  isCurrentWeek
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-primary hover:bg-white',
                )}
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={goNextWeek}
                title="Próxima semana"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-primary hover:bg-white transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-primary-50/70 border border-primary-100 text-primary">
              <CalendarDays size={16} className="text-secondary-600 flex-shrink-0" />
              <span className="text-sm font-bold tracking-tight">{weekRangeLabel}</span>
            </div>

            <button
              type="button"
              onClick={() => setIncludeSunday((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-semibold border transition-colors',
                showSunday
                  ? 'bg-secondary-50 border-secondary-300 text-secondary-800'
                  : 'bg-white border-brand-border text-brand-muted hover:text-primary',
              )}
              title="Alternar exibição do Domingo"
            >
              <CalendarRange size={14} />
              {showSunday ? 'Seg – Dom' : 'Seg – Sáb'}
            </button>
          </div>

          {/* Contadores da Semana */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-primary text-white shadow-sm">
              <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
                <Sparkles size={15} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-white/75 font-semibold leading-none">
                  Atendimentos na semana
                </p>
                <p className="text-xl font-extrabold leading-tight mt-0.5 tabular-nums">
                  {loading ? '—' : isFiltered ? `${totalWeekVisible} de ${totalWeekAll}` : totalWeekVisible}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-brand-cream border border-brand-border">
              <div className="w-8 h-8 rounded-full bg-secondary-100 text-secondary-700 flex items-center justify-center">
                <Users size={15} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-brand-muted font-semibold leading-none">
                  Pacientes únicos
                </p>
                <p className="text-xl font-extrabold text-primary leading-tight mt-0.5 tabular-nums">
                  {loading ? '—' : patientLegend.length}
                </p>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-brand-cream border border-brand-border">
              <div className="w-8 h-8 rounded-full bg-primary-50 text-primary flex items-center justify-center">
                <Clock size={15} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-brand-muted font-semibold leading-none">
                  Dias com agenda
                </p>
                <p className="text-xl font-extrabold text-primary leading-tight mt-0.5 tabular-nums">
                  {loading ? '—' : `${activeDaysCount}/${weekColumns.length}`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Legenda de Cores por Paciente (Pílulas clicáveis para filtrar) + Busca */}
        {googleConnected && patientLegend.length > 0 && (
          <div className="pt-3 border-t border-brand-border space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-brand-muted">
                <Filter size={13} className="text-secondary-600" />
                <span>Pacientes da semana (clique na pílula para destacar):</span>
                {selectedPatientKey && (
                  <button
                    type="button"
                    onClick={() => setSelectedPatientKey(null)}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary text-white text-[11px] font-semibold hover:bg-primary-800 transition-colors"
                  >
                    <X size={11} />
                    Limpar filtro
                  </button>
                )}
              </div>

              <div className="relative w-full sm:w-56">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar paciente..."
                  className="w-full pl-8 pr-7 py-1.5 rounded-full border border-brand-border bg-brand-cream/60 text-xs text-primary placeholder:text-brand-muted focus:outline-none focus:ring-2 focus:ring-secondary-400"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-muted hover:text-primary"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {patientLegend.map((item) => {
                const isActive = selectedPatientKey === item.key
                const isDimmed = selectedPatientKey !== null && !isActive
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      setSelectedPatientKey((prev) => (prev === item.key ? null : item.key))
                    }
                    style={{
                      backgroundColor: item.color.bg,
                      borderColor: isActive ? item.color.dot : item.color.border,
                      color: item.color.text,
                    }}
                    className={cn(
                      'inline-flex items-center gap-2 pl-2 pr-3 py-1 rounded-full border text-xs font-semibold transition-all cursor-pointer select-none',
                      isActive && 'ring-2 ring-offset-1 ring-primary/30 scale-[1.03] shadow-sm',
                      isDimmed && 'opacity-45 hover:opacity-85',
                    )}
                  >
                    <span
                      style={{ backgroundColor: item.color.dot }}
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    />
                    <span className="truncate max-w-[145px]">{item.name}</span>
                    <span
                      style={{
                        backgroundColor: item.color.badgeBg,
                        color: item.color.subtext,
                      }}
                      className="px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums"
                    >
                      {item.count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {/* Estado de erro ou Google desconectado */}
      {!googleConnected && !loading && (
        <div className="bg-white rounded-3xl border border-brand-border shadow-card p-10 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-primary-50 text-primary flex items-center justify-center mx-auto">
            <CalendarRange size={30} />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h2 className="text-xl font-bold text-primary">Conecte sua conta Google</h2>
            <p className="text-sm text-brand-muted leading-relaxed">
              Para exibir os atendimentos da semana automaticamente no visualizador estilo Google Agenda, conecte a conta que possui os eventos com <span className="font-semibold text-primary">#</span>.
            </p>
          </div>
          <a href={getGoogleConnectUrl('/agenda')} className="btn-primary inline-flex">
            <Calendar size={17} />
            Conectar Google Agenda
          </a>
        </div>
      )}

      {googleError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800 flex items-center justify-between gap-4">
          <span>{googleError}</span>
          <button
            type="button"
            onClick={() => loadWeek(weekMonday)}
            className="px-3 py-1.5 rounded-xl bg-white border border-rose-200 text-xs font-semibold hover:bg-rose-100 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Carregando */}
      {loading && (
        <div className="bg-white rounded-3xl border border-brand-border shadow-card py-20 flex flex-col items-center justify-center gap-3">
          <Loader2 size={30} className="animate-spin text-secondary-600" />
          <p className="text-sm font-medium text-brand-muted">
            Sincronizando atendimentos da semana no Google Agenda...
          </p>
        </div>
      )}

      {/* Grade Semanal Estilo Google Agenda (Desktop / Tablet md+) */}
      {!loading && googleConnected && (
        <>
          <section className="hidden md:block bg-white rounded-3xl border border-brand-border shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[820px]">
                {/* Cabeçalho Fixo dos Dias */}
                <div
                  className="grid border-b border-brand-border bg-brand-cream/40 sticky top-0 z-20"
                  style={{
                    gridTemplateColumns: `68px repeat(${weekColumns.length}, minmax(0, 1fr))`,
                  }}
                >
                  <div className="py-3 px-2 flex flex-col items-center justify-center border-r border-brand-border/70 text-[10px] font-bold uppercase tracking-wider text-brand-muted">
                    BRT
                  </div>

                  {weekColumns.map((col) => {
                    const isToday = col.isoDate === todayISO
                    const dayCount = countByDate[col.isoDate] || 0
                    return (
                      <div
                        key={col.isoDate}
                        className={cn(
                          'py-3 px-2.5 border-r last:border-r-0 border-brand-border/70 flex flex-col items-center justify-center gap-1.5 transition-colors',
                          isToday && 'bg-secondary-50/60',
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              'text-[11px] font-bold uppercase tracking-wider',
                              isToday ? 'text-secondary-700' : 'text-brand-muted',
                            )}
                          >
                            {col.shortWeekday}
                          </span>
                          {isToday && (
                            <span className="px-2 py-0.5 rounded-full bg-secondary-600 text-white text-[10px] font-bold">
                              Hoje
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'w-9 h-9 rounded-full flex items-center justify-center text-base font-extrabold tabular-nums',
                              isToday
                                ? 'bg-primary text-white shadow-sm'
                                : 'text-primary',
                            )}
                          >
                            {col.dayNum}
                          </span>

                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums',
                              dayCount > 0
                                ? 'bg-white border border-brand-border text-primary shadow-sm'
                                : 'text-brand-muted/60',
                            )}
                          >
                            {dayCount}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Faixa de Dia Inteiro (se houver algum evento sem hora específica) */}
                {hasAnyAllDay && (
                  <div
                    className="grid border-b border-brand-border bg-brand-cream/25"
                    style={{
                      gridTemplateColumns: `68px repeat(${weekColumns.length}, minmax(0, 1fr))`,
                    }}
                  >
                    <div className="py-2 px-2 border-r border-brand-border/70 text-[10px] font-semibold text-brand-muted flex items-center justify-center text-center">
                      Dia todo
                    </div>
                    {weekColumns.map((col) => {
                      const items = allDayByDate[col.isoDate] || []
                      return (
                        <div
                          key={col.isoDate}
                          className="p-1.5 border-r last:border-r-0 border-brand-border/70 space-y-1"
                        >
                          {items.map((ev) => (
                            <button
                              key={ev.eventId}
                              type="button"
                              onClick={() => setSelectedEvent(ev)}
                              style={{
                                backgroundColor: ev.color.bg,
                                borderColor: ev.color.border,
                                color: ev.color.text,
                              }}
                              className="w-full flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold shadow-sm hover:scale-[1.01] transition-transform text-left"
                            >
                              <span
                                style={{ backgroundColor: ev.color.dot }}
                                className="w-2 h-2 rounded-full flex-shrink-0"
                              />
                              <span className="truncate">{ev.displayName}</span>
                            </button>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Grade de Horários */}
                <div
                  className="grid relative select-none"
                  style={{
                    gridTemplateColumns: `68px repeat(${weekColumns.length}, minmax(0, 1fr))`,
                    height: `${hoursList.length * HOUR_HEIGHT_PX}px`,
                  }}
                >
                  {/* Coluna das Horas */}
                  <div className="relative border-r border-brand-border/70 bg-brand-cream/20">
                    {hoursList.map((hour, idx) => (
                      <div
                        key={hour}
                        style={{ height: `${HOUR_HEIGHT_PX}px` }}
                        className="relative"
                      >
                        <span
                          className={cn(
                            'absolute right-2.5 text-[11px] font-semibold text-brand-muted tabular-nums bg-white/80 px-1 rounded',
                            idx === 0 ? 'top-1' : '-top-2',
                          )}
                        >
                          {String(hour).padStart(2, '0')}:00
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Colunas dos Dias */}
                  {weekColumns.map((col) => {
                    const isToday = col.isoDate === todayISO
                    const positioned = timedLayoutByDate[col.isoDate] || []

                    return (
                      <div
                        key={col.isoDate}
                        className={cn(
                          'relative border-r last:border-r-0 border-brand-border/70',
                          isToday && 'bg-secondary-50/20',
                        )}
                      >
                        {/* Linhas Horizontais de Hora e Meia Hora */}
                        {hoursList.map((hour) => (
                          <div
                            key={hour}
                            style={{ height: `${HOUR_HEIGHT_PX}px` }}
                            className="border-b border-brand-border/60 relative pointer-events-none"
                          >
                            <div className="absolute inset-x-0 top-1/2 border-b border-dashed border-brand-border/35" />
                          </div>
                        ))}

                        {/* Linha "Agora" para o dia atual */}
                        {isToday && nowTopPx !== null && (
                          <div
                            style={{ top: `${nowTopPx}px` }}
                            className="absolute inset-x-0 z-20 pointer-events-none flex items-center"
                          >
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 -ml-1.5 ring-2 ring-white shadow-sm" />
                            <div className="flex-1 h-[2px] bg-rose-500/80" />
                          </div>
                        )}

                        {/* Pílulas de Atendimento */}
                        {positioned.map((item) => {
                          const { event, startMin, endMin, lane, totalLanes } = item
                          const topPx = ((startMin - startHour * 60) / 60) * HOUR_HEIGHT_PX + 2
                          const rawHeightPx = ((endMin - startMin) / 60) * HOUR_HEIGHT_PX - 4
                          const heightPx = Math.max(rawHeightPx, 28)
                          const isCompact = heightPx < 44
                          const widthPct = 100 / totalLanes
                          const leftPct = lane * widthPct

                          return (
                            <button
                              key={event.eventId}
                              type="button"
                              onClick={() => setSelectedEvent(event)}
                              title={`${event.displayName} • ${event.startTime}${event.endTime !== 'Dia inteiro' ? ` – ${event.endTime}` : ''}`}
                              style={{
                                top: `${topPx}px`,
                                height: `${heightPx}px`,
                                left: `calc(${leftPct}% + 4px)`,
                                width: `calc(${widthPct}% - 8px)`,
                                backgroundColor: event.color.bg,
                                borderColor: event.color.border,
                                color: event.color.text,
                              }}
                              className={cn(
                                'group absolute z-10 border text-left transition-all duration-150 shadow-sm hover:shadow-md hover:z-30 hover:-translate-y-0.5 overflow-hidden cursor-pointer',
                                isCompact
                                  ? 'rounded-full px-2.5 flex items-center gap-1.5'
                                  : 'rounded-full px-3 py-1.5 flex items-center gap-2',
                              )}
                            >
                              {/* Bolinha / Avatar do Paciente */}
                              <span
                                style={{ backgroundColor: event.color.dot }}
                                className={cn(
                                  'rounded-full text-white font-bold flex items-center justify-center flex-shrink-0 shadow-sm',
                                  isCompact
                                    ? 'w-4 h-4 text-[9px]'
                                    : 'w-7 h-7 text-[11px]',
                                )}
                              >
                                {obterIniciaisNome(event.displayName).slice(0, 2)}
                              </span>

                              {/* Conteúdo da Pílula */}
                              <div className="min-w-0 flex-1 leading-tight">
                                <div className="flex items-center justify-between gap-1">
                                  <span
                                    className={cn(
                                      'font-bold truncate',
                                      isCompact ? 'text-[11px]' : 'text-xs',
                                    )}
                                  >
                                    {event.displayName}
                                  </span>
                                </div>

                                {!isCompact && (
                                  <p
                                    style={{ color: event.color.subtext }}
                                    className="text-[10px] font-semibold truncate mt-0.5 tabular-nums"
                                  >
                                    {event.startTime}
                                    {event.endTime && event.endTime !== 'Dia inteiro'
                                      ? ` – ${event.endTime}`
                                      : ''}
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

            {visibleEvents.length === 0 && (
              <div className="py-10 px-6 text-center border-t border-brand-border bg-brand-cream/20">
                <p className="text-sm font-semibold text-primary">
                  Nenhum atendimento com # encontrado para esta seleção.
                </p>
                <p className="text-xs text-brand-muted mt-1">
                  Use as setas acima para navegar entre as semanas ou limpe o filtro ativo.
                </p>
              </div>
            )}
          </section>

          {/* Visualização Mobile (< md): Seletor de Dia em Pílulas + Cards Pílula */}
          <section className="md:hidden space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1.5 overflow-x-auto pb-1 flex-1">
                {weekColumns.map((col) => {
                  const active = !mobileShowAllDays && col.isoDate === mobileDayISO
                  const isToday = col.isoDate === todayISO
                  const cnt = countByDate[col.isoDate] || 0
                  return (
                    <button
                      key={col.isoDate}
                      type="button"
                      onClick={() => {
                        setMobileShowAllDays(false)
                        setMobileDayISO(col.isoDate)
                      }}
                      className={cn(
                        'flex flex-col items-center justify-center min-w-[54px] py-2 px-2.5 rounded-2xl border transition-all flex-shrink-0',
                        active
                          ? 'bg-primary text-white border-primary shadow-sm'
                          : isToday
                            ? 'bg-secondary-50 text-primary border-secondary-300'
                            : 'bg-white text-primary border-brand-border',
                      )}
                    >
                      <span
                        className={cn(
                          'text-[10px] font-bold uppercase',
                          active ? 'text-white/80' : 'text-brand-muted',
                        )}
                      >
                        {col.shortWeekday}
                      </span>
                      <span className="text-base font-extrabold leading-tight mt-0.5 tabular-nums">
                        {col.dayNum}
                      </span>
                      <span
                        className={cn(
                          'mt-1 px-1.5 rounded-full text-[10px] font-bold tabular-nums',
                          active
                            ? 'bg-white/20 text-white'
                            : cnt > 0
                              ? 'bg-brand-cream text-primary'
                              : 'text-brand-muted/60',
                        )}
                      >
                        {cnt}
                      </span>
                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={() => setMobileShowAllDays((v) => !v)}
                className={cn(
                  'px-3 py-2 rounded-2xl border text-xs font-bold flex-shrink-0',
                  mobileShowAllDays
                    ? 'bg-secondary-600 text-white border-secondary-600'
                    : 'bg-white text-primary border-brand-border',
                )}
              >
                {mobileShowAllDays ? 'Só o dia' : 'Semana toda'}
              </button>
            </div>

            <div className="space-y-4">
              {(mobileShowAllDays
                ? weekColumns
                : weekColumns.filter((c) => c.isoDate === mobileDayISO)
              ).map((col) => {
                const dayEvents = visibleEvents
                  .filter((ev) => ev.date === col.isoDate)
                  .sort((a, b) => a.eventDatetime.localeCompare(b.eventDatetime))

                return (
                  <div
                    key={col.isoDate}
                    className="bg-white rounded-3xl border border-brand-border shadow-card p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-brand-border/70">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-primary">
                          {col.fullWeekday}
                        </span>
                        <span className="text-xs font-semibold text-brand-muted">
                          {col.dayNum}/{col.isoDate.slice(5, 7)}
                        </span>
                        {col.isoDate === todayISO && (
                          <span className="px-2 py-0.5 rounded-full bg-secondary-600 text-white text-[10px] font-bold">
                            Hoje
                          </span>
                        )}
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-brand-cream text-primary text-xs font-bold tabular-nums">
                        {dayEvents.length} {dayEvents.length === 1 ? 'atend.' : 'atends.'}
                      </span>
                    </div>

                    {dayEvents.length === 0 ? (
                      <p className="text-xs text-brand-muted py-3 text-center">
                        Nenhum atendimento com # neste dia.
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {dayEvents.map((ev) => (
                          <button
                            key={ev.eventId}
                            type="button"
                            onClick={() => setSelectedEvent(ev)}
                            style={{
                              backgroundColor: ev.color.bg,
                              borderColor: ev.color.border,
                              color: ev.color.text,
                            }}
                            className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-full border shadow-sm active:scale-[0.99] transition-transform text-left"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                style={{ backgroundColor: ev.color.dot }}
                                className="w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0"
                              >
                                {obterIniciaisNome(ev.displayName).slice(0, 2)}
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-bold truncate">{ev.displayName}</p>
                                <p
                                  style={{ color: ev.color.subtext }}
                                  className="text-xs font-semibold tabular-nums"
                                >
                                  {ev.isAllDay
                                    ? 'Dia inteiro'
                                    : `${ev.startTime}${ev.endTime !== 'Dia inteiro' ? ` – ${ev.endTime}` : ''}`}
                                  {ev.durationMinutes ? ` • ${ev.durationMinutes} min` : ''}
                                </p>
                              </div>
                            </div>

                            <span
                              style={{
                                backgroundColor: ev.color.badgeBg,
                                color: ev.color.subtext,
                              }}
                              className="px-2.5 py-1 rounded-full text-[11px] font-bold flex-shrink-0"
                            >
                              {ev.startTime}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        </>
      )}

      {/* Modal de Detalhes da Pílula Selecionada */}
      {selectedEvent && (
        <div
          onClick={() => setSelectedEvent(null)}
          className="fixed inset-0 z-50 bg-primary-900/45 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl border border-brand-border shadow-xl max-w-md w-full overflow-hidden"
          >
            <div
              style={{
                backgroundColor: selectedEvent.color.bg,
                borderBottomColor: selectedEvent.color.border,
              }}
              className="p-6 border-b flex items-start justify-between gap-4"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <span
                  style={{ backgroundColor: selectedEvent.color.dot }}
                  className="w-12 h-12 rounded-full text-white text-base font-extrabold flex items-center justify-center flex-shrink-0 shadow-sm"
                >
                  {obterIniciaisNome(selectedEvent.displayName).slice(0, 2)}
                </span>
                <div className="min-w-0">
                  <p
                    style={{ color: selectedEvent.color.subtext }}
                    className="text-[11px] font-bold uppercase tracking-wider"
                  >
                    Atendimento da Semana
                  </p>
                  <h3
                    style={{ color: selectedEvent.color.text }}
                    className="text-xl font-extrabold truncate mt-0.5"
                  >
                    {selectedEvent.displayName}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="w-8 h-8 rounded-full bg-white/80 hover:bg-white text-primary flex items-center justify-center transition-colors flex-shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 gap-3 text-sm">
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-brand-cream/60 border border-brand-border">
                  <CalendarDays size={18} className="text-secondary-600 flex-shrink-0" />
                  <div>
                    <p className="text-[11px] font-semibold text-brand-muted">Data</p>
                    <p className="font-bold text-primary">
                      {selectedEvent.weekday}, {selectedEvent.displayDate}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-2xl bg-brand-cream/60 border border-brand-border">
                  <Clock size={18} className="text-secondary-600 flex-shrink-0" />
                  <div>
                    <p className="text-[11px] font-semibold text-brand-muted">Horário</p>
                    <p className="font-bold text-primary tabular-nums">
                      {selectedEvent.isAllDay
                        ? 'Dia inteiro'
                        : `${selectedEvent.startTime}${selectedEvent.endTime && selectedEvent.endTime !== 'Dia inteiro' ? ` – ${selectedEvent.endTime}` : ''}`}
                      {selectedEvent.durationMinutes
                        ? ` (${selectedEvent.durationMinutes} min)`
                        : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-2xl bg-brand-cream/60 border border-brand-border">
                  <Hash size={18} className="text-secondary-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-brand-muted">
                      Título no Google Agenda
                    </p>
                    <p className="font-bold text-primary truncate">
                      {selectedEvent.rawSummary}
                    </p>
                    {selectedEvent.wasMapped && (
                      <p className="text-[11px] text-secondary-700 font-medium mt-0.5">
                        Agrupado via Fechamento para "{selectedEvent.displayName}"
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-primary-50/60 border border-primary-100">
                <span className="text-xs font-semibold text-primary">
                  Sessões deste paciente nesta semana
                </span>
                <span className="px-3 py-1 rounded-full bg-primary text-white text-xs font-extrabold tabular-nums">
                  {selectedPatientCountInWeek}
                </span>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const key = selectedEvent.displayName.toLowerCase()
                    setSelectedPatientKey((prev) => (prev === key ? null : key))
                    setSelectedEvent(null)
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-brand-cream hover:bg-secondary-100 text-primary text-xs font-bold transition-colors"
                >
                  <Filter size={14} />
                  {selectedPatientKey === selectedEvent.displayName.toLowerCase()
                    ? 'Mostrar todos'
                    : 'Filtrar na semana'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedEvent(null)
                    navigate('/pacotes')
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-primary-50 hover:bg-primary-100 text-primary text-xs font-bold transition-colors"
                >
                  <PackageCheck size={14} />
                  Pacotes
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedEvent(null)
                    navigate('/fechamento')
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-secondary-50 hover:bg-secondary-100 text-secondary-800 text-xs font-bold transition-colors"
                >
                  <Wallet size={14} />
                  Fechamento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
