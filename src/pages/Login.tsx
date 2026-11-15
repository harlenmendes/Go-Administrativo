import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn, AlertCircle, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export function Login() {
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [isSignUp, setIsSignUp] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccessMsg(null)

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: nome
          }
        }
      })
      if (error) {
        setError(error.message)
      } else {
        setSuccessMsg('Conta criada! Verifique seu e-mail ou faça login abaixo.')
        setIsSignUp(false)
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError('E-mail ou senha incorretos.')
      } else {
        navigate('/')
      }
    }
    setIsLoading(false)
  }

  return (
    <div className="min-h-[100dvh] flex flex-col justify-center bg-brand-cream p-6 relative overflow-hidden">
      {/* Elementos decorativos inspirados no site Go Fisioterapia */}
      <div className="absolute top-0 left-0 right-0 h-[44%] bg-gradient-to-br from-primary-800 via-primary to-primary-500 rounded-b-[3rem] shadow-lg" />
      <div className="absolute -top-24 -right-24 w-80 h-80 bg-secondary/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-32 -left-24 w-64 h-64 bg-secondary-300/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md mx-auto relative z-10 animate-fade-in">
        {/* Cabeçalho da marca */}
        <div className="text-center mb-7">
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl border border-white/60 p-2">
            <img
              src="/logo.png"
              alt="Go Fisioterapia"
              className="w-full h-full object-contain"
              onError={(e) => {
                e.currentTarget.src = '/favicon.svg'
              }}
            />
          </div>
          <p className="text-[11px] font-medium tracking-[0.22em] uppercase text-secondary-300 mb-1">
            Portal Interno
          </p>
          <h1 className="font-editorial text-4xl font-medium text-white tracking-tight">
            Go <em className="italic text-secondary-300">Administrativo</em>
          </h1>
          <p className="text-primary-100/80 text-sm mt-1">
            Gestão Clínica &amp; Fechamento de Atendimentos
          </p>
        </div>

        {/* Card de Login */}
        <div className="bg-white rounded-3xl p-7 shadow-card-hover border border-brand-border">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-editorial text-2xl font-semibold text-primary">
                {isSignUp ? 'Criar nova conta' : 'Acesse sua conta'}
              </h2>
              <p className="text-xs text-brand-muted mt-0.5">
                Autenticação segura via Supabase
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-secondary-50 text-secondary-600 flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-red-700 animate-slide-up">
                <AlertCircle size={17} className="flex-shrink-0" />
                <span className="text-xs font-medium">{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3.5 bg-secondary-50 border border-secondary-200 rounded-xl text-secondary-700 text-xs font-medium animate-slide-up">
                {successMsg}
              </div>
            )}

            {isSignUp && (
              <div>
                <label className="label-base text-xs">Seu Nome (Dr./Dra.)</label>
                <input
                  type="text"
                  required
                  className="input-base"
                  placeholder="Ex: Harlen Alves"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="label-base text-xs">E-mail</label>
              <input
                type="email"
                required
                className="input-base"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="label-base text-xs">Senha</label>
              <input
                type="password"
                required
                className="input-base"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-secondary py-3.5 flex justify-center mt-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  {isSignUp ? 'Criar Conta' : 'Entrar no Portal'} <LogIn size={18} />
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError(null)
                setSuccessMsg(null)
              }}
              className="w-full text-center text-xs font-medium text-primary/70 hover:text-primary mt-2 py-1 transition-colors"
            >
              {isSignUp ? 'Já tem uma conta? Fazer login' : 'Não tem conta? Cadastre-se'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-brand-muted mt-7">
          Go Fisioterapia · São Paulo © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
