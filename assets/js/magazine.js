/* ============================================================================
   운명사주 정운타임즈 · magazine.js — 1면 매거진 · 8컷 만화 · 미니게임 콘텐츠
   (2026-11-25 개편) 지면 모아보기 아래에 붙는 '볼거리' 데이터.
   이미지·기사는 기존 아카이브(ARTICLES)를 그대로 쓰고, 여기서는 제목·요약만 새로 쓴다.
   외부 유료 API 없음 — 만화는 SVG, 게임은 순수 JS.
   ========================================================================== */
'use strict';

/* ---------- 매거진 픽 (커버 3 + 그리드 9) ----------
   id  : ARTICLES 안의 기사 id (없으면 카드가 자동으로 빠진다)
   img : 카드에 쓸 이미지 이름(assets/img/*.webp). 비우면 기사 이미지. */
const MAG_FEATURED = [
  { id:'money-2027', img:'money-main', kicker:'커버스토리',
    hook:'2027년, 돈이 트이는 사람과 막히는 사람',
    sum:'정미년은 불이 흙을 낳는 해. 그릇이 커지는 사주에는 공통점이 있다 — 재성이 어디에 앉았는지, 식상이 그 재성을 받쳐 주는지. 세 가지만 보면 내 그릇이 보인다.' },
  { id:'top7-dream-money', img:'dream-main', kicker:'어젯밤 그 꿈',
    hook:'돼지꿈보다 세다는 ‘진짜 돈 들어오는 꿈’ 5장면',
    sum:'옛 꿈사전이 재물로 적어 둔 장면은 돼지뿐이 아니었다. 문제는 꿈이 아니라 그다음 행동이라는 것.' },
  { id:'top7-love-gwiin', img:'people-sub', kicker:'MBTI궁합',
    hook:'소개팅 3초, 귀인인지 아닌지 갈리는 순간',
    sum:'배우자는 사주에서 일지 한 글자에 담긴다. 첫 3초에 드러나는 세 신호가 그 한 글자와 거의 같은 말을 한다.' }
];

const MAG_GRID = [
  { id:'mbti-tf', img:'mbti-sub', kicker:'MBTI궁합',
    hook:'T와 F는 싸우는 게 아니라 ‘번역’이 안 되는 것',
    sum:'같은 말을 듣고 한 사람은 해결책을, 한 사람은 위로를 원한다. 사주의 오행으로 다시 읽은 갈등의 구조.' },
  { id:'money-people', img:'money-sub', kicker:'사주·재물',
    hook:'돈이 들어오는 사람의 여덟 글자, 공통점 셋',
    sum:'성격보다 구조다. 재물 상담에서 반복해서 나온 세 가지 배열과, 내 사주에서 확인하는 법.' },
  { id:'dream-house', img:'dream-sub', kicker:'어젯밤 그 꿈',
    hook:'이사 앞두고 옛집 꿈이 반복되는 이유',
    sum:'옛집은 아직 정리하지 못한 마음의 방. 이사 전후에 유독 늘어나는 꿈의 구조를 살폈다.' },
  { id:'past-musician', img:'past-main', kicker:'전생',
    hook:'당신의 전생이 ‘궁의 악사’였다면 남는 습관',
    sum:'전생을 믿지 않아도 재미있는 이유는, 그 이야기가 지금의 습관을 비추기 때문이다. 열두 유형 중 하나.' },
  { id:'shop-turtle', img:'shop-main', kicker:'운부르는것들',
    hook:'황동 거북 한 마리를 책상 왼쪽에 두는 이유',
    sum:'거북은 오래 사는 것, 그리고 뒤를 지키는 것의 상징. 동양 개운법이 말하는 배치와 방향.' },
  { id:'lab-lucky', img:'lab-main', kicker:'운명연구소',
    hook:'‘운이 좋은 사람’은 무엇이 다른가 — 3년 관찰',
    sum:'세 가지 차이가 반복해서 나왔다. 그중 하나는 돈보다 먼저 바뀐다.' },
  { id:'today-10gan', img:'today-main', kicker:'오늘의운세',
    hook:'갑목부터 계수까지, 일간별 이번 주 흐름',
    sum:'같은 날이라도 일간에 따라 흐름은 다르다. 열 가지 과제와 행운 요소를 한 번에 정리했다.' },
  { id:'people-cycle', img:'people-actress', kicker:'화제의인물',
    hook:'왜 지금 다시 불리는가 — 재조명의 12년 주기',
    sum:'한 사람이 두 번 뜨는 데는 이유가 있다. 대운과 띠의 주기로 읽는 ‘재조명의 타이밍’.' },
  { id:'top7-gaewoon', img:'shop-sub', kicker:'개운 습관',
    hook:'부적 사기 전에 먼저 고쳐야 할 다섯 곳',
    sum:'현관 신발, 지갑 속 영수증, 침대 머리 방향. 동양 개운법이 가장 먼저 보는 자리들.' }
];

/* ---------- 사주 8컷 만화 ----------
   art : SVG 문자열 (320×200). 외부 이미지·유료 API 없이 지면에서 바로 그린다. */
const COMIC = {
  title: '재물운이 터지기 전 나타나는 사주 신호 8컷',
  dek: '돈이 들어오기 직전의 사람들에게는, 이상하게 비슷한 장면이 반복됩니다.',
  cuts: [
    { no:1, ttl:'새벽 4시, 이유 없이 눈이 떠진다',
      sig:'재성이 움직이기 전, 몸이 먼저 시간을 바꿉니다.',
      art:`<rect width="320" height="200" fill="#f8f3e6"/>
        <text x="26" y="42" font-family="monospace" font-size="20" font-weight="700" fill="#8a7c60" letter-spacing="1">04:00</text>
        <rect x="206" y="26" width="88" height="82" fill="#fdfaf2" stroke="#171513" stroke-width="2.4"/>
        <line x1="250" y1="26" x2="250" y2="108" stroke="#171513" stroke-width="2.4"/>
        <line x1="206" y1="67" x2="294" y2="67" stroke="#171513" stroke-width="2.4"/>
        <circle cx="272" cy="46" r="13" fill="#f0e2bd" stroke="#c9a86a" stroke-width="2"/>
        <path d="M26 172h268" stroke="#171513" stroke-width="2.4"/>
        <rect x="30" y="150" width="196" height="22" rx="3" fill="#f0e2bd" stroke="#171513" stroke-width="2.4"/>
        <rect x="30" y="112" width="16" height="60" rx="3" fill="#171513" opacity=".12" stroke="#171513" stroke-width="2.2"/>
        <rect x="52" y="126" width="46" height="18" rx="8" fill="#fffdf7" stroke="#171513" stroke-width="2.2"/>
        <circle cx="72" cy="126" r="13" fill="#171513" opacity=".65"/>
        <path d="M96 150v-12c0-18 20-28 46-28s54 10 62 28v12z" fill="#fffdf7" stroke="#171513" stroke-width="2.4"/>
        <path d="M104 128c14 8 40 12 66 8" fill="none" stroke="#c9a86a" stroke-width="2.6" stroke-linecap="round"/>
        <rect x="240" y="140" width="34" height="32" rx="3" fill="none" stroke="#171513" stroke-width="2.2"/>
        <path d="M240 156h34" stroke="#171513" stroke-width="2"/>` },
    { no:2, ttl:'지갑 속 잔돈이 자꾸 정리된다',
      sig:'작은 돈부터 세기 시작하면 재성(財星)이 깨어나는 신호입니다.',
      art:`<rect width="320" height="200" fill="#f8f3e6"/>
        <rect x="60" y="64" width="200" height="104" rx="10" fill="#fffdf7" stroke="#171513" stroke-width="2.4"/>
        <rect x="60" y="64" width="200" height="26" rx="10" fill="#171513" opacity=".08"/>
        <rect x="146" y="112" width="30" height="22" rx="4" fill="#c9a86a" stroke="#171513" stroke-width="2"/>
        <circle cx="112" cy="46" r="17" fill="#f0e2bd" stroke="#c9a86a" stroke-width="2.4"/>
        <circle cx="112" cy="46" r="6" fill="none" stroke="#c9a86a" stroke-width="2"/>
        <circle cx="150" cy="34" r="14" fill="#f0e2bd" stroke="#c9a86a" stroke-width="2.4"/>
        <circle cx="184" cy="48" r="12" fill="#f0e2bd" stroke="#c9a86a" stroke-width="2.4"/>
        <path d="M84 132h46M84 148h30" stroke="#b8ac90" stroke-width="3" stroke-linecap="round"/>` },
    { no:3, ttl:'10년 만에 잊고 있던 이름에게서 연락이 온다',
      sig:'귀인은 낯선 곳이 아니라, 잊고 있던 이름에서 옵니다.',
      art:`<rect width="320" height="200" fill="#f8f3e6"/>
        <rect x="112" y="30" width="96" height="150" rx="12" fill="#fffdf7" stroke="#171513" stroke-width="2.4"/>
        <rect x="124" y="52" width="72" height="30" rx="8" fill="#171513" opacity=".1"/>
        <rect x="124" y="92" width="58" height="26" rx="8" fill="#c9a86a" opacity=".45"/>
        <circle cx="160" cy="166" r="5" fill="#171513" opacity=".3"/>
        <path d="M52 44h46a10 10 0 0 1 10 10v18a10 10 0 0 1-10 10H72l-14 12V82h-6a10 10 0 0 1-10-10V54a10 10 0 0 1 10-10z" fill="#fffdf7" stroke="#171513" stroke-width="2.4"/>
        <path d="M224 118h40a10 10 0 0 1 10 10v14a10 10 0 0 1-10 10h-4v12l-12-12h-24a10 10 0 0 1-10-10v-14a10 10 0 0 1 10-10z" fill="#f0e2bd" stroke="#c9a86a" stroke-width="2.4"/>` },
    { no:4, ttl:'미뤄 둔 서류에 사인을 한다',
      sig:'관성(官星)이 정리되는 달 — 도장 찍을 일이 줄줄이 생깁니다.',
      art:`<rect width="320" height="200" fill="#f8f3e6"/>
        <rect x="46" y="42" width="150" height="126" rx="4" fill="#fffdf7" stroke="#171513" stroke-width="2.4"/>
        <path d="M64 68h100M64 86h114M64 104h92M64 122h70" stroke="#b8ac90" stroke-width="3" stroke-linecap="round"/>
        <path d="M150 148c14-10 30-6 34 4" fill="none" stroke="#171513" stroke-width="2.4" stroke-linecap="round"/>
        <circle cx="236" cy="112" r="30" fill="#b3261e" opacity=".12"/>
        <circle cx="236" cy="112" r="30" fill="none" stroke="#b3261e" stroke-width="2.6"/>
        <text x="236" y="121" text-anchor="middle" font-family="serif" font-size="22" font-weight="700" fill="#b3261e">印</text>
        <rect x="212" y="144" width="48" height="26" rx="5" fill="#fffdf7" stroke="#171513" stroke-width="2.4"/>
        <path d="M222 157h28" stroke="#171513" stroke-width="2.4"/>` },
    { no:5, ttl:'화분에서 새 잎이 나온다',
      sig:'식상(食傷)이 살아나는 신호 — 내가 만든 것이 밖으로 나갑니다.',
      art:`<rect width="320" height="200" fill="#f8f3e6"/>
        <path d="M40 166h240" stroke="#171513" stroke-width="2.4"/>
        <path d="M118 166l12-52h60l12 52z" fill="#f0e2bd" stroke="#171513" stroke-width="2.4"/>
        <path d="M160 114c0-26 0-42 0-56" stroke="#171513" stroke-width="2.6" fill="none"/>
        <path d="M160 84c-16 2-28-8-30-24 18-2 30 8 30 24z" fill="#c9a86a" stroke="#171513" stroke-width="2"/>
        <path d="M160 66c14 0 24-12 24-26-16 0-24 12-24 26z" fill="#c9a86a" opacity=".7" stroke="#171513" stroke-width="2"/>
        <path d="M146 176h28" stroke="#171513" stroke-width="2.4"/>
        <circle cx="246" cy="66" r="14" fill="none" stroke="#c9a86a" stroke-width="2.4"/>
        <path d="M246 52v-10M246 90v-10M232 66h-10M270 66h-10" stroke="#c9a86a" stroke-width="2.4" stroke-linecap="round"/>` },
    { no:6, ttl:'비 오는 날, 우산이 두 개가 된다',
      sig:'재물은 혼자 오지 않습니다. 사람이 함께 옵니다.',
      art:`<rect width="320" height="200" fill="#f8f3e6"/>
        <path d="M76 92a56 56 0 0 1 112 0z" fill="#c9a86a" opacity=".55" stroke="#171513" stroke-width="2.4"/>
        <path d="M132 92v58c0 10 8 16 18 16" fill="none" stroke="#171513" stroke-width="2.6"/>
        <path d="M150 30v-8M96 40l-6-8M186 40l6-8" stroke="#171513" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M214 108a40 40 0 0 1 80 0z" fill="#f0e2bd" stroke="#171513" stroke-width="2.4"/>
        <path d="M254 108v40c0 8 6 12 14 12" fill="none" stroke="#171513" stroke-width="2.4"/>
        <g stroke="#8aa3b8" stroke-width="2.4" stroke-linecap="round">
          <path d="M34 126l-6 14M60 140l-6 14M240 158l-6 14M288 150l-6 14M290 62l-6 14M40 70l-6 14"/>
        </g>` },
    { no:7, ttl:'향을 피우고, 소원을 딱 하나만 적는다',
      sig:'정하는 순간, 기운은 그쪽으로 돕니다.',
      art:`<rect width="320" height="200" fill="#f8f3e6"/>
        <path d="M40 168h240" stroke="#171513" stroke-width="2.4"/>
        <path d="M136 168h48l-8-30h-32z" fill="#f0e2bd" stroke="#171513" stroke-width="2.4"/>
        <path d="M160 138v-14" stroke="#171513" stroke-width="2.6"/>
        <path d="M160 124c-3-18 3-26 0-48" fill="none" stroke="#8a7c60" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="2 7"/>
        <circle cx="160" cy="106" r="30" fill="#f0e2bd" opacity=".45"/>
        <path d="M160 116c-7-6-8-12 0-18 8 6 7 12 0 18z" fill="#b3261e"/>
        <path d="M160 113c-3-3-3-6 0-9 3 3 3 6 0 9z" fill="#f0e2bd"/>
        <path d="M84 168v-40" stroke="#171513" stroke-width="2.4"/>
        <path d="M92 168v-30c0-4 4-6 8-4" fill="none" stroke="#8a7c60" stroke-width="2.2"/>
        <circle cx="84" cy="124" r="4" fill="#b3261e"/>
        <rect x="222" y="100" width="66" height="56" rx="4" fill="#fffdf7" stroke="#171513" stroke-width="2.4"/>
        <path d="M234 118h42M234 134h30" stroke="#b8ac90" stroke-width="3" stroke-linecap="round"/>` },
    { no:8, ttl:'닫혀 있던 문이 스스로 열린다',
      sig:'재물운이 터지는 해의 마지막 신호 — 미뤄 둔 결정이 풀립니다.',
      art:`<rect width="320" height="200" fill="#f8f3e6"/>
        <rect x="56" y="26" width="104" height="150" fill="#fffdf7" stroke="#171513" stroke-width="2.4"/>
        <path d="M160 26l58-8v166l-58-8z" fill="#f0e2bd" stroke="#171513" stroke-width="2.4"/>
        <circle cx="150" cy="104" r="4.5" fill="#171513"/>
        <path d="M218 100l84-46v100z" fill="#c9a86a" opacity=".35"/>
        <path d="M218 100l84-46M218 100l84 54M218 100h76" stroke="#c9a86a" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M56 176h244" stroke="#171513" stroke-width="2.4"/>` }
  ]
};

/* ---------- 2027 대박 달 12장 (카드 뒤집기) ---------- */
const GAME_MONTHS = [
  { m:1,  el:'목', pow:2, key:'씨앗',   line:'계획이 처음으로 모양을 갖는 달. 작은 시작 하나가 남습니다.' },
  { m:2,  el:'목', pow:3, key:'인연',   line:'사람을 통해 문이 열립니다. 먼저 연락해 보세요.' },
  { m:3,  el:'토', pow:3, key:'이동',   line:'자리·집·일터가 움직입니다. 미뤄 둔 이직·이사를 꺼내기 좋은 달.' },
  { m:4,  el:'토', pow:2, key:'정리',   line:'새는 돈을 막는 달. 구독·약정·자동결제를 한 번에 점검하세요.' },
  { m:5,  el:'화', pow:3, key:'표현',   line:'말과 손이 풀립니다. 제안서·콘텐츠가 먹히는 달.' },
  { m:6,  el:'화', pow:5, key:'재물',   line:'들어오는 돈이 굵어집니다. 협상과 청구는 오전에 두세요.' },
  { m:7,  el:'금', pow:2, key:'회복',   line:'몸과 마음을 채우는 달. 무리한 확장보다 회복이 남습니다.' },
  { m:8,  el:'금', pow:5, key:'확장',   line:'판이 커집니다. 큰 결정을 미루지 마세요.' },
  { m:9,  el:'수', pow:4, key:'결실',   line:'뿌린 것이 돌아옵니다. 계약과 수금을 서두르기 좋은 달.' },
  { m:10, el:'수', pow:5, key:'정점',   line:'한 해가 가장 밝은 달. 사람들 앞에 서는 일이 남습니다.' },
  { m:11, el:'목', pow:3, key:'관계',   line:'오래된 인연이 다시 붙습니다. 먼저 밥을 사는 쪽이 이깁니다.' },
  { m:12, el:'토', pow:4, key:'마무리', line:'내년의 그릇을 정하는 달. 정리 하나가 1년을 바꿉니다.' }
];

const GAME_COLORS = [
  { name:'황금빛', hex:'#c9a86a' }, { name:'쪽빛', hex:'#2f4a7a' }, { name:'주홍', hex:'#b3261e' },
  { name:'청록', hex:'#2f6b5f' }, { name:'먹빛', hex:'#171513' }, { name:'연보라', hex:'#6b5a92' }
];
