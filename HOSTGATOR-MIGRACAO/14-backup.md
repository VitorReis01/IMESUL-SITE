# 14. Backup (item 11 do pedido — sem arquivo numerado próprio na lista original; ver README.md)

O banco continua no **Supabase** — backup de dados é responsabilidade do plano Supabase (confirmar
qual plano e se tem PITR/point-in-time recovery habilitado; isso é uma decisão/verificação sua, não
tem o que preparar aqui além de lembrar de checar).

O que precisa de backup **na VPS** é: código-fonte (já está no Git — não precisa de backup
duplicado), configuração de sistema que não está em nenhum Git (`.env`, vhosts do Nginx, units do
systemd, este script de provisionamento já rodado) e, se quiser, snapshots inteiros da VPS.

## 14.1 O que faz backup de si mesmo (Git)

- Código de `imesul-vendas/` e `imesul/` — já versionado no repositório. Não precisa de rotina
  separada; o rollback de código é `git checkout`/`git revert`.

## 14.2 O que NÃO está no Git e precisa de backup próprio

- `/etc/imesul/imesul-vendas.env`, `/etc/imesul/imesul-institucional.env` — segredos, nunca vão
  para o Git.
- `/etc/nginx/conf.d/imesul-vendas.conf`, `imesul-institucional.conf` — depois de editados na VPS
  (domínio real, ajustes finos), podem divergir dos arquivos desta pasta.
- `/etc/systemd/system/imesul-vendas.service`, `imesul-institucional.service` — idem.
- Certificados Let's Encrypt (`/etc/letsencrypt/`) — renovam sozinhos via `certbot renew` (timer
  systemd instalado junto com o pacote), mas um backup evita ter que reemitir do zero num desastre.

## 14.3 Rotina simples de backup de configuração (local, na própria VPS + cópia fora dela)

```bash
sudo tee /usr/local/bin/imesul-backup-config.sh >/dev/null <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
DEST=/root/backups
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$DEST"
tar -czf "$DEST/imesul-config-$STAMP.tar.gz" \
  /etc/imesul \
  /etc/nginx/conf.d/imesul-vendas.conf \
  /etc/nginx/conf.d/imesul-institucional.conf \
  /etc/systemd/system/imesul-vendas.service \
  /etc/systemd/system/imesul-institucional.service \
  /etc/letsencrypt 2>/dev/null || true
chmod 600 "$DEST/imesul-config-$STAMP.tar.gz"
# mantém só os últimos 14 backups locais
ls -1t "$DEST"/imesul-config-*.tar.gz 2>/dev/null | tail -n +15 | xargs -r rm --
EOF
sudo chmod +x /usr/local/bin/imesul-backup-config.sh
( sudo crontab -l 2>/dev/null; echo "0 3 * * * /usr/local/bin/imesul-backup-config.sh" ) | sudo crontab -
```

Isso guarda os últimos 14 dias **localmente**, em `/root/backups`, protegido por `chmod 600` (contém
os `.env` com segredos). **Um backup só local não protege contra a VPS inteira sumir** — copiar
periodicamente para fora (escolha uma, não prescrevendo qual você já usa):
- `rsync`/`scp` para outra máquina sua, com uma chave SSH dedicada só para isso;
- `rclone` para um bucket S3/Backblaze/Drive já usado pela empresa;
- o próprio backup/snapshot do provedor (14.4), se cobrir arquivos e não só o disco inteiro.

Este documento não escolhe o destino externo por você — só deixa o script pronto para copiar para
onde for decidido.

## 14.4 Snapshot da VPS (nível de provedor)

Verificar no painel da HostGator se o plano VPS NVMe 2 inclui snapshot agendado ou só sob demanda.
Sugestão de uso, independente do que o painel oferecer:
- Um snapshot manual **logo depois do primeiro deploy validado** (8.6/09-testes.sh 100% verde) —
  ponto de restauração limpo antes de qualquer DNS.
- Um snapshot manual **antes da virada de DNS** (10.4) — permite restaurar a VPS inteira no estado
  exato pré-virada se algo além de DNS também precisar de rollback.
- Depois disso, cadência regular (semanal, por exemplo) se o painel suportar agendamento — decisão
  de custo/benefício sua.

## 14.5 Rollback de dados

Não existe "rollback de dados" desta migração porque **nenhuma migration nova roda** e **nenhum
dado é criado ou movido** — o banco Supabase é o mesmo antes e depois. Se um problema aparecer
depois da virada que pareça ser de dado (não de infraestrutura), ele não é causado por esta
migração — investigar separadamente, sem tentar "reverter" o banco.
