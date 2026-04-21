import { Link, useLocation } from "@tanstack/react-router";
import { Home, FileText, MessageCircle, Briefcase, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/notes", label: "Notes", icon: FileText },
  { to: "/chat", label: "Chat", icon: MessageCircle },
  { to: "/gigs", label: "Gigs", icon: Briefcase },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const location = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2 py-1.5">
        {tabs.map(({ to, label, icon: Icon }) => {
          const active = location.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5", active && "text-accent")} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}