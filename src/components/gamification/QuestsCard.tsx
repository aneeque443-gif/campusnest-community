import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Check, Sparkles, Target } from "lucide-react";
import { useDailyQuests } from "@/lib/gamification";

export function QuestsCard() {
  const { quests, loading } = useDailyQuests();
  const done = quests.filter((q) => q.completed).length;
  const total = quests.length || 4;
  const allDone = done === total && total > 0;

  return (
    <Card className="shadow-[var(--shadow-card)]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <Target className="h-5 w-5 text-accent" />
            Today's Quests
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {done}/{total} done
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={total ? (done / total) * 100 : 0} />
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading quests…</p>
        ) : quests.length === 0 ? (
          <p className="text-xs text-muted-foreground">No quests today.</p>
        ) : (
          <ul className="space-y-2">
            {quests.map((q) => (
              <li
                key={q.id}
                className="flex items-center gap-2 rounded-md bg-muted/60 px-2.5 py-2"
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    q.completed
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border bg-background"
                  }`}
                >
                  {q.completed && <Check className="h-3 w-3" />}
                </span>
                <span
                  className={`flex-1 text-xs ${
                    q.completed ? "text-muted-foreground line-through" : "text-foreground"
                  }`}
                >
                  {q.title}
                  {q.target > 1 && (
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      ({Math.min(q.progress, q.target)}/{q.target})
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-[10px] font-semibold text-accent">
                  +{q.xp_reward} XP
                </span>
              </li>
            ))}
          </ul>
        )}
        {allDone && (
          <div className="flex items-center gap-1.5 rounded-md bg-accent/10 px-2.5 py-2 text-xs font-medium text-accent">
            <Sparkles className="h-4 w-4" /> All quests done — bonus +25 XP awarded!
          </div>
        )}
      </CardContent>
    </Card>
  );
}