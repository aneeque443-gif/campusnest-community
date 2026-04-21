import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  return (
    <div className="min-h-screen bg-secondary pb-20">
      <div className="mx-auto max-w-md">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}