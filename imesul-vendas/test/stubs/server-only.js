// Stub para testes (Vitest roda em Node puro, sem o bundler do Next.js que normalmente troca
// "server-only" por um no-op em contexto de servidor). Sem isso, qualquer teste que importe um
// módulo de Backend.js/ falharia só por causa do guard arquitetural do pacote real
// "server-only" (que lança incondicionalmente fora do bundler da Vercel/Next.js) - ver
// vitest.config.mjs (resolve.alias).
export {};
