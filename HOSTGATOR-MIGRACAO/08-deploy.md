# 8. Deploy (primeiro deploy, feito depois que a VPS existir e 02-provisionamento.sh já rodou)

Tudo aqui roda **na VPS**, como o usuário admin (`imesul_admin`, criado no provisionamento), com
`sudo` quando indicado. Nada disso toca a produção atual.

> **Correção de 28/09 (ver [01-inventario.md](01-inventario.md) §1.7):** build **na própria VPS**
> não é mais o caminho padrão — a VPS tem só 1 vCPU/2 GB RAM, dividida com dois processos Node em
> produção. O caminho principal agora é: **vendas reaproveita o pacote FINAL5** já validado em Linux;
> **institucional é buildado antes, fora da VPS** (WSL2/Docker/CI). Build direto na VPS vira
> **fallback**, usado só se o pacote pronto falhar na verificação ou não existir a tempo.

## 8.1 Levar o código-fonte para a VPS

Precisa em dois casos: (a) como base para os fallbacks de build na VPS (8.2b/8.3b), e (b) porque
`app.js`, `package.json` e os arquivos de config (`.env.example`, `next.config.js` etc.) vêm daqui
independentemente de qual caminho de build for usado.

**A) Git (recomendado, mais fácil de atualizar depois):**
```bash
sudo -u imesul git clone --branch preview/mobile-ajustes <URL_DO_REPO> /tmp/imesul-src
sudo -u imesul rsync -a --delete /tmp/imesul-src/imesul-vendas/ /var/www/imesul-vendas/ \
  --exclude node_modules --exclude .next --exclude .git
sudo -u imesul rsync -a --delete /tmp/imesul-src/imesul/ /var/www/imesul-institucional/ \
  --exclude node_modules --exclude .next --exclude .git
```
Ajuste a URL do repositório e as credenciais de acesso (chave SSH de deploy, se o repo for privado)
antes de rodar — não documentado aqui porque depende de como o repositório está hospedado.

**B) Tarball de código-fonte** (`imesul-vendas-cpanel.tar.gz`, ver
[01-inventario.md](01-inventario.md) §1.7b — código-fonte puro, sem build):
```bash
scp imesul-vendas-cpanel.tar.gz imesul_admin@IP_DA_VPS:/tmp/
ssh imesul_admin@IP_DA_VPS
sudo -u imesul tar -xzf /tmp/imesul-vendas-cpanel.tar.gz -C /var/www/imesul-vendas
```
Para o institucional, gerar um tarball equivalente do diretório `imesul/` (mesma lista de exclusões:
`node_modules`, `.next`, `.git`).

Em ambos os casos, confirme ao final que `/var/www/imesul-vendas/app.js` e
`/var/www/imesul-vendas/package.json` existem antes de seguir.

## 8.2 Publicar o build do `imesul-vendas`

### 8.2a — Caminho principal: reaproveitar o FINAL5

1. **Baixar o pacote do servidor cPanel** onde ele está guardado hoje
   (`imesul-vendas-standalone-final5-20260921.tar.gz`, ver [01-inventario.md](01-inventario.md)
   §1.7a) para a sua máquina, e dali para a VPS:
   ```bash
   scp imesul-vendas-standalone-final5-20260921.tar.gz imesul_admin@IP_DA_VPS:/tmp/
   ```
2. **Conferir o SHA-256** antes de qualquer coisa:
   ```bash
   sha256sum /tmp/imesul-vendas-standalone-final5-20260921.tar.gz
   # precisa bater com: 8dd0514bfb75d64e4bd3d01332fc89796d001f611ec48c24df7060dbff6a3507
   ```
   Se não bater, **pare** — não extraia um pacote que não confere; baixe de novo ou volte ao 8.2b.
3. **Extrair dentro da estrutura já copiada em 8.1** (o pacote traz `.next/standalone/`, que entra
   ao lado do `app.js` e `package.json` já presentes):
   ```bash
   sudo -u imesul tar -xzf /tmp/imesul-vendas-standalone-final5-20260921.tar.gz -C /var/www/imesul-vendas
   ```
4. **Verificar compatibilidade AlmaLinux** (não presumir — conferir):
   ```bash
   cat /var/www/imesul-vendas/.next/standalone/.next/BUILD_ID
   # esperado: XR0DFQkI7dmJ2lqwGGSwL
   find /var/www/imesul-vendas/.next/standalone/node_modules/@img -maxdepth 1
   # precisa mostrar sharp-linux-x64 (glibc) — NÃO sharp-win32-* nem sharp-linuxmusl-*
   file /var/www/imesul-vendas/.next/standalone/node_modules/@img/sharp-linux-x64/lib/*.node
   ldd /var/www/imesul-vendas/.next/standalone/node_modules/@img/sharp-linux-x64/lib/*.node | head
   # "not a dynamic executable" ou libs resolvidas sem "not found" = ok
   ```
5. **Smoke test isolado**, antes de subir o systemd:
   ```bash
   cd /var/www/imesul-vendas
   sudo -u imesul PORT=3001 HOSTNAME=127.0.0.1 NODE_ENV=production \
     DATABASE_URL='<temporário, só para este teste, nunca no histórico do shell permanente>' \
     node app.js &
   sleep 2
   curl -s http://127.0.0.1:3001/api/health
   curl -s -o /dev/null -w '%{http_code}\n' 'http://127.0.0.1:3001/_next/image?url=%2Fimages%2Flogo-imesul-oficial.png&w=640&q=75'
   kill %1
   ```
   Os dois `curl` precisam responder (200/JSON `ok` no primeiro; 200 imagem no segundo — a
   `/_next/image` é justamente o que valida o `sharp` Linux na prática). Se algo quebrar aqui
   (`Illegal instruction`, `invalid ELF header`, erro de `sharp`), o FINAL5 não é compatível com
   esta VPS — descartar e ir para 8.2b.
6. **Checar se o código do FINAL5 ainda reflete o que você quer publicar.** O `BUILD_ID` é de
   21/09 — se o branch de produção mudou desde então, decida: publicar o FINAL5 mesmo assim (código
   um pouco atrás, mas comprovadamente compatível) ou tratá-lo só como prova de compatibilidade e
   seguir para um build atualizado (8.2b, ou preparado fora da VPS como no institucional, 8.3a).

### 8.2b — Fallback: build direto na VPS

Só se 8.2a falhar (SHA não bate, incompatibilidade confirmada no smoke test, ou código
desatualizado demais):
```bash
cd /var/www/imesul-vendas
sudo -u imesul npm ci          # instala TUDO, incl. devDependencies (tailwind/postcss usadas no build)
sudo -u imesul npm run build:cpanel
```
Confirme o resultado do mesmo jeito que em 8.2a passo 4:
```bash
ls -la .next/standalone/server.js .next/standalone/public .next/standalone/.next/static
find .next/standalone/node_modules/@img -maxdepth 1 -iname "sharp-linux*"
```
**Atenção (1 vCPU):** um `next build` completo (não só a extração de um tarball) pode levar vários
minutos e usar toda a RAM disponível nessa VPS — evitar rodar isso com os outros dois serviços já
sob carga real; preferir uma janela de manutenção. Se travar/estourar memória com `EAGAIN` (mesmo
sintoma já visto em ambientes limitados), o `build:cpanel` do vendas já força `--webpack`
(configurado no `package.json`), o que deve evitar o problema.

## 8.3 Publicar o build do `imesul-institucional`

Não existia um FINAL5 equivalente para este app — **já resolvido em 28/09/2026** (ver
[01-inventario.md](01-inventario.md) §1.7d): build feito no WSL2 (Ubuntu 24.04, Node 22.23.3),
validado com smoke test real (rotas, headers, `/_next/static`, `/_next/image` provando o `sharp`
Linux funcionando). Artefato: `imesul-institucional-standalone-20260928.tar.gz` na raiz do
repositório, SHA-256 `d97e5123f3bc1fee10eeb9cdd60eb39c69976fca27313e290da585a73b126ce7`.

### 8.3a — Caminho principal: usar o pacote já preparado (com uma ressalva importante)

**Antes de usar este pacote específico em produção:** ele foi buildado com valores **placeholder**
de `NEXT_PUBLIC_SALES_URL`/`SITE_URL` (o domínio real ainda não estava decidido) — essas variáveis
são inlineadas no JavaScript do cliente em tempo de build, então **este tar.gz não é o artefato
final**, é a prova de que o processo funciona e que o `sharp` Linux é compatível. Assim que o
domínio real estiver decidido, gerar a versão definitiva assim (mesmo procedimento, WSL2 ou Docker):
```bash
# dentro do WSL2 (ou container node:22-bookworm — NÃO node:22-alpine, Alpine usa musl e o
# binário do sharp sairia incompatível com o glibc do AlmaLinux), com o código-fonte de imesul/:
npm ci   # ou "npm install" se o lockfile estiver fora de sync entre Windows e Linux (já visto aqui)
NEXT_PUBLIC_SALES_URL="https://<domínio real do vendas>" \
SITE_URL="https://<domínio real do institucional>" \
NODE_ENV=production \
npm run build:cpanel
# se travar por falta de workers/CPU (não aconteceu no WSL2 usado aqui, mas pode acontecer num
# runner de CI pequeno), o mesmo contorno do vendas se aplica:
#   npx next build --webpack && node scripts/prepare-standalone.mjs

tar -czf imesul-institucional-standalone-<data>.tar.gz -C <pasta-do-projeto> .next/standalone
sha256sum imesul-institucional-standalone-<data>.tar.gz   # anote o hash antes de transferir
```
Depois, levar para a VPS e conferir:
```bash
scp imesul-institucional-standalone-<data>.tar.gz imesul_admin@IP_DA_VPS:/tmp/
ssh imesul_admin@IP_DA_VPS
sha256sum /tmp/imesul-institucional-standalone-<data>.tar.gz   # bater com o hash anotado
sudo -u imesul tar -xzf /tmp/imesul-institucional-standalone-<data>.tar.gz -C /var/www/imesul-institucional
```
E repetir o mesmo smoke test do passo 8.2a-5 (adaptar porta para `3002`; este app não usa
`DATABASE_URL`). Se quiser usar o pacote placeholder de 28/09 só para validar que a VPS aceita o
pacote (sem publicar de verdade), ele está pronto para isso — só não apontar o Nginx/DNS reais para
ele enquanto tiver os valores de exemplo.

### 8.3b — Fallback: build direto na VPS

Só se 8.3a não for viável a tempo:
```bash
cd /var/www/imesul-institucional
sudo -u imesul npm ci
sudo -u imesul npm run build:cpanel
```
**Atenção (1 vCPU):** diferente do vendas, o `build:cpanel` do institucional hoje **não** força
`--webpack` nem limita `experimental.cpus` (ver [01-inventario.md](01-inventario.md) §1.1). Numa VPS
de 1 vCPU, se o build travar ou estourar memória com Turbopack, rodar manualmente com Webpack:
```bash
sudo -u imesul npx next build --webpack && sudo -u imesul node scripts/prepare-standalone.mjs
```
Se isso resolver, vale considerar adicionar `--webpack` ao `build:cpanel` do institucional no
código-fonte (mudança de projeto, fora do escopo desta preparação — só sinalizado aqui).

## 8.4 Variáveis de ambiente

```bash
sudo touch /etc/imesul/imesul-vendas.env /etc/imesul/imesul-institucional.env
sudo chown root:imesul /etc/imesul/imesul-vendas.env /etc/imesul/imesul-institucional.env
sudo chmod 600 /etc/imesul/imesul-vendas.env /etc/imesul/imesul-institucional.env
sudo -e /etc/imesul/imesul-vendas.env          # preencher conforme 07-env-checklist.md
sudo -e /etc/imesul/imesul-institucional.env   # idem
```
Confirme que `CONSENT_SYNC_SECRET` é **idêntico** nos dois arquivos antes de continuar.

## 8.5 systemd

```bash
sudo cp 05-imesul-vendas.service /etc/systemd/system/imesul-vendas.service
sudo cp 06-imesul-institucional.service /etc/systemd/system/imesul-institucional.service
sudo systemctl daemon-reload
sudo systemctl enable --now imesul-vendas
sudo systemctl enable --now imesul-institucional
sudo systemctl status imesul-vendas imesul-institucional --no-pager
```
Se algum dos dois falhar ao subir: `sudo journalctl -u imesul-vendas -n 80 --no-pager` (troque o
nome do serviço). As causas mais prováveis: `.env` incompleto (falta `DATABASE_URL` ou
`NEXT_PUBLIC_*` obrigatória) ou build ausente/incompleto (volte para 8.2/8.3).

Teste local, ainda sem Nginx:
```bash
curl -s http://127.0.0.1:3001/api/health
curl -s http://127.0.0.1:3002/api/health
```

## 8.6 Nginx

```bash
sudo cp 03-nginx-vendas.conf /etc/nginx/conf.d/imesul-vendas.conf
sudo cp 04-nginx-institucional.conf /etc/nginx/conf.d/imesul-institucional.conf
# editar os dois: trocar SEU_DOMINIO_VENDAS / SEU_DOMINIO_INSTITUCIONAL pelo
# domínio definitivo (mesmo que o DNS ainda não aponte para cá — só precisa
# bater com o Host: usado nos testes por IP, ver 09-testes.sh).
sudo nginx -t
sudo systemctl reload nginx
```

## 8.7 Teste por IP/Host, antes de qualquer DNS

```bash
IP_DA_VPS=xxx.xxx.xxx.xxx bash 09-testes.sh
```
Ver detalhes em [09-testes.sh](09-testes.sh). Só depois de tudo verde (ou com os problemas
entendidos e aceitos) é que faz sentido pensar em SSL (item 7) e DNS ([10-dns-cutover.md](10-dns-cutover.md)).

## 8.8 O que fica para depois (fora do escopo deste deploy inicial)

- Emissão de certificado (`certbot`) — só com DNS já apontando para a VPS.
- Migração de DNS — checklist em `10-dns-cutover.md`, execução manual e deliberada.
- Cron do IMEbot (`IMEBOT_CRON_SECRET`) via systemd timer, se o IMEbot for ativado nesta VPS.
- Reforço final de segurança (fail2ban, senha do root desligada de vez) — `12-seguranca.md`.
