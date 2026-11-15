import type { AvaliacaoFormData } from './index'
import { FormUploadFake } from '@/components/ui/FormUploadFake'

interface StepProps {
  data: AvaliacaoFormData
  updateData: (fields: Partial<AvaliacaoFormData>) => void
}

export function Step3ExameFisico({ data, updateData }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-primary mb-1">Exame Físico & Anexos</h2>
        <p className="text-sm text-slate-500 mb-6">Registre inspeção, palpação, testes especiais e anexe imagens ou laudos.</p>
      </div>

      <div className="space-y-4">
        {/* Histórico e Red Flags */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Histórico de Saúde (HMP)</label>
          <textarea
            className="input-base min-h-[60px] resize-none"
            placeholder="Cirurgias, comorbidades, medicações..."
            value={data.historico_saude}
            onChange={(e) => updateData({ historico_saude: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-danger-600 flex items-center gap-1">
            Red Flags (Bandeiras Vermelhas)
          </label>
          <textarea
            className="input-base min-h-[60px] resize-none border-danger-200 focus:border-danger-400 focus:ring-danger-400/20"
            placeholder="Perda de peso inexplicável, dor noturna severa, histórico de câncer..."
            value={data.red_flags}
            onChange={(e) => updateData({ red_flags: e.target.value })}
          />
        </div>

        <hr className="border-slate-200 my-4" />

        {/* Exame Físico Estruturado */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-primary uppercase tracking-wider">Exame Físico Detalhado</h3>
            <span className="text-[10px] text-slate-400">Preencha os tópicos observados</span>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700">1. Inspeção & Palpação</label>
            <input
              type="text"
              className="input-base text-xs"
              placeholder="Ex: Postura, edema, assimetrias, pontos gatilho..."
              value={data.exame_inspecao || ''}
              onChange={(e) => updateData({ exame_inspecao: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700">2. ADM (Amplitude de Movimento)</label>
            <input
              type="text"
              className="input-base text-xs"
              placeholder="Ex: Flexão ativa limitada a 40°, dor no fim da amplitude..."
              value={data.exame_adm || ''}
              onChange={(e) => updateData({ exame_adm: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700">3. Força Muscular</label>
            <input
              type="text"
              className="input-base text-xs"
              placeholder="Ex: Grau 4 em flexores de quadril, miótomos preservados..."
              value={data.exame_forca || ''}
              onChange={(e) => updateData({ exame_forca: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700">4. Testes Especiais / Ortopédicos</label>
            <input
              type="text"
              className="input-base text-xs"
              placeholder="Ex: Teste de Neer (+), Lasègue (-), Hawkins (+)..."
              value={data.exame_testes_especiais || ''}
              onChange={(e) => updateData({ exame_testes_especiais: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700">5. Exame Neurológico</label>
            <input
              type="text"
              className="input-base text-xs"
              placeholder="Ex: Reflexo patelar normal (2+), dermátomos L4-L5 preservados..."
              value={data.exame_neurologico || ''}
              onChange={(e) => updateData({ exame_neurologico: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-secondary-700 flex items-center justify-between">
              <span>6. Observações Complementares</span>
              <span className="text-[10px] text-slate-400 font-normal">(Campo Extra)</span>
            </label>
            <textarea
              className="input-base min-h-[80px] resize-none text-xs border-secondary-200 focus:border-secondary-400"
              placeholder="Escreva aqui qualquer achado clínico adicional, particularidade do paciente ou notas de avaliação..."
              value={data.exame_observacoes_extras || ''}
              onChange={(e) => updateData({ exame_observacoes_extras: e.target.value })}
            />
          </div>
        </div>

        <hr className="border-slate-200 my-4" />

        {/* Galeria de Anexos Fake */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">Anexos, Fotos e Laudos</label>
          <p className="text-xs text-slate-500 mb-3">Adicione fotos da postura, raio-x ou PDF de ressonância.</p>
          
          <FormUploadFake 
            files={data.anexos} 
            onChange={(files) => updateData({ anexos: files })} 
          />
        </div>

      </div>
    </div>
  )
}
