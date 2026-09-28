#!/usr/bin/env bash
# ============================================================================
# IMESUL — provisionamento inicial da VPS (HostGator VPS NVMe 2, AlmaLinux)
# ============================================================================
# Idempotente: pode ser rodado mais de uma vez sem quebrar nada já configurado.
# NÃO faz deploy de código, NÃO mexe em DNS, NÃO emite certificado SSL.
# Rodar como root (ou via sudo) na VPS NOVA, depois que ela existir.
#
# Uso:
#   ADMIN_USER=imesul_admin ADMIN_SSH_PUBKEY="ssh-ed25519 AAAA... voce@maquina" \
#     bash 02-provisionamento.sh
#
# Se ADMIN_SSH_PUBKEY não for passada, o script cria o usuário mas AVISA no
# final para você colar a chave manualmente antes de desligar o acesso root
# por senha (ver 12-seguranca.md).
# ============================================================================
set -euo pipefail

ADMIN_USER="${ADMIN_USER:-imesul_admin}"
SERVICE_USER="${SERVICE_USER:-imesul}"          # dono dos processos Node (systemd)
ADMIN_SSH_PUBKEY="${ADMIN_SSH_PUBKEY:-}"
TIMEZONE="${TIMEZONE:-America/Campo_Grande}"     # MS (Dourados/Campo Grande)
SWAP_SIZE_GB="${SWAP_SIZE_GB:-2}"                # VPS tem 2 GB RAM -> 2 GB swap
NODE_MAJOR="${NODE_MAJOR:-22}"
SSH_PORT="${SSH_PORT:-22}"                       # troque aqui se for usar porta não-padrão

log() { echo -e "\n\033[1;32m==> $*\033[0m"; }
warn() { echo -e "\033[1;33m[AVISO] $*\033[0m"; }

if [[ $EUID -ne 0 ]]; then
  echo "Rode como root (sudo -i, ou 'sudo bash 02-provisionamento.sh')." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
log "1/12 — Atualizando o sistema"
dnf -y update

# ---------------------------------------------------------------------------
log "2/12 — Ferramentas básicas"
dnf -y install curl wget git vim htop unzip tar jq firewalld chrony \
  policycoreutils-python-utils logrotate cronie

systemctl enable --now crond

# ---------------------------------------------------------------------------
log "3/12 — Node.js ${NODE_MAJOR} (NodeSource)"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/^v//;s/\..*//')" != "$NODE_MAJOR" ]]; then
  curl -fsSL "https://rpm.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  dnf -y install nodejs
fi
node -v
npm -v

# ---------------------------------------------------------------------------
log "4/12 — Nginx"
if ! rpm -q nginx >/dev/null 2>&1; then
  dnf -y install nginx
fi
systemctl enable nginx
mkdir -p /etc/nginx/conf.d
# AlmaLinux/RHEL usa /etc/nginx/conf.d/*.conf diretamente (sem sites-available/enabled do Debian).
# Os arquivos 03-nginx-vendas.conf e 04-nginx-institucional.conf vão para lá no dia do deploy.

# ---------------------------------------------------------------------------
log "5/12 — Timezone e NTP (chrony)"
timedatectl set-timezone "$TIMEZONE"
systemctl enable --now chronyd
chronyc makestep || true
timedatectl status | sed -n '1,6p'

# ---------------------------------------------------------------------------
log "6/12 — Swap (${SWAP_SIZE_GB} GB) — necessária numa VPS de 2 GB de RAM"
if ! swapon --show | grep -q '/swapfile'; then
  fallocate -l "${SWAP_SIZE_GB}G" /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=$((SWAP_SIZE_GB * 1024))
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
else
  echo "swap já existe, mantendo."
fi
# swappiness baixo: prioriza RAM, só usa swap quando necessário (evita I/O
# desnecessário no NVMe e latência alta sob picos de memória do Node/Next).
cat > /etc/sysctl.d/99-imesul-swap.conf <<'EOF'
vm.swappiness=10
vm.vfs_cache_pressure=50
EOF
sysctl --system >/dev/null

# ---------------------------------------------------------------------------
log "7/12 — Usuário administrativo (sudo, login SSH)"
if ! id "$ADMIN_USER" >/dev/null 2>&1; then
  useradd -m -s /bin/bash -G wheel "$ADMIN_USER"
  echo "Usuário $ADMIN_USER criado, sem senha definida (login só por chave)."
  passwd -l "$ADMIN_USER"   # bloqueia login por senha para este usuário também
else
  echo "Usuário $ADMIN_USER já existe."
fi

install -d -m 700 -o "$ADMIN_USER" -g "$ADMIN_USER" "/home/$ADMIN_USER/.ssh"
if [[ -n "$ADMIN_SSH_PUBKEY" ]]; then
  AUTHKEYS="/home/$ADMIN_USER/.ssh/authorized_keys"
  touch "$AUTHKEYS"
  grep -qF "$ADMIN_SSH_PUBKEY" "$AUTHKEYS" || echo "$ADMIN_SSH_PUBKEY" >> "$AUTHKEYS"
  chmod 600 "$AUTHKEYS"
  chown "$ADMIN_USER:$ADMIN_USER" "$AUTHKEYS"
  echo "Chave pública adicionada para $ADMIN_USER."
else
  warn "ADMIN_SSH_PUBKEY não foi passada. Adicione manualmente antes de desligar login root por senha:"
  warn "  echo 'ssh-ed25519 AAAA...' >> /home/$ADMIN_USER/.ssh/authorized_keys"
fi

# ---------------------------------------------------------------------------
log "8/12 — Usuário de serviço (dono dos processos Node, sem shell de login)"
if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  useradd -r -m -d "/home/$SERVICE_USER" -s /sbin/nologin "$SERVICE_USER"
  echo "Usuário de serviço $SERVICE_USER criado (sem login interativo, roda os systemd services)."
else
  echo "Usuário de serviço $SERVICE_USER já existe."
fi

# ---------------------------------------------------------------------------
log "9/12 — Estrutura de diretórios (ver 08-deploy.md)"
install -d -m 755 -o "$SERVICE_USER" -g "$SERVICE_USER" /var/www/imesul-vendas
install -d -m 755 -o "$SERVICE_USER" -g "$SERVICE_USER" /var/www/imesul-institucional
install -d -m 750 -o root            -g "$SERVICE_USER" /etc/imesul
install -d -m 755 -o "$SERVICE_USER" -g "$SERVICE_USER" /var/log/imesul
# SELinux: se estiver enforcing, os tipos de contexto httpd_sys_content_t
# precisam ser ajustados para o Nginx alcançar os diretórios via proxy — como
# aqui o Nginx só faz proxy_pass para 127.0.0.1:PORT (não serve arquivos
# diretamente de /var/www), isso normalmente não é necessário. Se o Nginx
# vier a servir arquivos estáticos direto de /var/www no futuro, rodar:
#   semanage fcontext -a -t httpd_sys_content_t "/var/www/imesul-vendas(/.*)?"
#   restorecon -Rv /var/www/imesul-vendas

# ---------------------------------------------------------------------------
log "10/12 — Firewall (firewalld) — só as portas necessárias"
systemctl enable --now firewalld
firewall-cmd --permanent --remove-service=cockpit 2>/dev/null || true
firewall-cmd --permanent --add-service=ssh
if [[ "$SSH_PORT" != "22" ]]; then
  firewall-cmd --permanent --add-port="${SSH_PORT}/tcp"
  firewall-cmd --permanent --remove-service=ssh 2>/dev/null || true
fi
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
# Portas internas do Node (3001/3002) NUNCA são abertas no firewall — só o
# Nginx local fala com elas via 127.0.0.1 (ver 03/04-nginx-*.conf e
# 05/06-imesul-*.service, que já fazem bind em 127.0.0.1).
firewall-cmd --reload
firewall-cmd --list-all

# ---------------------------------------------------------------------------
log "11/12 — Permissões: SELinux em modo enforcing (padrão AlmaLinux) — não desligar"
if command -v getenforce >/dev/null 2>&1; then
  getenforce
fi

# ---------------------------------------------------------------------------
log "12/12 — Resumo"
cat <<EOF

Provisionamento base concluído.

  Usuário admin (sudo, SSH):        $ADMIN_USER
  Usuário de serviço (systemd):     $SERVICE_USER
  Node.js:                          $(node -v)
  Timezone:                         $(timedatectl show -p Timezone --value)
  Swap:                             $(swapon --show --noheadings | awk '{print $3}')
  Firewall (portas abertas):        $(firewall-cmd --list-services) $(firewall-cmd --list-ports)

Próximos passos (NÃO incluídos neste script, de propósito):
  - Copiar o código para /var/www/imesul-vendas e /var/www/imesul-institucional (08-deploy.md).
  - Criar /etc/imesul/imesul-vendas.env e /etc/imesul/imesul-institucional.env com os
    valores reais (07-env-checklist.md) — nunca versionar esses arquivos.
  - Instalar os arquivos 03/04 em /etc/nginx/conf.d/ e 05/06 em /etc/systemd/system/.
  - SÓ DEPOIS de validar tudo por IP (09-testes.sh): SSL (item 7) e DNS (10-dns-cutover.md).
  - Reforço de segurança adicional (fail2ban, desligar senha do root de vez): 12-seguranca.md.

EOF
