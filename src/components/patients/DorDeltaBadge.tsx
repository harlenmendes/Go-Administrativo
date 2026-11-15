import { cn, getCorDor } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'

interface DorDeltaBadgeProps {
  antes: number
  depois: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

function DorBubble({ valor, size }: { valor: number; size: 'sm' | 'md' | 'lg' }) {
  const cor = getCorDor(valor)
  const sizeClass = {
    sm: 'w-7 h-7 text-sm',
    md: 'w-9 h-9 text-base',
    lg: 'w-11 h-11 text-lg',
  }[size]

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-bold text-white shadow-sm',
        sizeClass,
      )}
      style={{ backgroundColor: cor }}
    >
      {valor}
    </div>
  )
}

export function DorDeltaBadge({ antes, depois, size = 'md', showLabel = false }: DorDeltaBadgeProps) {
  const delta = depois - antes
  const melhorou = delta < 0
  const piorou = delta > 0

  return (
    <div className="flex flex-col gap-1">
      {showLabel && (
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Dor (EVA)</span>
      )}
      <div className="flex items-center gap-1.5">
        <DorBubble valor={antes} size={size} />
        <ArrowRight
          size={size === 'sm' ? 12 : size === 'md' ? 14 : 16}
          className="text-slate-400"
          strokeWidth={2}
        />
        <DorBubble valor={depois} size={size} />
        <span
          className={cn(
            'font-bold text-xs ml-1 px-1.5 py-0.5 rounded-md',
            melhorou
              ? 'text-secondary-700 bg-secondary-50'
              : piorou
              ? 'text-red-600 bg-red-50'
              : 'text-slate-500 bg-slate-100',
          )}
        >
          {melhorou ? `−${Math.abs(delta)}` : piorou ? `+${delta}` : '='}
        </span>
      </div>
    </div>
  )
}
