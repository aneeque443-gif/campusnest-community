-- 1. Add class_rep role to enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'class_rep';

-- 2. Storage bucket for chat attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  true,
  10485760,
  ARRAY['image/png','image/jpeg','image/jpg','image/gif','image/webp','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "chat attachments public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-attachments');

CREATE POLICY "chat attachments authenticated upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "chat attachments owner delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 3. Tables
CREATE TYPE public.chat_room_kind AS ENUM ('class', 'open', 'study_group', 'dm');

CREATE TABLE public.chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.chat_room_kind NOT NULL,
  name TEXT NOT NULL,
  year public.student_year,
  branch public.student_branch,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX chat_rooms_class_unique ON public.chat_rooms (year, branch) WHERE kind = 'class';
CREATE UNIQUE INDEX chat_rooms_open_unique ON public.chat_rooms (kind) WHERE kind = 'open';

CREATE TABLE public.chat_subrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, name)
);

CREATE TABLE public.chat_room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);
CREATE INDEX chat_room_members_user_idx ON public.chat_room_members (user_id);

CREATE TABLE public.direct_message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE UNIQUE,
  user_a UUID NOT NULL,
  user_b UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);

CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  subroom_id UUID REFERENCES public.chat_subrooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  attachment_url TEXT,
  attachment_type TEXT,
  attachment_name TEXT,
  reply_to UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_announcement BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_room_created_idx ON public.chat_messages (room_id, subroom_id, created_at DESC);

CREATE TABLE public.chat_message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

-- 4. Helpers
CREATE OR REPLACE FUNCTION public.is_room_member(_room_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.chat_room_members WHERE room_id = _room_id AND user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.can_access_room(_room_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE r public.chat_rooms%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.chat_rooms WHERE id = _room_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF r.kind IN ('class','open') THEN RETURN true; END IF;
  RETURN public.is_room_member(_room_id, _user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.can_post_in_room(_room_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE r public.chat_rooms%ROWTYPE; p public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.chat_rooms WHERE id = _room_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF r.kind = 'open' THEN RETURN true; END IF;
  IF r.kind = 'class' THEN
    IF public.has_role(_user_id, 'teacher') OR public.has_role(_user_id, 'admin') THEN RETURN true; END IF;
    SELECT * INTO p FROM public.profiles WHERE id = _user_id;
    IF NOT FOUND THEN RETURN false; END IF;
    RETURN p.year = r.year AND p.branch = r.branch;
  END IF;
  RETURN public.is_room_member(_room_id, _user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.can_pin_in_room(_room_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF public.has_role(_user_id, 'teacher') OR public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'class_rep') THEN
    RETURN public.can_access_room(_room_id, _user_id);
  END IF;
  RETURN false;
END;
$$;

-- 5. RLS
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_subrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_message_threads ENABLE ROW LEVEL SECURITY;

-- chat_rooms
CREATE POLICY "rooms visible if accessible" ON public.chat_rooms FOR SELECT TO authenticated
  USING (kind IN ('class','open') OR public.is_room_member(id, auth.uid()));
CREATE POLICY "users create study groups and dms" ON public.chat_rooms FOR INSERT TO authenticated
  WITH CHECK (kind IN ('study_group','dm') AND created_by = auth.uid());
CREATE POLICY "creator can update" ON public.chat_rooms FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

-- chat_subrooms
CREATE POLICY "subrooms visible to room viewers" ON public.chat_subrooms FOR SELECT TO authenticated
  USING (public.can_access_room(room_id, auth.uid()));

-- chat_room_members
CREATE POLICY "members visible to room viewers" ON public.chat_room_members FOR SELECT TO authenticated
  USING (public.can_access_room(room_id, auth.uid()));
CREATE POLICY "users insert their own membership" ON public.chat_room_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "users update their own membership" ON public.chat_room_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "users leave their own membership" ON public.chat_room_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- direct_message_threads
CREATE POLICY "dm participants can read" ON public.direct_message_threads FOR SELECT TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY "dm participants can create" ON public.direct_message_threads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);

-- chat_messages
CREATE POLICY "messages visible to room viewers" ON public.chat_messages FOR SELECT TO authenticated
  USING (public.can_access_room(room_id, auth.uid()));
CREATE POLICY "members can post" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.can_post_in_room(room_id, auth.uid())
    AND (NOT is_announcement OR public.has_role(auth.uid(),'teacher') OR public.has_role(auth.uid(),'admin'))
  );
CREATE POLICY "users edit own messages or pinners can pin" ON public.chat_messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid() OR public.can_pin_in_room(room_id, auth.uid()));
CREATE POLICY "users delete own messages or admins" ON public.chat_messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- reactions
CREATE POLICY "reactions visible to room viewers" ON public.chat_message_reactions FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.chat_messages m WHERE m.id = message_id AND public.can_access_room(m.room_id, auth.uid())));
CREATE POLICY "users add own reactions" ON public.chat_message_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS(SELECT 1 FROM public.chat_messages m WHERE m.id = message_id AND public.can_access_room(m.room_id, auth.uid())));
CREATE POLICY "users remove own reactions" ON public.chat_message_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 6. Triggers
CREATE TRIGGER chat_rooms_updated_at BEFORE UPDATE ON public.chat_rooms
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER chat_messages_updated_at BEFORE UPDATE ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto seed sub-rooms when class/open room is created
CREATE OR REPLACE FUNCTION public.seed_chat_subrooms()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kind IN ('class','open') THEN
    INSERT INTO public.chat_subrooms (room_id, name, position) VALUES
      (NEW.id, 'General', 0),
      (NEW.id, 'Doubts', 1),
      (NEW.id, 'Resources', 2),
      (NEW.id, 'Off-topic', 3);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER chat_rooms_seed_subrooms AFTER INSERT ON public.chat_rooms
  FOR EACH ROW EXECUTE FUNCTION public.seed_chat_subrooms();

-- When a profile is created or year/branch changes, ensure membership in their class room
CREATE OR REPLACE FUNCTION public.sync_class_room_membership()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid UUID;
BEGIN
  SELECT id INTO rid FROM public.chat_rooms
    WHERE kind = 'class' AND year = NEW.year AND branch = NEW.branch;
  IF rid IS NOT NULL THEN
    INSERT INTO public.chat_room_members (room_id, user_id) VALUES (rid, NEW.id)
      ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER profiles_sync_class_room AFTER INSERT OR UPDATE OF year, branch ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_class_room_membership();

-- 7. Seed class rooms (one per year+branch) and one open room
INSERT INTO public.chat_rooms (kind, name, year, branch)
SELECT 'class', y.v || '-' || b.v, y.v::public.student_year, b.v::public.student_branch
FROM (VALUES ('FYIT'),('SYIT'),('TYIT')) AS y(v)
CROSS JOIN (VALUES ('IT'),('CS'),('EXTC'),('Mechanical')) AS b(v)
ON CONFLICT DO NOTHING;

INSERT INTO public.chat_rooms (kind, name) VALUES ('open', 'All-Years Open Chat')
ON CONFLICT DO NOTHING;

-- Backfill memberships for existing profiles
INSERT INTO public.chat_room_members (room_id, user_id)
SELECT r.id, p.id
FROM public.profiles p
JOIN public.chat_rooms r ON r.kind='class' AND r.year=p.year AND r.branch=p.branch
ON CONFLICT DO NOTHING;

-- 8. Realtime
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.chat_message_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.chat_room_members REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_room_members;