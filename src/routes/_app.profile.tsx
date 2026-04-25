import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useRoles } from "@/lib/use-role";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Pencil,
  LogOut,
  Trophy,
  Flame,
  Star,
  Award,
  X,
  Plus,
  Upload,
  Bookmark,
  Newspaper,
  BadgeCheck,
} from "lucide-react";

type Profile = {
  id: string;
  full_name: string;
  enrollment_id: string;
  year: string;
  branch: string;
  photo_url: string | null;
  bio: string | null;
  skills: string[];
  xp: number;
  level: string;
  streak: number;
};

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Profile — CampusNest" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, signOut } = useAuth();
  const { isReporter, roles } = useRoles();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [bio, setBio] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [library, setLibrary] = useState<
    { id: string; title: string; subject: string }[]
  >([]);
  const [reporterStats, setReporterStats] = useState<{ posts: number; likes: number } | null>(null);

  async function load() {
    if (!user) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (error) toast.error(error.message);
    if (data) {
      setProfile(data as Profile);
      setBio(data.bio ?? "");
      setSkills(data.skills ?? []);
    }
    const { data: bm } = await supabase
      .from("note_bookmarks")
      .select("note_id, notes(id, title, subject)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setLibrary(
      (bm ?? [])
        .map((row: { notes: { id: string; title: string; subject: string } | null }) => row.notes)
        .filter((n): n is { id: string; title: string; subject: string } => !!n),
    );
    // Reporter stats
    const { data: rp } = await supabase
      .from("feed_posts")
      .select("like_count")
      .eq("author_id", user.id);
    if (rp && rp.length > 0) {
      const totalLikes = rp.reduce((s: number, p: { like_count: number }) => s + (p.like_count ?? 0), 0);
      setReporterStats({ posts: rp.length, likes: totalLikes });
    } else {
      setReporterStats(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [user]);

  function addSkill() {
    const v = skillInput.trim();
    if (!v || skills.includes(v) || skills.length >= 20) return;
    setSkills([...skills, v]);
    setSkillInput("");
  }

  function removeSkill(s: string) {
    setSkills(skills.filter((x) => x !== s));
  }

  async function save() {
    if (!user || !profile) return;
    setSaving(true);
    try {
      let photoUrl = profile.photo_url;
      if (photoFile) {
        const ext = photoFile.name.split(".").pop() || "jpg";
        const path = `${user.id}/avatar.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("profile-photos")
          .upload(path, photoFile, { upsert: true });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("profile-photos").getPublicUrl(path);
        photoUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      }
      const { error } = await supabase
        .from("profiles")
        .update({ bio, skills, photo_url: photoUrl })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Profile updated");
      setEditOpen(false);
      setPhotoFile(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return <div className="p-6 text-center text-muted-foreground">No profile found.</div>;
  }

  return (
    <div className="space-y-4 px-4 py-6">
      {/* Header card */}
      <Card className="overflow-hidden shadow-[var(--shadow-card)]">
        <div className="h-20 bg-[image:var(--gradient-primary)]" />
        <CardContent className="-mt-10 pb-5">
          <div className="flex flex-col items-center text-center">
            <div className="h-20 w-20 overflow-hidden rounded-full border-4 border-card bg-muted">
              {profile.photo_url ? (
                <img src={profile.photo_url} alt={profile.full_name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-primary">
                  {profile.full_name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <h1 className="mt-2 text-xl font-bold text-foreground">{profile.full_name}</h1>
            <div className="mt-1 flex gap-2">
              <Badge variant="secondary">{profile.year}</Badge>
              <Badge variant="secondary">{profile.branch}</Badge>
            </div>
            <div className="mt-3 flex w-full gap-2">
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild>
                  <Button className="flex-1" size="sm">
                    <Pencil className="mr-1.5 h-4 w-4" /> Edit profile
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Edit profile</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex flex-col items-center gap-2">
                      <label
                        htmlFor="editPhoto"
                        className="group relative flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-muted hover:border-accent"
                      >
                        {photoFile ? (
                          <img src={URL.createObjectURL(photoFile)} alt="" className="h-full w-full object-cover" />
                        ) : profile.photo_url ? (
                          <img src={profile.photo_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Upload className="h-5 w-5 text-muted-foreground" />
                        )}
                        <input
                          id="editPhoto"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                        />
                      </label>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea id="bio" maxLength={300} rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Skills</Label>
                      <div className="flex gap-2">
                        <Input
                          value={skillInput}
                          onChange={(e) => setSkillInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addSkill();
                            }
                          }}
                          maxLength={30}
                          placeholder="Add a skill"
                        />
                        <Button type="button" size="icon" onClick={addSkill}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {skills.map((s) => (
                          <Badge key={s} variant="secondary" className="gap-1">
                            {s}
                            <button type="button" onClick={() => removeSkill(s)} aria-label={`Remove ${s}`}>
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={save} disabled={saving}>
                      {saving ? "Saving…" : "Save"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await signOut();
                  toast.success("Signed out");
                }}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard icon={<Star className="h-4 w-4 text-accent" />} label="XP" value={profile.xp} />
        <StatCard icon={<Trophy className="h-4 w-4 text-accent" />} label="Level" value={profile.level} />
        <StatCard icon={<Flame className="h-4 w-4 text-accent" />} label="Streak" value={profile.streak} />
      </div>

      {/* Bio */}
      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2">
          <h2 className="text-sm font-semibold text-foreground">About</h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {profile.bio?.trim() || "Tap Edit profile to add your bio."}
          </p>
        </CardContent>
      </Card>

      {/* Skills */}
      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2">
          <h2 className="text-sm font-semibold text-foreground">Skills</h2>
        </CardHeader>
        <CardContent>
          {profile.skills.length === 0 ? (
            <p className="text-sm text-muted-foreground">No skills added yet.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {profile.skills.map((s) => (
                <Badge key={s} variant="secondary">
                  {s}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Achievements */}
      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Award className="h-4 w-4 text-accent" /> Achievement badges
          </h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No achievements yet — start earning!</p>
        </CardContent>
      </Card>

      {/* My Library */}
      <Card className="shadow-[var(--shadow-card)]">
        <CardHeader className="pb-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Bookmark className="h-4 w-4 text-accent" /> My Library
          </h2>
        </CardHeader>
        <CardContent>
          {library.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Bookmark notes to save them here.
            </p>
          ) : (
            <ul className="space-y-2">
              {library.map((n) => (
                <li key={n.id}>
                  <Link
                    to="/notes/$noteId"
                    params={{ noteId: n.id }}
                    className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 hover:bg-secondary"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {n.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{n.subject}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Enrollment ID: <span className="font-mono">{profile.enrollment_id}</span>
      </p>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card className="shadow-[var(--shadow-card)]">
      <CardContent className="flex flex-col items-center gap-0.5 p-3">
        {icon}
        <span className="text-base font-bold text-foreground">{value}</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );
}