# Diet Tracker — 폐쇄형 헬스 커뮤니티 TODO

## 1. 데이터 & 인프라
- [x] Drizzle 스키마: invitations, weights, meals, mealPhotos, exercises, comments, reactions, goals, scheduledJobs
- [x] users 테이블에 status(approved/pending/rejected), bio, avatarUrl 확장
- [x] 마이그레이션 SQL 적용
- [x] db.ts에 쿼리 헬퍼 추가

## 2. 인증 & 권한 (폐쇄형)
- [x] 첫 사용자 자동 admin/approved 승격 (OWNER_OPEN_ID 활용)
- [x] 초대 링크 생성 mutation (admin only) — 토큰 발급
- [x] 초대 토큰으로 로그인 시 자동 승인(approved 상태)
- [x] 초대 없이 로그인한 사용자는 'pending' 상태로 대기 (관리자 승인 필요)
- [x] Pending/Rejected 화면 구현 (MembershipGate)
- [x] adminProcedure & approvedProcedure 미들웨어

## 3. 디자인 시스템 (Editorial / Cream + Didone)
- [x] index.css 글로벌 토큰: 크림색 배경, 진한 ink, 액센트
- [x] Google Fonts: Playfair Display + Cormorant Garamond + Inter
- [x] 타이포 위계 클래스 (editorial-h1, editorial-h2, editorial-eyebrow, number-display)
- [x] 공통 레이아웃 (상단 바 + 비대칭 컨테이너) — AppLayout
- [x] 모바일 반응형

## 4. 체중 기록 & 그래프
- [x] 일일 체중 입력 mutation (날짜별 upsert)
- [x] 체중 리스트 query
- [x] Recharts 꺾은선 그래프 (실시간 invalidate)
- [x] 목표 체중 라인 오버레이

## 5. 식단 기록
- [x] meal mutation: 끼니(아침/점심/저녁/간식), 영양소(탄/단/지/야채/물), 메모
- [x] 사진 업로드 (storagePut) — 다중 사진
- [x] 입력값 기반 즉시 자동 피드백 (탄수화물 미입력, 물 부족 등) — 한국어 톤
- [x] AI 코멘트: invokeLLM 호출하여 영양 균형/칼로리/개선안 코멘트 생성 후 저장
- [x] 식단 상세 카드 (피드/Today)

## 6. 운동 기록
- [x] exercise mutation: 종류, 시간(분), 강도(낮음/보통/높음), 메모
- [x] 일별 운동 리스트

## 7. 공유 피드
- [x] 오늘 날짜 기준 모든 멤버의 기록 합본 query (체중/식단(사진)/운동)
- [x] 카드형 피드 UI
- [x] 좋아요/이모지 응원 mutation (toggle)
- [x] 댓글 mutation & 리스트

## 8. 개인 대시보드
- [x] 통합 뷰: 체중 추이, 식단 영양소 누적, 운동 시간 추이
- [x] 목표 체중 달성률 진행 바 (시작/현재/목표 기반)
- [x] 기간 필터 (7/30/90/ALL)

## 9. 관리자 일별 리포트
- [x] 오늘 미수행 항목 집계 query (체중 X, 식단 X, 운동 X)
- [x] '이름 : 미수행 항목' 텍스트 포맷
- [x] 관리자 전용 리포트 페이지

## 10. 자동 알림 (Heartbeat)
- [x] /api/scheduled/dailyReminder 핸들러 — 미수행 멤버 요약을 관리자(소유자)에게 notifyOwner로 발송
- [x] 관리자 콘솔에서 cron 등록/수정/삭제 (admin.upsertReminder / deleteReminder)
- [x] morning/evening 두 슬롯 지원
- [x] 현재 알림 방식: 관리자 채널로 미수행 멤버 요약 발송 (notifyOwner). 멤버 개인별 푸시 알림은 향후 백로그 항목으로 관리

## 11. PWA
- [x] manifest.webmanifest
- [x] meta theme-color, viewport, mobile-web-app-capable
- [x] Apple touch icon 메타 (favicon)

## 12. 테스트 & 마무리
- [x] vitest로 자동 피드백 로직 테스트 (7건)
- [x] vitest로 shared utils 테스트 (5건)
- [x] vitest로 auth.logout 테스트 (1건) — 총 13건 통과
- [x] 빈/로딩/에러 상태 UI
- [x] 체크포인트 1회 (배포 직전)

## 13. 사용자 요청 — 폰트 가독성 & 구글 로그인 (2026-05-17)
- [x] 본문/UI 폰트를 Pretendard(fallback: Noto Sans KR, Apple SD Gothic Neo, 맑은 고딕)로 전면 교체
- [x] 헤드라인은 굵기/자간을 조정해 절제된 무게감으로 우아함 유지
- [x] index.css의 폰트 토큰 및 editorial-* 클래스 톤 다운 (한글 italic 가독성 보완 포함)
- [x] 사인인 화면에 "Google으로 계속하기" 버튼 + 구글 로고 아이콘 추가
- [x] 그래도 헷갈리지 않도록 "구글 계정으로 간편하게 로그인" + 승인 흐름 안내문 추가
- [x] vitest 13건 모두 통과, TypeScript 오류 없음

## 14. 사용자 요청 — 인바디 사진 업로드 + 자동 인식 (완료 2026-05-17)
- [x] weights 테이블에 inbodyPhotoKey, inbodyPhotoUrl, skeletalMuscleKg, bodyFatPercent 컬럼 추가
- [x] drizzle 마이그레이션 생성 + DB 적용
- [x] server/inbody.ts: LLM 비전으로 체중/골격근량/체지방률 JSON 추출
- [x] inbody 추출 함수 vitest 7건 (정상/노이즈/실패 케이스)
- [x] tRPC weights.upsert에 인바디 사진 + skeletalMuscleKg + bodyFatPercent 입력 필드 추가
- [x] tRPC weights.analyzeInbody 추가 — 사진을 받아 S3 탁아보관 후 즉석 분석 반환
- [x] Today 체중 섹션에 사진 업로드 input + 분석 로딩 + 추출값 자동 채움 + 수정 가능
- [x] 사진은 항상 함께 저장되어 위변조 방지 증거로 멤버들에게 공유
- [x] 공유 피드 체중 카드에 인바디 썸네일, 골격근량, 체지방률 노출
- [x] 개인 대시보드에 골격근량 · 체지방률 이중축 추이 차트 추가
- [x] vitest 20건 통과, TypeScript 오류 없음

## 15. 사용자 요청 — 13일 챌린지 시즌 시스템 (완료 2026-05-17)
- [x] seasons / seasonParticipants 테이블 추가 + 마이그레이션 적용
- [x] db.ts 헬퍼: createSeason / endSeason / getActiveSeason / listSeasons / ensureParticipant / listParticipants / getLatestWeightInRange
- [x] server/seasons.ts 도메인 헬퍼 (Day N, 카운트, 감량 %, 자동 베이스라인, ensureActiveSeasonAutoEnd)
- [x] tRPC seasons 라우터: current / list / create / close / myProgress / leaderboard / reveal
- [x] weights.upsert 시 시즌 자동 참가 + baselineWeightKg 자동 캐쳐
- [x] /ranking 페이지 — 실시간 랭킹, 본인 강조, 30초 자동 갱신
- [x] /reveal 페이지 — 마지막 날 또는 종료 후만 카운트 공개, 잠금 시 D-카운트 표시
- [x] Today 상단 시즌 배너 — Day N + 인증 카운트 + 감량 %
- [x] AppLayout 네비게이션에 RANKING / REVEAL 추가
- [x] Admin → SEASONS 탭에서 시즌 생성 / 즉시종료 / 이력 관리
- [x] vitest 25건 모두 통과 (시즌 5건 포함)
- [x] TypeScript 오류 0건

## 16. 사용자 요청 — Day 표기 / Before·After / 결과 리포트 / 공개 범위 (완료 2026-05-17)
- [x] Day N / D-K 표기: Today 시즌 배너·Ranking 헤더·Reveal 기존 적용 상태 유지 (활성 시즌 없으면 자동 숨김)
- [x] drizzle 스키마: `seasonPhotos` 테이블 추가 (id, seasonId, userId, dayNumber, slot: before|progress|after, angle: front|side, photoKey, photoUrl, createdAt) — before/after 중복은 db.ts upsertSeasonPhoto 애플리케이션 레벨에서 (slot,angle)별 기존 행 제거 후 삽입으로 보장
- [x] drizzle 스키마: `seasonReports` 테이블 추가 (id, seasonId, userId, baselineWeightKg, finalWeightKg, lossPercent, finalSkeletalMuscleKg, finalBodyFatPercent, weightCount, mealCount, exerciseCount, totalCount, completed, participationScore, reflection, isPublic default true, generatedAt, updatedAt)
- [x] DB 마이그레이션 0004 파일 생성 및 적용
- [x] db.ts 헬퍼: listSeasonPhotos / upsertSeasonPhoto / deleteSeasonPhoto / getSeasonReport / upsertSeasonReport / updateSeasonReportReflection / listSeasonReports
- [x] tRPC seasons 라우터 확장: myPhotos, uploadPhoto(slot/angle/base64) — BEFORE는 Day 1, AFTER는 마지막 날에만 허용, deletePhoto, myReport, saveReflection, publicReports
- [x] Today 페이지에 SeasonPhotosSection 추가: BEFORE(전/측) · PROGRESS(매일) · AFTER(전/측) 주니패널, 교체/삭제, 업로드 상태 UI
- [x] 사진 업로드 안내 문구 "가급적 전신이 다 나오도록 촬영해 주세요" 명시
- [x] /season-report 페이지(개인 결과 리포트): 잠금(활성 시즌)/D-카운트 안내, 공개 상태(종료 시즌)에서 핵심 메트릭 3칬·Before/After 4컷·체중·골격근·체지 추이 차트·카테고리 인증 카운트·소감 작성/공개 토글
- [x] Reveal 페이지에 CommunityReports 섹션 통합: 멤버별 체중 변화(베이스라인→최종 + %), 카테고리 인증 카운트, 공개 소감 그리드 — 사진/식단 상세는 비공개
- [x] App.tsx에 /season-report · /report 라우트 추가, AppLayout 네비게이션에 REPORT 항목 추가
- [x] 마지막 날(Day 13) 또는 시즌 종료 이후에만 공개 상태 접근, 그 전엔 잠금 안내(D-카운트)
- [x] vitest 25건 통과 유지, TypeScript 오류 0건
- [x] 시즌 종료 시 모든 참가자 seasonReports 자동 생성/갱신 — server/seasons.ts에 generateSeasonReports(seasonId) 헬퍼 추가, seasons.close · seasons.reveal(자동 종료/마지막 날) · seasons.publicReports에서 호출하여 리포트를 멤버 접근 동작과 무관하게 완전하게 채운다 (reflection/isPublic은 기존 값 유지)

## 17. 사용자 요청 — 헤드라인 / 수면 기록 / 체중 변화 코멘트 (완료 2026-05-17)
- [x] Today 페이지 최상단 헤드라인을 "오늘의 기록"에서 "어제 노력의 결과"로 변경
- [x] drizzle 스키마: `sleeps` 테이블 추가 (id, userId, recordedDate, bedAt, wakeAt, durationMinutes, bedHour, bedMinute, wakeHour, wakeMinute, createdAt, updatedAt) — (userId, recordedDate) 인덱스 + db.upsertSleep으로 일별 1행 보장
- [x] DB 마이그레이션 0005 생성 및 적용
- [x] db.ts 헬퍼: upsertSleep / listSleepsByUser / getSleepByDate
- [x] tRPC sleep 라우터: byDate / list / upsert(bed/wake hour·min → durationMinutes 자동 계산 + 평가 메시지 반환) / preview
- [x] 수면 평가 헬퍼 evaluateSleep: 5시간 미만 또는 자정 이후 취침 → 위험 멘트, 7시간 이상 + 22:30 이전 취침 → 칭찬, 그 외 빈 메시지
- [x] Today에 SleepSection 추가 (체중 다음 위치): 취침/기상 휠 드래그(시 1h, 분 10min step), 선택 즉시 수면시간/상태/코멘트 자동 표시, 최근 7일 미니 트렌드 (위험=빨강 / 보통=주황 / 안전=초록)
- [x] 체중 입력 후 어제 대비 변화량 코멘트: 감량 "-100g 삭제 성공. 오늘 이걸 망칠 순 없다!" / 증량 "+100g 지금은 다지는 중. 오늘 이걸 만회할 수 있다!" / 동일은 코멘트 미노출
- [x] Dashboard에 SLEEP 섹션 추가: BarChart, 5h/7h ReferenceLine, 위험/보통/안전 색 셀 + 범례
- [x] vitest 14건 추가 (총 45건 통과): computeSleepMinutes / isPastMidnightBed / isEarlyBed / evaluateSleep 경계값 / weightDeltaComment 분기
- [x] TypeScript 오류 0건


## 18. 사용자 요청 — 인바디 사진 갤러리 첨부 / 운동 기록 섹션 분리 (완료 2026-05-17)
- [x] 인바디 사진 input: capture="environment" 속성 제거해 이제 욹돘·캠라 메뉴가 아닌 몇닜일 갤러리를 우선으로 열도록 수정
- [x] 시즌 비포/애프터/프로그래스 사진 input 전체에서 capture 속성 제거 — 갤러리 선택 가능
- [x] Today: 기존 Tabs 구조 해체, 식단·운동을 각각 독립 섹션으로 분리 (02 · MEALS / 03 · EXERCISE eyebrow + 세션 구분선) — "식단 기록" · "운동 기록" 동일 큰 제목 위계
- [x] vitest 45건 통과, TypeScript 오류 0건


## 19. 사용자 요청 — 기수 시스템 / 진행 중 카운팅 비공개 / 역대 챌린지 아카이브 (완료 2026-05-17)
- [x] drizzle 스키마: seasons에 seasonNumber, totalDays 컴럼 추가, 마이그레이션 0006 적용 + 기존 시즌에 자동 번호 부여
- [x] db.ts: countSleepDaysInRange 추가, getMyCounts에 sleep 카운트 포함
- [x] tRPC seasons.create: totalDays 입력(13/30/커스텀) 받고 다음 N+1 기수 자동 부여, endDate = startDate + (totalDays-1)
- [x] tRPC seasons.adminLiveCounts: 관리자 전용 — 진행 중 시즌의 인증 카운트 랭킹 (체중·식단·운동·수면 합계로 1등 결정)
- [x] tRPC seasons.archive / archiveDetail: 종료된 시즌 목록 + 시즌별 감량%·인증 카운트·소감·챔피언 통합 반환
- [x] Ranking 페이지: 일반 멤버에게는 leaderboard·인증 카운트 랭킹 잠금 ("1등과 인증 카운트는 시즌 마지막 날에 공개") + 관리자에게만 전체 노출 + 인증 카운트 ADMIN ONLY 섹션
- [x] Admin SeasonsAdmin: 챌린지 길이 13/30/커스텀 토글, 자동 N기 시즌 이름 프리필, 종료일 동적 계산, 히스토리에 N기·일수 표기
- [x] /archive 페이지(Archive.tsx): 역대 챌린지 카드 리스트 → 상세(메달 1·2·3등, 감량%, 인증 카운트, 소감) 모두 공개
- [x] App.tsx에 /archive 라우트 + AppLayout 네비에 ARCHIVE 항목 추가
- [x] vitest 45건 통과, TypeScript 오류 0건


## 20. 사용자 요청 — 체중칸 프리필 제거 / 인바디 카드 캡처 인식 강화 (2026-05-17)
- [x] Today 체중 섹션: 어제 체중·골격근량·체지방률 자동 프리필 제거, 첫 진입 시 모든 입력칸을 빈 문자열로 시작 (placeholder도 숫자 → "직접 입력 (kg/%)"으로 변경해 "이미 채워진 것처럼 보이는" 혼선 제거)
- [x] 인바디 사진을 분석한 경우에만 추출값으로 자동 채우고, 그 외에는 손으로 직접 입력 (기존 동작 유지 확인)
- [x] 어제 대비 변화량 코멘트는 입력값 우선 (placeholder는 더 이상 숫자가 아니므로 혼동 없음)
- [x] server/inbody.ts: 시스템 프롬프트를 카드형 캡처 + 인바디 공식 결과지에 특화하도록 강화 (한국어·영어 라벨 매핑, 큰 폰트+작은 소수 합치기 규칙, kg/%/lbs 단위 구분, 골격근량 vs 체지방 혼동 방지)
- [x] 단위·범위 보정 유지 (체중 20~300kg, 골격근량 5~80kg, 체지방률 1~70% 외 null 클램프)
- [x] 인식 실패 토스트를 "자동 인식이 어려웠어요. 사진을 다시 올리거나 수치를 직접 입력해 주세요."로 정정하고 부분/완전 인식 분기 메시지 추가, 사진은 그대로 유지하면서 직접 입력 가능 + 안내 카피에 "세 수치가 한 화면에 모두 들어온 카드형 요약 캡처 또는 인바디 공식 결과지를 권장" 문구 추가
- [x] vitest 48건 통과 (카드형 57.8 케이스 / lbs형 과대수치 클램프 / 부분 인식 케이스 추가)
- [x] TypeScript 오류 0건 + all-null 시 OCR 레이어링 프롬프트로 1회 자동 재시도 추가


## 21. 사용자 요청 — 수면 칭찬 제거 / 식사·물·운동 분리 / 식사 카테고리 / 물 인증 (2026-05-17)
- [x] sleep evaluate: 7시간↑ + 22:30 이전 칭찬 메시지 제거 (오래 자도 좋다 인지 방지), 위험 메시지만 유지
- [x] Today 섹션 순서: 식사 기록 → 물 기록 → 운동 기록으로 재배치 (eyebrow 02 · MEALS / 03 · WATER / 04 · EXERCISE)
- [x] drizzle 스키마: meals.category enum("regular" | "smoothie") 추가, 기본값 "regular"
- [x] drizzle 스키마: waters 테이블 신설 (id, userId, recordedDate, recordedAt, volumeMl, photoKey, photoUrl, createdAt)
- [x] 마이그레이션 0007 생성 및 적용
- [x] db.ts 헬퍼: createWater / listWatersByDate / sumWaterMlByDate / countWatersInRange / deleteWater
- [x] tRPC waters 라우터: byDate / multiCreate / delete / myRange (용량 300–1000ml 100ml step 검증)
- [x] meals 라우터: category 입력 받아 저장, 스무디는 사진만 허용, 사진 N장 클라이언트 반복 전송으로 N건 인증 구현 (max 8장)
- [x] Today 식사 섹션: 카테고리 토글(일반식/스무디) 키 추가, 일반식 → 영양소·메모 표시 + 사진 최대 4장, 스무디 → 사진 최대 8장 (장당 인증 1회)
- [x] Today 물 섹션 신설: 사진 N장 + 용량 선택(300–1000ml, 100ml step), 오늘 누적 ml 진행바·큰 카운터(목표 2000ml 기준), 카드 리스트 + 삭제
- [x] Dashboard에 물 섭취 추이 차트(일별 누적 ml, 2L 기준선 + 1L·1–2L·2L↑ 3단 색상) 추가
- [x] 시즌 인증 카운트(getMyCounts)에 water 인증 일수 포함, Today 시즌 배너/Ranking 카드/관리자 라이브 카운트에 물 츎럼 추가
- [x] vitest: sleep 메시지 분기(칭찬 제거 + 새벽·과수면 케이스), water 100ml step 검증 · 누적 합계 · 일자별 그룹핑 (waters.test.ts 7건 추가)
- [x] TypeScript 무결성 (tsc --noEmit 0건) + vitest 총 57건 통과


## 22. 사용자 요청 — 수면 취침 휠 범위 확장 (2026-05-17)
- [x] Today SleepSection: 취침 시각 휠을 0~23시 전체로 늘려 새벽(0/1/2/3/4/5시)에 잠드는 사용자도 자연스럽게 선택 가능
- [x] 휠 표시 순서를 자연 흐름으로 재구성 (낮 들고/새벽 0–5시 동그라다이시 통과)
- [x] 자정 이후 취침 판정/표시 검증 (evaluateSleep 결과 그대로 위험 메시지 출력)
- [x] vitest: 새벽 취침 케이스(0:30 / 3:00 등) 분기 테스트 (sleep.test.ts 경계값 포함 16건 통과)


## 23. 사용자 요청 — 시즌 결과 리포트에도 물·수면 카운트 반영 (2026-05-17)
- [x] drizzle 스키마 seasonReports에 sleepCount/waterCount 컬럼 추가, 마이그레이션 0008 생성·적용
- [x] server/seasons.ts generateSeasonReports에서 sleepCount/waterCount 저장 (기존 reflection/isPublic 보존 유지)
- [x] tRPC seasons.publicReports 반환에 sleepCount/waterCount 포함 (구버전 row 호환을 위해 ?? 0)
- [x] /season-report 페이지: COUNTS 그리드를 4 → 6칸으로 확장하고 물·수면 타일 추가
- [x] /archive 상세 인증 카운트 라인에 "물 N" 라벨 추가
- [x] vitest 57건 / tsc --noEmit 0건 유지


## 24. 사용자 요청 — 인바디 카드형 캡처(57.8/23.7/24.8) 자동 인식 실패 (2026-05-17)
- [x] 사용자 제공 실패 캡처 분석: 카드 3분할(체중 kg / 골격근량 kg / 체지방률 %) + 큰 정수 + 작은 소수 + 하단 꺾은선 그래프(Y축 58.0/59.0/60.0/61.0) 동시 노출 케이스 식별
- [x] server/inbody.ts 시스템 프롬프트에 '카드형 우선 규칙' 섹션 신설: 큰 정수+작은 소수 병합, '표준/낮음/높음' 배지 무시, 꺾은선 차트·날짜 툴팁·Y축 레이블 무시, 툴팁과 카드 양쪽에 동일 수치 시 카드 우선, few-shot 예시 포함
- [x] analyzeInbodyImage를 1차(기본) → 2차(OCR-leaning, 차트 무시 명시) → 3차(카드 영역 전용 강한 제약) 3단 재시도 구조로 강화, isAllNull 헬퍼 추출
- [x] 부분 인식(일부 null) 응답은 그대로 신뢰하고 토스트로 "일부 인식" 안내 — 기존 동작 유지 확인
- [x] vitest: 차트 노이즈 회귀 케이스 2건 추가(카드 우선/61.0 Y축 조심) → inbody.test.ts 12건 통과, 전체 59건 통과 / tsc 0건
- [x] Today.tsx 안내 카피와 실패 토스트를 "카드 3개만 보이도록 잘라서 올리면 가장 잘 인식 / 자동 인식 실패 시 직접 입력 후 사진만 증거로 첨부해도 OK"로 업데이트
- [x] tsc 0 + vitest 59건 통과 + 체크포인트 저장


## 25. 사용자 요청 — 인바디 인식 v24도 같은 사진에서 또 실패 (2026-05-17)
- [x] server/inbody.ts: 1·2·3·4차 raw 응답을 [Inbody:1-default|2-ocr|3-card|4-ocrThenExtract] 태그로 console.log 신설
- [x] 재시도 트리거 강화: isComplete 헬퍼로 "세 가지 중 하나라도 null이면 다음 단계"로 재설계, pickBest로 가장 많이 채워진 단계의 결과를 선택
- [x] 4차 프롬프트 신설(invokeOcrThenExtract): _ocr 필드(자유 서술)로 사진 내 라벨·숫자를 적게 한 뒤, 그 텍스트에서 체중(kg)/골격근량(kg)/체지방률(%) 라벨 옆 숫자만 추출 — 차트 Y축/투틁 배제 명시
- [x] Today.tsx 클라이언트 전처리 normalize() 추가: 장변 1600px 타겟(장은 이미지는 업스케일, 큰 이미지는 다운스케일) + 하얀 배경 패딩 + image-rendering high-quality + JPEG 92% 로 재인코딩
- [x] 1차적으로 console.log [Inbody:*] 태그로 서버 로그에 남아 webdev_check_status·로그 도구로 조회 가능 (추후 inbodyAttempts 테이블 올릴 수 있도록 구조는 동일하게 유지)
- [x] vitest: 59건 전체 통과 (parseInbodyJson은 추가 필드를 무시하는 구조라 _ocr 포함 응답도 곧바로 읽혀 기존 케이스가 그대로 적용됨)
- [x] tsc 0 + vitest 59건 통과 + 체크포인트 저장
