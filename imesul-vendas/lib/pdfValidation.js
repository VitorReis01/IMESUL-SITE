// Validação PURA de PDF e de caminho relativo (sem I/O) - usada tanto pelo backend (endpoint do
// PDF Bridge, Backend.js/pdfBridgeStore.js) quanto pelo script PowerShell do Bridge (que reimplementa
// a mesma checagem em PowerShell, já que roda fora do Node) e por testes. Nunca confia em
// extensão, Content-Type enviado pelo cliente ou nome original - só nos bytes reais e no tamanho.
const pdfMagicBytes = [0x25, 0x50, 0x44, 0x46]; // "%PDF"
export const maxPdfSizeBytes = 15 * 1024 * 1024; // 15MB - orçamento em PDF nunca deveria passar disso.

// Confere só os primeiros bytes - suficiente para distinguir um PDF real de qualquer outro tipo
// de arquivo renomeado (ex.: .exe renomeado para .pdf nunca começa com "%PDF").
export const hasValidPdfMagicBytes = (bytes) => {
  if (!bytes || bytes.length < pdfMagicBytes.length) return false;
  return pdfMagicBytes.every((expected, index) => bytes[index] === expected);
};

export const isPdfSizeValid = (sizeBytes) =>
  Number.isFinite(sizeBytes) && sizeBytes > 0 && sizeBytes <= maxPdfSizeBytes;

// Mesma checagem já aplicada via CHECK constraint no Postgres (migration 004,
// sales_lead_files_relative_path_safe_check) - repetida aqui em JS puro como defesa em
// profundidade ANTES de qualquer INSERT/UPDATE, e para o Bridge (PowerShell) poder reimplementar
// exatamente a mesma regra. Nunca aceita "..", barra/barra invertida inicial, letra de drive
// (C:, D:, Y:) ou UNC (\\servidor\...) - o caminho relativo vem do backend, mas o Bridge NUNCA
// deve confiar cegamente nisso sem revalidar (o backend pode ter um bug; o Bridge é a última
// linha de defesa antes de gravar no disco real).
export const isRelativePathSafe = (relativePath) => {
  if (typeof relativePath !== "string" || !relativePath.trim()) return false;
  if (relativePath.includes("..")) return false;
  if (/^[/\\]/.test(relativePath)) return false;
  if (/^[A-Za-z]:/.test(relativePath)) return false;
  if (/^\\\\/.test(relativePath)) return false;
  // Só permite os caracteres esperados em um caminho ANO/MES/LEAD-ID/ARQUIVO.pdf sanitizado.
  if (!/^[\w\-./ ÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç]+$/u.test(relativePath)) return false;
  return true;
};

// Gera o nome físico do arquivo a partir do Lead ID e do nome do cliente - NUNCA usa o nome
// original enviado pelo vendedor via WhatsApp (ver relatório desta fase: nome físico sempre
// gerado/sanitizado pelo sistema, nunca confiado do cliente/vendedor).
export const sanitizeFileNameSegment = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "ARQUIVO";

// Estrutura oficial aprovada: ANO/MES/LEAD-ID/ORCAMENTO_NOME.pdf (ver relatório desta fase,
// adendo "destino oficial dos PDFs"). Sempre gerado no servidor - nunca aceito de fora.
export const buildLeadPdfRelativePath = ({ createdAt = new Date(), leadCode, customerName }) => {
  const year = String(createdAt.getFullYear());
  const month = String(createdAt.getMonth() + 1).padStart(2, "0");
  const leadSegment = sanitizeFileNameSegment(leadCode);
  const nameSegment = sanitizeFileNameSegment(customerName) || "CLIENTE";
  const relativePath = `${year}/${month}/${leadSegment}/ORCAMENTO_${nameSegment}.pdf`;

  return isRelativePathSafe(relativePath) ? relativePath : null;
};
