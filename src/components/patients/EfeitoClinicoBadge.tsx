import { cn, getCorEfeito } from '@/lib/utils'
import type { EfeitoClinico } from '@/types'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface EfeitoClinicoBadgeProps {
  efeito: EfeitoClinico
  size?: 'sm' | 'md'
}

export function EfeitoClinicoBadge({ efeito, size = 'sm' }: EfeitoClinicoBadgeProps) {
  const cores = getCorEfeito(efeito)

  const Icon =
    efeito === 'Piora'
      ? TrendingDown
      : efeito === 'Sem mudança'
      ? Minus
      : TrendingUp

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold border',
        size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-3 py-1',
      )}
      style={{
        backgroundColor: cores.bg,
        color: cores.text,
        borderColor: cores.border,
      }}
    >
      <Icon size={size === 'sm' ? 10 : 12} strokeWidth={2.5} />
      {efeito}
    </span>
  )
}
