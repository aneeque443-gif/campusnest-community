
REVOKE EXECUTE ON FUNCTION public.ensure_my_quests() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.bump_lecvault_browse(integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.ensure_daily_quests(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.bump_quest(uuid, text, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.evaluate_badges(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.log_xp(uuid, text, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.ensure_my_quests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.bump_lecvault_browse(integer) TO authenticated;
