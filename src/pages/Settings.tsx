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
    <div className="space-y-8 animate-fade-in max-w-3xl">
      <TopBar title="Configurações" subtitle="Conta, integrações e preferências" />

      <div className="space-y-6">
        {/* Perfil rápido */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-brand-border shadow-card flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-primary text-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-xl font-bold">{initials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-primary text-lg truncate">{displayName}</p>
            <p className="text-sm text-brand-muted truncate mt-0.5">{user?.email}</p>
            <span className="inline-flex items-center gap-1.5 mt-2.5 px-3 py-1 rounded-full text-xs font-semibold bg-secondary-50 text-secondary-700">
              <ShieldCheck size={14} /> Conta Ativa
            </span>
          </div>
        </div>

        {/* Integração Google Calendar & Sheets */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-brand-border shadow-card space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary flex items-center justify-center flex-shrink-0">
              <Calendar size={22} />
            </div>
            <div>
              <h2 className="font-bold text-primary text-base">
                Google Agenda &amp; Sheets
              </h2>
              <p className="text-xs text-brand-muted mt-0.5">
                Sincronização de atendimentos e exportação de planilhas no módulo de Fechamento.
              </p>
            </div>
          </div>

          {googleStatus?.googleConnected ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-emerald-900">
                    {googleStatus.name || 'Conta Google conectada'}
                  </p>
                  <p className="text-xs text-emerald-700">{googleStatus.email}</p>
                </div>
              </div>
              <button
                onClick={handleDisconnectGoogle}
                disabled={busyGoogle}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-emerald-200 text-xs font-semibold text-emerald-800 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors"
              >
                <Unlink size={14} />
                Desconectar
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-brand-offwhite border border-brand-border">
              <p className="text-xs font-medium text-brand-body">
                Nenhuma conta Google conectada no momento.
              </p>
              <a
                href={getGoogleConnectUrl('/configuracoes')}
                className="btn-outline py-2.5 px-4 text-xs"
              >
                <Link2 size={14} />
                Conectar Google Agenda
              </a>
            </div>
          )}
        </div>

        {/* Sobre o App */}
        <div className="bg-white rounded-3xl p-6 border border-brand-border shadow-card flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-secondary-50 text-secondary-700 flex items-center justify-center flex-shrink-0">
              <Smartphone size={21} />
            </div>
            <div>
              <p className="font-bold text-primary text-sm">Go Administrativo</p>
              <p className="text-xs text-brand-muted mt-0.5">
                Versão 1.0 · Go Fisioterapia
              </p>
            </div>
          </div>

          <button
            id="btn-logout"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 text-xs font-semibold transition-colors"
          >
            <LogOut size={15} />
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  )
}
