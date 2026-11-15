import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  isLoading: boolean
  checkUser: () => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  
  checkUser: async () => {
    set({ isLoading: true })
    const { data: { session } } = await supabase.auth.getSession()
    set({ user: session?.user || null, isLoading: false })
    
    // Configura o listener para mudanças na sessão (login/logout)
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user || null })
    })
  },
  
  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null })
  }
}))
