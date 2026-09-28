# Preparação de migração — IMESUL → HostGator VPS

> **Nada aqui foi aplicado em produção.** Todo este material é preparação: documentação, scripts e
> configs prontos para copiar quando a VPS existir. Produção continua 100% no cPanel/Locaweb atual
> (DNS, SSL, banco, variáveis, deploy) até você decidir a virada.

## Alvo

- HostGator VPS NVMe 2 — AlmaLinux, 1 vCPU, 2 GB RAM, 50 GB NVMe, 1 IP dedicado, root/SSH.
- Banco continua no **Supabase** (externo) — não migra para a VPS.
- Duas aplicações Next.js 16.3.5 / Node ≥22.16 independentes, cada uma com seu processo systemd e
  sua porta interna, atrás de um único Nginx:
  - `imesul-vendas` → porta interna **3001**
  - `imesul-institucional` (repo `imesul/`) → porta interna **3002**

## Ordem de leitura / uso

| Arquivo | Quando usar |
|---|---|
| [01-inventario.md](01-inventario.md) | Agora — mapa das duas apps, rotas, deps, artefatos, achados. |
| [02-provisionamento.sh](02-provisionamento.sh) | No dia 1 de acesso root/SSH à VPS nova. |
| [03-nginx-vendas.conf](03-nginx-vendas.conf), [04-nginx-institucional.conf](04-nginx-institucional.conf) | Ao configurar o Nginx da VPS. |
| [05-imesul-vendas.service](05-imesul-vendas.service), [06-imesul-institucional.service](06-imesul-institucional.service) | Ao configurar o systemd da VPS. |
| [07-env-checklist.md](07-env-checklist.md) | Ao preencher `/etc/imesul/*.env` na VPS (nomes, não valores). |
| [08-deploy.md](08-deploy.md) | Passo a passo do primeiro deploy nos dois apps. |
| [09-testes.sh](09-testes.sh) | Depois do deploy, testando por IP/Host, **antes** de qualquer DNS. |
| [10-dns-cutover.md](10-dns-cutover.md) | Só no dia da virada — checklist, não execução. |
| [11-rollback.md](11-rollback.md) | Se algo falhar depois da virada. |
| [12-seguranca.md](12-seguranca.md) | Hardening da VPS (firewall, SSH, fail2ban, headers, rate limit). |
| [13-monitoramento.md](13-monitoramento.md) | Health checks, systemd, recursos, Better Stack. |
| [14-backup.md](14-backup.md) | Código, `.env`, configs, snapshots, rollback de dados. |

O pedido original numerava os itens 1–15; a lista de arquivos do pedido ia até `13-monitoramento.md`
e **não tinha um arquivo dedicado ao item 11 (backup)** — criei `14-backup.md` para não deixar esse
requisito sem lugar. Nomes dos demais arquivos seguem exatamente o pedido.

## Regras seguidas nesta preparação

- Nenhum segredo, senha, token ou connection string em nenhum arquivo — só **nomes** de variáveis.
- Nada de DNS, SSL, deploy ou configuração alterada na produção atual.
- Nenhum rebuild desnecessário: cada artefato existente foi conferido antes de decidir o que fazer
  com ele (ver [01-inventario.md](01-inventario.md) §1.7, **corrigida em 28/09**) — o
  `imesul-vendas-standalone-final5-20260921.tar.gz`, já validado em Linux/produção, é o caminho
  **principal** para o `imesul-vendas`; os builds `.next/standalone` deste checkout do Windows
  continuam reprovados (binário `sharp` Windows); o institucional não tem pacote Linux pronto ainda
  e deve ser buildado **fora da VPS** (WSL2/Docker/CI) antes da migração — build **na própria VPS**
  fica como fallback nos dois casos, não como padrão (ela só tem 1 vCPU/2 GB RAM).

## Resumo do que falta decidir

Ver a seção final do relatório que acompanha esta entrega no chat: o que já está 100% pronto, o que
depende da compra da VPS, o que depende de IP/root/SSH, o que depende da decisão de domínio, e o que
só pode ser feito no dia da virada.
