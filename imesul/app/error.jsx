"use client";

// Exibe uma falha generica e permite repetir a renderizacao sem detalhes tecnicos.
export default function ErrorPage({ reset }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#050b14] px-6 text-center text-white">
      <div className="max-w-lg">
        <p className="font-mono text-xs tracking-[0.3em] text-imesul-red">IMESUL</p>
        <h1 className="mt-4 font-display text-6xl leading-none">Não foi possível abrir esta página</h1>
        <p className="mt-5 text-imesul-steel-light/80">Tente novamente em alguns instantes.</p>
        <button className="mt-8 bg-imesul-red px-6 py-3 font-condensed font-bold uppercase tracking-[0.14em]" type="button" onClick={() => reset()}>
          Tentar novamente
        </button>
      </div>
    </main>
  );
}
