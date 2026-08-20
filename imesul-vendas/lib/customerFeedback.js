export const MAX_FEEDBACK_OBSERVATION_CHARS = 800;

export const parseFeedbackRating = (value) => {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) return { ok: false, reason: "Informe uma nota inteira de 1 a 10." };

  const rating = Number(text);
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
    return { ok: false, reason: "A nota deve ser um inteiro de 1 a 10." };
  }

  return { ok: true, rating };
};

export const normalizeFeedbackObservation = (value) => {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return { ok: false, reason: "Observação vazia." };
  return { ok: true, observation: text.slice(0, MAX_FEEDBACK_OBSERVATION_CHARS) };
};

export const isAffirmativeAnswer = (value) => /^(sim|s)$/i.test(String(value ?? "").trim());
export const isNegativeAnswer = (value) => /^(nao|não|n)$/i.test(String(value ?? "").trim());
