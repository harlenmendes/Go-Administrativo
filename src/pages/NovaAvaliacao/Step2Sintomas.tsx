import type { AvaliacaoFormData } from './index'

interface StepProps {
  data: AvaliacaoFormData
  updateData: (fields: Partial<AvaliacaoFormData>) => void
}

export function Step2Sintomas({ data, updateData }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-primary mb-1">Comportamento dos Sintomas</h2>
        <p className="text-sm text-slate-500 mb-6">Como a dor e os sintomas se comportam no dia a dia?</p>
      </div>

      <div className="space-y-4">
        {/* Padrão 24 Horas */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Padrão 24 Horas</label>
          <textarea
            className="input-base min-h-[80px] resize-none"
            placeholder="Piora de manhã? Dói para dormir?"
            value={data.padrao_24_horas}
            onChange={(e) => updateData({ padrao_24_horas: e.target.value })}
          />
        </div>

        {/* Fatores Agravantes/Aliviantes (Grid 2 colunas) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Fatores Agravantes</label>
            <textarea
              className="input-base min-h-[80px] resize-none border-danger-200 focus:border-danger-400 focus:ring-danger-400/20"
              placeholder="O que piora a dor?"
              value={data.fatores_agravantes}
              onChange={(e) => updateData({ fatores_agravantes: e.target.value })}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Fatores Aliviantes</label>
            <textarea
              className="input-base min-h-[80px] resize-none border-secondary-200 focus:border-secondary-400 focus:ring-secondary-400/20"
              placeholder="O que melhora a dor?"
              value={data.fatores_aliviantes}
              onChange={(e) => updateData({ fatores_aliviantes: e.target.value })}
            />
          </div>
        </div>

        {/* Nível de Irritabilidade */}
        <div className="space-y-2 pt-2">
          <label className="text-sm font-bold text-slate-700">Nível de Irritabilidade</label>
          <div className="flex gap-2">
            {['Baixa', 'Moderada', 'Alta'].map((nivel) => (
              <button
                key={nivel}
                type="button"
                onClick={() => updateData({ irritabilidade: nivel })}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                  data.irritabilidade === nivel 
                    ? nivel === 'Alta' ? 'bg-danger/10 border-danger text-danger'
                      : nivel === 'Moderada' ? 'bg-warning/10 border-warning text-warning-700'
                      : 'bg-secondary/10 border-secondary text-secondary-700'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {nivel}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            (Relação entre vigor necessário para provocar dor e tempo para aliviar)
          </p>
        </div>

        {/* Limitações e Carga */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Limitações Funcionais</label>
          <textarea
            className="input-base min-h-[80px] resize-none"
            placeholder="O que o paciente deixou de fazer?"
            value={data.limitacoes_funcionais}
            onChange={(e) => updateData({ limitacoes_funcionais: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Carga Física / Rotina</label>
          <textarea
            className="input-base min-h-[60px] resize-none"
            placeholder="Trabalho, esporte, demandas físicas diárias..."
            value={data.carga_fisica}
            onChange={(e) => updateData({ carga_fisica: e.target.value })}
          />
        </div>
      </div>
    </div>
  )
}
