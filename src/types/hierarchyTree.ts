export interface HierarchyTemaItem {
  id?: string;
  label: string;
  keywords?: string[];
}

export interface HierarchySubtopicoItem {
  id: string; // Ex: '4.2.1', '3.1.2', '5.5.6.1'
  label: string;
  shortLabel?: string;
  temas?: string[];
  keywords?: string[];
}

export interface HierarchyCapituloItem {
  id: string; // Ex: '2.1', '4.2', '5.5.6'
  label: string;
  shortLabel?: string;
  subtopicos?: HierarchySubtopicoItem[];
  temas?: string[];
  keywords?: string[];
}

export interface HierarchyTreeItem {
  id: string; // Ex: 'Módulo I', 'Módulo II'
  label: string;
  shortLabel?: string;
  capitulos?: HierarchyCapituloItem[];
}

export interface Official5LevelHierarchy {
  materia: string;
  modulo: string;
  capitulo: string;
  subtopico: string;
  tema: string;
}

export const OFFICIAL_MATERIA = 'Investigação Policial II (IPO II – APF)';

/**
 * ÁRVORE OFICIAL DE CONTEÚDO (IPO II – APF) - 5 NÍVEIS
 * Matéria > Módulo > Capítulo > Subtópico > Tema
 * Apenas itens com delimitação válida (✅), ignorando itens ⛔.
 */
export const OFFICIAL_HIERARCHY_TREE: HierarchyTreeItem[] = [
  // ==========================================
  // MÓDULO I: Obtenção de Elementos de Informação
  // ==========================================
  {
    id: 'Módulo I',
    label: 'MÓDULO I: Obtenção de Elementos de Informação',
    shortLabel: 'Módulo I – Obtenção de Elementos de Informação',
    capitulos: [
      {
        id: '2.1',
        label: 'Capítulo 2.1: Critérios para a seleção de técnicas investigativas',
        shortLabel: 'Capítulo 2.1',
        subtopicos: [],
        temas: [
          '3 pontos prévios (tipo penal, lacunas, linhas de investigação)',
          '5 perguntas (legal, eficaz, necessária, menos exposição, menos invasão)',
          'Escalonamento (menos intrusivo primeiro)',
          'Interlocução com a chefia e recursos',
          'Princípio da oportunidade',
          'Demais princípios da seleção de técnicas investigativas',
        ],
        keywords: [
          '2.1',
          'critérios para a seleção',
          'seleção de técnicas',
          'pontos prévios',
          '5 perguntas',
          'escalonamento',
          'menos intrusivo',
          'menos invasão',
          'interlocução com a chefia',
          'princípio da oportunidade',
        ],
      },
      {
        id: '2.2',
        label: 'Capítulo 2.2: Encadeamento e integração de técnicas',
        shortLabel: 'Capítulo 2.2',
        subtopicos: [],
        temas: [
          'Investigação em espiral',
          'Dado aberto gerando sigilo/interceptação',
          'Técnica prematura',
          'Redução de nulidades',
        ],
        keywords: [
          '2.2',
          'encadeamento e integração',
          'integração de técnicas',
          'investigação em espiral',
          'dado aberto gerando sigilo',
          'técnica prematura',
          'redução de nulidades',
        ],
      },
      {
        id: '2.3',
        label: 'Capítulo 2.3: Gestão de dados sensíveis e aspectos práticos de formalização',
        shortLabel: 'Capítulo 2.3',
        subtopicos: [],
        temas: [
          'Sigilo telefônico, bancário e fiscal',
          'Coleta legal',
          'Armazenamento e cadeia de custódia',
          'Formalização de dados sensíveis',
        ],
        keywords: [
          '2.3',
          'dados sensíveis',
          'sigilo telefônico',
          'sigilo bancário',
          'sigilo fiscal',
          'coleta legal',
          'cadeia de custódia',
          'formalização de dados sensíveis',
        ],
      },
      {
        id: '2.4',
        label: 'Capítulo 2.4: Processo investigativo, etapas da coleta de provas',
        shortLabel: 'Capítulo 2.4',
        subtopicos: [],
        temas: [
          'Instauração → meios ordinários → cautelares probatórias → cautelares pessoais/reais → conclusão',
          'Investigação como projeto',
          'Padrões probatórios crescentes',
          'Fase ostensiva e restituição de bens',
          'Cautelar pessoal e prazo com réu preso',
        ],
        keywords: [
          '2.4',
          'etapas da coleta',
          'processo investigativo',
          'meios ordinários',
          'cautelares probatórias',
          'investigação como projeto',
          'padrões probatórios',
          'fase ostensiva',
          'restituição de bens',
          'réu preso',
        ],
      },
    ],
  },

  // ==========================================
  // MÓDULO II: Formalização de Elementos de Informação
  // ==========================================
  {
    id: 'Módulo II',
    label: 'MÓDULO II: Formalização de Elementos de Informação',
    shortLabel: 'Módulo II – Formalização de Elementos de Informação',
    capitulos: [
      {
        id: '4.1',
        label: 'Capítulo 4.1: Fundamentação normativa',
        shortLabel: 'Capítulo 4.1',
        subtopicos: [],
        temas: [
          'Art. 9º CPP',
          'IN 255/2023 e suas alterações',
          'Art. 2º §3º da IN 255/2023',
          'Art. 4º (formato digital, e-POL)',
        ],
        keywords: [
          '4.1',
          'fundamentação normativa',
          'art. 9º cpp',
          'in 255/2023',
          'in 255',
          'e-pol',
          'formato digital',
        ],
      },
      {
        id: '4.2',
        label: 'Capítulo 4.2: Formalização da IN 255/2023',
        shortLabel: 'Capítulo 4.2',
        subtopicos: [
          {
            id: '4.2.1',
            label: 'Subtópico 4.2.1: Clareza e precisão',
            temas: ['Clareza e precisão na redação policial'],
            keywords: ['4.2.1', 'clareza e precisão', 'clareza'],
          },
          {
            id: '4.2.2',
            label: 'Subtópico 4.2.2: Objetividade e impessoalidade',
            temas: ['Objetividade e impessoalidade na redação policial'],
            keywords: ['4.2.2', 'objetividade e impessoalidade', 'impessoalidade'],
          },
          {
            id: '4.2.3',
            label: 'Subtópico 4.2.3: Concisão',
            temas: ['Concisão na redação policial'],
            keywords: ['4.2.3', 'concisão', 'conciso'],
          },
          {
            id: '4.2.4',
            label: 'Subtópico 4.2.4: Coesão e coerência',
            temas: ['Coesão e coerência na redação policial'],
            keywords: ['4.2.4', 'coesão e coerência', 'coesão', 'coerência'],
          },
          {
            id: '4.2.5',
            label: 'Subtópico 4.2.5: Formalização e padronização',
            temas: ['Formalização e padronização das peças'],
            keywords: ['4.2.5', 'formalização e padronização', 'padronização'],
          },
        ],
        temas: [
          'Lista de peças com artigos (flagrante/TCO, certidão, intimação, art. 43, IPJ e auto circunstanciado no art. 63, apreensões, relatório final no art. 85)',
          '7 características da redação',
        ],
        keywords: [
          '4.2',
          'formalização da in 255',
          'características da redação',
          'peças da in 255',
          'relatório final no art. 85',
        ],
      },
      {
        id: '4.3',
        label: 'Capítulo 4.3: Formalização de audiências',
        shortLabel: 'Capítulo 4.3',
        subtopicos: [],
        temas: [
          'Depoimento',
          'Declarações',
          'Interrogatório',
          'Acareação',
          'Gravação audiovisual',
          'Entrevista investigativa registrada em IPJ',
        ],
        keywords: [
          '4.3',
          'formalização de audiências',
          'depoimento',
          'declarações',
          'interrogatório',
          'acareação',
          'entrevista investigativa',
        ],
      },
      {
        id: '4.4',
        label: 'Capítulo 4.4: Formalização de reconhecimento',
        shortLabel: 'Capítulo 4.4',
        subtopicos: [],
        temas: [
          'Arts. 226-228 CPP',
          'Auto circunstanciado de reconhecimento',
          '2 testemunhas do ato',
          'Reconhecedores separados',
        ],
        keywords: [
          '4.4',
          'formalização de reconhecimento',
          'reconhecimento de pessoa',
          'art. 226 cpp',
          'arts. 226-228',
          'reconhecedores separados',
        ],
      },
      {
        id: '4.5',
        label: 'Capítulo 4.5: Formalização de exame pericial',
        shortLabel: 'Capítulo 4.5',
        subtopicos: [],
        temas: [
          'Laudo pericial',
          'Requisição à unidade técnico-científica',
          'SNC (Sistema Nacional de Criminalística)',
        ],
        keywords: [
          '4.5',
          'exame pericial',
          'laudo pericial',
          'unidade técnico-científica',
          'snc',
        ],
      },
      {
        id: '4.6',
        label: 'Capítulo 4.6: Formalização de outros atos de investigação',
        shortLabel: 'Capítulo 4.6',
        subtopicos: [
          {
            id: '4.6.1',
            label: 'Subtópico 4.6.1: Informação de Polícia Judiciária (IPJ)',
            temas: [
              '4.6.1.1 IPJ expositiva',
              '4.6.1.2 IPJ argumentativa',
              '4.6.1.3 Boas práticas (diagramas de vínculos, coordenadas, QR codes, legendas, linguagem objetiva, validação de fontes, organização sequencial, revisão, IA como apoio redacional)',
              '4.6.1.4 Más práticas (anexos com dados brutos, delegação sem validação, remissões genéricas, links extensos, jargões sem explicação)',
            ],
            keywords: [
              '4.6.1',
              'ipj',
              'informação de polícia judiciária',
              'ipj expositiva',
              'ipj argumentativa',
              'boas práticas',
              'más práticas',
              'diagramas de vínculos',
              'ia como apoio redacional',
            ],
          },
          {
            id: '4.6.2',
            label: 'Subtópico 4.6.2: Auto circunstanciado',
            temas: [
              'Busca domiciliar',
              'Ação controlada',
              'Infiltração física e virtual',
              'Interceptação telefônica',
            ],
            keywords: [
              '4.6.2',
              'auto circunstanciado',
              'busca domiciliar',
              'ação controlada',
              'infiltração física e virtual',
              'interceptação telefônica',
            ],
          },
        ],
        temas: [],
        keywords: ['4.6', 'outros atos de investigação'],
      },
    ],
  },

  // ==========================================
  // MÓDULO V: Fontes Abertas
  // ==========================================
  {
    id: 'Módulo V',
    label: 'MÓDULO V: Fontes Abertas',
    shortLabel: 'Módulo V – Fontes Abertas',
    capitulos: [
      {
        id: '3.1',
        label: 'Capítulo 3.1: Pesquisas em fontes abertas (OSINT)',
        shortLabel: 'Capítulo 3.1',
        subtopicos: [
          {
            id: '3.1.1',
            label: 'Subtópico 3.1.1: Categorias de fontes abertas',
            temas: [
              '3.1.1.1 Governamentais e registros oficiais',
              '3.1.1.2 Digitais e plataformas da internet',
              '3.1.1.3 Especializadas e setoriais',
              '3.1.1.4 Tradicionais',
            ],
            keywords: ['3.1.1', 'categorias de fontes abertas', 'governamentais', 'plataformas da internet', 'registros oficiais'],
          },
          {
            id: '3.1.2',
            label: 'Subtópico 3.1.2: Ferramentas de busca, acompanhamento e análise',
            temas: [
              '3.1.2.1 Busca avançada e operadores (Google Dorks)',
              '3.1.2.2 Preservação e histórico de páginas (Wayback Machine)',
              '3.1.2.3 Acompanhamento de redes sociais (SOCMINT)',
              '3.1.2.4 Geolocalização e imagens com pesquisa reversa',
              '3.1.2.5 Exemplo de uso integrado',
            ],
            keywords: [
              '3.1.2',
              'ferramentas de busca',
              'busca avançada',
              'operadores',
              'preservação e histórico',
              'redes sociais',
              'geolocalização e imagens',
              'pesquisa reversa',
            ],
          },
          {
            id: '3.1.3',
            label: 'Subtópico 3.1.3: Exemplos operacionais',
            temas: [
              '3.1.3.1 Fraude em licitações municipais',
              '3.1.3.2 Lavagem de dinheiro via empresas de fachada',
              '3.1.3.3 Tráfico internacional de pessoas',
            ],
            keywords: [
              '3.1.3',
              'exemplos operacionais',
              'licitações municipais',
              'empresas de fachada',
              'tráfico internacional de pessoas',
            ],
          },
          {
            id: '3.1.4',
            label: 'Subtópico 3.1.4: Boas práticas de documentação e custódia',
            temas: ['Boas práticas de documentação e custódia em OSINT'],
            keywords: ['3.1.4', 'documentação e custódia', 'custódia'],
          },
          {
            id: '3.1.5',
            label: 'Subtópico 3.1.5: Síntese operacional',
            temas: ['Síntese operacional de fontes abertas'],
            keywords: ['3.1.5', 'síntese operacional'],
          },
        ],
        temas: [],
        keywords: ['3.1', 'osint', 'fontes abertas', 'pesquisas em fontes abertas'],
      },
    ],
  },

  // ==========================================
  // MÓDULO VI: Pesquisa e Análise Cadastral
  // ==========================================
  {
    id: 'Módulo VI',
    label: 'MÓDULO VI: Pesquisa e Análise Cadastral',
    shortLabel: 'Módulo VI – Pesquisa e Análise Cadastral',
    capitulos: [
      {
        id: '3.2',
        label: 'Capítulo 3.2: Pesquisa em bancos de dados',
        shortLabel: 'Capítulo 3.2',
        subtopicos: [
          {
            id: '3.2.1',
            label: 'Subtópico 3.2.1: Bancos de dados conveniados',
            temas: [
              '3.2.1.1 Administrativos e cadastrais',
              '3.2.1.2 Policiais e de segurança pública',
              '3.2.1.3 De inteligência financeira',
            ],
            keywords: [
              '3.2.1',
              'bancos conveniados',
              'dados conveniados',
              'administrativos e cadastrais',
              'segurança pública',
              'inteligência financeira',
            ],
          },
          {
            id: '3.2.2',
            label: 'Subtópico 3.2.2: Bancos de dados internos da PF',
            temas: [
              '3.2.2.1 Administrativos e cadastrais (PF-Catálogo)',
              '3.2.2.2 Criminais e operacionais (NEXO e SINAPSE)',
            ],
            keywords: [
              '3.2.2',
              'bancos de dados internos',
              'pf-catálogo',
              'nexo',
              'sinapse',
            ],
          },
          {
            id: '3.2.3',
            label: 'Subtópico 3.2.3: Business Intelligence e análise de dados',
            temas: [
              '3.2.3.1 O Qlik Sense (componentes, carga de dados, instalação/acesso, uso básico com CIAF TREINO)',
            ],
            keywords: [
              '3.2.3',
              'business intelligence',
              'qlik sense',
              'ciaf treino',
              'análise de dados',
            ],
          },
        ],
        temas: [],
        keywords: ['3.2', 'pesquisa em bancos de dados', 'análise cadastral'],
      },
    ],
  },

  // ==========================================
  // MÓDULO VII: Análise de Vínculos
  // ==========================================
  {
    id: 'Módulo VII',
    label: 'MÓDULO VII: Análise de Vínculos',
    shortLabel: 'Módulo VII – Análise de Vínculos',
    capitulos: [
      {
        id: '3.4',
        label: 'Capítulo 3.4: Análise de vínculos',
        shortLabel: 'Capítulo 3.4',
        subtopicos: [
          {
            id: '3.4.3',
            label: 'Subtópico 3.4.3: Aplicações na investigação criminal brasileira',
            temas: ['Aplicações na investigação criminal brasileira e fluxo criminal'],
            keywords: ['3.4.3', 'aplicações na investigação criminal brasileira', 'investigação criminal brasileira'],
          },
          {
            id: '3.4.4',
            label: 'Subtópico 3.4.4: A Suíte i2',
            temas: [
              '3.4.4.1 Evolução das ferramentas de análise',
              '3.4.4.2 Ferramentas da suíte i2',
              '3.4.4.3 Componentes fundamentais (3.4.4.3.1 Entidades: CPF, CNPJ, placas, telefones, contas bancárias, endereços | 3.4.4.3.2 Vínculos)',
              '3.4.4.4 Representações (Ícone, Objeto OLE)',
              '3.4.4.5 Principais recursos de análise (Listar itens, Itens mais conectados, Janela de entidades vinculadas, Procurar visual/texto, Rede de conexão, Caminho, Barras e histogramas)',
            ],
            keywords: [
              '3.4.4',
              'suíte i2',
              'i2',
              'entidades',
              'vínculos',
              'ícone',
              'objeto ole',
              'itens mais conectados',
              'rede de conexão',
              'histogramas',
            ],
          },
          {
            id: '3.4.5',
            label: 'Subtópico 3.4.5: Conclusão',
            temas: ['Conclusão da análise de vínculos'],
            keywords: ['3.4.5', 'conclusão da análise de vínculos'],
          },
        ],
        temas: [],
        keywords: ['3.4', 'análise de vínculos'],
      },
    ],
  },

  // ==========================================
  // MÓDULO VIII: RIF, Relatório de Inteligência Financeira
  // ==========================================
  {
    id: 'Módulo VIII',
    label: 'MÓDULO VIII: RIF, Relatório de Inteligência Financeira',
    shortLabel: 'Módulo VIII – Relatório de Inteligência Financeira (RIF)',
    capitulos: [
      {
        id: '3.3',
        label: 'Capítulo 3.3: Análise de Relatórios de Inteligência Financeira',
        shortLabel: 'Capítulo 3.3',
        subtopicos: [
          {
            id: '3.3.1',
            label: 'Subtópico 3.3.1: Base legal e normativa',
            temas: ['COAF/UIF, pessoas obrigadas, julgamento do STF'],
            keywords: ['3.3.1', 'base legal e normativa', 'coaf', 'uif', 'pessoas obrigadas', 'stf'],
          },
          {
            id: '3.3.2',
            label: 'Subtópico 3.3.2: RIF com informações de autoridades estrangeiras',
            temas: ['Rede Egmont, canal SEI-C'],
            keywords: ['3.3.2', 'autoridades estrangeiras', 'rede egmont', 'sei-c'],
          },
          {
            id: '3.3.3',
            label: 'Subtópico 3.3.3: RIF recebido do Ministério Público',
            temas: ['Compartilhamento MP e instauração'],
            keywords: ['3.3.3', 'ministério público', 'mp', 'compartilhamento'],
          },
          {
            id: '3.3.4',
            label: 'Subtópico 3.3.4: Estrutura e conteúdo do RIF',
            temas: ['Comunicações COS e COE, fatores de alerta, anexos'],
            keywords: ['3.3.4', 'estrutura e conteúdo', 'cos', 'coe', 'fatores de alerta'],
          },
          {
            id: '3.3.5',
            label: 'Subtópico 3.3.5: Recebimento e tratamento do RIF na PF',
            temas: ['Triagem e distribuição de relatórios'],
            keywords: ['3.3.5', 'recebimento e tratamento', 'triagem', 'distribuição'],
          },
          {
            id: '3.3.6',
            label: 'Subtópico 3.3.6: Metodologia de análise de RIF',
            temas: [
              '3.3.6.1 Recebimento e organização dos documentos',
              '3.3.6.2 Leitura e identificação dos envolvidos',
              '3.3.6.3 Uso das ferramentas de análise',
              '3.3.6.4 Pesquisas em fontes abertas e sistemas corporativos',
              '3.3.6.5 Análise integrada e elaboração de IPJ',
            ],
            keywords: [
              '3.3.6',
              'metodologia de análise de rif',
              'leitura e identificação dos envolvidos',
              'elaboração de ipj',
            ],
          },
          {
            id: '3.3.7',
            label: 'Subtópico 3.3.7: Exemplos operacionais',
            temas: [
              '3.3.7.1 Lavagem por empresas de fachada',
              '3.3.7.2 Desvio de recursos públicos municipais',
              '3.3.7.3 Tráfico internacional de drogas e lavagem transnacional',
            ],
            keywords: ['3.3.7', 'exemplos operacionais de rif', 'lavagem transnacional'],
          },
          {
            id: '3.3.8',
            label: 'Subtópico 3.3.8: Síntese operacional',
            temas: ['Síntese operacional da inteligência financeira'],
            keywords: ['3.3.8', 'síntese operacional rif'],
          },
        ],
        temas: [],
        keywords: [
          '3.3',
          'rif',
          'relatório de inteligência financeira',
          'inteligência financeira',
          'coaf',
        ],
      },
    ],
  },

  // ==========================================
  // MÓDULO IX: Ações Encobertas
  // ==========================================
  {
    id: 'Módulo IX',
    label: 'MÓDULO IX: Ações Encobertas',
    shortLabel: 'Módulo IX – Ações Encobertas',
    capitulos: [
      {
        id: '3.5',
        label: 'Capítulo 3.5: Ações encobertas',
        shortLabel: 'Capítulo 3.5',
        subtopicos: [
          {
            id: '3.5.3',
            label: 'Subtópico 3.5.3: Recursos auxiliares',
            temas: [
              '3.5.3.1 História-cobertura (3.5.3.1.1 Classificação)',
              '3.5.3.1.2 Fotografia e filmagem operacional',
            ],
            keywords: [
              '3.5.3',
              'recursos auxiliares',
              'história-cobertura',
              'classificação',
              'fotografia e filmagem operacional',
            ],
          },
          {
            id: '3.5.4',
            label: 'Subtópico 3.5.4: Outras ações encobertas',
            temas: ['Técnicas acessórias e disfarces em ações encobertas'],
            keywords: ['3.5.4', 'outras ações encobertas', 'disfarces'],
          },
        ],
        temas: [],
        keywords: ['3.5', 'ações encobertas'],
      },
      {
        id: '3.6',
        label: 'Capítulo 3.6: Obtenção de dados oriundos de fontes humanas',
        shortLabel: 'Capítulo 3.6',
        subtopicos: [
          {
            id: '3.6.1',
            label: 'Subtópico 3.6.1: Comunicação',
            temas: ['Comunicação interpessoal investigativa'],
            keywords: ['3.6.1', 'comunicação'],
          },
          {
            id: '3.6.2',
            label: 'Subtópico 3.6.2: Fórmula da amizade',
            temas: ['Fórmula da amizade em fontes humanas'],
            keywords: ['3.6.2', 'fórmula da amizade'],
          },
          {
            id: '3.6.3',
            label: 'Subtópico 3.6.3: Armas da persuasão',
            temas: ['Armas da persuasão na coleta'],
            keywords: ['3.6.3', 'armas da persuasão'],
          },
          {
            id: '3.6.4',
            label: 'Subtópico 3.6.4: Fatores adversos',
            temas: ['Fatores adversos à comunicação eficiente'],
            keywords: ['3.6.4', 'fatores adversos'],
          },
          {
            id: '3.6.5',
            label: 'Subtópico 3.6.5: Coleta dos dados',
            temas: ['Coleta dos dados de interesse'],
            keywords: ['3.6.5', 'coleta dos dados'],
          },
          {
            id: '3.6.6',
            label: 'Subtópico 3.6.6: Atividades de obtenção de dados',
            temas: [
              '3.6.6.1 Técnica de entrevista (tipos, fases, formalização)',
              '3.6.6.2 Técnica do interrogatório',
              '3.6.6.3 Pessoas detentoras de dados (Testemunha)',
            ],
            keywords: [
              '3.6.6',
              'atividades de obtenção',
              'técnica de entrevista',
              'técnica do interrogatório',
              'testemunha',
            ],
          },
        ],
        temas: [],
        keywords: ['3.6', 'fontes humanas', 'dados de fontes humanas'],
      },
      {
        id: '5.5.6',
        label: 'Capítulo 5.5.6: Infiltração policial',
        shortLabel: 'Capítulo 5.5.6',
        subtopicos: [
          {
            id: '5.5.6.0',
            label: 'Subtópico: Gerenciamento de comunicações e direitos',
            temas: ['Art. 14 da Lei 12.850/2013, plano operacional e direitos do agente infiltrado'],
            keywords: [
              'gerenciamento de comunicações',
              'art. 14 da lei 12.850/2013',
              'lei 12.850',
              'direitos do agente infiltrado',
            ],
          },
          {
            id: '5.5.6.1',
            label: 'Subtópico 5.5.6.1: Infiltração em ambiente virtual',
            temas: ['Infiltração virtual (art. 10-A da Lei 12.850/2013 e ECA art. 190-A)'],
            keywords: [
              '5.5.6.1',
              'ambiente virtual',
              'infiltração virtual',
              'infiltração em ambiente virtual',
              'art. 10-a',
              '190-a',
            ],
          },
          {
            id: '5.5.6.2',
            label: 'Subtópico 5.5.6.2: Limites e distinções',
            temas: ['Limites, excludente de culpabilidade e vedação ao agente provocador'],
            keywords: [
              '5.5.6.2',
              'limites e distinções',
              'agente provocador',
              'excludente de culpabilidade',
            ],
          },
        ],
        temas: [],
        keywords: ['5.5.6', 'infiltração policial', 'agente infiltrado'],
      },
    ],
  },
];

/**
 * Função inteligente para mapear qualquer questão existente para a árvore oficial de 5 níveis:
 * Matéria > Módulo > Capítulo > Subtópico > Tema
 */
export function mapQuestionToOfficialHierarchy(q: {
  materia?: string;
  modulo?: string;
  capitulo?: string;
  subtopico?: string;
  tema?: string;
  tema_subtopico?: string;
  enunciado?: string;
  gabarito_comentado?: string;
}): Official5LevelHierarchy {
  const materia = OFFICIAL_MATERIA;

  // Unifica textos para busca de correspondência
  const candidateText = `
    ${q.subtopico || ''} 
    ${q.capitulo || ''} 
    ${q.tema || ''} 
    ${q.tema_subtopico || ''} 
    ${q.modulo || ''} 
    ${q.enunciado || ''} 
    ${q.gabarito_comentado || ''}
  `.toLowerCase();

  // 1. Tentar casar por Subtópico específico (nível mais específico: 5.5.6.1, 4.6.1, 3.1.2...)
  for (const mod of OFFICIAL_HIERARCHY_TREE) {
    if (!mod.capitulos) continue;
    for (const cap of mod.capitulos) {
      if (!cap.subtopicos) continue;
      for (const sub of cap.subtopicos) {
        // Verificar correspondência por ID numérico do subtópico (ex: "4.6.1")
        const idRegex = new RegExp(`(?:^|[^0-9.])${sub.id.replace(/\./g, '\\.')}(?:[^0-9.]|$)`, 'i');
        const matchesId = idRegex.test(`${q.subtopico || ''} ${q.capitulo || ''} ${q.tema || ''} ${q.tema_subtopico || ''}`);

        // Verificar correspondência por palavras-chave exclusivas do subtópico
        const matchesKeywords = sub.keywords?.some((kw) => {
          if (kw.length <= 4) {
            // Códigos curtos como 3.1.1
            return new RegExp(`\\b${kw.replace(/\./g, '\\.')}\\b`, 'i').test(
              `${q.subtopico || ''} ${q.capitulo || ''} ${q.tema || ''} ${q.tema_subtopico || ''}`
            );
          }
          return candidateText.includes(kw.toLowerCase());
        });

        if (matchesId || matchesKeywords) {
          // Determina o tema mais adequado
          let tema = q.tema?.trim() || q.tema_subtopico?.trim() || '';
          if (sub.temas && sub.temas.length > 0) {
            const matchedTema = sub.temas.find((t) =>
              candidateText.includes(t.toLowerCase().slice(0, 15))
            );
            tema = matchedTema || tema || sub.temas[0];
          }

          return {
            materia,
            modulo: mod.id,
            capitulo: cap.label,
            subtopico: sub.label,
            tema: tema || sub.label,
          };
        }
      }
    }
  }

  // 2. Tentar casar por Capítulo específico (ex: 2.1, 2.2, 4.1, 3.1...)
  for (const mod of OFFICIAL_HIERARCHY_TREE) {
    if (!mod.capitulos) continue;
    for (const cap of mod.capitulos) {
      const capIdRegex = new RegExp(`(?:^|[^0-9.])${cap.id.replace(/\./g, '\\.')}(?:[^0-9.]|$)`, 'i');
      const matchesCapId = capIdRegex.test(`${q.capitulo || ''} ${q.subtopico || ''} ${q.modulo || ''}`);

      const matchesCapKw = cap.keywords?.some((kw) => {
        if (kw.length <= 4) {
          return new RegExp(`\\b${kw.replace(/\./g, '\\.')}\\b`, 'i').test(
            `${q.capitulo || ''} ${q.subtopico || ''}`
          );
        }
        return candidateText.includes(kw.toLowerCase());
      });

      if (matchesCapId || matchesCapKw) {
        // Encontrar subtópico caso exista no capítulo
        let subtopico = '';
        if (cap.subtopicos && cap.subtopicos.length > 0) {
          subtopico = cap.subtopicos[0].label;
        }

        // Determina tema
        let tema = q.tema?.trim() || q.tema_subtopico?.trim() || '';
        if (cap.temas && cap.temas.length > 0) {
          const matchedTema = cap.temas.find((t) =>
            candidateText.includes(t.toLowerCase().slice(0, 15))
          );
          tema = matchedTema || tema || cap.temas[0];
        }

        return {
          materia,
          modulo: mod.id,
          capitulo: cap.label,
          subtopico: subtopico || (q.subtopico?.trim() ?? ''),
          tema: tema || (subtopico || cap.label),
        };
      }
    }
  }

  // 3. Tentar casar por Módulo (I, II, V, VI, VII, VIII, IX)
  for (const mod of OFFICIAL_HIERARCHY_TREE) {
    const normMod = mod.id.toLowerCase();
    const candidateMod = (q.modulo || '').toLowerCase();

    if (candidateMod.includes(normMod) || candidateText.includes(normMod)) {
      const cap = mod.capitulos?.[0];
      const sub = cap?.subtopicos?.[0];
      return {
        materia,
        modulo: mod.id,
        capitulo: cap ? cap.label : (q.capitulo?.trim() ?? ''),
        subtopico: sub ? sub.label : (q.subtopico?.trim() ?? ''),
        tema: q.tema?.trim() || q.tema_subtopico?.trim() || (sub ? sub.label : (cap?.label ?? '')),
      };
    }
  }

  // 4. Fallback padrão: Matéria oficial, preservando os campos da questão normalizados
  return {
    materia,
    modulo: q.modulo?.trim() || 'Módulo I',
    capitulo: q.capitulo?.trim() || 'Capítulo 2.1: Critérios para a seleção de técnicas investigativas',
    subtopico: q.subtopico?.trim() || '',
    tema: q.tema?.trim() || q.tema_subtopico?.trim() || '',
  };
}
