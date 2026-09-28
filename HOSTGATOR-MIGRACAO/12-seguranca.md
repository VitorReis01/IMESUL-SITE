# 12. Segurança da VPS

## 12.1 Firewall

Já configurado por [02-provisionamento.sh](02-provisionamento.sh) (`firewalld`): só SSH, HTTP e
HTTPS abertos. As portas internas do Node (3001/3002) **nunca** são expostas — só escutam em
`127.0.0.1` (`HOSTNAME=127.0.0.1` nos `.service`) e só o Nginx local fala com elas.

Conferir a qualquer momento:
```bash
sudo firewall-cmd --list-all
```

## 12.2 SSH

- **Login só por chave.** `02-provisionamento.sh` já bloqueia senha para o usuário admin
  (`passwd -l`). Depois de confirmar que a chave funciona (login de teste bem-sucedido), desligar
  também o login de root por senha e por chave direto (forçar passar pelo usuário admin + `sudo`):
  ```bash
  sudo sed -i \
    -e 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' \
    -e 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' \
    /etc/ssh/sshd_config
  sudo systemctl restart sshd
  ```
  **Fazer isso só depois de validar** que o usuário admin consegue logar por chave e usar `sudo` —
  testar em uma sessão SSH separada, sem fechar a sessão atual, antes de reiniciar o `sshd`.
- Se decidir mudar a porta do SSH (`SSH_PORT` no provisionamento), atualizar também qualquer
  ferramenta/monitor que conecte via SSH.

## 12.3 Fail2ban

Faz sentido aqui: a VPS tem IP público fixo e SSH exposto (ainda que só por chave). Protege contra
tentativas de força bruta e reduz ruído no log.

```bash
sudo dnf -y install epel-release
sudo dnf -y install fail2ban
sudo tee /etc/fail2ban/jail.d/imesul.local >/dev/null <<'EOF'
[sshd]
enabled = true
port = ssh
backend = systemd
maxretry = 5
findtime = 10m
bantime = 1h

[nginx-http-auth]
enabled = false
# não há auth HTTP básica nos vhosts do IMESUL; deixado desativado de propósito.
EOF
sudo systemctl enable --now fail2ban
sudo fail2ban-client status sshd
```

## 12.4 Headers de segurança

Já aplicados **pela própria aplicação Next.js** (`next.config.js#headers()` em ambos os projetos:
CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) — o Nginx
não precisa duplicá-los, só repassá-los (o `proxy_pass` já preserva os headers de resposta do
upstream por padrão). O HSTS extra em `add_header` nos blocos HTTPS comentados de
[03](03-nginx-vendas.conf)/[04](04-nginx-institucional.conf) é redundância proposital (mesmo valor
que o app já manda) — não conflita.

Ocultar a versão do Nginx globalmente (uma vez, no arquivo principal, não por vhost):
```bash
sudo sed -i '/http {/a\    server_tokens off;' /etc/nginx/nginx.conf
sudo nginx -t && sudo systemctl reload nginx
```

## 12.5 Rate limit no Nginx — sem quebrar o site

Já incluído em [03](03-nginx-vendas.conf)/[04](04-nginx-institucional.conf):
`limit_req_zone ... rate=10r/s` por IP, com `burst` maior nas rotas de assets (`/_next/static`,
`/_next/image`) para não travar o carregamento normal de uma página com várias imagens.

**Racional dos números:** na auditoria de 25–26/09/2026 desta mesma aplicação, uma rajada de
aproximadamente 2 requisições/segundo sustentada por alguns minutos em `/_next/image` coincidiu com
o site parar de responder na infraestrutura atual (não comprovado como causa, mas registrado em
`01-inventario.md`). O limite de 10 r/s com burst 15–40 é deliberadamente **generoso** (bem acima
de qualquer navegação humana real) — o objetivo aqui não é replicar uma proteção agressiva
desconhecida, é ter *alguma* barreira própria e visível (nos logs do Nginx, com `503` claro) contra
scraping ou rajada de bot, sem depender de uma caixa preta de terceiro. **Ajustar os números depois
de observar tráfego real** — os valores aqui são um ponto de partida, não uma medição desta VPS.

## 12.6 Permissões de arquivo

| Caminho | Dono | Permissão |
|---|---|---|
| `/var/www/imesul-vendas`, `/var/www/imesul-institucional` | `imesul:imesul` | 755 (750 se quiser mais restrito) |
| `/etc/imesul/*.env` | `root:imesul` | **600** |
| `/var/log/imesul/` | `imesul:imesul` | 755 |
| `/etc/nginx/conf.d/imesul-*.conf` | `root:root` | 644 |
| `/etc/systemd/system/imesul-*.service` | `root:root` | 644 |

O usuário `imesul` (dono dos processos Node) **não tem shell de login** (`/sbin/nologin`, criado
por `02-provisionamento.sh`) — reduz superfície mesmo que uma credencial dele vaze.

## 12.7 Logs e rotação

`/var/log/imesul/*.log` crescem indefinidamente sem rotação. Configurar `logrotate`:
```bash
sudo tee /etc/logrotate.d/imesul >/dev/null <<'EOF'
/var/log/imesul/*.log {
    weekly
    rotate 8
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
EOF
```
`copytruncate` evita ter que sinalizar os processos Node para reabrir o arquivo de log (mais simples
que `postrotate`/`systemctl reload`, aceitável para o volume de log esperado aqui). Os logs do
Nginx (`/var/log/imesul/*-access.log`, `*-error.log`) já são cobertos pelo mesmo padrão de glob.

## 12.8 SELinux

AlmaLinux vem com SELinux `enforcing` por padrão — **não desligar**. Como o Nginx só faz
`proxy_pass` para `127.0.0.1:PORT` (não serve arquivo estático diretamente de `/var/www`), a policy
padrão (`httpd_can_network_connect` já costuma vir ligada para proxy reverso em instalações
recentes; conferir com `getsebool httpd_can_network_connect`) normalmente já libera o proxy sem
ajuste. Se o `curl` local (8.4) funcionar mas o Nginx retornar 502, o primeiro suspeito é SELinux:
```bash
getsebool httpd_can_network_connect
sudo setsebool -P httpd_can_network_connect on   # só se estiver "off"
sudo tail -f /var/log/audit/audit.log | grep denied   # para confirmar antes de mudar
```
