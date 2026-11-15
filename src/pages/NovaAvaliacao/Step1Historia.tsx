import type { AvaliacaoFormData } from './index'

interface StepProps {
  data: AvaliacaoFormData
  updateData: (fields: Partial<AvaliacaoFormData>) => void
}

export function Step1Historia({ data, updateData }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-primary mb-1">História & Queixa</h2>
        <p className="text-sm text-slate-500 mb-6">Descreva os motivos da consulta e a região do corpo afetada.</p>
      </div>

      <div className="space-y-4">
        {/* Queixa Principal */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Queixa Principal</label>
          <textarea
            className="input-base min-h-[100px] resize-none"
            placeholder="Ex: Dor no ombro ao levantar o braço..."
            value={data.queixa_principal}
            onChange={(e) => updateData({ queixa_principal: e.target.value })}
          />
        </div>

        {/* Região e Lado (Grid 2 colunas) */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Região</label>
            <select
              className="input-base"
              value={data.regiao_sintomas}
              onChange={(e) => updateData({ regiao_sintomas: e.target.value })}
            >
              <option value="" disabled>Selecione...</option>
              <option value="Cervical">Cervical</option>
              <option value="Ombro">Ombro</option>
              <option value="Cotovelo">Cotovelo</option>
              <option value="Punho/Mão">Punho/Mão</option>
              <option value="Torácica">Torácica</option>
              <option value="Lombar">Lombar</option>
              <option value="Quadril">Quadril</option>
              <option value="Joelho">Joelho</option>
              <option value="Tornozelo/Pé">Tornozelo/Pé</option>
              <option value="Global">Global</option>
            </select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Lado Acometido</label>
            <select
              className="input-base"
              value={data.lado_acometido}
              onChange={(e) => updateData({ lado_acometido: e.target.value })}
            >
              <option value="" disabled>Selecione...</option>
              <option value="Direito">Direito</option>
              <option value="Esquerdo">Esquerdo</option>
              <option value="Bilateral">Bilateral</option>
              <option value="Central">Central (Espinha/Tronco)</option>
            </select>
          </div>
        </div>

        {/* História da Queixa */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">História (HMA/HMP)</label>
          <textarea
            className="input-base min-h-[120px] resize-none"
            placeholder="Como e quando começou? Tem histórico anterior?"
            value={data.historia_queixa}
            onChange={(e) => updateData({ historia_queixa: e.target.value })}
          />
        </div>

        {/* Objetivo do Paciente */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Objetivo do Paciente</label>
          <textarea
            className="input-base min-h-[80px] resize-none"
            placeholder="O que o paciente deseja alcançar com a físio?"
            value={data.objetivo_paciente}
            onChange={(e) => updateData({ objetivo_paciente: e.target.value })}
          />
        </div>
      </div>
    </div>
  )
}
