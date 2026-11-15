import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  value: number
  max?: number
  size?: number
}

export function StarRating({ value, max = 5, size = 14 }: StarRatingProps) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          size={size}
          strokeWidth={1.5}
          className={cn(
            i < value ? 'fill-amber-400 text-amber-400' : 'text-slate-200',
          )}
        />
      ))}
    </div>
  )
}
