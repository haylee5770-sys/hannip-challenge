import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Profile() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setBio((user as { bio?: string }).bio ?? "");
      setAvatarUrl((user as { avatarUrl?: string }).avatarUrl ?? "");
    }
  }, [user]);

  const update = trpc.members.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("프로필이 저장되었습니다");
      refresh();
    },
  });

  return (
    <div>
      <section className="grid grid-cols-12 gap-6 items-end pb-10 border-b hairline">
        <div className="col-span-12">
          <div className="editorial-eyebrow text-muted-foreground mb-3">YOUR PROFILE</div>
          <h1 className="editorial-h1 text-5xl md:text-7xl">
            나의 <span className="italic font-serif font-light">프로필</span>
          </h1>
        </div>
      </section>

      <section className="py-10 grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-5">
          <div className="aspect-[3/4] bg-secondary border hairline overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center editorial-h1 text-7xl text-muted-foreground italic font-serif">
                {(name ?? "?").charAt(0)}
              </div>
            )}
          </div>
        </div>

        <div className="col-span-12 md:col-span-7 space-y-5">
          <div>
            <Label className="editorial-eyebrow text-muted-foreground mb-2 block">이름</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-none border-0 border-b border-foreground/30 px-0 text-2xl font-serif h-12 focus-visible:ring-0 focus-visible:border-foreground"
            />
          </div>
          <div>
            <Label className="editorial-eyebrow text-muted-foreground mb-2 block">자기소개</Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="짧은 한 줄로 나를 소개해 주세요."
              className="rounded-none border-foreground/30 font-serif"
            />
          </div>
          <div>
            <Label className="editorial-eyebrow text-muted-foreground mb-2 block">프로필 사진 URL</Label>
            <Input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              className="rounded-none border-foreground/30 font-serif"
            />
          </div>
          <div className="pt-3">
            <Button
              onClick={() => update.mutate({ name: name.trim(), bio: bio.trim() || null, avatarUrl: avatarUrl.trim() || null })}
              disabled={update.isPending}
              className="rounded-none uppercase tracking-wider px-8"
            >
              {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "저장"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
