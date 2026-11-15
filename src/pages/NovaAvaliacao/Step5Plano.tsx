import { useState } from 'react'
import type { AvaliacaoFormData } from './index'
import { Plus, X } from 'lucide-react'

interface StepProps {
  data: AvaliacaoFormData
  updateData: (fields: Partial<AvaliacaoFormData>) => void
}

const OPCOES_CONDUTAS = [
  'Educação em dor',
  'Terapia manual',
  'Exercício terapêutico',
  'Controle motor',
  'Exercício de mobilidade neural',
  'PAC em coluna cervical',
  'PAC em coluna lombar',
  'PAC em região torácica',
  'Bandagem',
  'Laserterapia',
  'Liberação miofascial',
  'Orientações domiciliares',
  'Eletrotermofototerapia',
  'Dry Needling',
  'Manipulação Articular',
]

export function Step5Plano({ data, updateData }: StepProps) {
  const [novaConduta, setNovaConduta] = useState('')

  const toggleConduta = (conduta: string) => {
    if (data.plano_tratamento.includes(conduta)) {
      updateData({ plano_tratamento: data.plano_tratamento.filter(c => c !== conduta) })
    } else {
      updateData({ plano_tratamento: [...data.plano_tratamento, conduta] })
    }
  }

  const addNovaConduta = () => {
    if (novaConduta.trim() && !data.plano_tratamento.includes(novaConduta.trim())) {
      updateData({ plano_tratamento: [...data.plano_tratamento, novaConduta.trim()] })
      setNovaConduta('')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-primary mb-1">Plano de Tratamento</h2>
        <p className="text-sm text-slate-500 mb-6">Defina os objetivos e as abordagens iniciais.</p>
      </div>

      <div className="space-y-4">
        {/* Objetivos */}
        <div className="space-y-4">
          <label className="text-sm font-bold text-slate-700">Objetivos Terapêuticos (SMART)</label>
          
          <div className="space-y-2">
            <span className="text-xs font-bold text-secondary uppercase tracking-wider">Curto Prazo</span>
            <textarea
              className="input-base min-h-[60px] resize-none border-secondary-200"
              placeholder="Ex: Reduzir dor de 8 para 4 em 3 sessões."
              value={data.objetivos_curto}
              onChange={(e) => updateData({ objetivos_curto: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Médio Prazo</span>
            <textarea
              className="input-base min-h-[60px] resize-none border-amber-200"
              placeholder="Ex: Retornar à corrida leve (2km) sem dor em 4 semanas."
              value={data.objetivos_medio}
              onChange={(e) => updateData({ objetivos_medio: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">Longo Prazo</span>
            <textarea
              className="input-base min-h-[60px] resize-none border-primary-200"
              placeholder="Ex: Alta clínica com independência no auto-gerenciamento."
              value={data.objetivos_longo}
              onChange={(e) => updateData({ objetivos_longo: e.target.value })}
            />
          </div>
        </div>

        <hr className="border-slate-200 my-6" />

        {/* Condutas Iniciais */}
        <div className="space-y-3">
          <label className="text-sm font-bold text-slate-700">Abordagens Planejadas</label>
          
          {/* Tags de Condutas Rápidas */}
          <div className="flex flex-wrap gap-2">
            {OPCOES_CONDUTAS.map(conduta => {
              const isSelected = data.plano_tratamento.includes(conduta)
              return (
                <button
                  key={conduta}
                  type="button"
                  onClick={() => toggleConduta(conduta)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                    isSelected 
                      ? 'bg-primary text-white border-primary' 
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {conduta}
                </button>
              )
            })}
          </div>

          {/* Adicionar Conduta Customizada */}
          <div className="flex gap-2 pt-2">
            <input
              type="text"
              className="input-base flex-1 text-sm py-2"
              placeholder="Outra conduta..."
              value={novaConduta}
              onChange={(e) => setNovaConduta(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addNovaConduta()}
            />
            <button
              type="button"
              onClick={addNovaConduta}
              disabled={!novaConduta.trim()}
              className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 disabled:opacity-50"
            >
              <Plus size={18} />
            </button>
          </div>

          {/* Condutas customizadas selecionadas */}
          {data.plano_tratamento.filter(c => !OPCOES_CONDUTAS.includes(c)).length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 mt-2">
              {data.plano_tratamento.filter(c => !OPCOES_CONDUTAS.includes(c)).map(conduta => (
                <div key={conduta} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200 flex items-center gap-1">
                  {conduta}
                  <button onClick={() => toggleConduta(conduta)} className="ml-1 text-primary-400 hover:text-danger">
                    <X size={12} strokeWidth={3} />
                  </button>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
