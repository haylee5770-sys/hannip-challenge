import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { askConfirm } from "@/lib/askConfirm";

export default function Profile() {
  const { user, refresh, logout } = useAuth();
  const contact = trpc.members.myContact.useQuery();
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  useEffect(() => { if (contact.data) { setPhone(contact.data.phone); setAddress(contact.data.address); } }, [contact.data]);
  const saveContact = trpc.members.updateContact.useMutation({ onSuccess: () => { toast.success("선물 받을 곳을 저장했어요"); contact.refetch(); }, onError: (e) => toast.error(e.message) });
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

      {/* 2026-11-22: 선물 받을 곳 — 바뀌면 여기서 고친다 */}
      <section className="mt-10 rounded-2xl border border-primary/40 p-5 space-y-3">
        <div className="text-base font-bold">🎁 선물 받을 곳</div>
        <p className="text-xs text-muted-foreground leading-relaxed">전화번호·주소는 선물 발송과 구매 기록 확인에만 쓰여요. 바뀌면 꼭 여기서 고쳐 주세요.</p>
        <div className="space-y-1"><Label className="text-xs text-muted-foreground">전화번호</Label>
          <Input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" className="rounded-xl" /></div>
        <div className="space-y-1"><Label className="text-xs text-muted-foreground">주소</Label>
          <Textarea value={address} onChange={e => setAddress(e.target.value)} rows={2} className="rounded-xl" /></div>
        <Button className="rounded-xl glass-btn" disabled={saveContact.isPending} onClick={() => saveContact.mutate({ phone, address })}>저장</Button>
      </section>

      {/* 2026-11-22: 로그아웃은 메뉴에서 빼고 여기 맨 아래에 작게 (실수로 누르지 않게) */}
      <div className="mt-16 mb-4 text-center">
        <button type="button" className="text-xs text-muted-foreground/60 underline"
          onClick={async () => { if (await askConfirm(`정말 로그아웃할까요?
다시 들어오려면 카카오 로그인을 다시 해야 해요.`, "로그아웃")) logout(); }}>
          로그아웃
        </button>
      </div>
    </div>
  );
}
