import { create } from 'zustand'
import type { AvaliacaoInicial, EvolucaoAtendimento } from '@/types'
import { getAvaliacoesByPaciente, getEvolucoesByPaciente, insertAvaliacao, insertEvolucao } from '@/lib/api'

interface ProntuarioState {
  avaliacoes: AvaliacaoInicial[]
  evolucoes: EvolucaoAtendimento[]
  isLoading: boolean
  error: string | null
  
  fetchProntuario: (pacienteId: string) => Promise<void>
  addAvaliacao: (avaliacao: Omit<AvaliacaoInicial, 'id'>) => Promise<AvaliacaoInicial>
  addEvolucao: (evolucao: Omit<EvolucaoAtendimento, 'id'>) => Promise<EvolucaoAtendimento>
}

export const useProntuarioStore = create<ProntuarioState>((set) => ({
  avaliacoes: [],
  evolucoes: [],
  isLoading: false,
  error: null,
  
  fetchProntuario: async (pacienteId) => {
    set({ isLoading: true, error: null })
    try {
      const [avs, evs] = await Promise.all([
        getAvaliacoesByPaciente(pacienteId),
        getEvolucoesByPaciente(pacienteId)
      ])
      set({ avaliacoes: avs, evolucoes: evs, isLoading: false })
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
    }
  },

  addAvaliacao: async (avaliacao) => {
    set({ isLoading: true, error: null })
    try {
      const nova = await insertAvaliacao(avaliacao)
      set((state) => ({ 
        avaliacoes: [nova, ...state.avaliacoes],
        isLoading: false
      }))
      return nova
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
      throw err
    }
  },

  addEvolucao: async (evolucao) => {
    set({ isLoading: true, error: null })
    try {
      const nova = await insertEvolucao(evolucao)
      set((state) => ({ 
        evolucoes: [nova, ...state.evolucoes],
        isLoading: false
      }))
      return nova
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
      throw err
    }
  }
}))
