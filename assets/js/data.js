/* ============================================================================
   운명사주 정운타임즈 · data.js — 지면 구성 · 코너 · 지면 부속 콘텐츠
   ========================================================================== */
'use strict';

const SITE  = 'https://news.22jutimes.com/';
const KAKAO = 'https://pf.kakao.com/_TguvX/chat';
const LANDING = 'https://22jutimes.com/';
const EMAIL = '22jutimes@gmail.com';

const BRAND = {
  name: '운명사주 정운타임즈',
  sub: '22간지로 읽는 사주신문',
  slogan: '운명사주, 정운이 풀다',
  en: 'JUNGWOON TIMES'
};

/* ---------- 가로 카테고리 탭 ---------- */
const CATS = [
  { id:'main',    ko:'메인',        route:'#/',            en:'MAIN',    desc:'운명사주 정운타임즈 1면' },
  { id:'today',   ko:'오늘의운세',  route:'#/today',       en:'FORTUNE', desc:'오늘의 간지와 내 기운' },
  { id:'people',  ko:'화제의인물',  route:'#/people',      en:'PEOPLE',  desc:'지금 뜨는 사람의 여덟 글자' },
  { id:'mbti',    ko:'MBTI궁합',    route:'#/mbti',        en:'CHEMISTRY', desc:'네 글자로 읽는 인연' },
  { id:'money',   ko:'사주·재물',   route:'#/money',       en:'WEALTH',  desc:'돈의 그릇과 때' },
  { id:'dream',   ko:'어젯밤그꿈',  route:'#/dream',       en:'DREAMS',  desc:'꿈 상징 사전' },
  { id:'past',    ko:'전생',        route:'#/past',        en:'PAST LIFE',desc:'반복되는 습관의 뿌리' },
  { id:'shop',    ko:'운부르는것들',route:'#/shop',        en:'OBJECTS', desc:'개운 소품과 동양의 부적' },
  { id:'program', ko:'사주프로그램',route:'#/program',     en:'PROGRAM', desc:'만세력·자미두수 분석 프로그램 · 1년 이용권', point:true },
  { id:'fourp',   ko:'무료 4P',    route:'#/4p',          en:'4P',       desc:'내 사주로 바로 읽는 네 장 · 무료', point:true }
];

const CAT_KO = CATS.reduce((m,c)=>{ m[c.id]=c.ko; return m; },{});

/* ---------- 1면 TOP 7 고정 순서 (2026-11-24 꿀잼 주제 개편) ----------
   이 목록이 있으면 조회수와 무관하게 1면 TOP 7이 이 순서로 고정됩니다.
   단, 2번 자리는 매일 05:30 새로 발행되는 '화제의 인물'(연예인 사주, cat:'people') 기사가
   자동으로 차지합니다(app.js top7Pick). 그래서 이 목록에서는 앞에서 6편만 쓰입니다.
   기사 본문은 assets/js/articles-top7.js */
const TOP7_PINNED = [
  'top7-mbti-t',        /* MBTI T인데 사주는 감성 폭발 — 16유형 × 일주 */
  'top7-dream-money',   /* 진짜 돈 들어오는 꿈 TOP 5 */
  'top7-money-2027',    /* 2027 정미년 횡재수 3띠 */
  'top7-love-gwiin',    /* 소개팅 3초 — 귀인·배우자 사주 */
  'top7-dream-warning', /* 경고 꿈 4가지 */
  'top7-work-money',    /* 월급쟁이 vs 내 사업 */
  'top7-gaewoon'        /* 생활 속 개운 습관 5가지 */
];

/* ---------- 속보 티커 ---------- */
const TICKER = [
  { cat:'MBTI궁합', text:'“T인데 왜 사주는 감성 폭발?”…16유형 × 일주 반전 매력 특집, 1면 톱' },
  { cat:'어젯밤그꿈', text:'돼지꿈보다 세다…옛 꿈사전이 ‘재물’이라 적은 다섯 장면' },
  { cat:'사주·재물', text:'2027 정미년, 12띠 중 횡재수 터지는 세 띠는 따로 있다' },
  { cat:'오늘의운세', text:'{day}日, 오늘의 기운이 도는 하루…오늘의 운세 매일 05:30 갱신' },
  { cat:'MBTI궁합', text:'소개팅 나가기 전 3초 — 귀인·배우자 사주 특징' },
  { cat:'운부르는것들', text:'현관 신발 세 켤레만…돈 새는 지갑 막는 생활 개운 습관 5' },
  { cat:'무료 4P', text:'무료 4P 맛보기 — 생년월일만 넣으면 내 여덟 글자로 네 장이 열립니다' }
];

/* ---------- 1면 추천 4P 안내 ---------- */
const PRICING = [
  { pages:'30P', name:'운명의 나침반', price:'19,900원', desc:'재물·애정·직업 3대 운 심층' },
  { pages:'60P', name:'운명의 지도',   price:'29,900원', desc:'월별 길흉·귀인·위기 대처' },
  { pages:'100P',name:'마스터 플랜',   price:'49,900원', desc:'평생 재물 그릇·인생 총정리' }
];

/* ---------- 푸터 ---------- */
const FOOTER = {
  company:'제이투포커스', ceo:'이혁', biz:'159-47-00699', mail:'2022-고양일산서-1589',
  addr:'경기도 고양시 일산서구 가좌2로 53, 302동 1703호 (가좌동, 가좌마을3단지아파트)', tel:'070-8027-1303', email: EMAIL,
  disc:'운명사주 정운타임즈의 모든 기사와 분석은 동양 명리학 전통과 상징 해석을 바탕으로 한 참고·오락 정보입니다. 미래의 결과를 보장하지 않으며, 의료·투자·법률 등 중요한 결정의 근거로 삼을 수 없습니다. 기사에 등장하는 사례는 독자의 이해를 돕기 위한 재구성으로, 실제 인물과 무관할 수 있습니다.'
};

/* ---------- 꿈 상징 사전 (간단) ---------- */
const DREAM_WORDS = [
  { k:'달',   mean:'귀인·명예',    line:'달이 밝게 뜨면 도와주는 사람이 가까이 있다는 옛 해석이 있습니다.' },
  { k:'물',   mean:'재물·감정',    line:'맑은 물은 재물, 흐린 물은 감정의 소용돌이로 읽습니다.' },
  { k:'돼지', mean:'재물·복',      line:'돼지가 집으로 들어오는 꿈은 오래전부터 재물의 상징이었습니다.' },
  { k:'뱀',   mean:'지혜·전환',    line:'뱀은 허물을 벗는 존재라 삶의 국면 전환으로 읽습니다.' },
  { k:'용',   mean:'승진·큰일',    line:'용은 큰 흐름을 타는 상징, 미뤄둔 일을 시작하기 좋은 때입니다.' },
  { k:'불',   mean:'열정·소문',    line:'불이 잘 타오르면 의욕, 연기가 많으면 소문을 조심합니다.' },
  { k:'옛집', mean:'미련·정리',    line:'옛집 꿈은 아직 정리하지 못한 마음의 방을 보여줍니다.' }
];
