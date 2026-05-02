
-- Enums
CREATE TYPE public.gig_category AS ENUM ('Design','Coding','Writing','Video','Tutoring','Photography','Other');
CREATE TYPE public.gig_order_status AS ENUM ('pending','accepted','in_progress','completed','cancelled');
CREATE TYPE public.lost_found_kind AS ENUM ('lost','found');
CREATE TYPE public.lost_found_status AS ENUM ('open','resolved');

-- Gigs
CREATE TABLE public.gigs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category public.gig_category NOT NULL DEFAULT 'Other',
  price_inr INTEGER NOT NULL DEFAULT 0,
  delivery_days INTEGER NOT NULL DEFAULT 3,
  cover_image TEXT,
  sample_images TEXT[] NOT NULL DEFAULT '{}',
  skill_tags TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  rating_avg NUMERIC NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gigs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gigs visible" ON public.gigs FOR SELECT TO authenticated USING (true);
CREATE POLICY "users create own gigs" ON public.gigs FOR INSERT TO authenticated WITH CHECK (seller_id = auth.uid());
CREATE POLICY "owner updates own gig" ON public.gigs FOR UPDATE TO authenticated USING (seller_id = auth.uid());
CREATE POLICY "owner or admin deletes gig" ON public.gigs FOR DELETE TO authenticated USING (seller_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_gigs_updated BEFORE UPDATE ON public.gigs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Gig orders
CREATE TABLE public.gig_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gig_id UUID NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  status public.gig_order_status NOT NULL DEFAULT 'pending',
  room_id UUID,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gig_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parties view own gig orders" ON public.gig_orders FOR SELECT TO authenticated USING (buyer_id = auth.uid() OR seller_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "buyer creates order" ON public.gig_orders FOR INSERT TO authenticated WITH CHECK (buyer_id = auth.uid());
CREATE POLICY "parties update order" ON public.gig_orders FOR UPDATE TO authenticated USING (buyer_id = auth.uid() OR seller_id = auth.uid());
CREATE TRIGGER trg_gig_orders_updated BEFORE UPDATE ON public.gig_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Gig reviews
CREATE TABLE public.gig_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gig_id UUID NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.gig_orders(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(order_id)
);
ALTER TABLE public.gig_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gig reviews visible" ON public.gig_reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "buyer reviews completed order" ON public.gig_reviews FOR INSERT TO authenticated WITH CHECK (
  buyer_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.gig_orders o WHERE o.id = order_id AND o.buyer_id = auth.uid() AND o.status = 'completed'
  )
);
CREATE POLICY "buyer or admin deletes review" ON public.gig_reviews FOR DELETE TO authenticated USING (buyer_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- Trigger: posting a gig => +10 XP
CREATE OR REPLACE FUNCTION public.on_gig_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET xp = xp + 10 WHERE id = NEW.seller_id;
  PERFORM public.log_xp(NEW.seller_id, 'gig_post', 10);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_gig_insert AFTER INSERT ON public.gigs FOR EACH ROW EXECUTE FUNCTION public.on_gig_insert();

-- Trigger: completing an order increments seller completed_count
CREATE OR REPLACE FUNCTION public.on_gig_order_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    NEW.completed_at := COALESCE(NEW.completed_at, now());
    UPDATE public.gigs SET completed_count = completed_count + 1 WHERE id = NEW.gig_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_gig_order_status BEFORE UPDATE ON public.gig_orders FOR EACH ROW EXECUTE FUNCTION public.on_gig_order_status();

-- Trigger: review updates avg + awards XP if 4+ stars
CREATE OR REPLACE FUNCTION public.on_gig_review()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.gigs
    SET rating_avg = COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM public.gig_reviews WHERE gig_id = NEW.gig_id), 0),
        rating_count = (SELECT count(*) FROM public.gig_reviews WHERE gig_id = NEW.gig_id)
    WHERE id = NEW.gig_id;
  IF NEW.rating >= 4 THEN
    UPDATE public.profiles SET xp = xp + 40 WHERE id = NEW.seller_id;
    PERFORM public.log_xp(NEW.seller_id, 'gig_complete_4plus', 40);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_gig_review AFTER INSERT ON public.gig_reviews FOR EACH ROW EXECUTE FUNCTION public.on_gig_review();

-- Lost & Found
CREATE TABLE public.lost_found_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poster_id UUID NOT NULL,
  kind public.lost_found_kind NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  photo_url TEXT,
  location TEXT NOT NULL DEFAULT '',
  occurred_on DATE,
  status public.lost_found_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lost_found_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lf visible" ON public.lost_found_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "users post lf" ON public.lost_found_items FOR INSERT TO authenticated WITH CHECK (poster_id = auth.uid());
CREATE POLICY "poster or admin updates lf" ON public.lost_found_items FOR UPDATE TO authenticated USING (poster_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "poster or admin deletes lf" ON public.lost_found_items FOR DELETE TO authenticated USING (poster_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_lf_updated BEFORE UPDATE ON public.lost_found_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('gig-images','gig-images', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('lost-found','lost-found', true) ON CONFLICT DO NOTHING;

CREATE POLICY "gig images public read" ON storage.objects FOR SELECT USING (bucket_id = 'gig-images');
CREATE POLICY "users upload own gig images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'gig-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users delete own gig images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'gig-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "lf images public read" ON storage.objects FOR SELECT USING (bucket_id = 'lost-found');
CREATE POLICY "users upload own lf images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'lost-found' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users delete own lf images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'lost-found' AND auth.uid()::text = (storage.foldername(name))[1]);
