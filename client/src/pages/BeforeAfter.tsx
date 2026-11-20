// 비포·애프터 (2026-11-21): '오늘'에서 빼서 따로 메뉴로
import PageTitle from "@/components/PageTitle";
import { SeasonPhotosSection } from "./Today";

export default function BeforeAfter() {
  return (
    <div className="space-y-4">
      <PageTitle eyebrow="BEFORE · AFTER" title="비포 애프터" sub="챌린지 시작과 끝에 같은 자세로 찍어 나의 변화를 남겨요." />
      <SeasonPhotosSection />
    </div>
  );
}
