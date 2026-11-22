/* ============================================================================
   정운타임즈 · app.js — 라우터 · 지면 렌더 · 오늘의 운세 · 4P 뷰어 · PWA
   ========================================================================== */
'use strict';

const ARTICLES = [].concat(
  (typeof ARTICLES_DAILY !== 'undefined' ? ARTICLES_DAILY : []),
  ARTICLES_1, ARTICLES_2, ARTICLES_3
);

/* 심층 보강 블록 병합 — 원문 마지막 문단 앞에 삽입 (중복 문단은 제거) */
if (typeof ARTICLES_EXTRA !== 'undefined'){
  ARTICLES.forEach(a=>{
    const ex = ARTICLES_EXTRA[a.id];
    if (!ex || !ex.length) return;
    const b = a.body, last = b[b.length-1];
    if (ex[ex.length-1].x === last.x) a.body = b.slice(0,-1).concat(ex);
    else a.body = b.slice(0,-1).concat(ex, [last]);
  });
}
const BY_ID = ARTICLES.reduce((m,a)=>{ m[a.id]=a; return m; },{});
const IMG = (name)=>`assets/img/${name}.webp`;

/* ---------- 유틸 ---------- */
const $  = (s,r)=> (r||document).querySelector(s);
const $$ = (s,r)=> Array.from((r||document).querySelectorAll(s));
const esc = (s)=> String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const num = (n)=> Number(String(n).replace(/[^0-9]/g,'')).toLocaleString('ko-KR');
const pad2 = (n)=> String(n).padStart(2,'0');
const catOf = (id)=> CATS.find(c=>c.id===id) || CATS[0];
const inCat = (id)=> ARTICLES.filter(a=>a.cat===id);
const byCat = (id)=> inCat(id).slice().sort((a,b)=> dayKey(b).localeCompare(dayKey(a)) || (b.top?1:0)-(a.top?1:0) || num(b.views)-num(a.views));
const dateStr = (a)=>{ const d=(a.date||'2026-11-22').split('-'); return `${d[0]}.${d[1]}.${d[2]}. ${a.time||'06:00'}`; };
/* 매일 갱신 기사(ARTICLES_DAILY)가 있으면 그 지면의 최신 호를, 없으면 기본 기사를 쓴다 */
const dayKey = (a)=> String(a.date||'');
const SITE_BUILD_DATE = '2026-11-22';
const daysAgo = (a)=>{
  const d = a.date || SITE_BUILD_DATE;   /* 날짜 없는 기본 기사는 사이트 제작일 기준 */
  const t = new Date(d + 'T00:00:00+09:00').getTime();
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
};
function newestOf(cat){
  const list = inCat(cat).slice().sort((a,b)=> dayKey(b).localeCompare(dayKey(a))
    || (Number(String(b.views||'').replace(/[^0-9]/g,''))||0) - (Number(String(a.views||'').replace(/[^0-9]/g,''))||0));
  return list[0] || null;
}
function todayLead(){ return newestOf('today') || BY_ID['today-1122'] || ARTICLES[0]; }
const DAILY = () => (typeof ARTICLES_DAILY !== 'undefined' ? ARTICLES_DAILY : []);

/* ---------- 상단 ---------- */
function renderTicker(){
  const track = $('#tickerTrack'); if (!track) return;
  const dayName = (typeof TODAY_DAY !== 'undefined') ? TODAY_DAY.hanja : '庚子';
  const one = TICKER.map(t=>`<span class="ticker__item"><b>${esc(t.cat)}</b>${esc(String(t.text).replace('{day}', dayName))}</span>`).join('');
  track.innerHTML = one + one;
}
function renderTabs(active){
  const nav = $('#tabsIn'); if (!nav) return;
  nav.innerHTML = CATS.map(c=>{
    const on = (c.id===active) ? ' is-active' : '';
    const hot = (c.id==='mbti'||c.id==='today'||c.id==='program') ? '<span class="hot">NEW</span>' : '';
    return `<a class="tab${on}${c.point?' tab--point':''}" href="${c.route}">${c.ko}${hot}</a>`;
  }).join('');
  /* 모바일에서 활성 지면 탭이 가려져 있으면 보이게 옆으로 밀어 준다 */
  const act = nav.querySelector('.tab.is-active');
  if (act && nav.scrollWidth > nav.clientWidth + 4){
    nav.scrollLeft = Math.max(0, act.offsetLeft - 18);
  }
}
function renderMastDate(){
  const t = (typeof TODAY_LABEL!=='undefined') ? TODAY_LABEL : '2026년 11월 22일 일요일';
  const g = (typeof TODAY_YEAR!=='undefined')
    ? `${TODAY_YEAR.hanja}年 · ${TODAY_MONTH.hanja}月 · ${TODAY_DAY.hanja}日`
    : '丙午年 · 己亥月 · 庚子日';
  const d = $('#mastDate'); if (d) d.innerHTML = `<b>${t}</b><span>${g}</span>`;
  const b = $('#barTime'); if (b) b.textContent = `${g}`;
}

/* ---------- 카드 ---------- */
function thumbCard(a, kicker){
  return `<a class="thumb" href="#/article/${a.id}">
    <img class="thumb__img" src="${IMG(a.img)}" alt="${esc(a.title)}" loading="lazy">
    <span class="thumb__cat">${esc(kicker||catOf(a.cat).ko)}</span>
    <span class="thumb__ttl">${esc(a.title)}</span>
    <span class="thumb__meta">${dateStr(a)}</span>
  </a>`;
}
function listItem(a){
  return `<a class="item" href="#/article/${a.id}">
    <img class="item__img" src="${IMG(a.img)}" alt="${esc(a.title)}" loading="lazy">
    <span>
      <span class="item__cat">${esc(catOf(a.cat).ko)}</span>
      <span class="item__ttl">${esc(a.title)}</span>
      <span class="item__time">${dateStr(a)}</span>
    </span>
  </a>`;
}
function secRow(a){
  return `<li><a href="#/article/${a.id}">
    <img src="${IMG(a.img)}" alt="${esc(a.title)}" loading="lazy">
    <span>
      <span class="s-ttl">${esc(a.title)}</span>
      <span class="s-meta">${dateStr(a)} · ${esc(catOf(a.cat).ko)}</span>
    </span>
  </a></li>`;
}

/* ---------- 오늘의 운세 위젯 ---------- */
function zodiacOptions(){
  const names = ['쥐','소','호랑이','토끼','용','뱀','말','양','원숭이','닭','개','돼지'];
  return names.map((n,i)=>`<option value="${i}">${n}띠</option>`).join('');
}
function widgetMarkup(idPrefix){
  return `<div class="widget__head">
      <div>
        <div class="widget__ttl">오늘의 운세 <em>무료</em></div>
        <div class="widget__ganji">${(typeof TODAY_YEAR!=='undefined')?`${TODAY_YEAR.hanja}年 ${TODAY_MONTH.hanja}月 ${TODAY_DAY.hanja}日`:'丙午年 己亥月 庚子日'}</div>
      </div>
      <span class="kicker kicker--gold">1분</span>
    </div>
    <p class="widget__lead">생년월일만 넣으면 오늘의 기운·행운의 색·숫자·한 줄 조언이 바로 나옵니다.</p>
    <form class="wform" data-wform="${idPrefix}">
      <div class="wform__full">
        <label for="${idPrefix}Birth">생년월일 (양력)</label>
        <input type="date" id="${idPrefix}Birth" min="1930-01-01" max="2025-12-31">
      </div>
      <div class="wform__full">
        <label for="${idPrefix}Zodiac">생일을 모르면 띠로 보기</label>
        <select id="${idPrefix}Zodiac"><option value="">— 띠 선택 —</option>${zodiacOptions()}</select>
      </div>
      <button class="btn btn--ink wform__full" type="submit">무료로 오늘 보기 →</button>
    </form>
    <div class="wresult" data-wresult="${idPrefix}"></div>
    <div class="widget__foot">
      <a class="btn btn--gold" href="#/4p">990원 4P 맛보기</a>
      <a class="btn btn--ghost" href="#/fourp_talk">정밀분석 안내</a>
    </div>`;
}
function bindWidget(root){
  $$('[data-wform]', root).forEach(form=>{
    form.addEventListener('submit', (e)=>{
      e.preventDefault();
      const key = form.getAttribute('data-wform');
      const birthEl = $(`#${key}Birth`), zodEl = $(`#${key}Zodiac`);
      const box = $(`[data-wresult="${key}"]`);
      let birth = null, zod = null;
      if (birthEl && birthEl.value){
        const [y,m,d] = birthEl.value.split('-').map(Number);
        birth = { y, m, d };
      } else if (zodEl && zodEl.value !== ''){
        zod = Number(zodEl.value);
      } else {
        box.classList.add('is-on');
        box.innerHTML = `<p class="wresult__note">생년월일을 넣거나 띠를 골라 주세요. 둘 다 비어 있으면 오늘의 기운을 맞출 수 없습니다.</p>`;
        return;
      }
      const r = buildToday(birth, zod);
      const colorHex = (r.luckColor && r.luckColor.hex) || '#b8913f';
      box.classList.add('is-on');
      box.innerHTML = `
        <div class="wresult__top">
          <div class="ring" style="--p:${r.score}"><b>${r.score}</b></div>
          <div>
            <div class="wresult__head">${esc(r.headline)}</div>
            <div class="wresult__deck">${esc(r.deck)}</div>
          </div>
        </div>
        <div class="wgrid">
          <div><span>행운의 색</span><b><i class="swatch" style="background:${colorHex}"></i>${esc(r.luckColor.name)}</b></div>
          <div><span>행운의 숫자</span><b>${r.nums.join(' · ')}</b></div>
          <div><span>좋은 시간</span><b>${esc(r.timeBest)}</b></div>
        </div>
        <div class="wresult__advice">${esc(r.advice)}</div>
        <p class="wresult__note">${esc(r.caution)}</p>
        <p class="wresult__note">${esc(r.oneLine)} · ${esc(r.todayHanja)}</p>`;
      box.scrollIntoView({behavior:'smooth', block:'nearest'});
    });
  });
}

/* ---------- 1면 · TOP 7 ---------- */
function top7Pick(n){
  /* 인기뉴스 = 조회수 + 최신 가중 (오늘 발행한 호가 1면에서 밀리지 않도록) */
  const v = (a)=> Number(String(a.views||'').replace(/[^0-9]/g,'')) || 0;
  const w = (a)=>{ const d = daysAgo(a); return d <= 0 ? 2.6 : d <= 1 ? 1.8 : d <= 3 ? 1.3 : d <= 10 ? 1.05 : 1; };
  return ARTICLES.slice().sort((a,b)=> v(b)*w(b) - v(a)*w(a)).slice(0, n||7);
}
function rankBlock(){
  const list = top7Pick(7);
  const hero = list[0], rest = list.slice(1);
  return `<section class="rank" aria-labelledby="rankTitle">
    <div class="rank__head">
      <span class="rank__badge">TOP 7</span>
      <h2 id="rankTitle">인기뉴스</h2>
      <span class="rank__en">MOST READ</span>
      <span class="rank__note">지금 가장 많이 읽히는 기사 · 조회순(최신 가중)</span>
    </div>
    <div class="rank__grid">
      <a class="rank__hero" href="#/article/${hero.id}">
        <span class="rank__shot">
          <img src="${IMG(hero.img)}" alt="${esc(hero.title)}">
          <b class="rank__heroNo">1</b>
        </span>
        <span class="rank__cat">${esc(catOf(hero.cat).ko)}</span>
        <h3 class="rank__heroTtl">${esc(hero.title)}</h3>
        <span class="rank__meta">조회 ${num(hero.views)} · ${dateStr(hero)}</span>
      </a>
      <ol class="rank__list">
        ${rest.map((a,i)=>`<li><a href="#/article/${a.id}">
          <span class="rank__no">${i+2}</span>
          <img class="rank__thumb" src="${IMG(a.img)}" alt="${esc(a.title)}" loading="lazy">
          <span class="rank__txt">
            <span class="rank__cat">${esc(catOf(a.cat).ko)}</span>
            <span class="rank__ttl">${esc(a.title)}</span>
            <span class="rank__meta">조회 ${num(a.views)}</span>
          </span>
        </a></li>`).join('')}
      </ol>
    </div>
  </section>`;
}

/* ---------- 1면 · 오늘의 무료운세 + 설치 ---------- */
function fortuneBlock(){
  return `<section class="fortune" id="fortune" aria-labelledby="fortuneTitle">
    <div class="fortune__in">
      <div class="fortune__copy">
        <span class="kicker">TODAY'S FREE FORTUNE · 無料</span>
        <h2 id="fortuneTitle">오늘, 내 기운은<br><em>어디로 흐르는가</em></h2>
        <p class="fortune__lead">생년월일만 넣으면 오늘의 기운 지수, 행운의 색과 숫자, 좋은 시간, 한 줄 조언이 <b>바로</b> 나옵니다. 회원가입도 결제도 없습니다.</p>
        <ul class="fortune__pts">
          <li><span class="fortune__ptno">1</span><span><b>1분이면 끝</b>생년월일 또는 띠 하나만 고르면 됩니다.</span></li>
          <li><span class="fortune__ptno">2</span><span><b>실제 만세력</b>오늘의 간지(${(typeof TODAY_DAY!=='undefined')?TODAY_DAY.hanja:'庚子'}日)로 기운을 계산합니다.</span></li>
          <li><span class="fortune__ptno">3</span><span><b>무료</b>결과는 화면에서 바로, 저장 없이 확인합니다.</span></li>
        </ul>
        <p class="fortune__sub">더 깊이 보려면 <a href="#/4p">990원 4P 맛보기</a> → <a href="${AURA}" target="_blank" rel="noopener">30P·60P·100P 정밀분석</a></p>
      </div>
      <div class="fortune__card">
        <div class="widget widget--big">${widgetMarkup('hero')}</div>
      </div>
    </div>
    <div class="fortune__install">
      <span class="fortune__instico" aria-hidden="true">📲</span>
      <div class="fortune__insttxt">
        <b>이 사이트, 바탕화면에 바로 설치하세요</b>
        <span>주소창 없이 앱처럼 열립니다 · 안드로이드는 ‘앱 설치’, 아이폰은 ‘홈 화면에 추가’</span>
      </div>
      <button class="btn btn--ink fortune__instbtn" type="button" data-install>바탕화면에 설치하기</button>
    </div>
  </section>`;
}

/* ---------- 1면 · 사주프로그램 배너 ---------- */
function programBanner(){
  return `<a class="progbanner" href="#/program">
    <span class="progbanner__tag">NEW · 1년 이용권</span>
    <span class="progbanner__mid">
      <b>💻 정운 사주분석 웹 프로그램</b>
      <span>만세력 · 자미두수 12궁 · 30~100P 정밀 분석 — 내 사주를 직접 돌려보는 프로그램</span>
    </span>
    <span class="progbanner__go">미리보기 &amp; 다운로드 →</span>
  </a>`;
}

/* ---------- 1면 · MBTI 궁합 특집 ---------- */
function mbtiSpecial(){
  const lead = BY_ID['mbti-main'];
  const minis = ['mbti-infp-enfj','mbti-tf'].map(id=>BY_ID[id]).filter(Boolean);
  return `<section class="special" aria-labelledby="specialTitle">
    <div class="special__head">
      <span class="special__kicker">SPECIAL · 커버스토리</span>
      <h2 id="specialTitle">MBTI 궁합 특집</h2>
      <p>네 글자로 읽는 인연 — 잘 맞는 조합보다, 번역이 되는 조합</p>
    </div>
    <div class="special__grid">
      <a class="special__lead" href="#/article/${lead.id}">
        <img src="${IMG(lead.img)}" alt="${esc(lead.title)}">
        <span class="special__cat">${esc(catOf(lead.cat).ko)}</span>
        <h3>${esc(lead.title)}</h3>
        <p>${esc(lead.dek)}</p>
      </a>
      <div class="special__side">
        ${minis.map(a=>`<a class="special__mini" href="#/article/${a.id}">
          <img src="${IMG(a.img)}" alt="${esc(a.title)}" loading="lazy">
          <span>
            <span class="special__cat">${esc(catOf(a.cat).ko)}</span>
            <span class="special__ttl">${esc(a.title)}</span>
          </span>
        </a>`).join('')}
        <a class="special__quiz" href="#/free">
          <b>내 궁합 점수, 1분 무료로 보기</b>
          <span>두 사람의 MBTI만 고르면 점수와 어긋나는 축을 알려드립니다 →</span>
        </a>
      </div>
    </div>
  </section>`;
}

/* ---------- 메인 ---------- */
function viewHome(){
  const mid = [todayLead(), BY_ID['money-timing'], BY_ID['dream-moon'], BY_ID['past-musician'],
               newestOf('people') || BY_ID['people-stage'], BY_ID['shop-turtle'], BY_ID['lab-49'], BY_ID['money-people']].filter(Boolean);

  const sections = ['money','today','dream','past','people','shop','lab'].map(cid=>{
    const list = byCat(cid); const first = list[0]; const rest = list.slice(1,5);
    return `<section class="section">
      <div class="section__rule">
        <h2>${esc(catOf(cid).ko)}</h2>
        <span class="en" style="font-size:10.5px;letter-spacing:.18em;color:var(--gold);font-weight:700">${esc(catOf(cid).en)}</span>
        <span class="line"></span>
        <a class="more" href="#/${cid}">더 보기 →</a>
      </div>
      <div class="sec-grid">
        <a class="sec-lead" href="#/article/${first.id}">
          <img class="sec-lead__img" src="${IMG(first.img)}" alt="${esc(first.title)}" loading="lazy">
          <h3>${esc(first.title)}</h3>
          <p>${esc(first.dek)}</p>
        </a>
        <ul class="sec-list">${rest.map(secRow).join('')}</ul>
      </div>
    </section>`;
  }).join('');

  return `
  ${rankBlock()}
  ${fortuneBlock()}
  ${programBanner()}
  ${mbtiSpecial()}

  <div class="home-mid">
    <div>
      <div class="sec-head">
        <div class="sec-head__l"><h2>주요 뉴스</h2><span class="en">LATEST</span></div>
        <a class="sec-head__more" href="#/archive">지난 기사 →</a>
      </div>
      <div class="newslist">${mid.map(listItem).join('')}</div>
    </div>
    <aside class="rail">
      <div class="promo">
        <span class="promo__tag">990원 SPECIAL</span>
        <h4>4페이지로 먼저 확인하는<br>내 운명의 맛보기</h4>
        <p>5장 정밀판·3장 요약판까지 4가지 버전. 지금 지면에서 바로 넘겨 보세요.</p>
        <div class="promo__price"><b>990</b><span>원 · 4P 분석지</span></div>
        <a class="btn btn--gold btn--block" href="#/4p">4P 바로 보기 →</a>
      </div>
      <a class="promo promo--prog" href="#/program">
        <span class="promo__tag">PROGRAM · 1년 이용권</span>
        <h4>내 사주를 직접 돌려보는<br>사주분석 웹 프로그램</h4>
        <p>만세력·자미두수 12궁·교차 결론. 체험해 보고 1년 이용권으로 받으세요.</p>
        <div class="promo__price"><b>체험</b><span>무료 · 다운로드 안내</span></div>
        <span class="btn btn--gold btn--block">프로그램 보러 가기 →</span>
      </a>
      <a class="talk" href="${AURA}" target="_blank" rel="noopener">
        <span class="talk__ico" style="background:#171513"><span style="font-family:var(--serif);color:#c9a86a;font-size:13px">正</span></span>
        <span><b>30P · 60P · 100P 정밀분석</b><span>19,900원부터 · 만족도 최상위</span></span>
      </a>
      <a class="talk" href="${KAKAO}" target="_blank" rel="noopener">
        <span class="talk__ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 3C6.5 3 2 6.5 2 10.8c0 2.9 1.9 5.4 4.6 6.8-.4.8-1 2.8-1.6 3.9-.4.7.1 1 .8.7 2-.8 4.2-2 5.5-2.8.5.1 1 .1 1.6.1 5.5 0 10-3.5 10-7.8C22 6.5 17.5 3 12 3Z" fill="#231f20"/></svg></span>
        <span><b>카톡 1:1 상담</b><span>정운이 직접 답합니다 · 평일 10~19시</span></span>
      </a>
    </aside>
  </div>

  ${sections}

  <div class="strip4p">
    <div class="strip4p__in">
      <div>
        <h3>딱 4페이지로 보는<br><em>내 사주의 첫 장</em></h3>
        <p>생년월일을 넣고 4페이지를 넘기면, 재물·애정·커리어의 첫 문장이 열립니다. 990원 특별분석 이벤트 — 4가지 버전 수록.</p>
        <div class="strip4p__btns">
          <a class="btn btn--red" href="#/4p">🔥 990원 4P 바로 보기</a>
          <a class="btn btn--ghost" href="#/free">무료 1분 분석</a>
          <a class="btn btn--ghost" href="#/program">사주프로그램 1년 이용권</a>
        </div>
      </div>
      <div class="strip4p__pages" aria-hidden="true">
        <div class="pagecard"><b>P.01</b><i></i><i></i><i></i><i></i><span>본질</span></div>
        <div class="pagecard"><b>P.02</b><i></i><i></i><i></i><i></i><span>재물</span></div>
        <div class="pagecard"><b>P.03</b><i></i><i></i><i></i><i></i><span>인연</span></div>
      </div>
    </div>
  </div>`;
}

/* ---------- 사주프로그램 지면 ---------- */
const PROG_FEATS = [
  { no:'01', t:'진짜 만세력 계산', d:'KASI 절기와 진태양시 보정까지 적용했습니다. 파이썬 만세력 엔진(korean-saju 0.3.0)과 15개 케이스 전 항목이 일치합니다.' },
  { no:'02', t:'자미두수 12궁', d:'명궁·재백궁·관록궁 등 12궁과 14주성, 사화(四化)를 전통 안성법으로 배치합니다. 독립 엔진과 103개 케이스 교차검증에서 불일치 0건.' },
  { no:'03', t:'사주 × 자미두수 교차 결론', d:'두 체계가 같은 지점을 가리키는 곳만 추려 핵심 결론 카드로 보여 줍니다. 해석이 겹칠수록 결론은 선명해집니다.' },
  { no:'04', t:'명식 5인 저장', d:'내 명식은 물론 가족·연인·단골 손님의 명식을 최대 5개까지 저장하고 이름으로 다시 불러옵니다.' },
  { no:'05', t:'30·60·100P 리포트 연결', d:'프로그램에서 확인한 명식을 그대로 가지고 정밀 분석지(30P·60P·100P)로 이어집니다.' },
  { no:'06', t:'이용권(라이선스) 잠금', d:'판매용 프로그램은 이용권 코드로 열립니다. 코드 하나로 1년간 사용하고, 파일은 설치 없이 실행됩니다.' }
];
function viewProgram(){
  return `
  <div class="prog">
    <div class="prog-hero">
      <div class="prog-hero__copy">
        <span class="kicker">PROGRAM · 만세력 · 자미두수</span>
        <h1 class="prog-hero__ttl">내 사주를<br><em>내 손으로 돌려보는</em><br>정운 사주분석 프로그램</h1>
        <p class="prog-hero__lead">생년월일 하나를 넣으면 실제 만세력으로 사주팔자와 자미두수 12궁을 계산해 한 화면에 펼칩니다. 오행·십성·대운·세운, 그리고 사주와 자미두수를 겹친 교차 결론까지 — 상담 전에 내 명식을 직접 확인하고 싶은 분을 위한 프로그램입니다.</p>
        <div class="prog-hero__btns">
          <button class="btn btn--ink" type="button" data-program-preview>프로그램 화면 미리보기 →</button>
          <button class="btn btn--gold" type="button" data-program-buy="year">다운로드 &amp; 1년 이용권</button>
        </div>
        <p class="prog-hero__note">프로그램 파일 1개로 실행 · 설치 없음 · 인터넷 없이 계산</p>
      </div>
      <figure class="prog-hero__shot">
        <img src="assets/img/program-shot.webp" alt="정운 사주분석 프로그램 — 사주 명식과 오행·십성·대운 화면">
        <figcaption>실제 화면 — 사주 명식 · 오행·십성 차트 · 10년 대운</figcaption>
      </figure>
    </div>

    <section class="prog-block">
      <div class="sec-head"><div class="sec-head__l"><h2>이런 프로그램입니다</h2><span class="en">FEATURES</span></div></div>
      <div class="prog-feats">
        ${PROG_FEATS.map(f=>`<div class="prog-feat">
          <span class="prog-feat__no">${f.no}</span>
          <b>${esc(f.t)}</b>
          <p>${esc(f.d)}</p>
        </div>`).join('')}
      </div>
    </section>

    <section class="prog-block">
      <div class="sec-head"><div class="sec-head__l"><h2>어디서부터 볼까요</h2><span class="en">PRICE</span></div><span class="prog-hint">맛보기 → 정밀분석 → 프로그램 순서로 이어집니다</span></div>
      <div class="prog-plans">
        <div class="plan">
          <span class="plan__tag">미리보기</span>
          <b class="plan__name">프로그램 화면 보기</b>
          <div class="plan__price"><b>무료</b><span>미리보기</span></div>
          <p>명식 · 자미두수 12궁 · 교차 결론 화면을 먼저 봅니다.</p>
          <button class="btn btn--ghost btn--block" type="button" data-program-preview>화면 미리보기</button>
        </div>
        <div class="plan">
          <span class="plan__tag">맛보기</span>
          <b class="plan__name">990원 4P 분석지</b>
          <div class="plan__price"><b>990</b><span>원</span></div>
          <p>재물·애정·커리어의 첫 문장. 4가지 버전 수록.</p>
          <a class="btn btn--ghost btn--block" href="#/4p">4P 바로 보기</a>
        </div>
        <div class="plan">
          <span class="plan__tag">정밀 분석지</span>
          <b class="plan__name">30P · 60P · 100P</b>
          <div class="plan__price"><b>19,900</b><span>원부터</span></div>
          <p>운명의 나침반 30P · 지도 60P · 마스터 플랜 100P.</p>
          <a class="btn btn--ghost btn--block" href="${AURA}" target="_blank" rel="noopener">정밀분석 보기</a>
        </div>
        <div class="plan plan--year">
          <span class="plan__tag">PROGRAM</span>
          <b class="plan__name">사주프로그램 1년 이용권</b>
          <div class="plan__price"><b>상담</b><span>안내 · 카톡 신청</span></div>
          <p>프로그램 + 이용권 코드 + 63p 해설 전자책.</p>
          <button class="btn btn--gold btn--block" type="button" data-program-buy="year">다운로드 &amp; 신청하기</button>
        </div>
      </div>
    </section>

    <section class="prog-block prog-flow">
      <h2>1년 이용권, 이렇게 받습니다</h2>
      <ol class="prog-flow__steps">
        <li><span>1</span><b>카톡 1:1 상담</b><i>이용 기간과 결제 방법을 안내받고 신청합니다.</i></li>
        <li><span>2</span><b>결제 확인</b><i>입금이 확인되면 이용권 코드를 발급합니다.</i></li>
        <li><span>3</span><b>파일 · 코드 수령</b><i>프로그램 파일과 코드를 카톡·메일로 보내드립니다.</i></li>
        <li><span>4</span><b>코드 입력 후 사용</b><i>프로그램 첫 화면에 코드를 넣으면 1년간 열립니다.</i></li>
      </ol>
      <p class="prog-flow__note"><b>결제 안내</b> — 현재 카드결제(PG) 연동 전입니다. 그래서 1년 이용권 신청과 결제는 카카오채널 1:1 상담으로 안내드리고, 결제 확인 후 프로그램 파일과 이용권 코드를 보내드립니다. 990원 4P는 이 사이트에서 바로 넘겨 볼 수 있고, 30P·60P·100P 정밀분석지는 정밀분석 페이지에서 진행됩니다. 환불·이용 조건은 결제 전 상담에서 안내드립니다.</p>
      <div class="prog-flow__btns">
        <a class="btn btn--gold" href="${KAKAO}" target="_blank" rel="noopener">카톡으로 1년 이용권 상담 →</a>
        <button class="btn btn--ghost" type="button" data-program-preview>프로그램 화면 먼저 보기</button>
      </div>
    </section>

    <section class="prog-block">
      <div class="sec-head"><div class="sec-head__l"><h2>자주 묻는 질문</h2><span class="en">FAQ</span></div></div>
      <div class="prog-faq">
        <details><summary>프로그램을 따로 설치해야 하나요?</summary><p>아니요. 파일 하나(HTML)로 실행됩니다. PC나 휴대폰 브라우저에서 파일을 열면 되고, 계산은 인터넷 없이도 됩니다.</p></details>
        <details><summary>1년 이용권은 어떻게 쓰나요?</summary><p>결제 후 받은 이용권 코드를 프로그램 첫 화면에 넣으면 1년간 열립니다. 코드 하나로 한 대의 기기에서 사용하는 것을 기준으로 안내드립니다.</p></details>
        <details><summary>아이폰에서도 되나요?</summary><p>네. 사파리나 파일 앱에서 받은 파일을 열면 됩니다. 화면이 좁으면 가로로 돌려 보세요.</p></details>
        <details><summary>미리보기에서 직접 입력해 볼 수는 없나요?</summary><p>미리보기는 실제 화면 3장만 보여 드립니다. 명식을 직접 입력해 보는 것은 1년 이용권을 받은 뒤 가능합니다. 내 사주를 글로 먼저 읽고 싶다면 990원 4P부터 보세요.</p></details>
        <details><summary>결제는 어떻게 하나요?</summary><p>지금은 카드결제 연동 전이라 카톡 1:1 상담으로 신청과 결제를 안내합니다. 990원 4P는 사이트에서 바로, 정밀분석지는 정밀분석 페이지에서 진행됩니다.</p></details>
        <details><summary>분석 결과를 믿어도 되나요?</summary><p>모든 결과는 전통 명리학의 계산 규칙과 상징 해석을 바탕으로 한 참고·오락 정보입니다. 미래를 보장하지 않으며, 의료·투자·법률 같은 중요한 결정의 근거로 삼을 수 없습니다.</p></details>
      </div>
    </section>
  </div>`;
}

/* ---------- 섹션 목록 ---------- */
function viewSection(cid){
  const cat = catOf(cid); const list = byCat(cid);
  const main = list[0]; const rest = list.slice(1);
  const otherCats = CATS.filter(c=>c.id!=='main'&&c.id!=='fourp'&&c.id!==cid).slice(0,4);
  return `
  <div class="listhead">
    <div>
      <div class="kicker">${esc(cat.en)}</div>
      <h1>${esc(cat.ko)}</h1>
      <p>${esc(cat.desc)} · 기사 ${list.length}건</p>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${cid==='people' ? '<a class="btn btn--ghost" href="#/archive">지난 기사 모아보기</a>' : ''}
      <a class="btn btn--ink" href="#/free">무료로 내 운세 보기</a>
    </div>
  </div>
  <div class="listgrid">
    <div>
      <article>
        <a href="#/article/${main.id}">
          <img src="${IMG(main.img)}" alt="${esc(main.title)}" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:3px">
        </a>
        <h2 style="font-family:var(--serif);font-size:26px;line-height:1.38;letter-spacing:-.045em;margin:12px 0 8px"><a href="#/article/${main.id}">${esc(main.title)}</a></h2>
        <p style="font-size:14px;color:#555;line-height:1.7">${esc(main.dek)}</p>
        <div class="meta" style="margin-top:8px"><b>${esc(main.writer)}</b><span class="dot"></span><span>${dateStr(main)}</span></div>
      </article>
      <ul class="artlist" style="margin-top:18px">
        ${rest.map(a=>`<li><a href="#/article/${a.id}">
          <img src="${IMG(a.img)}" alt="${esc(a.title)}" loading="lazy">
          <span>
            <span class="l-cat">${esc(catOf(a.cat).ko)}</span>
            <span class="l-ttl">${esc(a.title)}</span>
            <span class="l-dek">${esc(a.dek)}</span>
            <span class="l-meta">${esc(a.writer)} · ${dateStr(a)}</span>
          </span>
        </a></li>`).join('')}
      </ul>
    </div>
    <aside>
      <div class="widget">${widgetMarkup('sec')}</div>
      <div class="panel">
        <div class="panel__head"><h3>다른 지면</h3><span>SECTIONS</span></div>
        <ul class="top7">
          ${otherCats.map((c,i)=>{
            const a = byCat(c.id)[0];
            return `<li><a href="#/${c.id}"><span class="num">${pad2(i+1)}</span><span><span class="cat">${esc(c.ko)}</span><span class="tt">${esc(a.title)}</span></span></a></li>`;
          }).join('')}
        </ul>
      </div>
      <div class="promo">
        <span class="promo__tag">PRECISION REPORT</span>
        <h4>4페이지로 부족했다면<br>30P · 60P · 100P</h4>
        <p>재물·애정·커리어·월별 길흉·귀인까지. 정운이 직접 쓰는 정밀 분석지.</p>
        <div class="promo__price"><b>19,900</b><span>원부터</span></div>
        <a class="btn btn--gold btn--block" href="${AURA}" target="_blank" rel="noopener">정밀분석 보러가기 →</a>
      </div>
    </aside>
  </div>`;
}

/* ---------- 기사 상세 ---------- */
function bodyHTML(blocks){
  return blocks.map(b=>{
    if (b.t==='h') return `<h3>${b.x}</h3>`;
    if (b.t==='q') return `<div class="quote">${b.x}</div>`;
    if (b.t==='ul') return `<ul>${b.x.map(x=>`<li>${x}</li>`).join('')}</ul>`;
    return `<p>${b.x}</p>`;
  }).join('');
}
function viewArticle(id){
  const a = BY_ID[id];
  if (!a) return `<div style="padding:40px 0"><h1 class="listhead" style="border:0">기사를 찾을 수 없습니다.</h1><p><a href="#/">1면으로 돌아가기</a></p></div>`;
  const cat = catOf(a.cat);
  const related = inCat(a.cat).filter(x=>x.id!==a.id).slice(0,3);
  const more = ARTICLES.filter(x=>x.cat!==a.cat).slice(0,3);
  return `
  <article class="art">
    <nav class="crumb"><a href="#/">홈</a><span>›</span><a href="#/${a.cat}">${esc(cat.ko)}</a><span>›</span><span>기사</span></nav>
    <div class="art__cat">${esc(cat.ko)}</div>
    <h1 class="art__title">${esc(a.title)}</h1>
    <p class="art__dek">${esc(a.dek)}</p>
    <div class="art__byline">
      <div class="art__writer">
        <span class="av">正</span>
        <span><b>${esc(a.writer)}</b><span>입력 ${dateStr(a)} · 수정 ${dateStr(a)}</span></span>
      </div>
      <div class="art__tools">
        <button type="button" data-share="copy">링크 복사</button>
        <button type="button" data-share="kakao">카톡 공유</button>
        <button type="button" data-share="print">인쇄</button>
      </div>
    </div>
    <div class="leadbar">${esc(a.lead)}</div>
    <figure class="figure">
      <img src="${IMG(a.img)}" alt="${esc(a.title)}">
      <figcaption>${esc(cat.ko)} 지면 이미지 · 정운타임즈 아카이브</figcaption>
    </figure>
    <div class="art__body">${bodyHTML(a.body)}</div>
    <div class="tagrow">
      ${['사주','운세','명리','정운타임즈',cat.ko].map(t=>`<a href="#/${a.cat}">#${esc(t)}</a>`).join('')}
    </div>

    <div class="funnel">
      <div class="funnel__ttl">재밌게 보셨나요?<br>내 운명도 지금 바로 확인해 보세요!</div>
      <p class="funnel__sub">생년월일 하나면 오늘의 기운부터 4페이지 분석까지. 결제 없이 먼저 확인할 수 있습니다.</p>
      <div class="funnel__btns">
        <a class="btn btn--ink" href="#/free">무료 사주·운세 바로 분석하기</a>
        <a class="btn btn--red" href="#/4p">🔥 990원 특별분석 이벤트 (4P 바로보기)</a>
      </div>
      <div class="pricechips">
        ${PRICING.map(p=>`<span>${esc(p.pages)} ${esc(p.price)}</span>`).join('')}
      </div>
      <p class="funnel__note">4P 마지막 페이지에서 정밀 전문분석지(30P·60P·100P)로 바로 이어집니다. 내 명식을 직접 돌려보고 싶다면 <a href="#/program" style="text-decoration:underline">사주분석 프로그램 · 1년 이용권</a>도 있습니다. 모든 분석은 참고·오락 정보입니다.</p>
    </div>

    <div class="related">
      <h3>${esc(cat.ko)} 관련 기사</h3>
      <ul>${related.map(r=>`<li><a href="#/article/${r.id}">${esc(r.title)}<span>${dateStr(r)}</span></a></li>`).join('')}</ul>
    </div>
    <div class="related">
      <h3>함께 읽으면 좋은 지면</h3>
      <ul>${more.map(r=>`<li><a href="#/article/${r.id}">${esc(r.title)}<span>${esc(catOf(r.cat).ko)}</span></a></li>`).join('')}</ul>
    </div>
  </article>`;
}

/* ---------- 오늘의 운세 지면 ---------- */
function kstDateKey(){
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth()+1)}-${pad2(d.getUTCDate())}`;
}
function seasonLine(){
  if (typeof TODAY_MONTH === 'undefined') return '절기로 보는 오늘';
  const b = TODAY_MONTH.b.idx;
  const names = { 0:'대설(大雪) 지나 소한(小寒)으로', 1:'소한(小寒) 지나 입춘(立春)으로', 2:'입춘(立春) 지나 경칩(驚蟄)으로',
    3:'경칩(驚蟄) 지나 청명(淸明)으로', 4:'청명(淸明) 지나 입하(立夏)으로', 5:'입하(立夏) 지나 망종(芒種)으로',
    6:'망종(芒種) 지나 소서(小暑)로', 7:'소서(小暑) 지나 입추(立秋)으로', 8:'입추(立秋) 지나 백로(白露)로',
    9:'백로(白露) 지나 한로(寒露)로', 10:'한로(寒露) 지나 입동(立冬)으로', 11:'입동(立冬) 지나 대설(大雪)로' };
  return names[b] || '절기로 보는 오늘';
}
function viewToday(){
  const main = todayLead();
  const isFresh = main && main.date === kstDateKey();
  return `
  <div class="today-hero">
    <div>
      <div class="kicker">DAILY FORTUNE · ${esc(TODAY_LABEL||'')}</div>
      <h1 class="today-title">오늘, 내 기운은<br>어디로 흐르는가</h1>
      <div class="today-ganji"><b>${(typeof TODAY_YEAR!=='undefined')?`${TODAY_YEAR.hanja}年 · ${TODAY_MONTH.hanja}月 · ${TODAY_DAY.hanja}日`:'丙午年 · 己亥月 · 庚子日'}</b><span>${seasonLine()}</span></div>
      <p class="deck">${esc(main.dek)}</p>
      <div class="meta" style="margin-top:10px"><b>${esc(main.writer)}</b><span class="dot"></span><span>${isFresh ? '오늘 호 · 05:30 발행' : '최근 호 ' + esc(main.date||'') + ' · 오늘 호는 05:30 발행'}</span></div>
      <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
        <a class="btn btn--ink" href="#/article/${main.id}">오늘의 운세 기사 전문 보기</a>
        <a class="btn btn--ghost" href="#/4p">990원 4P</a>
      </div>
    </div>
    <div class="paperbox todaycard">
      <div class="widget" style="box-shadow:none;border:0;background:transparent">${widgetMarkup('today')}</div>
    </div>
  </div>
  <div class="rule"></div>
  <div class="sec-head"><div class="sec-head__l"><h2>오늘의운세 지면</h2><span class="en">FORTUNE</span></div><a class="sec-head__more" href="#/today">전체 →</a></div>
  <ul class="artlist">
    ${byCat('today').map(a=>`<li><a href="#/article/${a.id}">
      <img src="${IMG(a.img)}" alt="${esc(a.title)}" loading="lazy">
      <span><span class="l-cat">${esc(catOf(a.cat).ko)}</span><span class="l-ttl">${esc(a.title)}</span><span class="l-dek">${esc(a.dek)}</span><span class="l-meta">${dateStr(a)}</span></span>
    </a></li>`).join('')}
  </ul>`;
}

/* ---------- 무료 분석 지면 ---------- */
function viewFree(){
  const today = todayLead();
  return `
  <div class="listhead">
    <div><div class="kicker">FREE · 1분</div><h1>무료 사주·운세 바로 분석</h1>
    <p>생년월일만 넣으면 오늘의 기운·행운의 색·숫자·한 줄 조언이 나옵니다. 궁합·전생·꿈은 아래 탭에서.</p></div>
  </div>
  <div class="listgrid">
    <div class="paperbox" style="padding:20px">
      <div class="tabs-sm" id="freeTabs">
        <button class="is-on" data-ft="today">오늘의 운세</button>
        <button data-ft="mbti">MBTI 궁합</button>
        <button data-ft="past">전생</button>
        <button data-ft="dream">꿈 해석</button>
      </div>

      <div data-fp="today">
        <form class="freegrid" data-wform="free">
          <div class="full"><label for="freeBirth">생년월일 (양력)</label><input type="date" id="freeBirth" min="1930-01-01" max="2025-12-31"></div>
          <div class="full"><label for="freeZodiac">생일을 모르면 띠로</label><select id="freeZodiac"><option value="">— 띠 선택 —</option>${zodiacOptions()}</select></div>
          <button class="btn btn--ink full" type="submit">무료로 오늘 보기 →</button>
        </form>
        <div class="wresult" data-wresult="free"></div>
      </div>

      <div data-fp="mbti" style="display:none">
        <div class="freegrid">
          <div><label>나의 MBTI</label><select id="mbtiA">${['ISTJ','ISFJ','INFJ','INTJ','ISTP','ISFP','INFP','INTP','ESTP','ESFP','ENFP','ENTP','ESTJ','ESFJ','ENFJ','ENTJ'].map(t=>`<option>${t}</option>`).join('')}</select></div>
          <div><label>상대 MBTI</label><select id="mbtiB">${['ENFJ','INFJ','ENFP','INFP','ENTJ','INTJ','ESTJ','ISTJ'].map(t=>`<option>${t}</option>`).join('')}</select></div>
          <button class="btn btn--ink full" type="button" id="mbtiGo">궁합 점수 보기 →</button>
        </div>
        <div class="wresult" id="mbtiOut"></div>
      </div>

      <div data-fp="past" style="display:none">
        <div class="freegrid">
          <div><label>생년월일</label><input type="date" id="pastBirth" min="1930-01-01" max="2025-12-31"></div>
          <div><label>태어난 시간 (모르면 비움)</label><input type="number" id="pastHour" min="0" max="23" placeholder="예: 17"></div>
          <div class="full"><label>성별</label><select id="pastGender"><option value="f">여성</option><option value="m">남성</option></select></div>
          <button class="btn btn--ink full" type="button" id="pastGo">전생 유형 보기 →</button>
        </div>
        <div class="wresult" id="pastOut"></div>
      </div>

      <div data-fp="dream" style="display:none">
        <div class="freegrid">
          <div class="full"><label>꿈에서 본 것 (한 단어)</label><input type="text" id="dreamWord" placeholder="예: 달, 물, 돼지, 뱀, 용, 불, 옛집"></div>
          <button class="btn btn--ink full" type="button" id="dreamGo">꿈 해석 보기 →</button>
        </div>
        <div class="wresult" id="dreamOut"></div>
      </div>

      <div class="funnel" style="margin-top:22px">
        <div class="funnel__ttl">여기까지가 무료 맛보기입니다.</div>
        <p class="funnel__sub">4페이지 특별분석으로 이어서 보시겠어요? 990원 4P에서 재물·애정·커리어 첫 문장이 열립니다.</p>
        <div class="funnel__btns">
          <a class="btn btn--red" href="#/4p">🔥 990원 4P 바로 보기</a>
          <a class="btn btn--gold" href="${AURA}" target="_blank" rel="noopener">30P·60P·100P 정밀분석</a>
        </div>
      </div>
    </div>

    <aside>
      <div class="panel">
        <div class="panel__head"><h3>오늘의 기사</h3><span>FORTUNE</span></div>
        <ul class="top7">
          ${byCat('today').map((a,i)=>`<li><a href="#/article/${a.id}"><span class="num">${pad2(i+1)}</span><span><span class="cat">${esc(catOf(a.cat).ko)}</span><span class="tt">${esc(a.title)}</span></span></a></li>`).join('')}
        </ul>
      </div>
      <a class="talk" href="${KAKAO}" target="_blank" rel="noopener">
        <span class="talk__ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 3C6.5 3 2 6.5 2 10.8c0 2.9 1.9 5.4 4.6 6.8-.4.8-1 2.8-1.6 3.9-.4.7.1 1 .8.7 2-.8 4.2-2 5.5-2.8.5.1 1 .1 1.6.1 5.5 0 10-3.5 10-7.8C22 6.5 17.5 3 12 3Z" fill="#231f20"/></svg></span>
        <span><b>카톡 1:1 상담</b><span>결제 전 궁금한 점을 먼저 물어보세요</span></span>
      </a>
      <div class="promo">
        <span class="promo__tag">990원 SPECIAL</span>
        <h4>4페이지 분석지<br>지금 바로 넘겨보기</h4>
        <p>5장 정밀판 2종 · 3장 요약판 2종</p>
        <a class="btn btn--gold btn--block" href="#/4p">4P 열기 →</a>
      </div>
    </aside>
  </div>`;
}

/* ---------- 4P 뷰어 ---------- */
const FOURP = [
  { no:'01', title:'4P ① 정밀 5장판', file:'4p/01.html', note:'본질 → 재물 → 애정 → 커리어 → 클리프행어까지 5장 구성' },
  { no:'02', title:'4P ② 확장 5장판', file:'4p/02.html', note:'여백과 차트를 키운 확장 레이아웃. 큰 화면에서 읽기 좋습니다' },
  { no:'03', title:'4P ③ 요약 3장판 A', file:'4p/03.html', note:'본질 → 재물 → 위기까지 3장. 짧게 읽히는 구성' },
  { no:'04', title:'4P ④ 요약 3장판 B', file:'4p/04.html', note:'가장 짧은 3장 구성. 모바일에서 빠르게 넘기기 좋습니다' }
];
function view4P(active){
  const idx = Math.max(0, Math.min(3, Number(active||0)));
  const cur = FOURP[idx];
  return `
  <div class="fourp-head">
    <div class="kicker">990원 SPECIAL · 4P SAMPLE</div>
    <h1>딱 4페이지, <em>내 사주의 첫 장</em></h1>
    <p>990원 특별분석 4P 샘플 4종입니다. 아래 탭으로 버전을 바꿔 볼 수 있고, 마지막 페이지에서 정밀 전문분석지(30P·60P·100P)로 이어집니다.</p>
  </div>
  <div class="fourp-me">
    <div class="fourp-me__t"><b>내 사주로 4P 채우기</b><span>이름·생년월일시(양/음력·성별)를 넣으면 실제 만세력 엔진이 내 여덟 글자로 지면을 다시 씁니다.</span></div>
    <form id="fourpMe" autocomplete="off">
      <div class="fourp-me__row">
        <label>이름<input type="text" id="fmName" maxlength="20" placeholder="김하늘"></label>
        <label>성별<select id="fmGender"><option value="여">여성</option><option value="남">남성</option></select></label>
        <label>달력<select id="fmCal"><option value="solar">양력</option><option value="lunar">음력</option></select></label>
      </div>
      <div class="fourp-me__row">
        <label>생년월일<input type="date" id="fmBirth" min="1900-01-01" max="2026-12-31"></label>
        <label>시각 (모르면 비움)<input type="time" id="fmTime"></label>
        <button class="btn btn--red" type="submit">4P 다시 계산 →</button>
      </div>
      <p class="fourp-me__note" id="fmNote">입력한 정보는 서버로 보내지 않고 브라우저 안에서만 계산합니다. 4가지 버전 모두 같은 명식으로 다시 그립니다.</p>
    </form>
  </div>
  <div class="fourp-tabs">
    ${FOURP.map((f,i)=>`<button type="button" data-4p="${i}" class="${i===idx?'is-on':''}">${f.title}</button>`).join('')}
  </div>
  <div class="fourp-meta">
    <span>현재: ${esc(cur.title)}</span><span>·</span><span>${esc(cur.note)}</span>
  </div>
  <div class="fourp-stage">
    <div>
      <div class="phone">
        <iframe id="fourpFrame" src="${cur.file}${window.__fourpQuery ? '?' + window.__fourpQuery : ''}" title="990원 4P 분석지 ${esc(cur.title)}" loading="lazy"></iframe>
      </div>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:14px;flex-wrap:wrap">
        <a class="btn btn--ghost" href="${cur.file}${window.__fourpQuery ? '?' + window.__fourpQuery : ''}" target="_blank" rel="noopener" id="fourpOpen">새 창에서 크게 보기</a>
        <a class="btn btn--ghost" href="${cur.file}${window.__fourpQuery ? '?' + window.__fourpQuery : ''}" target="_blank" rel="noopener" id="fourpPrint">인쇄용으로 열기</a>
      </div>
    </div>
    <aside class="fourp-side">
      <div class="side-card">
        <h4>이렇게 보세요</h4>
        <ol>
          <li>생년월일을 넣고 카톡 추가 버튼을 누르면 4P가 열립니다.</li>
          <li>스크롤해서 5장(또는 3장)을 끝까지 읽습니다.</li>
          <li>마지막 페이지에서 정밀분석지로 이어집니다.</li>
        </ol>
      </div>
      <div class="side-card side-card--dark">
        <h4 style="color:#f0e2c4">만족하셨다면?</h4>
        <p>4P는 맛보기입니다. 정밀 전문분석지는 30P부터 시작합니다.</p>
        <div class="pricepills">
          ${PRICING.map(p=>`<div><span>${esc(p.pages)} · ${esc(p.name)}</span><b>${esc(p.price)}</b></div>`).join('')}
        </div>
        <a class="btn btn--gold btn--block" href="${AURA}" target="_blank" rel="noopener">✨ 30P·60P·100P 보러가기</a>
      </div>
      <div class="side-card">
        <h4>전체 화면으로 보기</h4>
        <p>휴대폰에서는 ‘홈 화면에 추가’로 앱처럼 열 수 있습니다. PC에서는 새 창으로 열면 4P가 원본 크기로 선명하게 보입니다.</p>
        <a class="btn btn--ink btn--block" href="${cur.file}" target="_blank" rel="noopener">4P 원본 열기</a>
      </div>
    </aside>
  </div>`;
}
function bind4P(root){
  $$('[data-4p]', root).forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const i = btn.getAttribute('data-4p');
      location.hash = `#/4p${i==='0'?'':'/v'+i}`;
    });
  });
  const form = $('#fourpMe', root);
  if (form) form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const name = ($('#fmName', root)||{}).value || '';
    const gender = ($('#fmGender', root)||{}).value || '여';
    const cal = ($('#fmCal', root)||{}).value || 'solar';
    const birth = ($('#fmBirth', root)||{}).value || '';
    const time = ($('#fmTime', root)||{}).value || '';
    const note = $('#fmNote', root);
    if (!birth){ if (note) note.textContent = '생년월일을 먼저 넣어 주세요.'; return; }
    const p = birth.split('-').map(Number);
    const q = new URLSearchParams();
    q.set('n', name); q.set('g', gender); q.set('c', cal);
    q.set('y', p[0]); q.set('m', p[1]); q.set('d', p[2]);
    if (time){ const t = time.split(':'); q.set('t', t[0] + t[1]); } else q.set('u', '1');
    lastFourpQuery = q.toString();
    window.__fourpQuery = lastFourpQuery;
    const frame = $('#fourpFrame', root);
    if (frame) frame.src = frame.getAttribute('src').split('?')[0] + '?' + lastFourpQuery;
    const open = $('#fourpOpen', root), pr = $('#fourpPrint', root);
    if (open) open.href = open.getAttribute('href').split('?')[0] + '?' + lastFourpQuery;
    if (pr) pr.href = pr.getAttribute('href').split('?')[0] + '?' + lastFourpQuery;
    if (note) note.innerHTML = '<b>내 명식으로 다시 계산했습니다.</b> 지면 아래로 내려가 1장부터 읽어 보세요. 다른 버전 탭을 눌러도 같은 명식으로 계산됩니다.';
  });
  if (window.__fourpQuery) restoreFourpForm();
}
let lastFourpQuery = '';
function restoreFourpForm(){
  const q = new URLSearchParams(window.__fourpQuery || '');
  const set = (id,v)=>{ const el = document.getElementById(id); if (el && v!=null) el.value = v; };
  set('fmName', q.get('n') || '');
  set('fmGender', q.get('g') || '여');
  set('fmCal', q.get('c') || 'solar');
  if (q.get('y')) set('fmBirth', `${q.get('y')}-${String(q.get('m')).padStart(2,'0')}-${String(q.get('d')).padStart(2,'0')}`);
  const t = q.get('t');
  if (t && t.length >= 3) set('fmTime', `${t.slice(0, t.length-2)}:${t.slice(-2)}`);
}

/* ---------- 지난 기사 아카이브 ---------- */
function archiveGroups(){
  const daily = DAILY().filter(a=>a.date);
  const map = {};
  daily.forEach(a=>{ (map[a.date] = map[a.date] || []).push(a); });
  return Object.keys(map).sort((a,b)=>b.localeCompare(a)).map(d=>({ date:d, items: map[d].slice().sort((x,y)=> (y.top?1:0)-(x.top?1:0) || num(y.views)-num(x.views)) }));
}
function viewArchive(){
  const groups = archiveGroups();
  const total = groups.reduce((n,g)=>n+g.items.length, 0);
  const cats = Array.from(new Set(groups.reduce((l,g)=>l.concat(g.items.map(a=>a.cat)), [])));
  if (!groups.length){
    return `<div class="listhead"><div><div class="kicker">ARCHIVE</div><h1>지난 기사</h1>
      <p>아직 누적된 지면이 없습니다. 매일 05:30에 새 호가 발행되면 이곳에 쌓입니다.</p></div></div>`;
  }
  const first = groups[0];
  return `
  <div class="listhead">
    <div>
      <div class="kicker">ARCHIVE · 지난 기사 모아보기</div>
      <h1>정운타임즈 지난 호</h1>
      <p>매일 05:30 새 호가 발행되고, 지난 호는 <b>최근 60일 · 최대 120편</b>까지 이곳에 쌓입니다. 오늘 ${groups.length}일치 ${total}편이 남아 있습니다.</p>
    </div>
    <a class="btn btn--ink" href="#/4p">990원 4P 보기</a>
  </div>
  <div class="arch-filter" id="archFilter">
    <button type="button" class="is-on" data-af="">전체 ${total}</button>
    ${cats.map(c=>`<button type="button" data-af="${esc(c)}">${esc(catOf(c).ko)} ${groups.reduce((n,g)=>n+g.items.filter(a=>a.cat===c).length,0)}</button>`).join('')}
  </div>
  <div id="archBody">
  ${groups.map(g=>`
    <div class="arch-day" data-day="${esc(g.date)}">
      <div class="arch-day__head">
        <b>${esc(g.date.replace(/-/g,'.'))}</b>
        <span>${esc(ganjiLabel(g.date))}</span>
        <i data-cnt>${g.items.length}편</i>
      </div>
      <ul class="arch-list">
        ${g.items.map(a=>`<li data-cat="${esc(a.cat)}"><a href="#/article/${a.id}">
          <span class="arch-cat">${esc(catOf(a.cat).ko)}</span>
          <span class="arch-ttl">${esc(a.title)}</span>
          <span class="arch-meta">${esc(a.writer||'정운타임즈')} · ${esc(a.time||'05:30')}</span>
        </a></li>`).join('')}
      </ul>
    </div>`).join('')}
  </div>
  <div class="funnel" style="margin-top:26px">
    <div class="funnel__ttl">지난 호를 읽다 보면, 내 사주가 궁금해집니다.</div>
    <p class="funnel__sub">생년월일시를 넣으면 지금 이 지면의 기준으로 내 여덟 글자를 계산합니다.</p>
    <div class="funnel__btns">
      <a class="btn btn--red" href="#/4p">🔥 990원 4P 바로 보기</a>
      <a class="btn btn--ink" href="#/free">무료 1분 분석</a>
    </div>
  </div>`;
}
function ganjiLabel(d){
  const t = String(d).split('-').map(Number);
  if (t.length!==3 || typeof dayIndex !== 'function') return '';
  try {
    const y = yearPillar(t[0], t[1], t[2]).g, m = monthPillar(t[0], t[1], t[2]), dd = ganjiOf(dayIndex(t[0], t[1], t[2]));
    return `${y.hanja}年 · ${m.hanja}月 · ${dd.hanja}日`;
  } catch(e){ return ''; }
}
function bindArchive(root){
  const box = $('#archBody', root);
  $$('#archFilter button', root).forEach(b=>{
    b.addEventListener('click', ()=>{
      $$('#archFilter button', root).forEach(x=>x.classList.remove('is-on'));
      b.classList.add('is-on');
      const f = b.getAttribute('data-af');
      $$('.arch-day', box).forEach(day=>{
        let shown = 0;
        $$('li', day).forEach(li=>{
          const on = !f || li.getAttribute('data-cat')===f;
          li.style.display = on ? '' : 'none';
          if (on) shown++;
        });
        const cnt = day.querySelector('[data-cnt]');
        if (cnt) cnt.textContent = shown + '편';
        day.style.display = shown ? '' : 'none';
      });
    });
  });
}

/* ---------- 라우터 ---------- */
function parseHash(){
  const h = (location.hash || '#/').replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean);
  if (!parts.length) return { view:'home' };
  if (parts[0]==='article' && parts[1]) return { view:'article', id:parts[1] };
  if (parts[0]==='archive') return { view:'archive' };
  if (parts[0]==='4p'){
    const v = parts[1] && parts[1].startsWith('v') ? Number(parts[1].slice(1)) : 0;
    return { view:'4p', v: v||0 };
  }
  if (parts[0]==='fourp_talk') return { view:'4p', v:0 };
  if (parts[0]==='program') return { view:'program' };
  if (parts[0]==='free') return { view:'free' };
  if (parts[0]==='today') return { view:'today' };
  const cat = CATS.find(c=>c.id===parts[0]);
  if (cat && cat.id!=='main') return { view:'section', cat:cat.id };
  return { view:'home' };
}
function render(){
  const r = parseHash();
  const app = $('#app');
  let activeTab = 'main';
  if (r.view==='section') activeTab = r.cat;
  else if (r.view==='4p') activeTab = 'fourp';
  else if (r.view==='program') activeTab = 'program';
  else if (r.view==='today') activeTab = 'today';
  else if (r.view==='free') activeTab = 'free';
  else if (r.view==='article') activeTab = (BY_ID[r.id] && BY_ID[r.id].cat) || 'main';
  renderTabs(activeTab);
  let html='';
  if (r.view==='home') html = viewHome();
  else if (r.view==='section') html = viewSection(r.cat);
  else if (r.view==='article') html = viewArticle(r.id);
  else if (r.view==='today') html = viewToday();
  else if (r.view==='free') html = viewFree();
  else if (r.view==='program') html = viewProgram();
  else if (r.view==='4p') html = view4P(r.v);
  else if (r.view==='archive') html = viewArchive();
  app.innerHTML = html;
  app.classList.remove('fade'); void app.offsetWidth; app.classList.add('fade');
  bindWidget(app);
  bind4P(app);
  if (r.view==='free') bindFree(app);
  if (r.view==='archive') bindArchive(app);
  if (r.view==='article') bindShare(app, r.id);
  const a = (r.view==='article') ? BY_ID[r.id] : null;
  const cat = (r.view==='section') ? catOf(r.cat) : null;
  document.title = a ? `${a.title} | ${BRAND.name}`
    : cat ? `${cat.ko} | ${BRAND.name}`
    : (r.view==='archive' ? `지난 기사 모아보기 | ${BRAND.name}`
    : (r.view==='program' ? `사주분석 프로그램 · 1년 이용권 | ${BRAND.name}` : '정운타임즈 | 운명사주, 정운이 풀다'));
  window.scrollTo({ top:0, behavior:'instant' in document.documentElement.style ? 'instant' : 'auto' });
  const menu = $('#mobileMenu'); if (menu) menu.classList.remove('is-on');
}
function bindFree(root){
  $$('#freeTabs button', root).forEach(b=>{
    b.addEventListener('click', ()=>{
      $$('#freeTabs button', root).forEach(x=>x.classList.remove('is-on'));
      b.classList.add('is-on');
      const t = b.getAttribute('data-ft');
      $$('[data-fp]', root).forEach(p=> p.style.display = (p.getAttribute('data-fp')===t)?'':'none');
    });
  });
  const out = (el,html)=>{ el.classList.add('is-on'); el.innerHTML = html; el.scrollIntoView({behavior:'smooth', block:'nearest'}); };

  const mbtiGo = $('#mbtiGo', root);
  if (mbtiGo) mbtiGo.addEventListener('click', ()=>{
    const a=$('#mbtiA',root).value, b=$('#mbtiB',root).value;
    const r = mbtiCompat(a,b);
    out($('#mbtiOut',root), `
      <div class="wresult__top">
        <div class="ring" style="--p:${r.score}"><b>${r.score}</b></div>
        <div><div class="wresult__head">${esc(a)} × ${esc(b)} — ${esc(r.band.title)}</div>
        <div class="wresult__deck">${esc(r.band.line)}</div></div>
      </div>
      <ul style="margin:8px 0 0 16px;font-size:12.5px;color:#4d4638;line-height:1.75">
        ${r.diffs.map(d=>`<li><b>${esc(d.axis)}</b> — ${esc(d.text)}</li>`).join('')}
      </ul>
      <p class="wresult__note">같은 글자 ${r.same}개 · 점수는 참고용입니다. 관계의 결론은 두 사람의 몫입니다.</p>`);
  });

  const pastGo = $('#pastGo', root);
  if (pastGo) pastGo.addEventListener('click', ()=>{
    const v = $('#pastBirth',root).value;
    if (!v){ out($('#pastOut',root), '<p class="wresult__note">생년월일을 먼저 넣어 주세요.</p>'); return; }
    const [y,m,d] = v.split('-').map(Number);
    const hourEl = $('#pastHour',root).value;
    const hour = hourEl===''? null : Number(hourEl);
    const g = $('#pastGender',root).value;
    const r = pastlifeOf({y,m,d}, hour, g);
    out($('#pastOut',root), `
      <div class="wresult__top">
        <div class="ring" style="--p:82"><b>${esc(r.type.emblem)}</b></div>
        <div><div class="wresult__head">전생 · ${esc(r.era)} ${esc(r.type.role)}</div>
        <div class="wresult__deck">${esc(r.type.oneLine)}</div></div>
      </div>
      <div class="wgrid"><div><span>재능</span><b>${esc(r.type.job)}</b></div><div><span>숙제</span><b>${esc(r.type.lesson)}</b></div><div><span>기억</span><b>${esc(r.type.habit)}</b></div></div>
      <div class="wresult__advice">${esc(r.type.link)}</div>
      <p class="wresult__note">다음 생 이야기: ${esc(r.second.role)} · ${esc(r.second.oneLine)}</p>`);
  });

  const dreamGo = $('#dreamGo', root);
  if (dreamGo) dreamGo.addEventListener('click', ()=>{
    const w = ($('#dreamWord',root).value||'').trim();
    if (!w){ out($('#dreamOut',root), '<p class="wresult__note">꿈에서 본 것을 한 단어로 적어 주세요. 예: 달, 물, 돼지.</p>'); return; }
    const hit = DREAM_WORDS.find(x=> w.includes(x.k) || x.k.includes(w));
    const base = hit ? hit : DREAM_WORDS[Math.floor(hashStr(w) % DREAM_WORDS.length)];
    const rng = rngOf('dream|'+w);
    const nums = luckNumbers(rng, 4);
    out($('#dreamOut',root), `
      <div class="wresult__top">
        <div class="ring" style="--p:76"><b>꿈</b></div>
        <div><div class="wresult__head">‘${esc(w)}’ — ${esc(base.mean)}</div>
        <div class="wresult__deck">${esc(base.line)}</div></div>
      </div>
      <div class="wgrid"><div><span>행운의 숫자</span><b>${nums.join(' · ')}</b></div><div><span>행운의 색</span><b>은백·먹색</b></div><div><span>좋은 시간</span><b>19–23시</b></div></div>
      <div class="wresult__advice">꿈은 예고가 아니라 마음의 정리입니다. 오늘 그 장면을 떠올리며 무엇이 마음에 걸렸는지 한 줄 적어 보세요.</div>`);
  });
}

function bindShare(root, id){
  $$('[data-share]', root).forEach(b=>{
    b.addEventListener('click', async ()=>{
      const t = b.getAttribute('data-share');
      const url = location.href;
      if (t==='copy'){
        try { await navigator.clipboard.writeText(url); b.textContent='복사됨 ✓'; setTimeout(()=>b.textContent='링크 복사',1600); }
        catch(e){ prompt('아래 주소를 복사하세요', url); }
      } else if (t==='kakao'){
        window.open(KAKAO,'_blank','noopener');
      } else if (t==='print'){
        window.print();
      }
    });
  });
}

/* ---------- 사주프로그램 · 1년 이용권 신청 모달 ---------- */
function openProgramModal(){
  const w = $('#programModal'); if (!w) return;
  const body = $('#programBody');
  body.innerHTML = `
    <div class="paybox">
      <div class="paybox__row"><span>상품</span><b>정운 사주분석 웹 프로그램 · 1년 이용권</b></div>
      <div class="paybox__row"><span>구성</span><b>프로그램 파일 + 이용권 코드 + 63p 해설 전자책</b></div>
      <div class="paybox__row"><span>사용 기간</span><b>코드 인증일로부터 1년</b></div>
      <div class="paybox__row"><span>결제</span><b>카톡 1:1 상담 후 안내</b></div>
    </div>
    <p class="paybox__note">현재 카드결제(PG) 연동 전이라, 신청과 결제는 카카오채널 1:1 상담으로 진행합니다. 상담에서 이용 기간과 결제 방법을 안내받고, 입금이 확인되면 <b>이용권 코드</b>와 <b>프로그램 파일</b>을 보내드립니다.</p>
    <ol class="paybox__steps">
      <li>카톡 상담으로 신청 — 이름·생년월일은 미리 보내지 않으셔도 됩니다.</li>
      <li>결제 확인 후 1년 이용권 코드 발급.</li>
      <li>프로그램 파일과 코드를 받아 첫 화면에 코드 입력 → 바로 사용.</li>
    </ol>
    <div class="paybox__btns">
      <a class="btn btn--gold" href="${KAKAO}" target="_blank" rel="noopener">카톡으로 1년 이용권 신청 →</a>
      <a class="btn btn--ghost" href="#/4p" data-close-program>990원 4P 먼저 보기</a>
    </div>
    <p class="paybox__small">프로그램은 설치 없이 파일 하나로 실행되고 인터넷 없이도 계산됩니다. 결과는 참고·오락 정보입니다.</p>`;
  w.classList.add('is-on');
}
function closeProgramModal(){ const w = $('#programModal'); if (w) w.classList.remove('is-on'); }

/* 화면 미리보기 — 정식 프로그램의 실제 화면 3장 (프로그램 파일 자체는 배포하지 않는다) */
function openPreviewModal(){
  const w = $('#previewModal'); if (!w) return;
  const body = $('#previewBody');
  body.innerHTML = `
    <div class="preview-gal">
      <figure><img src="assets/img/program-shot.webp" alt="사주 명식과 오행·십성 화면"><figcaption><b>① 사주 명식</b>생년월일을 넣으면 사주팔자·지장간·십성·12운성과 오행 분포를 한 화면에 계산합니다.</figcaption></figure>
      <figure><img src="assets/img/program-ziwei.webp" alt="자미두수 12궁 명반"><figcaption><b>② 자미두수 12궁</b>명궁·재백궁·관록궁까지 12궁 명반과 궁별 해설, 종합 해석을 함께 봅니다.</figcaption></figure>
      <figure><img src="assets/img/program-cross.webp" alt="사주와 자미두수 교차 결론"><figcaption><b>③ 교차 결론</b>사주와 자미두수가 같은 지점을 가리키는 곳만 추려 결론 카드로 정리합니다.</figcaption></figure>
    </div>
    <p class="preview-note">화면은 정식 프로그램의 실제 화면입니다. 명식을 직접 입력해 보는 것은 1년 이용권을 받은 뒤 가능합니다. 내 사주를 글로 먼저 읽고 싶다면 990원 4P부터 보세요.</p>
    <div class="paybox__btns">
      <button class="btn btn--gold" type="button" data-program-buy="year">1년 이용권 문의 →</button>
      <a class="btn btn--ghost" href="#/4p" data-close-preview>990원 4P 먼저 보기</a>
    </div>`;
  w.classList.add('is-on');
}
function closePreviewModal(){ const w = $('#previewModal'); if (w) w.classList.remove('is-on'); }

function setupProgram(){
  document.addEventListener('click', (e)=>{
    const buy = e.target.closest ? e.target.closest('[data-program-buy]') : null;
    if (buy){ e.preventDefault(); closePreviewModal(); openProgramModal(); return; }
    if (e.target.closest && e.target.closest('[data-program-preview]')){ e.preventDefault(); openPreviewModal(); return; }
    if (e.target.closest && e.target.closest('[data-close-program]')) closeProgramModal();
    if (e.target.closest && e.target.closest('[data-close-preview]')) closePreviewModal();
  });
  ['programModal','previewModal'].forEach(id=>{
    const w = $('#'+id);
    if (w) w.addEventListener('click', (ev)=>{ if (ev.target===w) w.classList.remove('is-on'); });
  });
  const x = $('#programClose'); if (x) x.addEventListener('click', closeProgramModal);
  const px = $('#previewClose'); if (px) px.addEventListener('click', closePreviewModal);
  document.addEventListener('keydown', (e)=>{ if (e.key==='Escape'){ closeProgramModal(); closePreviewModal(); } });
}

/* ---------- 모바일 메뉴 · PWA 설치 ---------- */
function setupNav(){
  const burger = $('#burger'); const menu = $('#mobileMenu');
  if (burger && menu){
    burger.addEventListener('click', ()=>{
      const on = menu.classList.toggle('is-on');
      burger.setAttribute('aria-expanded', on ? 'true':'false');
    });
    menu.addEventListener('click', (e)=>{ if (e.target===menu) menu.classList.remove('is-on'); });
  }
}
let deferredPrompt = null;
function isStandalone(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function isIOS(){
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
}
function showInstallGuide(){
  const w = $('#installModal'); if (!w) return;
  w.classList.add('is-on');
  const body = $('#installBody');
  body.innerHTML = isIOS()
    ? `<p style="font-size:14px;line-height:1.8;color:#3d3d3d">아이폰·아이패드에서는 사파리 하단의 <b>공유 버튼</b>을 누른 뒤 <b>‘홈 화면에 추가’</b>를 선택하면 앱처럼 설치됩니다.</p>
       <ol style="margin:12px 0 0 18px;font-size:13.5px;line-height:1.9;color:#4a4a4a">
         <li>사파리로 이 페이지를 엽니다.</li>
         <li>하단 가운데 <b>공유</b> 아이콘을 누릅니다.</li>
         <li>목록에서 <b>홈 화면에 추가</b>를 선택합니다.</li>
         <li>오른쪽 위 <b>추가</b>를 누르면 설치 완료.</li>
       </ol>`
    : `<p style="font-size:14px;line-height:1.8;color:#3d3d3d">브라우저 메뉴에서 <b>‘앱 설치’</b> 또는 <b>‘홈 화면에 추가’</b>를 선택하면 설치됩니다. 안드로이드 크롬에서는 주소창 오른쪽 메뉴(⋮)에 있습니다.</p>
       <ol style="margin:12px 0 0 18px;font-size:13.5px;line-height:1.9;color:#4a4a4a">
         <li>크롬으로 이 페이지를 엽니다.</li>
         <li>오른쪽 위 <b>⋮</b> 메뉴를 누릅니다.</li>
         <li><b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 선택합니다.</li>
       </ol>`;
}
function setupPWA(){
  if (isStandalone()){
    document.body.classList.add('installed');
    $$('[data-install]').forEach(b=> b.style.display='none');
  }
  const barX = $('#installBarClose');
  if (barX) barX.addEventListener('click', ()=>{ $('#installBar').style.display='none'; try{localStorage.setItem('jwInstallBar','off');}catch(e){} });
  try{ if (localStorage.getItem('jwInstallBar')==='off'){ const b=$('#installBar'); if (b) b.style.display='none'; } }catch(e){}

  /* --- 설치 유도 시트: 첫 접속 1초 뒤 부드럽게 상승 --- */
  const sheet = $('#installSheet');
  const SHEET_KEY = 'jwInstallSheetDismissedAt';
  const SHEET_QUIET_MS = 20*60*60*1000; /* ‘오늘은 웹으로 보기’ → 20시간 쉼 */
  const closeSheet = (remember)=>{
    if (sheet) sheet.classList.remove('is-on');
    if (remember){ try{ localStorage.setItem(SHEET_KEY, String(Date.now())); }catch(e){} }
  };
  const openSheet = ()=>{
    if (!sheet || isStandalone()) return;
    const modal = $('#installModal');
    if (modal && modal.classList.contains('is-on')) return;
    sheet.classList.add('is-on');
  };
  let quiet = false;
  try{
    const t = Number(localStorage.getItem(SHEET_KEY) || 0);
    quiet = !!t && (Date.now() - t) < SHEET_QUIET_MS;
  }catch(e){ quiet = false; }
  if (!isStandalone() && !quiet) setTimeout(openSheet, 1000);
  const sheetX = $('#installSheetClose'); if (sheetX) sheetX.addEventListener('click', ()=> closeSheet(true));
  const sheetLater = $('#installSheetLater'); if (sheetLater) sheetLater.addEventListener('click', ()=> closeSheet(true));
  document.addEventListener('keydown', (e)=>{ if (e.key==='Escape' && sheet && sheet.classList.contains('is-on')) closeSheet(true); });

  window.addEventListener('beforeinstallprompt', (e)=>{
    e.preventDefault(); deferredPrompt = e;
    $$('[data-install]').forEach(b=>{ b.style.display='inline-flex'; });
  });
  window.addEventListener('appinstalled', ()=>{
    deferredPrompt = null;
    document.body.classList.add('installed');
    $$('[data-install]').forEach(b=> b.style.display='none');
    closeSheet(false);
    const t = $('#toast'); if (t){ t.textContent='정운타임즈가 설치되었습니다. 홈 화면에서 열어 보세요.'; t.classList.add('is-on'); setTimeout(()=>t.classList.remove('is-on'), 3200); }
  });
  /* 설치 버튼은 1면·지면이 다시 그려질 때마다 생기므로 문서 단위로 받는다 */
  document.addEventListener('click', async (e)=>{
    const b = e.target.closest ? e.target.closest('[data-install]') : null;
    if (!b) return;
    e.preventDefault();
    closeSheet(true);
    if (deferredPrompt){
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome !== 'accepted') showInstallGuide();
      deferredPrompt = null;
    } else {
      showInstallGuide();
    }
  });
  const x = $('#installClose'); if (x) x.addEventListener('click', ()=> $('#installModal').classList.remove('is-on'));
  const w = $('#installModal'); if (w) w.addEventListener('click', (e)=>{ if (e.target===w) w.classList.remove('is-on'); });
  if ('serviceWorker' in navigator){
    window.addEventListener('load', ()=>{
      navigator.serviceWorker.register('service-worker.js').catch(()=>{});
    });
  }
}

/* ---------- 시작 ---------- */
document.addEventListener('DOMContentLoaded', ()=>{
  renderTicker(); renderMastDate(); setupNav(); setupPWA(); setupProgram();
  render();
});
window.addEventListener('hashchange', render);
