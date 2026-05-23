
CREATE OR REPLACE FUNCTION public.open_direct_message(other_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  a uuid;
  b uuid;
  existing_room uuid;
  new_room uuid;
  other_name text;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF other_id IS NULL OR other_id = me THEN
    RAISE EXCEPTION 'Invalid target user';
  END IF;

  IF me < other_id THEN a := me; b := other_id; ELSE a := other_id; b := me; END IF;

  SELECT room_id INTO existing_room
  FROM public.direct_message_threads
  WHERE user_a = a AND user_b = b;

  IF existing_room IS NOT NULL THEN
    -- Ensure both memberships exist (idempotent)
    INSERT INTO public.chat_room_members (room_id, user_id)
    VALUES (existing_room, me) ON CONFLICT DO NOTHING;
    INSERT INTO public.chat_room_members (room_id, user_id)
    VALUES (existing_room, other_id) ON CONFLICT DO NOTHING;
    RETURN existing_room;
  END IF;

  SELECT full_name INTO other_name FROM public.profiles WHERE id = other_id;

  INSERT INTO public.chat_rooms (kind, name, created_by)
  VALUES ('dm', COALESCE(other_name, 'Direct Message'), me)
  RETURNING id INTO new_room;

  INSERT INTO public.direct_message_threads (room_id, user_a, user_b)
  VALUES (new_room, a, b);

  INSERT INTO public.chat_room_members (room_id, user_id) VALUES (new_room, me);
  INSERT INTO public.chat_room_members (room_id, user_id) VALUES (new_room, other_id);

  RETURN new_room;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_direct_message(uuid) TO authenticated;
