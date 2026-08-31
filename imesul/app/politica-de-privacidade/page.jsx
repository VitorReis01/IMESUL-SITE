import Link from "next/link";
import { getRobotsPolicy } from "../../lib/siteUrl";

// Pagina estatica de politica de privacidade do site institucional. So descreve ferramentas
// realmente usadas hoje neste site: fontes do Google (Google Fonts), redirecionamento para
// WhatsApp/Meta quando o usuario opta por falar com um vendedor, e o backend do site de vendas
// (chamado nos bastidores para criar o Lead ID quando o usuario clica em "Falar no WhatsApp").
// Nao afirma vender dados, nao inventa CNPJ/razao social/DPO - contato remete aos canais oficiais
// ja publicados no site.
export const metadata = {
  title: "Política de Privacidade",
  description: "Como a IMESUL trata informações no ambiente digital do site institucional.",
  robots: getRobotsPolicy(),
};

const sections = [
  {
    id: "identificacao-e-finalidade",
    title: "Identificação e finalidade desta política",
    body: (
      <p>
        Esta Política de Privacidade descreve como a IMESUL trata informações no ambiente
        digital deste site institucional, incluindo suas páginas, botões de contato e o
        redirecionamento para o site de vendas e para o WhatsApp. Ao navegar neste site, o
        usuário concorda com os termos descritos aqui.
      </p>
    ),
  },
  {
    id: "dados-coletados",
    title: "Quais dados podem ser coletados",
    body: (
      <>
        <p>Dependendo de como o usuário utiliza o site, podemos coletar, entre outras, as seguintes informações:</p>
        <ul className="list-disc space-y-1.5 pl-5 marker:text-imesul-red">
          <li>Dados técnicos de navegação, como endereço IP, data e hora de acesso, navegador, dispositivo utilizado e páginas visitadas;</li>
          <li>Um identificador técnico anônimo, gerado localmente no navegador, usado apenas para relacionar um clique de contato ao Lead ID criado no site de vendas;</li>
          <li>A unidade (Dourados ou Campo Grande) escolhida pelo usuário para direcionar o atendimento, incluindo, se o usuário optar por isso, uma estimativa aproximada de localização calculada a partir da geolocalização do dispositivo;</li>
          <li>Informações usadas internamente para segurança e prevenção de abuso.</li>
        </ul>
      </>
    ),
  },
  {
    id: "escolha-de-unidade-e-localizacao",
    title: "Escolha de unidade e localização do dispositivo",
    body: (
      <>
        <p>
          Ao clicar em um botão de contato comercial, o site pergunta de onde o usuário deseja
          atendimento (Dourados ou Campo Grande e demais regiões), para direcionar corretamente
          o atendimento. Essa escolha fica salva no navegador como preferência necessária ao
          funcionamento do site.
        </p>
        <p>
          Opcionalmente, o usuário pode clicar em &quot;Usar minha localização&quot;. Isso só
          acontece após esse clique explícito — nunca automaticamente. Quando autorizado pelo
          navegador, a coordenada aproximada do dispositivo é usada apenas localmente, no próprio
          navegador, para estimar a unidade mais próxima; essa coordenada não é enviada a nenhum
          serviço externo de geolocalização.
        </p>
      </>
    ),
  },
  {
    id: "como-coletamos",
    title: "Como os dados são coletados",
    body: (
      <>
        <p>Os dados descritos acima podem ser coletados quando o usuário:</p>
        <ul className="list-disc space-y-1.5 pl-5 marker:text-imesul-red">
          <li>Acessa páginas e seções do site;</li>
          <li>Interage com botões de contato, incluindo direcionamento para o WhatsApp;</li>
          <li>Escolhe uma unidade de atendimento, manualmente ou usando a localização do dispositivo.</li>
        </ul>
        <p>
          Além disso, alguns registros técnicos são gerados automaticamente pela própria
          infraestrutura do site, de forma necessária para o funcionamento, a segurança e a
          prevenção de uso indevido.
        </p>
      </>
    ),
  },
  {
    id: "compartilhamento",
    title: "Compartilhamento de dados",
    body: (
      <>
        <p>
          A IMESUL não vende dados pessoais de seus usuários. Ainda assim, dados podem ser
          processados ou compartilhados com fornecedores de tecnologia quando necessário para o
          funcionamento do site:
        </p>
        <ul className="list-disc space-y-1.5 pl-5 marker:text-imesul-red">
          <li>
            Com o site de vendas da IMESUL (outro sistema operado pela própria IMESUL), para
            registrar o Lead ID e direcionar o atendimento ao vendedor correto quando o usuário
            clica em um botão de contato;
          </li>
          <li>
            Com a <strong>Vercel</strong>, responsável pela hospedagem deste site — operadora
            técnica que processa dados necessários ao funcionamento do site;
          </li>
          <li>
            Com o <strong>Google</strong>, para o carregamento de fontes tipográficas (Google
            Fonts) — o Google pode receber e processar informações técnicas da requisição
            conforme sua própria política de privacidade;
          </li>
          <li>
            Com o <strong>WhatsApp/Meta</strong>, quando o usuário opta por iniciar uma conversa
            comercial pelo WhatsApp — os dados necessários para essa comunicação passam a ser
            tratados também pela Meta, conforme a política de privacidade do WhatsApp;
          </li>
          <li>Com plataformas externas acessadas pelo próprio usuário, como Google Maps, Instagram e Facebook, quando ele escolhe utilizá-las;</li>
          <li>Por obrigação legal ou determinação de autoridade competente.</li>
        </ul>
      </>
    ),
  },
  {
    id: "cookies-e-consentimento",
    title: "Cookies, identificadores e consentimento",
    body: (
      <>
        <p>
          Ao acessar o site, um banner solicita a decisão do usuário: <strong>Aceitar</strong> ou{" "}
          <strong>Rejeitar</strong>. Enquanto essa decisão não for dada, apenas os recursos
          estritamente necessários ao funcionamento do site ficam ativos. Rejeitar não impede o
          uso do site nem a escolha manual de unidade de atendimento.
        </p>
        <p>
          A decisão pode ser revista a qualquer momento pelo link de preferências de privacidade
          disponível no rodapé do site. Este site não utiliza ferramentas de terceiros de
          rastreamento (como Google Analytics ou Meta Pixel) hoje; caso venham a ser incorporadas
          no futuro, só serão carregadas após o usuário aceitar, e esta política será atualizada.
        </p>
      </>
    ),
  },
  {
    id: "seguranca",
    title: "Segurança",
    body: (
      <p>
        A IMESUL adota medidas técnicas e organizacionais razoáveis para proteger os dados
        tratados neste site. Ainda assim, nenhum sistema conectado à internet é totalmente imune
        a incidentes de segurança. Acessos indevidos, tentativas de invasão, raspagem
        automatizada de dados (scraping) ou qualquer uso abusivo dos recursos disponíveis poderão
        ser bloqueados e registrados, para fins de proteção de direitos e segurança.
      </p>
    ),
  },
  {
    id: "retencao",
    title: "Retenção e eliminação de dados",
    body: (
      <p>
        Os dados são mantidos pelo tempo necessário para cumprir as finalidades descritas nesta
        política, ou por período adicional quando exigido por obrigação legal, auditoria,
        prevenção a fraudes, segurança ou defesa de direitos. Quando não forem mais necessários,
        os dados poderão ser eliminados ou anonimizados.
      </p>
    ),
  },
  {
    id: "direitos-do-titular",
    title: "Direitos do titular dos dados",
    body: (
      <>
        <p>Nos termos da Lei Geral de Proteção de Dados (LGPD), o usuário pode solicitar, conforme aplicável ao caso:</p>
        <ul className="list-disc space-y-1.5 pl-5 marker:text-imesul-red">
          <li>Confirmação da existência de tratamento de dados;</li>
          <li>Acesso aos dados tratados;</li>
          <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
          <li>Anonimização, bloqueio ou eliminação de dados, quando aplicável;</li>
          <li>Informação sobre com quem os dados foram compartilhados;</li>
          <li>Revogação do consentimento, quando esta for a base legal do tratamento;</li>
          <li>Oposição ao tratamento, quando cabível.</li>
        </ul>
      </>
    ),
  },
  {
    id: "como-exercer-direitos",
    title: "Como exercer seus direitos",
    body: (
      <p>
        Para exercer os direitos descritos acima, ou para tirar dúvidas sobre esta política, o
        usuário pode entrar em contato pelos canais oficiais da IMESUL disponíveis no site
        (incluindo WhatsApp e demais contatos publicados nas páginas de unidades e no rodapé).
      </p>
    ),
  },
  {
    id: "alteracoes-desta-politica",
    title: "Alterações desta política",
    body: (
      <p>
        Esta Política de Privacidade pode ser atualizada a qualquer momento, para refletir
        mudanças no site, na tecnologia utilizada, na legislação aplicável ou na operação da
        IMESUL. A versão vigente é sempre a publicada nesta página.
      </p>
    ),
  },
  {
    id: "ultima-atualizacao",
    title: "Data da última atualização",
    body: <p>Última atualização: agosto de 2026.</p>,
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-slate-900">
      <div className="mx-auto max-w-[880px] px-6 py-16 sm:px-8 sm:py-20 lg:py-24">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-condensed text-sm font-semibold uppercase tracking-[0.14em] text-slate-500 transition-colors hover:text-imesul-red"
        >
          ← Voltar para o site institucional
        </Link>

        <header className="mt-8 border-b border-slate-200 pb-10">
          <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-imesul-red">
            IMESUL DISTRIBUIÇÃO
          </span>
          <h1 className="mt-4 font-display text-[clamp(2.4rem,6vw,4.2rem)] leading-[0.95] text-slate-900">
            Política de Privacidade
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Como a IMESUL trata informações no ambiente digital.
          </p>
        </header>

        <nav aria-label="Índice da política" className="mt-10 rounded-[14px] border border-slate-200 bg-slate-50 p-6 sm:p-7">
          <p className="font-condensed text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
            Índice
          </p>
          <ol className="mt-4 grid gap-x-8 gap-y-2 text-sm leading-relaxed text-slate-700 sm:grid-cols-2">
            {sections.map((section, index) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="transition-colors hover:text-imesul-red">
                  {index + 1}. {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 rounded-[14px] border border-slate-200 bg-white p-6 sm:p-10">
          <div className="space-y-12">
            {sections.map((section, index) => (
              <section key={section.id} id={section.id} className="scroll-mt-24">
                <h2 className="font-condensed text-xl font-bold uppercase tracking-[0.04em] text-slate-900 sm:text-2xl">
                  <span className="text-imesul-red">{index + 1}.</span> {section.title}
                </h2>
                <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-700 sm:text-[15px]">
                  {section.body}
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="mt-12 flex justify-center">
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-[8px] border border-imesul-red bg-imesul-red px-7 py-3 font-condensed text-sm font-bold uppercase tracking-[0.14em] text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#ef3434]"
          >
            Voltar à página inicial
          </Link>
        </div>
      </div>
    </main>
  );
}
