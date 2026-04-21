import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase } from "lucide-react";

export const Route = createFileRoute("/_app/gigs")({
  head: () => ({ meta: [{ title: "Gigs — CampusNest" }] }),
  component: GigsPage,
});

function GigsPage() {
  return (
    <div className="px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold text-primary">Gigs</h1>
      <Card className="border-dashed shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Briefcase className="h-5 w-5 text-accent" />
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