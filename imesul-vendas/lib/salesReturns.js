// Cálculo financeiro PURO de devoluções (sem I/O) - sale_amount (bruto) NUNCA é sobrescrito por
// uma devolução (ver relatório desta fase, "valor original é imutável"). O valor líquido é
// sempre CALCULADO a partir de sale_amount - SUM(sales_returns.amount), nunca um segundo campo
// sincronizado manualmente.
export const FINANCIAL_STATUS = {
  NO_RETURN: "NO_RETURN",
  PARTIAL_RETURN: "PARTIAL_RETURN",
  FULL_RETURN: "FULL_RETURN",
};

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

// Nunca negativo - grossSale/returnsTotal já vêm validados (returnsTotal <= grossSale é
// garantido no momento de CADA devolução ser registrada, ver validateNewReturnAmount), mas o
// clamp aqui é uma segunda camada de segurança para nunca exibir um líquido negativo por causa
// de um dado inconsistente vindo de fora desta função.
export const computeNetSale = ({ grossSale, returnsTotal }) => {
  const gross = Number(grossSale) || 0;
  const returns = Number(returnsTotal) || 0;
  return Math.max(round2(gross - returns), 0);
};

export const computeFinancialStatus = ({ grossSale, returnsTotal }) => {
  const gross = Number(grossSale) || 0;
  const returns = Number(returnsTotal) || 0;

  if (returns <= 0) return FINANCIAL_STATUS.NO_RETURN;
  if (returns >= gross) return FINANCIAL_STATUS.FULL_RETURN;
  return FINANCIAL_STATUS.PARTIAL_RETURN;
};

// Resumo financeiro completo de um lead vendido - usado tanto pelo painel quanto pelo IMEbot
// (resumo mostrado antes de pedir confirmação de uma nova devolução).
export const buildReturnsSummary = ({ grossSale, existingReturnsTotal }) => ({
  grossSale: round2(grossSale),
  returnsTotal: round2(existingReturnsTotal),
  netSale: computeNetSale({ grossSale, returnsTotal: existingReturnsTotal }),
  financialStatus: computeFinancialStatus({ grossSale, returnsTotal: existingReturnsTotal }),
});

// Validação ANTES de registrar uma nova devolução - nunca deixa o total devolvido ultrapassar a
// venda original. Mesma regra usada no backend (dentro da transação com FOR UPDATE) e aqui,
// pura, para poder ser testada sem banco.
export const validateNewReturnAmount = ({ amount, grossSale, existingReturnsTotal }) => {
  const value = Number(amount);

  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, reason: "O valor da devolução precisa ser maior que zero." };
  }

  const gross = Number(grossSale);
  if (!Number.isFinite(gross) || gross <= 0) {
    return { ok: false, reason: "Este lead não tem uma venda registrada." };
  }

  const currentReturns = Number(existingReturnsTotal) || 0;
  const projectedTotal = round2(currentReturns + value);

  if (projectedTotal > gross) {
    return {
      ok: false,
      reason: `O total devolvido (${projectedTotal}) não pode ultrapassar o valor da venda (${gross}).`,
    };
  }

  return { ok: true, amount: round2(value) };
};
