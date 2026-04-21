import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pin, Reply, SmilePlus, Trash2, Megaphone, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage, Reaction, Profile } from "@/lib/chat/use-chat";

const QUICK_EMOJI = ["👍", "❤️", "😂", "🎉", "🤔", "🔥"];

export function MessageItem({
  message,
  sender,
  replyTarget,
  replyTargetSender,
  reactions,
  currentUserId,
  canPin,
  onReply,
}: {
  message: ChatMessage;
  sender?: Pick<Profile, "id" | "full_name" | "photo_url">;
  replyTarget: ChatMessage | null;
  replyTargetSender?: Pick<Profile, "id" | "full_name" | "photo_url">;
  reactions: Reaction[];
  currentUserId: string;
  canPin: boolean;
  onReply: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isImage = message.attachment_type?.startsWith("image/");
  const grouped = reactions.reduce<Record<string, { count: number; mine: boolean; id: string }>>((acc, r) => {
    const cur = acc[r.emoji] ?? { count: 0, mine: false, id: "" };
    cur.count++;
    if (r.user_id === currentUserId) {
      cur.mine = true;
      cur.id = r.id;
    }
    acc[r.emoji] = cur;
    return acc;
  }, {});

  async function toggleReaction(emoji: string) {
    const existing = reactions.find((r) => r.user_id === currentUserId && r.emoji === emoji);
    if (existing) await supabase.from("chat_message_reactions").delete().eq("id", existing.id);
    else await supabase.from("chat_message_reactions").insert({ message_id: message.id, user_id: currentUserId, emoji });
  }
  async function togglePin() {
    await supabase.from("chat_messages").update({ is_pinned: !message.is_pinned }).eq("id", message.id);
  }
  async function del() {
    if (confirm("Delete this message?")) await supabase.from("chat_messages").delete().eq("id", message.id);
  }

  return (
    <div
      className={cn(
        "group flex gap-2",
        message.is_announcement && "rounded-md border border-accent/40 bg-accent/10 p-2",
      )}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenuOpen(true);
      }}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={sender?.photo_url ?? undefined} />
        <AvatarFallback>{sender?.full_name?.[0] ?? "?"}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">{sender?.full_name ?? "Unknown"}</span>
          {message.is_announcement && (
            <span className="inline-flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent-foreground">
              <Megaphone className="h-3 w-3" /> Announcement
            </span>
          )}
          {message.is_pinned && <Pin className="h-3 w-3 text-accent" />}
          <span className="text-[10px] text-muted-foreground">
            {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          <div className="ml-auto opacity-0 transition-opacity group-hover:opacity-100">
            <Popover>
              <PopoverTrigger asChild>
                <Button size="icon" variant="ghost" className="h-6 w-6">
                  <SmilePlus className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-1" side="top">
                <div className="flex gap-1">
                  {QUICK_EMOJI.map((e) => (
                    <button
                      key={e}
                      onClick={() => toggleReaction(e)}
                      className="rounded p-1 text-lg hover:bg-muted"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-6 w-6">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onReply}>
                  <Reply className="mr-2 h-4 w-4" /> Reply
                </DropdownMenuItem>
                {canPin && (
                  <DropdownMenuItem onClick={togglePin}>
                    <Pin className="mr-2 h-4 w-4" /> {message.is_pinned ? "Unpin" : "Pin"}
                  </DropdownMenuItem>
                )}
                {message.sender_id === currentUserId && (
                  <DropdownMenuItem onClick={del} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {replyTarget && (
          <div className="mb-1 rounded border-l-2 border-accent bg-muted/30 px-2 py-1 text-xs">
            <p className="font-medium text-accent">{replyTargetSender?.full_name ?? "Someone"}</p>
            <p className="truncate text-muted-foreground">{replyTarget.content || replyTarget.attachment_name}</p>
          </div>
        )}

        {message.content && (
          <p className={cn("text-sm break-words", message.is_announcement && "font-semibold")}>{message.content}</p>
        )}

        {message.attachment_url && (
          isImage ? (
            <a href={message.attachment_url} target="_blank" rel="noreferrer">
              <img
                src={message.attachment_url}
                alt={message.attachment_name ?? "image"}
                className="mt-1 max-h-64 rounded border"
              />
            </a>
          ) : (
            <a
              href={message.attachment_url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-2 rounded border bg-muted/50 px-2 py-1 text-xs hover:bg-muted"
            >
              <FileText className="h-4 w-4" />
              <span className="truncate">{message.attachment_name}</span>
            </a>
          )
        )}

        {Object.keys(grouped).length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {Object.entries(grouped).map(([emoji, { count, mine }]) => (
              <button
                key={emoji}
                onClick={() => toggleReaction(emoji)}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-xs",
                  mine ? "border-accent bg-accent/20" : "border-border bg-muted/40",
                )}
              >
                {emoji} {count}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}