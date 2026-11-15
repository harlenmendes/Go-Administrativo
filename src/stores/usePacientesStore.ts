import { create } from 'zustand'
import type { Paciente } from '@/types'
import { getPacientes, insertPaciente } from '@/lib/api'

interface PacientesState {
  pacientes: Paciente[]
  isLoading: boolean
  error: string | null
  fetchPacientes: () => Promise<void>
  addPaciente: (paciente: Omit<Paciente, 'id' | 'data_criacao'>) => Promise<Paciente>
}

export const usePacientesStore = create<PacientesState>((set) => ({
  pacientes: [],
  isLoading: false,
  error: null,
  
  fetchPacientes: async () => {
    set({ isLoading: true, error: null })
    try {
      const data = await getPacientes()
      set({ pacientes: data, isLoading: false })
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
    }
  },

  addPaciente: async (paciente) => {
    set({ isLoading: true, error: null })
    try {
      const newPaciente = await insertPaciente(paciente)
      set((state) => ({ 
        pacientes: [newPaciente, ...state.pacientes],
        isLoading: false
      }))
      return newPaciente
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
      throw err
    }
  }
}))
