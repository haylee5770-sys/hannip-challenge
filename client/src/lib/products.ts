// 슈퍼한입 스무디·퓨레 버튼 목록과 1개당 영양소 (2026-11-20)
// 값 출처: 네이버 스마트스토어 상세페이지 '영양정보' 표 (방장 캡처, 2026-11-20)
// 기록 칸이 정수(g)라서 지방 소수점은 반올림 (원래 값은 주석)

export type Product = {
  id: string;
  row: "단백질 스무디" | "과일 스무디" | "퓨레";
  name: string;      // 버튼에 보이는 이름
  color: string;     // 버튼 점 색
  kcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  vegetableG: number;
};

export const PRODUCTS: Product[] = [
  { id: "red-dan",    row: "단백질 스무디", name: "레드 단스",   color: "#ff5a5f", kcal: 179, carbsG: 22, proteinG: 17, fatG: 3,  vegetableG: 0 }, // 지방 2.8g
  { id: "yellow-dan", row: "단백질 스무디", name: "옐로우 단스", color: "#ffd84d", kcal: 172, carbsG: 21, proteinG: 16, fatG: 3,  vegetableG: 0 }, // 지방 2.7g
  { id: "green-dan",  row: "단백질 스무디", name: "그린 단스",   color: "#7ed957", kcal: 175, carbsG: 20, proteinG: 17, fatG: 3,  vegetableG: 0 }, // 지방 3.1g
  { id: "red-gwa",    row: "과일 스무디",   name: "레드 과스",   color: "#ff5a5f", kcal: 109, carbsG: 25, proteinG: 2,  fatG: 0,  vegetableG: 0 }, // 레드톡
  { id: "yellow-gwa", row: "과일 스무디",   name: "옐로우 과스", color: "#ffd84d", kcal: 126, carbsG: 30, proteinG: 1,  fatG: 0,  vegetableG: 0 }, // 옐로우톡
  { id: "green-gwa",  row: "과일 스무디",   name: "그린 과스",   color: "#7ed957", kcal: 212, carbsG: 16, proteinG: 2,  fatG: 16, vegetableG: 0 }, // 그린톡 (올리브오일)
  { id: "hippo-puree", row: "퓨레",         name: "히포크라테스 퓨레", color: "#b6f24a", kcal: 66, carbsG: 14, proteinG: 2, fatG: 0, vegetableG: 0 }, // 150g
];

export const PRODUCT_ROWS: Product["row"][] = ["단백질 스무디", "과일 스무디", "퓨레"];

/** 하루 권장량 (한입 '하루 섭취 영양소' 슬라이드 기준) */
export const DAILY_TARGET = { carbsG: 130, proteinG: 100, fatG: 42, vegetableG: 300 };
