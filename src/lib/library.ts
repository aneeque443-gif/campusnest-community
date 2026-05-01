import { supabase } from "@/integrations/supabase/client";

export type BorrowStatus = "pending" | "approved" | "rejected" | "returned" | "overdue";
export type BookCondition = "new" | "like_new" | "good" | "fair" | "worn";
export type PeerListingStatus = "available" | "lent" | "withdrawn";

export const CONDITION_LABEL: Record<BookCondition, string> = {
  new: "New",
  like_new: "Like new",
  good: "Good",
  fair: "Fair",
  worn: "Worn",
};

export async function uploadBookCover(file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("library-covers").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("library-covers").getPublicUrl(path);
  return data.publicUrl;
}