import { supabase } from "@/integrations/supabase/client";

function sessionId() {
  let s = sessionStorage.getItem("ti_sid");
  if (!s) {
    s = crypto.randomUUID();
    sessionStorage.setItem("ti_sid", s);
  }
  return s;
}

let uid: string | null = null;
export function setTrackerUser(id: string | null) {
  uid = id;
}

export function track(event: string, path: string, meta?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const device = /Mobi|Android|iPhone/i.test(navigator.userAgent) ? "mobile" : "desktop";
  void supabase
    .from("activity_events")
    .insert({ session_id: sessionId(), user_id: uid, event, path: path.slice(0, 400), meta: (meta ?? null) as any, device })
    .then(() => {});
}
