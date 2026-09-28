# 10. Plano de virada de DNS (checklist — NÃO executar agora)

Este arquivo é só o roteiro. Nenhum registro DNS foi ou deve ser alterado antes de você decidir a
data e ler este checklist com o Richard/TI.

## 10.1 Antes de tudo: exportar a zona DNS atual completa

Pegar, no provedor de DNS atual (Locaweb/valueserver, conforme `CLAUDE.md`), **todos** os registros
de `grupoimesul.com.br` — não só A/CNAME do site. Guardar uma cópia (fora deste repositório, ou
num arquivo local não versionado) antes de mudar qualquer coisa.

## 10.2 Registros que PRECISAM continuar exatamente como estão

Não fazem parte desta migração — mudar qualquer um deles quebra e-mail corporativo/Workspace:

- **MX** — hoje aponta para o Google Workspace (`ASPMX.L.GOOGLE.COM` e `ALT*.ASPMX.L.GOOGLE.COM`,
  conforme já observado nesta auditoria).
- **SPF** (registro TXT em `@`, geralmente contendo `include:_spf.google.com`).
- **DKIM** (registro TXT em algo como `google._domainkey` ou seletor equivalente).
- **DMARC** (registro TXT em `_dmarc`).
- Qualquer TXT/CNAME de verificação do Google Workspace (`google-site-verification=...` ou CNAME de
  verificação de domínio).
- Registros de outros serviços corporativos que existam na zona e não tenham relação com o site
  (ex.: outro subdomínio de um sistema interno) — **conferir a lista completa exportada em 10.1
  antes de decidir o que muda**, não assumir que só existem os registros conhecidos hoje.

## 10.3 Registros que devem mudar (só estes)

- `grupoimesul.com.br` (apex, registro A) → IP da VPS nova.
- `www.grupoimesul.com.br` (A ou CNAME para o apex) → IP da VPS nova (ou CNAME, se for essa a
  estrutura atual).
- Se o `imesul-vendas` for exposto num subdomínio próprio (ex.: `vendas.grupoimesul.com.br`) em vez
  de compartilhar o domínio institucional por outro caminho — decisão de domínio ainda em aberto,
  ver resumo no chat — criar/mudar esse registro A também.
- `cpanel`, `webmail`, `webdisk`, `cpcontacts`, `cpcalendars`, `autodiscover`, `autoconfig` — **não
  mudam** enquanto a conta cPanel/Locaweb continuar existindo (mesmo que só como fallback/rollback);
  decidir separadamente quando (e se) essa conta for encerrada de vez.

## 10.4 Antes da virada (24–48h antes)

1. **Baixar o TTL** dos registros A que vão mudar (apex e `www`) para um valor curto (ex.: 300s),
   com pelo menos 24–48h de antecedência — reduz o tempo de propagação/rollback no dia da virada.
2. Confirmar que a suíte de testes por IP ([09-testes.sh](09-testes.sh)) está 100% verde na VPS
   nova, incluindo HTTPS (certificado já emitido — ver abaixo).
3. **SSL antes do DNS apontar de fato:** o certbot precisa do DNS resolvendo para a VPS para validar
   o domínio (desafio HTTP-01). Isso cria uma ordem obrigatória:
   a. baixar o TTL (passo 1);
   b. apontar o DNS para a VPS nova;
   c. rodar o certbot **imediatamente** (ver comando abaixo);
   d. só então o site novo fica plenamente funcional em HTTPS — planeje uma janela curta em que o
      domínio já mudou mas o certificado ainda não existe (o Nginx dessa preparação serve HTTP
      normalmente nesse intervalo, sem quebrar a navegação, só sem cadeado).
   ```bash
   sudo dnf -y install certbot python3-certbot-nginx
   sudo certbot --nginx -d SEU_DOMINIO_VENDAS -d www.SEU_DOMINIO_VENDAS
   sudo certbot --nginx -d SEU_DOMINIO_INSTITUCIONAL -d www.SEU_DOMINIO_INSTITUCIONAL
   ```
   O plugin `--nginx` do certbot edita os vhosts automaticamente para habilitar o bloco 443 e o
   redirect 80→443 — depois de rodar, conferir que o resultado bate com os blocos comentados em
   [03](03-nginx-vendas.conf)/[04](04-nginx-institucional.conf) (headers de segurança preservados).
4. Confirmar que `CONSENT_SYNC_SECRET` está igual nos dois apps na VPS nova (repetido de propósito
   — é o erro mais fácil de cometer).
5. Definir e comunicar internamente o horário da virada (fora de horário comercial, se possível).

## 10.5 No dia da virada

1. Trocar os registros A (10.3) no provedor de DNS.
2. Rodar o certbot (10.4.3), se ainda não tiver rodado.
3. Rodar `09-testes.sh` de novo, agora contra o domínio real (sem precisar de `--resolve`, já que o
   DNS já aponta para a VPS).
4. Verificar especificamente:
   - `/api/health` dos dois apps;
   - e-mail continua chegando normalmente (MX intocado, mas confirme na prática);
   - consentimento sincronizado entre os dois domínios (token HMAC de 2 min, `CONSENT_SYNC_SECRET`
     idêntico);
   - SSL válido nos dois domínios (`curl -vI https://...` sem erro de certificado).
5. **Não desligar o cPanel/Locaweb ainda.** Manter em pé como fallback — ver
   [11-rollback.md](11-rollback.md) — por um período de observação (sugestão: pelo menos alguns
   dias) antes de considerar a virada definitiva.

## 10.6 Depois de confirmar estabilidade (dias/semanas depois, decisão separada)

- Subir o TTL de volta para um valor normal (ex.: 3600–14400s).
- Decidir o destino final da conta cPanel/Locaweb (manter como backup frio, ou encerrar — decisão
  sua, não técnica).
