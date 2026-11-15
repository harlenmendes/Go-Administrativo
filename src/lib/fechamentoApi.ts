import { supabase } from './supabase'

export interface GoogleAuthStatus {
  authenticated: boolean
  googleConnected: boolean
  name?: string
  email?: string
  supabaseConfigured?: boolean
}

export interface CalendarPatientRaw {
  name: string
  count: number
  dates: string[]
}

export interface FechamentoPatientRow {
  name: string
  count: number
  price: number
  statusPago: 'Não' | 'Sim' | 'Parcial'
  valorRecebido: number
  dates: string[]
}

export type PricesMap = Record<string, number>
export type MappingsByMonth = Record<string, Record<string, string>>

export class GoogleAuthRequiredError extends Error {
  code = 'GOOGLE_AUTH_REQUIRED'
  constructor(message = 'Conecte sua conta Google para acessar a agenda e planilhas.') {
    super(message)
  }
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

export function getGoogleConnectUrl(returnTo = '/fechamento'): string {
  return `/oauth2/authorization/google?returnTo=${encodeURIComponent(returnTo)}`
}

export async function getGoogleAuthStatus(): Promise<GoogleAuthStatus> {
  return apiFetch<GoogleAuthStatus>('/api/auth/status')
}

export async function disconnectGoogle(): Promise<void> {
  await apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' })
}

export async function fetchSavedPrices(): Promise<PricesMap> {
  return apiFetch<PricesMap>('/api/prices')
}

export async function savePrice(name: string, price: number): Promise<void> {
  await apiFetch('/api/prices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, price }),
  })
}

export async function syncPrices(prices: PricesMap): Promise<void> {
  await apiFetch('/api/prices/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prices),
  })
}

export async function deleteSavedPrice(name: string): Promise<void> {
  await apiFetch(`/api/prices/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  })
}

export async function fetchSavedMappings(): Promise<MappingsByMonth> {
  return apiFetch<MappingsByMonth>('/api/mappings')
}

export async function saveMapping(month: string, oldName: string, newName: string): Promise<void> {
  await apiFetch('/api/mappings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ month, oldName, newName }),
  })
}

export async function syncMappings(mappings: MappingsByMonth): Promise<void> {
  await apiFetch('/api/mappings/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mappings),
  })
}

export async function resetMonthMappings(month: string): Promise<void> {
  await apiFetch(`/api/mappings/reset?month=${encodeURIComponent(month)}`, {
    method: 'DELETE',
  })
}

export async function fetchCalendarAtendimentos(months: string[]): Promise<CalendarPatientRaw[]> {
  const qs = months.map((m) => `meses=${encodeURIComponent(m)}`).join('&')
  return apiFetch<CalendarPatientRaw[]>(`/api/atendimentos?${qs}`)
}

export async function exportFechamentoToSheets(
  months: string[],
  patients: FechamentoPatientRow[]
): Promise<{ url: string }> {
  const qs = months.map((m) => `meses=${encodeURIComponent(m)}`).join('&')
  return apiFetch<{ url: string }>(`/api/exportar?${qs}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patients),
  })
}

