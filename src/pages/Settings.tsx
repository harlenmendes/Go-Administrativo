import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '@/components/layout/TopBar'
import {
  Calendar,
  LogOut,
  ShieldCheck,
  Smartphone,
  CheckCircle2,
  Link2,
  Unlink,
} from 'lucide-react'
import { useAuthStore } from '@/stores/useAuthStore'
import { obterIniciaisNome } from '@/lib/utils'
import {
  disconnectGoogle,
  getGoogleAuthStatus,
  getGoogleConnectUrl,
  type GoogleAuthStatus,
} from '@/lib/fechamentoApi'

export function Settings() {
  const navigate = useNavigate()
  const { user, signOut } = useAuthStore()
  const [googleStatus, setGoogleStatus] = useState<GoogleAuthStatus | null>(null)
  const [busyGoogle, setBusyGoogle] = useState(false)

  useEffect(() => {
    getGoogleAuthStatus()
      .then(setGoogleStatus)
      .catch(() => setGoogleStatus({ authenticated: false, googleConnected: false }))
  }, [])

  const displayName =
    user?.user_metadata?.name || user?.email?.split('@')[0] || 'Dr(a). Fisioterapeuta'
  const initials = obterIniciaisNome(displayName)

  const handleLogout = async () => {
    if (confirm('Tem certeza que deseja sair da sua conta?')) {
      await signOut()
      navigate('/login')
    }
  }

  const handleDisconnectGoogle = async () => {
    setBusyGoogle(true)
    try {
      await disconnectGoogle()
      setGoogleStatus({ authenticated: false, googleConnected: false })
    } finally {
      setBusyGoogle(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <TopBar title="Configurações" subtitle="Conta, integrações e preferências" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-5 space-y-5 pb-10">
        {/* Perfil rápido */}
        <div className="card p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-800 to-primary-500 flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-lg font-semibold text-white">{initials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-primary text-base truncate">{displayName}</p>
            <p className="text-xs text-brand-muted truncate">{user?.email}</p>
            <span className="inline-flex items-center gap-1 mt-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-secondary-50 text-secondary-700 border border-secondary-200">
              <ShieldCheck size={12} /> Autenticado via Supabase
            </span>
          </div>
        </div>

        {/* Integração Google Calendar & Sheets */}
        <div className="card p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary flex items-center justify-center flex-shrink-0">
                <Calendar size={19} />
              </div>
              <div>
                <h2 className="font-semibold text-primary text-sm">
                  Integração Google Agenda &amp; Sheets
                </h2>
                <p className="text-xs text-brand-muted">
                  Usada exclusivamente para importar atendimentos do Calendar e gerar planilhas no Fechamento.
                </p>
              </div>
            </div>
          </div>

          {googleStatus?.googleConnected ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-emerald-900">
                    Conectado como {googleStatus.name}
                  </p>
                  <p className="text-[11px] text-emerald-700">{googleStatus.email}</p>
                </div>
              </div>
              <button
                onClick={handleDisconnectGoogle}
                disabled={busyGoogle}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-emerald-200 text-xs font-medium text-emerald-800 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors"
              >
                <Unlink size={14} />
                Desconectar Google
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-brand-cream border border-brand-border">
              <p className="text-xs text-brand-body">
                Nenhuma conta Google conectada nesta sessão.
              </p>
              <a
                href={getGoogleConnectUrl('/configuracoes')}
                className="btn-outline py-2 px-4 text-xs"
              >
                <Link2 size={14} />
                Conectar Google Agenda
              </a>
            </div>
          )}
        </div>

        {/* Sobre o App */}
        <div className="card p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-secondary-50 text-secondary-700 flex items-center justify-center flex-shrink-0">
            <Smartphone size={18} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-primary text-sm">Go Administrativo</p>
            <p className="text-xs text-brand-muted">
              v1.0.0 · Go Fisioterapia · Supabase + Vercel
            </p>
          </div>
        </div>

        {/* Sair */}
        <button
          id="btn-logout"
          onClick={handleLogout}
          className="card w-full p-4 flex items-center gap-3 text-red-600 hover:bg-red-50 transition-colors active:scale-[0.99]"
        >
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
            <LogOut size={16} className="text-red-600" strokeWidth={2.2} />
          </div>
          <p className="font-semibold text-sm">Sair da conta (Supabase)</p>
        </button>
      </div>
    </div>
  )
}
