# 정운타임즈 · 운명사주22

신문사 포털 형태의 사주 콘텐츠 사이트입니다. 마이데일리·뉴시스·일간스포츠 같은 **화이트 지면 + 마스트헤드 + 가로 카테고리 탭 + 속보 티커 + 톱기사 + 썸네일 리스트 + Top 7 랭킹 + 기사 상세** 구조로 만들었습니다.

## 지면

| 지면 | 경로 |
| --- | --- |
| 1면(메인) | `#/` |
| MBTI궁합 | `#/mbti` |
| 오늘의운세 | `#/today` |
| 사주·재물 | `#/money` |
| 어젯밤그꿈 | `#/dream` |
| 전생 | `#/past` |
| 화제의인물 | `#/people` |
| 운부르는것들 | `#/shop` |
| 운명연구소 | `#/lab` |
| 990원 4P | `#/4p` |
| 무료 1분 분석 | `#/free` |
| 기사 상세 | `#/article/{id}` |

## 폴더

```
index.html                지면 셸 (티커 · 마스트헤드 · 탭 · 설치 버튼 · 푸터)
manifest.json             PWA 매니페스트 (standalone · 아이콘 · 바로가기)
service-worker.js         앱 셸 캐시 + 네트워크 우선 문서 캐싱
assets/css/paper.css      신문 지면 스타일
assets/js/engine.js       만세력·오늘의 운세·궁합·전생 계산 (KASI 절기 기반)
assets/js/data.js         코너·티커·요금·푸터 문구
assets/js/articles-1..3.js 기사 24편 (각 20~30줄 이상 본문)
assets/js/app.js          해시 라우터 · 지면 렌더 · 위젯 · 4P 뷰어 · PWA 설치
assets/img/*.webp         동양 감성 이미지 16종
assets/icons/*            PWA 아이콘 (192/512/maskable/apple-touch)
4p/01..04.html            990원 4P 샘플 4종 (마지막 페이지에 30~100P CTA 삽입)
```

## 4P 뷰어

- 4가지 버전(정밀 5장판 2종, 요약 3장판 2종)을 탭으로 전환합니다.
- 휴대폰 프레임 안에서 스크롤되며, `새 창에서 크게 보기`·`인쇄용으로 열기`를 제공합니다.
- 각 4P의 마지막에 **찐 정밀 전문분석지 30P·60P·100P → https://adorable-gaufre-c07661.netlify.app/** 링크가 들어 있습니다.
- 100P 가격은 확정 요금(49,900원)으로 통일했습니다.

## 앱 설치(PWA)

- 안드로이드 크롬: `beforeinstallprompt`를 잡아 상단 **[📲 앱 설치 / 바로가기]** 버튼에서 바로 설치 팝업을 띄웁니다.
- iOS 사파리 등 미지원 브라우저: `공유 → 홈 화면에 추가` 안내 모달을 띄웁니다.
- 이미 설치(standalone) 상태에서는 설치 버튼이 숨겨집니다.

## 배포

`hukstory/saju-project22` `main` → GitHub Pages (`https://hukstory.github.io/saju-project22/`)

사업자: 제이투포커스 · 대표 이혁 · 159-47-00699 · 2022-고양일산서-1589 · 경기도 고양시 일산서구 가좌동 1088
