import type { AvaliacaoFormData } from './index'
import { Activity } from 'lucide-react'

interface StepProps {
  data: AvaliacaoFormData
  updateData: (fields: Partial<AvaliacaoFormData>) => void
}

export function Step4Hipotese({ data, updateData }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-primary mb-1">Hipótese Clínica</h2>
        <p className="text-sm text-slate-500 mb-6">Sintetize seu raciocínio clínico e diagnóstico fisioterapêutico.</p>
      </div>

      <div className="space-y-4">
        {/* Hipótese Clínica */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Activity size={16} className="text-secondary" />
            Hipótese Diagnóstica Fisioterapêutica
          </label>
          <textarea
            className="input-base min-h-[160px] resize-none border-primary-200 focus:border-primary-400 focus:ring-primary-400/20 text-base"
            placeholder="Qual a provável fonte dos sintomas e fatores contribuintes? (Ex: Síndrome de compressão radicular associada à alteração de controle motor...)"
            value={data.hipotese_clinica}
            onChange={(e) => updateData({ hipotese_clinica: e.target.value })}
          />
        </div>

        {/* Info Card */}
        <div className="bg-slate-100 rounded-xl p-4 text-xs text-slate-600 mt-6">
          <p className="font-bold text-slate-700 mb-1">Dica de Preenchimento:</p>
          <ul className="list-disc list-inside space-y-1 ml-1 opacity-80">
            <li>Identifique a estrutura provável (ex: discal, facetária, neural).</li>
            <li>Identifique as alterações de movimento associadas.</li>
            <li>Leve em conta o contexto biopsicossocial do paciente.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
