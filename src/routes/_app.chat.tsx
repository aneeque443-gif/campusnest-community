import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_app/chat")({
  head: () => ({ meta: [{ title: "Chat — CampusNest" }] }),
  component: ChatPage,
});

function ChatPage() {
  return (
    <div className="px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold text-primary">Chat</h1>
      <Card className="border-dashed shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="h-5 w-5 text-accent" />
            Coming soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">This section is under construction.</p>
        </CardContent>
      </Card>
    </div>
  );
}