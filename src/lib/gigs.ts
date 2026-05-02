import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Gig = Database["public"]["Tables"]["gigs"]["Row"];
export type GigOrder = Database["public"]["Tables"]["gig_orders"]["Row"];
export type GigReview = Database["public"]["Tables"]["gig_reviews"]["Row"];
export const GIG_CATEGORIES = ["Design","Coding","Writing","Video","Tutoring","Photography","Other"] as const;
export type GigCategory = typeof GIG_CATEGORIES[number];

export async function uploadGigImage(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("gig-images").upload(path, file);
  if (error) throw error;
  return supabase.storage.from("gig-images").getPublicUrl(path).data.publicUrl;
}

export async function uploadLfImage(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("lost-found").upload(path, file);
  if (error) throw error;
  return supabase.storage.from("lost-found").getPublicUrl(path).data.publicUrl;
}
