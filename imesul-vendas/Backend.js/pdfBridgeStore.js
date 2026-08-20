import "server-only";
import { query } from "./db";
import { safeCompare } from "./adminSecurity";
import { isRelativePathSafe, isPdfSizeValid } from "../lib/pdfValidation";

// Persistência do lado backend do IMEbot PDF Bridge (ver relatório desta fase, seção PDF Bridge,
// e o adendo "destino oficial dos PDFs" - Y:\ORC-SITE-IMESUL\). O PDF em si NUNCA passa por
// aqui como bytes armazenados no Postgres (nunca BYTEA) - só metadados, hash e o caminho
// RELATIVO que o Bridge confirma depois de validar/escanear localmente.
//
// Autenticação: Authorization: Bearer <IMEBOT_BRIDGE_SECRET> - NUNCA em query string (evita
// vazar o segredo em logs de acesso/histórico do navegador/proxies). Comparação em tempo
// constante (mesma função usada pela sessão admin).

const getBearerToken = (request) => {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
};

export const isBridgeAuthorized = (request) => {
  const configuredSecret = process.env.IMEBOT_BRIDGE_SECRET;
  if (!configuredSecret) return false;

  const token = getBearerToken(request);
  if (!token) return false;

  return safeCompare(token, configuredSecret);
};

// Lista arquivos aguardando download pelo Bridge. Nunca expõe media_id da Meta ao Bridge - o
// download em si acontece via /api/imebot/bridge/download/[fileId], que usa credenciais Meta
// SERVIDOR-A-SERVIDOR (nunca repassadas ao PC da Bridge).
export const listPendingBridgeFiles = async () => {
  const { rows } = await query(
    `SELECT id, lead_id, relative_path, created_at
       FROM sales_lead_files
      WHERE storage_status = 'PENDING'
      ORDER BY created_at ASC
      LIMIT 50`
  );
  return rows.map((row) => ({ fileId: row.id, leadId: row.lead_id, relativePath: row.relative_path }));
};

export const getBridgeFileById = async (fileId) => {
  const { rows } = await query(
    `SELECT id, lead_id, meta_media_id, mime, storage_status, relative_path
       FROM sales_lead_files WHERE id = $1`,
    [fileId]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    fileId: row.id,
    leadId: row.lead_id,
    metaMediaId: row.meta_media_id,
    mime: row.mime,
    storageStatus: row.storage_status,
    relativePath: row.relative_path,
  };
};

export const markBridgeFileStatus = async (fileId, status) => {
  await query("UPDATE sales_lead_files SET storage_status = $2 WHERE id = $1", [fileId, status]);
};

// Confirmação final do Bridge: o PC já baixou, validou magic bytes/tamanho, escaneou com o
// Microsoft Defender e gravou em Y:\ORC-SITE-IMESUL\<relativePath> (caminho combinado
// LOCALMENTE no PC - o backend nunca escolhe/conhece a base absoluta). Idempotente: chamar de
// novo para um arquivo já STORED não é erro (protege contra retry/reenvio do Bridge).
export const confirmBridgeFileStored = async ({ fileId, sha256, sizeBytes, relativePath }) => {
  if (!/^[0-9a-f]{64}$/i.test(String(sha256 || ""))) {
    return { ok: false, reason: "SHA-256 em formato inválido." };
  }
  if (!isPdfSizeValid(Number(sizeBytes))) {
    return { ok: false, reason: "Tamanho de arquivo inválido." };
  }

  const file = await getBridgeFileById(fileId);
  if (!file) return { ok: false, reason: "Arquivo não encontrado." };

  if (file.storageStatus === "STORED") return { ok: true, alreadyStored: true };
  if (file.storageStatus === "REJECTED") return { ok: false, reason: "Arquivo já foi rejeitado anteriormente." };

  // Defesa em profundidade: o Bridge deve confirmar o MESMO caminho relativo que o backend
  // atribuiu originalmente (nunca aceitamos um caminho diferente vindo da confirmação, mesmo
  // que pareça seguro isoladamente - evita que uma resposta adulterada troque o registro do
  // banco para apontar a um arquivo diferente do que foi realmente validado).
  if (!isRelativePathSafe(relativePath) || relativePath !== file.relativePath) {
    return { ok: false, reason: "Caminho relativo não corresponde ao esperado." };
  }

  await query(
    `UPDATE sales_lead_files
     SET storage_status = 'STORED', sha256 = $2, size_bytes = $3, stored_at = NOW()
     WHERE id = $1`,
    [fileId, sha256.toLowerCase(), Math.round(Number(sizeBytes))]
  );

  return { ok: true, alreadyStored: false };
};

export const rejectBridgeFile = async ({ fileId, reason }) => {
  const file = await getBridgeFileById(fileId);
  if (!file) return { ok: false, reason: "Arquivo não encontrado." };
  if (file.storageStatus === "STORED") return { ok: false, reason: "Arquivo já foi armazenado - não pode ser rejeitado." };

  await query(
    `UPDATE sales_lead_files
     SET storage_status = 'REJECTED', rejected_at = NOW(), rejected_reason = $2
     WHERE id = $1`,
    [fileId, String(reason || "").slice(0, 300)]
  );

  return { ok: true };
};
