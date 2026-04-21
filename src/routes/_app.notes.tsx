import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/_app/notes")({
  head: () => ({ meta: [{ title: "Notes — CampusNest" }] }),
  component: () => <Placeholder title="Notes" />,
});

function Placeholder({ title }: { title: string }) {
  return (
    <div className="px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold text-primary">{title}</h1>
      <Card className="border-dashed shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-accent" />
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