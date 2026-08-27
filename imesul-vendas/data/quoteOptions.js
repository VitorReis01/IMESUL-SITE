// Estados e cidades alimentam os selects obrigatorios de localidade.
import { ALL_MS_COMMERCIAL_CITIES } from "../lib/commercialRegions";

export const brazilianStates = [
  { value: "AC", label: "Acre" },
  { value: "AL", label: "Alagoas" },
  { value: "AP", label: "Amapá" },
  { value: "AM", label: "Amazonas" },
  { value: "BA", label: "Bahia" },
  { value: "CE", label: "Ceará" },
  { value: "DF", label: "Distrito Federal" },
  { value: "ES", label: "Espírito Santo" },
  { value: "GO", label: "Goiás" },
  { value: "MA", label: "Maranhão" },
  { value: "MT", label: "Mato Grosso" },
  { value: "MS", label: "Mato Grosso do Sul" },
  { value: "MG", label: "Minas Gerais" },
  { value: "PA", label: "Pará" },
  { value: "PB", label: "Paraíba" },
  { value: "PR", label: "Paraná" },
  { value: "PE", label: "Pernambuco" },
  { value: "PI", label: "Piauí" },
  { value: "RJ", label: "Rio de Janeiro" },
  { value: "RN", label: "Rio Grande do Norte" },
  { value: "RS", label: "Rio Grande do Sul" },
  { value: "RO", label: "Rondônia" },
  { value: "RR", label: "Roraima" },
  { value: "SC", label: "Santa Catarina" },
  { value: "SP", label: "São Paulo" },
  { value: "SE", label: "Sergipe" },
  { value: "TO", label: "Tocantins" },
];

// Cidades por estado mantem o formulario coerente sem tentar cobrir todo o Brasil nesta etapa.
export const citiesByState = {
  AC: ["Rio Branco", "Cruzeiro do Sul", "Outra"],
  AL: ["Maceió", "Arapiraca", "Outra"],
  AP: ["Macapá", "Santana", "Outra"],
  AM: ["Manaus", "Parintins", "Outra"],
  BA: ["Salvador", "Feira de Santana", "Outra"],
  CE: ["Fortaleza", "Juazeiro do Norte", "Outra"],
  DF: ["Brasília", "Outra"],
  ES: ["Vitória", "Vila Velha", "Serra", "Outra"],
  GO: ["Goiânia", "Anápolis", "Rio Verde", "Outra"],
  MA: ["São Luís", "Imperatriz", "Outra"],
  MT: ["Cuiabá", "Rondonópolis", "Sinop", "Outra"],
  // Fonte unica: lib/commercialRegions.js (municipios das regioes comerciais de Campo Grande e
  // Dourados - nunca manter uma segunda lista de cidades de MS aqui). "Outra" continua sendo so
  // deste seletor - nao e um municipio, entao nao entra na lista central.
  MS: [...ALL_MS_COMMERCIAL_CITIES, "Outra"],
  MG: ["Belo Horizonte", "Uberlândia", "Contagem", "Outra"],
  PA: ["Belém", "Ananindeua", "Santarém", "Outra"],
  PB: ["João Pessoa", "Campina Grande", "Outra"],
  PR: ["Curitiba", "Londrina", "Maringá", "Outra"],
  PE: ["Recife", "Jaboatão dos Guararapes", "Caruaru", "Outra"],
  PI: ["Teresina", "Parnaíba", "Outra"],
  RJ: ["Rio de Janeiro", "Niterói", "Duque de Caxias", "Outra"],
  RN: ["Natal", "Mossoró", "Outra"],
  RS: ["Porto Alegre", "Caxias do Sul", "Pelotas", "Outra"],
  RO: ["Porto Velho", "Ji-Paraná", "Outra"],
  RR: ["Boa Vista", "Outra"],
  SC: ["Florianópolis", "Joinville", "Blumenau", "Outra"],
  SP: ["São Paulo", "Campinas", "São José dos Campos", "Outra"],
  SE: ["Aracaju", "Nossa Senhora do Socorro", "Outra"],
  TO: ["Palmas", "Araguaína", "Outra"],
};

export const msCities = citiesByState.MS;

// Faixas evitam uma falsa precisao antes da confirmacao comercial.
export const quantityOptions = [
  "1 unidade",
  "2 unidades",
  "3 unidades",
  "5 unidades",
  "10 unidades",
  "20 unidades",
  "50 unidades",
  "100 unidades",
  "Outro",
];

// Comprimentos pre-definidos para telas vendidas por metro (incrementos de 0,5 m).
export const telaComprimentoOptions = ["0,5 m", "1 m", "1,5 m", "2 m", "2,5 m", "5 m"];

// Opcoes qualitativas usadas somente no caminho por projeto.
export const projectSizeOptions = [
  "Pequeno",
  "Médio",
  "Grande",
  "A definir com vendedor",
];

// Indica o momento da compra sem prometer prazo de entrega.
export const projectUrgencyOptions = [
  "Compra imediata",
  "Nesta semana",
  "Este mês",
  "Apenas pesquisando opções",
];
