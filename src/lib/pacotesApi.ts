import { supabase } from './supabase'
import { GoogleAuthRequiredError } from './fechamentoApi'

export type PackageType = '5' | '10' | 'individual' | 'personalizado'
export type PackageStatus = 'active' | 'completed' | 'cancelled'

export interface CalendarEventItem {
  eventId: string
  date: string // YYYY-MM-DD
  displayDate: string // DD/MM/YYYY
  weekday: string
  startTime: string
  eventDatetime: string
  monthKey: string // YYYY-MM
  rawSummary: string
  calendarName: string
}

export interface PatientCalendarLink {
  id: string
  paciente_id: string
  calendar_name: string
  created_at: string
}

export interface NameMappingRow {
  month_key: string
  old_name: string
  new_name: string
}

export interface PackageRecord {
  id: string
  paciente_id: string | null
  package_type: PackageType
  label: string | null
  total_sessions: number
  session_price: number
  start_date: string | null // YYYY-MM-DD
  initial_offset: number
  status: PackageStatus
  is_paid: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface PackageSessionRecord {
  id: string
  package_id: string
  calendar_event_id: string
  event_date: string // YYYY-MM-DD
  event_datetime: string | null
  calendar_summary: string
  calendar_name: string
  notes: string | null
  created_at: string
}

export interface PackageExclusionRecord {
  calendar_event_id: string
  paciente_id: string | null
  event_date: string | null
  calendar_summary: string | null
  status: 'pending' | 'ignored'
  reason: string | null
  created_at: string
}

export interface PacotesOverviewResponse {
  today: string
  window: {
    prevMonth: string
    currentMonth: string
    nextMonth: string
    months: string[]
    startDate: string
    endDate: string
  }
  googleConnected: boolean
  googleAuthExpired?: boolean
  googleError: string | null
  events: CalendarEventItem[]
  links: PatientCalendarLink[]
  mappings: NameMappingRow[]
  prices?: Record<string, number>
  packages: PackageRecord[]
  sessions: PackageSessionRecord[]
  exclusions: PackageExclusionRecord[]
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const headers: Record<string, string> = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const authHeaders = await getAuthHeaders()
  const headers: Record<string, string> = {
    ...authHeaders,
    ...(init.headers as Record<string, string> | undefined),
  }

  const res = await fetch(url, {
    ...init,
    headers,
    credentials: 'include',
  })

  if (!res.ok) {
    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const json = await res.json().catch(() => null)
      if (res.status === 401 && json?.code === 'GOOGLE_AUTH_REQUIRED') {
        throw new GoogleAuthRequiredError(json.error)
      }
      throw new Error(json?.error || `Erro na requisição (${res.status})`)
    }
    const text = await res.text().catch(() => '')
    throw new Error(text || `Erro na requisição (${res.status})`)
  }

  return res.json() as Promise<T>
}

export async function fetchPacotesOverview(baseMonth?: string): Promise<PacotesOverviewResponse> {
  const qs = baseMonth ? `?baseMonth=${encodeURIComponent(baseMonth)}` : ''
  return apiFetch<PacotesOverviewResponse>(`/api/pacotes/overview${qs}`)
}

export async function linkCalendarNames(
  pacienteId: string,
  calendarNames: string[]
): Promise<{ ok: boolean; links: PatientCalendarLink[] }> {
  return apiFetch('/api/pacotes/links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paciente_id: pacienteId, calendar_names: calendarNames }),
  })
}

export async function unlinkCalendarName(linkId: string): Promise<void> {
  await apiFetch(`/api/pacotes/links/${encodeURIComponent(linkId)}`, {
    method: 'DELETE',
  })
}

export interface CreatePackageInput {
  paciente_id: string
  package_type: PackageType
  label?: string
  total_sessions: number
  session_price: number
  start_date: string | null
  initial_offset: number
  is_paid?: boolean
  notes?: string
  attach_events?: CalendarEventItem[]
}

export async function createPackage(input: CreatePackageInput): Promise<{ ok: boolean; package: PackageRecord }> {
  return apiFetch('/api/pacotes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function updatePackage(
  id: string,
  updates: Partial<{
    paciente_id: string | null
    package_type: PackageType
    label: string | null
    total_sessions: number
    session_price: number
    start_date: string | null
    initial_offset: number
    status: PackageStatus
    is_paid: boolean
    notes: string | null
    clear_sessions: boolean
  }>
): Promise<void> {
  await apiFetch(`/api/pacotes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
}

export async function deletePackage(id: string): Promise<void> {
  await apiFetch(`/api/pacotes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export async function assignSessionToPackage(
  packageId: string,
  event: CalendarEventItem
): Promise<void> {
  await apiFetch('/api/pacotes/sessions/assign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ package_id: packageId, event }),
  })
}

export async function replaceSessionInPackage(
  packageId: string,
  oldCalendarEventId: string,
  newEvent: CalendarEventItem
): Promise<void> {
  await apiFetch('/api/pacotes/sessions/replace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      package_id: packageId,
      old_calendar_event_id: oldCalendarEventId,
      new_event: newEvent,
    }),
  })
}

export async function detachSessionFromPackage(params: {
  calendar_event_id: string
  paciente_id: string | null
  event_date: string
  calendar_summary: string
}): Promise<void> {
  await apiFetch('/api/pacotes/sessions/detach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
}

export async function moveSessionToPackage(
  calendarEventId: string,
  targetPackageId: string
): Promise<void> {
  await apiFetch('/api/pacotes/sessions/move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      calendar_event_id: calendarEventId,
      target_package_id: targetPackageId,
    }),
  })
}

export async function ignoreCalendarEvent(params: {
  calendar_event_id: string
  paciente_id?: string | null
  event_date?: string
  calendar_summary?: string
  reason?: string
}): Promise<void> {
  await apiFetch('/api/pacotes/sessions/ignore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
}

export async function restoreIgnoredCalendarEvent(eventId: string): Promise<void> {
  await apiFetch(`/api/pacotes/sessions/ignore/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
  })
}
