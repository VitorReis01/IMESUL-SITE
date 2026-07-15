// Tabelas tecnicas extraidas do catalogo PDF.
// ProductOptionSelector usa estes dados para montar medidas e pesos validos.
// Remove repeticoes sem descartar zero, que pode ser um valor tecnico valido.
const unique = (values) => [...new Set(values.filter((value) => value !== undefined && value !== null))];

// Deriva listas de selecao a partir das variacoes extraidas do PDF.
const buildSpecs = (
  rows,
  {
    comprimentos = [],
    unidadeMedida = "mm",
    paginaFonte,
    dadosCompletos = true,
    observacao = "",
    observacoesTecnicas = [],
  } = {}
) => ({
  medidas: unique(rows.map((row) => row.medida)),
  espessuras: unique(rows.map((row) => row.espessura)),
  comprimentos: unique([
    ...comprimentos,
    ...rows.map((row) => row.comprimento),
  ]),
  variacoes: rows,
  unidadeMedida,
  paginaFonte,
  dadosCompletos,
  observacao,
  observacoesTecnicas,
});

// Converte linhas compactas em objetos usados pelo seletor e pelo resumo.
const weightedRows = (rows, pesoUnidade) =>
  rows.map(([medida, espessura, peso, comprimento]) => ({
    medida,
    ...(espessura !== null && espessura !== undefined ? { espessura } : {}),
    ...(comprimento !== null && comprimento !== undefined ? { comprimento } : {}),
    peso,
    pesoUnidade,
  }));

// Marca produtos sem leitura confiavel para manter o preenchimento livre.
const incompleteSpecs = (paginaFonte, observacao) => ({
  medidas: [],
  espessuras: [],
  comprimentos: [],
  variacoes: [],
  paginaFonte,
  dadosCompletos: false,
  observacao,
  observacoesTecnicas: [],
});

// Fonte unica de medidas, espessuras, comprimentos e pesos publicados no fluxo.
// Nao adicione valores que nao estejam confirmados no catalogo oficial.
export const catalogSpecifications = {
  tubosMetalicos: {
    retangular: buildSpecs(
      weightedRows(
        [
          ["16x30", 1.2, 4.6],
          ["20x30", 0.75, 3.53], ["20x30", 0.9, 4.2], ["20x30", 1.2, 5.54],
          ["20x40", 0.75, 4.25], ["20x40", 0.9, 5.04], ["20x40", 1.2, 6.73],
          ["20x50", 0.75, 4.97], ["20x50", 0.9, 5.9], ["20x50", 1.2, 7.86],
          ["30x40", 0.75, 4.97], ["30x40", 0.9, 5.89], ["30x40", 1.2, 7.86],
          ["30x50", 0.75, 5.69], ["30x50", 0.9, 6.86], ["30x50", 1.2, 9], ["30x50", 1.5, 10.94],
          ["30x70", 1.2, 11.2],
          ["40x60", 1.2, 11.2], ["40x60", 1.5, 14.8], ["40x60", 2, 18.6],
          ["40x80", 1.2, 13.6], ["40x80", 1.5, 16.89], ["40x80", 2, 23.1],
          ["40x100", 1.5, 19.4], ["40x100", 2, 25.72],
          ["150x50", 1.5, 28.15],
        ],
        "kg/barra"
      ),
      { paginaFonte: 3, observacao: "O catálogo informa peso teórico por barra, mas não declara o comprimento da barra nesta página." }
    ),
    quadrado: buildSpecs(
      weightedRows(
        [
          ["15x15", 0.9, 2.54], ["15x15", 1.2, 3.36],
          ["18x18", 0.9, 2.84],
          ["20x20", 0.75, 2.81], ["20x20", 0.9, 3.34], ["20x20", 1.2, 4.4],
          ["25x25", 0.75, 3.53], ["25x25", 0.9, 4.2], ["25x25", 1.2, 5.54],
          ["30x30", 0.75, 4.25], ["30x30", 0.9, 5.04], ["30x30", 1.2, 6.73],
          ["40x40", 0.75, 5.69], ["40x40", 0.9, 6.83], ["40x40", 1.2, 9.2], ["40x40", 2, 15],
          ["50x50", 1.2, 11.2], ["50x50", 1.5, 13.77], ["50x50", 2, 19.11],
          ["60x60", 1.2, 13.32], ["60x60", 1.5, 16.58], ["60x60", 2, 21.96],
          ["80x80", 1.5, 22.22], ["80x80", 2, 29.48],
          ["100x100", 2, 27.54], ["100x100", 2.65, 38.22],
        ],
        "kg/barra"
      ),
      { paginaFonte: 3, observacao: "O catálogo informa peso teórico por barra, mas não declara o comprimento da barra nesta página." }
    ),
    redondo: buildSpecs(
      weightedRows(
        [
          ['5/8"', 0.9, 2.07], ['5/8"', 1.2, 2.74],
          ['3/4"', 0.75, 2.05], ['3/4"', 0.9, 2.52], ['3/4"', 1.2, 3.3],
          ['7/8"', 0.75, 2.1], ['7/8"', 0.9, 2.92], ['7/8"', 1.2, 3.84],
          ['1"', 0.75, 2.81], ['1"', 0.9, 3.35], ['1"', 1.2, 4.4], ['1"', 1.5, 5.5], ['1"', 2, 7],
          ['1.1/4"', 0.75, 3.53], ['1.1/4"', 0.9, 4.2], ['1.1/4"', 1.2, 5.54], ['1.1/4"', 1.5, 6.8], ['1.1/4"', 2, 9.1],
          ['1.1/2"', 0.75, 4.25], ['1.1/2"', 0.9, 5.04], ['1.1/2"', 1.2, 6.73], ['1.1/2"', 1.5, 9], ['1.1/2"', 2, 11.29],
          ['1.3/4"', 0.75, 4.97], ['1.3/4"', 0.9, 5.89], ['1.3/4"', 1.2, 7.86],
          ['2"', 0.75, 5.69], ['2"', 0.9, 6.82], ['2"', 1.2, 9], ['2"', 1.5, 11.23], ['2"', 2, 14.88],
          ['2.1/2"', 1.2, 11], ['2.1/2"', 1.5, 14.8], ['2.1/2"', 2, 19],
          ['3"', 1.2, 13.9], ['3"', 1.5, 17.5], ['3"', 2, 22],
          ['4"', 1.5, 23.5], ['4"', 2, 31],
        ],
        "kg/barra"
      ),
      { paginaFonte: 4, unidadeMedida: "polegadas", observacao: "O catálogo informa peso teórico por barra, mas não declara o comprimento da barra nesta página." }
    ),
  },

  perfisEstruturais: {
    uEnrijecido: buildSpecs(
      weightedRows(
        [
          ["50x25x13", 2, 10.89], ["50x25x13", 2.25, 12], ["50x25x13", 2.65, 13.52],
          ["75x40x13", 2, 15.84], ["75x40x13", 2.25, 17.6], ["75x40x13", 2.65, 20.32], ["75x40x13", 3, 22.6],
          ["100x40x13", 2, 18.24], ["100x40x13", 2.25, 20.3], ["100x40x13", 2.65, 23.9], ["100x40x13", 3, 26.2],
          ["127x50x13", 2, 22.02], ["127x50x13", 2.25, 26.1], ["127x50x13", 2.65, 30.06], ["127x50x13", 3, 33.96],
          ["150x75x20", 2, 32], ["150x75x20", 2.25, 36], ["150x75x20", 2.65, 41.13], ["150x75x20", 3, 46.45],
          ["200x60x20", 2, 33.88], ["200x75x20", 2, 40.23],
        ],
        "kg/barra"
      ),
      { paginaFonte: 5, observacao: "Peso teórico por barra; comprimento não declarado na página." }
    ),
    uSimples: buildSpecs(
      weightedRows(
        [
          ["50x25", 2, 8.83], ["50x25", 2.25, 9.9], ["50x25", 2.65, 11.4], ["50x25", 3, 12.7],
          ["70x25", 2, 11.09], ["70x25", 2.25, 12.32], ["70x25", 2.65, 14.12],
          ["75x38", 2, 13.74], ["75x38", 2.25, 15.36], ["75x38", 2.65, 17.2], ["75x38", 3, 20],
          ["95x25", 2, 13.57], ["95x25", 2.25, 15.1], ["95x25", 2.65, 17.34],
          ["100x38", 2, 16.15], ["100x38", 2.25, 18.35], ["100x38", 2.65, 21], ["100x38", 3, 23.7],
          ["127x50", 2, 21.87], ["127x50", 2.25, 24.2], ["127x50", 2.65, 27.92], ["127x50", 3, 31.6],
        ],
        "kg/barra"
      ),
      { paginaFonte: 5, observacao: "Peso teórico por barra; comprimento não declarado na página." }
    ),
  },

  telhasMetalicas: {
    material: "Aço galvalume",
    trapezoidal40: buildSpecs(
      weightedRows([["1080 mm", 0.43, 4.13], ["1080 mm", 0.5, 4.8]], "kg/m"),
      { paginaFonte: 6, observacoesTecnicas: ["Passo 200 mm", "Mesa 35 mm", "Altura 30 mm"] }
    ),
    trapezoidal25: buildSpecs(
      weightedRows([["1080 mm", 0.43, 4.13], ["1080 mm", 0.5, 4.8]], "kg/m"),
      { paginaFonte: 6, observacoesTecnicas: ["Passo 180 mm", "Mesa 22 mm", "Altura 25 mm"] }
    ),
    ondulada: buildSpecs(
      weightedRows([["1100 mm", 0.43, 4.13], ["1100 mm", 0.5, 4.8]], "kg/m"),
      { paginaFonte: 6, observacoesTecnicas: ["Passo 75 mm", "Altura 15 mm"] }
    ),
    cumeeiras: incompleteSpecs(6, "O catálogo apresenta os modelos de cumeeira sem tabela de medidas ou pesos."),
  },

  laminados: {
    cantoneirasAbasIguais: buildSpecs(
      weightedRows(
        [
          ['1/2"', '1/8"', 0.55], ['5/8"', '1/8"', 0.71], ['3/4"', '1/8"', 0.87], ['7/8"', '1/8"', 1.03], ['1"', '1/8"', 1.19], ['1.1/4"', '1/8"', 1.5], ['1.1/2"', '1/8"', 1.83], ['1.3/4"', '1/8"', 2.14], ['2"', '1/8"', 2.46],
          ['1"', '3/16"', 1.73], ['1.1/4"', '3/16"', 2.2], ['1.1/2"', '3/16"', 2.68], ['1.3/4"', '3/16"', 3.15], ['2"', '3/16"', 3.63], ['2.1/2"', '3/16"', 4.57], ['3"', '3/16"', 5.52],
          ['1"', '1/4"', 2.2], ['1.1/4"', '1/4"', 2.86], ['1.1/2"', '1/4"', 3.48], ['1.3/4"', '1/4"', 4.12], ['2"', '1/4"', 4.75], ['2.1/2"', '1/4"', 6.1], ['3"', '1/4"', 7.29], ['3.1/2"', '1/4"', 8.63], ['4"', '1/4"', 9.82],
          ['2"', '5/16"', 5.83], ['2.1/2"', '5/16"', 7.44], ['3"', '5/16"', 9.08], ['3.1/2"', '5/16"', 10.7], ['4"', '5/16"', 12.2], ['5"', '5/16"', 15.33],
          ['2"', '3/8"', 6.99], ['2.1/2"', '3/8"', 8.78], ['3"', '3/8"', 10.7], ['3.1/2"', '3/8"', 12.5], ['4"', '3/8"', 14.6], ['5"', '3/8"', 18.3],
        ],
        "kg/m"
      ),
      { paginaFonte: 7, comprimentos: [6000], unidadeMedida: "polegadas", observacao: "A combinação 5 polegadas x 1/4 não foi cadastrada porque o peso está ilegível no PDF." }
    ),
    barrasChatas: buildSpecs(
      weightedRows(
        [
          ['3/8"', '1/8"', 0.24], ['1/2"', '1/8"', 0.32], ['5/8"', '1/8"', 0.4], ['3/4"', '1/8"', 0.48], ['7/8"', '1/8"', 0.55], ['1"', '1/8"', 0.63], ['1.1/4"', '1/8"', 0.79], ['1.1/2"', '1/8"', 0.98], ['2"', '1/8"', 1.29],
          ['1/2"', '3/16"', 0.47], ['5/8"', '3/16"', 0.59], ['3/4"', '3/16"', 0.71], ['7/8"', '3/16"', 0.83], ['1"', '3/16"', 0.95], ['1.1/4"', '3/16"', 1.19], ['1.1/2"', '3/16"', 1.42], ['2"', '3/16"', 1.9],
          ['5/8"', '1/4"', 0.79], ['3/4"', '1/4"', 0.95], ['7/8"', '1/4"', 1.11], ['1"', '1/4"', 1.27], ['1.1/4"', '1/4"', 1.58], ['1.1/2"', '1/4"', 1.9], ['2"', '1/4"', 2.53], ['2.1/2"', '1/4"', 3.17], ['3"', '1/4"', 3.8], ['4"', '1/4"', 5.06],
          ['1.1/4"', '5/16"', 1.98], ['1.1/2"', '5/16"', 2.37], ['2"', '5/16"', 3.17], ['2.1/2"', '5/16"', 3.96], ['3"', '5/16"', 4.75], ['4"', '5/16"', 6.33],
          ['1.1/4"', '3/8"', 2.37], ['1.1/2"', '3/8"', 2.85], ['2"', '3/8"', 3.8], ['2.1/2"', '3/8"', 4.74], ['3"', '3/8"', 5.69], ['4"', '3/8"', 7.59],
        ],
        "kg/m"
      ),
      { paginaFonte: 7, unidadeMedida: "polegadas", observacao: "A última linha repetida como 3/8 no PDF foi omitida por ambiguidade." }
    ),
    barrasQuadradas: buildSpecs(
      weightedRows([
        ['1/4"', null, 0.32], ['5/16"', null, 0.49], ['3/8"', null, 0.71], ['1/2"', null, 1.26], ['5/8"', null, 1.97], ['3/4"', null, 2.84], ['7/8"', null, 3.87], ['1"', null, 5.06], ['1.1/4"', null, 7.91], ['1.1/2"', null, 11.39], ['1.3/4"', null, 15.5], ['2"', null, 20.24],
      ], "kg/m"),
      { paginaFonte: 8, unidadeMedida: "polegadas" }
    ),
    barrasRedondas: buildSpecs(
      weightedRows([
        ['1/4"', null, 0.25], ['5/16"', null, 0.39], ['3/8"', null, 0.59], ['1/2"', null, 0.99], ['5/8"', null, 1.55], ['3/4"', null, 2.24], ['7/8"', null, 3.04], ['1"', null, 3.98], ['1.1/4"', null, 6.22], ['1.1/2"', null, 8.95], ['1.3/4"', null, 12.2], ['2"', null, 15.9], ['2.1/2"', null, 20.1], ['2.1/4"', null, 24.9], ['2.3/4"', null, 30.1], ['3"', null, 35.8], ['3.1/2"', null, 48.68], ['4"', null, 63.58],
      ], "kg/m"),
      { paginaFonte: 8, unidadeMedida: "polegadas" }
    ),
  },

  chapas: {
    planas: {
      generica: incompleteSpecs(9, "Selecione uma família de chapa para acessar espessura e massa específicas."),
      finaFrio: buildSpecs(
        weightedRows([["Chapa fina a frio", 0.45, 3.53], ["Chapa fina a frio", 0.6, 4.71], ["Chapa fina a frio", 0.75, 5.89], ["Chapa fina a frio", 0.85, 6.67], ["Chapa fina a frio", 0.9, 7.06], ["Chapa fina a frio", 1.06, 8.32], ["Chapa fina a frio", 1.2, 9.42], ["Chapa fina a frio", 1.5, 11.78], ["Chapa fina a frio", 1.9, 14.92]], "kg/m²"),
        { paginaFonte: 9 }
      ),
      finaQuente: buildSpecs(
        weightedRows([["Chapa fina a quente", 1.2, 9.42], ["Chapa fina a quente", 1.5, 11.78], ["Chapa fina a quente", 1.9, 14.92], ["Chapa fina a quente", 2, 15.7], ["Chapa fina a quente", 2.25, 17.66], ["Chapa fina a quente", 2.65, 20.8], ["Chapa fina a quente", 3, 23.55], ["Chapa fina a quente", 3.35, 26.3], ["Chapa fina a quente", 3.75, 29.44], ["Chapa fina a quente", 4, 31.4], ["Chapa fina a quente", 4.25, 33.36], ["Chapa fina a quente", 4.5, 35.32], ["Chapa fina a quente", 4.75, 37.26]], "kg/m²"),
        { paginaFonte: 9 }
      ),
      grossa: buildSpecs(
        weightedRows([["Chapa grossa", 6.3, 49.46], ["Chapa grossa", 8, 62.8], ["Chapa grossa", 9.5, 74.58], ["Chapa grossa", 12.5, 98.13], ["Chapa grossa", 16, 125.6], ["Chapa grossa", 19, 149.15], ["Chapa grossa", 22.4, 175.84], ["Chapa grossa", 25.4, 196.25]], "kg/m²"),
        { paginaFonte: 9 }
      ),
      piso: buildSpecs(
        weightedRows([["Chapa de piso", 3, 24], ["Chapa de piso", 4.75, 38], ["Chapa de piso", 3.3, 49.39], ["Chapa de piso", 8, 62.72], ["Chapa de piso", 9.5, 74.48], ["Chapa de piso", 2.65, 80.14], ["Chapa de piso", 2, 56.52]], "kg/m²"),
        { paginaFonte: 9, observacao: "Algumas equivalências pol/MSG x mm da tabela parecem inconsistentes; os valores foram mantidos como impressos e devem ser confirmados comercialmente." }
      ),
    },
    frisadasELambris: {
      frisadaU: buildSpecs(
        weightedRows([["1095 mm", 'chapa #22', 13, 1800], ["1095 mm", 'chapa #22', 14, 2000], ["1095 mm", 'chapa #22', 15.7, 2200], ["1095 mm", 'chapa #22', 17.9, 2500]], "kg/peça"),
        { paginaFonte: 10 }
      ),
      meiaCana1090: buildSpecs(
        weightedRows([["1090 mm", 'chapa #20', 14.4, 1800], ["1090 mm", 'chapa #20', 15.8, 2000], ["1090 mm", 'chapa #20', 17.7, 2200], ["1090 mm", 'chapa #20', 20.11, 2500], ["1090 mm", 'chapa #20', 24.14, 3000]], "kg/peça"),
        { paginaFonte: 10 }
      ),
      meiaCana545: buildSpecs(
        weightedRows([["545 mm", 'chapa #20', 8.7, 2000], ["545 mm", 'chapa #20', 9.6, 2200], ["545 mm", 'chapa #20', 10.81, 2500], ["545 mm", 'chapa #20', 13.08, 3000]], "kg/peça"),
        { paginaFonte: 10 }
      ),
      lambris: incompleteSpecs(10, "O catálogo agrupa lambris nesta seção, mas não apresenta uma tabela técnica individual legível."),
    },
  },

  perfisSerralheria: {
    portoesElevacao: incompleteSpecs(11, "A página apresenta aplicações visuais, sem tabela técnica."),
    portasAco: incompleteSpecs(11, "A página apresenta aplicações visuais, sem tabela técnica."),
    janelasAco: incompleteSpecs(11, "A página apresenta aplicações visuais, sem tabela técnica."),
  },

  acessorios: incompleteSpecs(12, "Os acessórios são identificados visualmente, sem medidas ou pesos no catálogo."),
  tintasSolventes: incompleteSpecs(12, "Tintas e thinners aparecem visualmente, sem especificações técnicas completas no catálogo."),
};

// Conta variacoes tecnicas sem somar o mesmo objeto mais de uma vez.
export function countCatalogVariations() {
  const visited = new Set();
  let count = 0;

  // Percorre a arvore porque as familias possuem niveis diferentes de agrupamento.
  const walk = (value) => {
    if (!value || typeof value !== "object" || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value.variacoes)) count += value.variacoes.length;
    Object.values(value).forEach(walk);
  };

  walk(catalogSpecifications);
  return count;
}
