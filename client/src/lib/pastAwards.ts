// 역대 시상식 (2026-11-22, 해이가 준 '다이어트 기록 수정 10.13.xlsx'에서 정리)
// 기수마다 감량상·운동상·인증상. 미니 챌린지는 1등만. 앱 이전 기록이라 여기에 적어 둔다 (닉네임만).
export type PastAward = { label: string; name: string; note?: string };
export type PastSeason = { no: string; sub?: string; awards: PastAward[] };

export const PAST_AWARDS: PastSeason[] = [
  { no: "16기", sub: "3일 디톡스", awards: [{ label: "인증상 1등", name: "고윤정" }, { label: "인증상 2등", name: "장나라" }] },
  { no: "15기", sub: "미니 챌린지", awards: [{ label: "인증상", name: "고윤정" }, { label: "감량상", name: "카즈하" }] },
  { no: "14기", awards: [{ label: "감량상", name: "김태희" }, // 2026-11-23 해이: 카즈하 → 김태희, 숫자는 모름 { label: "운동상", name: "고윤정", note: "23회" }, { label: "인증상", name: "장나라", note: "281회" }] },
  { no: "13기", sub: "미니 챌린지", awards: [{ label: "1등", name: "김지원, 고윤정" }] },
  { no: "12기", awards: [{ label: "감량상", name: "근영, 희선", note: "6.48% 감량" }, { label: "운동상", name: "김지원", note: "24회" }, { label: "인증상", name: "제니", note: "206회" }] },
  { no: "11기", awards: [{ label: "감량상", name: "제니", note: "7.28% 감량" }, { label: "운동상", name: "김지원", note: "40회" }, { label: "인증상", name: "수지", note: "208회" }] },
  { no: "10.5기", sub: "미니 챌린지", awards: [{ label: "1등", name: "원영" }] },
  { no: "10기", awards: [{ label: "감량상", name: "제니", note: "7.14% 감량" }, { label: "운동상", name: "수지", note: "22회" }, { label: "인증상", name: "청하", note: "232회" }] },
  { no: "9.5기", sub: "미니 챌린지", awards: [{ label: "1등", name: "지연" }] },
  { no: "9기", awards: [{ label: "감량상", name: "태리", note: "7.04% 감량" }, { label: "운동상", name: "청하", note: "23회" }, { label: "인증상", name: "수지", note: "220회" }] },
  { no: "8기", awards: [{ label: "감량상", name: "태리", note: "7.79% 감량" }, { label: "운동상", name: "수지", note: "22회" }, { label: "인증상", name: "혜리", note: "207회" }] },
  { no: "7기", awards: [{ label: "감량상", name: "연아", note: "6.01% 감량" }, { label: "운동상", name: "청하", note: "29회" }, { label: "인증상", name: "수지", note: "265회" }] },
  { no: "6기", awards: [{ label: "감량상", name: "나나", note: "8.98% 감량" }, { label: "운동상", name: "수지", note: "39회" }, { label: "인증상", name: "청하", note: "259회" }] },
  { no: "5기", awards: [{ label: "감량상", name: "영지", note: "8.95% 감량" }, { label: "운동상", name: "수지", note: "54회" }, { label: "인증상", name: "지아", note: "180회" }] },
  { no: "4기", awards: [{ label: "감량상", name: "청하", note: "8.82% 감량" }, { label: "운동상", name: "수지", note: "32회" }, { label: "인증상", name: "윤정", note: "276회" }] },
  { no: "3기", awards: [{ label: "감량상", name: "보아" }, { label: "운동상", name: "카리나" }, { label: "인증상", name: "청하" }] },
];
