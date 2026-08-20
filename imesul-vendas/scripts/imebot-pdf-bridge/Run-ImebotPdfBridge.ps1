<#
IMEbot PDF Bridge
=================
Roda em um PC comum da rede da IMESUL (NUNCA no servidor ERP), via Agendador de Tarefas do
Windows. So faz conexoes HTTPS de SAIDA para o backend do site de vendas - nenhuma porta e
aberta, nenhum SMB e exposto, nenhuma credencial do servidor ERP e usada aqui.

Fluxo por execucao (uma "passada"; o Agendador de Tarefas chama este script periodicamente):
  1. Pergunta ao backend quais PDFs estao pendentes (GET /api/imebot/bridge/pending).
  2. Para cada um: baixa via HTTPS autenticado (GET /api/imebot/bridge/download/{fileId}).
  3. Valida tamanho maximo.
  4. Valida que o arquivo E REALMENTE um PDF pelos magic bytes (nunca confia na extensao/Content-Type).
  5. Calcula SHA-256.
  6. Escaneia com o Microsoft Defender (MpCmdRun.exe) - FAIL CLOSED: qualquer coisa != "limpo"
     rejeita o arquivo, nunca move para o destino final.
  7. Só se aprovado, grava em <basePath>\<caminho relativo> - a pasta base (Y:\ORC-SITE-IMESUL)
     e' definida SOMENTE neste arquivo de configuracao local, nunca informada pelo backend.
  8. Confirma o armazenamento ao backend (POST /api/imebot/bridge/confirm) ou informa a rejeicao
     (POST /api/imebot/bridge/reject).

Pre-requisitos ANTES de usar em producao (ver relatorio desta fase - estas perguntas ainda nao
foram respondidas):
  - Confirmar qual usuario Windows executa esta Task Scheduler.
  - Confirmar que esse usuario realmente enxerga o caminho configurado em basePath (config.json).
  - Confirmar que o mapeamento continua disponivel em execucao NAO-INTERATIVA (fora de uma sessao
    logada) - se nao estiver, usar \\192.168.0.8\erp\ORC-SITE-IMESUL\ diretamente no basePath,
    desde que o acesso ja funcione pela rede interna com as credenciais corretas do Windows,
    nunca expostas neste script.
#>

param(
  [string]$ConfigPath = (Join-Path $PSScriptRoot "config.json")
)

$ErrorActionPreference = "Stop"
$logPath = Join-Path $PSScriptRoot "bridge.log"

function Write-BridgeLog {
  param([string]$Message)
  $line = "[{0:yyyy-MM-dd HH:mm:ss}] {1}" -f (Get-Date), $Message
  Add-Content -Path $logPath -Value $line -Encoding utf8
  Write-Host $line
}

function Get-BridgeConfig {
  if (-not (Test-Path $ConfigPath)) {
    throw "Arquivo de configuracao nao encontrado: $ConfigPath. Copie config.example.json para config.json e preencha os valores locais."
  }

  $config = Get-Content -Path $ConfigPath -Raw | ConvertFrom-Json

  if (-not $config.backendBaseUrl -or -not $config.basePath -or -not $config.bridgeSecretEnvVar) {
    throw "config.json incompleto - backendBaseUrl, basePath e bridgeSecretEnvVar sao obrigatorios."
  }

  $secret = [System.Environment]::GetEnvironmentVariable($config.bridgeSecretEnvVar, "Machine")
  if (-not $secret) { $secret = [System.Environment]::GetEnvironmentVariable($config.bridgeSecretEnvVar, "User") }
  if (-not $secret) { $secret = [System.Environment]::GetEnvironmentVariable($config.bridgeSecretEnvVar, "Process") }

  if (-not $secret) {
    throw "Variavel de ambiente '$($config.bridgeSecretEnvVar)' nao encontrada - configure o segredo do Bridge antes de rodar (nunca escreva o segredo direto neste script)."
  }

  return @{
    BackendBaseUrl = $config.backendBaseUrl.TrimEnd("/")
    BasePath       = $config.basePath
    Secret         = $secret
  }
}

function Invoke-BridgeRequest {
  param(
    [string]$Method,
    [string]$Path,
    [hashtable]$Config,
    $Body = $null
  )

  $headers = @{ Authorization = "Bearer $($Config.Secret)" }
  $uri = "$($Config.BackendBaseUrl)$Path"

  if ($Body) {
    $json = $Body | ConvertTo-Json -Depth 5
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -ContentType "application/json" -Body $json -TimeoutSec 30
  }

  return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -TimeoutSec 30
}

# Confere que os primeiros 4 bytes do arquivo sao exatamente "%PDF" - nunca confia em extensao
# nem em qualquer Content-Type informado pelo backend/rede.
function Test-IsRealPdf {
  param([string]$FilePath)

  $stream = [System.IO.File]::OpenRead($FilePath)
  try {
    $buffer = New-Object byte[] 4
    $read = $stream.Read($buffer, 0, 4)
    if ($read -lt 4) { return $false }
    return ($buffer[0] -eq 0x25 -and $buffer[1] -eq 0x50 -and $buffer[2] -eq 0x44 -and $buffer[3] -eq 0x46)
  } finally {
    $stream.Close()
  }
}

# Bloqueia ".." / barra inicial / letra de drive / UNC no caminho relativo - repete a MESMA
# regra do lado do backend (lib/pdfValidation.js isRelativePathSafe), como ultima linha de
# defesa antes de gravar em disco de verdade.
function Test-IsRelativePathSafe {
  param([string]$RelativePath)

  if ([string]::IsNullOrWhiteSpace($RelativePath)) { return $false }
  if ($RelativePath -match "\.\.") { return $false }
  if ($RelativePath -match "^[/\\]") { return $false }
  if ($RelativePath -match "^[A-Za-z]:") { return $false }
  if ($RelativePath -match "^\\\\") { return $false }
  return $true
}

# Fail closed: qualquer coisa diferente de "sem ameaca" (exit code 0) e' tratada como reprovado.
# MpCmdRun.exe e' o utilitario oficial de linha de comando do Microsoft Defender.
function Invoke-DefenderScan {
  param([string]$FilePath)

  $mpCmdRun = Join-Path $env:ProgramFiles "Windows Defender\MpCmdRun.exe"
  if (-not (Test-Path $mpCmdRun)) {
    Write-BridgeLog "Microsoft Defender (MpCmdRun.exe) nao encontrado - reprovando por seguranca (fail closed)."
    return $false
  }

  & $mpCmdRun -Scan -ScanType 3 -File $FilePath | Out-Null
  $exitCode = $LASTEXITCODE

  if ($exitCode -ne 0) {
    Write-BridgeLog "Microsoft Defender reprovou ou falhou ao escanear (exit code $exitCode)."
    return $false
  }

  return $true
}

function Invoke-BridgePass {
  param([hashtable]$Config)

  $pendingResponse = Invoke-BridgeRequest -Method GET -Path "/api/imebot/bridge/pending" -Config $Config
  if (-not $pendingResponse.ok) {
    Write-BridgeLog "Backend recusou listar pendentes."
    return
  }

  foreach ($file in $pendingResponse.files) {
    Write-BridgeLog "Processando fileId=$($file.fileId) relativePath=$($file.relativePath)"

    if (-not (Test-IsRelativePathSafe -RelativePath $file.relativePath)) {
      Write-BridgeLog "Caminho relativo inseguro recebido do backend - REJEITADO sem tentar gravar: $($file.relativePath)"
      Invoke-BridgeRequest -Method POST -Path "/api/imebot/bridge/reject" -Config $Config -Body @{ fileId = $file.fileId; reason = "Caminho relativo inseguro." } | Out-Null
      continue
    }

    # Combina a base LOCAL (nunca vinda do backend) com o caminho relativo, e confirma que o
    # resultado final continua DENTRO da base - defesa extra alem da checagem de string acima.
    $destination = Join-Path $Config.BasePath $file.relativePath
    $resolvedBase = [System.IO.Path]::GetFullPath($Config.BasePath)
    $resolvedDestination = [System.IO.Path]::GetFullPath($destination)
    if (-not $resolvedDestination.StartsWith($resolvedBase, [System.StringComparison]::OrdinalIgnoreCase)) {
      Write-BridgeLog "Caminho final escapou da pasta base - REJEITADO: $resolvedDestination"
      Invoke-BridgeRequest -Method POST -Path "/api/imebot/bridge/reject" -Config $Config -Body @{ fileId = $file.fileId; reason = "Caminho final fora da pasta base." } | Out-Null
      continue
    }

    if (Test-Path $resolvedDestination) {
      Write-BridgeLog "Arquivo final ja existe - pulando para nao sobrescrever: $resolvedDestination"
      continue
    }

    $tempFile = Join-Path $env:TEMP ("imebot-bridge-{0}.pdf" -f ([guid]::NewGuid()))

    try {
      try {
        Invoke-WebRequest -Method GET -Uri "$($Config.BackendBaseUrl)/api/imebot/bridge/download/$($file.fileId)" `
          -Headers @{ Authorization = "Bearer $($Config.Secret)" } -OutFile $tempFile -TimeoutSec 60 | Out-Null
      } catch {
        Write-BridgeLog "Falha ao baixar fileId=$($file.fileId): $($_.Exception.Message)"
        continue
      }

      $sizeBytes = (Get-Item $tempFile).Length
      $maxSizeBytes = 15MB
      if ($sizeBytes -le 0 -or $sizeBytes -gt $maxSizeBytes) {
        Write-BridgeLog "Tamanho invalido ($sizeBytes bytes) - REJEITADO."
        Invoke-BridgeRequest -Method POST -Path "/api/imebot/bridge/reject" -Config $Config -Body @{ fileId = $file.fileId; reason = "Tamanho invalido." } | Out-Null
        continue
      }

      if (-not (Test-IsRealPdf -FilePath $tempFile)) {
        Write-BridgeLog "Arquivo nao comeca com os magic bytes de PDF (%PDF) - REJEITADO."
        Invoke-BridgeRequest -Method POST -Path "/api/imebot/bridge/reject" -Config $Config -Body @{ fileId = $file.fileId; reason = "Nao e um PDF valido (magic bytes)." } | Out-Null
        continue
      }

      if (-not (Invoke-DefenderScan -FilePath $tempFile)) {
        Invoke-BridgeRequest -Method POST -Path "/api/imebot/bridge/reject" -Config $Config -Body @{ fileId = $file.fileId; reason = "Reprovado pelo Microsoft Defender ou scan indisponivel." } | Out-Null
        continue
      }

      $hash = (Get-FileHash -Path $tempFile -Algorithm SHA256).Hash.ToLower()

      New-Item -ItemType Directory -Force -Path (Split-Path $resolvedDestination -Parent) | Out-Null
      Move-Item -Path $tempFile -Destination $resolvedDestination -Force

      $confirmResponse = Invoke-BridgeRequest -Method POST -Path "/api/imebot/bridge/confirm" -Config $Config -Body @{
        fileId       = $file.fileId
        sha256       = $hash
        sizeBytes    = $sizeBytes
        relativePath = $file.relativePath
      }

      if ($confirmResponse.ok) {
        Write-BridgeLog "Armazenado e confirmado: $resolvedDestination"
      } else {
        Write-BridgeLog "Backend recusou a confirmacao para fileId=$($file.fileId): $($confirmResponse.error)"
      }
    } finally {
      if (Test-Path $tempFile) { Remove-Item $tempFile -Force -ErrorAction SilentlyContinue }
    }
  }
}

try {
  $config = Get-BridgeConfig
  Invoke-BridgePass -Config $config
} catch {
  Write-BridgeLog "Erro fatal nesta passada: $($_.Exception.Message)"
  exit 1
}
