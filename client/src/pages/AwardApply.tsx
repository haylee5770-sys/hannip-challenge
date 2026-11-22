// 상 받기 신청 (2026-11-22: 메뉴 항목으로 따로)
import { useLocation } from "wouter";
import { AwardSheet } from "@/components/CrewButtons";

export default function AwardApply() {
  const [, navigate] = useLocation();
  return <AwardSheet inline onClose={() => navigate("/today")} />;
}
