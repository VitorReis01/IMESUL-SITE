// Fonte unica de verdade da regra territorial (cidade -> regiao comercial). NUNCA duplicar estas
// duas listas em outro arquivo - data/quoteOptions.js deriva o seletor de cidade de MS a partir
// daqui (ALL_MS_COMMERCIAL_CITIES), em vez de manter uma lista propria.
//
// Escopo: SOMENTE municipios oficiais de Mato Grosso do Sul (instrucao explicita do usuario -
// "a regra territorial vale somente para municipios de MS"). Cidades de outros estados nunca
// resolvem para uma regiao aqui - getCommercialRegionByCity devolve null e quem chamou decide o
// fallback (ver lib/leadWhatsApp.js, que cai no comportamento generico ja existente).
//
// As duas listas abaixo sao EXATAMENTE as fornecidas pelo usuario (municipios oficiais das
// microrregioes comerciais de Campo Grande e de Dourados) - nao adicionar distritos/localidades
// nem completar com outros municipios de MS que nao foram confirmados.
//
// CAMPO_GRANDE_CITIES: consolidada em 2026-08-27 a partir dos 3 documentos DETALHADOS de
// microrregiao (Costa Rica, Alcinopolis, Sonora), cada um listando seus proprios municipios com
// sobreposicao entre eles (ex.: Jaraguari/Bandeirantes aparecem nas 3; Costa Rica/Chapadao do
// Sul/Camapua/Figueirao aparecem em 2). Apos remover duplicatas, normalizar nome-oficial x
// abreviacao usada num dos documentos ("Paraiso" -> "Paraiso das Aguas", ja listado por outro
// documento; "Rio Verde" -> "Rio Verde de Mato Grosso", idem) e excluir localidades nao-oficiais
// (Garcias/Morangas/Baus, ver nota abaixo), o resultado bate exatamente com a lista ja usada nesta
// fase - nenhum municipio foi adicionado ou removido, so revalidado contra a fonte bruta. 22
// municipios, Campo Grande incluso.
//
// Os documentos tambem citam "Garcias", "Morangas" e "Baus" - NAO sao municipios oficiais de MS
// (sao localidades/distritos dentro de municipios ja listados), entao nao entram como entradas
// independentes no dropdown nem no resolver, por instrucao explicita do usuario. O sistema HOJE
// nao tem um mecanismo de alias/localidade->municipio (getCommercialRegionByCity so compara o
// nome normalizado contra as duas listas abaixo, sem nivel de distrito) - se essas localidades
// precisarem ser reconhecidas no futuro (ex.: cliente digita "Garcias" e o sistema resolve para o
// municipio-mae), isso exigiria um mapa de alias novo (localidade -> municipio oficial) alimentando
// getCommercialRegionByCity ANTES da normalizacao, sem mudar a assinatura publica da funcao.
//
// Observacoes comerciais recebidas junto com a lista (valor minimo de pedido por localidade -
// Aparecida do Taboado acima de R$15mil, Brasilandia acima de R$5mil, Pedro Gomes/Garcias/
// Morangas acima de R$3mil): NAO implementadas - sao dados comerciais que ainda precisam de
// validacao antes de virar regra de sistema (instrucao explicita do usuario). Nenhuma logica de
// valor minimo existe neste arquivo nem em nenhum dos fluxos de orcamento.
import { COMMERCIAL_UNITS } from "./leadFlow";

export const CAMPO_GRANDE_CITIES = [
  "Campo Grande",
  "Alcinópolis",
  "Aparecida do Taboado",
  "Água Clara",
  "Bandeirantes",
  "Brasilândia",
  "Camapuã",
  "Cassilândia",
  "Chapadão do Sul",
  "Costa Rica",
  "Coxim",
  "Figueirão",
  "Inocência",
  "Jaraguari",
  "Paraíso das Águas",
  "Pedro Gomes",
  "Ribas do Rio Pardo",
  "Rio Verde de Mato Grosso",
  "São Gabriel do Oeste",
  "Selvíria",
  "Sonora",
  "Três Lagoas",
];

export const DOURADOS_CITIES = [
  "Dourados",
  "Amambai",
  "Anaurilândia",
  "Anastácio",
  "Angélica",
  "Antônio João",
  "Aquidauana",
  "Bataguassu",
  "Batayporã",
  "Bela Vista",
  "Bodoquena",
  "Bonito",
  "Caarapó",
  "Caracol",
  "Corumbá",
  "Deodápolis",
  "Eldorado",
  "Fátima do Sul",
  "Glória de Dourados",
  "Guia Lopes da Laguna",
  "Iguatemi",
  "Itaquiraí",
  "Ivinhema",
  "Jardim",
  "Juti",
  "Ladário",
  "Laguna Carapã",
  "Maracaju",
  "Miranda",
  "Mundo Novo",
  "Naviraí",
  "Nioaque",
  "Nova Alvorada do Sul",
  "Nova Andradina",
  "Ponta Porã",
  "Rio Brilhante",
  "Tacuru",
  "Vicentina",
];

// Normaliza acentos/caixa/espacos para comparacao - o nome OFICIAL (com acento) continua sendo o
// unico exibido na tela; esta normalizacao e so para decidir a regiao, nunca para trocar o texto
// mostrado ao cliente. U+0300-U+036F cobre os diacriticos combinantes que sobram depois do
// normalize("NFD") (ex.: "á" vira "a" + acento combinante, removido pela regex) - usa RegExp com
// escape hex em vez de um literal no código-fonte, pra não depender da codificação do arquivo.
const combiningDiacriticalMarks = new RegExp("[\\u0300-\\u036f]", "g");

const normalizeCityName = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(combiningDiacriticalMarks, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

const regionByNormalizedCity = new Map([
  ...CAMPO_GRANDE_CITIES.map((city) => [normalizeCityName(city), COMMERCIAL_UNITS.CAMPO_GRANDE]),
  ...DOURADOS_CITIES.map((city) => [normalizeCityName(city), COMMERCIAL_UNITS.DOURADOS]),
]);

// cidade -> "campo-grande" | "dourados" | null. null significa "fora das duas listas" (inclui
// qualquer cidade de outro estado) - quem chamou decide o que fazer (nunca assume uma regiao
// default aqui).
export const getCommercialRegionByCity = (city) => regionByNormalizedCity.get(normalizeCityName(city)) || null;

// Uniao ordenada das duas regioes (60 municipios) - fonte unica do seletor de cidade de MS usado
// nos formularios de orcamento (ver data/quoteOptions.js). "Outra" continua sendo adicionado la,
// nao aqui, porque nao e um municipio.
export const ALL_MS_COMMERCIAL_CITIES = [...CAMPO_GRANDE_CITIES, ...DOURADOS_CITIES].sort((a, b) =>
  a.localeCompare(b, "pt-BR")
);
