
-- Broadcasts (admin announcements)
CREATE TABLE public.broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  target_year student_year,
  target_branch student_branch,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "broadcasts visible" ON public.broadcasts FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins create broadcasts" ON public.broadcasts FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete broadcasts" ON public.broadcasts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Track which user has read which broadcast (for banner dismiss)
CREATE TABLE public.broadcast_reads (
  user_id UUID NOT NULL,
  broadcast_id UUID NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, broadcast_id)
);
ALTER TABLE public.broadcast_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own reads" ON public.broadcast_reads FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Content reports (moderation)
CREATE TABLE public.content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL,
  content_type TEXT NOT NULL, -- 'feed_post' | 'chat_message' | 'gig' | 'lost_found' | 'doubt' | 'note'
  content_id UUID NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open', -- open | resolved | dismissed
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users file reports" ON public.content_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "reporter or admin views" ON public.content_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update reports" ON public.content_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete reports" ON public.content_reports FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- User bans
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_reason TEXT;

-- Allow admins to update any profile (for banning)
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to manage user roles
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
