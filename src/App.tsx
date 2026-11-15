import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { Hub } from '@/pages/Hub'
import { Dashboard } from '@/pages/Dashboard'
import { Fechamento } from '@/pages/Fechamento'
import { Pacotes } from '@/pages/Pacotes'
import { PatientList } from '@/pages/Patients/PatientList'
import { PatientProfile } from '@/pages/Patients/PatientProfile'
import { NewPatient } from '@/pages/Patients/NewPatient'
import { NovaAvaliacao } from '@/pages/NovaAvaliacao'
import { NovaEvolucao } from '@/pages/NovaEvolucao'
import { Settings } from '@/pages/Settings'
import { PlaceholderPage } from '@/pages/PlaceholderPage'
import { Login } from '@/pages/Login'
import { useAuthStore } from '@/stores/useAuthStore'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, checkUser } = useAuthStore()

  useEffect(() => {
    checkUser()
  }, [checkUser])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route path="/" element={<Hub />} />
        <Route path="/acompanhamento" element={<Dashboard />} />
        <Route path="/pacientes" element={<PatientList />} />
        <Route path="/pacientes/:id" element={<PatientProfile />} />
        <Route path="/novo-paciente" element={<NewPatient />} />
        <Route path="/nova-avaliacao" element={<NovaAvaliacao />} />
        <Route path="/nova-evolucao" element={<NovaEvolucao />} />
        <Route path="/fechamento" element={<Fechamento />} />
        <Route path="/pacotes" element={<Pacotes />} />
        <Route path="/configuracoes" element={<Settings />} />
        <Route
          path="*"
          element={
            <PlaceholderPage
              title="Página não encontrada"
              description="A rota acessada não existe."
            />
          }
        />
      </Route>
    </Routes>
  )
}
