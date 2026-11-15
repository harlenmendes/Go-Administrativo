import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { TopBar } from '@/components/layout/TopBar'
import { FormUploadFake } from '@/components/ui/FormUploadFake'
import { SliderDor } from '@/components/ui/SliderDor'
import { SliderADM } from '@/components/ui/SliderADM'
import { ChipGroup } from '@/components/ui/ChipGroup'
import { AutocompleteInput } from '@/components/ui/AutocompleteInput'
import { Activity, Dumbbell, Stethoscope, CheckCircle2, FileText, UserRound } from 'lucide-react'
import { getPacienteById, updateEvolucao, getMovimentosTestes, insertMovimentoTeste } from '@/lib/api'
import { useProntuarioStore } from '@/stores/useProntuarioStore'
import { EfeitoClinico, ConductaRealizada } from '@/types'

const condutasOpcoes: ConductaRealizada[] = [
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
  'Eletroterapia',
  'Agulhamento seco',
  'Liberação miofascial',
  'Treinamento de marcha',
  'Orientações domiciliares'
]

const efeitosOpcoes: EfeitoClinico[] = [
  'Sem mudança', 'Melhora pequena', 'Melhora moderada', 'Melhora importante', 'Piora'
]

export function NovaEvolucao() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const pacienteId = searchParams.get('paciente_id') || searchParams.get('paciente')
  const editId = searchParams.get('edit')
  const cloneId = searchParams.get('clone')
  const baseId = editId || cloneId
  
  const [paciente, setPaciente] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const { addEvolucao, evolucoes, fetchProntuario } = useProntuarioStore()

  const [isSaving, setIsSaving] = useState(false)

  // Lista de movimentos e testes conhecidos
  const [movimentosSugestoes, setMovimentosSugestoes] = useState<string[]>([])

  // Estados do Formulário
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [movimento, setMovimento] = useState('')
  const [dorAntes, setDorAntes] = useState(5)
  const [dorDepois, setDorDepois] = useState(5)
  const [admAntes, setAdmAntes] = useState<number>(50)
  const [admDepois, setAdmDepois] = useState<number>(50)
  
  const [condutas, setCondutas] = useState<string[]>([])
  const [efeito, setEfeito] = useState<string[]>(['Sem mudança'])
  
  const [relato, setRelato] = useState('')
  const [anexos, setAnexos] = useState<any[]>([])

  // Carrega movimentos cadastrados do banco ou padrões
  useEffect(() => {
    getMovimentosTestes()
      .then(setMovimentosSugestoes)
      .catch(console.error)
  }, [])

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
          // Evoluções já estarão na store
        }
      } catch (e) {
        navigate('/pacientes')
      } finally {
        setLoading(false)
      }
    }
    carregarDados()
  }, [pacienteId, baseId, navigate, fetchProntuario])

  // Preenche se tiver baseId (edit ou clone)
  useEffect(() => {
    if (baseId && evolucoes.length > 0) {
      const evo = evolucoes.find(e => e.id === baseId)
      if (evo) {
        if (editId) setData(evo.data.split('T')[0]) // Se for clone, mantém hoje
        setMovimento(evo.movimento_teste_escolhido)
        setDorAntes(evo.escala_dor_antes)
        setDorDepois(evo.escala_dor_depois)
        setAdmAntes(parseInt(evo.adm_antes) || 50)
        setAdmDepois(parseInt(evo.adm_depois) || 50)
        setCondutas(evo.condutas_realizadas)
        setEfeito([evo.efeito_clinico_intervencao])
        setRelato(evo.relato_livre || '')
        setAnexos(evo.anexos || [])
      }
    }
  }, [baseId, evolucoes])

  // Auto-calcula o efeito clínico baseado nos deltas de dor e ADM
  useEffect(() => {
    const deltaDor = dorAntes - dorDepois
    const deltaAdm = admDepois - admAntes
    
    if (deltaDor > 2 || deltaAdm > 20) {
      setEfeito(['Melhora importante'])
    } else if (deltaDor > 0 || deltaAdm > 0) {
      setEfeito(['Melhora moderada'])
    } else if (deltaDor < 0 || deltaAdm < 0) {
      setEfeito(['Piora'])
    } else {
      setEfeito(['Sem mudança'])
    }
  }, [dorAntes, dorDepois, admAntes, admDepois])

  if (loading) {
    return <div className="flex items-center justify-center h-[100dvh]">Carregando...</div>
  }
  
  if (!paciente) return null

  const isFormValid = movimento.trim().length > 0 && condutas.length > 0 && efeito.length > 0

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid) return

    setIsSaving(true)
    try {
      const movimentoTrim = movimento.trim()

      // Se for um novo movimento/teste não cadastrado, insere no banco para próximas consultas
      const jaExiste = movimentosSugestoes.some(
        m => m.toLowerCase() === movimentoTrim.toLowerCase()
      )
      if (!jaExiste && movimentoTrim) {
        insertMovimentoTeste(movimentoTrim).catch(console.error)
      }

      const payload = {
        paciente_id: paciente.id,
        data: new Date(data).toISOString(),
        movimento_teste_escolhido: movimentoTrim,
        escala_dor_antes: dorAntes,
        escala_dor_depois: dorDepois,
        adm_antes: String(admAntes),
        adm_depois: String(admDepois),
        efeito_clinico_intervencao: efeito[0] as EfeitoClinico,
        condutas_realizadas: condutas as ConductaRealizada[],
        desempenho_paciente: 5,
        relato_livre: relato,
        anexos: anexos
      }

      if (editId) {
        await updateEvolucao(editId, payload)
      } else {
        await addEvolucao(payload as any)
      }

      setIsSaving(false)
      navigate(`/pacientes/${paciente.id}`)
    } catch (err) {
      console.error(err)
      alert('Erro ao salvar evolução')
      setIsSaving(false)
    }
  }

  return (
    <div className="w-full flex flex-col min-h-[100dvh] bg-slate-50 max-w-md md:max-w-2xl lg:max-w-3xl mx-auto relative shadow-2xl xl:shadow-none xl:border-x xl:border-slate-100">
      <TopBar title={editId ? "Editar Evolução" : "Nova Evolução"} showBack onBack={() => navigate(-1)} />

      <main className="flex-1 p-4 pb-24">
          {/* Cabeçalho de Contexto */}
        <div className="bg-primary text-white p-4 rounded-2xl mb-6 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <UserRound size={20} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-primary-200 uppercase tracking-wider">Paciente</p>
                <p className="font-bold text-sm truncate max-w-[150px]">{paciente.nome}</p>
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-[10px] font-bold text-primary-200 uppercase tracking-wider">Data da Sessão</p>
              <input 
                type="date"
                className="bg-transparent text-white font-bold text-sm text-right outline-none w-[110px]"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
          </div>
        </div>

        <form id="form-evolucao" onSubmit={handleSave} className="space-y-6 animate-fade-in">
          
          {/* Seção 1: Teste Principal */}
          <div className="space-y-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <h2 className="text-sm font-bold text-primary flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
              <Activity size={16} />
              1. Teste e Reteste
            </h2>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Movimento ou Teste Escolhido *</span>
                <span className="text-[10px] text-slate-400 font-normal">Sugerido / Auto-completar</span>
              </label>
              <AutocompleteInput
                id="input-movimento-teste"
                value={movimento}
                onChange={setMovimento}
                suggestions={movimentosSugestoes}
                placeholder="Ex: Flexão de ombro, Lasègue, Agachamento..."
                required
              />
            </div>

            {/* Painel Antes e Depois */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="space-y-4 border-r border-slate-100 pr-4">
                <p className="text-[11px] font-bold text-primary uppercase tracking-wider">Antes</p>
                <SliderDor label="Dor Antes" value={dorAntes} onChange={setDorAntes} />
                <SliderADM label="ADM Antes" value={admAntes} onChange={setAdmAntes} />
              </div>

              <div className="space-y-4 border-l border-slate-100 pl-4">
                <p className="text-[11px] font-bold text-secondary uppercase tracking-wider">Depois</p>
                <SliderDor label="Dor Depois" value={dorDepois} onChange={setDorDepois} />
                <SliderADM label="ADM Depois" value={admDepois} onChange={setAdmDepois} />
              </div>
            </div>
          </div>

          {/* Seção 2: Intervenção */}
          <div className="space-y-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <h2 className="text-sm font-bold text-primary flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
              <Dumbbell size={16} />
              2. Condutas e Efeito
            </h2>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700">Condutas Realizadas *</label>
              <ChipGroup 
                options={condutasOpcoes} 
                selected={condutas} 
                onChange={setCondutas} 
                multiSelect={true}
              />
            </div>

            <div className="space-y-3 pt-2">
              <label className="text-xs font-bold text-slate-700">Efeito Clínico Geral *</label>
              <ChipGroup 
                options={efeitosOpcoes} 
                selected={efeito} 
                onChange={(val) => setEfeito(val)} 
                multiSelect={false}
              />
            </div>
          </div>

          {/* Seção 3: Relato */}
          <div className="space-y-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <h2 className="text-sm font-bold text-primary flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
              <Stethoscope size={16} />
              3. Relato Livre (Opcional)
            </h2>

            <div className="space-y-2">
              <textarea
                placeholder="Descreva observações adicionais, comportamento do paciente ou intercorrências..."
                className="input-base min-h-[100px] resize-none"
                value={relato}
                onChange={e => setRelato(e.target.value)}
              />
            </div>
          </div>

          {/* Seção 4: Anexos */}
          <div className="space-y-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <h2 className="text-sm font-bold text-primary flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
              <FileText size={16} />
              4. Anexos (Opcional)
            </h2>

            <FormUploadFake
              label="Adicionar fotos, vídeos ou PDFs da sessão"
              files={anexos}
              onChange={setAnexos}
            />
          </div>

        </form>
      </main>

      {/* Footer Fixo (Movido para fora do form para evitar bug de fixed position com CSS transform) */}
      <div className="w-full fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 flex items-center shadow-bottom-nav z-10 max-w-md md:max-w-2xl lg:max-w-3xl mx-auto">
        <button
          type="submit"
          form="form-evolucao"
          disabled={isSaving || !isFormValid}
          className="w-full py-3.5 px-4 rounded-xl bg-secondary text-white font-bold text-sm hover:bg-secondary-600 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <CheckCircle2 size={18} />
              Salvar Evolução
            </>
          )}
        </button>
      </div>
    </div>
  )
}
