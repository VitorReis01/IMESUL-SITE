// Validação PURA de CNPJ (sem I/O, sem consulta externa) - NUNCA consulta a Receita Federal ou
// qualquer API de terceiros, NUNCA inventa razão social a partir do número (ver relatório desta
// fase). Só confirma que o número é matematicamente um CNPJ válido (dígitos verificadores) -
// nada além disso.
export const normalizeCnpj = (rawValue) => String(rawValue ?? "").replace(/\D/g, "");

const firstWeights = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const secondWeights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

const computeCheckDigit = (digits, weights) => {
  const sum = weights.reduce((total, weight, index) => total + weight * Number(digits[index]), 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
};

// Sequências como "00000000000000"/"11111111111111" passam na conta de dígito verificador
// (matematicamente "válidas") mas nunca são um CNPJ real - sempre rejeitadas.
const isRepeatedDigitSequence = (digits) => /^(\d)\1{13}$/.test(digits);

// Devolve {ok:true, cnpj: "somente 14 dígitos"} ou {ok:false, reason}. Aceita entrada formatada
// ("12.345.678/0001-95") ou só dígitos - sempre normaliza antes de validar.
export const validateCnpj = (rawValue) => {
  const digits = normalizeCnpj(rawValue);

  if (!digits) return { ok: false, reason: "CNPJ vazio." };
  if (digits.length !== 14) return { ok: false, reason: "CNPJ precisa ter 14 dígitos." };
  if (isRepeatedDigitSequence(digits)) return { ok: false, reason: "CNPJ inválido (sequência repetida)." };

  const expectedFirst = computeCheckDigit(digits, firstWeights);
  if (expectedFirst !== Number(digits[12])) return { ok: false, reason: "CNPJ inválido (dígito verificador)." };

  const expectedSecond = computeCheckDigit(digits, secondWeights);
  if (expectedSecond !== Number(digits[13])) return { ok: false, reason: "CNPJ inválido (dígito verificador)." };

  return { ok: true, cnpj: digits };
};

// Só para exibição no painel - nunca usado para armazenar (o banco sempre guarda normalizado).
export const formatCnpj = (digits) => {
  const normalized = normalizeCnpj(digits);
  if (normalized.length !== 14) return digits ?? "";
  return `${normalized.slice(0, 2)}.${normalized.slice(2, 5)}.${normalized.slice(5, 8)}/${normalized.slice(8, 12)}-${normalized.slice(12, 14)}`;
};
