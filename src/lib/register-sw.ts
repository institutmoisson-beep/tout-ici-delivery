// Guarded service-worker registration.
// Never registers in dev, Lovable preview, iframes, or when ?sw=off is set.
const SW_PATH = "/sw.js";

function isBlockedHost(host: string) {
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  return false;
}

export async function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const url = new URL(window.location.href);
  const inIframe = window.self !== window.top;
  const disabled =
    !import.meta.env.PROD ||
    inIframe ||
    isBlockedHost(window.location.hostname) ||
    url.searchParams.get("sw") === "off";

  if (disabled) {
    const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
    await Promise.allSettled(
      regs
        .filter((r) => (r.active?.scriptURL ?? "").endsWith(SW_PATH))
        .map((r) => r.unregister()),
    );
    return;
  }

  try {
    await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
  } catch (err) {
    console.warn("SW registration failed", err);
  }
}