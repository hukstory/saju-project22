# 정운타임즈 (JUNGWOON TIMES)

> 운명사주, 정운이 풀다 — 사주로 오늘과 사람과 꿈을 읽는 라이프스타일 매거진 포털

정적 사이트(HTML/CSS/JS)입니다. 빌드 도구 없이 `index.html`을 열면 바로 동작합니다.

## 구조

```
index.html          매거진 셸 — 이슈 바, 마스트헤드, 내비, 모달·드로어 루트
styles.css          크림 지면 · 딥 블랙 · 버건디 · 로열 골드 디자인 시스템
js/engine.js        간지·사주 계산(KASI 절기·음양력 로직), 오늘의 운세, MBTI, 전생, 공유 카드(canvas)
js/data.js          표지·코너 메타, 운명연구소 49유형, 정운연예·정운스포츠 칼럼, 화제의 사주, 요금제
js/data2.js         꿈 상징 사전 88편
js/data3.js         운 부르는 것들 큐레이션(오행 15 + 풍수 3 + 사주 책 3)
js/app.js           해시 라우터 · 6개 코너 화면 · 공유 카드 · 990원 모달
assets/img/         생성한 에디토리얼 커버 아트(webp)
saju-program-preview.html  만세력·자미두수 프로그램 체험판
qa/verify_magazine.py      Playwright 검수 스크립트(50개 체크)
```

## 라우트

| 라우트 | 코너 | 무료 결과 | 바이럴 |
| --- | --- | --- | --- |
| `#/today` | 오늘 내 운명 | 1분 운세·행운 색/숫자·한 줄 조언 | 행운 색 카드 공유 |
| `#/people` | 화제의 사주 | 유형별 사주 분석 8종 + 칼럼 | 그 유형 사주 공유 |
| `#/mbti` | MBTI 궁합 | 궁합 점수·케미 리포트 + 생년월일 조합 | 친구 3명 → 숨은 궁합 |
| `#/dream` | 어젯밤 그 꿈 | 상징 풀이·길흉·행운 번호 | 행운 번호 카드 공유 |
| `#/pastlife` | 전생 | 전생 유형·남은 습관 | 친구 3명 → 숨은 전생 |
| `#/shop` | 운 부르는 것들 | 부족한 오행 맞춤 큐레이션 | 리포트 업셀 |

퍼널: 무료 체험 → 공유 카드 → 990원 4P 맛보기 → 정밀 PDF(30P/60P/100P, 운명사주 아우라).

## 배포

`main` 브랜치 루트 = GitHub Pages (`https://hukstory.github.io/saju-project22/`).

## 검수

```bash
LD_LIBRARY_PATH=/workspace/.cache/locallibs/usr/lib/x86_64-linux-gnu \
  python3 qa/verify_magazine.py
```

- 콘솔 에러/경고 0
- 데스크톱 1440 · 모바일 390 레이아웃, 6개 라우트, 공유 카드, 990원 모달, 잠금 해제, 49유형 테스트 검사
- 금지 표현(사행성 단어) 미사용, 사업자 정보·카카오 링크 존재 확인
