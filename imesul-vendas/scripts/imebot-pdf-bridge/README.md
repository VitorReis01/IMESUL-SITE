# IMEbot PDF Bridge

Script PowerShell que roda em um PC comum da rede da IMESUL (nunca no servidor ERP) para buscar
os PDFs de orçamento autorizados pelo IMEbot, validar, escanear com o Microsoft Defender e gravar
no destino oficial `Y:\ORC-SITE-IMESUL\`. Ver o relatório da fase "IMEbot + PDF Bridge" para o
raciocínio completo de arquitetura e segurança.

## Antes de usar em produção (perguntas em aberto)

Estas três perguntas **precisam ser respondidas antes de configurar a Task Scheduler**:

1. Qual usuário Windows vai executar esta tarefa agendada?
2. Esse usuário realmente enxerga `Y:\ORC-SITE-IMESUL\` hoje?
3. O mapeamento do `Y:` continua disponível em execução **não-interativa** (fora de uma sessão
   logada)? Se não estiver, use diretamente `\\192.168.0.8\erp\ORC-SITE-IMESUL\` como
   `basePath` no `config.json` — mas só se esse caminho já for acessível pela rede interna com
   as credenciais corretas do Windows daquele usuário, sem abrir portas nem expor SMB para fora
   da rede interna.

## Configuração

1. Copie `config.example.json` para `config.json` (já ignorado pelo Git nesta pasta).
2. Preencha `backendBaseUrl` com o domínio real de produção do site de vendas.
3. Preencha `basePath` com o caminho local confirmado (ver perguntas acima).
4. Configure a variável de ambiente `IMEBOT_BRIDGE_SECRET` no PC (Machine ou User, nunca dentro
   de `config.json`) com o mesmo valor cadastrado na Vercel para essa variável.

## Agendador de Tarefas do Windows

- Ação: `powershell.exe -ExecutionPolicy Bypass -File "<caminho>\Run-ImebotPdfBridge.ps1"`
- Executar com a conta confirmada na pergunta 1 acima.
- Disparar em um intervalo curto (ex.: a cada 5 minutos) — o script processa tudo que estiver
  pendente em cada passada e termina; não fica residente em memória.
- Marcar "Executar estando o usuário conectado ou não" **somente depois** de confirmar a
  pergunta 3 (mapeamento de unidade em execução não-interativa).

## Segurança (fail closed)

- Nunca instala nada no servidor `192.168.0.8`.
- Nunca abre porta de entrada, nunca expõe SMB, nunca usa FTP.
- Só faz conexões HTTPS de **saída** para `backendBaseUrl`.
- Rejeita (nunca grava no destino final) qualquer arquivo que falhe em: tamanho, magic bytes de
  PDF, ou scan do Microsoft Defender — inclusive quando o Defender está indisponível.
- Nunca sobrescreve um arquivo já existente no destino final.
- O segredo do Bridge (`IMEBOT_BRIDGE_SECRET`) só existe como variável de ambiente local — nunca
  em texto puro em `config.json` nem em nenhum arquivo versionado.

## Logs

Cada execução grava em `bridge.log` (também ignorado pelo Git nesta pasta) — nunca inclui o
segredo do Bridge nem conteúdo de arquivos, só metadados técnicos (fileId, caminho relativo,
resultado da validação).
