export function resolveTemplate(template: string | null | undefined, vars: Record<string, string | number>) {
  if (!template) return "";
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ""));
}

export function encodeQr(text: string, size = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&bgcolor=17-17-17&color=FFFFFF&margin=8`;
}

export const GATEWAY_CATEGORIES = {
  MOBILE_MONEY: "Mobile Money",
  CRYPTO: "Crypto",
  CARD: "Carte bancaire",
  BANK: "Virement bancaire",
} as const;