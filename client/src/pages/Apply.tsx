// 신청하기 (2026-11-22): 무언가를 신청할 때는 모두 여기 — 상 받기 신청 · 이벤트 신청 · 의견 보내기
import PageTitle from "@/components/PageTitle";
import CrewButtons from "@/components/CrewButtons";

export default function Apply() {
  return (
    <div className="space-y-2">
      <PageTitle eyebrow="APPLY" title="신청하기" />
      <CrewButtons />
    </div>
  );
}
