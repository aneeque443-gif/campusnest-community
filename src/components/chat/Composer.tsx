import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Paperclip, Send, Smile, X, Megaphone } from "lucide-react";
import { toast } from "sonner";
import EmojiPicker, { EmojiStyle } from "emoji-picker-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/chat/use-chat";

const MAX = 10 * 1024 * 1024;

export function Composer({
  roomId,
  subroomId,
  userId,
  replyTo,
  onClearReply,
  canAnnounce,
}: {
  roomId: string;
  subroomId: string | null;
  userId: string;
  replyTo: ChatMessage | null;
  onClearReply: () => void;
  canAnnounce: boolean;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [announcement, setAnnouncement] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function send(att?: { url: string; type: string; name: string }) {
    if (!text.trim() && !att) return;
    setSending(true);
    const { error } = await supabase.from("chat_messages").insert({
      room_id: roomId,
      subroom_id: subroomId,
      sender_id: userId,
      content: text.trim(),
      attachment_url: att?.url ?? null,
      attachment_type: att?.type ?? null,
      attachment_name: att?.name ?? null,
      reply_to: replyTo?.id ?? null,
      is_announcement: announcement,
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setText("");
    setAnnouncement(false);
    onClearReply();
  }

  async function uploadAndSend(file: File) {
    if (file.size > MAX) {
      toast.error("File must be under 10 MB");
      return;
    }
    const ext = file.name.split(".").pop() || "bin";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("chat-attachments").upload(path, file);
    if (upErr) {
      toast.error(upErr.message);
      return;
    }
    const { data } = supabase.storage.from("chat-attachments").getPublicUrl(path);
    await send({ url: data.publicUrl, type: file.type, name: file.name });
  }

  return (
    <div className="border-t bg-background px-3 py-2">
      {replyTo && (
        <div className="mb-2 flex items-start gap-2 rounded-md border-l-2 border-accent bg-muted/50 p-2 text-xs">
          <div className="flex-1 overflow-hidden">
            <p className="font-medium text-accent">Replying</p>
            <p className="truncate text-muted-foreground">{replyTo.content || replyTo.attachment_name}</p>
          </div>
          <button onClick={onClearReply}><X className="h-3 w-3" /></button>
        </div>
      )}
      <div className="flex items-center gap-1">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadAndSend(f);
            e.target.value = "";
          }}
        />
        <Button type="button" size="icon" variant="ghost" onClick={() => fileRef.current?.click()}>
          <Paperclip className="h-4 w-4" />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" size="icon" variant="ghost">
              <Smile className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" side="top" align="start">
            <EmojiPicker
              emojiStyle={EmojiStyle.NATIVE}
              onEmojiClick={(e) => setText((t) => t + e.emoji)}
              height={350}
              width={300}
            />
          </PopoverContent>
        </Popover>
        {canAnnounce && (
          <Button
            type="button"
            size="icon"
            variant={announcement ? "default" : "ghost"}
            onClick={() => setAnnouncement((x) => !x)}
            title="Send as announcement"
            className={cn(announcement && "bg-accent hover:bg-accent/90")}
          >
            <Megaphone className="h-4 w-4" />
          </Button>
        )}
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={announcement ? "Type announcement…" : "Message"}
          disabled={sending}
        />
        <Button type="button" size="icon" onClick={() => send()} disabled={sending || !text.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}