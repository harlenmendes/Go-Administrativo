// ============================================================
// Tipos do domínio FisioApp
// ============================================================

export type TipoAnexo = 'imagem' | 'pdf'

export interface Anexo {
  id: string
  tipo: TipoAnexo
  url: string
  nome: string
  descricao?: string
  data?: string
}

export type OrigemEncaminhamento = 'Médico' | 'Indicação' | 'Particular'
export type LadoAcometido = 'Direito' | 'Esquerdo' | 'Bilateral' | 'Linha Média'
export type Irritabilidade = 'Baixa' | 'Moderada' | 'Alta'
export type EfeitoClinico =
  | 'Sem mudança'
  | 'Melhora pequena'
  | 'Melhora moderada'
  | 'Melhora importante'
  | 'Piora'

export type ConductaRealizada =
  | 'Educação em dor'
  | 'Terapia manual'
  | 'Exercício terapêutico'
  | 'Controle motor'
  | 'Eletroterapia'
  | 'Agulhamento seco'
  | 'Liberação miofascial'
  | 'Treinamento de marcha'
  | 'Orientações domiciliares'
  | 'Exercício de mobilidade neural'
  | 'PAC em coluna cervical'
  | 'PAC em coluna lombar'
  | 'PAC em região torácica'
  | 'Bandagem'
  | 'Laserterapia'

export interface AuditTrail {
  deleted_at?: string
  created_by?: string
  updated_by?: string
}

export interface Paciente extends AuditTrail {
  id: string
  nome: string
  data_nascimento: string
  cpf: string
  email: string
  endereco: string
  profissao: string
  telefone: string
  origem_encaminhamento: OrigemEncaminhamento
  indicacao_detalhes?: {
    nome: string
    telefone: string
    empresa: string
    email: string
  }
  data_criacao: string
  foto_url?: string
}

export interface ComportamentoSintomas {
  localizacao: string
  dor_atual: number
  dor_melhor: number
  dor_pior: number
  constante: boolean // true = constante, false = intermitente
  qualidade: string // ex: "Queimação, pontada, latejante"
}

export interface ObjetivosPaciente {
  curto_prazo: string
  medio_prazo: string
  longo_prazo: string
}

export interface AvaliacaoInicial extends AuditTrail {
  id: string
  paciente_id: string
  data_avaliacao: string
  queixa_principal: string
  objetivo_paciente: string
  regiao_sintomas: string
  lado_acometido: LadoAcometido
  historia_queixa: string
  comportamento_sintomas: ComportamentoSintomas
  padrao_24_horas: string
  fatores_agravantes: string
  fatores_aliviantes: string
  irritabilidade: Irritabilidade
  limitacoes_funcionais: string
  carga_fisica: string
  anexos: Anexo[]
  historico_saude: string
  red_flags: string
  exame_fisico: string
  exame_inspecao?: string
  exame_adm?: string
  exame_forca?: string
  exame_testes_especiais?: string
  exame_neurologico?: string
  exame_observacoes_extras?: string
  hipotese_clinica: string
  objetivos: ObjetivosPaciente
  plano_tratamento: ConductaRealizada[]
}

export interface EvolucaoAtendimento extends AuditTrail {
  id: string
  paciente_id: string
  data: string
  movimento_teste_escolhido: string
  escala_dor_antes: number
  escala_dor_depois: number
  adm_antes: string
  adm_depois: string
  efeito_clinico_intervencao: EfeitoClinico
  condutas_realizadas: ConductaRealizada[]
  desempenho_paciente: number // 1-5
  relato_livre: string
  anexos: Anexo[]
}

// Helper types para o dashboard
export interface EstatisticasDia {
  total_atendimentos: number
  melhoras_importantes: number
  melhoras: number
  sem_mudanca: number
  pioras: number
}
