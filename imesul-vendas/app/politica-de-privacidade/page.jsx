import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Pagina estatica de politica de privacidade do site de vendas. Nao afirma usar ferramentas que o
// projeto nao usa hoje (sem Meta Pixel, sem Google Analytics) e nao inventa CNPJ, razao social,
// encarregado/DPO ou e-mail juridico — contato sempre remete aos canais oficiais ja publicados no
// site. Texto revisado para nao prometer o que o sistema atual nao garante (anonimizacao total,
// exclusao imediata, ausencia de compartilhamento com fornecedores tecnicos, seguranca absoluta).
export const metadata = {
  title: "Política de Privacidade | Imesul Vendas",
  description: "Como a IMESUL trata informações no ambiente digital do site de vendas.",
  robots: { index: true, follow: true },
};

const sections = [
  {
    id: "identificacao-e-finalidade",
    title: "Identificação e finalidade desta política",
    body: (
      <>
        <p>
          Esta Política de Privacidade descreve como a IMESUL trata informações no ambiente
          digital, incluindo este site de vendas, suas páginas internas, formulários, fluxo de
          orçamento, área de cadastro/login e demais canais oficiais e ferramentas de atendimento
          vinculados a ele.
        </p>
        <p>
          Ao navegar neste site e utilizar seus recursos, o usuário concorda com os termos
          descritos aqui. Recomendamos a leitura completa antes de preencher qualquer formulário.
        </p>
      </>
    ),
  },
  {
    id: "dados-coletados",
    title: "Quais dados podem ser coletados",
    body: (
      <>
        <p>Dependendo de como o usuário utiliza o site, podemos coletar, entre outras, as seguintes informações:</p>
        <ul className="list-disc space-y-1.5 pl-5 marker:text-imesul-red">
          <li>Nome;</li>
          <li>Telefone;</li>
          <li>E-mail;</li>
          <li>CPF, quando informado voluntariamente em algum formulário;</li>
          <li>Cidade e estado;</li>
          <li>Empresa, quando informada;</li>
          <li>Interesse em produtos, materiais ou solicitação de orçamento;</li>
          <li>Mensagens enviadas por meio de formulários ou campos de texto;</li>
          <li>Dados técnicos de navegação, como endereço IP, data e hora de acesso, navegador, dispositivo utilizado e páginas visitadas;</li>
          <li>Identificadores técnicos usados por ferramentas próprias de analytics;</li>
          <li>Informações usadas internamente para segurança e prevenção de abuso.</li>
        </ul>
        <p>
          Nem todo acesso ao site gera todos esses dados — muitos deles só existem quando o
          próprio usuário preenche um campo ou solicita um orçamento.
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
          <li>Preenche formulários disponíveis no site;</li>
          <li>Solicita um orçamento ou manifesta interesse em um produto;</li>
          <li>Interage com botões de contato, incluindo direcionamento para o WhatsApp;</li>
          <li>Acessa páginas e seções do site;</li>
          <li>Utiliza recursos que estejam em fase de implantação, como a área de login/cadastro;</li>
        </ul>
        <p>
          Além disso, alguns registros técnicos são gerados automaticamente pela própria
          infraestrutura do site, de forma necessária para o funcionamento, a segurança e a
          prevenção de uso indevido — independentemente de o usuário preencher algum formulário.
        </p>
      </>
    ),
  },
  {
    id: "finalidades",
    title: "Para que os dados são usados",
    body: (
      <>
        <p>Os dados tratados por este site podem ser usados para finalidades como:</p>
        <ul className="list-disc space-y-1.5 pl-5 marker:text-imesul-red">
          <li>Responder solicitações comerciais e pedidos de orçamento;</li>
          <li>Dar continuidade a atendimentos já iniciados;</li>
          <li>Enviar retorno sobre produtos, disponibilidade ou valores;</li>
          <li>Melhorar a navegação, o funcionamento e a experiência de uso do site;</li>
          <li>Manter a segurança do site e dos sistemas relacionados;</li>
          <li>Prevenir abuso, fraude, spam ou uso indevido dos recursos disponíveis;</li>
          <li>Cumprir obrigações legais ou regulatórias aplicáveis;</li>
          <li>Defender os direitos da IMESUL em processos administrativos, judiciais ou extrajudiciais, quando necessário.</li>
        </ul>
      </>
    ),
  },
  {
    id: "cadastro-em-implantacao",
    title: "Área de cadastro/login em implantação",
    body: (
      <>
        <p>
          A área de cadastro/login de cliente deste site pode estar em fase de implantação. Isso
          significa que informações inseridas nesses campos podem ser usadas apenas para testes,
          atendimento, segurança ou melhoria do serviço, conforme o estágio atual do recurso — e
          não necessariamente resultam, hoje, na criação de uma conta ativa e definitiva.
        </p>
        <p>
          A criação de conta com funcionalidade completa depende de implementação futura e de
          validação própria da IMESUL. Enquanto o recurso estiver em implantação, recomendamos que
          o usuário <strong>não utilize senhas iguais às que já usa em outros serviços</strong>.
        </p>
        <p>
          A IMESUL poderá desativar, alterar, limitar ou reformular recursos em implantação a
          qualquer momento, sem que isso represente alteração desta política em relação aos dados
          já tratados até então.
        </p>
      </>
    ),
  },
  {
    id: "compartilhamento",
    title: "Compartilhamento de dados",
    body: (
      <>
        <p>A IMESUL não vende dados pessoais a terceiros. Ainda assim, dados podem ser compartilhados quando necessário:</p>
        <ul className="list-disc space-y-1.5 pl-5 marker:text-imesul-red">
          <li>Com a equipe interna de atendimento e comercial da IMESUL, para dar seguimento a solicitações;</li>
          <li>Com fornecedores técnicos que auxiliem na hospedagem, segurança, manutenção ou funcionamento do site (por exemplo, provedores de infraestrutura em nuvem);</li>
          <li>Com plataformas externas acessadas pelo próprio usuário, como WhatsApp, Google Maps, Instagram e Facebook, quando ele escolhe utilizá-las;</li>
          <li>Por obrigação legal ou determinação de autoridade competente;</li>
          <li>Para proteção dos direitos da IMESUL, de usuários ou de terceiros, quando necessário.</li>
        </ul>
      </>
    ),
  },
  {
    id: "links-externos",
    title: "Links externos",
    body: (
      <>
        <p>
          Este site pode direcionar o usuário para plataformas externas, como WhatsApp, Google
          Maps, Instagram, Facebook e outros canais oficiais da IMESUL. Essas plataformas possuem
          políticas de privacidade próprias, independentes desta.
        </p>
        <p>
          Ao sair do ambiente da IMESUL e acessar um desses canais, o usuário passa a estar
          sujeito às regras e políticas da plataforma correspondente, sobre as quais a IMESUL não
          tem controle.
        </p>
      </>
    ),
  },
  {
    id: "cookies-e-analytics",
    title: "Cookies, identificadores e analytics",
    body: (
      <>
        <p>
          O site pode utilizar identificadores técnicos, registros de navegação e ferramentas
          próprias para funcionamento, segurança, análise de uso e melhoria da experiência do
          usuário.
        </p>
        <p>
          Caso ferramentas adicionais de terceiros venham a ser incorporadas no futuro, esta
          política será atualizada para refletir essa mudança antes ou no momento em que passarem
          a ser usadas.
        </p>
      </>
    ),
  },
  {
    id: "seguranca",
    title: "Segurança",
    body: (
      <>
        <p>
          A IMESUL adota medidas técnicas e organizacionais razoáveis para proteger os dados
          tratados neste site. Ainda assim, nenhum sistema conectado à internet é totalmente imune
          a incidentes de segurança — por isso, o usuário também deve fazer sua parte, protegendo
          seus próprios dispositivos, senhas e acessos.
        </p>
        <p>
          A IMESUL poderá monitorar tentativas de abuso, automação, spam, uso indevido e
          comportamento suspeito nos sistemas deste site. Acessos indevidos, tentativas de
          invasão, raspagem automatizada de dados (scraping), engenharia reversa, exploração de
          falhas ou qualquer uso abusivo dos recursos disponíveis poderão ser bloqueados e
          registrados, para fins de proteção de direitos e segurança.
        </p>
      </>
    ),
  },
  {
    id: "retencao",
    title: "Retenção e eliminação de dados",
    body: (
      <>
        <p>
          Os dados são mantidos pelo tempo necessário para cumprir as finalidades descritas nesta
          política. Em determinadas situações, também podem ser mantidos por período adicional
          para cumprimento de obrigação legal, auditoria, prevenção a fraudes, segurança, defesa
          de direitos ou exercício regular de direitos da IMESUL.
        </p>
        <p>
          Quando não forem mais necessários para essas finalidades, os dados poderão ser
          eliminados ou anonimizados, conforme aplicável ao tipo de dado e à base legal envolvida.
        </p>
      </>
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
          <li>Oposição ao tratamento, quando cabível;</li>
          <li>Solicitação de exclusão dos dados, respeitadas as hipóteses legais de retenção descritas nesta política.</li>
        </ul>
      </>
    ),
  },
  {
    id: "como-exercer-direitos",
    title: "Como exercer seus direitos",
    body: (
      <>
        <p>
          Para exercer os direitos descritos acima, ou para tirar dúvidas sobre esta política, o
          usuário pode entrar em contato pelos canais oficiais da IMESUL disponíveis no site
          (incluindo WhatsApp e demais contatos publicados nas páginas de unidades e no rodapé).
        </p>
      </>
    ),
  },
  {
    id: "responsabilidades-do-usuario",
    title: "Responsabilidades do usuário",
    body: (
      <>
        <p>Ao utilizar este site, o usuário é responsável por:</p>
        <ul className="list-disc space-y-1.5 pl-5 marker:text-imesul-red">
          <li>Fornecer informações verdadeiras nos formulários e campos disponíveis;</li>
          <li>Não inserir dados de terceiros sem autorização;</li>
          <li>Não enviar dados sensíveis desnecessários para o atendimento solicitado;</li>
          <li>Não tentar burlar, invadir, automatizar, extrair dados em massa ou prejudicar o funcionamento do site de qualquer forma.</li>
        </ul>
        <p>
          O uso indevido dos recursos deste site pode resultar em bloqueio de acesso, registro
          técnico do ocorrido e adoção das medidas cabíveis por parte da IMESUL.
        </p>
      </>
    ),
  },
  {
    id: "criancas-e-adolescentes",
    title: "Dados de crianças e adolescentes",
    body: (
      <>
        <p>
          Este site não é direcionado a crianças e adolescentes. Dados de menores de idade não
          devem ser enviados por meio deste site sem a autorização de seus responsáveis legais.
        </p>
      </>
    ),
  },
  {
    id: "alteracoes-desta-politica",
    title: "Alterações desta política",
    body: (
      <>
        <p>
          Esta Política de Privacidade pode ser atualizada a qualquer momento, para refletir
          mudanças no site, na tecnologia utilizada, na legislação aplicável ou na operação da
          IMESUL. A versão vigente é sempre a publicada nesta página.
        </p>
      </>
    ),
  },
  {
    id: "ultima-atualizacao",
    title: "Data da última atualização",
    body: <p>Última atualização: julho de 2026.</p>,
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#06101d] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(212,43,43,0.09),transparent_36%),radial-gradient(circle_at_88%_92%,rgba(37,99,166,0.08),transparent_34%)]" />

      <div className="relative z-10 mx-auto max-w-[880px] px-6 py-16 sm:px-8 sm:py-20 lg:py-24">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-condensed text-sm font-semibold uppercase tracking-[0.14em] text-imesul-steel-light/75 transition-colors hover:text-imesul-red"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Voltar para o site de vendas
        </Link>

        <header className="mt-8 border-b border-white/10 pb-10">
          <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-imesul-red">
            IMESUL VENDAS
          </span>
          <h1 className="mt-4 font-display text-[clamp(2.4rem,6vw,4.2rem)] leading-[0.95] text-white">
            Política de Privacidade
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-imesul-steel-light/75 sm:text-lg">
            Como a IMESUL trata informações no ambiente digital.
          </p>
        </header>

        {/* Indice com ancoras para as 16 secoes abaixo. */}
        <nav aria-label="Índice da política" className="mt-10 rounded-[14px] border border-white/10 bg-white/[0.03] p-6 sm:p-7">
          <p className="font-condensed text-xs font-bold uppercase tracking-[0.24em] text-imesul-steel-light/60">
            Índice
          </p>
          <ol className="mt-4 grid gap-x-8 gap-y-2 text-sm leading-relaxed text-imesul-steel-light/80 sm:grid-cols-2">
            {sections.map((section, index) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="transition-colors hover:text-imesul-red">
                  {index + 1}. {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 rounded-[14px] border border-white/10 bg-white/[0.03] p-6 sm:p-10">
          <div className="space-y-12">
            {sections.map((section, index) => (
              <section key={section.id} id={section.id} className="scroll-mt-24">
                <h2 className="font-condensed text-xl font-bold uppercase tracking-[0.04em] text-white sm:text-2xl">
                  <span className="text-imesul-red">{index + 1}.</span> {section.title}
                </h2>
                <div className="mt-4 space-y-4 text-sm leading-relaxed text-imesul-steel-light/78 sm:text-[15px]">
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
