import type { Paciente } from '@/types'
import type {
  CalendarEventItem,
  NameMappingRow,
  PackageExclusionRecord,
  PackageRecord,
  PackageSessionRecord,
  PackageType,
  PatientCalendarLink,
} from '@/lib/pacotesApi'

export const PACOTE_CUTOFF_DATE = '2026-11-01'

export function formatBRL(value: number): string {
  return `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`
}

export function formatISODateToBR(isoDate?: string | null): string {
  if (!isoDate) return '—'
  const [y, m, d] = isoDate.slice(0, 10).split('-')
  if (!y || !m || !d) return isoDate
  return `${d}/${m}/${y}`
}

export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  const names = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ]
  if (!y || !m || m < 1 || m > 12) return monthKey
  return `${names[m - 1]}/${y}`
}

export function getPackageTypeLabel(type: PackageType, total: number): string {
  if (type === 'individual') return 'Individual (1 sessão)'
  if (type === '5') return 'Pacote 5 sessões'
  if (type === '10') return 'Pacote 10 sessões'
  return `Personalizado (${total} sessões)`
}

export function getWeekBounds(todayISO: string): { weekStart: string; weekEnd: string } {
  const [y, m, d] = todayISO.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  const day = date.getUTCDay() // 0 = domingo, 1 = segunda ...
  const diffToMonday = day === 0 ? -6 : 1 - day

  const monday = new Date(date)
  monday.setUTCDate(date.getUTCDate() + diffToMonday)

  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)

  return {
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd: sunday.toISOString().slice(0, 10),
  }
}

export function shiftISODate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export interface ComputedSessionItem extends PackageSessionRecord {
  sessionNumber: number
  isCompleted: boolean // event_date <= today
  displayDate: string
}

export interface ComputedPackage {
  pkg: PackageRecord
  paciente: Paciente | undefined
  sessions: ComputedSessionItem[]
  usedTotal: number
  completedCount: number
  scheduledFutureCount: number
  remainingCount: number
  totalValue: number
  needsStartDate: boolean
  isNearEnd: boolean // falta 1 ou 0 e já iniciou
}

export interface ResolvedCalendarEvent extends CalendarEventItem {
  pacienteId: string | null
  pacienteNome: string | null
  sessionRecord: PackageSessionRecord | null
  packageRecord: ComputedPackage | null
  sessionNumber: number | null
  exclusion: PackageExclusionRecord | null
  isFromCutoff: boolean // >= 2026-11-01
  isInCurrentWeek: boolean
  pendingKind:
    | 'unlinked_patient'
    | 'detached_pending'
    | 'no_package'
    | 'ignored'
    | 'assigned'
    | 'legacy_ok'
}

export interface UnlinkedCalendarNameGroup {
  calendarName: string
  mappedToName: string | null
  eventsCount: number
  cutoffEventsCount: number
  sampleDates: string[]
  latestEvent: CalendarEventItem
}

export interface PatientAliasesSummary {
  paciente: Paciente
  directLinks: PatientCalendarLink[]
  groupedAliasesFromFechamento: string[]
  packages: ComputedPackage[]
  pendingEvents: ResolvedCalendarEvent[]
  legacyEvents: ResolvedCalendarEvent[]
}

export function computePacotesState(params: {
  today: string
  selectedWeekStart?: string
  pacientes: Paciente[]
  events: CalendarEventItem[]
  links: PatientCalendarLink[]
  mappings: NameMappingRow[]
  packages: PackageRecord[]
  sessions: PackageSessionRecord[]
  exclusions: PackageExclusionRecord[]
}) {
  const {
    today,
    selectedWeekStart,
    pacientes,
    events,
    links,
    mappings,
    packages,
    sessions,
    exclusions,
  } = params

  const pacienteById = new Map(pacientes.map((p) => [p.id, p]))
  const { weekStart, weekEnd } = getWeekBounds(selectedWeekStart || today)

  // Mapas de resolução 1-para-N (links diretos + agrupamentos do Fechamento)
  const linkByLower = new Map<string, PatientCalendarLink>()
  const linksByPaciente = new Map<string, PatientCalendarLink[]>()
  for (const l of links) {
    linkByLower.set(l.calendar_name.toLowerCase().trim(), l)
    const arr = linksByPaciente.get(l.paciente_id) || []
    arr.push(l)
    linksByPaciente.set(l.paciente_id, arr)
  }

  const mappingByMonth = new Map<string, Map<string, string>>()
  const fallbackMapping = new Map<string, string>()
  const aliasesByTargetLower = new Map<string, Set<string>>()

  for (const m of mappings) {
    if (!mappingByMonth.has(m.month_key)) mappingByMonth.set(m.month_key, new Map())
    const oldLow = m.old_name.toLowerCase().trim()
    mappingByMonth.get(m.month_key)!.set(oldLow, m.new_name)
    fallbackMapping.set(oldLow, m.new_name)

    const targetLow = m.new_name.toLowerCase().trim()
    if (!aliasesByTargetLower.has(targetLow)) aliasesByTargetLower.set(targetLow, new Set())
    aliasesByTargetLower.get(targetLow)!.add(m.old_name)
  }

  const resolveCalendarName = (calendarName: string, monthKey: string) => {
    const low = calendarName.toLowerCase().trim()
    const direct = linkByLower.get(low)
    if (direct) return { pacienteId: direct.paciente_id, mappedName: null }

    const mapped = mappingByMonth.get(monthKey)?.get(low) || fallbackMapping.get(low) || null
    if (mapped) {
      const targetLink = linkByLower.get(mapped.toLowerCase().trim())
      if (targetLink) return { pacienteId: targetLink.paciente_id, mappedName: mapped }
    }
    return { pacienteId: null, mappedName: mapped }
  }

  // Sessões indexadas
  const sessionByEventId = new Map(sessions.map((s) => [s.calendar_event_id, s]))
  const sessionsByPkg = new Map<string, PackageSessionRecord[]>()
  for (const s of sessions) {
    const arr = sessionsByPkg.get(s.package_id) || []
    arr.push(s)
    sessionsByPkg.set(s.package_id, arr)
  }

  const exclusionByEventId = new Map(exclusions.map((x) => [x.calendar_event_id, x]))

  // Computar pacotes
  const computedPkgById = new Map<string, ComputedPackage>()
  const sessionNumberByEventId = new Map<string, number>()

  for (const pkg of packages) {
    const rawPkgSessions = (sessionsByPkg.get(pkg.id) || []).slice().sort((a, b) => {
      const cmp = a.event_date.localeCompare(b.event_date)
      if (cmp !== 0) return cmp
      return (a.event_datetime || '').localeCompare(b.event_datetime || '')
    })

    const offset = pkg.initial_offset || 0
    const computedSessions: ComputedSessionItem[] = rawPkgSessions.map((s, idx) => {
      const sessionNumber = offset + idx + 1
      sessionNumberByEventId.set(s.calendar_event_id, sessionNumber)
      return {
        ...s,
        sessionNumber,
        isCompleted: s.event_date <= today,
        displayDate: formatISODateToBR(s.event_date),
      }
    })

    const usedTotal = offset + computedSessions.length
    const completedCount = offset + computedSessions.filter((s) => s.isCompleted).length
    const scheduledFutureCount = computedSessions.filter((s) => !s.isCompleted).length
    const remainingCount = Math.max(0, pkg.total_sessions - usedTotal)
    const needsStartDate = !pkg.start_date && pkg.status !== 'cancelled'
    const isNearEnd = pkg.status !== 'cancelled' && remainingCount <= 1 && usedTotal > 0

    computedPkgById.set(pkg.id, {
      pkg,
      paciente: pkg.paciente_id ? pacienteById.get(pkg.paciente_id) : undefined,
      sessions: computedSessions,
      usedTotal,
      completedCount,
      scheduledFutureCount,
      remainingCount,
      totalValue: pkg.total_sessions * (pkg.session_price || 0),
      needsStartDate,
      isNearEnd,
    })
  }

  // Classificar eventos da agenda
  const unlinkedMap = new Map<string, UnlinkedCalendarNameGroup>()

  const resolvedEvents: ResolvedCalendarEvent[] = events.map((ev) => {
    const { pacienteId, mappedName } = resolveCalendarName(ev.calendarName, ev.monthKey)
    const sessionRec = sessionByEventId.get(ev.eventId) || null
    const exclusionRec = exclusionByEventId.get(ev.eventId) || null
    const pkgComputed = sessionRec ? computedPkgById.get(sessionRec.package_id) || null : null
    const effectivePacienteId = pacienteId || pkgComputed?.pkg.paciente_id || null
    const paciente = effectivePacienteId ? pacienteById.get(effectivePacienteId) : undefined
    const isFromCutoff = ev.date >= PACOTE_CUTOFF_DATE
    const isInCurrentWeek = ev.date >= weekStart && ev.date <= weekEnd

    let pendingKind: ResolvedCalendarEvent['pendingKind']
    if (sessionRec && pkgComputed) {
      pendingKind = 'assigned'
    } else if (exclusionRec?.status === 'ignored') {
      pendingKind = 'ignored'
    } else if (!effectivePacienteId) {
      pendingKind = isFromCutoff ? 'unlinked_patient' : 'legacy_ok'
      if (isFromCutoff) {
        const key = ev.calendarName.toLowerCase().trim()
        const existingGroup = unlinkedMap.get(key)
        if (!existingGroup) {
          unlinkedMap.set(key, {
            calendarName: ev.calendarName,
            mappedToName: mappedName,
            eventsCount: 1,
            cutoffEventsCount: 1,
            sampleDates: [ev.displayDate],
            latestEvent: ev,
          })
        } else {
          existingGroup.eventsCount += 1
          existingGroup.cutoffEventsCount += 1
          if (existingGroup.sampleDates.length < 4 && !existingGroup.sampleDates.includes(ev.displayDate)) {
            existingGroup.sampleDates.push(ev.displayDate)
          }
          existingGroup.latestEvent = ev
        }
      }
    } else if (exclusionRec?.status === 'pending') {
      pendingKind = 'detached_pending'
    } else if (isFromCutoff) {
      pendingKind = 'no_package'
    } else {
      pendingKind = 'legacy_ok'
    }

    return {
      ...ev,
      pacienteId: effectivePacienteId,
      pacienteNome: paciente?.nome || null,
      sessionRecord: sessionRec,
      packageRecord: pkgComputed,
      sessionNumber: sessionRec ? sessionNumberByEventId.get(sessionRec.calendar_event_id) || null : null,
      exclusion: exclusionRec,
      isFromCutoff,
      isInCurrentWeek,
      pendingKind,
    }
  })

  // Agrupar por paciente único
  const patientSummaries: PatientAliasesSummary[] = pacientes.map((paciente) => {
    const directLinks = linksByPaciente.get(paciente.id) || []
    const directLowers = new Set(directLinks.map((l) => l.calendar_name.toLowerCase().trim()))
    const groupedSet = new Set<string>()
    for (const l of directLinks) {
      const aliases = aliasesByTargetLower.get(l.calendar_name.toLowerCase().trim())
      if (aliases) {
        for (const a of aliases) {
          if (!directLowers.has(a.toLowerCase().trim())) {
            groupedSet.add(a)
          }
        }
      }
    }

    const patientPackages = Array.from(computedPkgById.values())
      .filter((cp) => cp.pkg.paciente_id === paciente.id)
      .sort((a, b) => {
        if (!a.pkg.start_date && b.pkg.start_date) return -1
        if (a.pkg.start_date && !b.pkg.start_date) return 1
        return (b.pkg.start_date || '').localeCompare(a.pkg.start_date || '')
      })

    const patientEvents = resolvedEvents.filter((ev) => ev.pacienteId === paciente.id)
    const pendingEvents = patientEvents.filter(
      (ev) => ev.pendingKind === 'no_package' || ev.pendingKind === 'detached_pending'
    )
    const legacyEvents = patientEvents.filter((ev) => ev.pendingKind === 'legacy_ok')

    return {
      paciente,
      directLinks,
      groupedAliasesFromFechamento: Array.from(groupedSet).sort(),
      packages: patientPackages,
      pendingEvents,
      legacyEvents,
    }
  })

  const allComputedPackages = Array.from(computedPkgById.values())
  const unassignedPatientPackages = allComputedPackages.filter(
    (cp) => !cp.pkg.paciente_id && cp.pkg.status !== 'cancelled'
  )
  const packagesWithoutStartDate = allComputedPackages.filter((cp) => cp.needsStartDate)
  const weekEvents = resolvedEvents.filter((ev) => ev.isInCurrentWeek && ev.pendingKind !== 'ignored')
  const pendingEventsFromCutoff = resolvedEvents.filter(
    (ev) => ev.pendingKind === 'no_package' || ev.pendingKind === 'detached_pending'
  )
  const unlinkedGroups = Array.from(unlinkedMap.values()).sort((a, b) =>
    a.calendarName.localeCompare(b.calendarName)
  )
  const ignoredEvents = resolvedEvents.filter((ev) => ev.pendingKind === 'ignored')

  return {
    weekBounds: { weekStart, weekEnd },
    allComputedPackages,
    unassignedPatientPackages,
    packagesWithoutStartDate,
    resolvedEvents,
    weekEvents,
    pendingEventsFromCutoff,
    unlinkedGroups,
    ignoredEvents,
    patientSummaries,
  }
}
