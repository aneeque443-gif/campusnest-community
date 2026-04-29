
DROP VIEW IF EXISTS public.weekly_leaderboard;
CREATE VIEW public.weekly_leaderboard
  WITH (security_invoker = true) AS
  SELECT
    e.user_id,
    p.full_name,
    p.photo_url,
    p.year,
    p.branch,
    p.level,
    SUM(e.amount)::int AS week_xp
  FROM public.xp_events e
  JOIN public.profiles p ON p.id = e.user_id
  WHERE e.week_start = date_trunc('week', now())::date
  GROUP BY e.user_id, p.full_name, p.photo_url, p.year, p.branch, p.level;
