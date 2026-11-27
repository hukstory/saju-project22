/* ============================================================================
   운명사주 정운타임즈 · engine.js
   1) 간지·사주 계산 (KASI 절기·음양력 기반 로직을 브라우저용으로 이식)
   2) 오늘의 운세 · 궁합 · 전생 · 오행 판정
   3) 공유 카드(캔버스) 렌더러
   ========================================================================== */
'use strict';

/* ---------- 0. 상수 ---------- */
const STEMS = [
  { h:'甲', k:'갑', oh:0, yang:true },  { h:'乙', k:'을', oh:0, yang:false },
  { h:'丙', k:'병', oh:1, yang:true },  { h:'丁', k:'정', oh:1, yang:false },
  { h:'戊', k:'무', oh:2, yang:true },  { h:'己', k:'기', oh:2, yang:false },
  { h:'庚', k:'경', oh:3, yang:true },  { h:'辛', k:'신', oh:3, yang:false },
  { h:'壬', k:'임', oh:4, yang:true },  { h:'癸', k:'계', oh:4, yang:false }
];
const BRANCHES = [
  { h:'子', k:'자', oh:4, animal:'쥐' },    { h:'丑', k:'축', oh:2, animal:'소' },
  { h:'寅', k:'인', oh:0, animal:'호랑이' }, { h:'卯', k:'묘', oh:0, animal:'토끼' },
  { h:'辰', k:'진', oh:2, animal:'용' },    { h:'巳', k:'사', oh:1, animal:'뱀' },
  { h:'午', k:'오', oh:1, animal:'말' },    { h:'未', k:'미', oh:2, animal:'양' },
  { h:'申', k:'신', oh:3, animal:'원숭이' }, { h:'酉', k:'유', oh:3, animal:'닭' },
  { h:'戌', k:'술', oh:2, animal:'개' },    { h:'亥', k:'해', oh:4, animal:'돼지' }
];
const OH = [
  { k:'목', h:'木', batchim:true,  key:'wood',  colors:['청록','연둣빛','옥색'],  hex:'#2F6B4F', nums:[3,8],  organ:'간·눈·근육',  dir:'동쪽',  season:'봄',  hours:'05–07시', taste:'신맛' },
  { k:'화', h:'火', batchim:false, key:'fire',  colors:['주홍','버건디','코랄'], hex:'#A63328', nums:[2,7], organ:'심장·혈관', dir:'남쪽', season:'여름', hours:'11–13시', taste:'쓴맛' },
  { k:'토', h:'土', batchim:false, key:'earth', colors:['황토','카멜','베이지'], hex:'#9A7434', nums:[5,10], organ:'위장·소화', dir:'중앙', season:'환절기', hours:'13–15시', taste:'단맛' },
  { k:'금', h:'金', batchim:true,  key:'metal', colors:['은백','백금','아이보리'], hex:'#8C8A82', nums:[4,9], organ:'폐·피부',  dir:'서쪽',  season:'가을', hours:'17–19시', taste:'매운맛' },
  { k:'수', h:'水', batchim:false, key:'water', colors:['흑청','네이비','먹색'], hex:'#274A6B', nums:[1,6], organ:'신장·뼈',  dir:'북쪽',  season:'겨울', hours:'21–23시', taste:'짠맛' }
];
function josa(oh, kind){
  const b = oh.batchim;
  if (kind === 'iga') return b ? '이' : '가';
  if (kind === 'eul') return b ? '을' : '를';
  if (kind === 'eun') return b ? '은' : '는';
  if (kind === 'gwa') return b ? '과' : '와';
  return b ? '으로' : '로';
}

/* ---------- 1. 날짜·간지 ---------- */
const DAY = 86400000;
function kstNow(){
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return { y:d.getUTCFullYear(), m:d.getUTCMonth()+1, d:d.getUTCDate(), wd:d.getUTCDay(), h:d.getUTCHours(), mi:d.getUTCMinutes() };
}
function jdFromUTC(y,m,d){
  let yy=y, mm=m;
  if (mm <= 2){ yy -= 1; mm += 12; }
  const a = Math.floor(yy/100);
  const b = 2 - a + Math.floor(a/4);
  return Math.floor(365.25*(yy+4716)) + Math.floor(30.6001*(mm+1)) + d + b - 1524.5;
}
/** 일주 — Julian Day 기반. 정운 사주분석 엔진과 같은 식 */
function dayIndex(y,m,d){
  const jd = jdFromUTC(y,m,d);
  const diff = Math.round(jd - 2415050.5);
  return ((40 + diff) % 60 + 60) % 60;
}
function ganjiOf(idx){
  const s = STEMS[idx % 10], b = BRANCHES[idx % 12];
  return { idx, s, b, hanja:s.h+b.h, korean:s.k+b.k };
}
function yearIndex(y){ return ((y - 4) % 60 + 60) % 60; }
/** 절기 경계 — 월지 (입춘·경칩·청명… 근사 일자) */
const MONTH_TERMS = [
  { md:105, b:1 }, { md:204, b:2 }, { md:306, b:3 }, { md:405, b:4 },
  { md:506, b:5 }, { md:606, b:6 }, { md:707, b:7 }, { md:808, b:8 },
  { md:908, b:9 }, { md:1008, b:10 }, { md:1107, b:11 }, { md:1207, b:0 }
];
function monthBranchOf(y,m,d){
  const key = m*100 + d;
  let found = null;
  for (const t of MONTH_TERMS) if (key >= t.md) found = t;
  if (!found) return { b:0, termYear:y-1 };
  return { b:found.b, termYear:y };
}
function monthPillar(y,m,d){
  const mb = monthBranchOf(y,m,d);
  const yp = yearIndex(mb.termYear);
  const yStem = yp % 10;
  const ordinal = ((mb.b - 2) + 12) % 12;
  const stem = (yStem*2 + ordinal + 2) % 10;
  return ganjiOf(((stem*6 - mb.b*5) % 60 + 60) % 60);
}
function yearPillar(y,m,d){
  const adj = (m < 2 || (m === 2 && d < 4)) ? y - 1 : y;
  return { g:ganjiOf(yearIndex(adj)), adj };
}
function hourPillar(dayStemIdx, hour){
  const hb = Math.floor((((Number(hour) + 1) % 24) / 2)) % 12; // 23:00~00:59 = 子
  const stem = (dayStemIdx * 2 + hb) % 10;
  const idx = ((stem*6 - hb*5) % 60 + 60) % 60;
  return { g:ganjiOf(idx), branch:hb };
}
/** 사주 네 기둥 + 오행 분포 */
function sajuOf(birth, hour){
  const yp = yearPillar(birth.y, birth.m, birth.d);
  const mp = monthPillar(birth.y, birth.m, birth.d);
  const dp = ganjiOf(dayIndex(birth.y, birth.m, birth.d));
  const hp = (hour === null || hour === undefined || hour === '') ? null : hourPillar(dp.idx % 10, Number(hour));
  const counts = [0,0,0,0,0];
  const add = (g) => { counts[g.s.oh]++; counts[g.b.oh]++; };
  add(yp.g); add(mp); add(dp); if (hp) add(hp.g);
  const min = Math.min(...counts);
  const lack = counts.indexOf(min);
  const max = Math.max(...counts);
  const strong = counts.indexOf(max);
  return {
    year:yp.g, month:mp, day:dp, hour:hp ? hp.g : null,
    counts, lack, strong,
    ilgan:STEMS[dp.idx % 10],
    ilji:dp.b,
    eight: [yp.g.korean, mp.korean, dp.korean, hp ? hp.g.korean : null]
  };
}

/* ---------- 2. 오행 관계 ---------- */
const REL = {
  in:  { key:'in',  name:'인성(印星)', short:'받는 날', delta:14 },
  out: { key:'out', name:'식상(食傷)', short:'내보내는 날', delta:6 },
  jae: { key:'jae', name:'재성(財星)', short:'잡는 날', delta:11 },
  gwan:{ key:'gwan',name:'관성(官星)', short:'눌리는 날', delta:-7 },
  bi:  { key:'bi',  name:'비화(比和)', short:'겹치는 날', delta:2 }
};
function relationOf(myOh, todayOh){
  if (myOh === todayOh) return REL.bi;
  if ((myOh + 1) % 5 === todayOh) return REL.out;
  if ((todayOh + 1) % 5 === myOh) return REL.in;
  if ((myOh + 2) % 5 === todayOh) return REL.jae;
  if ((todayOh + 2) % 5 === myOh) return REL.gwan;
  return REL.bi;
}
const CLASH = { 0:6, 6:0, 1:7, 7:1, 2:8, 8:2, 3:9, 9:3, 4:10, 10:4, 5:11, 11:5 };
const HAP   = { 0:1, 1:0, 2:11, 11:2, 3:10, 10:3, 4:9, 9:4, 5:8, 8:5, 6:7, 7:6 };

/* ---------- 3. 시드 유틸 ---------- */
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
function rngOf(seedStr){ return mulberry32(hashStr(String(seedStr))); }
function pickFrom(arr, rng){ return arr[Math.floor(rng() * arr.length)]; }

/* ---------- 4. 오늘의 운세 ---------- */
const NOW = kstNow();
const TODAY_DAY = ganjiOf(dayIndex(NOW.y, NOW.m, NOW.d));
const TODAY_MONTH = monthPillar(NOW.y, NOW.m, NOW.d);
const TODAY_YEAR = yearPillar(NOW.y, NOW.m, NOW.d).g;
const WD = ['일','월','화','수','목','금','토'];
const TODAY_KEY = `${NOW.y}-${NOW.m}-${NOW.d}`;
const TODAY_LABEL = `${NOW.y}년 ${NOW.m}월 ${NOW.d}일 ${WD[NOW.wd]}요일`;
const ISSUE_NO = Math.max(1, Math.floor((Date.UTC(NOW.y, NOW.m-1, NOW.d) - Date.UTC(2026, 10, 11)) / (7*DAY)) + 1);

const TODAY_TEXT = {
  in: {
    head:[
      (U,T)=>`${T.k}${josa(T,'iga')} ${U.k}${josa(U,'eul')} 살린다 — 받는 쪽이 유리한 하루`,
      (U,T)=>`나를 채우는 기운이 들어온다 — 오늘의 베풂은 내일의 이자`,
      (U,T)=>`${U.k}${josa(U,'iga')} 목마른 날, ${T.k}${josa(T,'iga')} 물이 된다`
    ],
    deck:[
      '누군가의 도움이 실제로 힘이 되는 날입니다. 혼자 해결하려 애쓰기보다 먼저 물어보세요. 배움·문서·윗사람과의 자리가 잘 풀립니다.',
      '오늘은 받아들이는 날입니다. 거절하지 말고 제안을 들어보세요. 책과 서류, 계약서에 눈이 가는 하루입니다.',
      '몸이 쉬고 싶어 한다고 게으른 것이 아닙니다. 회복이 곧 다음의 실력입니다.'
    ],
    advice:['오전에 도움을 청할 사람 한 명에게 연락해 보세요. 답이 오늘 안에 옵니다.','결정을 미뤄도 되는 날입니다. 대신 읽고 정리하세요.','받은 호의는 오늘 안에 한 번 돌려주면 관계가 길어집니다.'],
    caution:['받는 것에 익숙해져 고맙다는 말을 잊지 마세요.','보호받으려는 마음이 커지면 판단이 흐려집니다. 중요한 결정은 내 몫입니다.']
  },
  out: {
    head:[
      (U,T)=>`${U.k}${josa(U,'iga')} ${T.k}${josa(T,'eul')} 흘려보낸다 — 말과 손이 재주가 되는 하루`,
      (U,T)=>`표현이 곧 돈이 되는 날 — 만든 것을 밖으로 꺼내라`,
      (U,T)=>`말이 많아지는 날, ${T.k}의 기운이 나를 거쳐 나간다`
    ],
    deck:[
      '아이디어가 밖으로 나가려는 날입니다. 초안을 완성하지 못해도 괜찮으니 꺼내 놓으세요. 반응하는 지점이 실마리입니다.',
      '오늘의 재주는 손과 입에서 나옵니다. 미뤄 둔 글·영상·제안서에 손을 대면 생각보다 잘 풀립니다.',
      '말이 잘 나오는 날일수록 조심해야 합니다. 정확한 지적은 칼이 되고, 가벼운 농담은 오래 남습니다.'
    ],
    advice:['오후 두 시 이전에 하나를 세상에 내놓으세요. 완성도보다 공개가 먼저입니다.','설명할 기회가 오면 사양하지 마세요. 오늘의 설명이 다음 기회입니다.','먹는 것과 말하는 것 모두 절제하면 기운이 오래갑니다.'],
    caution:['말실수 하나가 하루의 흐름을 바꿉니다. 보내기 전에 한 번만 다시 읽으세요.','에너지를 다 쏟으면 저녁에 텅 빕니다. 오후에 30분은 비워 두세요.']
  },
  jae: {
    head:[
      (U,T)=>`${U.k}${josa(U,'iga')} ${T.k}${josa(T,'eul')} 쥔다 — 돈 냄새를 맡는 하루`,
      (U,T)=>`오늘은 체면보다 계산 — 작은 수익이 큰 지출을 막는다`,
      (U,T)=>`거래와 협상에 유리한 날 — 숫자를 먼저 꺼내라`
    ],
    deck:[
      '돈이 오가는 자리에서 감각이 살아나는 날입니다. 미뤄 둔 청구·정산·견적을 오늘 처리하면 흐름이 바뀝니다.',
      '오늘의 재물은 관계에서 옵니다. 오래된 거래처나 잊고 있던 채권을 떠올려 보세요.',
      '큰 결정보다 작은 회수가 유리합니다. 들어올 돈을 먼저 확인하고 나갈 돈은 하루 미루세요.'
    ],
    advice:['받을 돈이 있다면 오전에 연락하세요. 미루면 다음 달로 넘어갑니다.','지출을 적어 보세요. 새는 곳 하나만 막아도 이깁니다.','협상 자리에서는 먼저 숫자를 말하는 쪽이 유리합니다.'],
    caution:['재물이 보이는 날일수록 과소비가 따라옵니다.','사람에게 돈을 빌려주는 약속은 오늘 하지 마세요.']
  },
  gwan: {
    head:[
      (U,T)=>`${T.k}${josa(T,'iga')} ${U.k}${josa(U,'eul')} 누른다 — 속도를 줄여야 이기는 하루`,
      (U,T)=>`책임이 무거워지는 날 — 완주보다 정리`,
      (U,T)=>`상사의 말이 오래 남는 날 — 받아 적고 하루 뒤에 답하라`
    ],
    deck:[
      '압박이 들어오는 날입니다. 능력이 부족해서가 아니라 자리가 무거워서 옵니다. 속도를 줄이면 오히려 정확해집니다.',
      '규칙과 절차가 나를 지켜 주는 날입니다. 편법보다 정석이 빠릅니다. 서류와 마감을 먼저 챙기세요.',
      '감정으로 맞서면 손해입니다. 오늘은 기록하고 답은 내일 하는 편이 낫습니다.'
    ],
    advice:['할 일을 세 개로 줄이세요. 오늘은 안 틀리는 것이 이기는 것입니다.','지시를 받으면 메모하고 한 번 되읽어 확인하세요. 오해가 사고의 절반입니다.','점심 뒤 10분 산책이 오후의 압박을 절반으로 줄입니다.'],
    caution:['말대꾸 한마디가 오래 남는 날입니다. 오늘은 이기지 말고 넘기세요.','몸의 긴장이 목과 어깨로 옵니다. 한 시간마다 한 번씩 펴 주세요.']
  },
  bi: {
    head:[
      (U,T)=>`${T.k}${josa(T,'gwa')} ${U.k}${josa(U,'iga')} 겹친다 — 힘도 두 배, 고집도 두 배`,
      (U,T)=>`같은 기운끼리 부딪히는 날 — 오늘의 전략은 양보`,
      (U,T)=>`내 힘이 그대로 드러나는 날 — 혼자보다 둘이 빠르다`
    ],
    deck:[
      '내 기운이 강해지는 날입니다. 밀어붙이면 잘 되지만 같은 기운을 가진 사람과 부딪히면 소모가 큽니다.',
      '동료·친구와 함께할 때 일이 풀립니다. 다만 역할을 먼저 나누지 않으면 같은 일을 두 번 합니다.',
      '오늘은 판단이 단호해집니다. 단호함이 독선이 되지 않도록 한 번 더 들어 보세요.'
    ],
    advice:['혼자 결정하지 말고 한 사람에게 먼저 말해 보세요. 반대 의견이 오늘의 보약입니다.','몸을 쓰는 일이 기운을 정리해 줍니다.','경쟁이 생기면 이기려 하지 말고 판을 바꾸세요.'],
    caution:['고집이 세지는 날입니다. 내가 맞다는 확신이 들 때 한 번 멈추세요.','사람에게 힘을 쓰면 관계가 상합니다. 말투를 낮추는 것만으로 이깁니다.']
  }
};

const LUCK_COLORS = {
  0:[{name:'옥빛 청록',hex:'#2F6B4F'},{name:'올리브 그린',hex:'#5E6B3A'},{name:'딥 에메랄드',hex:'#1E5748'}],
  1:[{name:'짙은 버건디',hex:'#7B1E2B'},{name:'코랄 오렌지',hex:'#C0553B'},{name:'더스티 로즈',hex:'#B77A78'}],
  2:[{name:'로열 골드',hex:'#B8913F'},{name:'카멜 브라운',hex:'#9A7434'},{name:'샌드 베이지',hex:'#D8C7A5'}],
  3:[{name:'샴페인 실버',hex:'#B9B4A6'},{name:'아이보리',hex:'#EFE6D3'},{name:'펄 그레이',hex:'#8C8A82'}],
  4:[{name:'먹빛 네이비',hex:'#22384E'},{name:'딥 블루',hex:'#274A6B'},{name:'차콜 블랙',hex:'#242424'}]
};

function luckNumbers(rng, count){
  const set = new Set();
  while (set.size < (count || 6)) set.add(1 + Math.floor(rng() * 45));
  return Array.from(set);
}

/** 오늘의 운세 — birth(y,m,d) 또는 zodiac(0–11) */
function buildToday(birth, zodiacIdx){
  const tStem = TODAY_DAY.s, tBranch = TODAY_DAY.b;
  let userOh, userBranch = null, mode = 'zodiac', pillars = null, ilganTxt = null;

  if (birth){
    pillars = sajuOf(birth, null);
    userOh = pillars.ilgan.oh;
    userBranch = pillars.year.b.idx % 12;
    ilganTxt = `${pillars.ilgan.h}(${pillars.ilgan.k})`;
    mode = 'birth';
  } else {
    userBranch = Number(zodiacIdx);
    userOh = BRANCHES[userBranch].oh;
    ilganTxt = `${BRANCHES[userBranch].h}${BRANCHES[userBranch].k}`;
  }

  const rel = relationOf(userOh, tStem.oh);
  const U = OH[userOh], T = OH[tStem.oh];
  const seedBase = mode === 'birth'
    ? `${TODAY_KEY}|b|${birth.y}-${birth.m}-${birth.d}`
    : `${TODAY_KEY}|z|${userBranch}`;
  const rng = rngOf(seedBase);

  const isClash = CLASH[userBranch] === tBranch.idx % 12;
  const isHap = HAP[userBranch] === tBranch.idx % 12;

  let score = 62 + rel.delta + (isHap ? 9 : 0) + (isClash ? -11 : 0) + Math.round(rng() * 12 - 6);
  score = Math.max(28, Math.min(98, score));

  const headline = pickFrom(TODAY_TEXT[rel.key].head, rng)(U, T);
  const deck = pickFrom(TODAY_TEXT[rel.key].deck, rng);
  const advice = pickFrom(TODAY_TEXT[rel.key].advice, rng);
  const cautionRaw = pickFrom(TODAY_TEXT[rel.key].caution, rng);
  const caution = isClash
    ? '오늘은 내 띠와 정면으로 부딪히는 날(충)입니다. 큰 계약·이사·말다툼은 하루 미루면 훨씬 부드러워집니다.'
    : cautionRaw;

  const cRng = rngOf(seedBase + '|color');
  const colorOh = rel.key === 'in' ? (userOh + 4) % 5 : rel.key === 'out' ? userOh : rel.key === 'jae' ? tStem.oh : rel.key === 'gwan' ? (userOh + 2) % 5 : userOh;
  const luckColor = pickFrom(LUCK_COLORS[colorOh], cRng);
  const nRng = rngOf(seedBase + '|num');
  const nums = luckNumbers(nRng, 4);

  const timeBest = rel.key === 'in' ? '09–11시' : rel.key === 'out' ? '11–14시' : rel.key === 'jae' ? '13–17시' : rel.key === 'gwan' ? '15–19시' : '07–09시';

  return {
    date:TODAY_LABEL, todayHanja:`${TODAY_YEAR.hanja}年 · ${TODAY_MONTH.hanja}月 · ${TODAY_DAY.hanja}日`,
    todayPillar:TODAY_DAY,
    mode, pillars, userOh, U, T, rel, ilganTxt,
    headline, deck, advice, caution, score,
    isClash, isHap,
    luckColor, nums, timeBest,
    oneLine: `${U.k}${josa(U,'eul')} 쓰는 하루 — ${rel.short}`
  };
}

/* ---------- 5. MBTI 궁합 ---------- */
const MBTI_SCORE_BANDS = [
  { min:88, title:'운명적으로 겹치는 사이', line:'서로의 빈칸을 정확히 채웁니다. 오래 갈수록 편안해지는 조합.', tone:'gil' },
  { min:76, title:'강하게 끌리는 사이', line:'다른 점이 자극이 됩니다. 초반의 설렘이 오래가는 편.', tone:'gil' },
  { min:62, title:'노력이 값을 하는 사이', line:'맞는 부분과 부딪히는 부분이 반반입니다. 규칙을 정하면 오래갑니다.', tone:'jung' },
  { min:48, title:'서로를 배우는 사이', line:'속도와 표현 방식이 다릅니다. 이해하려는 마음이 관계의 절반입니다.', tone:'jung' },
  { min:0,  title:'자극이 큰 사이', line:'끌림과 피로가 함께 옵니다. 거리 조절이 관계를 지킵니다.', tone:'hyung' }
];
function mbtiBand(score){
  for (const b of MBTI_SCORE_BANDS) if (score >= b.min) return b;
  return MBTI_SCORE_BANDS[MBTI_SCORE_BANDS.length-1];
}
function mbtiCompat(a, b){
  if (!a || !b) return null;
  const A = a.split(''), B = b.split('');
  let same = 0;
  A.forEach((c,i)=>{ if (c === B[i]) same++; });
  const rng = rngOf(`mbti|${[a,b].sort().join('-')}`);
  const jitter = Math.round(rng() * 10 - 5);
  let score = 58 + same * 8 + jitter;
  // 상보적 축 보너스 (T/F, J/P 는 다를 때 시너지가 큰 조합이 있다)
  if (A[2] !== B[2]) score += 4;
  if (A[3] !== B[3]) score += 3;
  score = Math.max(34, Math.min(97, score));
  const band = mbtiBand(score);
  const diffs = [];
  if (A[0] !== B[0]) diffs.push({ axis:'E–I', text:'에너지의 방향이 반대입니다. 한 사람은 사람에게서, 한 사람은 혼자 있는 시간에서 충전합니다.' });
  if (A[1] !== B[1]) diffs.push({ axis:'N–S', text:'세상을 보는 렌즈가 다릅니다. 한 사람은 가능성을, 한 사람은 사실을 먼저 봅니다.' });
  if (A[2] !== B[2]) diffs.push({ axis:'T–F', text:'판단의 기준이 다릅니다. 결론을 먼저 원하는 쪽과 마음을 먼저 원하는 쪽이 만납니다.' });
  if (A[3] !== B[3]) diffs.push({ axis:'J–P', text:'하루를 짜는 방식이 다릅니다. 계획과 즉흥이 부딪히면 약속의 형태에서 갈립니다.' });
  if (!diffs.length) diffs.push({ axis:'동일', text:'네 글자가 모두 같습니다. 이해는 빠르지만 같은 약점을 함께 갖습니다.' });
  return { a, b, score, band, diffs, same, jitter };
}

/* ---------- 6. 전생 ---------- */
const PASTLIFE_TYPES = [
  { key:'musician', emblem:'樂', era:'조선 중기 · 장악원', role:'궁중의 악사', oneLine:'사람의 마음을 소리로 옮기던 손',
    habit:'좋아하는 노래를 반복해서 듣는다', lesson:'표현하지 않으면 악보만 남는다',
    link:'지금도 소리와 리듬에 몸이 먼저 반응한다면, 그때의 귀가 아직 남아 있는 것입니다.',
    job:'연주·작곡·콘텐츠 기획', color:'#7B5E2E' },
  { key:'sword', emblem:'劍', era:'고려 말 · 변방', role:'유랑하는 검객', oneLine:'정의보다 생존을 먼저 배운 사람',
    habit:'부당한 일을 보면 지나치지 못한다', lesson:'칼을 내려놓는 용기',
    link:'요즘도 갈등이 생기면 몸이 먼저 굳는다면, 그때의 방어본능이 남은 것입니다.',
    job:'영업·협상·보안', color:'#4A4A4A' },
  { key:'courier', emblem:'驛', era:'조선 후기 · 파발', role:'서찰을 나르는 역졸', oneLine:'소식을 가장 먼저 알고 가장 늦게 말하던 사람',
    habit:'남의 소식을 먼저 확인한다', lesson:'내 소식도 전해야 한다',
    link:'연락을 미루다가 결국 오래된 인연을 잃는 패턴이 있다면 그때의 습관입니다.',
    job:'유통·물류·커뮤니케이션', color:'#3B4B5C' },
  { key:'painter', emblem:'畵', era:'조선 후기 · 사찰', role:'불화를 그리던 화공', oneLine:'보이지 않는 것을 보이게 만든 사람',
    habit:'사진과 색을 오래 들여다본다', lesson:'완성하지 못한 것도 작품이다',
    link:'시작은 많은데 마무리가 어렵다면, 그때의 벽화처럼 큰 그림을 혼자 그리던 습관입니다.',
    job:'디자인·영상·브랜딩', color:'#8A3B2E' },
  { key:'merchant', emblem:'舶', era:'남해 · 개항기', role:'바다를 건너는 상인', oneLine:'위험을 값으로 바꾸는 계산',
    habit:'새로운 시장을 먼저 살핀다', lesson:'혼자 다 벌지 않는 법',
    link:'돈의 흐름을 남보다 빨리 읽는다면, 그때의 장부가 아직 손끝에 있습니다.',
    job:'사업·무역·투자 판단', color:'#1E5B57' },
  { key:'farmer', emblem:'農', era:'삼국 · 들녘', role:'씨앗을 지키는 농부', oneLine:'계절을 믿고 기다릴 줄 알던 사람',
    habit:'해마다 같은 것을 다시 시작한다', lesson:'때를 놓치지 않는 용기',
    link:'느리지만 꾸준한 쪽이 결국 남는다면, 그때의 인내가 몸에 남은 것입니다.',
    job:'교육·재배·장기 운영', color:'#5A6B34' },
  { key:'herbalist', emblem:'藥', era:'조선 · 산중', role:'약초를 캐던 산의 의원', oneLine:'병보다 사람을 먼저 본 사람',
    habit:'사람의 컨디션을 먼저 살핀다', lesson:'내 몸도 환자로 대우하기',
    link:'남의 아픔을 오래 들어주다 정작 내 병을 놓친다면, 그때의 습관입니다.',
    job:'상담·돌봄·의료', color:'#3E6B4F' },
  { key:'teacher', emblem:'書', era:'조선 · 서당', role:'아이들을 가르친 훈장', oneLine:'같은 말을 다르게 반복하던 사람',
    habit:'설명이 길어진다', lesson:'듣는 사람의 속도',
    link:'설명을 잘하지만 상대가 지치는 지점을 놓친다면, 그때의 훈장이 아직 말합니다.',
    job:'강의·기획·작가', color:'#5C4A32' },
  { key:'physician', emblem:'醫', era:'조선 · 궁중', role:'궁의 의녀', oneLine:'말하지 못한 병을 읽어낸 사람',
    habit:'표정을 먼저 읽는다', lesson:'내 감정도 진찰 대상',
    link:'분위기를 지나치게 감지해 지친다면, 그때의 진맥이 아직 손목에 남아 있습니다.',
    job:'기획·상담·서비스', color:'#7A2E3A' },
  { key:'smith', emblem:'鐵', era:'철기 시대 · 대장간', role:'쇠를 다루던 장인', oneLine:'불과 망치로 형태를 만든 사람',
    habit:'도구와 장비에 집착한다', lesson:'완벽한 도구보다 지금의 손',
    link:'장비를 갖추는 데 시간을 쓰고 시작이 늦다면, 그때의 대장간이 아직 뜨겁습니다.',
    job:'제작·개발·엔지니어링', color:'#6B4A2E' },
  { key:'astronomer', emblem:'星', era:'조선 · 관상감', role:'별을 읽던 천문관', oneLine:'사람보다 하늘을 먼저 본 사람',
    habit:'밤에 생각이 많아진다', lesson:'하늘 아래의 오늘',
    link:'큰 그림은 잘 그리는데 오늘의 일이 밀린다면, 그때의 밤하늘이 남은 것입니다.',
    job:'전략·연구·데이터', color:'#243A5E' },
  { key:'clown', emblem:'笑', era:'조선 · 장터', role:'장터의 광대', oneLine:'웃음으로 진실을 말하던 사람',
    habit:'분위기가 무거우면 농담을 던진다', lesson:'슬픔도 말해도 된다',
    link:'사람을 웃기지만 정작 내 이야기는 하지 않는다면, 그때의 탈이 아직 얼굴에 있습니다.',
    job:'방송·마케팅·콘텐츠', color:'#8A5B2E' }
];

function pastlifeOf(birth, hour, gender){
  const seed = `${birth.y}-${birth.m}-${birth.d}|${hour === null ? 'x' : hour}|${gender}`;
  const rng = rngOf(seed);
  const type = PASTLIFE_TYPES[Math.floor(rng() * PASTLIFE_TYPES.length)];
  const second = PASTLIFE_TYPES[(PASTLIFE_TYPES.indexOf(type) + 1 + Math.floor(rng() * 5)) % PASTLIFE_TYPES.length];
  const pillars = sajuOf(birth, hour);
  const eraList = ['고려 중기','조선 초기','조선 후기','삼국 통일기','개항기','구한말'];
  const era = pickFrom(eraList, rngOf(seed + 'era'));
  return { type, second, pillars, era, gender, rng };
}

/* ---------- 7. 공유 카드 (canvas) ---------- */
const CARD_W = 1080, CARD_H = 1350;
function cardFont(size, weight, serif){
  return `${weight || 400} ${size}px ${serif === false ? '"Pretendard Variable",Pretendard,"Noto Sans KR","Noto Sans CJK KR",sans-serif' : '"Noto Serif KR","Noto Serif CJK KR",serif'}`;
}
function wrapText(ctx, text, maxWidth){
  const out = [];
  let line = '';
  for (const ch of String(text)){
    if (ch === '\n'){ out.push(line); line = ''; continue; }
    const t = line + ch;
    if (ctx.measureText(t).width > maxWidth && line){ out.push(line); line = ch; }
    else line = t;
  }
  if (line) out.push(line);
  return out;
}
function drawFrame(ctx, opt){
  const pad = 44;
  ctx.fillStyle = '#F6F1E8'; ctx.fillRect(0,0,CARD_W,CARD_H);
  // 상단 골드 밴드
  ctx.fillStyle = '#14110F'; ctx.fillRect(0,0,CARD_W,14);
  ctx.strokeStyle = '#14110F'; ctx.lineWidth = 2; ctx.strokeRect(pad,pad+16,CARD_W-pad*2,CARD_H-pad*2-16);
  ctx.strokeStyle = '#C9A96A'; ctx.lineWidth = 1; ctx.strokeRect(pad+7,pad+23,CARD_W-pad*2-14,CARD_H-pad*2-30);
  // 로고
  const x = pad + 40, y = pad + 62;
  ctx.fillStyle = '#14110F'; ctx.fillRect(x, y, 54, 54);
  ctx.strokeStyle = '#C9A96A'; ctx.lineWidth = 1; ctx.strokeRect(x+4, y+4, 46, 46);
  ctx.fillStyle = '#E4CF9F'; ctx.font = cardFont(22,700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('正', x+27, y+29);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#14110F'; ctx.font = cardFont(23,700); ctx.fillText('운명사주 정운타임즈', x+70, y+26);
  ctx.fillStyle = '#837A6F'; ctx.font = cardFont(11,500,false); ctx.fillText('J U N G W O O N   T I M E S', x+70, y+45);
  // 우측 이슈
  ctx.textAlign = 'right'; ctx.fillStyle = '#837A6F'; ctx.font = cardFont(11,600,false);
  ctx.fillText(opt.issue || `VOL. ${String(ISSUE_NO).padStart(2,'0')}`, CARD_W-pad-40, y+18);
  ctx.fillStyle = '#A9873F'; ctx.font = cardFont(11,600,false);
  ctx.fillText(opt.date || TODAY_KEY.replace(/-/g,'.'), CARD_W-pad-40, y+40);
  ctx.textAlign = 'left';
}
function drawShareCard(opt){
  const cv = document.createElement('canvas');
  cv.width = CARD_W; cv.height = CARD_H;
  const ctx = cv.getContext('2d');
  drawFrame(ctx, opt);
  const pad = 84, maxW = CARD_W - pad*2;
  let y = 196;

  // 키커
  ctx.fillStyle = '#7B1E2B'; ctx.font = cardFont(12,700,false);
  ctx.fillText((opt.kicker || '운명사주 정운타임즈').toUpperCase(), pad, y);
  ctx.fillRect(pad, y+12, 34, 1.5);
  y += 52;

  // 제목
  ctx.fillStyle = '#14110F'; ctx.font = cardFont(opt.titleSize || 52, 900);
  const titleLines = wrapText(ctx, opt.title, maxW).slice(0, 4);
  titleLines.forEach(l => { ctx.fillText(l, pad, y); y += (opt.titleSize || 52) * 1.28; });
  y += 8;

  // 골드 룰
  ctx.fillStyle = '#C9A96A'; ctx.fillRect(pad, y, 66, 3); y += 40;

  // 본문 인용
  if (opt.quote){
    ctx.fillStyle = '#3A342E'; ctx.font = cardFont(26, 400);
    const qLines = wrapText(ctx, opt.quote, maxW).slice(0, 5);
    qLines.forEach(l => { ctx.fillText(l, pad, y); y += 42; });
    y += 22;
  }

  // 키-값 (2열)
  if (opt.kv && opt.kv.length){
    const colW = maxW / 2;
    opt.kv.forEach((row, i) => {
      const cx = pad + (i % 2) * colW;
      const cy = y + Math.floor(i/2) * 78;
      ctx.fillStyle = '#837A6F'; ctx.font = cardFont(12, 600, false);
      ctx.fillText(row[0], cx, cy);
      ctx.fillStyle = '#14110F'; ctx.font = cardFont(24, 700);
      ctx.fillText(String(row[1]), cx, cy + 32);
    });
    y += Math.ceil(opt.kv.length/2) * 78 + 10;
  }

  // 오행/색 swatch
  if (opt.swatch){
    ctx.fillStyle = opt.swatch.hex; ctx.beginPath(); ctx.arc(pad+12, y-6, 12, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = 'rgba(20,17,15,.2)'; ctx.lineWidth = 1; ctx.stroke();
    y += 40;
  }

  // 행운 번호
  if (opt.nums && opt.nums.length){
    ctx.fillStyle = '#837A6F'; ctx.font = cardFont(12, 600, false);
    ctx.fillText(opt.numsLabel || '행운 번호', pad, y);
    y += 22;
    opt.nums.forEach((n, i) => {
      const cx = pad + 26 + i*66;
      ctx.beginPath(); ctx.arc(cx, y+24, 26, 0, Math.PI*2);
      ctx.fillStyle = i % 2 ? '#EFE7D9' : '#14110F'; ctx.fill();
      ctx.fillStyle = i % 2 ? '#14110F' : '#E4CF9F';
      ctx.font = cardFont(20, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(n), cx, y+25);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    });
    y += 70;
  }

  // 남는 공간 — 큰 상징 한 글자
  const footerY = CARD_H - 104;
  const space = footerY - y - 60;
  if (space > 170){
    const cx = pad + maxW/2;
    const cy = y + Math.min(space * 0.62, 320);
    const glyph = opt.glyph || '正運';
    const size = glyph.length > 1 ? 72 : 104;
    // 기둥을 잇는 실
    ctx.strokeStyle = 'rgba(169,135,63,.32)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, y + 26); ctx.lineTo(cx, cy - size * 0.98); ctx.stroke();
    ctx.fillStyle = 'rgba(169,135,63,.75)';
    ctx.save(); ctx.translate(cx, y + 26); ctx.rotate(Math.PI/4); ctx.fillRect(-3.5,-3.5,7,7); ctx.restore();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.beginPath(); ctx.arc(cx, cy, size * 0.92, 0, Math.PI*2);
    ctx.strokeStyle = '#DCD1BE'; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, size * 0.84, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(169,135,63,.4)'; ctx.stroke();
    ctx.fillStyle = '#14110F'; ctx.font = cardFont(size, 700);
    ctx.fillText(glyph, cx, cy - size * 0.1);
    ctx.fillStyle = '#A9873F'; ctx.font = cardFont(11, 600, false);
    ctx.fillText((opt.glyphLabel || '운명사주 정운타임즈').toUpperCase(), cx, cy + size * 0.62);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  // 하단
  const by = footerY;
  ctx.strokeStyle = '#DCD1BE'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad, by-34); ctx.lineTo(CARD_W-pad, by-34); ctx.stroke();
  ctx.fillStyle = '#7B1E2B'; ctx.font = cardFont(19, 700);
  ctx.fillText(opt.footer || '운명사주, 정운이 풀다', pad, by);
  ctx.fillStyle = '#837A6F'; ctx.font = cardFont(13, 500, false);
  ctx.fillText('news.22jutimes.com', pad, by+26);
  ctx.textAlign = 'right'; ctx.fillStyle = '#A9873F'; ctx.font = cardFont(11, 600, false);
  ctx.fillText('참고용 콘텐츠', CARD_W-pad, by+26);
  ctx.textAlign = 'left';

  return cv;
}

/* ---------- 8. 오행 아이템 매칭 ---------- */
function lackingElementOf(birth, hour){
  const p = sajuOf(birth, hour);
  return { oh:p.lack, counts:p.counts, pillars:p };
}
