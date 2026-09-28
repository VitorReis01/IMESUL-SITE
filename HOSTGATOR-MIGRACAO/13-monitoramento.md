# 13. Monitoramento

## 13.1 Health checks (aplicação)

| Rota | O que confirma |
|---|---|
| `GET /api/health` (vendas) | processo Node de pé, respondendo `{"status":"ok","service":"imesul-vendas"}` |
| `GET /api/health` (institucional) | idem |
| `GET /api/health/database` (vendas, com `x-monitoring-key`) | conexão real com o Supabase |
| `GET /api/health/imebot` (vendas, com `x-monitoring-key`) | estado do IMEbot, se ativado |

Monitor externo (Better Stack, UptimeRobot, ou equivalente): criar um "HTTP monitor" por rota acima,
intervalo de 1–5 min, esperando `200` e (para os dois primeiros) o corpo contendo `"status":"ok"`.
Alertar por e-mail/SMS/WhatsApp conforme o plano do serviço escolhido.

## 13.2 Monitor de homepage

Mesma ferramenta, um monitor a mais por app checando `GET /` (200 + tempo de resposta), separado do
`/api/health` porque a home passa pelo React Server Component completo — pode falhar mesmo com o
health check OK (ex.: erro de render numa página específica).

## 13.3 systemd e Nginx (dentro da VPS)

```bash
# checagem pontual
systemctl is-active imesul-vendas imesul-institucional nginx

# script simples de heartbeat, rodado por cron a cada 5 min, loga se algo caiu
sudo tee /usr/local/bin/imesul-heartbeat.sh >/dev/null <<'EOF'
#!/usr/bin/env bash
for svc in imesul-vendas imesul-institucional nginx; do
  if ! systemctl is-active --quiet "$svc"; then
    echo "$(date -Is) $svc NÃO está ativo" >> /var/log/imesul/heartbeat.log
  fi
done
EOF
sudo chmod +x /usr/local/bin/imesul-heartbeat.sh
( sudo crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/imesul-heartbeat.sh" ) | sudo crontab -
```
Se um serviço cair, o `Restart=on-failure` do systemd (já configurado nos units 05/06) tenta religar
sozinho; o heartbeat acima é só para você saber que aconteceu, via log — combinar com o monitor
externo (13.1) para alerta de verdade, não depender só deste log local.

## 13.4 CPU / RAM / swap / disco

VPS pequena (1 vCPU, 2 GB RAM) — vale a pena ter visibilidade sem instalar um stack pesado
(Prometheus/Grafana seriam desproporcionais aqui, e comeriam RAM que falta). Opção leve:

```bash
sudo tee /usr/local/bin/imesul-resources.sh >/dev/null <<'EOF'
#!/usr/bin/env bash
{
  echo "== $(date -Is) =="
  echo "-- load/uptime --"; uptime
  echo "-- memoria (MB) --"; free -m | awk 'NR==2{print "used="$3" free="$4" avail="$7}'
  echo "-- swap (MB) --"; free -m | awk 'NR==3{print "used="$3" total="$2}'
  echo "-- disco / --"; df -h / | awk 'NR==2{print "usado="$3" livre="$4" pct="$5}'
} >> /var/log/imesul/resources.log
EOF
sudo chmod +x /usr/local/bin/imesul-resources.sh
( sudo crontab -l 2>/dev/null; echo "*/15 * * * * /usr/local/bin/imesul-resources.sh" ) | sudo crontab -
```
Definir um limiar de alerta manual inicial (revisar depois de uma semana de dados reais): memória
disponível (`avail`) abaixo de ~200 MB, ou uso de disco acima de 80%, merece atenção — cada processo
Node tem `MemoryMax` (768M vendas / 512M institucional, nos `.service`) como teto duro; se um deles
bater nesse teto e o systemd matar o processo, isso já aparece como falha no `/api/health` (13.1) e
no heartbeat (13.3).

## 13.5 Better Stack (ou equivalente) — roteiro de configuração

1. Criar um "Heartbeat"/"HTTP monitor" por rota da tabela 13.1, apontando para o domínio real (só
   depois da virada de DNS) ou para o IP com header `Host:` customizado (antes da virada, se o
   serviço suportar — nem todos suportam `Host:` custom em monitor HTTP simples; nesse caso, só
   monitorar de verdade depois da virada).
2. Canal de alerta: e-mail e/ou integração com o canal já usado pela equipe (WhatsApp/Slack/Telegram
   — o que o plano do Better Stack oferecer).
3. Opcional: um monitor "TCP" na porta 443 do IP da VPS, complementar aos HTTP monitors, para pegar
   queda de handshake TLS mesmo se a aplicação achar que está tudo bem (situação parecida com o
   defeito já visto na infraestrutura cPanel atual: TCP abre, TLS nunca completa).
4. Não duplicar o monitor interno do próprio Supabase — o `GET /api/health/database` já cobre
   "a VPS consegue falar com o banco", que é o que importa daqui.
