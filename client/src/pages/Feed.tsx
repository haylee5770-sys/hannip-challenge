import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { todayLocal } from "@shared/utils";
import { Loader2, MessageCircle, Trash2, Sparkles } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Streamdown } from "streamdown";

const EMOJIS = ["👏", "🔥", "💪", "❤️", "🌿"];
const CATEGORY_LABELS: Record<string, string> = {
  breakfast: "아침",
  lunch: "점심",
  dinner: "저녁",
  snack: "간식",
  regular: "일반식",
  smoothie: "스무디",
};

type TargetType = "meal" | "exercise" | "weight";

export default function Feed() {
  const { user } = useAuth();
  const [date] = useState(() => todayLocal());
  const feed = trpc.feed.today.useQuery({ date });
  const utils = trpc.useUtils();

  const refresh = () => utils.feed.today.invalidate({ date });

  if (feed.isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const data = feed.data;
  if (!data) return null;

  const userById = new Map(data.users.map(u => [u.id, u]));

  // Group by user
  const groupedUsers = data.users
    .map(u => {
      const meals = data.meals.filter(m => m.userId === u.id);
      const ex = data.exercises.filter(e => e.userId === u.id);
      const w = data.weights.find(x => x.userId === u.id);
      return { user: u, meals, exercises: ex, weight: w };
    })
    .sort((a, b) => {
      const score = (g: typeof a) => g.meals.length + g.exercises.length + (g.weight ? 1 : 0);
      return score(b) - score(a);
    });

  return (
    <div>
      <section className="grid grid-cols-12 gap-6 items-end pb-10 border-b hairline">
        <div className="col-span-12 md:col-span-9">
          <div className="editorial-eyebrow text-muted-foreground mb-3">COMMUNITY · TODAY</div>
          <h1 className="editorial-h1 text-5xl md:text-7xl">
            함께 <span className="italic font-serif font-light">기록하다</span>
          </h1>
          <p className="mt-4 font-serif italic text-lg text-muted-foreground">
            {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })} ·
            오늘의 멤버 {groupedUsers.length}명
          </p>
        </div>
      </section>

      <section className="py-10 space-y-12">
        {groupedUsers.map(g => (
          <div key={g.user.id} className="border-b hairline pb-10 last:border-b-0">
            <header className="flex items-baseline gap-3 mb-6">
              <div className="editorial-eyebrow text-muted-foreground">MEMBER</div>
              <h2 className="editorial-h2 text-3xl md:text-4xl">{g.user.name || "이름 없음"}</h2>
              {g.weight && (
                <div className="ml-auto flex items-baseline gap-3">
                  <span className="number-display text-lg text-muted-foreground">
                    {g.weight.weightKg.toFixed(1)} kg
                  </span>
                  {g.weight.skeletalMuscleKg !== null && g.weight.skeletalMuscleKg !== undefined && (
                    <span className="text-xs uppercase tracking-wider text-muted-foreground/70">
                      근량 {g.weight.skeletalMuscleKg.toFixed(1)}
                    </span>
                  )}
                  {g.weight.bodyFatPercent !== null && g.weight.bodyFatPercent !== undefined && (
                    <span className="text-xs uppercase tracking-wider text-muted-foreground/70">
                      체지 {g.weight.bodyFatPercent.toFixed(1)}%
                    </span>
                  )}
                </div>
              )}
            </header>

            {g.meals.length === 0 && g.exercises.length === 0 && !g.weight ? (
              <div className="font-serif italic text-muted-foreground text-sm">
                아직 오늘 기록이 없어요.
              </div>
            ) : (
              <div className="grid grid-cols-12 gap-4">
                {/* Weight item */}
                {g.weight && (
                  <FeedItem
                    targetType="weight"
                    targetId={g.weight.id}
                    title="체중 기록"
                    eyebrow={g.weight.inbodyPhotoUrl ? "INBODY" : "WEIGHT"}
                    body={[
                      `체중 ${g.weight.weightKg.toFixed(1)} kg`,
                      g.weight.skeletalMuscleKg !== null && g.weight.skeletalMuscleKg !== undefined ? `골격근량 ${g.weight.skeletalMuscleKg.toFixed(1)} kg` : null,
                      g.weight.bodyFatPercent !== null && g.weight.bodyFatPercent !== undefined ? `체지방률 ${g.weight.bodyFatPercent.toFixed(1)}%` : null,
                    ].filter(Boolean).join(" · ")}
                    note={g.weight.note ?? undefined}
                    photos={g.weight.inbodyPhotoUrl ? [g.weight.inbodyPhotoUrl] : undefined}
                    reactions={data.reactions.weight}
                    comments={data.comments.weight}
                    userById={userById}
                    me={user?.id}
                    onChange={refresh}
                  />
                )}

                {/* Meals */}
                {g.meals.map(m => (
                  <FeedItem
                    key={`m-${m.id}`}
                    targetType="meal"
                    targetId={m.id}
                    eyebrow={CATEGORY_LABELS[m.category]?.toUpperCase()}
                    title={CATEGORY_LABELS[m.category] ?? m.category}
                    body={m.description ?? ""}
                    photos={m.photos.map(p => p.url)}
                    aiComment={m.aiComment ?? null}
                    macros={{
                      carbs: m.carbsG,
                      protein: m.proteinG,
                      fat: m.fatG,
                      veg: m.vegetableG,
                      water: m.waterMl,
                    }}
                    reactions={data.reactions.meal}
                    comments={data.comments.meal}
                    userById={userById}
                    me={user?.id}
                    onChange={refresh}
                  />
                ))}

                {/* Exercises */}
                {g.exercises.map(e => (
                  <FeedItem
                    key={`e-${e.id}`}
                    targetType="exercise"
                    targetId={e.id}
                    eyebrow="EXERCISE"
                    title={e.kind}
                    body={`${e.durationMin}분 · 강도 ${({ low: "낮음", medium: "보통", high: "높음" } as Record<string, string>)[e.intensity]}`}
                    note={e.note ?? undefined}
                    reactions={data.reactions.exercise}
                    comments={data.comments.exercise}
                    userById={userById}
                    me={user?.id}
                    onChange={refresh}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

type ReactionRow = { id: number; userId: number; targetType: TargetType; targetId: number; emoji: string };
type CommentRow = { id: number; userId: number; targetType: TargetType; targetId: number; body: string; createdAt: Date };

function FeedItem(props: {
  targetType: TargetType;
  targetId: number;
  eyebrow?: string;
  title: string;
  body?: string;
  note?: string;
  photos?: string[];
  aiComment?: string | null;
  macros?: { carbs: number; protein: number; fat: number; veg: number; water: number };
  reactions: ReactionRow[];
  comments: CommentRow[];
  userById: Map<number, { id: number; name: string | null; avatarUrl: string | null }>;
  me?: number;
  onChange: () => void;
}) {
  const myReactions = props.reactions.filter(r => r.targetId === props.targetId && r.userId === props.me);
  const allReactions = props.reactions.filter(r => r.targetId === props.targetId);
  const reactionsByEmoji = allReactions.reduce<Record<string, ReactionRow[]>>((acc, r) => {
    (acc[r.emoji] ||= []).push(r);
    return acc;
  }, {});
  const itemComments = props.comments.filter(c => c.targetId === props.targetId);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");

  const toggleReaction = trpc.reactions.toggle.useMutation({
    onSuccess: () => props.onChange(),
  });
  const addComment = trpc.comments.add.useMutation({
    onSuccess: () => { setCommentText(""); props.onChange(); },
  });
  const delComment = trpc.comments.delete.useMutation({
    onSuccess: () => props.onChange(),
  });

  return (
    <article className="col-span-12 md:col-span-6 border hairline p-5 bg-card">
      <header className="flex items-baseline justify-between mb-3">
        <div>
          {props.eyebrow && <div className="editorial-eyebrow text-muted-foreground">{props.eyebrow}</div>}
          <h3 className="editorial-h2 text-xl mt-0.5">{props.title}</h3>
        </div>
      </header>

      {props.body && <p className="font-serif text-base mb-3 leading-relaxed">{props.body}</p>}
      {props.note && <p className="font-serif italic text-sm text-muted-foreground mb-3">{props.note}</p>}

      {props.photos && props.photos.length > 0 && (
        <div className={`grid gap-2 mb-3 ${props.photos.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {props.photos.map((url, idx) => (
            <img key={idx} src={url} alt="" className="w-full aspect-square object-cover border hairline" />
          ))}
        </div>
      )}

      {props.macros && (
        <div className="grid grid-cols-5 gap-2 text-center mb-3 py-2 border-y hairline">
          <Macro label="탄" v={props.macros.carbs} u="g" />
          <Macro label="단" v={props.macros.protein} u="g" />
          <Macro label="지" v={props.macros.fat} u="g" />
          <Macro label="채" v={props.macros.veg} u="g" />
          <Macro label="물" v={props.macros.water} u="ml" />
        </div>
      )}

      {props.aiComment && (
        <div className="border-l-2 border-accent pl-3 mb-3">
          <div className="editorial-eyebrow text-muted-foreground flex items-center gap-1 mb-1">
            <Sparkles className="h-3 w-3" /> AI
          </div>
          <div className="font-serif text-sm leading-relaxed">
            <Streamdown>{props.aiComment}</Streamdown>
          </div>
        </div>
      )}

      {/* Reactions */}
      <div className="flex flex-wrap items-center gap-1 pt-2 border-t hairline">
        {EMOJIS.map(em => {
          const count = reactionsByEmoji[em]?.length ?? 0;
          const mine = myReactions.some(r => r.emoji === em);
          return (
            <button
              key={em}
              onClick={() => toggleReaction.mutate({ targetType: props.targetType, targetId: props.targetId, emoji: em })}
              className={`text-sm px-2 py-1 transition-colors ${mine ? "bg-foreground text-background" : "hover:bg-secondary"}`}
              style={{ transitionDuration: "160ms" }}
            >
              {em} {count > 0 && <span className="number-display ml-0.5">{count}</span>}
            </button>
          );
        })}
        <button
          onClick={() => setShowComments(v => !v)}
          className="ml-auto text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <MessageCircle className="h-4 w-4" />
          <span className="number-display">{itemComments.length}</span>
        </button>
      </div>

      {showComments && (
        <div className="mt-3 pt-3 border-t hairline space-y-2">
          {itemComments.length === 0 && (
            <div className="font-serif italic text-sm text-muted-foreground">아직 댓글이 없어요.</div>
          )}
          {itemComments.map(c => {
            const author = props.userById.get(c.userId);
            return (
              <div key={c.id} className="flex items-start gap-2">
                <div className="flex-1">
                  <div className="text-xs editorial-eyebrow text-muted-foreground mb-0.5">
                    {author?.name || "이름 없음"}
                  </div>
                  <div className="font-serif text-sm leading-relaxed">{c.body}</div>
                </div>
                {c.userId === props.me && (
                  <button onClick={() => delComment.mutate({ id: c.id })}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                )}
              </div>
            );
          })}
          <div className="flex gap-2 pt-2">
            <Input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="응원의 한 마디"
              className="rounded-none border-0 border-b border-foreground/30 px-0 font-serif focus-visible:ring-0 focus-visible:border-foreground bg-transparent"
              onKeyDown={(e) => {
                if (e.key === "Enter" && commentText.trim()) {
                  addComment.mutate({ targetType: props.targetType, targetId: props.targetId, body: commentText.trim() });
                }
              }}
            />
            <Button
              onClick={() => commentText.trim() && addComment.mutate({ targetType: props.targetType, targetId: props.targetId, body: commentText.trim() })}
              disabled={addComment.isPending || !commentText.trim()}
              className="rounded-none"
            >
              {addComment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "보내기"}
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}

function Macro({ label, v, u }: { label: string; v: number; u: string }) {
  return (
    <div>
      <div className="editorial-eyebrow text-muted-foreground">{label}</div>
      <div className="number-display text-sm">{v}<span className="text-xs text-muted-foreground ml-0.5">{u}</span></div>
    </div>
  );
}
