import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { Stepper } from '@/components/ui/Stepper'
import { getPacienteById, updateAvaliacao } from '@/lib/api'

// Import das telas dos passos
import { Step1Historia } from './Step1Historia'
import { Step2Sintomas } from './Step2Sintomas'
import { Step3ExameFisico } from './Step3ExameFisico'
import { Step4Hipotese } from './Step4Hipotese'
import { Step5Plano } from './Step5Plano'
import { useProntuarioStore } from '@/stores/useProntuarioStore'

// Estrutura do formulário
export interface AvaliacaoFormData {
  queixa_principal: string
  objetivo_paciente: string
  regiao_sintomas: string
  lado_acometido: string
  historia_queixa: string
  padrao_24_horas: string
  fatores_agravantes: string
  fatores_aliviantes: string
  irritabilidade: string
  limitacoes_funcionais: string
  carga_fisica: string
  historico_saude: string
  red_flags: string
  exame_fisico: string
  exame_inspecao: string
  exame_adm: string
  exame_forca: string
  exame_testes_especiais: string
  exame_neurologico: string
  exame_observacoes_extras: string
  hipotese_clinica: string
  objetivos_curto: string
  objetivos_medio: string
  objetivos_longo: string
  plano_tratamento: string[]
  anexos: any[]
}

const initialData: AvaliacaoFormData = {
  queixa_principal: '',
  objetivo_paciente: '',
  regiao_sintomas: 'Lombar',
  lado_acometido: 'Bilateral',
  historia_queixa: '',
  padrao_24_horas: '',
  fatores_agravantes: '',
  fatores_aliviantes: '',
  irritabilidade: 'Moderada',
  limitacoes_funcionais: '',
  carga_fisica: '',
  historico_saude: '',
  red_flags: 'Ausentes',
  exame_fisico: '',
  exame_inspecao: '',
  exame_adm: '',
  exame_forca: '',
  exame_testes_especiais: '',
  exame_neurologico: '',
  exame_observacoes_extras: '',
  hipotese_clinica: '',
  objetivos_curto: '',
  objetivos_medio: '',
  objetivos_longo: '',
  plano_tratamento: [],
  anexos: [],
}

const TOTAL_STEPS = 5
const STEP_LABELS = ['História', 'Sintomas', 'Exame Físico', 'Hipótese', 'Plano']

export function NovaAvaliacao() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const pacienteId = searchParams.get('paciente_id') || searchParams.get('paciente')
  const editId = searchParams.get('edit')
  const cloneId = searchParams.get('clone')
  const baseId = editId || cloneId
  
  const [paciente, setPaciente] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<AvaliacaoFormData>(initialData)
  const [isSaving, setIsSaving] = useState(false)

  const { addAvaliacao, avaliacoes, fetchProntuario } = useProntuarioStore()

  // Fetch do paciente e avaliações base
  useEffect(() => {
    const carregarDados = async () => {
      if (!pacienteId) {
        navigate('/pacientes')
        return
      }
      
      try {
        const pac = await getPacienteById(pacienteId)
        setPaciente(pac)
        if (!pac) {
          navigate('/pacientes')
          return
        }

        if (baseId) {
          await fetchProntuario(pacienteId)
        }
      } catch (e) {
        navigate('/pacientes')
      } finally {
        setLoading(false)
      }
    }
    carregarDados()
  }, [pacienteId, baseId, navigate, fetchProntuario])

  // Preenche dados se tiver baseId (edit ou clone)
  useEffect(() => {
    if (baseId && avaliacoes.length > 0) {
      const ava = avaliacoes.find(a => a.id === baseId)
      if (ava) {
        setFormData({
          queixa_principal: ava.queixa_principal || '',
          objetivo_paciente: ava.objetivo_paciente || '',
          regiao_sintomas: ava.regiao_sintomas || 'Lombar',
          lado_acometido: ava.lado_acometido || 'Bilateral',
          historia_queixa: ava.historia_queixa || '',
          padrao_24_horas: ava.padrao_24_horas || '',
          fatores_agravantes: ava.fatores_agravantes || '',
          fatores_aliviantes: ava.fatores_aliviantes || '',
          irritabilidade: ava.irritabilidade || 'Moderada',
          limitacoes_funcionais: ava.limitacoes_funcionais || '',
          carga_fisica: ava.carga_fisica || '',
          historico_saude: ava.historico_saude || '',
          red_flags: ava.red_flags || 'Ausentes',
          exame_fisico: ava.exame_fisico || '',
          exame_inspecao: ava.exame_inspecao || '',
          exame_adm: ava.exame_adm || '',
          exame_forca: ava.exame_forca || '',
          exame_testes_especiais: ava.exame_testes_especiais || '',
          exame_neurologico: ava.exame_neurologico || '',
          exame_observacoes_extras: ava.exame_observacoes_extras || '',
          hipotese_clinica: ava.hipotese_clinica || '',
          objetivos_curto: ava.objetivos?.curto_prazo || '',
          objetivos_medio: ava.objetivos?.medio_prazo || '',
          objetivos_longo: ava.objetivos?.longo_prazo || '',
          plano_tratamento: ava.plano_tratamento || [],
          anexos: ava.anexos || []
        })
      }
    }
  }, [baseId, avaliacoes])

  const updateData = (fields: Partial<AvaliacaoFormData>) => {
    setFormData(prev => ({ ...prev, ...fields }))
  }

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) setCurrentStep(prev => prev + 1)
  }

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(prev => prev - 1)
    else navigate(-1) // Volta para perfil se estiver no passo 1
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const partesExame: string[] = []
      if (formData.exame_inspecao) partesExame.push(`INSPEÇÃO & PALPAÇÃO:\n${formData.exame_inspecao}`)
      if (formData.exame_adm) partesExame.push(`ADM:\n${formData.exame_adm}`)
      if (formData.exame_forca) partesExame.push(`FORÇA MUSCULAR:\n${formData.exame_forca}`)
      if (formData.exame_testes_especiais) partesExame.push(`TESTES ESPECIAIS:\n${formData.exame_testes_especiais}`)
      if (formData.exame_neurologico) partesExame.push(`NEUROLÓGICO:\n${formData.exame_neurologico}`)
      if (formData.exame_observacoes_extras) partesExame.push(`OBSERVAÇÕES COMPLEMENTARES:\n${formData.exame_observacoes_extras}`)

      const exameFisicoCompilado = partesExame.length > 0 
        ? partesExame.join('\n\n') 
        : formData.exame_fisico

      const payload = {
        ...formData,
        exame_fisico: exameFisicoCompilado,
        paciente_id: pacienteId as string,
        data_avaliacao: editId && avaliacoes.find(a => a.id === editId) 
          ? avaliacoes.find(a => a.id === editId)!.data_avaliacao 
          : new Date().toISOString()
      }
      
      if (editId) {
        await updateAvaliacao(editId, payload)
      } else {
        await addAvaliacao(payload as any)
      }
      
      setIsSaving(false)
      navigate(`/pacientes/${pacienteId}`)
    } catch (err) {
      console.error(err)
      alert('Erro ao salvar avaliação')
      setIsSaving(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-[100dvh]">Carregando...</div>
  }

  if (!paciente) return null

  return (
    <div className="w-full max-w-3xl space-y-6">
      <TopBar 
        title="Nova Avaliação" 
        subtitle={paciente.nome}
        onBack={handleBack}
      />
      
      <Stepper currentStep={currentStep} totalSteps={TOTAL_STEPS} labels={STEP_LABELS} />

      <main className="flex-1 flex flex-col pt-2 pb-6">
        {/* Renderiza o passo atual */}
        <div className="flex-1 animate-fade-in">
          {currentStep === 1 && <Step1Historia data={formData} updateData={updateData} />}
          {currentStep === 2 && <Step2Sintomas data={formData} updateData={updateData} />}
          {currentStep === 3 && <Step3ExameFisico data={formData} updateData={updateData} />}
          {currentStep === 4 && <Step4Hipotese data={formData} updateData={updateData} />}
          {currentStep === 5 && <Step5Plano data={formData} updateData={updateData} />}
        </div>
      </main>

      {/* Botões de Navegação dos Passos */}
      <div className="w-full pt-2 pb-8 flex items-center gap-3">
        {currentStep > 1 && (
          <button
            type="button"
            onClick={handleBack}
            disabled={isSaving}
            className="flex-1 py-3.5 px-4 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Voltar
          </button>
        )}
        
        {currentStep < TOTAL_STEPS ? (
          <button
            type="button"
            onClick={handleNext}
            className="flex-[2] py-3.5 px-4 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary-600 transition-colors shadow-sm"
          >
            Avançar
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-[2] py-3.5 px-4 rounded-xl bg-secondary text-white font-bold text-sm hover:bg-secondary-600 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-70"
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle2 size={18} />
                Concluir e Salvar
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
