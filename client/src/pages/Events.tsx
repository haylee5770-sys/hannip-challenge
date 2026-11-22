// 이벤트 참여 (2026-11-22: 메뉴 항목으로 따로)
import { useLocation } from "wouter";
import { EventSheet } from "@/components/CrewButtons";

export default function Events() {
  const [, navigate] = useLocation();
  return <EventSheet inline onClose={() => navigate("/today")} />;
}
