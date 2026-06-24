export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#06101d] px-6 text-center text-white">
      <div className="max-w-lg">
        <p className="font-mono text-xs tracking-[0.3em] text-imesul-red">404</p>
        <h1 className="mt-4 font-display text-6xl leading-none">Página não encontrada</h1>
        <p className="mt-5 text-imesul-steel-light/80">Retorne à Área de Vendas para continuar.</p>
        <a className="mt-8 inline-flex bg-imesul-red px-6 py-3 font-condensed font-bold uppercase tracking-[0.14em]" href="/">
          Voltar à Área de Vendas
        </a>
      </div>
    </main>
  );
}
