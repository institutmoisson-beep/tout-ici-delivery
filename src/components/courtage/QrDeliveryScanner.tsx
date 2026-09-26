import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { toast } from "sonner";
import { CheckCircle2, Loader2, ScanLine, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { verifyQrAndReleaseFunds } from "@/lib/courtage";

/**
 * Composant principal du scanner de validation QR côté livreur.
 *
 * Ouvre la caméra arrière du téléphone, décode chaque image en continu
 * (via `jsqr`, aucun appel réseau tant qu'aucun code n'est détecté), et
 * dès qu'un code est lu, appelle `verify_qr_and_release_funds` : c'est
 * cet appel serveur — pas la lecture caméra — qui valide réellement le
 * code et libère les fonds vers le restaurateur et le livreur.
 *
 * Réutilisable pour n'importe quelle commande : ne dépend que de
 * `orderId` (celle assignée au livreur connecté) et de `onReleased`.
 */
export function QrDeliveryScanner({
  orderId,
  onReleased,
}: {
  orderId: string;
  onReleased?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [state, setState] = useState<"idle" | "scanning" | "checking" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function startScanning() {
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState("scanning");
      tick();
    } catch {
      setState("error");
      setErrorMessage("Impossible d'accéder à la caméra. Vérifiez les autorisations de l'appareil.");
    }
  }

  function tick() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "dontInvert" });

    if (code?.data) {
      stopCamera();
      void handleDetected(code.data);
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  async function handleDetected(scanned: string) {
    setState("checking");
    try {
      await verifyQrAndReleaseFunds(orderId, scanned);
      setState("success");
      toast.success("Fonds libérés", { description: "Le restaurateur et vous-même avez été crédités." });
      onReleased?.();
    } catch (e) {
      setState("error");
      setErrorMessage(e instanceof Error ? e.message : "Code invalide ou déjà utilisé.");
    }
  }

  if (state === "success") {
    return (
      <Card className="space-y-3 p-6 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
        <h3 className="text-lg font-semibold">Livraison validée</h3>
        <p className="text-sm text-muted-foreground">Le paiement a été libéré instantanément sur votre portefeuille.</p>
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-6">
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        <ScanLine className="h-5 w-5 text-[#D4AF37]" /> Scanner le code du client
      </h3>

      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-black">
        <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />
        {state === "scanning" ? (
          <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-[#D4AF37]" />
        ) : null}
        {state === "checking" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        ) : null}
      </div>

      {errorMessage ? (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <XCircle className="h-4 w-4" /> {errorMessage}
        </p>
      ) : null}

      {state === "idle" || state === "error" ? (
        <Button className="w-full bg-[#0F0F0F] text-white hover:bg-[#0F0F0F]/90" onClick={() => void startScanning()}>
          Activer la caméra
        </Button>
      ) : null}
    </Card>
  );
}
