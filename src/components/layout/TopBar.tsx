import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

interface TopBarProps {
  title: string
  subtitle?: string
  showBack?: boolean
  onBack?: () => void
  rightSlot?: React.ReactNode
}

export function TopBar({ title, subtitle, showBack = false, onBack, rightSlot }: TopBarProps) {
  const navigate = useNavigate()

  return (
    <header className="mb-8">
      <div className="w-full flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          {(showBack || onBack) && (
            <button
              id="topbar-back-btn"
              onClick={onBack || (() => navigate(-1))}
              className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white border border-brand-border hover:border-primary/30 text-primary shadow-xs active:scale-95 transition-all flex-shrink-0"
              aria-label="Voltar"
            >
              <ArrowLeft size={20} strokeWidth={2} />
            </button>
          )}

          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-primary tracking-tight truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-brand-muted mt-1 truncate">{subtitle}</p>
            )}
          </div>
        </div>

        {rightSlot && <div className="flex-shrink-0">{rightSlot}</div>}
      </div>
    </header>
  )
}
