import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Home, Stethoscope, Users, Receipt, Settings, LogOut } from 'lucide-react'
import { BottomNav } from './BottomNav'
import { GoLogo } from '@/components/brand/GoLogo'
import { useAuthStore } from '@/stores/useAuthStore'
import { cn } from '@/lib/utils'

const desktopNavItems = [
  { path: '/', label: 'Início', icon: Home, matchExact: true },
  { path: '/acompanhamento', label: 'Acompanhamento', icon: Stethoscope },
  { path: '/pacientes', label: 'Pacientes', icon: Users },
  { path: '/fechamento', label: 'Fechamento', icon: Receipt },
  { path: '/configuracoes', label: 'Configurações', icon: Settings },
]

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuthStore()

  const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Fisioterapeuta'

  const handleSignOut = async () => {
    if (confirm('Tem certeza que deseja sair do Go Administrativo?')) {
      await signOut()
      navigate('/login')
    }
  }

  return (
    <div className="w-full min-h-dvh bg-background flex flex-col [--shell-top:0px] md:[--shell-top:64px]">
      {/* Navegação Desktop elegante (oculta no mobile, onde usa BottomNav) */}
      <header className="hidden md:block sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-brand-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
          <button
            onClick={() => navigate('/')}
            className="text-left focus:outline-none"
          >
            <GoLogo size="sm" subtitle="Administrativo" />
          </button>

          <nav className="flex items-center gap-1.5">
            {desktopNavItems.map(({ path, label, icon: Icon, matchExact }) => {
              const isActive = matchExact
                ? location.pathname === path
                : location.pathname.startsWith(path)

              return (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={cn(
                    'flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-brand-body hover:bg-brand-cream hover:text-primary'
                  )}
                >
                  <Icon size={16} strokeWidth={2} />
                  <span>{label}</span>
                </button>
              )
            })}
          </nav>

          <div className="flex items-center gap-3">
            <div className="text-right hidden lg:block">
              <p className="text-xs font-semibold text-primary leading-tight">
                {userName}
              </p>
              <p className="text-[11px] text-brand-muted truncate max-w-[160px]">
                {user?.email}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              title="Sair"
              className="w-9 h-9 rounded-xl border border-brand-border text-brand-muted hover:text-red-600 hover:bg-red-50 hover:border-red-200 flex items-center justify-center transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full page-pb">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  )
}
