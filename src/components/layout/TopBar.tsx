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
    <header className="sticky top-[var(--shell-top,0px)] z-30 bg-white/95 backdrop-blur-md border-b border-brand-border">
      <div className="w-full flex items-center gap-3 px-4 h-14 max-w-4xl mx-auto">
        {(showBack || onBack) && (
          <button
            id="topbar-back-btn"
            onClick={onBack || (() => navigate(-1))}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-brand-cream active:scale-95 transition-all"
            aria-label="Voltar"
          >
            <ArrowLeft size={20} className="text-primary" strokeWidth={2.2} />
          </button>
        )}

        {!showBack && !onBack && (
          <button
            onClick={() => navigate('/')}
            className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 border border-brand-border"
            aria-label="Ir para o início"
          >
            <img src="/favicon.svg" alt="Go" className="w-full h-full object-cover" />
          </button>
        )}

        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-primary text-base leading-tight truncate">{title}</h1>
          {subtitle && (
            <p className="text-xs text-brand-muted truncate">{subtitle}</p>
          )}
        </div>

        {rightSlot}
      </div>
    </header>
  )
}
