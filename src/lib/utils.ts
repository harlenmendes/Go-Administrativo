import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { EfeitoClinico } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calcularIdade(dataNascimento: string): number {
  const hoje = new Date()
  const nasc = new Date(dataNascimento)
  let idade = hoje.getFullYear() - nasc.getFullYear()
  const m = hoje.getMonth() - nasc.getMonth()
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) {
    idade--
  }
  return idade
}

export function formatarData(dataStr: string): string {
  if (!dataStr) return ''
  const trimmed = dataStr.trim()
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed

  const dataOnly = trimmed.split('T')[0].split(' ')[0]
  const partes = dataOnly.split('-')
  if (partes.length === 3) {
    const [y, m, d] = partes
    if (y.length === 4 && m && d) {
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`
    }
  }

  const data = new Date(dataOnly + 'T00:00:00')
  if (isNaN(data.getTime())) return 'Data inválida'
  const d = String(data.getDate()).padStart(2, '0')
  const m = String(data.getMonth() + 1).padStart(2, '0')
  const y = data.getFullYear()
  return `${d}/${m}/${y}`
}

export function formatarDataCurta(dataStr: string): string {
  if (!dataStr) return ''
  const dataOnly = dataStr.split('T')[0].split(' ')[0]
  const data = new Date(dataOnly + 'T00:00:00')
  if (isNaN(data.getTime())) return 'Data inválida'
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  const dia = data.getDate().toString().padStart(2, '0')
  const mes = meses[data.getMonth()]
  return `${dia} ${mes}`
}

export function calcularDeltaDor(antes: number, depois: number): number {
  return depois - antes
}

export function getCorDor(valor: number): string {
  if (valor <= 3) return '#4CAF50'
  if (valor <= 6) return '#F59E0B'
  return '#EF4444'
}

export function getCorEfeito(efeito: EfeitoClinico): {
  bg: string
  text: string
  border: string
  icon: string
} {
  switch (efeito) {
    case 'Melhora importante':
      return { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0', icon: '🔥' }
    case 'Melhora moderada':
      return { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0', icon: '✅' }
    case 'Melhora pequena':
      return { bg: '#F7FEE7', text: '#3F6212', border: '#D9F99D', icon: '👍' }
    case 'Sem mudança':
      return { bg: '#F8FAFC', text: '#475569', border: '#E2E8F0', icon: '➖' }
    case 'Piora':
      return { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA', icon: '⚠️' }
  }
}

export function obterIniciaisNome(nome: string): string {
  const partes = nome.trim().split(' ')
  if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

export function getCorIrritabilidade(irritabilidade: string): string {
  switch (irritabilidade) {
    case 'Alta': return 'text-red-600 bg-red-50 border-red-200'
    case 'Moderada': return 'text-amber-600 bg-amber-50 border-amber-200'
    case 'Baixa': return 'text-green-600 bg-green-50 border-green-200'
    default: return 'text-slate-600 bg-slate-50 border-slate-200'
  }
}

export function formatCelular(val: string): string {
  if (!val) return ''
  let cleaned = val.replace(/\D/g, '')

  // Se tiver o código do país do Brasil (55) no início e tiver mais de 11 dígitos, remove o 55 (DDI)
  if (cleaned.startsWith('55') && cleaned.length > 11) {
    cleaned = cleaned.substring(2)
  }

  // Limita a 11 dígitos no máximo (DDD 2 dígitos + número 9 dígitos)
  if (cleaned.length > 11) {
    cleaned = cleaned.substring(0, 11)
  }

  if (cleaned.length === 0) return ''
  if (cleaned.length <= 2) {
    return `(${cleaned}`
  }
  if (cleaned.length <= 6) {
    return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2)}`
  }
  if (cleaned.length <= 10) {
    return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 6)}-${cleaned.substring(6)}`
  }
  return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7, 11)}`
}
