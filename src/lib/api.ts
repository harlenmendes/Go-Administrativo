import { supabase } from './supabase'
import type { Paciente, AvaliacaoInicial, EvolucaoAtendimento } from '@/types'

// Mappers para Paciente
const mapDBToPaciente = (dbRow: any): Paciente => ({
  id: dbRow.id,
  nome: dbRow.nome,
  data_nascimento: dbRow.data_nascimento,
  cpf: dbRow.cpf,
  email: dbRow.email || '',
  endereco: dbRow.endereco_completo || '',
  profissao: dbRow.profissao || '',
  telefone: dbRow.celular,
  origem_encaminhamento: dbRow.origem as any,
  indicacao_detalhes: {
    nome: dbRow.indicacao_nome || '',
    telefone: dbRow.indicacao_telefone || '',
    empresa: dbRow.indicacao_empresa || '',
    email: dbRow.indicacao_email || ''
  },
  data_criacao: dbRow.created_at,
  foto_url: undefined,
  created_by: dbRow.created_by,
  updated_by: dbRow.updated_by,
  deleted_at: dbRow.deleted_at
})

const parseDataToISO = (dataStr?: string): string | undefined => {
  if (!dataStr) return undefined
  if (dataStr.includes('/')) {
    const partes = dataStr.split('/')
    if (partes.length === 3) {
      const [d, m, y] = partes
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00Z`
    }
  }
  const d = new Date(dataStr)
  return isNaN(d.getTime()) ? undefined : d.toISOString()
}

const mapPacienteToDB = (frontendObj: any): any => ({
  nome: frontendObj.nome,
  data_nascimento: frontendObj.data_nascimento?.includes('/') 
    ? frontendObj.data_nascimento.split('/').reverse().join('-') 
    : frontendObj.data_nascimento,
  cpf: frontendObj.cpf,
  email: frontendObj.email || null,
  celular: frontendObj.telefone,
  endereco_completo: frontendObj.endereco || null,
  profissao: frontendObj.profissao || null,
  origem: frontendObj.origem_encaminhamento,
  indicacao_nome: frontendObj.indicacao_nome || null,
  indicacao_telefone: frontendObj.indicacao_telefone || null,
  indicacao_empresa: frontendObj.indicacao_empresa || null,
  indicacao_email: frontendObj.indicacao_email || null,
  created_at: parseDataToISO(frontendObj.data_criacao),
  updated_by: frontendObj.updated_by
})

// PACIENTES
export const getPacientes = async (): Promise<Paciente[]> => {
  const { data, error } = await supabase.from('pacientes').select('*').is('deleted_at', null).order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapDBToPaciente)
}

export const getPacienteById = async (id: string): Promise<Paciente | null> => {
  const { data, error } = await supabase.from('pacientes').select('*').eq('id', id).is('deleted_at', null).single()
  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw error
  }
  return mapDBToPaciente(data)
}

export const insertPaciente = async (pacienteData: any): Promise<Paciente> => {
  const dbPayload = mapPacienteToDB(pacienteData)
  const { data, error } = await supabase.from('pacientes').insert([dbPayload]).select().single()
  if (error) throw error
  return mapDBToPaciente(data)
}

export const softDeletePaciente = async (id: string): Promise<void> => {
  const user = (await supabase.auth.getSession()).data.session?.user
  const { error } = await supabase.from('pacientes').update({
    deleted_at: new Date().toISOString(),
    deleted_by: user?.id
  }).eq('id', id)
  if (error) throw error
}

// Mappers para AvaliacaoInicial
const mapDBToAvaliacao = (dbRow: any): AvaliacaoInicial => ({
  id: dbRow.id,
  paciente_id: dbRow.paciente_id,
  data_avaliacao: dbRow.data_avaliacao,
  queixa_principal: dbRow.queixa_principal || '',
  objetivo_paciente: dbRow.objetivo_paciente || '',
  regiao_sintomas: dbRow.regiao_sintomas || '',
  lado_acometido: dbRow.lado_acometido as any,
  historia_queixa: dbRow.historia_queixa || '',
  comportamento_sintomas: typeof dbRow.comportamento_sintomas === 'string' ? JSON.parse(dbRow.comportamento_sintomas || '{}') : (dbRow.comportamento_sintomas || {}),
  padrao_24_horas: dbRow.padrao_24_horas || '',
  fatores_agravantes: dbRow.fatores_agravantes || '',
  fatores_aliviantes: dbRow.fatores_aliviantes || '',
  irritabilidade: dbRow.irritabilidade as any,
  limitacoes_funcionais: dbRow.limitacoes_funcionais || '',
  carga_fisica: dbRow.carga_fisica || '',
  anexos: dbRow.anexos || [],
  historico_saude: dbRow.historico_saude || '',
  red_flags: dbRow.red_flags || '',
  exame_fisico: dbRow.exame_fisico || '',
  exame_inspecao: dbRow.exame_inspecao || '',
  exame_adm: dbRow.exame_adm || '',
  exame_forca: dbRow.exame_forca || '',
  exame_testes_especiais: dbRow.exame_testes_especiais || '',
  exame_neurologico: dbRow.exame_neurologico || '',
  exame_observacoes_extras: dbRow.exame_observacoes_extras || '',
  hipotese_clinica: dbRow.hipotese_clinica || '',
  objetivos: dbRow.objetivos || { curto_prazo: '', medio_prazo: '', longo_prazo: '' },
  plano_tratamento: dbRow.plano_tratamento || [],
  created_by: dbRow.created_by,
  updated_by: dbRow.updated_by,
  deleted_at: dbRow.deleted_at
})

const mapAvaliacaoToDB = (frontendObj: any): any => ({
  paciente_id: frontendObj.paciente_id,
  data_avaliacao: frontendObj.data_avaliacao,
  queixa_principal: frontendObj.queixa_principal || null,
  objetivo_paciente: frontendObj.objetivo_paciente || null,
  regiao_sintomas: frontendObj.regiao_sintomas || null,
  lado_acometido: frontendObj.lado_acometido || null,
  historia_queixa: frontendObj.historia_queixa || null,
  comportamento_sintomas: null, // não usado no form atual
  padrao_24_horas: frontendObj.padrao_24_horas || null,
  fatores_agravantes: frontendObj.fatores_agravantes || null,
  fatores_aliviantes: frontendObj.fatores_aliviantes || null,
  irritabilidade: frontendObj.irritabilidade || null,
  limitacoes_funcionais: frontendObj.limitacoes_funcionais || null,
  carga_fisica: frontendObj.carga_fisica || null,
  historico_saude: frontendObj.historico_saude || null,
  red_flags: frontendObj.red_flags || null,
  exame_fisico: frontendObj.exame_fisico || null,
  exame_inspecao: frontendObj.exame_inspecao || null,
  exame_adm: frontendObj.exame_adm || null,
  exame_forca: frontendObj.exame_forca || null,
  exame_testes_especiais: frontendObj.exame_testes_especiais || null,
  exame_neurologico: frontendObj.exame_neurologico || null,
  exame_observacoes_extras: frontendObj.exame_observacoes_extras || null,
  hipotese_clinica: frontendObj.hipotese_clinica || null,
  objetivos: {
    curto_prazo: frontendObj.objetivos_curto || '',
    medio_prazo: frontendObj.objetivos_medio || '',
    longo_prazo: frontendObj.objetivos_longo || ''
  },
  plano_tratamento: frontendObj.plano_tratamento || [],
  anexos: frontendObj.anexos || [],
  updated_by: frontendObj.updated_by
})

// Mappers para Evolucao
const mapDBToEvolucao = (dbRow: any): EvolucaoAtendimento => ({
  id: dbRow.id,
  paciente_id: dbRow.paciente_id,
  data: dbRow.data,
  movimento_teste_escolhido: dbRow.movimento_teste_escolhido || '',
  escala_dor_antes: dbRow.escala_dor_antes || 0,
  escala_dor_depois: dbRow.escala_dor_depois || 0,
  adm_antes: dbRow.adm_antes ? String(dbRow.adm_antes) : '0',
  adm_depois: dbRow.adm_depois ? String(dbRow.adm_depois) : '0',
  efeito_clinico_intervencao: dbRow.efeito_clinico_intervencao as any,
  condutas_realizadas: dbRow.condutas_realizadas || [],
  desempenho_paciente: dbRow.desempenho_paciente || 5,
  relato_livre: dbRow.relato_livre || '',
  anexos: dbRow.anexos || [],
  created_by: dbRow.created_by,
  updated_by: dbRow.updated_by,
  deleted_at: dbRow.deleted_at
})

const mapEvolucaoToDB = (frontendObj: any): any => ({
  paciente_id: frontendObj.paciente_id,
  data: frontendObj.data,
  movimento_teste_escolhido: frontendObj.movimento_teste_escolhido || null,
  escala_dor_antes: typeof frontendObj.escala_dor_antes === 'number' ? frontendObj.escala_dor_antes : parseInt(frontendObj.escala_dor_antes || '0'),
  escala_dor_depois: typeof frontendObj.escala_dor_depois === 'number' ? frontendObj.escala_dor_depois : parseInt(frontendObj.escala_dor_depois || '0'),
  adm_antes: parseInt(frontendObj.adm_antes || '0'),
  adm_depois: parseInt(frontendObj.adm_depois || '0'),
  efeito_clinico_intervencao: frontendObj.efeito_clinico_intervencao || null,
  condutas_realizadas: frontendObj.condutas_realizadas || [],
  desempenho_paciente: frontendObj.desempenho_paciente || 5,
  relato_livre: frontendObj.relato_livre || null,
  anexos: frontendObj.anexos || [],
  updated_by: frontendObj.updated_by
})

// AVALIAÇÕES INICIAIS
export const getAvaliacoesByPaciente = async (pacienteId: string): Promise<AvaliacaoInicial[]> => {
  // Retorna até as deletadas para mostrar como "Inativo"
  const { data, error } = await supabase.from('avaliacoes_iniciais').select('*').eq('paciente_id', pacienteId).order('data_avaliacao', { ascending: false })
  if (error) throw error
  return (data || []).map(d => {
    const av = mapDBToAvaliacao(d)
    if (d.deleted_at) (av as any).deleted_at = d.deleted_at
    return av
  })
}

export const insertAvaliacao = async (avaliacaoData: any): Promise<AvaliacaoInicial> => {
  const dbPayload = mapAvaliacaoToDB(avaliacaoData)
  const { data, error } = await supabase.from('avaliacoes_iniciais').insert([dbPayload]).select().single()
  if (error) throw error
  return mapDBToAvaliacao(data)
}

export const softDeleteAvaliacao = async (id: string): Promise<void> => {
  const user = (await supabase.auth.getSession()).data.session?.user
  const { error } = await supabase.from('avaliacoes_iniciais').update({
    deleted_at: new Date().toISOString(),
    deleted_by: user?.id
  }).eq('id', id)
  if (error) throw error
}

// EVOLUÇÕES
export const getEvolucoesByPaciente = async (pacienteId: string): Promise<EvolucaoAtendimento[]> => {
  // Retorna até as deletadas para mostrar como "Inativo"
  const { data, error } = await supabase.from('evolucoes').select('*').eq('paciente_id', pacienteId).order('data', { ascending: false })
  if (error) throw error
  return (data || []).map(d => {
    const ev = mapDBToEvolucao(d)
    if (d.deleted_at) (ev as any).deleted_at = d.deleted_at
    return ev
  })
}

export const insertEvolucao = async (evolucaoData: any): Promise<EvolucaoAtendimento> => {
  const dbPayload = mapEvolucaoToDB(evolucaoData)
  const { data, error } = await supabase.from('evolucoes').insert([dbPayload]).select().single()
  if (error) throw error
  return mapDBToEvolucao(data)
}

export const softDeleteEvolucao = async (id: string): Promise<void> => {
  const user = (await supabase.auth.getSession()).data.session?.user
  const { error } = await supabase.from('evolucoes').update({
    deleted_at: new Date().toISOString(),
    deleted_by: user?.id
  }).eq('id', id)
  if (error) throw error
}

export const updatePaciente = async (id: string, pacienteData: any): Promise<Paciente> => {
  const user = (await supabase.auth.getSession()).data.session?.user
  const dbPayload = mapPacienteToDB({ ...pacienteData, updated_by: user?.id })
  const { data, error } = await supabase.from('pacientes').update(dbPayload).eq('id', id).select().single()
  if (error) throw error
  return mapDBToPaciente(data)
}

export const updateAvaliacao = async (id: string, avaliacaoData: any): Promise<AvaliacaoInicial> => {
  const user = (await supabase.auth.getSession()).data.session?.user
  const dbPayload = mapAvaliacaoToDB({ ...avaliacaoData, updated_by: user?.id })
  const { data, error } = await supabase.from('avaliacoes_iniciais').update(dbPayload).eq('id', id).select().single()
  if (error) throw error
  return mapDBToAvaliacao(data)
}

export const updateEvolucao = async (id: string, evolucaoData: any): Promise<EvolucaoAtendimento> => {
  const user = (await supabase.auth.getSession()).data.session?.user
  const dbPayload = mapEvolucaoToDB({ ...evolucaoData, updated_by: user?.id })
  const { data, error } = await supabase.from('evolucoes').update(dbPayload).eq('id', id).select().single()
  if (error) throw error
  return mapDBToEvolucao(data)
}

export const getAtendimentosHoje = async (): Promise<number> => {
  const hojeStr = new Date().toISOString().split('T')[0]
  
  const { count: countAv } = await supabase
    .from('avaliacoes_iniciais')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null)
    .gte('data_avaliacao', hojeStr)

  const { count: countEv } = await supabase
    .from('evolucoes')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null)
    .gte('data', hojeStr)

  return (countAv || 0) + (countEv || 0)
}

// MOVIMENTOS E TESTES CONHECIDOS
export const DEFAULT_MOVIMENTOS_TESTES = [
  // Ombro & Cintura Escapular
  'Flexão de ombro',
  'Extensão de ombro',
  'Abdução de ombro',
  'Rotação externa de ombro',
  'Rotação interna de ombro',
  'Adução horizontal de ombro',
  'Teste de Neer (Impacto)',
  'Teste de Hawkins-Kennedy (Impacto)',
  'Teste de Jobe / Lata Vazia (Supraespinhal)',
  'Teste de Gerber / Lift-off (Subescapular)',
  'Teste de Patte / Hornblower (Infraespinhal)',
  'Teste de Yergason (Bíceps / Sulco intertubercular)',
  'Teste de Speed (Bíceps)',
  'Teste de O\'Brien (Lesão de SLAP)',
  'Teste de Apreensão de Ombro',
  'Teste de Recolocação (Relocation Test)',

  // Coluna Cervical & Torácica
  'Flexão cervical',
  'Extensão cervical',
  'Rotação cervical',
  'Inclinação lateral cervical',
  'Teste de Spurling (Radiculopatia cervical)',
  'Teste de Tração Cervical',
  'Teste de Quadrante Cervical',
  'Rotação torácica em quadrupede',
  'Extensão torácica',
  'Teste de Mobilidade de Costela',

  // Coluna Lombar & Pelve
  'Flexão lombar',
  'Extensão lombar (McKenzie)',
  'Inclinação lateral lombar',
  'Rotação de tronco',
  'Teste de Lasègue / Elevação da perna reta (SLR)',
  'Teste de Slump (Tensão neural)',
  'Teste de Schober (Flexibilidade lombar)',
  'Teste de Instabilidade Prona',
  'Teste de Provocação Sacroilíaca (Distração / Compressão)',
  'Teste de Gaenslen (Sacroilíaca)',

  // Quadril & Pelve
  'Flexão de quadril',
  'Extensão de quadril',
  'Abdução de quadril',
  'Adução de quadril',
  'Rotação externa de quadril',
  'Rotação interna de quadril',
  'Teste FABER / Patrick (Sacroilíaca / Quadril)',
  'Teste FADDIR (Impacto Fêmoro-Acetabular)',
  'Teste de Thomas (Flexores de quadril)',
  'Teste de Ober (Tensor da Fáscia Lata)',
  'Teste de Ely (Reto Femoral)',
  'Teste de Trendelenburg (Glúteo médio)',

  // Joelho
  'Flexão de joelho',
  'Extensão de joelho',
  'Teste de Lachman (LCA)',
  'Teste de Gaveta Anterior (LCA)',
  'Teste de Gaveta Posterior (LCP)',
  'Teste de Pivot-Shift (Instabilidade LCA)',
  'Estresse em Varo do joelho (LCL)',
  'Estresse em Valgo do joelho (LCM)',
  'Teste de McMurray (Menisco)',
  'Teste de Apley (Menisco)',
  'Teste de Thessaly (Menisco)',
  'Teste de Apreensão Patelar',

  // Tornozelo & Pé
  'Dorsiflexão de tornozelo em descarga de peso (Lunge test)',
  'Plantiflexão de tornozelo',
  'Inversão de tornozelo',
  'Eversão de tornozelo',
  'Teste de Gaveta Anterior do Tornozelo',
  'Teste de Inclinação Talar (Talar tilt test)',
  'Teste de Thompson (Tendão de Aquiles)',
  'Teste da Squeeze (Sindesmose)',

  // Cotovelo, Punho & Mão
  'Flexão de cotovelo',
  'Extensão de cotovelo',
  'Pronação de antebraço',
  'Supinação de antebraço',
  'Teste para Epicondilite Lateral (Cozen / Mill)',
  'Teste para Epicondilite Medial',
  'Teste de Phalen (Túnel do Carpo)',
  'Teste de Tinel no punho',
  'Teste de Finkelstein (De Quervain)',

  // Funcionais, Controle Motor & Neurodinâmica
  'Agachamento profundo',
  'Agachamento unipodal (Single leg squat)',
  'Elevação pélvica',
  'Elevação de calcanhar (Plantiflexão unipodal)',
  'Step-down teste (Descida de degrau)',
  'Y-Balance Test / Star Excursion',
  'Drop Jump Test (Valgo dinâmico)',
  'Teste de Mobilidade Neural do Nervo Mediano (ULTT 1)',
  'Teste de Mobilidade Neural do Nervo Radial (ULTT 2)',
  'Teste de Mobilidade Neural do Nervo Ulnar (ULTT 3)'
]

export const getMovimentosTestes = async (): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('movimentos_testes')
      .select('nome')
      .order('nome', { ascending: true })

    if (error || !data || data.length === 0) {
      return DEFAULT_MOVIMENTOS_TESTES
    }

    const nomesDoBanco = data.map((d: any) => d.nome)
    // Mescla itens padrão e banco sem duplicatas
    const unicos = Array.from(new Set([...DEFAULT_MOVIMENTOS_TESTES, ...nomesDoBanco]))
    return unicos
  } catch (err) {
    console.warn('Tabela movimentos_testes não encontrada ou offline, usando padrões:', err)
    return DEFAULT_MOVIMENTOS_TESTES
  }
}

export const insertMovimentoTeste = async (nome: string): Promise<void> => {
  const nomeLimpo = nome.trim()
  if (!nomeLimpo) return

  try {
    // Tenta inserir no banco Supabase
    await supabase.from('movimentos_testes').insert([{ nome: nomeLimpo }])
  } catch (err) {
    console.warn('Não foi possível salvar novo movimento no Supabase:', err)
  }
}
