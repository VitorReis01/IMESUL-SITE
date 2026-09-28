#!/usr/bin/env bash
# ============================================================================
# IMESUL — suíte de testes pré-DNS (testa a VPS pelo IP, com Host: forjado,
# ANTES de qualquer registro DNS apontar para ela). Só leitura — sem POST,
# sem lead, sem carrinho, sem evento de analytics, sem WhatsApp.
# ============================================================================
# Uso:
#   IP_DA_VPS=xxx.xxx.xxx.xxx \
#   HOST_VENDAS=vendas.grupoimesul.com.br \
#   HOST_INSTITUCIONAL=grupoimesul.com.br \
#   bash 09-testes.sh
#
# Rodar de fora da VPS (sua máquina) ou de dentro dela (contra 127.0.0.1) —
# funciona nos dois casos, só muda o IP_DA_VPS.
# ============================================================================
set -uo pipefail

IP_DA_VPS="${IP_DA_VPS:?defina IP_DA_VPS=xxx.xxx.xxx.xxx}"
HOST_VENDAS="${HOST_VENDAS:?defina HOST_VENDAS=seu-dominio-de-vendas}"
HOST_INSTITUCIONAL="${HOST_INSTITUCIONAL:?defina HOST_INSTITUCIONAL=seu-dominio-institucional}"
TIMEOUT="${TIMEOUT:-10}"

PASS=0; FAIL=0; WARN=0

pass() { echo "  [PASS] $*"; PASS=$((PASS+1)); }
fail() { echo "  [FAIL] $*"; FAIL=$((FAIL+1)); }
warnm() { echo "  [WARN] $*"; WARN=$((WARN+1)); }

req() {
  # req METHOD HOST PATH  -> imprime "CODE|TOTAL_TIME|CONTENT_TYPE"
  local method="$1" host="$2" path="$3"
  curl -sk -o /tmp/imesul-test-body -m "$TIMEOUT" -X "$method" \
    --resolve "${host}:80:${IP_DA_VPS}" --resolve "${host}:443:${IP_DA_VPS}" \
    -H "Host: ${host}" \
    -w '%{http_code}|%{time_total}|%{content_type}' \
    "http://${host}${path}" 2>/dev/null
}

check_200() {
  local label="$1" host="$2" path="$3"
  local out; out=$(req GET "$host" "$path")
  local code="${out%%|*}"
  if [[ "$code" == "200" ]]; then pass "$label ($path) -> 200"; else fail "$label ($path) -> $out"; fi
}

check_status() {
  local label="$1" host="$2" path="$3" expected="$4"
  local out; out=$(req GET "$host" "$path")
  local code="${out%%|*}"
  if [[ "$code" == "$expected" ]]; then pass "$label ($path) -> $code"; else fail "$label ($path) -> $out (esperado $expected)"; fi
}

echo "== 1. Homepage e health =="
check_200  "Homepage vendas"        "$HOST_VENDAS" "/"
check_200  "Health vendas"          "$HOST_VENDAS" "/api/health"
check_200  "Homepage institucional" "$HOST_INSTITUCIONAL" "/"
check_200  "Health institucional"   "$HOST_INSTITUCIONAL" "/api/health"

echo "== 2. Unidades (Campo Grande / Dourados) =="
check_200 "Campo Grande (hífen)" "$HOST_VENDAS" "/campo-grande"
check_200 "Campo Grande (sem hífen)" "$HOST_VENDAS" "/campogrande"
check_200 "Dourados" "$HOST_VENDAS" "/dourados"
check_200 "Dourados matriz" "$HOST_VENDAS" "/douradosmatriz"

echo "== 3. Categorias e produtos (amostra) =="
check_200 "Categoria telhas" "$HOST_VENDAS" "/materiais/telhas-metalicas"
check_200 "Categoria chapas" "$HOST_VENDAS" "/materiais/chapas"
check_200 "Produto tubo retangular" "$HOST_VENDAS" "/materiais/tubos-e-metalons/tubo-retangular"
check_200 "Política de privacidade (vendas)" "$HOST_VENDAS" "/politica-de-privacidade"
check_200 "Política de privacidade (institucional)" "$HOST_INSTITUCIONAL" "/politica-de-privacidade"
check_200 "Links (institucional)" "$HOST_INSTITUCIONAL" "/links"

echo "== 4. Assets =="
JS_PATH=$(curl -sk -m "$TIMEOUT" --resolve "${HOST_VENDAS}:80:${IP_DA_VPS}" \
  -H "Host: ${HOST_VENDAS}" "http://${HOST_VENDAS}/" 2>/dev/null \
  | grep -oE '/_next/static/chunks/[A-Za-z0-9_.-]+\.js' | head -1)
if [[ -n "$JS_PATH" ]]; then
  check_200 "_next/static (JS amostrado)" "$HOST_VENDAS" "$JS_PATH"
else
  warnm "não consegui extrair um caminho /_next/static/ do HTML da home para testar"
fi
check_200 "_next/image (logo)" "$HOST_VENDAS" "/_next/image?url=%2Fimages%2Flogo-imesul-oficial.png&w=640&q=75"

echo "== 5. robots.txt e sitemap.xml =="
for h in "$HOST_VENDAS" "$HOST_INSTITUCIONAL"; do
  out=$(req GET "$h" "/robots.txt"); code="${out%%|*}"; ct="${out##*|}"
  if [[ "$code" == "200" && "$ct" != *html* ]]; then pass "robots.txt ($h)"; else fail "robots.txt ($h) -> $out"; fi
  out=$(req GET "$h" "/sitemap.xml"); code="${out%%|*}"; ct="${out##*|}"
  if [[ "$code" == "200" && "$ct" != *html* ]]; then pass "sitemap.xml ($h)"; else warnm "sitemap.xml ($h) -> $out (pode não existir ainda, ver 01-inventario.md)"; fi
done

echo "== 6. Redirects =="
out=$(curl -sk -o /dev/null -m "$TIMEOUT" -D - --resolve "${HOST_VENDAS}:80:${IP_DA_VPS}" \
  -H "Host: ${HOST_VENDAS}" "http://${HOST_VENDAS}/materiais/acessorios/consumiveis" 2>/dev/null)
if echo "$out" | grep -qi "^location: .*materiais/acessorios/eletrodo"; then
  pass "Redirect consumiveis -> eletrodo"
else
  fail "Redirect consumiveis -> eletrodo não encontrado (ver headers abaixo)"
  echo "$out" | grep -i "^HTTP\|^location" | sed 's/^/       /'
fi
# Redirects legados via permanentRedirect() — achado em produção cPanel: saem quebrados
# (Location duplicado). Testar aqui se o Nginx/Node da VPS se comporta diferente.
out=$(curl -sk -o /dev/null -m "$TIMEOUT" -D - --resolve "${HOST_VENDAS}:80:${IP_DA_VPS}" \
  -H "Host: ${HOST_VENDAS}" "http://${HOST_VENDAS}/materiais/tintas-e-consumiveis" 2>/dev/null)
loc=$(echo "$out" | grep -i "^location:" | head -1)
if [[ -n "$loc" ]] && ! echo "$loc" | grep -q ","; then
  pass "Redirect legado tintas-e-consumiveis (Location sem duplicação)"
else
  warnm "Redirect legado tintas-e-consumiveis: $loc (comparar com o defeito já visto em produção)"
fi

echo "== 7. 404 =="
check_status "404 esperado" "$HOST_VENDAS" "/pagina-inexistente-xyz" "404"
check_status "404 esperado (institucional)" "$HOST_INSTITUCIONAL" "/pagina-inexistente-xyz" "404"

echo "== 8. Headers de segurança =="
hdrs=$(curl -sk -o /dev/null -m "$TIMEOUT" -D - --resolve "${HOST_VENDAS}:80:${IP_DA_VPS}" \
  -H "Host: ${HOST_VENDAS}" "http://${HOST_VENDAS}/" 2>/dev/null)
for h in "content-security-policy" "strict-transport-security" "x-content-type-options" \
         "x-frame-options" "referrer-policy"; do
  if echo "$hdrs" | grep -qi "^${h}:"; then pass "Header $h presente"; else fail "Header $h ausente"; fi
done
if echo "$hdrs" | grep -qi "^x-powered-by:"; then
  warnm "X-Powered-By presente (deveria estar oculto na VPS, sem Passenger)"
else
  pass "X-Powered-By ausente"
fi
if echo "$hdrs" | grep -qi "^server: nginx/[0-9]"; then
  warnm "Server expõe versão do Nginx (configurar server_tokens off; global, ver 12-seguranca.md)"
fi

echo "== 9. Consentimento / tracking (inspeção estática do HTML, sem gerar evento) =="
home_html=$(curl -sk -m "$TIMEOUT" --resolve "${HOST_VENDAS}:80:${IP_DA_VPS}" \
  -H "Host: ${HOST_VENDAS}" "http://${HOST_VENDAS}/" 2>/dev/null)
if echo "$home_html" | grep -qE "googletagmanager\.com|connect\.facebook\.net"; then
  fail "GA4/Meta presentes no HTML sem consentimento prévio"
else
  pass "Sem GA4/Meta no HTML inicial (pré-consentimento)"
fi

echo "== 10. Banco (Supabase) — somente leitura, via Node já instalado no build =="
if command -v node >/dev/null 2>&1 && [[ -n "${DATABASE_URL:-}" ]]; then
  node - <<'EOF'
const { Pool } = require("/var/www/imesul-vendas/.next/standalone/node_modules/pg");
(async () => {
  const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1, connectionTimeoutMillis: 8000 });
  const c = await p.connect();
  try {
    await c.query("BEGIN READ ONLY");
    const r = await c.query("select current_database() db, now() n");
    console.log("  [PASS] Banco somente-leitura OK:", r.rows[0].db, r.rows[0].n.toISOString());
    await c.query("ROLLBACK");
  } finally { c.release(); await p.end(); }
})().catch((e) => { console.log("  [FAIL] Banco:", e.message); process.exitCode = 1; });
EOF
else
  warnm "pulei o teste de banco (rode este script NA VPS com DATABASE_URL exportada no ambiente, não versionada aqui, para habilitar)"
fi

echo
echo "============================================================"
echo "RESULTADO: PASS=$PASS FAIL=$FAIL WARN=$WARN"
echo "============================================================"
[[ "$FAIL" -eq 0 ]]
