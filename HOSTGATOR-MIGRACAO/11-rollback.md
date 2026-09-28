# 11. Plano de rollback

## Princípio

A migração só é "sem volta" no momento em que o DNS aponta para a VPS nova. Tudo antes disso
(provisionamento, deploy, testes por IP) é reversível trivialmente porque **não toca a produção
atual**. Por isso o plano de rollback de verdade é só sobre a fase de DNS.

## Gatilhos para rollback imediato (qualquer um destes, nas primeiras horas após a virada)

- `/api/health` de qualquer um dos dois apps fora do ar por mais de alguns minutos seguidos.
- Taxa de erro 5xx visivelmente acima do normal (ex.: acompanhar `access_log`/`error_log` do Nginx
  em tempo real logo após a virada: `tail -f /var/log/imesul/*-error.log`).
- Certificado SSL não emitido ou inválido (`curl -vI https://dominio` retornando erro de TLS).
- Fluxo de lead (`POST /api/leads`) ou consentimento sincronizado quebrado entre os dois domínios.
- Banco (Supabase) inacessível pela VPS (erro `28P01`/timeout de conexão persistente).

## Rollback — passo a passo

1. **Reverter os registros A** (apex e `www`, e o subdomínio de vendas se aplicável) de volta para
   o IP da conta cPanel/Locaweb atual — os mesmos registros trocados em
   [10-dns-cutover.md](10-dns-cutover.md) §10.3, no sentido inverso.
2. Como o TTL foi baixado antes da virada (10.4.1), a propagação de volta também é rápida.
3. **Não mexer em mais nada na Locaweb** — ela não foi tocada durante a tentativa de virada, então
   não precisa de nenhuma ação de restauração lá além do DNS.
4. Confirmar que o site voltou a responder pelo domínio real, pelo cPanel de novo:
   `curl -s https://grupoimesul.com.br/api/health`.
5. Deixar a VPS nova de pé (não desligar os serviços) para investigar a causa com calma, sem pressão
   de estar "no ar" errado.
6. Documentar o que falhou antes de tentar a virada de novo.

## O que NÃO precisa de rollback

- Nada no banco (Supabase) muda como parte desta migração — sem migration nova, sem dado novo. Um
  rollback de DNS não deixa nenhum resíduo de dado para limpar.
- A VPS nova continua existindo e configurada — a próxima tentativa de virada não recomeça do zero.

## Após um rollback

- Revisar os logs (`journalctl -u imesul-vendas`, `journalctl -u imesul-institucional`,
  `/var/log/imesul/*-error.log`, `/var/log/nginx/error.log`) do período da virada.
- Rodar [09-testes.sh](09-testes.sh) de novo contra a VPS por IP para isolar se o problema era do
  app, do Nginx, do SSL recém-emitido, ou de algo específico do tráfego real (ex.: algo que só
  aparece com usuários reais, não no teste sintético).
- Só tentar a virada de novo depois de entender a causa — não repetir "torcendo para dar certo".
