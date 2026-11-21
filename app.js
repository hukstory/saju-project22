/* ============================================================================
   정운타임즈 · app.js
   - 오늘의 간지 계산(일주는 Julian Day, 월주는 절기 경계 근사)
   - 무료 운세 맛보기(생년월일/띠 → 오늘의 1면)
   - 지면 카테고리 필터 · 기사 모달
   - 캔버스 파티클 · 스크롤 리빌 · 카운트업 · 3D 틸트 · 무한 티커
   ============================================================================ */
'use strict';

/* ------------------------------ 0. 기본 상수 ------------------------------ */
const STEMS = [
  { h:'甲', k:'갑', oh:0, yang:true }, { h:'乙', k:'을', oh:0, yang:false },
  { h:'丙', k:'병', oh:1, yang:true }, { h:'丁', k:'정', oh:1, yang:false },
  { h:'戊', k:'무', oh:2, yang:true }, { h:'己', k:'기', oh:2, yang:false },
  { h:'庚', k:'경', oh:3, yang:true }, { h:'辛', k:'신', oh:3, yang:false },
  { h:'壬', k:'임', oh:4, yang:true }, { h:'癸', k:'계', oh:4, yang:false }
];
const BRANCHES = [
  { h:'子', k:'자', oh:4, animal:'쥐' },   { h:'丑', k:'축', oh:2, animal:'소' },
  { h:'寅', k:'인', oh:0, animal:'호랑이' }, { h:'卯', k:'묘', oh:0, animal:'토끼' },
  { h:'辰', k:'진', oh:2, animal:'용' },   { h:'巳', k:'사', oh:1, animal:'뱀' },
  { h:'午', k:'오', oh:1, animal:'말' },   { h:'未', k:'미', oh:2, animal:'양' },
  { h:'申', k:'신', oh:3, animal:'원숭이' }, { h:'酉', k:'유', oh:3, animal:'닭' },
  { h:'戌', k:'술', oh:2, animal:'개' },   { h:'亥', k:'해', oh:4, animal:'돼지' }
];
const OH = [
  { k:'목', h:'木', batchim:true,  color:'청록', hex:'#2f7a58', nums:[3,8],  organ:'간·근육', dir:'동쪽',  hours:'05~07시' },
  { k:'화', h:'火', batchim:false, color:'주홍', hex:'#b23a2e', nums:[2,7],  organ:'심장·혈관', dir:'남쪽', hours:'11~13시' },
  { k:'토', h:'土', batchim:false, color:'황토', hex:'#b08442', nums:[5,10], organ:'위장·소화', dir:'중앙',  hours:'13~15시' },
  { k:'금', h:'金', batchim:true,  color:'은백', hex:'#c9cdd6', nums:[4,9],  organ:'폐·피부', dir:'서쪽',  hours:'17~19시' },
  { k:'수', h:'水', batchim:false, color:'흑청', hex:'#2e5c8a', nums:[1,6],  organ:'신장·뼈', dir:'북쪽',  hours:'21~23시' }
];
function josa(oh, kind){
  const b = oh.batchim;
  if (kind === 'iga') return b ? '이' : '가';
  if (kind === 'eul') return b ? '을' : '를';
  if (kind === 'eun') return b ? '은' : '는';
  return b ? '과' : '와';
}

/* ------------------------------ 1. 날짜·간지 ------------------------------ */
const DAY = 86400000;
function kstNow(){
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), wd: d.getUTCDay() };
}
function jdFromUTC(y, m, d){
  let yy = y, mm = m;
  if (mm <= 2) { yy -= 1; mm += 12; }
  const a = Math.floor(yy / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (yy + 4716)) + Math.floor(30.6001 * (mm + 1)) + d + b - 1524.5;
}
/** Julian Day 기반 일주 — 정운타임즈 사주분석 엔진과 동일한 식 */
function dayIndex(y, m, d){
  const jd = jdFromUTC(y, m, d);
  const diff = Math.round(jd - 2415050.5);
  return ((40 + diff) % 60 + 60) % 60;
}
function ganjiOf(idx){
  const s = STEMS[idx % 10], b = BRANCHES[idx % 12];
  return { idx, s, b, hanja: s.h + b.h, korean: s.k + b.k };
}
function yearIndex(y){ return ((y - 4) % 60 + 60) % 60; }
/** 절기 경계(근사) — 월지 */
const MONTH_TERMS = [
  { md: 105, b: 1 }, { md: 204, b: 2 }, { md: 306, b: 3 }, { md: 405, b: 4 },
  { md: 506, b: 5 }, { md: 606, b: 6 }, { md: 707, b: 7 }, { md: 808, b: 8 },
  { md: 908, b: 9 }, { md: 1008, b: 10 }, { md: 1107, b: 11 }, { md: 1207, b: 0 }
];
function monthBranch(y, m, d){
  const key = m * 100 + d;
  let found = null;
  for (const t of MONTH_TERMS) if (key >= t.md) found = t;
  if (!found) return { b: 0, termYear: y - 1 }; // 1월 5일 이전 = 전년 대설(子月)
  return { b: found.b, termYear: y };
}
function monthPillar(y, m, d){
  const mb = monthBranch(y, m, d);
  const yp = yearIndex(mb.termYear);
  const yStem = yp % 10;
  const ordinal = ((mb.b - 2) + 12) % 12;
  const stem = (yStem * 2 + ordinal + 2) % 10;
  return ganjiOf(((stem * 6 - mb.b * 5) % 60 + 60) % 60);
}

const NOW = kstNow();
const TODAY_DAY = ganjiOf(dayIndex(NOW.y, NOW.m, NOW.d));
const TODAY_YEAR = ganjiOf(yearIndex(NOW.y));
const TODAY_MONTH = monthPillerSafe();
function monthPillerSafe(){ try { return monthPillar(NOW.y, NOW.m, NOW.d); } catch (e) { return ganjiOf(0); } }

const WD = ['일','월','화','수','목','금','토'];
const todayLabel = `${NOW.y}년 ${NOW.m}월 ${NOW.d}일 ${WD[NOW.wd]}요일`;
const todayShort = `${NOW.y}.${String(NOW.m).padStart(2,'0')}.${String(NOW.d).padStart(2,'0')}`;
const ISSUE = Math.max(1, Math.floor((Date.UTC(NOW.y, NOW.m - 1, NOW.d) - Date.UTC(2026, 10, 11)) / (7 * DAY)) + 1);

const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

/* ------------------------------ 2. 카테고리 ------------------------------ */
const ICON = {
  chongun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.4M12 19v2.4M2.6 12h2.4M19 12h2.4M5.4 5.4l1.7 1.7M16.9 16.9l1.7 1.7M18.6 5.4l-1.7 1.7M7.1 16.9l-1.7 1.7"/></svg>',
  zodiac: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="4.4" r="1.1" fill="currentColor"/><circle cx="19.6" cy="12" r="1.1" fill="currentColor"/><circle cx="12" cy="19.6" r="1.1" fill="currentColor"/><circle cx="4.4" cy="12" r="1.1" fill="currentColor"/><path d="M12 12l5.2-3.4"/></svg>',
  ilju: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M7 3.6v16.8M17 3.6v16.8M4.4 20.4h15.2M8.8 7.6h6.4"/></svg>',
  money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="12" cy="12" r="8.6"/><rect x="9" y="9" width="6" height="6" rx=".6"/></svg>',
  love: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="9" cy="12" r="5.4"/><circle cx="15" cy="12" r="5.4"/></svg>',
  work: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M3.6 19.4h16.8M6.6 19.4V9.2M12 19.4V5.2M17.4 19.4v-7"/></svg>',
  health: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M12 20.4c0-6 3-10.8 8-12-1.4 7.2-4.4 10.4-8 12z"/><path d="M12 20.4C12 14.4 9 9.6 4 8.4c1.4 7.2 4.4 10.4 8 12z"/><path d="M12 20.4V9.6"/></svg>',
  timing: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M7.4 3.6h9.2M7.4 20.4h9.2M8.6 3.6c0 4 3.4 5.6 3.4 8.4s-3.4 4.4-3.4 8.4M15.4 3.6c0 4-3.4 5.6-3.4 8.4s3.4 4.4 3.4 8.4"/></svg>'
};
const CATS = [
  { id:'all',    name:'전체',      en:'ALL' },
  { id:'chongun',name:'총운·신년', en:'CHONGUN' },
  { id:'zodiac', name:'띠별 속보', en:'ZODIAC' },
  { id:'ilju',   name:'일주별',    en:'ILJU' },
  { id:'money',  name:'재물·사업', en:'MONEY' },
  { id:'love',   name:'인연·궁합', en:'LOVE' },
  { id:'work',   name:'직장·이직', en:'WORK' },
  { id:'health', name:'건강·개운', en:'HEALTH' },
  { id:'timing', name:'시기별',    en:'TIMING' }
];
const CATNAME = CATS.reduce((a, c) => (a[c.id] = c.name, a), {});

/* ------------------------------ 3. 기사 ------------------------------ */
const ARTICLES = [
  {
    id:'a-2027-daeun', cat:'chongun', feature:true, kicker:'창간 특집 · 2027 정미년',
    title:'2027 정미년, 대운이 바뀌는 띠는 따로 있다',
    deck:'정화(丁火)가 미토(未土) 위에 앉은 해. 같은 정미년이라도 누구에게는 문이 열리고 누구에게는 문이 닫힌다. 기준은 띠가 아니라 내 사주의 온도다.',
    reporter:'정운', date:'2026.11.21', read:6,
    tags:['2027 정미년','대운','세운','정화','미토'],
    cta:{ text:'내 사주로 정미년 흐름을 확인하려면 60P 종합 리포트가 가장 정확합니다.', label:'60P 리포트 보기' },
    body:[
      { t:'p', lead:true, c:'매년 이맘때면 "내년은 어떤 띠가 좋다"는 말이 돈다. 틀린 말은 아니지만 절반만 맞다. 띠는 태어난 해의 지지 하나일 뿐이고, 한 사람의 사주는 네 기둥 여덟 글자다. 같은 말띠라도 태어난 달과 날에 따라 정미년의 정화(丁火)를 반기는 사람과 부담스러워하는 사람이 갈린다.' },
      { t:'h', c:'정미년의 성질 — 작은 불이 마른 흙 위에 앉다' },
      { t:'p', c:'정화는 태양이 아니라 등불이다. 병오년(2026)의 불이 하늘 높이 뜬 태양이었다면, 정미년의 불은 방 안을 밝히는 촛불이다. 밝히는 범위가 좁은 대신 오래 간다. 미토는 여름의 끝, 마른 흙이다. 불이 흙을 만나면 열은 오래 머물지만 쉽게 타오르지 않는다. 그래서 2027년은 크게 터지는 해보다 오래 쌓이는 해로 읽는 편이 정확하다.' },
      { t:'p', c:'다만 미토는 축토와 충(沖)하고 오화와 합(合)한다. 토가 겹친 사주 — 축·술·미가 원국에 둘 이상 있는 사주 — 는 이 해에 흙이 넘쳐 판단이 무거워진다. 반대로 물이 많아 불이 절실한 사주에게는 10년에 한 번 올까 말까 한 보충의 해다.' },
      { t:'h', c:'대운이 바뀌는 사람 — 세운보다 대운을 먼저 보라' },
      { t:'p', c:'세운은 그해의 날씨, 대운은 10년짜리 계절이다. 날씨가 좋아도 계절이 겨울이면 꽃은 피지 않는다. 대운이 넘어가는 해에는 큰 결정이 3~6개월 안에 몰리는 경우가 흔하다. 이사, 이직, 결혼, 사업 정리 같은 일이 한 해에 겹쳐 일어나는 것은 우연이 아니라 계절이 바뀌는 소리다.' },
      { t:'p', c:'그래서 정미년의 사건은 결과로 읽지 말고 전환으로 읽어야 한다. 좋은 일이 생겼다면 그것이 다음 10년의 문이 열린 신호이고, 힘든 일이 생겼다면 아직 새 계절에 몸이 적응하지 못한 것이다.' },
      { t:'q', c:'정미년은 밝히는 해가 아니라 데우는 해다. 데우는 데는 시간이 걸리고, 그 시간이 곧 실력이 된다.' },
      { t:'h', c:'그렇다면 2027년에 할 일' },
      { t:'ul', c:[
        '새로 벌이기보다 이미 가진 것의 온도를 올린다. 손에 쥔 일의 완성도를 1% 올리는 쪽이 새 일을 시작하는 것보다 남는다.',
        '문서와 계약을 정리한다. 정화는 어두운 것을 비추는 불이지만, 흙이 많으면 서류가 흐려진다. 12월과 1월에 도장 찍을 일은 두 번 읽는다.',
        '상반기(2~5월)에 움직이고 하반기는 거둔다. 정미년의 불은 여름에 가장 약해지고 가을에 다시 마음을 얻는다.'
      ]},
      { t:'p', c:'내 사주가 정화를 반기는지는 일간과 조후로 갈린다. 띠별 세부 흐름은 \'띠별 속보\' 지면에서, 일간별 흐름은 \'일주별\' 지면에서 이어서 본다.' }
    ]
  },
  {
    id:'a-2027-three', cat:'chongun', kicker:'2027 정미년 · 전망',
    title:'정미년은 \'붉은 양\'의 해 — 정화와 미토가 만드는 세 가지 변화',
    deck:'불은 밝히고, 흙은 담는다. 2027년의 세 가지 변화를 명리학의 언어로 정리했다.',
    reporter:'정운', date:'2026.11.21', read:5,
    tags:['정미년','오행','재물','인연','건강'],
    cta:{ text:'세 가지 변화가 내 사주에서 언제 강해지는지는 대운·세운 표에서 확인할 수 있습니다.', label:'100P 통합 리포트' },
    body:[
      { t:'p', lead:true, c:'정미(丁未)는 60갑자의 마흔네 번째다. 천간의 정화와 지지의 미토가 만나면, 명리에서는 이를 \'불이 흙을 데우는 상(象)\'으로 읽는다. 밝히는 힘과 담아 두는 힘이 함께 있는 해다. 그 결과로 나타나는 변화는 크게 세 가지다.' },
      { t:'h', c:'① 돈의 속도가 느려지고, 남는 돈이 달라진다' },
      { t:'p', c:'정화는 재성(財星)의 불이고 미토는 창고의 흙이다. 이 해에는 큰돈이 빠르게 도는 것보다 작은 돈이 오래 머무는 쪽이 유리하다. 단기 수익을 좇는 자리보다 한 번 들어오면 3년은 남는 자리를 골라야 한다. 반대로 무리한 확장을 하면 흙이 불을 덮어 연기만 남는다.' },
      { t:'h', c:'② 사람의 폭이 좁아지고, 깊어진다' },
      { t:'p', c:'미토는 인연의 끝자락이다. 이 해에는 새로운 사람이 크게 늘기보다 이미 인연이 있던 사람이 다시 들어오는 일이 많다. 오래 끊겼던 연락이 오고, 함께 일하던 사람이 다른 형태로 돌아온다. 관계의 수를 늘리려 애쓰기보다 남은 사람에게 온도를 높이는 편이 낫다.' },
      { t:'h', c:'③ 몸의 신호가 먼저 온다' },
      { t:'p', c:'불은 심장과 혈관, 흙은 위장과 근육이다. 정미년에는 이 두 곳이 먼저 신호를 보내는 경우가 많다. 잠이 얕아지고 속이 더부룩해지는 증상이 반복된다면 그것은 운의 문제가 아니라 계절의 문제다. 3~5월과 7~9월에 컨디션의 골이 오는지 미리 달력에 표시해 두면 대응이 빨라진다.' },
      { t:'q', c:'흙은 담는 힘이다. 담으려면 먼저 비워야 한다. 2027년의 개운은 무엇을 더할까가 아니라 무엇을 덜어낼까에서 시작한다.' },
      { t:'p', c:'세 가지 변화는 띠와 일간에 따라 강도가 다르다. 토가 많은 사주는 ①과 ③이, 금이 많은 사주는 ②가 크게 작용한다.' }
    ]
  },
  {
    id:'a-zodiac-shake', cat:'zodiac', kicker:'띠별 속보 · 상반기',
    title:'상반기 가장 크게 흔들리는 띠 셋 — 쥐·말·토끼',
    deck:'흔들림은 나쁜 일이 아니라 자리가 바뀌는 신호다. 정미년 상반기에 특히 움직임이 큰 세 띠를 짚었다.',
    reporter:'정운', date:'2026.11.21', read:4,
    tags:['띠별','쥐띠','말띠','토끼띠','2027'],
    cta:{ text:'내 띠의 월별 흐름은 30P 라이트 리포트의 월별 장에서 확인할 수 있습니다.', label:'30P 리포트 보기' },
    body:[
      { t:'p', lead:true, c:'정미년의 미토는 쥐(子)와 해(害)를 이루고, 말(午)과 육합(六合)하며, 토끼(卯)와는 삼합의 끝에서 만난다. 같은 흔들림이라도 셋의 성질은 전혀 다르다.' },
      { t:'h', c:'쥐띠 — 해(害)는 소모가 아니라 정리다' },
      { t:'p', c:'자미해(子未害)는 서로를 해치는 관계로 읽지만, 실제로는 불필요한 것을 떼어내는 과정에 가깝다. 상반기에 인간관계에서 정리할 일이 생긴다면 그것을 손실로 보지 말 것. 3월과 6월에 결정이 몰리고, 9월 이후에 남은 사람이 진짜 인연이다.' },
      { t:'h', c:'말띠 — 합이 들어오면 문이 열린다' },
      { t:'p', c:'오미합(午未合)은 정미년에 가장 따뜻한 합이다. 말띠는 이 해에 사람을 통해 일이 풀린다. 다만 합은 끌림이지 완성이 아니다. 소개와 제안이 들어오면 바로 결정하지 말고 한 달을 두고 보라. 5~7월에 중요한 만남이 몰린다.' },
      { t:'h', c:'토끼띠 — 끝자락의 삼합, 판을 다시 짜는 해' },
      { t:'p', c:'묘미(卯未)는 해묘미 삼합의 반쪽이다. 토끼띠는 혼자 힘으로 밀던 일이 막히고, 다른 사람과 손을 잡아야 풀리는 구조가 된다. 2월과 8월에 협업 제안이 들어오면 조건보다 상대를 먼저 보라.' },
      { t:'q', c:'흔들리는 해일수록 결정은 서두르지 않는 편이 좋다. 정미년은 빠른 승부보다 오래 가는 선택에 유리한 해다.' },
      { t:'p', c:'띠는 열두 글자 중 하나일 뿐이므로, 실제 흐름은 태어난 달과 시까지 함께 봐야 정확하다.' }
    ]
  },
  {
    id:'a-zodiac-gwiin', cat:'zodiac', kicker:'띠별 속보 · 귀인',
    title:'뱀·닭·소, 정미년에 \'숨은 귀인\'을 만나는 조건',
    deck:'사·유·축은 금국(金局)을 이룬다. 정미년의 불과 흙 사이에서 이들은 조연이 아니라 판을 바꾸는 사람이 된다.',
    reporter:'정운', date:'2026.11.21', read:4,
    tags:['띠별','뱀띠','닭띠','소띠','귀인'],
    cta:{ text:'귀인이 들어오는 달을 정확히 보려면 60P 리포트의 월운 장이 도움이 됩니다.', label:'60P 리포트 보기' },
    body:[
      { t:'p', lead:true, c:'뱀(巳)·닭(酉)·소(丑)는 삼합으로 금(金)을 이룬다. 금은 불에 단련되고 흙에서 나온다. 정미년의 정화와 미토는 이들에게 재료와 화로를 동시에 준다.' },
      { t:'h', c:'귀인은 사람이 아니라 타이밍으로 온다' },
      { t:'p', c:'이 세 띠에게 2027년의 귀인은 갑자기 나타나는 은인이 아니다. 이미 곁에 있던 사람이 특정 시점에 결정적인 말을 하는 형태로 온다. 그 시점은 대체로 4월, 8월, 11월이다. 이 달에 누군가 던진 한마디를 흘려듣지 않는 것이 조건이다.' },
      { t:'h', c:'조건 ① 먼저 손을 내미는 쪽이 된다' },
      { t:'p', c:'금은 스스로 빛나지 않는다. 닦는 사람이 있어야 빛난다. 이 해에 도움을 받으려면 먼저 도움을 청할 줄 알아야 한다. 부탁을 미루는 습관이 있는 사람은 귀인을 만나고도 놓친다.' },
      { t:'h', c:'조건 ② 완성되지 않은 일을 남에게 보여 준다' },
      { t:'p', c:'이 세 띠는 완벽해진 뒤에 보여 주려는 성향이 강하다. 그러나 정미년에는 70%에서 보여 준 사람에게 기회가 온다. 나머지 30%를 함께 채우자는 제안이 그 형태다.' },
      { t:'q', c:'귀인은 하늘에서 오지 않는다. 내가 문을 열어 둔 사람에게 온다.' },
      { t:'p', c:'주의할 점도 있다. 금이 강한 사주는 이 해에 말이 날카로워지기 쉽다. 정확하게 말하려는 습관이 사람을 베는 칼이 되지 않도록, 4월과 11월에는 한 박자 쉬고 말하라.' }
    ]
  },
  {
    id:'a-ilju-gap', cat:'ilju', kicker:'일주별 · 갑목',
    title:'갑목(甲木) 일간 — 2027년은 뿌리를 내리는 해다',
    deck:'큰 나무에게 불은 꽃이고 흙은 뿌리다. 갑목은 정미년에 보이는 성과보다 보이지 않는 기반을 얻는다.',
    reporter:'정운', date:'2026.11.21', read:5,
    tags:['갑목','일주','식상','2027'],
    cta:{ text:'일간별 세부 흐름은 100P 리포트의 일주·격국 장에서 가장 자세히 다룹니다.', label:'100P 리포트' },
    body:[
      { t:'p', lead:true, c:'갑목은 곧게 뻗는 큰 나무다. 이 나무에게 정화는 꽃을 피우는 열이고, 미토는 뿌리를 내리는 흙이다. 2027년의 갑목은 화려해지기보다 단단해지는 쪽으로 간다.' },
      { t:'h', c:'성과가 안 보여도 기반은 쌓인다' },
      { t:'p', c:'갑목 일간은 이 해에 눈에 보이는 결과가 늦게 온다고 느끼기 쉽다. 그러나 실제로 쌓이는 것은 뿌리다. 지금 시작한 공부, 관계, 사업의 구조가 2029년에 드러난다. 2027년에 조급해 구조를 바꾸면 뿌리를 뽑는 셈이 된다.' },
      { t:'h', c:'재물은 식상(食傷)으로 열린다' },
      { t:'p', c:'갑목이 정화를 만나면 식상이 된다. 식상은 표현과 결과물이다. 이 해의 재물은 아이디어와 글, 콘텐츠, 기술에서 나온다. 몸으로 때우는 일보다 손과 머리로 만든 것을 파는 쪽이 훨씬 유리하다.' },
      { t:'h', c:'조심할 것 — 겨울 목의 냉기' },
      { t:'p', c:'갑목은 물이 많으면 뿌리가 썩는다. 원국에 임·계수가 많거나 겨울(해·자·축월)에 태어난 갑목은 정미년의 불이 반갑지만, 동시에 수의 습기를 함께 데워야 한다. 12월과 1월에는 몸을 따뜻하게, 결정은 천천히.' },
      { t:'q', c:'나무는 뽑히지 않으려고 뿌리를 내리는 게 아니다. 더 높이 자라기 위해 내린다.' },
      { t:'p', c:'갑목의 2027년은 보이는 성과의 해가 아니다. 성과를 재는 지표를 바꾸는 것이 이 해의 숙제다.' }
    ]
  },
  {
    id:'a-ilju-sin', cat:'ilju', kicker:'일주별 · 신금',
    title:'신금(辛金) 일간, 재물보다 \'관계의 정리\'가 먼저인 이유',
    deck:'보석은 불을 만나면 빛나지만, 흙에 묻히면 흐려진다. 신금에게 정미년은 사람을 고르는 해다.',
    reporter:'정운', date:'2026.11.21', read:4,
    tags:['신금','일주','관성','인간관계'],
    cta:{ text:'신금의 관성·인성 배치와 올해의 균형점은 60P 리포트에서 확인할 수 있습니다.', label:'60P 리포트 보기' },
    body:[
      { t:'p', lead:true, c:'신금은 원석을 다듬은 보석이다. 정화는 그 보석을 비추는 불빛이고, 미토는 보석이 묻히는 흙이다. 그래서 신금의 정미년은 빛과 흐림 사이에서 갈린다.' },
      { t:'h', c:'흙이 많으면 빛이 죽는다' },
      { t:'p', c:'신금 일간에게 토는 인성(印星)이다. 인성이 과하면 생각이 많아지고 실행이 느려진다. 정미년에는 미토가 들어오므로, 원래 토가 많은 신금은 결정을 미루다 기회를 놓치기 쉽다. 이 해의 숙제는 더 생각하기가 아니라 먼저 말하기다.' },
      { t:'h', c:'사람을 고르는 해' },
      { t:'p', c:'신금은 관계에서 정교하다. 정교함이 지나치면 사람을 재단하게 된다. 정미년에는 그 재단이 실제 정리로 이어지는 일이 많다. 오래된 관계 중 유지할 것과 놓을 것을 이 해에 구분하게 된다.' },
      { t:'h', c:'재물은 관성(官星)으로 들어온다' },
      { t:'p', c:'신금이 정화를 만나면 관성이 된다. 관성은 직장, 책임, 평판이다. 이 해의 돈은 새로운 투자보다 조직 안에서의 위치, 즉 맡은 역할의 무게에서 나온다. 직함이 오르면 재물이 따라오는 구조다.' },
      { t:'q', c:'보석은 흙을 두려워하지 않는다. 다만 흙 속에서 스스로 빛나지는 못한다. 누가 나를 꺼내 줄지가 문제다.' },
      { t:'p', c:'2027년 신금에게 가장 중요한 결정은 무엇을 할까가 아니라 누구와 할까다.' }
    ]
  },
  {
    id:'a-money-block', cat:'money', kicker:'재물·사업 · 진단',
    title:'재물운이 막히는 사주, 공통점 세 가지',
    deck:'돈이 안 들어오는 것이 아니라, 들어온 돈이 머물 자리가 없는 경우가 많다. 재고(財庫)와 식상, 그리고 지출의 구조를 본다.',
    reporter:'정운', date:'2026.11.21', read:6,
    tags:['재물','재고','식상','지출'],
    cta:{ text:'내 사주에서 새는 곳이 어디인지 알고 싶다면 재물 장이 포함된 60P 리포트를 권합니다.', label:'60P 리포트 보기' },
    body:[
      { t:'p', lead:true, c:'상담에서 "재물운이 막혔다"는 말을 들으면 먼저 세 가지를 본다. 재성이 있는가, 그것을 만들 힘(식상)이 있는가, 그리고 들어온 돈을 담을 그릇(재고)이 있는가. 대부분은 세 번째에서 막힌다.' },
      { t:'h', c:'① 재성은 있는데 식상이 없다' },
      { t:'p', c:'재성은 결과이고 식상은 생산이다. 생산 없이 결과만 바라는 구조는 사주에서 흔하다. 이런 사주는 돈이 들어와도 한 번에 오는 돈에 기대게 된다. 답은 기술이든 콘텐츠든, 반복해서 만들 수 있는 무언가를 손에 쥐는 것이다.' },
      { t:'h', c:'② 재고가 있는데 열지 않는다' },
      { t:'p', c:'축·술·진·미는 재고(財庫)다. 창고가 있는데 문을 열지 않으면 그 안의 돈은 남의 돈과 같다. 재고는 충(沖)이나 형(刑)으로 열린다. 그래서 재고를 가진 사주는 변화가 많은 해에 오히려 돈을 만든다. 문제는 변화를 피하려는 마음이다.' },
      { t:'h', c:'③ 들어온 돈이 나가는 구조가 정해져 있다' },
      { t:'p', c:'지출에도 사주가 있다. 비겁이 강하면 사람과의 관계에서, 인성이 강하면 배움과 문서에서, 관성이 강하면 책임과 체면에서 돈이 샌다. 이 구조를 모르면 벌수록 새는 그릇이 된다. 지출의 성격을 파악하는 것이 재테크보다 먼저다.' },
      { t:'q', c:'재물운은 돈을 버는 운이 아니라, 번 돈이 머무는 운이다.' },
      { t:'p', c:'세 가지 중 하나라도 해당한다면, 올해의 재물 전략은 더 벌기가 아니라 새는 곳을 막기가 되어야 한다.' }
    ]
  },
  {
    id:'a-money-jaege', cat:'money', kicker:'재물·사업 · 재고',
    title:'사업운이 트이는 사주는 \'재고(財庫)\'를 이렇게 쓴다',
    deck:'재고는 창고다. 창고가 있는데 문을 열지 않으면 그 안의 돈은 남의 돈과 같다.',
    reporter:'정운', date:'2026.11.21', read:5,
    tags:['사업','재고','충','형','합'],
    cta:{ text:'재고의 개폐 시점은 대운·세운 표에서 연 단위로 확인해야 정확합니다.', label:'100P 통합 리포트' },
    body:[
      { t:'p', lead:true, c:'사업운을 볼 때 재성의 크기보다 먼저 보는 것이 재고다. 축·술·진·미 중 원국에 있는 글자가 창고이고, 그 창고가 언제 열리는지가 사업의 사이클을 만든다.' },
      { t:'h', c:'창고를 여는 세 가지 방법' },
      { t:'ul', c:[
        '충(沖) — 반대편 글자가 들어오는 해. 창고가 크게 열리지만 흔들림도 크다. 확장은 좋고 무리한 투자는 금물.',
        '형(刑) — 창고가 서서히 열린다. 속도는 느리지만 새는 돈이 적다.',
        '합(合) — 창고가 묶인다. 이 해에는 새 사업을 벌이기보다 기존 사업의 수익 구조를 다지는 쪽이 맞다.'
      ]},
      { t:'h', c:'2027년은 어떤 창고가 열리나' },
      { t:'p', c:'정미년은 미토가 들어오는 해다. 미토를 가진 사주는 자기 창고가 겹치는 해이므로 안에 있는 것을 꺼내는 일이 유리하다. 축토를 가진 사주는 충으로 창고가 열린다 — 크게 벌고 크게 쓸 수 있으니 현금 흐름을 먼저 점검해야 한다.' },
      { t:'h', c:'사업운이 트이는 사람의 공통점' },
      { t:'p', c:'재고가 있는 사주가 사업에서 성공하는 방식은 대개 비슷하다. 한 가지 상품을 오래 팔고, 그 상품의 재고와 가격을 스스로 통제하며, 사람을 크게 늘리지 않는다. 반대로 창고 없이 재성만 강한 사주는 회전이 빠른 장사에는 강하지만, 남는 구조를 만들지 못하면 매출이 늘어도 통장은 그대로다.' },
      { t:'q', c:'창고는 크게 지을 필요가 없다. 문이 잘 열리는 창고가 좋은 창고다.' },
      { t:'p', c:'내 사주의 창고가 무엇인지, 언제 열리는지는 정밀 리포트의 대운·세운 장에서 확인할 수 있다.' }
    ]
  },
  {
    id:'a-love-late', cat:'love', kicker:'인연·궁합 · 배우자궁',
    title:'결혼운이 늦은 사주가 아니라, 시기를 놓치는 사주다',
    deck:'배우자궁이 조용한 사주는 인연이 없는 것이 아니다. 합(合)이 들어오는 해를 알아채지 못할 뿐이다.',
    reporter:'정운', date:'2026.11.21', read:5,
    tags:['인연','결혼','배우자궁','육합'],
    cta:{ text:'상대의 사주까지 겹쳐 보는 궁합 해설은 100P 리포트에 포함되어 있습니다.', label:'100P 리포트' },
    body:[
      { t:'p', lead:true, c:'"제 사주는 결혼이 늦나요"라는 질문의 절반은 사실 질문이 아니다. 이미 인연이 있었는데 지나갔다는 뜻이 담겨 있는 경우가 많다. 명리에서 결혼운은 배우자궁(일지)과 그 궁에 들어오는 합·충으로 본다.' },
      { t:'h', c:'배우자궁이 조용하다는 말의 뜻' },
      { t:'p', c:'일지가 형충 없이 조용하다는 것은 관계가 없다는 뜻이 아니라, 스스로 움직이지 않으면 관계가 잘 드러나지 않는다는 뜻이다. 이런 사주는 상대가 다가오는 것을 기다리는 동안 시기를 놓친다.' },
      { t:'h', c:'합이 들어오는 해를 알아채는 법' },
      { t:'p', c:'일지와 육합을 이루는 글자가 세운에 들어오는 해가 대표적이다. 자-축, 인-해, 묘-술, 진-유, 사-신, 오-미. 이 해에는 새로운 만남이 생기거나 이미 알던 사람과의 관계가 달라진다. 문제는 그 변화가 대개 작게 시작한다는 것이다.' },
      { t:'h', c:'인연은 조건이 아니라 빈도로 온다' },
      { t:'p', c:'배우자궁이 조용한 사주는 인연의 빈도를 스스로 올려야 한다. 같은 자리에서 같은 사람을 만나는 생활을 유지하면, 합이 들어오는 해에도 만날 사람이 없다. 2027년은 미토가 들어오는 해라 오-미 합을 가진 사주에게 특히 의미가 있다.' },
      { t:'q', c:'인연은 하늘에 있고, 만남은 내 발에 있다.' },
      { t:'p', c:'결혼 시기를 볼 때는 상대의 사주까지 함께 봐야 정확하다. 한쪽의 합만으로는 시기가 잡히지 않는다.' }
    ]
  },
  {
    id:'a-love-clash', cat:'love', kicker:'인연·궁합 · 조후',
    title:'궁합이 좋은데 자꾸 부딪히는 두 사람의 공통점',
    deck:'점수는 좋은데 생활이 힘들다면, 궁합을 \'오행의 합\'으로만 봤기 때문이다.',
    reporter:'정운', date:'2026.11.21', read:4,
    tags:['궁합','조후','부부','관계'],
    cta:{ text:'두 사람의 조후와 일지 관계를 함께 본 궁합 리포트를 준비하고 있습니다.', label:'카톡으로 문의' },
    body:[
      { t:'p', lead:true, c:'궁합 점수가 높은데 함께 살면 부딪힌다는 말을 자주 듣는다. 이유는 간단하다. 궁합은 두 사람의 기운이 서로를 보완하는지를 보는 것이지, 생활의 속도가 맞는지를 보는 것이 아니다.' },
      { t:'h', c:'합은 끌림이고, 조후는 생활이다' },
      { t:'p', c:'오행이 서로를 생하는 두 사람은 끌린다. 그러나 한 사람이 뜨겁고 한 사람이 차갑다면, 끌림은 있어도 생활의 온도가 다르다. 여름생과 겨울생의 조합이 대표적이다. 이 경우 애정은 크지만 사소한 일상에서 마찰이 반복된다.' },
      { t:'h', c:'같은 글자가 많은 조합의 함정' },
      { t:'p', c:'두 사주의 글자가 많이 겹치는 조합은 처음에 편안하다. 그러나 같은 기운이 겹치면 같은 약점도 겹친다. 둘 다 말이 느리거나, 둘 다 돈을 못 잡거나, 둘 다 화를 참는 타입이면 문제가 커졌을 때 아무도 꺼내지 않는다.' },
      { t:'h', c:'그래서 필요한 것은 역할의 분리' },
      { t:'p', c:'부딪히는 두 사람에게 가장 효과적인 처방은 애정을 더하는 것이 아니라 역할을 나누는 것이다. 돈을 관리하는 사람, 사람을 만나는 사람, 결정을 미루는 사람을 정해 두면 조후의 차이가 생활의 마찰로 번지지 않는다.' },
      { t:'q', c:'궁합은 두 사람이 얼마나 끌리는가의 문제고, 결혼은 두 사람이 어떻게 나눌 것인가의 문제다.' },
      { t:'p', c:'상대와 나의 조후·일지 관계를 함께 보면 갈등의 지점이 훨씬 구체적으로 보인다.' }
    ]
  },
  {
    id:'a-work-move', cat:'work', kicker:'직장·이직 · 시기',
    title:'이직운은 \'관성\'이 아니라 \'합(合)\'에서 갈린다',
    deck:'회사를 옮길 때가 되었는지는 관성이 아니라, 내 일지와 세운의 합·충이 알려준다.',
    reporter:'정운', date:'2026.11.21', read:5,
    tags:['이직','관성','합','충','직장'],
    cta:{ text:'올해 이직 시기와 다음 자리의 조건은 60P 리포트의 직업 장에서 다룹니다.', label:'60P 리포트 보기' },
    body:[
      { t:'p', lead:true, c:'이직 상담에서 가장 많이 나오는 오해는 "관성이 약해서 이직운이 없다"는 말이다. 관성은 직장의 존재를 뜻하지, 옮길 시기를 뜻하지 않는다. 시기는 일지와 세운의 관계에서 나온다.' },
      { t:'h', c:'합이 들어오면 자리가 바뀐다' },
      { t:'p', c:'일지와 세운이 합을 이루면 환경이 재편된다. 이때 나타나는 형태는 대개 제안이다. 헤드헌터 연락, 전 직장의 재입사 권유, 동료의 이직 제안이 여기에 해당한다. 합은 스스로 움직이지 않아도 자리가 흔들리는 힘이다.' },
      { t:'h', c:'충이 들어오면 스스로 나가게 된다' },
      { t:'p', c:'일지와 세운이 충을 이루면 관계가 끊긴다. 이때는 내가 결정하기 전에 상황이 결정하는 경우가 많다. 조직 개편, 상사의 교체, 프로젝트 종료가 대표적이다. 충의 해에는 버티는 것보다 다음 자리를 미리 준비하는 편이 낫다.' },
      { t:'h', c:'관성이 강한 해의 이직은 이동이 아니라 승진이다' },
      { t:'p', c:'관성이 강한 해에 무리하게 회사를 옮기면 새 자리에서 같은 압박을 만난다. 이 해에는 옮기는 대신 맡는 것이 낫다. 직함과 책임이 올라가면 다음 해의 이직 조건도 달라진다.' },
      { t:'q', c:'이직은 도망이 아니라 이동이다. 이동은 목적지가 정해졌을 때만 의미가 있다.' },
      { t:'p', c:'2027년 이직을 생각한다면, 상반기 제안은 조건을, 하반기 제안은 사람을 보라. 정미년의 합은 사람을 통해 오는 경우가 많다.' }
    ]
  },
  {
    id:'a-work-repeat', cat:'work', kicker:'직장·이직 · 관계 구조',
    title:'회사를 옮겨도 같은 사람이 반복되는 사주 특징',
    deck:'환경을 바꿔도 관계의 패턴이 반복된다면, 원인은 직장이 아니라 내 사주의 관계 구조에 있다.',
    reporter:'정운', date:'2026.11.21', read:4,
    tags:['직장','십성','편관','인성','비겁'],
    cta:{ text:'십성 구조에서 내가 반복해서 맡는 역할은 100P 리포트에서 정리됩니다.', label:'100P 리포트' },
    body:[
      { t:'p', lead:true, c:'세 번 이직했는데 세 번 모두 비슷한 상사를 만났다는 이야기가 있다. 우연이라 하기에는 패턴이 선명하다. 사주에서 관계의 반복은 십성의 구조에서 나온다.' },
      { t:'h', c:'편관이 강한 사주 — 압박하는 상사를 부른다' },
      { t:'p', c:'편관이 강하면 책임과 압박을 감당하는 힘이 크다. 문제는 그 힘이 큰 만큼 압박하는 사람을 끌어들인다는 점이다. 이 구조를 가진 사람은 상사의 압박을 견디는 능력이 뛰어나서, 조직이 그 사람에게 어려운 자리를 맡긴다.' },
      { t:'h', c:'정인이 강한 사주 — 도와주는 사람을 기다린다' },
      { t:'p', c:'정인이 강하면 보호받는 관계에 익숙하다. 새 직장에서도 누군가 챙겨 주기를 기대하게 되고, 그 기대가 충족되지 않으면 실망이 크다. 답은 기다리는 대신 먼저 챙기는 쪽으로 역할을 바꾸는 것이다.' },
      { t:'h', c:'비겁이 강한 사주 — 동료와의 경쟁이 반복된다' },
      { t:'p', c:'비겁이 강하면 동료와의 관계에서 힘을 쓰게 된다. 경쟁이 나쁜 것은 아니지만, 같은 경쟁을 반복하면 성장이 아니라 소모가 된다. 이 구조는 경쟁의 대상이 아닌 다른 트랙을 만드는 것으로 풀린다.' },
      { t:'q', c:'직장을 바꾸면 사람이 바뀐다. 사주를 바꾸면 만나는 사람의 종류가 바뀐다.' },
      { t:'p', c:'관계의 반복을 끊으려면 먼저 내가 반복해서 맡는 역할을 알아야 한다. 그것이 사주에서 말하는 구조다.' }
    ]
  },
  {
    id:'a-health-oh', cat:'health', kicker:'건강·개운 · 오행',
    title:'체질은 사주에 적혀 있다 — 오행으로 보는 2027년 건강 주의점',
    deck:'정미년은 불과 흙이 강한 해다. 목이 약한 사주는 3~5월, 수가 약한 사주는 7~9월을 조심한다.',
    reporter:'정운', date:'2026.11.21', read:5,
    tags:['건강','오행','체질','2027'],
    cta:{ text:'내 사주의 오행 분포와 취약한 계절은 60P 리포트의 건강 장에 담깁니다.', label:'60P 리포트 보기' },
    body:[
      { t:'p', lead:true, c:'명리에서 건강은 오행의 균형으로 본다. 목은 간과 근육, 화는 심장과 혈관, 토는 위장과 소화, 금은 폐와 피부, 수는 신장과 뼈·혈액이다. 2027년은 화와 토가 강해지는 해이므로, 이 두 기운이 부족했던 사람은 보충을, 넘쳤던 사람은 배출을 준비해야 한다.' },
      { t:'h', c:'목이 약한 사주 — 3~5월, 눈과 목의 건조' },
      { t:'p', c:'화가 강해지면 목은 타 버린다. 목이 약한 사주는 봄에 눈이 건조하고 목이 칼칼해지는 증상이 반복된다. 물을 자주 마시고, 밤늦게까지 화면을 보는 시간을 줄이는 것만으로도 차이가 난다.' },
      { t:'h', c:'수가 약한 사주 — 7~9월, 열과 탈수' },
      { t:'p', c:'수가 약한 사주는 여름의 열을 견디는 힘이 떨어진다. 정미년의 여름은 특히 마른 열이다. 7~9월에는 수분과 수면을 의식적으로 챙기고, 한낮의 야외 활동을 피하는 편이 좋다.' },
      { t:'h', c:'토가 넘치는 사주 — 1~2월과 10~12월, 소화와 체중' },
      { t:'p', c:'토가 이미 많은 사주는 정미년의 미토가 겹쳐 소화가 느려지고 체중이 늘기 쉽다. 저녁 식사 시간을 앞당기고, 단 음식과 밀가루를 줄이는 것이 가장 직접적인 개운이다.' },
      { t:'q', c:'사주가 병을 정하지는 않는다. 다만 어느 계절에 어느 곳이 약해지는지는 정해 둔다.' },
      { t:'p', c:'이 글은 참고용이며, 실제 증상이 있으면 진료를 먼저 받아야 한다.' }
    ]
  },
  {
    id:'a-health-gaeun', cat:'health', kicker:'건강·개운 · 습관',
    title:'개운법은 미신이 아니라 \'환경 설계\'다 — 정운이 권하는 세 가지',
    deck:'행운의 색을 입는 것보다, 내 기운을 소모하는 자리에서 한 발 물러나는 것이 먼저다.',
    reporter:'정운', date:'2026.11.21', read:4,
    tags:['개운','풍수','환경','습관'],
    cta:{ text:'내게 필요한 오행과 방향은 리포트의 용신·희신 장에서 확인할 수 있습니다.', label:'정밀 리포트 보기' },
    body:[
      { t:'p', lead:true, c:'개운법을 물으면 부적이나 색깔을 먼저 떠올린다. 물론 그것도 상징의 힘이 있지만, 명리에서 말하는 개운의 본질은 환경을 내 기운에 맞게 바꾸는 일이다.' },
      { t:'h', c:'① 앉는 자리와 방향을 바꾼다' },
      { t:'p', c:'사주에서 방향은 오행의 지도다. 목은 동, 화는 남, 금은 서, 수는 북, 토는 중앙이다. 내게 필요한 오행의 방향으로 책상과 침대의 머리를 두는 것만으로도 체감이 달라진다. 특히 잠자리의 머리 방향은 하루의 절반에 영향을 준다.' },
      { t:'h', c:'② 소모하는 사람과의 거리를 조정한다' },
      { t:'p', c:'개운은 더하는 일보다 덜어내는 일이 효과가 크다. 내 기운을 반복해서 빼앗는 관계가 있다면, 그 관계의 빈도를 줄이는 것이 어떤 부적보다 강하다. 이것은 사람을 끊으라는 말이 아니라 거리를 정하라는 말이다.' },
      { t:'h', c:'③ 같은 시간에 같은 일을 반복한다' },
      { t:'p', c:'명리에서 시간은 기운의 흐름이다. 아침에 해야 할 일과 저녁에 해야 할 일을 정해 두면, 기운이 좋은 시간에 중요한 일이 놓인다. 이것이 가장 오래 가는 개운법이다.' },
      { t:'q', c:'개운은 하루아침에 되는 일이 아니다. 다만 방향을 바꾸면 같은 거리도 다르게 간다.' },
      { t:'p', c:'2027년의 개운 키워드는 비움이다. 흙이 가득하면 물이 스며들지 않는다.' }
    ]
  },
  {
    id:'a-time-dec', cat:'timing', kicker:'시기별 · 12월 월운',
    title:'12월 월운 — 계수(癸水)의 달, 버리는 것이 곧 버는 것',
    deck:'2026년 12월은 계수와 자수의 달이다. 물은 비우는 힘이다.',
    reporter:'정운', date:'2026.11.21', read:4,
    tags:['월운','12월','계수','자월'],
    cta:{ text:'월별 흐름을 12개월 단위로 정리한 표는 30P 리포트부터 포함됩니다.', label:'30P 리포트 보기' },
    body:[
      { t:'p', lead:true, c:'12월 7일 대설(大雪)부터 2027년 1월 6일 소한 전까지는 자월(子月)이다. 천간은 계수(癸水). 이슬비 같은 물이 겨울의 한가운데에 내리는 달이다.' },
      { t:'h', c:'물의 달에 하는 일' },
      { t:'p', c:'물은 흐르며 씻는다. 이 달에는 새 일을 시작하기보다 지난 1년의 잔재를 정리하는 것이 맞다. 미뤄 둔 서류, 끊지 못한 구독, 정리하지 못한 관계가 대상이다. 물은 강하게 밀지 않아도 스스로 새어 나간다.' },
      { t:'h', c:'계약과 문서는 두 번 읽는다' },
      { t:'p', c:'자월은 수가 강해 말이 많아지고 판단이 흐려지기 쉽다. 이 달에 도장을 찍는 일이 있다면 하루를 두고 다시 읽어라. 특히 12월 중순과 말일에 결정이 몰린다면, 그 결정은 1월로 미루는 편이 낫다.' },
      { t:'h', c:'띠별로 다른 12월' },
      { t:'ul', c:[
        '쥐띠·돼지띠 — 기운이 겹치는 달. 컨디션 관리가 최우선.',
        '말띠 — 자오충(子午沖). 이동과 변화가 많고 말실수를 조심.',
        '토끼띠·양띠 — 묘자형(卯子刑). 사람 사이의 오해가 생기기 쉬움.'
      ]},
      { t:'q', c:'물은 버리는 힘이다. 버리지 못하면 새것이 들어오지 않는다.' },
      { t:'p', c:'12월은 한 해의 마무리이자 2027년 정미년의 준비 기간이다. 이 달에 비운 자리가 내년에 채워진다.' }
    ]
  },
  {
    id:'a-time-jan', cat:'timing', kicker:'시기별 · 1월 월운',
    title:'2027년 1월, 새해 첫 달에 반드시 비워야 할 세 가지',
    deck:'축월(丑月)은 얼어붙은 흙이다. 새 계획을 세우기 전에 지난해의 잔재를 정리해야 한다.',
    reporter:'정운', date:'2026.11.21', read:4,
    tags:['월운','1월','축월','정미년'],
    cta:{ text:'2027년 월별 체크리스트는 60P 리포트에 월 단위로 들어갑니다.', label:'60P 리포트 보기' },
    body:[
      { t:'p', lead:true, c:'2027년 1월은 축월(丑月)이다. 축토는 겨울의 끝, 얼어붙은 흙이다. 이 흙은 봄이 오면 녹아서 목을 키우는 밑거름이 된다. 그래서 1월은 시작의 달이 아니라 준비의 달이다.' },
      { t:'h', c:'① 결심을 비운다' },
      { t:'p', c:'새해 결심을 많이 세우는 사람일수록 2월에 지친다. 1월에는 결심을 세우지 말고, 지난해 실패한 결심을 왜 실패했는지만 적어 보라. 그 기록이 3월의 계획이 된다.' },
      { t:'h', c:'② 미완의 약속을 비운다' },
      { t:'p', c:'지난해 하겠다고 하고 하지 못한 약속이 있다면, 1월에 정리해야 한다. 하겠다면 일정을 잡고, 못 하겠다면 정중히 말하는 것이 맞다. 얼어붙은 흙 위에 쌓인 미완의 약속은 봄에 진흙이 된다.' },
      { t:'h', c:'③ 지출의 구멍을 비운다' },
      { t:'p', c:'1월은 고정지출이 갱신되는 달이다. 구독, 보험, 통신, 멤버십. 쓰지 않는 것 하나를 끊는 것이 새 수입원 하나를 만드는 것보다 빠르다. 정미년의 재물은 새는 곳을 막는 데서 시작한다.' },
      { t:'q', c:'1월의 흙은 얼어 있다. 지금 심으면 썩고, 봄에 심으면 큰다.' },
      { t:'p', c:'정미년의 상반기는 2월 입춘과 함께 열린다. 1월은 그 문 앞의 복도다.' }
    ]
  }
];

/* ------------------------------ 4. 헤더/메타 채우기 ------------------------------ */
function pad2(n){ return String(n).padStart(2, '0'); }
function initMeta(){
  const ganji = `${TODAY_YEAR.s.h}${TODAY_YEAR.b.h}年 · ${TODAY_MONTH.s.h}${TODAY_MONTH.b.h}月 · ${TODAY_DAY.s.h}${TODAY_DAY.b.h}日`;
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  set('topDate', todayLabel);
  set('topGanji', ganji);
  set('topIssue', `통권 제${ISSUE}호`);
  set('mastDate', `${todayShort} (${WD[NOW.wd]})`);
  set('mastIssue', `통권 제${ISSUE}호 · 주간`);
  set('heroDate', todayShort);
  set('fpDate', todayShort);
  set('fpGanji', TODAY_DAY.s.h + TODAY_DAY.b.h);
  const tickG = document.querySelector('[data-today-ganji]');
  if (tickG) tickG.textContent = `오늘의 간지 ${TODAY_DAY.s.h}${TODAY_DAY.b.h}일 — 오늘의 기운은 내 생년월일로 확인`;
}

/* ------------------------------ 5. 티커 ------------------------------ */
function initTicker(){
  const track = document.getElementById('tickerTrack');
  if (!track) return;
  const items = Array.from(track.children).map(el => el.outerHTML);
  track.innerHTML = items.join('');
  const one = track.scrollWidth || 1;
  const vp = track.parentElement ? track.parentElement.clientWidth : window.innerWidth;
  let copies = Math.max(2, Math.ceil((vp * 1.6) / one));
  if (copies % 2) copies += 1;
  track.innerHTML = new Array(copies).fill(items.join('')).join('');
}

/* ------------------------------ 6. 리빌 / 카운트업 ------------------------------ */
function initReveal(){
  const els = $$('[data-reveal]');
  if (!('IntersectionObserver' in window)){ els.forEach(el => el.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting){ e.target.classList.add('is-in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });
  els.forEach(el => io.observe(el));
}

function initCountUp(){
  const nums = $$('[data-count]');
  if (!nums.length) return;
  const run = (el) => {
    const target = parseFloat(el.dataset.count) || 0;
    const suffix = el.dataset.suffix || '';
    const dur = 1500;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.round(target * eased);
      el.textContent = val.toLocaleString('ko-KR') + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if (!('IntersectionObserver' in window)){ nums.forEach(run); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting){ run(e.target); io.unobserve(e.target); } });
  }, { threshold: 0.4 });
  nums.forEach(el => io.observe(el));
}

/* ------------------------------ 7. 캔버스 (오행 별자리) ------------------------------ */
function initSky(){
  const canvas = document.getElementById('skyCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let w = 0, h = 0, dpr = 1, stars = [], glyphs = [], raf = null, visible = true, tStart = performance.now();

  function rnd(a, b){ return a + Math.random() * (b - a); }

  function build(){
    const area = w * h;
    const n = Math.max(18, Math.min(74, Math.round(area / 15000)));
    stars = [];
    for (let i = 0; i < n; i++){
      stars.push({
        x: Math.random() * w, y: Math.random() * h,
        r: rnd(0.5, 1.9), a: rnd(0.18, 0.75),
        vx: rnd(-0.035, 0.035), vy: rnd(-0.05, 0.02),
        ph: Math.random() * Math.PI * 2, tw: rnd(0.4, 1.4)
      });
    }
    // 8괘 — 3획 획으로 직접 그림
    const count = w < 720 ? 3 : 5;
    glyphs = [];
    for (let i = 0; i < count; i++){
      glyphs.push({
        x: rnd(w * 0.06, w * 0.94), y: rnd(h * 0.08, h * 0.9),
        s: rnd(16, 30), bits: Math.floor(Math.random() * 8),
        a: rnd(0.05, 0.14), vy: rnd(-0.014, -0.004), ph: Math.random() * 6.28
      });
    }
  }

  function resize(){
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, rect.width); h = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
    if (reduce) draw(0, 0);
  }

  function drawRing(off){
    const cx = w * 0.74, cy = h * 0.44, r = Math.min(w, h) * 0.33;
    ctx.save();
    ctx.translate(0, off * 0.4);
    ctx.strokeStyle = 'rgba(212,175,55,0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(212,175,55,0.06)';
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(212,175,55,0.16)';
    for (let i = 0; i < 12; i++){
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const r1 = r - (i % 3 === 0 ? 7 : 3.5), r2 = r;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawGlyph(g, off){
    const baseY = g.y + off * 0.7;
    ctx.save();
    ctx.translate(g.x, baseY);
    ctx.strokeStyle = 'rgba(243,229,171,' + g.a + ')';
    ctx.lineWidth = 1.2;
    const bw = g.s, gap = g.s * 0.28, bh = g.s * 0.12;
    for (let i = 0; i < 3; i++){
      const bit = (g.bits >> i) & 1;
      const y = (i - 1) * gap - bh / 2;
      if (bit){ // 음효 (끊어진 획)
        ctx.beginPath();
        ctx.moveTo(-bw / 2, y); ctx.lineTo(-bw * 0.16, y);
        ctx.moveTo(bw * 0.16, y); ctx.lineTo(bw / 2, y);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(-bw / 2, y); ctx.lineTo(bw / 2, y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function draw(ts, off){
    ctx.clearRect(0, 0, w, h);
    drawRing(off || 0);
    const t = (ts - tStart) / 1000;
    // 별 + 별자리 연결
    const pts = [];
    for (const s of stars){
      if (!reduce){
        s.x += s.vx; s.y += s.vy;
        if (s.x < -10) s.x = w + 10; if (s.x > w + 10) s.x = -10;
        if (s.y < -10) s.y = h + 10; if (s.y > h + 10) s.y = -10;
      }
      const tw = reduce ? 1 : 0.72 + 0.28 * Math.sin(t * s.tw + s.ph);
      const y = s.y + (off || 0) * 0.25;
      ctx.beginPath();
      ctx.fillStyle = 'rgba(243,229,171,' + (s.a * tw).toFixed(3) + ')';
      ctx.arc(s.x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
      pts.push({ x: s.x, y });
    }
    ctx.lineWidth = 0.6;
    for (let i = 0; i < pts.length; i++){
      for (let j = i + 1; j < pts.length; j++){
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 11000){
          const a = (1 - d2 / 11000) * 0.16;
          ctx.strokeStyle = 'rgba(212,175,55,' + a.toFixed(3) + ')';
          ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
        }
      }
    }
    for (const g of glyphs){
      if (!reduce) g.y += g.vy;
      if (g.y < -40) { g.y = h + 40; g.x = rnd(w * 0.06, w * 0.94); }
      drawGlyph(g, off || 0);
    }
  }

  function loop(ts){
    if (!visible) return;
    const off = Math.max(-320, Math.min(320, -window.scrollY * 0.12));
    draw(ts, off);
    raf = requestAnimationFrame(loop);
  }

  function start(){ if (raf) return; raf = requestAnimationFrame(loop); }
  function stop(){ if (raf){ cancelAnimationFrame(raf); raf = null; } }

  resize();
  window.addEventListener('resize', () => { clearTimeout(resize._t); resize._t = setTimeout(resize, 160); }, { passive: true });

  if (reduce){ draw(0, 0); return; }
  if ('IntersectionObserver' in window){
    new IntersectionObserver((entries) => {
      entries.forEach(e => { visible = e.isIntersecting; if (visible) start(); else stop(); });
    }, { threshold: 0 }).observe(canvas.parentElement);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
  start();
}

/* ------------------------------ 8. 3D 틸트 ------------------------------ */
function bindTilt(el, max, lift){
  if (!el) return;
  if (!window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  let raf = null, target = { rx: 0, ry: 0 }, cur = { rx: 0, ry: 0 }, active = false;

  function apply(){
    cur.rx += (target.rx - cur.rx) * 0.18;
    cur.ry += (target.ry - cur.ry) * 0.18;
    el.style.transform = `rotateX(${cur.rx.toFixed(2)}deg) rotateY(${cur.ry.toFixed(2)}deg) translateY(${active ? -lift : 0}px)`;
    if (Math.abs(cur.rx - target.rx) > 0.02 || Math.abs(cur.ry - target.ry) > 0.02 || active){
      raf = requestAnimationFrame(apply);
    } else { raf = null; }
  }
  function kick(){ if (!raf) raf = requestAnimationFrame(apply); }

  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    target.ry = (px - 0.5) * max * 2;
    target.rx = (0.5 - py) * max * 2;
    active = true;
    el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
    el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
    kick();
  });
  el.addEventListener('pointerleave', () => {
    active = false; target.rx = 0; target.ry = 0;
    el.style.transform = '';
    kick();
  });
}

/* ------------------------------ 9. 지면 렌더 ------------------------------ */
let activeCat = 'all';
let shown = 8;
const PAGE = 8;

function renderTabs(){
  const box = document.getElementById('tabs');
  if (!box) return;
  box.innerHTML = CATS.map(c =>
    `<button class="tab${c.id === activeCat ? ' is-active' : ''}" type="button" aria-pressed="${c.id === activeCat}" data-cat="${c.id}">${c.name}</button>`
  ).join('');
}

function cardHTML(a, i){
  const cat = CATS.find(c => c.id === a.cat) || { name:'' };
  return `<article class="ncard${a.feature ? ' ncard--feature' : ''}" role="button" tabindex="0" data-article="${a.id}" data-cat="${a.cat}" aria-label="${a.title} 기사 읽기">
    <span class="ncard__top">
      <span class="ncard__cat">${ICON[a.cat] || ''}${cat.name}</span>
      <span class="ncard__read">${a.date} · ${a.read}분</span>
    </span>
    <h3 class="ncard__title">${a.title}</h3>
    <p class="ncard__deck">${a.deck}</p>
    ${a.feature ? (() => { const q = (a.body.find(b => b.t === 'q') || {}).c; return q ? `<span class="ncard__pull">“${q}”</span>` : ''; })() : ''}
    <span class="ncard__foot">
      <span>${a.reporter} · 정운타임즈</span>
      <span class="ncard__more">기사 읽기
        <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true"><path d="M1 5h9M6.5 1.5 10 5l-3.5 3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
    </span>
  </article>`;
}

function renderCards(){
  const grid = document.getElementById('newsGrid');
  if (!grid) return;
  const list = ARTICLES.filter(a => activeCat === 'all' || a.cat === activeCat);
  const slice = list.slice(0, shown);
  grid.innerHTML = slice.map(cardHTML).join('');
  $$('.ncard', grid).forEach(card => bindTilt(card, 4, 5));

  const count = document.getElementById('newsCount');
  if (count){
    count.textContent = activeCat === 'all'
      ? `전체 ${list.length}개 지면 · ${slice.length}개 표시`
      : `'${CATNAME[activeCat]}' 지면 ${list.length}개 · ${slice.length}개 표시`;
  }
  const more = document.getElementById('loadMore');
  if (more) more.hidden = slice.length >= list.length;
}

function setCat(cat, scroll){
  activeCat = cat;
  shown = PAGE;
  renderTabs();
  renderCards();
  $$('.nav__cat').forEach(b => b.classList.toggle('is-active', b.dataset.cat === cat));
  if (scroll){
    const t = document.getElementById('news');
    if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/* ------------------------------ 10. 기사 모달 ------------------------------ */
let lastFocus = null;

function articleHTML(a){
  const catName = CATNAME[a.cat] || '';
  const blocks = a.body.map((b, i) => {
    if (b.t === 'h') return `<h3>${b.c}</h3>`;
    if (b.t === 'q') return `<p class="article__quote">${b.c}</p>`;
    if (b.t === 'ul') return `<ul>${b.c.map(x => `<li>${x}</li>`).join('')}</ul>`;
    return `<p class="${b.lead ? 'lead' : ''}">${b.c}</p>`;
  }).join('');
  const ctaHref = a.cta && a.cta.label === '카톡으로 문의'
    ? 'https://pf.kakao.com/_TguvX/chat'
    : 'https://adorable-gaufre-c07661.netlify.app/';
  return `<p class="article__kicker">${catName} · ${a.kicker}</p>
    <h2 class="article__title" id="amTitle">${a.title}</h2>
    <p class="article__deck">${a.deck}</p>
    <div class="article__meta">
      <span><b>${a.reporter}</b> 기자</span>
      <span>${a.date}</span>
      <span>읽는 시간 ${a.read}분</span>
      <span>정운타임즈 ${catName}면</span>
    </div>
    <div class="article__body">${blocks}</div>
    <div class="article__sign">
      <span class="stamp" aria-hidden="true">正運</span>
      <span>정운타임즈 · ${catName}면<br>명리학 참고 콘텐츠이며 결과를 보장하지 않습니다.</span>
    </div>
    <div class="article__cta">
      <p>${a.cta ? a.cta.text : ''}</p>
      <a class="btn btn--gold" href="${ctaHref}" target="_blank" rel="noopener">${a.cta ? a.cta.label : '정밀 리포트 보기'}</a>
    </div>
    <div class="article__tags">${(a.tags || []).map(t => `<span class="article__tag">#${t}</span>`).join('')}</div>`;
}

function openArticle(id){
  const a = ARTICLES.find(x => x.id === id);
  if (!a) return;
  const modal = document.getElementById('articleModal');
  const holder = document.getElementById('amArticle');
  const scroller = document.getElementById('amScroll');
  holder.innerHTML = articleHTML(a);
  if (scroller) scroller.scrollTop = 0;
  lastFocus = document.activeElement;
  modal.hidden = false;
  document.body.classList.add('is-modal');
  document.documentElement.style.overflow = 'hidden';
  document.documentElement.style.paddingRight = (window.innerWidth - document.documentElement.clientWidth) + 'px';
  const closeBtn = $('.modal__close', modal);
  if (closeBtn) closeBtn.focus({ preventScroll: true });
}

function closeArticle(){
  const modal = document.getElementById('articleModal');
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  document.body.classList.remove('is-modal');
  document.documentElement.style.overflow = '';
  document.documentElement.style.paddingRight = '';
  if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
}

function initModal(){
  const modal = document.getElementById('articleModal');
  if (!modal) return;
  modal.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) closeArticle();
  });
  document.addEventListener('keydown', (e) => {
    if (modal.hidden) return;
    if (e.key === 'Escape'){ closeArticle(); return; }
    if (e.key === 'Tab'){
      const focusables = $$('a[href], button:not([disabled]), input, select, [tabindex]:not([tabindex="-1"])', modal)
        .filter(el => el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    }
  });
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-article]');
    if (trigger){ openArticle(trigger.dataset.article); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const trigger = e.target.closest('[data-article][role="button"]');
    if (trigger){ e.preventDefault(); openArticle(trigger.dataset.article); }
  });
}

/* ------------------------------ 11. 무료 운세 ------------------------------ */
const REL = {
  in: {
    key:'in', name:'인성(印星)', short:'받는 날',
    head:[
      (U, T) => `${T.k}${josa(T,'iga')} ${U.k}${josa(U,'eul')} 살린다 — 받는 쪽이 유리한 하루`,
      (U, T) => `나를 채우는 기운이 들어온다 — 오늘은 베풂이 곧 이자`,
      (U, T) => `${U.k}${josa(U,'iga')} 목마른 날, ${T.k}${josa(T,'iga')} 물이 된다 — 도움을 청하라`
    ],
    deck:[
      '누군가의 도움이 실제로 힘이 되는 날입니다. 혼자 해결하려 애쓰기보다 먼저 물어보세요. 배움·문서·윗사람과의 자리가 잘 풀립니다.',
      '오늘은 받아들이는 날입니다. 거절하지 말고 제안을 들어보세요. 책과 서류, 계약서에 눈이 가는 하루입니다.',
      '몸이 쉬고 싶어 하는 신호가 오면 그것을 업무 태만으로 오해하지 마세요. 회복이 곧 다음의 실력입니다.'
    ],
    advice:[
      '오전에 도움을 요청할 사람 한 명에게 연락해 보세요. 답이 오늘 안에 옵니다.',
      '결정을 미뤄도 되는 날입니다. 대신 읽고 정리하세요.',
      '받은 호의는 오늘 안에 한 번 돌려주면 관계가 길어집니다.'
    ],
    caution:[
      '받는 것에 익숙해져 고맙다는 말을 잊지 마세요. 오늘의 실수는 게으름보다 무례에서 옵니다.',
      '보호받으려는 마음이 커지면 판단이 흐려집니다. 중요한 결정은 내 몫입니다.'
    ],
    delta: 15
  },
  out: {
    key:'out', name:'식상(食傷)', short:'내보내는 날',
    head:[
      (U, T) => `${U.k}${josa(U,'iga')} ${T.k}${josa(T,'eul')} 흘려보낸다 — 말과 손이 재주가 되는 하루`,
      (U, T) => `표현이 돈이 되는 날 — 오늘 만든 것을 밖으로 꺼내라`,
      (U, T) => `말이 많아지는 날, ${T.k}의 기운이 나를 거쳐 나간다 — SNS보다 원고`
    ],
    deck:[
      '아이디어가 밖으로 나가려는 날입니다. 초안을 완성하지 못해도 괜찮으니 꺼내 놓으세요. 사람들이 반응하는 지점이 실마리입니다.',
      '오늘의 재주는 손과 입에서 나옵니다. 미뤄 둔 글·영상·제안서에 손을 대면 생각보다 잘 풀립니다.',
      '말이 잘 나오는 날일수록 조심해야 합니다. 정확한 지적은 칼이 되고, 가벼운 농담은 오래 남습니다.'
    ],
    advice:[
      '오후 두 시 이전에 하나를 세상에 내놓으세요. 완성도보다 공개가 먼저입니다.',
      '누군가에게 설명할 기회가 오면 사양하지 마세요. 오늘의 설명이 다음의 기회입니다.',
      '먹는 것과 말하는 것 모두 절제하면 기운이 오래갑니다.'
    ],
    caution:[
      '말실수 하나가 하루의 흐름을 바꿉니다. 보내기 전에 한 번만 다시 읽으세요.',
      '에너지를 다 쏟으면 저녁에 텅 빕니다. 오후에 30분은 비워 두세요.'
    ],
    delta: 7
  },
  jae: {
    key:'jae', name:'재성(財星)', short:'잡는 날',
    head:[
      (U, T) => `${U.k}${josa(U,'iga')} ${T.k}${josa(T,'eul')} 쥔다 — 돈 냄새를 맡는 하루`,
      (U, T) => `오늘은 체면보다 계산 — 작은 수익이 큰 지출을 막는다`,
      (U, T) => `거래와 협상에 유리한 날 — 숫자를 먼저 꺼내라`
    ],
    deck:[
      '돈이 오가는 자리에서 감각이 살아나는 날입니다. 미뤄 둔 청구·정산·견적을 오늘 처리하면 흐름이 바뀝니다.',
      '오늘의 재물은 관계에서 옵니다. 오래된 거래처나 잊고 있던 채권을 떠올려 보세요.',
      '큰 결정보다 작은 회수가 유리합니다. 들어올 돈을 먼저 확인하고, 나갈 돈은 하루 미루세요.'
    ],
    advice:[
      '오늘 받을 돈이 있다면 오전에 연락하세요. 미루면 다음 달로 넘어갑니다.',
      '지출을 적어 보세요. 새는 곳 하나가 보이면 그것만 막아도 이깁니다.',
      '협상 자리에서는 먼저 숫자를 말하는 쪽이 유리합니다.'
    ],
    caution:[
      '재물이 보이는 날일수록 과소비가 따라옵니다. 오늘 산 것 중 내일도 필요할 것만 남기세요.',
      '사람에게 돈을 빌려주는 약속은 오늘 하지 마세요. 관계와 돈이 함께 흔들립니다.'
    ],
    delta: 11
  },
  gwan: {
    key:'gwan', name:'관성(官星)', short:'눌리는 날',
    head:[
      (U, T) => `${T.k}${josa(T,'iga')} ${U.k}${josa(U,'eul')} 누른다 — 속도를 줄여야 이기는 하루`,
      (U, T) => `책임이 무거워지는 날 — 오늘은 완주보다 정리`,
      (U, T) => `상사의 말이 오래 남는 날 — 받아 적고 하루 뒤에 답하라`
    ],
    deck:[
      '압박이 들어오는 날입니다. 오늘의 압박은 능력이 부족해서가 아니라 자리가 무거워서 옵니다. 속도를 줄이면 오히려 정확해집니다.',
      '규칙과 절차가 나를 지켜 주는 날입니다. 편법보다 정석이 빠릅니다. 서류와 마감을 먼저 챙기세요.',
      '감정으로 맞서면 손해입니다. 오늘은 기록하고, 답은 내일 하는 편이 낫습니다.'
    ],
    advice:[
      '해야 할 일을 세 개로 줄이세요. 오늘은 많이 하는 것보다 안 틀리는 것이 중요합니다.',
      '지시를 받으면 메모하고 한 번 되읽어 확인하세요. 오해가 사고의 절반입니다.',
      '점심 뒤 10분 산책이 오후의 압박을 절반으로 줄입니다.'
    ],
    caution:[
      '말대꾸 한마디가 오래 남는 날입니다. 오늘은 이기지 말고 넘기세요.',
      '몸의 긴장이 목과 어깨로 옵니다. 한 시간마다 한 번씩 stretch 하세요.'
    ],
    delta: -6
  },
  bi: {
    key:'bi', name:'비화(比和)', short:'겹치는 날',
    head:[
      (U, T) => `${T.k}${josa(T,'gwa')} ${U.k}${josa(U,'iga')} 겹친다 — 힘은 두 배, 고집도 두 배`,
      (U, T) => `같은 기운끼리 부딪히는 날 — 오늘의 전략은 양보`,
      (U, T) => `내 힘이 그대로 드러나는 날 — 혼자보다 둘이 빠르다`
    ],
    deck:[
      '내 기운이 강해지는 날입니다. 밀어붙이면 잘 되지만, 같은 기운을 가진 사람과 부딪히면 소모가 큽니다.',
      '동료·친구와 함께할 때 일이 풀립니다. 다만 역할을 먼저 나누지 않으면 같은 일을 두 번 합니다.',
      '오늘은 판단이 단호해집니다. 단호함이 독선이 되지 않도록 한 번 더 들어 보세요.'
    ],
    advice:[
      '혼자 결정하지 말고 한 사람에게 먼저 말해 보세요. 반대 의견이 오늘의 보약입니다.',
      '운동처럼 몸을 쓰는 일이 기운을 정리해 줍니다.',
      '경쟁이 생기면 이기려 하지 말고 판을 바꾸세요.'
    ],
    caution:[
      '고집이 세지는 날입니다. 내가 맞다는 확신이 들 때 한 번 멈추세요.',
      '사람에게 힘을 쓰면 관계가 상합니다. 오늘은 말투를 낮추는 것만으로 이깁니다.'
    ],
    delta: 3
  }
};

const CLASH = { 0:6, 6:0, 1:7, 7:1, 2:8, 8:2, 3:9, 9:3, 4:10, 10:4, 5:11, 11:5 };
const HAP = { 0:1, 1:0, 2:11, 11:2, 3:10, 10:3, 4:9, 9:4, 5:8, 8:5, 6:7, 7:6 };

function hashStr(s){
  let h = 2166136261;
  for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a){
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function relationOf(userOh, todayOh){
  if (userOh === todayOh) return REL.bi;
  if ((userOh + 1) % 5 === todayOh) return REL.out;   // 내가 생한다
  if ((todayOh + 1) % 5 === userOh) return REL.in;    // 나를 생한다
  if ((userOh + 2) % 5 === todayOh) return REL.jae;   // 내가 극한다
  if ((todayOh + 2) % 5 === userOh) return REL.gwan;  // 나를 극한다
  return REL.bi;
}

function buildFortune(birth, zodiacIdx){
  const dayG = TODAY_DAY;
  const tStem = dayG.s, tBranch = dayG.b;
  let userOh, userBranch = null, userStemIdx = null, mode = 'zodiac';

  if (birth){
    const di = dayIndex(birth.y, birth.m, birth.d);
    const g = ganjiOf(di);
    userStemIdx = g.idx % 10;
    userOh = STEMS[userStemIdx].oh;
    // 띠는 태어난 해의 지지 — 입춘(2/4) 이전이면 전년도
    const yAdj = (birth.m < 2 || (birth.m === 2 && birth.d < 4)) ? birth.y - 1 : birth.y;
    userBranch = yearIndex(yAdj) % 12;
    mode = 'birth';
  } else {
    userBranch = zodiacIdx;
    userOh = BRANCHES[zodiacIdx].oh;
  }

  const rel = relationOf(userOh, tStem.oh);
  const U = OH[userOh], T = OH[tStem.oh];

  const key = `${NOW.y}-${NOW.m}-${NOW.d}|${mode === 'birth' ? birth.y + '-' + birth.m + '-' + birth.d : 'z' + userBranch}`;
  const rng = mulberry32(hashStr(key));
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];

  let headline = `${dayG.s.h}${dayG.b.h}일, ` + pick(rel.head)(U, T);
  const deck = pick(rel.deck);
  const advice = pick(rel.advice);
  let caution = pick(rel.caution);

  const isClash = userBranch !== null && CLASH[userBranch] === tBranch.idx % 12;
  const isHap = userBranch !== null && HAP[userBranch] === tBranch.idx % 12;

  if (isClash){
    caution = `오늘은 ${tBranch.h}(${tBranch.k})일 — ${BRANCHES[userBranch].animal}띠와 충(沖)입니다. 약속 시간과 서류를 한 번 더 확인하세요. 이동 중 실수가 나기 쉬운 날입니다.`;
  } else if (isHap){
    caution = `오늘은 ${tBranch.h}(${tBranch.k})일 — ${BRANCHES[userBranch].animal}띠와 합(合)입니다. 누군가의 도움이 들어오지만, 그 도움에 기대기만 하면 흐름을 놓칩니다.`;
  }

  let score = 58 + rel.delta + Math.round(rng() * 18);
  if (isClash) score -= 9;
  if (isHap) score += 5;
  score = Math.max(32, Math.min(97, score));

  // 행운의 색 — 내 기운을 북돋는 인성(나를 생하는 오행) 또는 내 오행
  const supportIdx = (userOh + 4) % 5;
  const colorIdx = rng() < 0.55 ? supportIdx : userOh;
  const C = OH[colorIdx];
  const luckyNum = C.nums[Math.floor(rng() * C.nums.length)];
  const luckyNum2 = C.nums[(C.nums.indexOf(luckyNum) + 1) % C.nums.length];
  const luckyTime = OH[(supportIdx + Math.floor(rng() * 2)) % 5].hours;

  const who = mode === 'birth'
    ? `${STEMS[userStemIdx].k}${STEMS[userStemIdx].h} 일간 · ${BRANCHES[userBranch].animal}띠`
    : `${BRANCHES[userBranch].animal}띠(${BRANCHES[userBranch].h}) 기준`;

  return {
    headline, deck, advice, caution, score, rel, who,
    color: C, luckyNum, luckyNum2, luckyTime,
    ganji: dayG.s.h + dayG.b.h,
    tagDate: `${NOW.m}월 ${NOW.d}일`
  };
}

function renderFortune(f){
  const body = document.getElementById('fBody');
  const empty = document.getElementById('fEmpty');
  if (!body) return;
  const len = f.score >= 80 ? '강한 상승' : f.score >= 65 ? '무난한 상승' : f.score >= 50 ? '평이' : '주의 필요';
  body.innerHTML = `
    <div class="fr-top">
      <span class="fr-top__paper">정운타임즈 · 오늘의 1면</span>
      <span class="fr-top__date">${f.tagDate} ${f.ganji}일</span>
    </div>
    <h3 class="fr-headline">${f.headline}</h3>
    <p class="fr-deck">${f.deck}</p>
    <div class="fr-meter">
      <div class="fr-meter__top"><span>오늘의 기운 지수 · ${len}</span><b>${f.score}</b></div>
      <div class="fr-meter__bar"><div class="fr-meter__fill" id="frFill"></div></div>
    </div>
    <div class="fr-facts">
      <div class="fr-fact"><small>행운의 색</small><b><span class="fr-swatch" style="background:${f.color.hex}"></span>${f.color.color}</b></div>
      <div class="fr-fact"><small>행운의 숫자</small><b>${f.luckyNum} · ${f.luckyNum2}</b></div>
      <div class="fr-fact"><small>행운의 시간</small><b>${f.luckyTime}</b></div>
      <div class="fr-fact"><small>오늘의 기운</small><b>${f.rel.name.replace(/\(.*\)/, '')}</b></div>
    </div>
    <div class="fr-tags">
      <span class="fr-tag">${f.who}</span>
      <span class="fr-tag">${f.rel.short}</span>
      <span class="fr-tag">${f.ganji}일</span>
    </div>
    <div class="fr-caution"><b>주의</b><span>${f.caution}</span></div>
    <div class="fr-cta">
      <a class="btn btn--gold" href="https://adorable-gaufre-c07661.netlify.app/" target="_blank" rel="noopener">60P 정밀 리포트 보기</a>
      <a class="btn btn--outline" href="https://pf.kakao.com/_TguvX/chat" target="_blank" rel="noopener">카톡 상담</a>
    </div>
    <p class="fr-note">오늘의 조언 — ${f.advice} 재미로 보는 참고용 콘텐츠이며, 대운·세운은 정밀 리포트에서 봅니다.</p>
    <div class="fr-again"><button type="button" id="frAgain">다른 날짜로 다시 보기</button></div>
  `;
  if (empty) empty.hidden = true;
  body.hidden = false;
  requestAnimationFrame(() => {
    const fill = document.getElementById('frFill');
    if (fill) fill.style.width = f.score + '%';
  });
  const again = document.getElementById('frAgain');
  if (again) again.addEventListener('click', () => {
    const birth = document.getElementById('fBirth');
    if (birth) birth.focus({ preventScroll: false });
    const card = document.querySelector('.fcard');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

function initFortune(){
  const form = document.getElementById('fortuneForm');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const dateVal = (document.getElementById('fBirth') || {}).value || '';
    const zVal = (document.getElementById('fZodiac') || {}).value || '';
    if (!dateVal && zVal === ''){
      toast('생년월일 또는 띠를 먼저 선택해 주세요.');
      const d = document.getElementById('fBirth');
      if (d) d.focus();
      return;
    }
    let birth = null;
    if (dateVal){
      const m = dateVal.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m){ toast('생년월일 형식을 확인해 주세요.'); return; }
      birth = { y: +m[1], m: +m[2], d: +m[3] };
      if (birth.y < 1920 || birth.y > 2026 || isFuture(birth) || !validDate(birth)){
        toast('생년월일을 다시 확인해 주세요.'); return;
      }
    }
    const f = buildFortune(birth, zVal === '' ? null : Number(zVal));
    renderFortune(f);
    if (window.innerWidth < 940){
      const res = document.getElementById('fresult');
      if (res) res.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  const sel = document.getElementById('fZodiac');
  if (sel) sel.addEventListener('change', () => {
    const d = document.getElementById('fBirth');
    if (sel.value !== '' && d) d.value = '';
  });
  const birth = document.getElementById('fBirth');
  if (birth) birth.addEventListener('change', () => {
    if (birth.value && sel) sel.value = '';
  });
}
function validDate(b){
  const dt = new Date(Date.UTC(b.y, b.m - 1, b.d));
  return dt.getUTCFullYear() === b.y && dt.getUTCMonth() === b.m - 1 && dt.getUTCDate() === b.d;
}
function isFuture(b){
  return (b.y > NOW.y) || (b.y === NOW.y && (b.m > NOW.m || (b.m === NOW.m && b.d > NOW.d)));
}

/* ------------------------------ 12. 구독 ------------------------------ */
function initSubscribe(){
  const form = document.getElementById('subForm');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = (document.getElementById('subEmail') || {}).value || '';
    const agree = document.getElementById('subAgree');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){
      toast('이메일 주소를 확인해 주세요.'); return;
    }
    if (!agree || !agree.checked){
      toast('수신 동의에 체크해 주세요.'); return;
    }
    const subject = encodeURIComponent('[정운타임즈] 주간 사주신문 구독 신청');
    const body = encodeURIComponent(
      '정운타임즈 주간 사주신문을 신청합니다.\n\n' +
      '이메일: ' + email + '\n' +
      '신청일: ' + todayLabel + '\n\n' +
      '주간 사주신문 수신 및 이메일 수집·이용에 동의합니다.\n' +
      '(수집 항목: 이메일 / 목적: 뉴스레터 발송 / 보유: 해지 시 즉시 파기)'
    );
    window.location.href = `mailto:22jutimes@gmail.com?subject=${subject}&body=${body}`;
    toast('메일 앱이 열립니다. 전송을 누르면 접수됩니다.');
  });
}

/* ------------------------------ 13. 토스트 / 내비 ------------------------------ */
let toastTimer = null;
function toast(msg){
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 3600);
}

function initNav(){
  const nav = document.getElementById('nav');
  if (nav){
    const onScroll = () => nav.classList.toggle('is-stuck', window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
  // 상단 내비 카테고리 → 지면 필터 + 이동
  $$('.nav__cat').forEach(btn => {
    btn.addEventListener('click', () => setCat(btn.dataset.cat, true));
  });
  // 섹션 탭
  const tabs = document.getElementById('tabs');
  if (tabs) tabs.addEventListener('click', (e) => {
    const b = e.target.closest('.tab');
    if (b) setCat(b.dataset.cat, false);
  });
  const more = document.getElementById('loadMore');
  if (more) more.addEventListener('click', () => { shown += PAGE; renderCards(); });
}

/* ------------------------------ 14. 부트 ------------------------------ */
function boot(){
  initMeta();
  initTicker();
  renderTabs();
  renderCards();
  initReveal();
  initCountUp();
  initSky();
  initModal();
  initFortune();
  initSubscribe();
  initNav();
  bindTilt(document.querySelector('[data-tilt]'), 7, 0);
  // 해시로 들어온 경우 지면으로
  if (location.hash === '#news'){ /* 그대로 */ }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
