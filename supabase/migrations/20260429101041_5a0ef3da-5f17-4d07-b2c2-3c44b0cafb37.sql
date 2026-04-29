
CREATE TYPE public.room_slot AS ENUM ('9-11', '11-13', '14-16', '16-18');

CREATE TABLE public.study_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  capacity integer NOT NULL DEFAULT 4,
  location text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.study_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms visible" ON public.study_rooms
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage rooms" ON public.study_rooms
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.study_room_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.study_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  booking_date date NOT NULL,
  slot public.room_slot NOT NULL,
  purpose text NOT NULL DEFAULT '',
  party_size integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'confirmed',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_room_unique_slot
  ON public.study_room_bookings(room_id, booking_date, slot)
  WHERE status = 'confirmed';
CREATE INDEX idx_bookings_user ON public.study_room_bookings(user_id, booking_date DESC);
ALTER TABLE public.study_room_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookings visible to authed" ON public.study_room_bookings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "users book own" ON public.study_room_bookings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND booking_date >= CURRENT_DATE);
CREATE POLICY "owner or admin updates" ON public.study_room_bookings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner or admin deletes" ON public.study_room_bookings
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.on_booking_xp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET xp = xp + 10 WHERE id = NEW.user_id;
  PERFORM public.log_xp(NEW.user_id, 'room_booking', 10);
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_booking_xp AFTER INSERT ON public.study_room_bookings
  FOR EACH ROW EXECUTE FUNCTION public.on_booking_xp();

CREATE TYPE public.notice_category AS ENUM ('Exam', 'Assignment', 'Class change', 'Event', 'General');
CREATE TYPE public.notice_urgency AS ENUM ('Normal', 'Urgent');

CREATE TABLE public.notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  category public.notice_category NOT NULL DEFAULT 'General',
  urgency public.notice_urgency NOT NULL DEFAULT 'Normal',
  target_year public.student_year,
  target_branch public.student_branch,
  attachment_url text,
  attachment_name text,
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notices_created ON public.notices(created_at DESC);
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notices visible" ON public.notices
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "teachers post notices" ON public.notices
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin'))
  );
CREATE POLICY "author or admin updates notices" ON public.notices
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "author or admin deletes notices" ON public.notices
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_notices_updated_at BEFORE UPDATE ON public.notices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public) VALUES ('notice-files', 'notice-files', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "notice files readable" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'notice-files');
CREATE POLICY "teachers upload notice files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'notice-files'
    AND (public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin'))
  );
CREATE POLICY "author or admin deletes notice files" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'notice-files'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'))
  );
