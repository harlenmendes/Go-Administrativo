import { useNavigate, useLocation } from 'react-router-dom'
import { Home, Users, Receipt, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { path: '/', label: 'Início', icon: Home, matchExact: true },
  { path: '/pacientes', label: 'Pacientes', icon: Users, extraPrefixes: ['/acompanhamento'] },
  { path: '/fechamento', label: 'Fechamento', icon: Receipt },
  { path: '/configuracoes', label: 'Config.', icon: Settings },
]

export function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-brand-border bottom-nav-h shadow-bottom-nav">
      <div className="w-full flex items-stretch h-full max-w-lg mx-auto">
        {navItems.map(({ path, label, icon: Icon, matchExact, extraPrefixes }) => {
          const isActive = matchExact
            ? location.pathname === path
            : location.pathname.startsWith(path) ||
              Boolean(extraPrefixes?.some((p) => location.pathname.startsWith(p)))

          return (
            <button
              key={path}
              id={`nav-${label.toLowerCase().replace('.', '').replace(' ', '-')}`}
              onClick={() => navigate(path)}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 transition-all duration-200 active:scale-95 pb-1 pt-2',
                isActive ? 'text-primary' : 'text-brand-muted hover:text-primary',
              )}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div
                className={cn(
                  'w-10 h-6 flex items-center justify-center rounded-full transition-all duration-200',
                  isActive ? 'bg-secondary-100 text-primary' : ''
                )}
              >
                <Icon
                  size={19}
                  strokeWidth={isActive ? 2.3 : 1.8}
                  className={cn(isActive ? 'text-primary' : 'text-brand-muted')}
                />
              </div>
              <span
                className={cn(
                  'text-[10px] font-medium tracking-wide transition-all duration-200',
                  isActive ? 'text-primary font-semibold' : 'text-brand-muted'
                )}
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
