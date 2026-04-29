import { ALL_BADGES } from "@/lib/gamification";
import { cn } from "@/lib/utils";

export function BadgesGrid({ earnedKeys }: { earnedKeys: string[] }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {ALL_BADGES.map((b) => {
        const earned = earnedKeys.includes(b.key);
        return (
          <div
            key={b.key}
            className={cn(
              "flex flex-col items-center gap-1 rounded-md border p-2 text-center",
              earned ? "border-accent bg-accent/10" : "border-border bg-muted/40 opacity-60",
            )}
            title={`${b.label} — ${b.description}`}
          >
            <span className={cn("text-2xl", !earned && "grayscale")}>{b.emoji}</span>
            <span className="text-[9px] font-semibold leading-tight text-foreground">
              {b.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}