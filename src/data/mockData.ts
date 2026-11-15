import type {
  Paciente,
  AvaliacaoInicial,
  EvolucaoAtendimento,
  Anexo,
} from '@/types'

// ============================================================
// Pacientes mockados
// ============================================================
export const mockPacientes: Paciente[] = [
  {
    id: 'p1',
    nome: 'Mariana Costa Silva',
    data_nascimento: '1988-04-15',
    cpf: '123.456.789-00',
    email: 'mariana.costa@email.com',
    endereco: 'Rua das Flores, 123, Apto 42 - Centro, São Paulo/SP, 01000-000',
    profissao: 'Arquiteta',
    telefone: '(11) 98765-4321',
    origem_encaminhamento: 'Médico',
    data_criacao: '2026-07-28',
    foto_url: undefined,
  },
  {
    id: 'p2',
    nome: 'Carlos Eduardo Mendes',
    data_nascimento: '1975-11-03',
    cpf: '234.567.890-11',
    email: 'carlos.mendes@email.com',
    endereco: 'Av. Paulista, 1000, Bloco B - Bela Vista, São Paulo/SP, 01310-100',
    profissao: 'Engenheiro de Software',
    telefone: '(11) 91234-5678',
    origem_encaminhamento: 'Indicação',
    data_criacao: '2026-08-10',
    foto_url: undefined,
  },
  {
    id: 'p3',
    nome: 'João Pedro Alves',
    data_nascimento: '1995-02-20',
    cpf: '345.678.901-22',
    email: 'joao.alves@email.com',
    endereco: 'Rua Augusta, 500, Casa 2 - Consolação, São Paulo/SP, 01305-000',
    profissao: 'Estudante',
    telefone: '(11) 95555-4444',
    origem_encaminhamento: 'Particular',
    data_criacao: '2026-09-01',
    foto_url: undefined,
  },
  {
    id: 'p4',
    nome: 'Amanda Ferreira Rocha',
    data_nascimento: '1992-08-12',
    cpf: '456.789.012-33',
    email: 'amanda.rocha@email.com',
    endereco: 'Rua das Oliveiras, 45, Casa - Pinheiros, São Paulo/SP, 05400-000',
    profissao: 'Designer',
    telefone: '(11) 97777-6666',
    origem_encaminhamento: 'Particular',
    data_criacao: '2026-09-18',
    foto_url: undefined,
  },
  {
    id: 'p5',
    nome: 'Roberto Gomes',
    data_nascimento: '1968-05-25',
    cpf: '567.890.123-44',
    email: 'roberto.gomes@email.com',
    endereco: 'Av. Brasil, 200, Apto 101 - Jardins, São Paulo/SP, 01430-000',
    profissao: 'Empresário',
    telefone: '(11) 98888-2222',
    origem_encaminhamento: 'Indicação',
    data_criacao: '2026-09-19',
    foto_url: undefined,
  },
]

// ============================================================
// Avaliações iniciais
// ============================================================
export const mockAvaliacoes: AvaliacaoInicial[] = [
  {
    id: 'av1',
    paciente_id: 'p1',
    data_avaliacao: '2026-08-01',
    queixa_principal: 'Dor cervical com irradiação para o braço direito há 3 meses',
    objetivo_paciente: 'Voltar a trabalhar sem dor e conseguir virar o pescoço para dirigir',
    regiao_sintomas: 'Cervical',
    lado_acometido: 'Direito',
    historia_queixa: 'Início gradual após aumento de carga de trabalho remoto. Piora progressiva nas últimas 6 semanas.',
    comportamento_sintomas: {
      localizacao: 'Região cervical posterior D, irradiando para trapézio e braço até o cotovelo',
      dor_atual: 6,
      dor_melhor: 3,
      dor_pior: 9,
      constante: false,
      qualidade: 'Queimação e dormência no braço, pontada na região cervical',
    },
    padrao_24_horas: 'Pior pela manhã ao acordar e após longas horas sentada. Melhora ao se movimentar.',
    fatores_agravantes: 'Uso de computador por mais de 1h, rotação cervical para direita, dormir de lado',
    fatores_aliviantes: 'Calor local, alongamento leve, anti-inflamatório (eventual)',
    irritabilidade: 'Moderada',
    limitacoes_funcionais: 'Dificuldade para dirigir, usar celular, olhar por cima do ombro. Sono prejudicado.',
    carga_fisica: 'Trabalho sedentário (8h/dia home office). Sem atividade física regular.',
    historico_saude: 'Hipertensão controlada com medicação. Nega cirurgias anteriores.',
    red_flags: 'Ausentes',
    exame_fisico: `INSPEÇÃO: Leve anteriorização de cabeça. Protração de ombros.
AMPLITUDE: Rotação D 30°(dor+), Rotação E 60°, Flexão 40°(dor+), Extensão 50°.
PALPAÇÃO: Tensão em trapézio superior D, suboccipitais e escalenos D. Ponto gatilho ativo em trapézio superior.
FORÇA: Flexores cervicais profundos: 3+/5. Restante preservado.
TESTES ESPECIAIS: Spurling +D (reproduz dormência no braço D). Distração cervical: alivia sintomas. ULNT1: positivo D.
NEUROLÓGICO: Reflexos preservados. Sensibilidade diminuída levemente em C6 D.`,
    hipotese_clinica: 'Síndrome de compressão radicular C5-C6 à direita + Síndrome cruzada superior. Irritabilidade moderada.',
    objetivos: {
      curto_prazo: 'Reduzir dor de 6 para ≤3 em 4 sessões. Restaurar rotação cervical D ≥ 50°.',
      medio_prazo: 'Eliminar irradiação para o braço. Retornar ao trabalho sem limitação em 8 sessões.',
      longo_prazo: 'Independência no auto-gerenciamento. Prevenção de recidiva com programa de exercícios domiciliares.',
    },
    plano_tratamento: [
      'Educação em dor',
      'Terapia manual',
      'Exercício terapêutico',
      'Controle motor',
      'Orientações domiciliares',
    ],
    anexos: [
      {
        id: 'anx-av1-1',
        tipo: 'pdf' as const,
        url: '/mock-laudo.png',
        nome: 'Laudo RM Cervical.pdf',
        descricao: 'Ressonância Magnética Coluna Cervical — Jul/2026',
        data: '2026-07-15',
      },
      {
        id: 'anx-av1-2',
        tipo: 'imagem' as const,
        url: '/mock-rx-cervical.png',
        nome: 'RX Cervical lateral.jpg',
        descricao: 'Raio-X coluna cervical — incidência lateral',
        data: '2026-07-20',
      },
      {
        id: 'anx-av1-3',
        tipo: 'imagem' as const,
        url: '/mock-foto-cervical.png',
        nome: 'Avaliação postural inicial.jpg',
        descricao: 'Foto postural — vista posterior, anteriorização de cabeça',
        data: '2026-08-01',
      },
    ] as Anexo[],
  },
  {
    id: 'av2',
    paciente_id: 'p2',
    data_avaliacao: '2026-08-15',
    queixa_principal: 'Dor lombar crônica com irradiação para glúteo esquerdo há 1 ano',
    objetivo_paciente: 'Conseguir jogar futebol nos fins de semana e trabalhar sem dor',
    regiao_sintomas: 'Lombar',
    lado_acometido: 'Esquerdo',
    historia_queixa: 'Início após mudança de escritório. Piora há 3 meses. Episódio de "travamento" há 2 semanas.',
    comportamento_sintomas: {
      localizacao: 'L4-S1 bilateral, com predomínio E, irradiação para glúteo e face posterior da coxa E',
      dor_atual: 7,
      dor_melhor: 4,
      dor_pior: 10,
      constante: true,
      qualidade: 'Dor profunda e pesada na lombar, latejante no glúteo',
    },
    padrao_24_horas: 'Pior após longa permanência sentado e ao levantar. Melhora após aquecimento com caminhada leve.',
    fatores_agravantes: 'Sentar por mais de 30min, agachar, levantar peso, terreno irregular',
    fatores_aliviantes: 'Deitar de lado com travesseiro entre os joelhos, calor, anti-inflamatório',
    irritabilidade: 'Alta',
    limitacoes_funcionais: 'Incapaz de jogar futebol. Dificuldade para dirigir mais de 20min. Sono muito prejudicado.',
    carga_fisica: 'Trabalho sedentário. Futebol recreativo aos fins de semana (atualmente parado há 3 meses).',
    historico_saude: 'Sem comorbidades. Nega cirurgias. Pai com hérnia de disco.',
    red_flags: 'Ausentes. Nega alteração intestinal ou urinária.',
    exame_fisico: `INSPEÇÃO: Hiperlordose lombar. Leve inclinação lateral para esquerda.
AMPLITUDE: Flexão 60°(dor++), Extensão 15°(dor+), Inclinação E 20°, Inclinação D 30°.
PALPAÇÃO: Tensão paravertebral bilateral L4-S1. Dor à palpação em SI E. Piriforme E tenso.
FORÇA: Abdominais: 3/5. Glúteo médio E: 3+/5. Restante preservado.
TESTES ESPECIAIS: SLR E: positivo a 45° (reproduz irradiação). Slump: positivo E. FABER E: positivo (dor SI). Patrick: negativo.
NEUROLÓGICO: Reflexo aquileu E levemente diminuído. Sensibilidade preservada.`,
    hipotese_clinica: 'Lombociatalgia por compressão de raiz L5-S1 à esquerda (possível hérnia discal L4-L5 ou L5-S1). Irritabilidade alta. Disfunção de SI associada.',
    objetivos: {
      curto_prazo: 'Reduzir irritabilidade. Dor de 7 para ≤5 em 6 sessões. Aumentar tolerância a sentar para 45min.',
      medio_prazo: 'Eliminar irradiação para coxa. Permitir caminhadas de 30min sem dor em 12 sessões.',
      longo_prazo: 'Retorno ao futebol recreativo. Programa de fortalecimento de core e glúteos para prevenção.',
    },
    plano_tratamento: [
      'Educação em dor',
      'Terapia manual',
      'Exercício terapêutico',
      'Controle motor',
      'Orientações domiciliares',
      'Liberação miofascial',
    ],
    anexos: [
      {
        id: 'anx-av2-1',
        tipo: 'imagem' as const,
        url: '/mock-foto-cervical.png',
        nome: 'Avaliação postural lombar.jpg',
        descricao: 'Foto postural — hiperlordose lombar e inclinação lateral E',
        data: '2026-08-15',
      },
    ] as Anexo[],
  },
  {
    id: 'av3',
    paciente_id: 'p3',
    data_avaliacao: '2026-09-05',
    queixa_principal: 'Dor no joelho direito ao correr, especialmente nas descidas e escadas',
    objetivo_paciente: 'Correr os 10km do próximo mês sem dor',
    regiao_sintomas: 'Joelho',
    lado_acometido: 'Direito',
    historia_queixa: 'Início há 3 semanas após aumento de volume de treino (30 para 50km/semana). Sem trauma.',
    comportamento_sintomas: {
      localizacao: 'Face lateral do joelho D, região da banda iliotibial',
      dor_atual: 5,
      dor_melhor: 0,
      dor_pior: 8,
      constante: false,
      qualidade: 'Queimação e facada lateral ao joelho durante corrida',
    },
    padrao_24_horas: 'Ausente em repouso. Surge após 15min de corrida, especialmente em descidas.',
    fatores_agravantes: 'Corrida (especialmente descidas e ritmo mais rápido), escadas, agachamento profundo',
    fatores_aliviantes: 'Repouso, gelo, anti-inflamatório tópico',
    irritabilidade: 'Baixa',
    limitacoes_funcionais: 'Incapaz de completar treinos. Sem limitação nas atividades diárias.',
    carga_fisica: 'Corredora amadora. Treina 5x/semana. Volume atual reduzido para 20km/semana.',
    historico_saude: 'Saudável. Nega cirurgias. Nega outras condições.',
    red_flags: 'Ausentes',
    exame_fisico: `INSPEÇÃO: Sem edema ou alterações tróficas.
PALPAÇÃO: Dor à palpação em côndilo lateral femoral D (inserção da BIT). Tensão em TFL e glúteo médio D.
AMPLITUDE: Flexão 130° (sem dor), Extensão completa. ADM preservada.
FORÇA: Abdutores de quadril D: 3+/5 (fraqueza relativa vs E). Glúteo médio D: 4-/5.
TESTES ESPECIAIS: Ober: positivo D. Noble: positivo D. Teste de Renne: positivo.
ANÁLISE DA CORRIDA (vídeo): Adução excessiva do quadril no apoio unipodal.`,
    hipotese_clinica: 'Síndrome da Banda Iliotibial (SBIT) por sobrecarga. Fraqueza de abdutores de quadril como fator contribuinte. Irritabilidade baixa — prognóstico favorável.',
    objetivos: {
      curto_prazo: 'Correr 5km sem dor em 2 semanas. Reduzir dor para ≤2 durante treinos.',
      medio_prazo: 'Completar treino de 10km sem dor. Corrigir padrão biomecânico.',
      longo_prazo: 'Completar a prova dos 10km. Programa de fortalecimento preventivo.',
    },
    plano_tratamento: [
      'Educação em dor',
      'Exercício terapêutico',
      'Controle motor',
      'Liberação miofascial',
      'Orientações domiciliares',
    ],
    anexos: [
      {
        id: 'anx-av3-1',
        tipo: 'imagem' as const,
        url: '/mock-foto-joelho.png',
        nome: 'Step down test — valgo joelho D.jpg',
        descricao: 'Análise biomecânica: adução excessiva de quadril no apoio unipodal D',
        data: '2026-09-05',
      },
    ] as Anexo[],
  },
]

// ============================================================
// Evoluções (Timeline de Teste & Reteste)
// ============================================================
export const mockEvolucoes: EvolucaoAtendimento[] = [
  // ---- Mariana (p1) - Cervical ----
  {
    id: 'ev1',
    paciente_id: 'p1',
    data: '2026-08-01',
    movimento_teste_escolhido: 'Rotação cervical direita',
    escala_dor_antes: 8,
    escala_dor_depois: 5,
    adm_antes: '30°',
    adm_depois: '42°',
    efeito_clinico_intervencao: 'Melhora moderada',
    condutas_realizadas: ['Educação em dor', 'Terapia manual', 'Orientações domiciliares'],
    desempenho_paciente: 4,
    relato_livre: 'Paciente relatou entender melhor a condição. Mobilização neuromeníngea (ULNT1) provocou dor que depois aliviou. Orientada sobre postura no home office.',
    anexos: [
      {
        id: 'anx-ev1-1',
        tipo: 'imagem' as const,
        url: '/mock-foto-cervical.png',
        nome: 'Foto avaliação postural S1.jpg',
        descricao: 'Foto inicial: anteriorização de cabeça e protração de ombros',
        data: '2026-08-01',
      },
    ],
  },
  {
    id: 'ev2',
    paciente_id: 'p1',
    data: '2026-08-05',
    movimento_teste_escolhido: 'Rotação cervical direita',
    escala_dor_antes: 6,
    escala_dor_depois: 3,
    adm_antes: '40°',
    adm_depois: '52°',
    efeito_clinico_intervencao: 'Melhora moderada',
    condutas_realizadas: ['Terapia manual', 'Exercício terapêutico', 'Controle motor'],
    desempenho_paciente: 4,
    relato_livre: 'Boa resposta à mobilização articular C5-C6. Iniciou exercícios de fortalecimento dos flexores cervicais profundos. Dormência no braço diminuiu.',
    anexos: [],
  },
  {
    id: 'ev3',
    paciente_id: 'p1',
    data: '2026-08-12',
    movimento_teste_escolhido: 'Rotação cervical direita',
    escala_dor_antes: 4,
    escala_dor_depois: 1,
    adm_antes: '50°',
    adm_depois: '62°',
    efeito_clinico_intervencao: 'Melhora importante',
    condutas_realizadas: ['Terapia manual', 'Exercício terapêutico', 'Controle motor', 'Orientações domiciliares'],
    desempenho_paciente: 5,
    relato_livre: 'Excelente evolução! Dormência no braço praticamente resolvida. ADM quase simétrica. Retornou a dirigir sem dor. Progressão dos exercícios.',
    anexos: [
      {
        id: 'anx-ev3-1',
        tipo: 'imagem' as const,
        url: '/mock-rx-cervical.png',
        nome: 'RX cervical reavaliação.jpg',
        descricao: 'Raio-X de controle: melhora da retificação da lordose',
        data: '2026-08-12',
      },
    ],
  },
  {
    id: 'ev4',
    paciente_id: 'p1',
    data: '2026-08-20',
    movimento_teste_escolhido: 'Rotação cervical direita',
    escala_dor_antes: 2,
    escala_dor_depois: 0,
    adm_antes: '58°',
    adm_depois: '68°',
    efeito_clinico_intervencao: 'Melhora importante',
    condutas_realizadas: ['Exercício terapêutico', 'Controle motor', 'Educação em dor'],
    desempenho_paciente: 5,
    relato_livre: 'Paciente refere que não sentiu dor durante toda a semana. Trabalha no computador sem limitação. Estabelecido programa de manutenção domiciliar.',
    anexos: [],
  },
  {
    id: 'ev5',
    paciente_id: 'p1',
    data: '2026-09-02',
    movimento_teste_escolhido: 'Rotação cervical direita',
    escala_dor_antes: 1,
    escala_dor_depois: 0,
    adm_antes: '65°',
    adm_depois: '68°',
    efeito_clinico_intervencao: 'Melhora pequena',
    condutas_realizadas: ['Exercício terapêutico', 'Orientações domiciliares'],
    desempenho_paciente: 5,
    relato_livre: 'Alta clínica planejada para próxima sessão. Paciente empoderada e realizando exercícios diariamente. Retorno se necessário.',
    anexos: [],
  },

  // ---- Carlos (p2) - Lombar ----
  {
    id: 'ev6',
    paciente_id: 'p2',
    data: '2026-08-15',
    movimento_teste_escolhido: 'Flexão lombar em pé',
    escala_dor_antes: 8,
    escala_dor_depois: 8,
    adm_antes: '55°',
    adm_depois: '55°',
    efeito_clinico_intervencao: 'Sem mudança',
    condutas_realizadas: ['Educação em dor', 'Terapia manual'],
    desempenho_paciente: 3,
    relato_livre: 'Alta irritabilidade. Abordagem inicial conservadora com educação em dor e técnicas de baixa carga. Paciente resistente ao processo inicialmente.',
    anexos: [
      {
        id: 'anx-ev6-1',
        tipo: 'imagem' as const,
        url: '/mock-foto-cervical.png',
        nome: 'Avaliação postural lombar S1.jpg',
        descricao: 'Foto postural inicial: hiperlordose lombar acentuada',
        data: '2026-08-15',
      },
    ],
  },
  {
    id: 'ev7',
    paciente_id: 'p2',
    data: '2026-08-20',
    movimento_teste_escolhido: 'Flexão lombar em pé',
    escala_dor_antes: 7,
    escala_dor_depois: 5,
    adm_antes: '58°',
    adm_depois: '68°',
    efeito_clinico_intervencao: 'Melhora moderada',
    condutas_realizadas: ['Terapia manual', 'Exercício terapêutico', 'Liberação miofascial'],
    desempenho_paciente: 4,
    relato_livre: 'Irritabilidade reduzindo. Boa resposta à tração lombar e mobilização neuromecânica. Iniciou exercícios de estabilização segmentar.',
    anexos: [],
  },
  {
    id: 'ev8',
    paciente_id: 'p2',
    data: '2026-08-28',
    movimento_teste_escolhido: 'Flexão lombar em pé',
    escala_dor_antes: 5,
    escala_dor_depois: 3,
    adm_antes: '70°',
    adm_depois: '80°',
    efeito_clinico_intervencao: 'Melhora moderada',
    condutas_realizadas: ['Terapia manual', 'Exercício terapêutico', 'Controle motor'],
    desempenho_paciente: 4,
    relato_livre: 'Irradiação para coxa diminuiu significativamente. Tolerância a sentar aumentou para 45min. Progressão dos exercícios de core.',
    anexos: [],
  },
  {
    id: 'ev9',
    paciente_id: 'p2',
    data: '2026-09-10',
    movimento_teste_escolhido: 'Flexão lombar em pé',
    escala_dor_antes: 4,
    escala_dor_depois: 2,
    adm_antes: '78°',
    adm_depois: '88°',
    efeito_clinico_intervencao: 'Melhora importante',
    condutas_realizadas: ['Exercício terapêutico', 'Controle motor', 'Terapia manual'],
    desempenho_paciente: 5,
    relato_livre: 'Paciente conseguiu jogar futebol por 15min no fim de semana! Diz que foi o melhor dia em meses. Irradiação ausente durante o jogo.',
    anexos: [],
  },
  {
    id: 'ev10',
    paciente_id: 'p2',
    data: '2026-09-18',
    movimento_teste_escolhido: 'Flexão lombar em pé',
    escala_dor_antes: 3,
    escala_dor_depois: 1,
    adm_antes: '85°',
    adm_depois: '90°',
    efeito_clinico_intervencao: 'Melhora importante',
    condutas_realizadas: ['Exercício terapêutico', 'Controle motor'],
    desempenho_paciente: 5,
    relato_livre: 'Jogou 30min de futebol. Leve fadiga, sem dor. Trabalha 8h sentado sem limitação. Fase de alta progressiva.',
    anexos: [],
  },

  // ---- Ana Paula (p3) - Joelho ----
  {
    id: 'ev11',
    paciente_id: 'p3',
    data: '2026-09-05',
    movimento_teste_escolhido: 'Agachamento unipodal (step down test)',
    escala_dor_antes: 6,
    escala_dor_depois: 3,
    adm_antes: 'Sem limitação',
    adm_depois: 'Sem limitação',
    efeito_clinico_intervencao: 'Melhora moderada',
    condutas_realizadas: ['Educação em dor', 'Liberação miofascial', 'Exercício terapêutico'],
    desempenho_paciente: 4,
    relato_livre: 'Boa resposta ao tratamento inicial. Liberação de BIT e TFL + ativação de glúteo médio. Orientada a reduzir volume de treino em 50%.',
    anexos: [
      {
        id: 'anx-ev11-1',
        tipo: 'imagem' as const,
        url: '/mock-foto-joelho.png',
        nome: 'Step down test — sessão 1.jpg',
        descricao: 'Valgo dinâmico de joelho D no apoio unipodal — S1',
        data: '2026-09-05',
      },
    ],
  },
  {
    id: 'ev12',
    paciente_id: 'p3',
    data: '2026-09-10',
    movimento_teste_escolhido: 'Corrida na esteira 5 min',
    escala_dor_antes: 4,
    escala_dor_depois: 1,
    adm_antes: 'Sem limitação',
    adm_depois: 'Sem limitação',
    efeito_clinico_intervencao: 'Melhora importante',
    condutas_realizadas: ['Exercício terapêutico', 'Controle motor', 'Liberação miofascial'],
    desempenho_paciente: 5,
    relato_livre: 'Correu 5km sem dor! Excelente evolução. Correção do padrão de adução do quadril visível. Progressão dos exercícios de força.',
    anexos: [
      {
        id: 'anx-ev12-1',
        tipo: 'imagem' as const,
        url: '/mock-foto-joelho.png',
        nome: 'Step down test — sessão 3.jpg',
        descricao: 'Valgo de joelho visivelmente reduzido após 3 sessões — S3',
        data: '2026-09-10',
      },
    ],
  },
  {
    id: 'ev13',
    paciente_id: 'p3',
    data: '2026-09-18',
    movimento_teste_escolhido: 'Corrida na esteira 10 min com descida',
    escala_dor_antes: 2,
    escala_dor_depois: 0,
    adm_antes: 'Sem limitação',
    adm_depois: 'Sem limitação',
    efeito_clinico_intervencao: 'Melhora importante',
    condutas_realizadas: ['Exercício terapêutico', 'Controle motor', 'Orientações domiciliares'],
    desempenho_paciente: 5,
    relato_livre: 'Treinou 8km na rua, sem dor! Prova dos 10km em 12 dias. Paciente motivadíssima. Plano de treino progressivo elaborado.',
    anexos: [],
  },
]

// ============================================================
// Helpers
// ============================================================
export function getEvolucoesByPaciente(pacienteId: string): EvolucaoAtendimento[] {
  return mockEvolucoes
    .filter((e) => e.paciente_id === pacienteId)
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
}

export function getAvaliacaoByPaciente(pacienteId: string): AvaliacaoInicial | undefined {
  return mockAvaliacoes.find((a) => a.paciente_id === pacienteId)
}

export function getEvolucoesDoDia(data: string): EvolucaoAtendimento[] {
  return mockEvolucoes.filter((e) => e.data === data)
}

export function getPacienteById(id: string): Paciente | undefined {
  return mockPacientes.find((p) => p.id === id)
}
