import type { AgendaEventItem, AgendaNameMapping } from '@/lib/agendaApi'

export interface PatientColorTheme {
  bg: string
  bgHover: string
  border: string
  text: string
  subtext: string
  dot: string
  badgeBg: string
}

// Paleta com 24 cores distintas e legíveis (estilo pílula editorial)
const CURATED_PILL_PALETTE: PatientColorTheme[] = [
  { bg: '#E6F4F1', bgHover: '#D4ECE7', border: '#7BC4B6', text: '#0F4C42', subtext: '#1F6E61', dot: '#0D9488', badgeBg: '#CCFBF1' }, // Teal
  { bg: '#E8F2FF', bgHover: '#D6E7FF', border: '#8CB8F8', text: '#163E7A', subtext: '#255BA8', dot: '#2563EB', badgeBg: '#DBEAFE' }, // Cobalt
  { bg: '#FEF0E6', bgHover: '#FCE1CE', border: '#F5B07F', text: '#7C2D12', subtext: '#9A3412', dot: '#EA580C', badgeBg: '#FFEDD5' }, // Terracotta
  { bg: '#F3E8FF', bgHover: '#E9D5FF', border: '#C084FC', text: '#4C1D95', subtext: '#6B21A8', dot: '#9333EA', badgeBg: '#F3E8FF' }, // Violet
  { bg: '#FCE7F3', bgHover: '#FBCFE8', border: '#F472B6', text: '#831843', subtext: '#9D174D', dot: '#DB2777', badgeBg: '#FCE7F3' }, // Berry
  { bg: '#ECFCCB', bgHover: '#D9F99D', border: '#A3E635', text: '#365314', subtext: '#4D7C0F', dot: '#65A30D', badgeBg: '#ECFCCB' }, // Lime
  { bg: '#FEF9C3', bgHover: '#FEF08A', border: '#FACC15', text: '#713F12', subtext: '#854D0E', dot: '#CA8A04', badgeBg: '#FEF9C3' }, // Gold
  { bg: '#E0F2FE', bgHover: '#BAE6FD', border: '#38BDF8', text: '#0C4A6E', subtext: '#0369A1', dot: '#0284C7', badgeBg: '#E0F2FE' }, // Sky
  { bg: '#FFE4E6', bgHover: '#FECDD3', border: '#FB7185', text: '#881337', subtext: '#9F1239', dot: '#E11D48', badgeBg: '#FFE4E6' }, // Rose
  { bg: '#E0E7FF', bgHover: '#C7D2FE', border: '#818CF8', text: '#312E81', subtext: '#3730A3', dot: '#4F46E5', badgeBg: '#E0E7FF' }, // Indigo
  { bg: '#DCFCE7', bgHover: '#BBF7D0', border: '#4ADE80', text: '#14532D', subtext: '#166534', dot: '#16A34A', badgeBg: '#DCFCE7' }, // Emerald
  { bg: '#FAE8FF', bgHover: '#F5D0FE', border: '#E879F9', text: '#701A75', subtext: '#86198F', dot: '#C026D3', badgeBg: '#FAE8FF' }, // Fuchsia
  { bg: '#FFEDD5', bgHover: '#FED7AA', border: '#FB923C', text: '#7C2D12', subtext: '#9A3412', dot: '#F97316', badgeBg: '#FFEDD5' }, // Apricot
  { bg: '#CFFAFE', bgHover: '#A5F3FC', border: '#22D3EE', text: '#164E63', subtext: '#155E75', dot: '#0891B2', badgeBg: '#CFFAFE' }, // Cyan
  { bg: '#FEF3C7', bgHover: '#FDE68A', border: '#FBBF24', text: '#78350F', subtext: '#92400E', dot: '#D97706', badgeBg: '#FEF3C7' }, // Amber
  { bg: '#E2E8F0', bgHover: '#CBD5E1', border: '#94A3B8', text: '#1E293B', subtext: '#334155', dot: '#475569', badgeBg: '#F1F5F9' }, // Slate
  { bg: '#D1FAE5', bgHover: '#A7F3D0', border: '#34D399', text: '#064E3B', subtext: '#065F46', dot: '#059669', badgeBg: '#D1FAE5' }, // Mint
  { bg: '#EDE9FE', bgHover: '#DDD6FE', border: '#A78BFA', text: '#4C1D95', subtext: '#5B21B6', dot: '#7C3AED', badgeBg: '#EDE9FE' }, // Lavender
  { bg: '#FEE2E2', bgHover: '#FECACA', border: '#F87171', text: '#7F1D1D', subtext: '#991B1B', dot: '#DC2626', badgeBg: '#FEE2E2' }, // Coral Red
  { bg: '#F1F5F9', bgHover: '#E2E8F0', border: '#64748B', text: '#0F172A', subtext: '#334155', dot: '#0284C7', badgeBg: '#E2E8F0' }, // Steel
  { bg: '#ECFDF5', bgHover: '#D1FAE5', border: '#6EE7B7', text: '#065F46', subtext: '#047857', dot: '#10B981', badgeBg: '#D1FAE5' }, // Jade
  { bg: '#FFF1F2', bgHover: '#FFE4E6', border: '#FDA4AF', text: '#9F1239', subtext: '#BE123C', dot: '#F43F5E', badgeBg: '#FFE4E6' }, // Flamingo
  { bg: '#EEF2FF', bgHover: '#E0E7FF', border: '#A5B4FC', text: '#1E1B4B', subtext: '#3730A3', dot: '#6366F1', badgeBg: '#E0E7FF' }, // Periwinkle
  { bg: '#F7FEE7', bgHover: '#ECFCCB', border: '#BEF264', text: '#3F6212', subtext: '#4D7C0F', dot: '#84CC16', badgeBg: '#ECFCCB' }, // Pistachio
]

function hashString(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function buildFallbackTheme(extraIndex: number): PatientColorTheme {
  const hue = Math.round((extraIndex * 137.508 + 25) % 360)
  return {
    bg: `hsl(${hue}, 82%, 94%)`,
    bgHover: `hsl(${hue}, 82%, 89%)`,
    border: `hsl(${hue}, 65%, 68%)`,
    text: `hsl(${hue}, 70%, 22%)`,
    subtext: `hsl(${hue}, 65%, 32%)`,
    dot: `hsl(${hue}, 72%, 44%)`,
    badgeBg: `hsl(${hue}, 80%, 90%)`,
  }
}

export function assignPatientColors(patientNames: string[]): Map<string, PatientColorTheme> {
  const uniqueSorted = Array.from(new Set(patientNames.map((n) => n.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  )
  const map = new Map<string, PatientColorTheme>()
  const usedSlots = new Set<number>()
  let overflowCount = 0

  for (const name of uniqueSorted) {
    const key = name.toLowerCase()
    let slot = hashString(key) % CURATED_PILL_PALETTE.length
    let attempts = 0
    while (usedSlots.has(slot) && attempts < CURATED_PILL_PALETTE.length) {
      slot = (slot + 1) % CURATED_PILL_PALETTE.length
      attempts += 1
    }

    if (!usedSlots.has(slot)) {
      usedSlots.add(slot)
      map.set(key, CURATED_PILL_PALETTE[slot])
    } else {
      map.set(key, buildFallbackTheme(overflowCount))
      overflowCount += 1
    }
  }

  return map
}

export function getLocalTodayISO(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  return parts // YYYY-MM-DD
}

export function getSaoPauloNowMinutes(): number {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const map: Record<string, string> = {}
  for (const p of parts) map[p.type] = p.value
  return Number(map.hour || 0) * 60 + Number(map.minute || 0)
}

export function getMondayOfWeek(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  const dow = dt.getUTCDay()
  const diffToMonday = dow === 0 ? -6 : 1 - dow
  dt.setUTCDate(dt.getUTCDate() + diffToMonday)
  return dt.toISOString().slice(0, 10)
}

export function addDaysISO(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

export interface WeekDayColumn {
  isoDate: string
  dayNum: string
  shortWeekday: string
  fullWeekday: string
  isSunday: boolean
}

const SHORT_DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const FULL_DAYS_PT = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
]
const MONTHS_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

export function buildWeekColumns(mondayISO: string, includeSunday: boolean): WeekDayColumn[] {
  const count = includeSunday ? 7 : 6
  const cols: WeekDayColumn[] = []
  for (let i = 0; i < count; i++) {
    const isoDate = addDaysISO(mondayISO, i)
    const [y, m, d] = isoDate.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
    const dow = dt.getUTCDay()
    cols.push({
      isoDate,
      dayNum: String(d).padStart(2, '0'),
      shortWeekday: SHORT_DAYS_PT[dow],
      fullWeekday: FULL_DAYS_PT[dow],
      isSunday: dow === 0,
    })
  }
  return cols
}

export function formatWeekRangeLabel(startISO: string, endISO: string): string {
  const [sy, sm, sd] = startISO.split('-').map(Number)
  const [ey, em, ed] = endISO.split('-').map(Number)
  if (sy === ey && sm === em) {
    return `${sd} – ${ed} de ${MONTHS_PT[sm - 1]} de ${sy}`
  }
  if (sy === ey) {
    return `${sd} de ${MONTHS_PT[sm - 1].slice(0, 3)} – ${ed} de ${MONTHS_PT[em - 1].slice(0, 3)} de ${sy}`
  }
  return `${sd}/${String(sm).padStart(2, '0')}/${sy} – ${ed}/${String(em).padStart(2, '0')}/${ey}`
}

export interface ResolvedAgendaEvent extends AgendaEventItem {
  displayName: string
  wasMapped: boolean
  color: PatientColorTheme
}

export function resolveAgendaEvents(
  events: AgendaEventItem[],
  mappings: AgendaNameMapping[],
): ResolvedAgendaEvent[] {
  const byMonth: Record<string, Record<string, string>> = {}
  const fallback: Record<string, string> = {}

  for (const m of mappings) {
    if (!byMonth[m.month_key]) byMonth[m.month_key] = {}
    const oldLow = m.old_name.toLowerCase().trim()
    byMonth[m.month_key][oldLow] = m.new_name
    fallback[oldLow] = m.new_name
  }

  const prelim = events.map((ev) => {
    const low = ev.calendarName.toLowerCase().trim()
    const mapped = byMonth[ev.monthKey]?.[low] || fallback[low]
    const displayName = mapped ? mapped.trim() : ev.calendarName
    return {
      ...ev,
      displayName,
      wasMapped: Boolean(mapped && mapped.trim().toLowerCase() !== low),
    }
  })

  const colorsMap = assignPatientColors(prelim.map((e) => e.displayName))
  const defaultTheme = CURATED_PILL_PALETTE[0]

  return prelim.map((ev) => ({
    ...ev,
    color: colorsMap.get(ev.displayName.toLowerCase()) || defaultTheme,
  }))
}

export function parseTimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 8 * 60
  return h * 60 + m
}

export interface PositionedAgendaEvent {
  event: ResolvedAgendaEvent
  startMin: number
  endMin: number
  lane: number
  totalLanes: number
}

// Algoritmo estilo Google Agenda para organizar eventos sobrepostos lado a lado
export function layoutDayTimedEvents(events: ResolvedAgendaEvent[]): PositionedAgendaEvent[] {
  const timed = events
    .filter((e) => !e.isAllDay && /^\d{2}:\d{2}$/.test(e.startTime))
    .map((event) => {
      const startMin = parseTimeToMinutes(event.startTime)
      const dur = Math.max(event.durationMinutes || 50, 25)
      const endMin = Math.min(startMin + dur, 23 * 60 + 55)
      return { event, startMin, endMin }
    })
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)

  const positioned: PositionedAgendaEvent[] = []
  let cluster: Array<{ event: ResolvedAgendaEvent; startMin: number; endMin: number; lane: number }> = []
  let clusterEnd = -1

  const flushCluster = () => {
    if (cluster.length === 0) return
    const totalLanes = Math.max(...cluster.map((c) => c.lane)) + 1
    for (const item of cluster) {
      positioned.push({
        event: item.event,
        startMin: item.startMin,
        endMin: item.endMin,
        lane: item.lane,
        totalLanes,
      })
    }
    cluster = []
    clusterEnd = -1
  }

  let laneEnds: number[] = []

  for (const item of timed) {
    if (cluster.length > 0 && item.startMin >= clusterEnd) {
      flushCluster()
      laneEnds = []
    }

    let chosenLane = laneEnds.findIndex((end) => end <= item.startMin)
    if (chosenLane === -1) {
      chosenLane = laneEnds.length
      laneEnds.push(item.endMin)
    } else {
      laneEnds[chosenLane] = item.endMin
    }

    cluster.push({ ...item, lane: chosenLane })
    clusterEnd = Math.max(clusterEnd, item.endMin)
  }

  flushCluster()
  return positioned
}

export function computeHourBounds(events: ResolvedAgendaEvent[]): { startHour: number; endHour: number } {
  let minHour = 7
  let maxHour = 20

  for (const ev of events) {
    if (ev.isAllDay || !/^\d{2}:\d{2}$/.test(ev.startTime)) continue
    const startMin = parseTimeToMinutes(ev.startTime)
    const endMin = startMin + Math.max(ev.durationMinutes || 50, 30)
    minHour = Math.min(minHour, Math.floor(startMin / 60))
    maxHour = Math.max(maxHour, Math.ceil(endMin / 60))
  }

  return {
    startHour: Math.max(0, minHour),
    endHour: Math.min(24, Math.max(minHour + 6, maxHour)),
  }
}
