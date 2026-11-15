import { TopBar } from '@/components/layout/TopBar'
import { Construction } from 'lucide-react'

interface PlaceholderPageProps {
  title: string
  description: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="animate-fade-in">
      <TopBar title={title} showBack />
      <div className="flex flex-col items-center justify-center py-24 px-4 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center">
          <Construction size={28} className="text-amber-500" />
        </div>
        <h2 className="text-lg font-bold text-primary text-center">{title}</h2>
        <p className="text-sm text-slate-400 text-center leading-relaxed max-w-xs">{description}</p>
        <div className="mt-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200">
          <span className="text-xs font-bold text-amber-600">🚧 Em construção — Fase 2</span>
        </div>
      </div>
    </div>
  )
}
