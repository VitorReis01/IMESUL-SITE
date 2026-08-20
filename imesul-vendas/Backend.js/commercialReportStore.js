import "server-only";
import { query } from "./db";
import { CART_ABANDONMENT_THRESHOLD_MS } from "../lib/leadFlow";
import { groupLeadsByCompanyCnpj } from "../lib/sellerAuth";

// Agregações para o painel "Comercial" do admin (Lead ID, rodízio, carrinho, devoluções,
// comprador/CNPJ - ver relatório desta fase). Sempre por consulta agregada (COUNT/SUM/GROUP BY
// no Postgres), nunca carregando a tabela inteira para somar em memória. unit = "dourados"
// aparece nas métricas gerais/por unidade (registro para relatórios futuros, como pedido), mas
// nunca tem métricas de IMEbot atribuídas, porque o IMEbot nunca roda para essa unidade nesta
// fase.
//
// gross/returns/net: sale_amount é sempre o BRUTO (imutável); o líquido é sempre CALCULADO via
// LEFT JOIN com uma agregação de sales_returns por lead_id (CTE "lead_returns" abaixo) - nunca
// um valor sincronizado manualmente (mesmo princípio de lib/salesReturns.js).

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

// CTE reaproveitada em várias consultas: total já devolvido por lead. LEFT JOIN (não INNER) para
// nunca excluir leads sem nenhuma devolução (returns_total fica 0 via COALESCE no lugar de uso).
const leadReturnsCte = `
  lead_returns AS (
    SELECT lead_id, SUM(amount)::numeric AS returns_total
    FROM sales_returns
    GROUP BY lead_id
  )
`;

const buildGeneral = async () => {
  const { rows } = await query(
    `WITH ${leadReturnsCte}
     SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE sl.status = 'NEGOCIANDO')::int AS negociando,
       COUNT(*) FILTER (WHERE sl.status = 'VENDEU')::int AS vendidos,
       COUNT(*) FILTER (WHERE sl.status = 'NAO_VENDEU')::int AS nao_vendidos,
       COALESCE(SUM(sl.sale_amount) FILTER (WHERE sl.status = 'VENDEU'), 0)::numeric AS venda_bruta,
       COALESCE(SUM(lr.returns_total) FILTER (WHERE sl.status = 'VENDEU'), 0)::numeric AS devolucoes
     FROM sales_leads sl
     LEFT JOIN lead_returns lr ON lr.lead_id = sl.id`
  );

  const row = rows[0];
  const total = row.total || 0;
  const vendidos = row.vendidos || 0;
  const grossSale = Number(row.venda_bruta) || 0;
  const returnsTotal = Number(row.devolucoes) || 0;
  const netSale = round2(grossSale - returnsTotal);

  return {
    total,
    negociando: row.negociando || 0,
    vendidos,
    naoVendidos: row.nao_vendidos || 0,
    conversionRate: total > 0 ? round2((vendidos / total) * 100) : 0,
    grossSale: round2(grossSale),
    returnsTotal: round2(returnsTotal),
    netSale,
    averageNetTicket: vendidos > 0 ? round2(netSale / vendidos) : 0,
  };
};

const buildBySeller = async () => {
  const { rows } = await query(
    `WITH ${leadReturnsCte}
     SELECT
       ss.id, ss.name, ss.unit,
       COUNT(sl.id)::int AS recebidos,
       COUNT(sl.id) FILTER (WHERE sl.status = 'VENDEU')::int AS vendidos,
       COUNT(sl.id) FILTER (WHERE sl.status = 'NAO_VENDEU')::int AS nao_vendidos,
       COUNT(sl.id) FILTER (WHERE sl.status = 'NEGOCIANDO')::int AS negociando,
       COALESCE(SUM(sl.sale_amount) FILTER (WHERE sl.status = 'VENDEU'), 0)::numeric AS venda_bruta,
       COALESCE(SUM(lr.returns_total) FILTER (WHERE sl.status = 'VENDEU'), 0)::numeric AS devolucoes
     FROM sales_sellers ss
     LEFT JOIN sales_leads sl ON sl.seller_id = ss.id
     LEFT JOIN lead_returns lr ON lr.lead_id = sl.id
     GROUP BY ss.id, ss.name, ss.unit
     ORDER BY recebidos DESC, ss.name ASC`
  );

  return rows.map((row) => {
    const grossSale = Number(row.venda_bruta) || 0;
    const returnsTotal = Number(row.devolucoes) || 0;
    const netSale = round2(grossSale - returnsTotal);

    return {
      id: row.id,
      name: row.name,
      unit: row.unit,
      received: row.recebidos,
      sold: row.vendidos,
      notSold: row.nao_vendidos,
      negotiating: row.negociando,
      conversionRate: row.recebidos > 0 ? round2((row.vendidos / row.recebidos) * 100) : 0,
      grossSale: round2(grossSale),
      returnsTotal: round2(returnsTotal),
      netSale,
      averageNetTicket: row.vendidos > 0 ? round2(netSale / row.vendidos) : 0,
    };
  });
};

// Agrupamento genérico (flow_type / site_origin / unit / page_path) - mesma forma de consulta,
// só muda a coluna agrupada. Nunca aceita nome de coluna vindo de fora (allowlist fixa abaixo).
const groupableColumns = new Set(["flow_type", "site_origin", "unit", "page_path"]);

const buildGroupedByColumn = async (column, limit = null) => {
  if (!groupableColumns.has(column)) throw new Error("Coluna de agrupamento inválida.");

  const { rows } = await query(
    `WITH ${leadReturnsCte}
     SELECT
       sl.${column} AS key,
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE sl.status = 'VENDEU')::int AS vendidos,
       COALESCE(SUM(sl.sale_amount) FILTER (WHERE sl.status = 'VENDEU'), 0)::numeric AS venda_bruta,
       COALESCE(SUM(lr.returns_total) FILTER (WHERE sl.status = 'VENDEU'), 0)::numeric AS devolucoes
     FROM sales_leads sl
     LEFT JOIN lead_returns lr ON lr.lead_id = sl.id
     GROUP BY sl.${column}
     ORDER BY total DESC
     ${limit ? `LIMIT ${Number(limit)}` : ""}`
  );

  return rows.map((row) => {
    const grossSale = Number(row.venda_bruta) || 0;
    const returnsTotal = Number(row.devolucoes) || 0;

    return {
      key: row.key || "(vazio)",
      total: row.total,
      sold: row.vendidos,
      conversionRate: row.total > 0 ? round2((row.vendidos / row.total) * 100) : 0,
      grossSale: round2(grossSale),
      returnsTotal: round2(returnsTotal),
      netSale: round2(grossSale - returnsTotal),
    };
  });
};

// --- Empresas/CNPJ ------------------------------------------------------------------------------

// Consolida SEMPRE por CNPJ (nunca pelo texto de buyer_name - razões sociais podem ser digitadas
// de formas diferentes, ver lib/sellerAuth.js groupLeadsByCompanyCnpj e o relatório desta fase).
const buildByCompany = async () => {
  const { rows } = await query(
    `WITH ${leadReturnsCte}
     SELECT sl.buyer_cnpj, sl.buyer_name, sl.customer_name, ss.name AS seller_name,
            sl.sale_amount, COALESCE(lr.returns_total, 0)::numeric AS returns_total
       FROM sales_leads sl
       LEFT JOIN sales_sellers ss ON ss.id = sl.seller_id
       LEFT JOIN lead_returns lr ON lr.lead_id = sl.id
      WHERE sl.buyer_type = 'COMPANY' AND sl.buyer_cnpj IS NOT NULL AND sl.status = 'VENDEU'`
  );

  const leads = rows.map((row) => ({
    buyerType: "COMPANY",
    buyerCnpj: row.buyer_cnpj,
    buyerName: row.buyer_name,
    contactName: row.customer_name,
    sellerName: row.seller_name,
    saleAmount: row.sale_amount,
    returnsTotal: row.returns_total,
  }));

  return groupLeadsByCompanyCnpj(leads)
    .map((group) => ({ ...group, netSale: round2(group.grossSale - group.returnsTotal) }))
    .sort((a, b) => b.grossSale - a.grossSale)
    .slice(0, 30);
};

// --- Devoluções ----------------------------------------------------------------------------------

const buildReturnsReport = async () => {
  const { rows } = await query(
    `WITH ${leadReturnsCte}
     SELECT
       COUNT(*) FILTER (WHERE sl.status = 'VENDEU' AND COALESCE(lr.returns_total, 0) = 0)::int AS sem_devolucao,
       COUNT(*) FILTER (WHERE sl.status = 'VENDEU' AND COALESCE(lr.returns_total, 0) > 0 AND lr.returns_total < sl.sale_amount)::int AS devolucao_parcial,
       COUNT(*) FILTER (WHERE sl.status = 'VENDEU' AND COALESCE(lr.returns_total, 0) >= sl.sale_amount AND sl.sale_amount > 0)::int AS devolucao_total,
       COUNT(*) FILTER (WHERE sl.status = 'VENDEU')::int AS total_vendas,
       COALESCE(SUM(lr.returns_total), 0)::numeric AS total_devolvido
     FROM sales_leads sl
     LEFT JOIN lead_returns lr ON lr.lead_id = sl.id`
  );

  const row = rows[0];
  const totalSales = row.total_vendas || 0;
  const withAnyReturn = (row.devolucao_parcial || 0) + (row.devolucao_total || 0);

  return {
    noReturn: row.sem_devolucao || 0,
    partialReturn: row.devolucao_parcial || 0,
    fullReturn: row.devolucao_total || 0,
    totalReturnedValue: round2(row.total_devolvido),
    returnRate: totalSales > 0 ? round2((withAnyReturn / totalSales) * 100) : 0,
  };
};

// --- Carrinho abandonado -----------------------------------------------------------------------

const buildCartMetrics = async () => {
  const thresholdInterval = `${Math.round(CART_ABANDONMENT_THRESHOLD_MS / 1000)} seconds`;

  const { rows: summaryRows } = await query(
    `SELECT
       COUNT(*)::int AS criados,
       COUNT(*) FILTER (WHERE status = 'ACTIVE' AND last_activity_at >= NOW() - $1::interval)::int AS ativos,
       COUNT(*) FILTER (WHERE status = 'ACTIVE' AND last_activity_at < NOW() - $1::interval)::int AS abandonados,
       COUNT(*) FILTER (WHERE status = 'RECOVERED')::int AS recuperados,
       COUNT(*) FILTER (WHERE status = 'CONVERTED')::int AS convertidos
     FROM cart_sessions`,
    [thresholdInterval]
  );

  const row = summaryRows[0];
  const created = row.criados || 0;
  const abandoned = row.abandonados || 0;
  const converted = row.convertidos || 0;

  const { rows: productRows } = await query(
    `SELECT item->>'productName' AS product_name, COUNT(*)::int AS occurrences
       FROM cart_sessions, jsonb_array_elements(items) AS item
      WHERE item->>'productName' IS NOT NULL AND item->>'productName' <> ''
      GROUP BY item->>'productName'
      ORDER BY occurrences DESC
      LIMIT 10`
  );

  const { rows: abandonedProductRows } = await query(
    `SELECT item->>'productName' AS product_name, COUNT(*)::int AS occurrences
       FROM cart_sessions, jsonb_array_elements(items) AS item
      WHERE status = 'ACTIVE' AND last_activity_at < NOW() - $1::interval
        AND item->>'productName' IS NOT NULL AND item->>'productName' <> ''
      GROUP BY item->>'productName'
      ORDER BY occurrences DESC
      LIMIT 10`,
    [thresholdInterval]
  );

  return {
    created,
    active: row.ativos || 0,
    abandoned,
    recovered: row.recuperados || 0,
    converted,
    abandonmentRate: created > 0 ? round2((abandoned / created) * 100) : 0,
    cartToSaleConversionRate: created > 0 ? round2((converted / created) * 100) : 0,
    mostAddedProducts: productRows.map((r) => ({ name: r.product_name, count: r.occurrences })),
    mostAbandonedProducts: abandonedProductRows.map((r) => ({ name: r.product_name, count: r.occurrences })),
    abandonmentThresholdMinutes: Math.round(CART_ABANDONMENT_THRESHOLD_MS / 60_000),
  };
};

const buildHandoffMetrics = async () => {
  const [{ rows }, { rows: eventRows }] = await Promise.all([
    query(
    `SELECT
       COUNT(*)::int AS offered,
       COUNT(*) FILTER (WHERE first_clicked_at IS NOT NULL)::int AS clicked,
       COUNT(*) FILTER (WHERE first_clicked_at IS NULL)::int AS not_clicked,
       COALESCE(SUM(click_count), 0)::int AS total_clicks,
       COALESCE(SUM(followup_attempts), 0)::int AS followups
     FROM sales_handoff_links`
    ),
    query(
      `SELECT event_type, COUNT(*)::int AS count
         FROM sales_lead_events
        WHERE event_type IN (
          'CUSTOMER_CONFIRMED_ATTENDED',
          'CUSTOMER_CONFIRMED_NOT_ATTENDED',
          'HANDOFF_REOFFERED',
          'HANDOFF_FOLLOWUP_UNRESPONSIVE',
          'SELLER_REASSIGNED'
        )
        GROUP BY event_type`
    ),
  ]);

  const row = rows[0];
  const offered = row.offered || 0;
  const clicked = row.clicked || 0;
  const events = eventRows.reduce((acc, event) => {
    acc[event.event_type] = event.count;
    return acc;
  }, {});

  return {
    offered,
    clicked,
    notClicked: row.not_clicked || 0,
    totalClicks: row.total_clicks || 0,
    followupsSent: row.followups || 0,
    confirmedAttended: events.CUSTOMER_CONFIRMED_ATTENDED || 0,
    confirmedNotAttended: events.CUSTOMER_CONFIRMED_NOT_ATTENDED || 0,
    reoffered: events.HANDOFF_REOFFERED || 0,
    unresponsive: events.HANDOFF_FOLLOWUP_UNRESPONSIVE || 0,
    sellerReassigned: events.SELLER_REASSIGNED || 0,
    clickRate: offered > 0 ? round2((clicked / offered) * 100) : 0,
  };
};

const buildFeedbackMetrics = async () => {
  const { rows } = await query(
    `SELECT
       feedback_type,
       COUNT(*)::int AS started,
       COUNT(*) FILTER (WHERE completed_at IS NOT NULL)::int AS completed,
       AVG(rating) FILTER (WHERE rating IS NOT NULL)::numeric AS average_rating
     FROM sales_customer_feedback
     GROUP BY feedback_type`
  );

  const { rows: distributionRows } = await query(
    `SELECT feedback_type, rating, COUNT(*)::int AS count
       FROM sales_customer_feedback
      WHERE rating IS NOT NULL
      GROUP BY feedback_type, rating
      ORDER BY feedback_type ASC, rating ASC`
  );

  const base = {
    HANDOFF_SERVICE: { started: 0, completed: 0, responseRate: 0, averageRating: 0, distribution: {} },
    POST_SALE: { started: 0, completed: 0, responseRate: 0, averageRating: 0, distribution: {} },
  };

  for (const row of rows) {
    const started = row.started || 0;
    const completed = row.completed || 0;
    base[row.feedback_type] = {
      ...base[row.feedback_type],
      started,
      completed,
      responseRate: started > 0 ? round2((completed / started) * 100) : 0,
      averageRating: round2(row.average_rating),
    };
  }

  for (const row of distributionRows) {
    if (!base[row.feedback_type]) continue;
    base[row.feedback_type].distribution[row.rating] = row.count;
  }

  return base;
};

const buildFeedbackJobMetrics = async () => {
  const { rows } = await query(
    `SELECT job_type, status, COUNT(*)::int AS count
       FROM sales_feedback_jobs
      GROUP BY job_type, status
      ORDER BY job_type ASC, status ASC`
  );

  return rows.reduce((acc, row) => {
    acc[row.job_type] ||= {};
    acc[row.job_type][row.status] = row.count;
    return acc;
  }, {});
};

// Ponto único chamado pela rota /api/admin/commercial-report - monta o relatório completo numa
// só chamada (o painel faz UMA requisição, não uma por seção). byFlow já inclui WHATSAPP_IMEBOT
// automaticamente (agrupamento genérico por flow_type, sem allowlist de valores específicos).
export const buildCommercialReport = async () => {
  const [general, bySeller, byFlow, bySite, byUnit, byPage, byCompany, returns, cart, handoff, feedback, feedbackJobs] = await Promise.all([
    buildGeneral(),
    buildBySeller(),
    buildGroupedByColumn("flow_type"),
    buildGroupedByColumn("site_origin"),
    buildGroupedByColumn("unit"),
    buildGroupedByColumn("page_path", 15),
    buildByCompany(),
    buildReturnsReport(),
    buildCartMetrics(),
    buildHandoffMetrics(),
    buildFeedbackMetrics(),
    buildFeedbackJobMetrics(),
  ]);

  return { general, bySeller, byFlow, bySite, byUnit, byPage, byCompany, returns, cart, handoff, feedback, feedbackJobs };
};
