// 의견 보내기 (2026-11-22: 메뉴 항목으로 따로)
import { useLocation } from "wouter";
import { FeedbackSheet } from "@/components/CrewButtons";

export default function Feedback() {
  const [, navigate] = useLocation();
  return <FeedbackSheet inline onClose={() => navigate("/today")} />;
}
