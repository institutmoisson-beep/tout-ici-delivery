import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { setTrackerUser, track } from "@/lib/tracker";

export function ActivityTracker() {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.searchStr });

  useEffect(() => setTrackerUser(user?.id ?? null), [user?.id]);

  useEffect(() => {
    track("page_view", pathname);
    const q = new URLSearchParams(search).get("q");
    if (q) track("search", pathname, { q });
  }, [pathname, search, user?.id]);

  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") track("heartbeat", window.location.pathname);
    }, 60000);
    return () => clearInterval(t);
  }, []);

  return null;
}
