
-- ============ XP EVENTS (for leaderboard) ============
CREATE TABLE public.xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  amount integer NOT NULL,
  week_start date NOT NULL DEFAULT date_trunc('week', now())::date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_xp_events_week ON public.xp_events(week_start, user_id);
CREATE INDEX idx_xp_events_user ON public.xp_events(user_id, created_at DESC);
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "xp events visible to authed" ON public.xp_events
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "users insert own xp events" ON public.xp_events
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ============ DAILY QUESTS ============
CREATE TABLE public.daily_quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  quest_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  quest_key text NOT NULL,
  title text NOT NULL,
  target integer NOT NULL DEFAULT 1,
  progress integer NOT NULL DEFAULT 0,
  xp_reward integer NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  bonus_awarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, quest_date, quest_key)
);
CREATE INDEX idx_daily_quests_user_date ON public.daily_quests(user_id, quest_date);
ALTER TABLE public.daily_quests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own quests" ON public.daily_quests
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users insert own quests" ON public.daily_quests
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "users update own quests" ON public.daily_quests
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- ============ USER BADGES ============
CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_key text NOT NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_key)
);
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "badges visible to authed" ON public.user_badges
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "users insert own badges" ON public.user_badges
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ============ DM PARTNERS (for Social Butterfly) ============
CREATE TABLE public.dm_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  partner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, partner_id)
);
ALTER TABLE public.dm_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own partners" ON public.dm_partners
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users insert own partners" ON public.dm_partners
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ============ ADD STREAK TRACKING TO PROFILES ============
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_quest_date date;

-- ============ HELPER: compute level from xp ============
CREATE OR REPLACE FUNCTION public.compute_level(_xp integer)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _xp >= 700 THEN 'Legend'
    WHEN _xp >= 300 THEN 'Scholar'
    WHEN _xp >= 100 THEN 'Active'
    ELSE 'Beginner'
  END
$$;

-- ============ HELPER: log XP event + auto-update level ============
CREATE OR REPLACE FUNCTION public.log_xp(_user_id uuid, _kind text, _amount integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _amount = 0 OR _user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.xp_events (user_id, kind, amount, week_start)
    VALUES (_user_id, _kind, _amount, date_trunc('week', now())::date);
END; $$;

-- Sync profile.level whenever xp changes
CREATE OR REPLACE FUNCTION public.sync_profile_level()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.level := public.compute_level(NEW.xp);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_sync_profile_level ON public.profiles;
CREATE TRIGGER trg_sync_profile_level BEFORE INSERT OR UPDATE OF xp ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_level();

-- Backfill existing profiles
UPDATE public.profiles SET level = public.compute_level(xp);

-- ============ QUEST POOL & SEEDING ============
CREATE OR REPLACE FUNCTION public.ensure_daily_quests(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  today date := (now() AT TIME ZONE 'UTC')::date;
  existing int;
  pool jsonb := '[
    {"k":"upload_note","t":"Upload 1 note today","g":1,"x":15},
    {"k":"upvote_notes","t":"Upvote 3 notes","g":3,"x":10},
    {"k":"chat_message","t":"Send a message in class chat","g":1,"x":5},
    {"k":"senior_answer","t":"Answer 1 question in SeniorDesk","g":1,"x":20},
    {"k":"post_doubt","t":"Post 1 anonymous doubt","g":1,"x":5},
    {"k":"browse_lecvault","t":"Browse LecVault for 5 minutes","g":5,"x":10},
    {"k":"new_dm","t":"Connect with 1 new student via DM","g":1,"x":10},
    {"k":"bookmark_notes","t":"Bookmark 2 notes","g":2,"x":5}
  ]'::jsonb;
  picked jsonb;
  q jsonb;
BEGIN
  SELECT count(*) INTO existing FROM public.daily_quests
    WHERE user_id = _user_id AND quest_date = today;
  IF existing > 0 THEN RETURN; END IF;

  -- Pick 4 random quests deterministically per user/day
  SELECT jsonb_agg(item) INTO picked FROM (
    SELECT item FROM jsonb_array_elements(pool) item
    ORDER BY md5(_user_id::text || today::text || (item->>'k'))
    LIMIT 4
  ) s;

  FOR q IN SELECT * FROM jsonb_array_elements(picked) LOOP
    INSERT INTO public.daily_quests (user_id, quest_date, quest_key, title, target, xp_reward)
    VALUES (_user_id, today, q->>'k', q->>'t', (q->>'g')::int, (q->>'x')::int)
    ON CONFLICT DO NOTHING;
  END LOOP;
END; $$;

-- ============ QUEST PROGRESS + STREAK + BONUS ============
CREATE OR REPLACE FUNCTION public.bump_quest(_user_id uuid, _quest_key text, _by integer DEFAULT 1)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  today date := (now() AT TIME ZONE 'UTC')::date;
  q public.daily_quests%ROWTYPE;
  done_count int;
  bonus_already boolean;
  prev_date date;
  new_streak int;
BEGIN
  PERFORM public.ensure_daily_quests(_user_id);
  SELECT * INTO q FROM public.daily_quests
    WHERE user_id = _user_id AND quest_date = today AND quest_key = _quest_key;
  IF NOT FOUND THEN RETURN; END IF;
  IF q.completed THEN RETURN; END IF;

  UPDATE public.daily_quests
    SET progress = LEAST(progress + _by, target),
        completed = (LEAST(progress + _by, target) >= target)
    WHERE id = q.id
    RETURNING completed INTO bonus_already;

  -- If just completed, award xp_reward
  IF bonus_already THEN
    UPDATE public.profiles SET xp = xp + q.xp_reward WHERE id = _user_id;
    PERFORM public.log_xp(_user_id, 'quest:' || q.quest_key, q.xp_reward);

    -- Streak update (once per day, on first completion)
    SELECT last_quest_date INTO prev_date FROM public.profiles WHERE id = _user_id;
    IF prev_date IS DISTINCT FROM today THEN
      IF prev_date = today - 1 THEN
        new_streak := COALESCE((SELECT streak FROM public.profiles WHERE id = _user_id), 0) + 1;
      ELSE
        new_streak := 1;
      END IF;
      UPDATE public.profiles SET streak = new_streak, last_quest_date = today WHERE id = _user_id;

      IF new_streak >= 7 THEN
        INSERT INTO public.user_badges (user_id, badge_key) VALUES (_user_id, 'streak_master')
          ON CONFLICT DO NOTHING;
      END IF;
    END IF;

    -- 4/4 bonus
    SELECT count(*) INTO done_count FROM public.daily_quests
      WHERE user_id = _user_id AND quest_date = today AND completed = true;
    IF done_count >= 4 THEN
      IF NOT EXISTS (SELECT 1 FROM public.daily_quests
                     WHERE user_id = _user_id AND quest_date = today AND bonus_awarded = true) THEN
        UPDATE public.profiles SET xp = xp + 25 WHERE id = _user_id;
        PERFORM public.log_xp(_user_id, 'quest:all_done_bonus', 25);
        UPDATE public.daily_quests SET bonus_awarded = true
          WHERE user_id = _user_id AND quest_date = today;
      END IF;
    END IF;
  END IF;
END; $$;

-- ============ BADGE EVALUATION ============
CREATE OR REPLACE FUNCTION public.evaluate_badges(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  notes_n int;
  ans_n int;
  posts_n int;
  upvotes_recv int;
  dm_n int;
BEGIN
  SELECT count(*) INTO notes_n FROM public.notes WHERE uploader_id = _user_id;
  IF notes_n >= 1 THEN
    INSERT INTO public.user_badges(user_id,badge_key) VALUES(_user_id,'first_post') ON CONFLICT DO NOTHING;
  END IF;
  IF notes_n >= 10 THEN
    INSERT INTO public.user_badges(user_id,badge_key) VALUES(_user_id,'note_sharer') ON CONFLICT DO NOTHING;
  END IF;
  IF notes_n >= 25 THEN
    INSERT INTO public.user_badges(user_id,badge_key) VALUES(_user_id,'knowledge_king') ON CONFLICT DO NOTHING;
  END IF;

  SELECT count(*) INTO ans_n FROM public.senior_answers WHERE answerer_id = _user_id;
  IF ans_n >= 20 THEN
    INSERT INTO public.user_badges(user_id,badge_key) VALUES(_user_id,'helpful_senior') ON CONFLICT DO NOTHING;
  END IF;

  SELECT count(*) INTO posts_n FROM public.feed_posts WHERE author_id = _user_id;
  IF posts_n >= 3 THEN
    INSERT INTO public.user_badges(user_id,badge_key) VALUES(_user_id,'reporter') ON CONFLICT DO NOTHING;
  END IF;

  SELECT COALESCE(SUM(upvote_count),0) INTO upvotes_recv FROM public.notes WHERE uploader_id = _user_id;
  IF upvotes_recv >= 100 THEN
    INSERT INTO public.user_badges(user_id,badge_key) VALUES(_user_id,'community_star') ON CONFLICT DO NOTHING;
  END IF;

  SELECT count(*) INTO dm_n FROM public.dm_partners WHERE user_id = _user_id;
  IF dm_n >= 10 THEN
    INSERT INTO public.user_badges(user_id,badge_key) VALUES(_user_id,'social_butterfly') ON CONFLICT DO NOTHING;
  END IF;
END; $$;

-- ============ TRIGGERS ON EXISTING TABLES ============
-- Notes upload
CREATE OR REPLACE FUNCTION public.on_note_insert_quest()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.bump_quest(NEW.uploader_id, 'upload_note', 1);
  PERFORM public.log_xp(NEW.uploader_id, 'note_upload', 15);
  PERFORM public.evaluate_badges(NEW.uploader_id);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_note_insert_quest ON public.notes;
CREATE TRIGGER trg_note_insert_quest AFTER INSERT ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.on_note_insert_quest();

-- Note upvote (given)
CREATE OR REPLACE FUNCTION public.on_note_upvote_quest()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uploader uuid;
BEGIN
  PERFORM public.bump_quest(NEW.user_id, 'upvote_notes', 1);
  SELECT uploader_id INTO uploader FROM public.notes WHERE id = NEW.note_id;
  IF uploader IS NOT NULL THEN
    PERFORM public.evaluate_badges(uploader);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_note_upvote_quest ON public.note_upvotes;
CREATE TRIGGER trg_note_upvote_quest AFTER INSERT ON public.note_upvotes
  FOR EACH ROW EXECUTE FUNCTION public.on_note_upvote_quest();

-- Note bookmark
CREATE OR REPLACE FUNCTION public.on_bookmark_quest()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.bump_quest(NEW.user_id, 'bookmark_notes', 1);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_bookmark_quest ON public.note_bookmarks;
CREATE TRIGGER trg_bookmark_quest AFTER INSERT ON public.note_bookmarks
  FOR EACH ROW EXECUTE FUNCTION public.on_bookmark_quest();

-- Chat message (class room only)
CREATE OR REPLACE FUNCTION public.on_chat_msg_quest()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k chat_room_kind; partner uuid;
BEGIN
  SELECT kind INTO k FROM public.chat_rooms WHERE id = NEW.room_id;
  IF k = 'class' THEN
    PERFORM public.bump_quest(NEW.sender_id, 'chat_message', 1);
  END IF;
  IF k = 'dm' THEN
    SELECT CASE WHEN user_a = NEW.sender_id THEN user_b ELSE user_a END INTO partner
      FROM public.direct_message_threads WHERE room_id = NEW.room_id;
    IF partner IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.dm_partners WHERE user_id = NEW.sender_id AND partner_id = partner) THEN
        INSERT INTO public.dm_partners(user_id, partner_id) VALUES (NEW.sender_id, partner)
          ON CONFLICT DO NOTHING;
        PERFORM public.bump_quest(NEW.sender_id, 'new_dm', 1);
        PERFORM public.evaluate_badges(NEW.sender_id);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_chat_msg_quest ON public.chat_messages;
CREATE TRIGGER trg_chat_msg_quest AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.on_chat_msg_quest();

-- SeniorDesk answer
CREATE OR REPLACE FUNCTION public.on_senior_answer_quest()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.bump_quest(NEW.answerer_id, 'senior_answer', 1);
  PERFORM public.evaluate_badges(NEW.answerer_id);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_senior_answer_quest ON public.senior_answers;
CREATE TRIGGER trg_senior_answer_quest AFTER INSERT ON public.senior_answers
  FOR EACH ROW EXECUTE FUNCTION public.on_senior_answer_quest();

-- Anonymous doubt
CREATE OR REPLACE FUNCTION public.on_doubt_quest()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.bump_quest(NEW.author_id, 'post_doubt', 1);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_doubt_quest ON public.doubts;
CREATE TRIGGER trg_doubt_quest AFTER INSERT ON public.doubts
  FOR EACH ROW EXECUTE FUNCTION public.on_doubt_quest();

-- Feed post (for reporter badge)
CREATE OR REPLACE FUNCTION public.on_feed_post_badge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.evaluate_badges(NEW.author_id);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_feed_post_badge ON public.feed_posts;
CREATE TRIGGER trg_feed_post_badge AFTER INSERT ON public.feed_posts
  FOR EACH ROW EXECUTE FUNCTION public.on_feed_post_badge();

-- ============ PUBLIC RPC: ensure quests for current user ============
CREATE OR REPLACE FUNCTION public.ensure_my_quests()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  PERFORM public.ensure_daily_quests(auth.uid());
END; $$;

-- ============ PUBLIC RPC: bump LecVault browse minutes ============
CREATE OR REPLACE FUNCTION public.bump_lecvault_browse(_minutes integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  PERFORM public.bump_quest(auth.uid(), 'browse_lecvault', GREATEST(_minutes, 0));
END; $$;

-- ============ WEEKLY LEADERBOARD VIEW ============
CREATE OR REPLACE VIEW public.weekly_leaderboard AS
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
