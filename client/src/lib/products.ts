// 슈퍼한입 스무디·퓨레 버튼 목록과 1개당 영양소 (2026-11-20)
// ⚠️ 영양소 값은 임시값이에요. 네이버 상세페이지 '영양정보' 표를 받으면 아래 숫자만 고치면 됩니다.
//    (임시값 근거: '단2+과1 = 탄65·단35·지6', '과2+단1 = 탄70·단20·지3' 슬라이드에서 거꾸로 계산한 평균)

export type Product = {
  id: string;
  row: "단백질 스무디" | "과일 스무디" | "퓨레";
  name: string;      // 버튼에 보이는 이름
  color: string;     // 버튼 점 색
  carbsG: number;
  proteinG: number;
  fatG: number;
  vegetableG: number;
  provisional?: boolean;
};

export const PRODUCTS: Product[] = [
  { id: "red-dan",    row: "단백질 스무디", name: "레드 단스",   color: "#ff5a5f", carbsG: 20, proteinG: 17, fatG: 3, vegetableG: 0, provisional: true },
  { id: "yellow-dan", row: "단백질 스무디", name: "옐로우 단스", color: "#ffd84d", carbsG: 20, proteinG: 17, fatG: 3, vegetableG: 0, provisional: true },
  { id: "green-dan",  row: "단백질 스무디", name: "그린 단스",   color: "#7ed957", carbsG: 20, proteinG: 17, fatG: 3, vegetableG: 0, provisional: true },
  { id: "red-gwa",    row: "과일 스무디",   name: "레드 과스",   color: "#ff5a5f", carbsG: 25, proteinG: 2,  fatG: 1, vegetableG: 0, provisional: true },
  { id: "yellow-gwa", row: "과일 스무디",   name: "옐로우 과스", color: "#ffd84d", carbsG: 25, proteinG: 2,  fatG: 1, vegetableG: 0, provisional: true },
  { id: "green-gwa",  row: "과일 스무디",   name: "그린 과스",   color: "#7ed957", carbsG: 25, proteinG: 2,  fatG: 1, vegetableG: 0, provisional: true },
  { id: "hippo-puree", row: "퓨레",         name: "히포크라테스 퓨레", color: "#b6f24a", carbsG: 15, proteinG: 3, fatG: 1, vegetableG: 0, provisional: true },
];

export const PRODUCT_ROWS: Product["row"][] = ["단백질 스무디", "과일 스무디", "퓨레"];

/** 하루 권장량 (한입 '하루 섭취 영양소' 슬라이드 기준) */
export const DAILY_TARGET = { carbsG: 130, proteinG: 100, fatG: 42, vegetableG: 300 };
