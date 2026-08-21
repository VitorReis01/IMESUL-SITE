const blockedKeys = [
  "authorization",
  "cookie",
  "set-cookie",
  "password",
  "senha",
  "token",
  "secret",
  "meta_whatsapp_token",
  "meta_app_secret",
  "cnpj",
  "cpf",
  "phone",
  "telefone",
  "email",
  "message",
  "whatsapp",
];

const looksSensitive = (key = "") => blockedKeys.some((blocked) => key.toLowerCase().includes(blocked));

export const maskValue = (value) => {
  if (typeof value !== "string") return "[redacted]";
  if (value.length <= 4) return "[redacted]";
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
};

export const sanitizeMonitoringData = (value, depth = 0) => {
  if (depth > 4) return "[redacted]";
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeMonitoringData(item, depth + 1));

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      looksSensitive(key) ? maskValue(entry) : sanitizeMonitoringData(entry, depth + 1),
    ])
  );
};

export const sanitizeSentryEvent = (event) => {
  const next = sanitizeMonitoringData(event);
  if (next?.request?.headers) next.request.headers = sanitizeMonitoringData(next.request.headers);
  if (next?.request?.cookies) next.request.cookies = "[redacted]";
  return next;
};
