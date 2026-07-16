import { Share2, MessageCircle, Facebook, Twitter, Copy, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  url: string;
  text: string;
  title?: string;
  imageUrl?: string | null;
  size?: "sm" | "icon";
  variant?: "ghost" | "outline";
  label?: string;
  stopPropagation?: boolean;
};

export function ShareMenu({ url, text, title, imageUrl, size = "icon", variant = "ghost", label, stopPropagation }: Props) {
  const nativeShare = async () => {
    try {
      let files: File[] | undefined;
      if (imageUrl) {
        try {
          const res = await fetch(imageUrl);
          const blob = await res.blob();
          const f = new File([blob], "plat.webp", { type: blob.type || "image/webp" });
          if ((navigator as any).canShare?.({ files: [f] })) files = [f];
        } catch {}
      }
      const data: any = { title, text, url };
      if (files) data.files = files;
      await (navigator as any).share(data);
    } catch (err: any) {
      if (err?.name !== "AbortError") toast.error("Partage impossible");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast.success("Lien copié !");
    } catch {
      toast.error("Impossible de copier");
    }
  };

  const stop = (e: React.MouseEvent) => {
    if (stopPropagation) {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  const wa = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;
  const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  const tw = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  const canNative = typeof navigator !== "undefined" && !!(navigator as any).share;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={stop}>
        <Button
          size={size}
          variant={variant}
          aria-label="Partager"
          className={size === "icon" ? "h-8 w-8" : undefined}
        >
          <Share2 className="h-4 w-4" />
          {label && <span className="ml-2">{label}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52" onClick={stop}>
        {canNative && (
          <DropdownMenuItem onClick={(e) => { stop(e); nativeShare(); }}>
            <Send className="mr-2 h-4 w-4" />Partager… (Instagram, TikTok)
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <a href={wa} target="_blank" rel="noopener noreferrer" onClick={stop}>
            <MessageCircle className="mr-2 h-4 w-4" />WhatsApp
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={fb} target="_blank" rel="noopener noreferrer" onClick={stop}>
            <Facebook className="mr-2 h-4 w-4" />Facebook
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={tw} target="_blank" rel="noopener noreferrer" onClick={stop}>
            <Twitter className="mr-2 h-4 w-4" />X (Twitter)
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { stop(e); copy(); }}>
          <Copy className="mr-2 h-4 w-4" />Copier le lien
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}