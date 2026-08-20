import { describe, expect, it } from "vitest";
import {
  MAX_FEEDBACK_OBSERVATION_CHARS,
  isAffirmativeAnswer,
  isNegativeAnswer,
  normalizeFeedbackObservation,
  parseFeedbackRating,
} from "../lib/customerFeedback";

describe("parseFeedbackRating", () => {
  it("aceita inteiros de 1 a 10", () => {
    expect(parseFeedbackRating("1")).toEqual({ ok: true, rating: 1 });
    expect(parseFeedbackRating("10")).toEqual({ ok: true, rating: 10 });
  });

  it("rejeita 0, 11, decimal, texto e vazio", () => {
    expect(parseFeedbackRating("0").ok).toBe(false);
    expect(parseFeedbackRating("11").ok).toBe(false);
    expect(parseFeedbackRating("1.5").ok).toBe(false);
    expect(parseFeedbackRating("dez").ok).toBe(false);
    expect(parseFeedbackRating("").ok).toBe(false);
  });
});

describe("normalizeFeedbackObservation", () => {
  it("limita observação e normaliza espaços", () => {
    const long = `  ${"texto ".repeat(300)}  `;
    const result = normalizeFeedbackObservation(long);
    expect(result.ok).toBe(true);
    expect(result.observation.length).toBeLessThanOrEqual(MAX_FEEDBACK_OBSERVATION_CHARS);
    expect(result.observation).not.toMatch(/\s{2,}/);
  });

  it("rejeita observação vazia", () => {
    expect(normalizeFeedbackObservation("   ").ok).toBe(false);
  });
});

describe("respostas SIM/NAO", () => {
  it("reconhece respostas curtas sem interpretar texto arbitrário", () => {
    expect(isAffirmativeAnswer("sim")).toBe(true);
    expect(isAffirmativeAnswer("s")).toBe(true);
    expect(isNegativeAnswer("não")).toBe(true);
    expect(isNegativeAnswer("nao")).toBe(true);
    expect(isNegativeAnswer("n")).toBe(true);
    expect(isAffirmativeAnswer("sim, mas")).toBe(false);
  });
});
