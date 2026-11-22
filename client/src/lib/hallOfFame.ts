// 명예의 전당 (2026-11-22, 해이가 준 '다이어트 기록 수정 10.13.xlsx' + 한입 주문서 정산표에서 정리)
// 10kg 이상: 여러 기수에 걸쳐 10kg 이상 감량한 크루 / 5kg 이상: 한 기수 챌린지에서 5kg 이상 감량한 크루
export type Ten = { name: string; kg: number; seasons: string };
export type Five = { no: string; name: string; kg: number; from?: number; to?: number };

export const TEN_KG: Ten[] = [
  { name: "수지", kg: 22.2, seasons: "2기~7기" },
  { name: "청하", kg: 17.3, seasons: "1·2·3·4·6·7기" },
  { name: "보아", kg: 12.1, seasons: "2기~3기" },
  { name: "아이유", kg: 11.2, seasons: "10기~12기" },
  { name: "설인아", kg: 11.1, seasons: "6기~8기" },
  { name: "제니", kg: 10.2, seasons: "8기~12기" },
  { name: "지현", kg: 10, seasons: "5기~6기" },
  { name: "준희", kg: 10, seasons: "2기~3기" },
];

export const FIVE_KG: Five[] = [
  { no: "14기", name: "카즈하", kg: 5.7, from: 78.7, to: 73 },
  { no: "11기", name: "은빈", kg: 5.35, from: 94.7, to: 89.35 },
  { no: "10기", name: "아이유", kg: 5.4, from: 79.6, to: 74.2 },
  { no: "10기", name: "혜선", kg: 5.1, from: 84, to: 78.9 },
  { no: "8기", name: "설인아", kg: 5.8, from: 106.3, to: 100.5 },
  { no: "8기", name: "태리", kg: 5.37, from: 68.9, to: 63.53 },
  { no: "8기", name: "혜리", kg: 5.21, from: 69, to: 63.79 },
  { no: "7기", name: "설인아", kg: 6.3, from: 108.6, to: 102.3 },
  { no: "6기", name: "은빈", kg: 7.1, from: 84.8, to: 77.7 },
  { no: "6기", name: "인영", kg: 5.7, from: 65.9, to: 60.2 },
  { no: "6기", name: "나나", kg: 5.05, from: 56.22, to: 51.17 },
  { no: "6기", name: "혜리", kg: 5, from: 71, to: 66 },
  { no: "5기", name: "영지", kg: 5.8, from: 64.8, to: 59 },
  { no: "5기", name: "수지", kg: 5.53 },
  { no: "4기", name: "민시", kg: 5.1, from: 67.7, to: 62.6 },
  { no: "3기", name: "지연", kg: 5, from: 57.3, to: 52.3 },
  { no: "2기", name: "혜수", kg: 6.1, from: 70, to: 63.9 },
];
