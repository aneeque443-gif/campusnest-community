import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useUserRooms } from "@/lib/chat/use-chat";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Hash, Users, MessageSquare, Megaphone, Plus } from "lucide-react";
import { NewDmDialog } from "@/components/chat/NewDmDialog";
import { NewGroupDialog } from "@/components/chat/NewGroupDialog";

export const Route = createFileRoute("/_app/chat/")({
  head: () => ({ meta: [{ title: "Chat — CampusNest" }] }),
  component: ChatIndex,
});

function ChatIndex() {
  const { user } = useAuth();
  const { rooms, loading } = useUserRooms(user?.id);
  const navigate = useNavigate();
  const [dmOpen, setDmOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);

  const classRooms = rooms.filter((r) => r.kind === "class");
  const openRoom = rooms.find((r) => r.kind === "open");
  const groups = rooms.filter((r) => r.kind === "study_group");
  const dms = rooms.filter((r) => r.kind === "dm");

  return (
    <div className="px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">Chat</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setDmOpen(true)}>
            <MessageSquare className="mr-1 h-4 w-4" /> DM
          </Button>
          <Button size="sm" onClick={() => setGroupOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Group
          </Button>
        </div>
      </header>

      <Tabs defaultValue="rooms" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="rooms">Rooms</TabsTrigger>
          <TabsTrigger value="dms">DMs</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
        </TabsList>

        <TabsContent value="rooms" className="space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {classRooms.map((r) => (
            <RoomLink
              key={r.id}
              roomId={r.id}
              icon={<Hash className="h-5 w-5 text-accent" />}
              title={`Class · ${r.name}`}
              preview={r.preview}
              unread={r.unread}
            />
          ))}
          {openRoom && (
            <RoomLink
              roomId={openRoom.id}
              icon={<Megaphone className="h-5 w-5 text-accent" />}
              title={openRoom.name}
              preview={openRoom.preview}
              unread={openRoom.unread}
            />
          )}
        </TabsContent>

        <TabsContent value="dms" className="space-y-2">
          {dms.length === 0 && (
            <p className="text-sm text-muted-foreground">No direct messages yet. Start one above.</p>
          )}
          {dms.map((r) => (
            <button
              key={r.id}
              onClick={() => navigate({ to: "/chat/$roomId", params: { roomId: r.id } })}
              className="block w-full text-left"
            >
              <Card className="flex items-center gap-3 p-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={r.otherUser?.photo_url ?? undefined} />
                  <AvatarFallback>{r.otherUser?.full_name?.[0] ?? "?"}</AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <p className="truncate font-medium">{r.otherUser?.full_name ?? r.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.preview ?? "Say hi 👋"}</p>
                </div>
                {r.unread > 0 && <Badge className="bg-accent">{r.unread}</Badge>}
              </Card>
            </button>
          ))}
        </TabsContent>

        <TabsContent value="groups" className="space-y-2">
          {groups.length === 0 && (
            <p className="text-sm text-muted-foreground">No study groups yet. Create one above.</p>
          )}
          {groups.map((r) => (
            <RoomLink
              key={r.id}
              roomId={r.id}
              icon={<Users className="h-5 w-5 text-accent" />}
              title={r.name}
              preview={r.preview}
              unread={r.unread}
            />
          ))}
        </TabsContent>
      </Tabs>

      <NewDmDialog open={dmOpen} onOpenChange={setDmOpen} />
      <NewGroupDialog open={groupOpen} onOpenChange={setGroupOpen} />
    </div>
  );
}

function RoomLink({
  roomId,
  icon,
  title,
  preview,
  unread,
}: {
  roomId: string;
  icon: React.ReactNode;
  title: string;
  preview: string | null;
  unread: number;
}) {
  return (
    <Link to="/chat/$roomId" params={{ roomId }} className="block">
      <Card className="flex items-center gap-3 p-3 transition-colors hover:bg-muted/50">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">{icon}</div>
        <div className="flex-1 overflow-hidden">
          <p className="truncate font-medium">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{preview ?? "No messages yet"}</p>
        </div>
        {unread > 0 && <Badge className="bg-accent">{unread}</Badge>}
      </Card>
    </Link>
  );
}