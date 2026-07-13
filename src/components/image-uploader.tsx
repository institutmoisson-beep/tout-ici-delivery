import { useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { Loader2, Upload, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Props = {
  value?: string | null;
  onChange: (url: string) => void;
  folder?: string;
  label?: string;
  aspect?: "square" | "wide";
};

// One-year signed URL — bucket is private, this is the CDN-friendly path.
const SIGNED_TTL = 60 * 60 * 24 * 365;

export function ImageUploader({ value, onChange, folder = "uploads", label = "Image", aspect = "square" }: Props) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Seuls les fichiers image sont acceptés");
    if (file.size > 20 * 1024 * 1024) return toast.error("Fichier > 20 Mo");
    setUploading(true);
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.35,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        fileType: "image/webp",
        initialQuality: 0.82,
      });
      const ext = "webp";
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("media").upload(path, compressed, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage.from("media").createSignedUrl(path, SIGNED_TTL);
      if (sErr || !signed) throw sErr ?? new Error("URL failed");
      onChange(signed.signedUrl);
      const kb = Math.round(compressed.size / 1024);
      toast.success(`Image optimisée (${kb} Ko)`);
    } catch (err: any) {
      toast.error(err?.message ?? "Échec de l'envoi");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{label}</div>
      <div
        className={`relative rounded-xl border-2 border-dashed border-border/60 bg-secondary/30 overflow-hidden ${aspect === "wide" ? "aspect-[21/9]" : "aspect-square max-w-[180px]"}`}
      >
        {value ? (
          <>
            <img src={value} alt="" className="h-full w-full object-cover" loading="lazy" />
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute top-1 right-1 bg-black/60 rounded-full p-1 text-white hover:bg-black"
              aria-label="Supprimer"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          <div className="h-full w-full grid place-items-center text-muted-foreground text-xs">
            <ImageIcon className="h-6 w-6 opacity-50" />
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
        {uploading ? "Optimisation…" : value ? "Remplacer" : "Téléverser"}
      </Button>
    </div>
  );
}