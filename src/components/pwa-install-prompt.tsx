import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "touticci-pwa-dismissed-at";
const DISMISS_DAYS = 7;

function wasDismissedRecently() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const age = Date.now() - Number(raw);
    return age < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS
    window.navigator.standalone === true
  );
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !("MSStream" in window);
}

export function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone() || wasDismissedRecently()) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    // iOS Safari: no BIP event — show a manual hint.
    if (isIOS()) {
      setIos(true);
      const t = setTimeout(() => setShow(true), 2500);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onBIP);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setShow(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md rounded-2xl border border-primary/30 bg-charcoal/95 backdrop-blur shadow-elegant p-4 flex items-center gap-3 animate-in slide-in-from-bottom-4">
      <img src="/pwa-192.png" alt="" width={44} height={44} className="rounded-xl" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">Installer Tout'ICI</p>
        <p className="text-xs text-muted-foreground truncate">
          {ios
            ? "Appuyez sur Partager puis « Sur l'écran d'accueil »"
            : "Accès instantané depuis votre écran d'accueil"}
        </p>
      </div>
      {!ios && deferred && (
        <Button size="sm" onClick={install} className="bg-gradient-primary border-0">
          <Download className="h-4 w-4 mr-1" /> Installer
        </Button>
      )}
      <button onClick={dismiss} aria-label="Fermer" className="p-1 text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}