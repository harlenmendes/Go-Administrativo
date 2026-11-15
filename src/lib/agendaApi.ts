import { supabase } from './supabase'
import { GoogleAuthRequiredError } from './fechamentoApi'

export interface AgendaEventItem {
  eventId: string
  date: string // YYYY-MM-DD
  displayDate: string // DD/MM/YYYY
  weekday: string
  startTime: string // HH:MM or 'Dia inteiro'
  endTime: string // HH:MM or 'Dia inteiro'
  isAllDay: boolean
  durationMinutes: number | null
  eventDatetime: string
  endDatetime: string
  monthKey: string // YYYY-MM
  rawSummary: string
  calendarName: string
}

export interface AgendaNameMapping {
  month_key: string
  old_name: string
  new_name: string
}

export interface AgendaSemanaResponse {
  today: string
  startDate: string
  endDate: string
  googleConnected: boolean
  googleError: string | null
  events: AgendaEventItem[]
  mappings: AgendaNameMapping[]
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

export async function fetchAgendaSemana(
  startDate?: string,
  endDate?: string,
): Promise<AgendaSemanaResponse> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams()
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)

  const qs = params.toString()
  const res = await fetch(`/api/agenda/semana${qs ? `?${qs}` : ''}`, {
    headers,
    credentials: 'include',
  })

  if (!res.ok) {
    const json = await res.json().catch(() => null)
    if (res.status === 401 && json?.code === 'GOOGLE_AUTH_REQUIRED') {
      throw new GoogleAuthRequiredError(json.error)
    }
    throw new Error(json?.error || `Erro ao carregar agenda (${res.status})`)
  }

  return res.json() as Promise<AgendaSemanaResponse>
}
