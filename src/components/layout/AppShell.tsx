import { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutGrid,
  HeartPulse,
  UsersRound,
  Wallet,
  PackageCheck,
  SlidersHorizontal,
  LogOut,
  Menu,
  X,
  CalendarRange,
} from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { cn, obterIniciaisNome } from '@/lib/utils'

const navItems = [
  { path: '/', label: 'Início', icon: LayoutGrid, matchExact: true },
  { path: '/acompanhamento', label: 'Acompanhamento', icon: HeartPulse },
  { path: '/pacientes', label: 'Pacientes', icon: UsersRound },
  { path: '/agenda', label: 'Agenda Semanal', icon: CalendarRange },
  { path: '/pacotes', label: 'Pacotes', icon: PackageCheck },
  { path: '/fechamento', label: 'Fechamento', icon: Wallet },
  { path: '/configuracoes', label: 'Configurações', icon: SlidersHorizontal },
]

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuthStore()

  // Estado do menu lateral no desktop (expandido vs apenas ícones)
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    const saved = localStorage.getItem('go_sidebar_expanded')
    return saved !== null ? saved === 'true' : true
  })

  // Drawer mobile
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem('go_sidebar_expanded', String(isExpanded))
  }, [isExpanded])

  // Fecha o drawer mobile ao trocar de rota
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const userName =
    user?.user_metadata?.name || user?.email?.split('@')[0] || 'Fisioterapeuta'
  const initials = obterIniciaisNome(userName)

  const handleSignOut = async () => {
    if (confirm('Deseja sair do Go Administrativo?')) {
      await signOut()
      navigate('/login')
    }
  }

  return (
    <div className="min-h-dvh w-full bg-[#F4F7F6] flex flex-col md:flex-row">
      {/* Barra superior exclusiva para Mobile */}
      <header className="md:hidden sticky top-0 z-40 h-16 bg-[#1B3A4B] text-white px-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center transition-colors"
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>
          <span className="font-bold text-base tracking-tight">Go Administrativo</span>
        </div>

        <div className="w-9 h-9 rounded-xl bg-secondary-500/30 border border-secondary-300/30 flex items-center justify-center text-xs font-bold text-white">
          {initials}
        </div>
      </header>

      {/* Overlay Mobile */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-primary-900/50 backdrop-blur-xs animate-fade-in"
        />
      )}

      {/* Menu Lateral (Sidebar Retrátil no Desktop + Drawer no Mobile) */}
      <aside
        className={cn(
          'fixed md:sticky top-0 left-0 z-50 h-dvh bg-[#1B3A4B] text-white flex flex-col justify-between transition-all duration-300 ease-in-out select-none shadow-xl md:shadow-none',
          isExpanded ? 'w-64' : 'md:w-20 w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Topo da Sidebar: Botão Hambúrguer + Marca */}
        <div>
          <div
            className={cn(
              'h-20 flex items-center border-b border-white/10 px-4',
              isExpanded ? 'justify-between' : 'md:justify-center justify-between'
            )}
          >
            <button
              type="button"
              onClick={() => {
                if (window.innerWidth < 768) {
                  setMobileOpen(false)
                } else {
                  setIsExpanded((prev) => !prev)
                }
              }}
              title={isExpanded ? 'Recolher menu (só ícones)' : 'Expandir menu'}
              className="w-11 h-11 rounded-2xl bg-white/10 hover:bg-white/15 text-white flex items-center justify-center transition-colors flex-shrink-0"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <div
              className={cn(
                'flex items-center gap-2.5 overflow-hidden transition-all duration-200',
                isExpanded ? 'opacity-100 flex-1 ml-3' : 'md:opacity-0 md:w-0 md:ml-0 opacity-100 flex-1 ml-3'
              )}
            >
              <div className="min-w-0">
                <p className="font-bold text-base tracking-tight text-white leading-none truncate">
                  Go Fisioterapia
                </p>
                <p className="text-[11px] font-medium text-secondary-300 tracking-wider uppercase mt-1">
                  Administrativo
                </p>
              </div>
            </div>
          </div>

          {/* Links Principais */}
          <nav className="p-3 space-y-2 mt-2">
            {navItems.map(({ path, label, icon: Icon, matchExact }) => {
              const isActive = matchExact
                ? location.pathname === path
                : location.pathname.startsWith(path)

              return (
                <button
                  key={path}
                  type="button"
                  onClick={() => navigate(path)}
                  title={!isExpanded ? label : undefined}
                  className={cn(
                    'w-full flex items-center rounded-2xl transition-all duration-200 group',
                    isExpanded ? 'px-4 py-3.5 gap-3.5' : 'md:justify-center md:p-3.5 px-4 py-3.5 gap-3.5',
                    isActive
                      ? 'bg-secondary-500 text-white font-semibold shadow-md shadow-black/10'
                      : 'text-primary-100/80 hover:bg-white/10 hover:text-white font-medium'
                  )}
                >
                  <Icon
                    size={21}
                    strokeWidth={isActive ? 2.2 : 1.8}
                    className="flex-shrink-0 transition-transform duration-200 group-hover:scale-105"
                  />
                  <span
                    className={cn(
                      'text-sm whitespace-nowrap transition-all duration-200',
                      isExpanded ? 'opacity-100' : 'md:hidden opacity-100'
                    )}
                  >
                    {label}
                  </span>
                </button>
              )
            })}

            {/* Divisor sutil + Item futuro */}
            <div className="pt-3 mt-3 border-t border-white/10">
              <div
                title={!isExpanded ? 'Agenda Semanal (Em breve)' : undefined}
                className={cn(
                  'w-full flex items-center rounded-2xl text-primary-200/45 cursor-default',
                  isExpanded ? 'px-4 py-3 gap-3.5' : 'md:justify-center md:p-3.5 px-4 py-3 gap-3.5'
                )}
              >
                <CalendarRange size={20} strokeWidth={1.7} className="flex-shrink-0" />
                <div
                  className={cn(
                    'flex items-center justify-between flex-1 overflow-hidden',
                    isExpanded ? 'opacity-100' : 'md:hidden opacity-100'
                  )}
                >
                  <span className="text-xs font-medium whitespace-nowrap">Agenda Semanal</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-secondary-300 font-semibold">
                    Breve
                  </span>
                </div>
              </div>
            </div>
          </nav>
        </div>

        {/* Rodapé da Sidebar: Perfil + Sair */}
        <div className="p-3 border-t border-white/10">
          <div
            className={cn(
              'flex items-center rounded-2xl bg-white/5 p-2.5',
              isExpanded ? 'justify-between gap-2.5' : 'md:flex-col md:gap-2 justify-between gap-2.5'
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-secondary-500/30 border border-secondary-300/30 flex items-center justify-center font-bold text-xs text-white flex-shrink-0">
                {initials}
              </div>
              <div
                className={cn(
                  'min-w-0',
                  isExpanded ? 'block' : 'md:hidden block'
                )}
              >
                <p className="text-xs font-semibold text-white truncate">{userName}</p>
                <p className="text-[11px] text-primary-200/75 truncate">{user?.email}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              title="Sair da conta"
              className="w-9 h-9 rounded-xl text-primary-200 hover:text-white hover:bg-red-500/25 flex items-center justify-center transition-colors flex-shrink-0"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      {/* Área Principal de Conteúdo */}
      <main className="flex-1 min-w-0 overflow-x-hidden">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-12 py-7 sm:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
