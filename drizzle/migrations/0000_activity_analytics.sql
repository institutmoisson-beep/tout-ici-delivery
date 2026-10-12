CREATE TABLE public.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  session_id text NOT NULL,
  event text NOT NULL DEFAULT 'page_view',
  path text NOT NULL,
  meta jsonb,
  device text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_events_created_idx ON public.activity_events(created_at DESC);
CREATE INDEX activity_events_user_idx ON public.activity_events(user_id, created_at DESC);
GRANT INSERT ON public.activity_events TO anon, authenticated;
GRANT SELECT ON public.activity_events TO authenticated;
GRANT ALL ON public.activity_events TO service_role;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insert own events" ON public.activity_events FOR INSERT TO anon, authenticated
  WITH CHECK ((user_id IS NULL OR user_id = auth.uid()) AND length(path) < 500 AND length(session_id) < 100);
CREATE POLICY "admin reads events" ON public.activity_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.admin_analytics_summary()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  SELECT jsonb_build_object(
    'live', (SELECT count(DISTINCT session_id) FROM activity_events WHERE created_at > now() - interval '2 minutes'),
    'live_users', (SELECT count(DISTINCT user_id) FROM activity_events WHERE created_at > now() - interval '2 minutes' AND user_id IS NOT NULL),
    'day', (SELECT count(DISTINCT session_id) FROM activity_events WHERE created_at > date_trunc('day', now())),
    'week', (SELECT count(DISTINCT session_id) FROM activity_events WHERE created_at > date_trunc('week', now())),
    'month', (SELECT count(DISTINCT session_id) FROM activity_events WHERE created_at > date_trunc('month', now())),
    'year', (SELECT count(DISTINCT session_id) FROM activity_events WHERE created_at > date_trunc('year', now())),
    'views_day', (SELECT count(*) FROM activity_events WHERE event='page_view' AND created_at > date_trunc('day', now())),
    'new_users_day', (SELECT count(*) FROM profiles WHERE created_at > date_trunc('day', now())),
    'new_users_month', (SELECT count(*) FROM profiles WHERE created_at > date_trunc('month', now())),
    'total_users', (SELECT count(*) FROM profiles),
    'orders_day', (SELECT count(*) FROM orders WHERE created_at > date_trunc('day', now())),
    'revenue_month', (SELECT COALESCE(sum(total_amount),0) FROM orders WHERE status <> 'CANCELLED' AND created_at > date_trunc('month', now())),
    'mobile_share', (SELECT COALESCE(round(100.0*count(*) FILTER (WHERE device='mobile')/NULLIF(count(*),0)),0) FROM activity_events WHERE created_at > now() - interval '30 days'),
    'top_pages', (SELECT COALESCE(jsonb_agg(t),'[]') FROM (SELECT path, count(*) AS views, count(DISTINCT session_id) AS visitors FROM activity_events WHERE event='page_view' AND created_at > now() - interval '30 days' GROUP BY path ORDER BY views DESC LIMIT 15) t),
    'searches', (SELECT COALESCE(jsonb_agg(t),'[]') FROM (SELECT meta->>'q' AS q, count(*) AS n FROM activity_events WHERE event='search' AND created_at > now() - interval '30 days' GROUP BY 1 ORDER BY n DESC LIMIT 15) t),
    'daily', (SELECT COALESCE(jsonb_agg(t ORDER BY t.d),'[]') FROM (SELECT date_trunc('day',created_at)::date AS d, count(DISTINCT session_id) AS visitors, count(*) FILTER (WHERE event='page_view') AS views FROM activity_events WHERE created_at > now() - interval '14 days' GROUP BY 1) t),
    'recent', (SELECT COALESCE(jsonb_agg(t),'[]') FROM (SELECT e.created_at, e.event, e.path, e.meta, e.user_id, e.device, p.full_name FROM activity_events e LEFT JOIN profiles p ON p.id=e.user_id WHERE e.event <> 'heartbeat' ORDER BY e.created_at DESC LIMIT 60) t)
  ) INTO r;
  RETURN r;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_analytics_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_analytics_summary() TO authenticated;