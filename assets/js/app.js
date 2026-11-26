/* ============================================================================
   운명사주 정운타임즈 · app.js — 라우터 · 지면 렌더 · 오늘의 운세 · 4P 뷰어 · PWA
   ========================================================================== */
'use strict';

const ARTICLES = [].concat(
  (typeof ARTICLES_DAILY !== 'undefined' ? ARTICLES_DAILY : []),
  ARTICLES_1, ARTICLES_2, ARTICLES_3,
  (typeof ARTICLES_TOP7 !== 'undefined' ? ARTICLES_TOP7 : [])
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
/* 이미지 주소 — 이름에 확장자가 있으면 그대로, 없으면 기존 .webp */
const IMG = (name)=>{
  const n = String(name||'');
  if (/\.[a-z0-9]+$/i.test(n)) return `assets/img/${n}`;          /* 확장자까지 적힌 이름 */
  if (n.indexOf('g/')===0) return `assets/img/${n}.svg`;           /* 생성 일러스트는 SVG */
  return `assets/img/${n}.webp`;                                   /* 기존 사진·일러스트 */
};
const ORDER = 'https://aura-saju.pages.dev/order.html';

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
const SITE_BUILD_DATE = '2026-11-25';
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
    const hot = (c.id==='main'||c.id==='today'||c.id==='people'||c.id==='program') ? '<span class="hot">NEW</span>' : '';
    return `<a class="tab${on}${c.point?' tab--point':''}" href="${c.route}">${c.ko}${hot}</a>`;
  }).join('');
  /* 모바일에서 활성 지면 탭이 가려져 있으면 보이게 옆으로 밀어 준다 */
  const act = nav.querySelector('.tab.is-active');
  if (act && nav.scrollWidth > nav.clientWidth + 4){
    nav.scrollLeft = Math.max(0, act.offsetLeft - 14);
  }
  /* 왼쪽으로 밀린 상태에서는 앞 탭 꼬리가 비치지 않게 흐리게 */
  const syncEdge = ()=> nav.classList.toggle('is-scrolled', nav.scrollLeft > 6);
  syncEdge();
  if (!nav.dataset.edge){
    nav.dataset.edge = '1';
    nav.addEventListener('scroll', syncEdge, { passive: true });
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
      <a class="btn btn--gold" href="#/4p">무료 4P 맛보기</a>
      <a class="btn btn--ghost" href="${ORDER}" target="_blank" rel="noopener">정밀분석 주문</a>
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
  const total = n || 7;
  const v = (a)=> Number(String(a.views||'').replace(/[^0-9]/g,'')) || 0;
  const w = (a)=>{ const d = daysAgo(a); return d <= 0 ? 2.6 : d <= 1 ? 1.8 : d <= 3 ? 1.3 : d <= 10 ? 1.05 : 1; };
  /* 0) 오늘의 화제의 인물(연예인 사주) — 매일 05:30 daily_update.py 가 새로 발행하는
        people 기사(최신 호)를 TOP 7 2번 자리에 반드시 앉힌다. 없으면 자리를 비워 둔다. */
  const star = newestOf('people');
  /* 1) 편집국이 고른 TOP 7(data.js TOP7_PINNED)을 순서대로 먼저 채운다 — 인물 기사 몫은 하나 비운다 */
  const pinned = [];
  const own = star ? total - 1 : total;
  if (typeof TOP7_PINNED !== 'undefined'){
    TOP7_PINNED.forEach(id=>{
      const a = BY_ID[id];
      if (a && a !== star && pinned.indexOf(a) === -1 && pinned.length < own) pinned.push(a);
    });
  }
  /* 2) 남은 자리는 조회수 + 최신 가중으로 채운다 (고정 기사가 빠져도 TOP 7이 비지 않도록) */
  const rest = ARTICLES
    .filter(a=> a !== star && pinned.indexOf(a) === -1)
    .sort((a,b)=> v(b)*w(b) - v(a)*w(a));
  const list = pinned.concat(rest).slice(0, own);
  /* 3) 인물 기사는 2번 자리(1~3위 안)에 끼워 넣는다 */
  if (star) list.splice(Math.min(1, list.length), 0, star);
  return list.slice(0, total);
}
function rankBlock(){
  const list = top7Pick(7);
  const hero = list[0], rest = list.slice(1);
  return `<section class="rank" aria-labelledby="rankTitle">
    <div class="rank__head">
      <span class="rank__badge">TOP 7</span>
      <h2 id="rankTitle">인기뉴스</h2>
      <span class="rank__en">MOST READ</span>
      <span class="rank__note">편집국이 고른 오늘의 인기 기사 · 매일 05:30 갱신</span>
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

/* ---------- 1면 · 오늘의 한 줄 운세 (띠 12칩) ---------- */
const ZODIAC = [
  ['쥐','🐭','子'],['소','🐮','丑'],['호랑이','🐯','寅'],['토끼','🐰','卯'],['용','🐲','辰'],['뱀','🐍','巳'],
  ['말','🐴','午'],['양','🐑','未'],['원숭이','🐵','申'],['닭','🐔','酉'],['개','🐶','戌'],['돼지','🐷','亥']
];
function onelineBlock(){
  const g = (typeof TODAY_YEAR!=='undefined') ? `${TODAY_YEAR.hanja}年 ${TODAY_MONTH.hanja}月 ${TODAY_DAY.hanja}日` : '';
  return `<section class="oneline" id="oneline" aria-labelledby="onelineTitle">
    <div class="oneline__in">
    <div class="oneline__head">
      <span class="oneline__k">TODAY'S ONE LINE · 무료</span>
      <h2 id="onelineTitle">오늘의 한 줄 운세</h2>
      <p>띠만 고르면 오늘 하루가 바로 나옵니다. 생년월일도, 회원가입도 필요 없습니다.</p>
      <span class="oneline__ganji">${esc(g)}</span>
    </div>
    <div class="oneline__right">
    <div class="oneline__chips" role="group" aria-label="띠 선택">
      ${ZODIAC.map((z,i)=>`<button type="button" class="oneline__chip" data-zod="${i}"><span aria-hidden="true">${z[1]}</span>${z[0]}띠</button>`).join('')}
    </div>
    <div class="oneline__out" id="onelineOut" aria-live="polite">
      <span class="oneline__hint">띠를 하나 눌러 보세요 — 1초면 끝납니다.</span>
    </div>
    <div class="oneline__foot">
      <a href="#/free">내 생년월일로 정확히 보기 →</a>
      <span class="dot"></span>
      <a href="#/4p">내 사주 4장 무료로 보기 →</a>
    </div>
    </div>
    </div>
  </section>`;
}
function bindOneline(root){
  const out = $('#onelineOut', root); if (!out) return;
  $$('[data-zod]', root).forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const i = Number(btn.getAttribute('data-zod'));
      $$('[data-zod]', root).forEach(b=>b.classList.remove('is-on'));
      btn.classList.add('is-on');
      let r;
      try { r = buildToday(null, i); } catch(e){ return; }
      const z = ZODIAC[i];
      out.classList.add('is-on');
      out.innerHTML = `
        <div class="oneline__top">
          <span class="oneline__ring" style="--p:${r.score}"><b>${r.score}</b></span>
          <span class="oneline__who"><b>${z[1]} ${z[0]}띠</b><i>${esc(r.oneLine)}</i></span>
        </div>
        <p class="oneline__headline">${esc(r.headline)}</p>
        <div class="oneline__tags">
          <span>행운의 색 <b>${esc(r.luckColor.name)}</b></span>
          <span>숫자 <b>${r.nums.join('·')}</b></span>
          <span>좋은 시간 <b>${esc(r.timeBest)}</b></span>
        </div>
        <p class="oneline__advice">${esc(r.advice)}</p>`;
    });
  });
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

/* ---------- 1면 · 지면 모아보기 (탭 전환) ---------- */
const DESK_TABS = ['today','people','mbti','money','dream','past','shop'];
function latestAcross(n){
  const seen = {};
  return ARTICLES.slice()
    .sort((a,b)=> dayKey(b).localeCompare(dayKey(a)) || num(b.views)-num(a.views))
    .filter(a=>{ if (seen[a.cat]) return false; seen[a.cat]=1; return true; })
    .slice(0, n||4);
}
function deskPanel(id, on){
  let list = (id==='latest') ? latestAcross(12) : byCat(id);
  if (id==='latest'){
    /* 1면 TOP 7에 이미 실린 기사는 ‘오늘의 주요 기사’에서 빼서 같은 그림이 한 화면에 두 번 보이지 않게 한다 */
    const used = {}; top7Pick(7).forEach(a=>{ used[a.id]=1; });
    list = list.filter(a=>!used[a.id]).slice(0, 4);
  }
  const lead = list[0]; if (!lead) return '';
  const rows = list.slice(1, 4);
  const name = (id==='latest') ? '오늘의 주요 기사' : catOf(id).ko;
  return `<div class="desk__panel${on?' is-on':''}" data-panel="${id}">
    <div class="desk__grid">
      <a class="desk-lead" href="#/article/${lead.id}">
        <img src="${IMG(lead.img)}" alt="${esc(lead.title)}" loading="lazy">
        <span class="desk-lead__t">
          <span class="desk-lead__cat">${esc(catOf(lead.cat).ko)}</span>
          <b>${esc(lead.title)}</b>
          <i>${esc(lead.dek)}</i>
        </span>
      </a>
      <ul class="desk-list">
        ${rows.map(a=>`<li><a href="#/article/${a.id}">
          <img src="${IMG(a.img)}" alt="" loading="lazy">
          <span><b>${esc(a.title)}</b><i>${esc(catOf(a.cat).ko)}</i></span>
        </a></li>`).join('')}
      </ul>
    </div>
    <div class="desk__foot">
      ${id==='mbti' ? '<a class="desk-quiz" href="#/free">내 궁합 점수 1분 무료로 보기 →</a>' : ''}
      ${id==='latest' ? '<a href="#/archive">지난 기사 모아보기 →</a>' : `<a href="#/${id}">${esc(name)} 지면 전체 보기 →</a>`}
    </div>
  </div>`;
}
function deskTabs(){
  return `<section class="desk" aria-labelledby="deskTitle">
    <div class="desk__head">
      <h2 id="deskTitle">지면 모아보기</h2>
      <span class="en">SECTIONS</span>
      <span class="desk__note">탭을 눌러 지면을 바꿔 보세요</span>
    </div>
    <div class="desk__tabs" id="deskTabs" role="tablist">
      <button type="button" class="is-on" data-desk="latest">전체</button>
      ${DESK_TABS.map(id=>`<button type="button" data-desk="${id}">${esc(catOf(id).ko)}</button>`).join('')}
    </div>
    <div class="desk__body" id="deskBody">
      ${deskPanel('latest', true)}
      ${DESK_TABS.map(id=>deskPanel(id,false)).join('')}
    </div>
  </section>`;
}
function bindDeskTabs(root){
  const tabs = $$('#deskTabs button', root);
  tabs.forEach(b=>b.addEventListener('click', ()=>{
    tabs.forEach(x=>x.classList.remove('is-on'));
    b.classList.add('is-on');
    const id = b.getAttribute('data-desk');
    $$('.desk__panel', root).forEach(p=>p.classList.toggle('is-on', p.getAttribute('data-panel')===id));
    if (b.scrollIntoView) b.scrollIntoView({block:'nearest', inline:'center', behavior:'smooth'});
  }));
}

/* ---------- 1면 · 매거진 (지면 모아보기 아래 · 2026-11-25 개편) ---------- */
function magPick(p){
  const a = BY_ID[p.id]; if (!a) return null;
  return Object.assign({}, p, { a, img: p.img || a.img });
}
function magLead(p){
  return `<a class="mag-lead" href="#/article/${p.a.id}">
    <span class="mag-lead__shot"><img src="${IMG(p.img)}" alt="${esc(p.hook)}" loading="lazy"><b class="mag-k">${esc(p.kicker)}</b></span>
    <span class="mag-lead__body">
      <b class="mag-lead__ttl">${esc(p.hook)}</b>
      <span class="mag-lead__sum">${esc(p.sum)}</span>
      <span class="mag-lead__more">기사 읽기 →</span>
    </span>
  </a>`;
}
function magMini(p){
  return `<a class="mag-mini" href="#/article/${p.a.id}">
    <span class="mag-mini__shot"><img src="${IMG(p.img)}" alt="" loading="lazy"><b class="mag-k">${esc(p.kicker)}</b></span>
    <span class="mag-mini__body"><b>${esc(p.hook)}</b><span>${esc(p.sum)}</span></span>
  </a>`;
}
function magGridCard(p){
  return `<a class="mag-card" href="#/article/${p.a.id}">
    <span class="mag-card__shot"><img src="${IMG(p.img)}" alt="" loading="lazy"><b class="mag-k">${esc(p.kicker)}</b></span>
    <b class="mag-card__ttl">${esc(p.hook)}</b>
    <span class="mag-card__sum">${esc(p.sum)}</span>
  </a>`;
}
function magazineBlock(){
  if (typeof MAG_FEATURED === 'undefined') return '';
  const feat = MAG_FEATURED.map(magPick).filter(Boolean);
  const grid = MAG_GRID.map(magPick).filter(Boolean);
  if (!feat.length && !grid.length) return '';
  const lead = feat[0], side = feat.slice(1, 3);
  return `<section class="mag" aria-labelledby="magTitle">
    <div class="mag__head">
      <h2 id="magTitle">정운 매거진</h2>
      <span class="en">MAGAZINE</span>
      <span class="mag__note">재미로 읽다 보면, 결국 내 사주가 궁금해집니다</span>
    </div>
    <div class="mag__top">
      ${lead ? magLead(lead) : ''}
      <div class="mag__side">${side.map(magMini).join('')}</div>
    </div>
    ${grid.length ? `<div class="mag__grid">${grid.map(magGridCard).join('')}</div>` : ''}
  </section>`;
}

/* ---------- 1면 · 사주 8컷 (SVG 만화) ---------- */
function comicBlock(){
  if (typeof COMIC === 'undefined' || !COMIC.cuts) return '';
  return `<section class="comic" id="comic" aria-labelledby="comicTitle">
    <div class="comic__head">
      <span class="comic__k">8컷 만화 · 오늘의 사주</span>
      <h2 id="comicTitle">${esc(COMIC.title)}</h2>
      <p>${esc(COMIC.dek)}</p>
    </div>
    <div class="comic__grid">
      ${COMIC.cuts.map(c=>`<article class="cut">
        <div class="cut__art"><svg viewBox="0 0 320 182" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(c.ttl)}">${c.art}</svg><b class="cut__no">${c.no}</b></div>
        <div class="cut__body">
          <b class="cut__ttl">${esc(c.ttl)}</b>
          <span class="cut__sig">${esc(c.sig)}</span>
        </div>
      </article>`).join('')}
    </div>
    <div class="comic__foot">
      <span>내 사주에서는 이 신호가 언제 오는지 — 생년월일 하나면 네 장으로 확인됩니다.</span>
      <a class="btn btn--ink" href="#/4p">내 사주 4장 무료로 보기 →</a>
    </div>
    <p class="comic__note">※ 8컷 만화는 전통 명리학의 상징을 이야기로 풀어낸 창작물입니다. 실제 인물·사건과 무관하며, 미래의 결과를 보장하지 않습니다.</p>
  </section>`;
}

/* ---------- 1면 · 사주 미니게임 (2027 대박 달 3개 뽑기) ---------- */
let GAME_LIST = [];
function shuffleAll(a){
  for (let i=a.length-1; i>0; i--){ const j = Math.floor(Math.random()*(i+1)); const t=a[i]; a[i]=a[j]; a[j]=t; }
  return a;
}
function gameCardsHTML(){
  return GAME_LIST.map((c,i)=>`<button type="button" class="gcard" data-gcard="${i}" aria-pressed="false" aria-label="${i+1}번째 카드 뒤집기">
    <span class="gcard__in">
      <span class="gcard__back" aria-hidden="true"><em>月</em><b>?</b></span>
      <span class="gcard__front" aria-hidden="true"><b>${c.m}</b><i>월</i><em>${esc(c.key)}</em></span>
    </span>
  </button>`).join('');
}
function gameBlock(){
  if (typeof GAME_MONTHS === 'undefined') return '';
  GAME_LIST = shuffleAll(GAME_MONTHS.slice());
  return `<section class="game" id="game" aria-labelledby="gameTitle">
    <div class="game__main">
      <div class="game__head">
        <span class="game__k">MINI GAME · 무료</span>
        <h2 id="gameTitle">2027 내 대박 달 3개 뽑기</h2>
        <p>카드 12장 가운데 손이 가는 3장을 뒤집어 보세요. 정미년의 열두 달 중 당신의 달이 나옵니다.</p>
      </div>
      <div class="game__board" id="gameBoard">${gameCardsHTML()}</div>
    </div>
    <div class="game__panel" id="gamePanel" aria-live="polite">
      <span class="game__hint">카드를 세 장 골라 주세요 — 망설여지는 순서대로.</span>
      <ul class="game__how">
        <li>12장 중 <b>3장</b>을 뒤집으면 결과가 나옵니다.</li>
        <li>2027년은 정미년(丁未年) — 불이 흙을 낳는 해입니다.</li>
        <li>마음에 걸린 달은 <b>무료 4P</b>에서 내 사주로 다시 확인하세요.</li>
      </ul>
    </div>
  </section>`;
}
function bindGame(root){
  const board = $('#gameBoard', root), panel = $('#gamePanel', root);
  if (!board || !panel || !GAME_LIST.length) return;
  let picked = [];
  const hint = ()=>{
    const left = 3 - picked.length;
    panel.className = 'game__panel';
    panel.innerHTML = `<span class="game__hint">${picked.length ? `고른 달 — ${picked.map(c=>c.m+'월').join(' · ')} <b>${left}장 남았습니다.</b>` : '카드를 세 장 골라 주세요 — 망설여지는 순서대로.'}</span>`
      + `<ul class="game__how">
        <li>12장 중 <b>3장</b>을 뒤집으면 결과가 나옵니다.</li>
        <li>2027년은 정미년(丁未年) — 불이 흙을 낳는 해입니다.</li>
        <li>마음에 걸린 달은 <b>무료 4P</b>에서 내 사주로 다시 확인하세요.</li>
      </ul>`;
  };
  const result = ()=>{
    const ms = picked.slice().sort((a,b)=>a.m-b.m);
    const counts = {};
    ms.forEach(c=>{ counts[c.el] = (counts[c.el]||0)+1; });
    const topEl = Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
    const color = GAME_COLORS[ms.reduce((s,c)=>s+c.m, 0) % GAME_COLORS.length];
    const best = ms.slice().sort((a,b)=> (b.pow||0)-(a.pow||0) || a.m-b.m)[0];
    panel.className = 'game__panel is-on';
    panel.innerHTML = `<span class="game__k">2027 정미년 · 당신의 세 달</span>
      <b class="game__picks">${ms.map(c=>`<i>${c.m}<em>월</em></i>`).join('<span>·</span>')}</b>
      <p class="game__line">가장 크게 열리는 달은 <b>${best.m}월</b> — ${esc(best.line)}</p>
      <div class="game__tags">
        <span>기운 <b>${esc(topEl)}</b></span>
        <span>행운의 색 <b>${esc(color.name)}</b><i class="swatch" style="background:${color.hex}"></i></span>
        <span>키워드 <b>${esc(ms.map(c=>c.key).join(' · '))}</b></span>
      </div>
      <div class="game__btns">
        <a class="btn btn--ink" href="#/4p">내 사주로 무료 4장 보기 →</a>
        <a class="btn btn--gold" href="${ORDER}" target="_blank" rel="noopener">정밀분석 30~100P</a>
      </div>
      <button class="game__again" type="button" data-game-reset>다시 뽑기 ↺</button>
      <p class="game__note">재미로 보는 2027 월운입니다. 내 사주의 실제 월운은 생년월일을 넣어 확인하세요.</p>`;
  };
  board.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-gcard]');
    if (!btn || btn.classList.contains('is-open') || picked.length >= 3) return;
    const c = GAME_LIST[Number(btn.getAttribute('data-gcard'))];
    if (!c) return;
    btn.classList.add('is-open');
    btn.setAttribute('aria-pressed', 'true');
    picked.push(c);
    if (picked.length === 3) setTimeout(result, 480); else hint();
  });
  panel.addEventListener('click', (e)=>{
    if (!e.target.closest('[data-game-reset]')) return;
    picked = [];
    GAME_LIST = shuffleAll(GAME_MONTHS.slice());
    board.innerHTML = gameCardsHTML();
    hint();
  });
}

function strip4p(){
  return `<a class="strip4p" href="#/4p">
    <span class="strip4p__l">
      <span class="strip4p__tag">FREE · 4P</span>
      <b>내 사주로 읽는 <em>네 장</em></b>
      <span class="strip4p__p">타고난 본성 · 돈이 새는 습관 · 인연의 결 · 2027년 가장 큰 변화. 생년월일만 넣으면 지금 바로, 무료입니다.</span>
    </span>
    <span class="strip4p__go">무료로 4장 열기 →</span>
  </a>`;
}

/* ---------- 메인 ---------- */
function viewHome(){
  return `
  ${rankBlock()}
  ${onelineBlock()}
  ${programBanner()}
  ${deskTabs()}
  ${magazineBlock()}
  ${comicBlock()}
  ${gameBlock()}
  ${strip4p()}`;
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
          <b class="plan__name">무료 4P 맛보기</b>
          <div class="plan__price"><b>무료</b><span>4장</span></div>
          <p>본성·돈·인연의 첫 문장. 네 장.</p>
          <a class="btn btn--ghost btn--block" href="#/4p">4P 바로 보기</a>
        </div>
        <div class="plan">
          <span class="plan__tag">정밀 분석지</span>
          <b class="plan__name">30P · 60P · 100P</b>
          <div class="plan__price"><b>19,900</b><span>원부터</span></div>
          <p>운명의 나침반 30P · 지도 60P · 마스터 플랜 100P.</p>
          <a class="btn btn--ghost btn--block" href="${LANDING}" target="_blank" rel="noopener">정밀분석 보기</a>
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
      <p class="prog-flow__note"><b>결제 안내</b> — 현재 카드결제(PG) 연동 전입니다. 그래서 1년 이용권 신청과 결제는 카카오채널 1:1 상담으로 안내드리고, 결제 확인 후 프로그램 파일과 이용권 코드를 보내드립니다. 무료 4P는 이 사이트에서 바로 넘겨 볼 수 있고, 30P·60P·100P 정밀분석지는 정밀분석 페이지에서 진행됩니다. 환불·이용 조건은 결제 전 상담에서 안내드립니다.</p>
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
        <details><summary>미리보기에서 직접 입력해 볼 수는 없나요?</summary><p>미리보기는 실제 화면 3장만 보여 드립니다. 명식을 직접 입력해 보는 것은 1년 이용권을 받은 뒤 가능합니다. 내 사주를 글로 먼저 읽고 싶다면 무료 4P부터 보세요.</p></details>
        <details><summary>결제는 어떻게 하나요?</summary><p>지금은 카드결제 연동 전이라 카톡 1:1 상담으로 신청과 결제를 안내합니다. 무료 4P는 사이트에서 바로 보고, 정밀분석지 주문은 주문 페이지에서 진행됩니다.</p></details>
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
        <a class="btn btn--gold btn--block" href="${LANDING}" target="_blank" rel="noopener">정밀분석 보러가기 →</a>
      </div>
    </aside>
  </div>`;
}

/* ---------- 기사 상세 ---------- */
function bodyHTML(blocks){
  return blocks.map(b=>{
    if (b.t==='h') return `<h3>${b.x}</h3>`;
    if (b.t==='q') return `<div class="quote">${b.x}</div>`;
    if (b.t==='cta') return `<div class="artcta">
      <b class="artcta__t">${b.x||'내 사주에도 이 기운이 있을까?'}</b>
      <p class="artcta__s">${b.y||'생년월일 하나면 네 장이 바로 열립니다. 무료입니다.'}</p>
      <div class="artcta__btns">
        <a class="btn btn--red" href="#/4p">🔥 내 사주 4P 무료로 열기</a>
        <a class="btn btn--gold" href="${ORDER}" target="_blank" rel="noopener">2027 정밀분석 보기</a>
      </div>
      <span class="artcta__n">무료 4P → 본성 · 돈 · 인연 · 2027 &nbsp;|&nbsp; 정밀분석 30P 19,900원부터</span>
    </div>`;
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
      <figcaption>${esc(cat.ko)} 지면 이미지 · 운명사주 정운타임즈 아카이브</figcaption>
    </figure>
    <div class="art__body">${bodyHTML(a.body)}</div>
    <div class="tagrow">
      ${['사주','운세','명리','운명사주 정운타임즈',cat.ko].map(t=>`<a href="#/${a.cat}">#${esc(t)}</a>`).join('')}
    </div>

    <div class="funnel">
      <div class="funnel__ttl">재밌게 보셨나요?<br>내 운명도 지금 바로 확인해 보세요!</div>
      <p class="funnel__sub">생년월일 하나면 오늘의 기운부터 4페이지 분석까지. 결제 없이 먼저 확인할 수 있습니다.</p>
      <div class="funnel__btns">
        <a class="btn btn--ink" href="#/free">무료 사주·운세 바로 분석하기</a>
        <a class="btn btn--red" href="#/4p">🔥 무료 4P 맛보기 (내 사주로 바로)</a>
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
        <a class="btn btn--ghost" href="#/4p">무료 4P</a>
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
        <p class="funnel__sub">4P 맛보기로 이어서 보시겠어요? 무료 4P에서 내 본성·돈·인연·2027년이 열립니다.</p>
        <div class="funnel__btns">
          <a class="btn btn--red" href="#/4p">🔥 무료 4P 맛보기 바로 보기</a>
          <a class="btn btn--gold" href="${LANDING}" target="_blank" rel="noopener">30P·60P·100P 정밀분석</a>
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
        <span class="promo__tag">FREE · 4P</span>
        <h4>4페이지 분석지<br>지금 바로 넘겨보기</h4>
        <p>본성 → 돈 → 인연 → 2027, 네 장</p>
        <a class="btn btn--gold btn--block" href="#/4p">4P 열기 →</a>
      </div>
    </aside>
  </div>`;
}

/* ---------- 4P 뷰어 (무료 4장 · 내 사주로 바로) ---------- */
const FOURP = { file:'4p/04.html', title:'내 사주 4장' };
function view4P(){
  const src = FOURP.file + (window.__fourpQuery ? '?' + window.__fourpQuery : '');
  return `
  <div class="fourp-head">
    <div class="kicker">FREE · 4P 맛보기</div>
    <h1>내 사주로 읽는 <em>네 장</em></h1>
    <p>타고난 본성 · 돈이 새는 습관 · 인연의 결 · 2027년 가장 큰 변화. 생년월일만 넣으면 바로 나오고, <b>결제는 없습니다</b>.</p>
  </div>
  <div class="fourp-me">
    <div class="fourp-me__t"><b>생년월일 넣고 4장 열기</b><span>실제 만세력 엔진이 내 여덟 글자로 씁니다 · 입력값은 서버로 가지 않습니다</span></div>
    <form id="fourpMe" autocomplete="off">
      <div class="fourp-me__row">
        <label>이름 (없으면 비워도 됩니다)<input type="text" id="fmName" maxlength="20" placeholder="김하늘"></label>
        <label>성별<select id="fmGender"><option value="여">여성</option><option value="남">남성</option></select></label>
        <label>달력<select id="fmCal"><option value="solar">양력</option><option value="lunar">음력</option></select></label>
      </div>
      <div class="fourp-me__row">
        <label>생년월일<input type="date" id="fmBirth" min="1900-01-01" max="2026-12-31"></label>
        <label>시각 (모르면 비움)<input type="time" id="fmTime"></label>
        <button class="btn btn--gold" type="submit">무료로 4장 열기 →</button>
      </div>
      <p class="fourp-me__note" id="fmNote">넣은 값은 이 브라우저 안에서만 계산됩니다. 지면이 내 여덟 글자로 다시 그려집니다.</p>
    </form>
  </div>
  <div class="fourp-stage">
    <div class="fourp-main">
      <div class="fourp-sheet">
        <iframe id="fourpFrame" src="${src}" title="무료 4P 맛보기 — ${esc(FOURP.title)}" loading="lazy"></iframe>
      </div>
      <div class="fourp-actions">
        <a class="btn btn--ghost" href="${src}" target="_blank" rel="noopener" id="fourpOpen">새 창에서 크게 보기</a>
        <a class="btn btn--ghost" href="${src}" target="_blank" rel="noopener" id="fourpPrint">인쇄용으로 열기</a>
      </div>
    </div>
    <aside class="fourp-side">
      <div class="side-card">
        <h4>이렇게 보세요</h4>
        <ol>
          <li>생년월일을 넣고 <b>무료로 4장 열기</b>를 누르면 지면이 내 여덟 글자로 바뀝니다.</li>
          <li>본성 → 돈 → 인연 → 2027, 네 장을 끝까지 읽습니다.</li>
          <li>마지막 장에서 2027년 정밀 분석지로 바로 이어집니다.</li>
        </ol>
      </div>
      <div class="side-card side-card--dark">
        <h4 style="color:#f0e2c4">네 장으로 부족했다면</h4>
        <p>같은 여덟 글자로 30장을 씁니다. 조심할 달과 해야 할 일까지.</p>
        <div class="pricepills">
          ${PRICING.map(p=>`<div><span>${esc(p.pages)} · ${esc(p.name)}</span><b>${esc(p.price)}</b></div>`).join('')}
        </div>
        <a class="btn btn--gold btn--block" href="${ORDER}" target="_blank" rel="noopener" id="fourpOrder">👉 내 2027년 정밀 분석지 받기</a>
      </div>
      <div class="side-card">
        <h4>전체 화면으로 보기</h4>
        <p>휴대폰에서는 ‘홈 화면에 추가’로 앱처럼 열 수 있습니다. PC에서는 새 창으로 열면 지면이 원본 크기로 선명하게 보입니다.</p>
        <a class="btn btn--ink btn--block" href="${src}" target="_blank" rel="noopener">4P 원본 열기</a>
      </div>
    </aside>
  </div>`;
}
/* 4P 지면(같은 출처)의 실제 높이에 iframe을 맞춘다 — 폰 액자 안 이중 스크롤을 없앤다 */
function fitFourp(frame){
  try{
    const d = frame.contentDocument;
    if (!d || !d.documentElement) return;
    const h = Math.max(560, (d.documentElement.scrollHeight || 0) + 14, ((d.body && d.body.scrollHeight) || 0) + 14);
    if (h > 200) frame.style.height = h + 'px';
  }catch(e){ /* 출처가 다르면 그냥 둔다 */ }
}
function watchFourp(frame){
  const sync = ()=>{
    fitFourp(frame);
    try{
      const d = frame.contentDocument;
      if (d && d.body && window.MutationObserver){
        if (frame.__mo) frame.__mo.disconnect();
        const mo = new MutationObserver(()=>fitFourp(frame));
        mo.observe(d.body, { childList:true, subtree:true, characterData:true });
        frame.__mo = mo;
      }
    }catch(e){}
  };
  frame.addEventListener('load', ()=>{ sync(); [300, 900, 1800, 3000].forEach(t=>setTimeout(()=>fitFourp(frame), t)); });
  setTimeout(sync, 400);
}
function bind4P(root){
  const frame = $('#fourpFrame', root);
  if (frame) watchFourp(frame);
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
    if (frame) frame.src = frame.getAttribute('src').split('?')[0] + '?' + lastFourpQuery;
    /* 주문 링크는 order.html 이 읽는 형식으로 따로 만든다(?name&birth&time&gender&cal) */
    const oq = new URLSearchParams();
    if (name) oq.set('name', name);
    oq.set('birth', birth);
    oq.set('time', time ? time : '모름');
    oq.set('gender', gender === '남' ? '남' : '여');
    oq.set('cal', cal === 'lunar' ? 'lunar' : 'solar');
    const orderUrl = ORDER + '?' + oq.toString();
    const open = $('#fourpOpen', root), pr = $('#fourpPrint', root), od = $('#fourpOrder', root);
    if (open) open.href = open.getAttribute('href').split('?')[0] + '?' + lastFourpQuery;
    if (pr) pr.href = pr.getAttribute('href').split('?')[0] + '?' + lastFourpQuery;
    if (od) od.href = orderUrl;
    if (note) note.innerHTML = '<b>내 여덟 글자로 다시 계산했습니다.</b> 아래 지면에서 1장부터 읽어 보세요.';
    if (frame) setTimeout(()=>{ try{ frame.scrollIntoView({behavior:'smooth', block:'start'}); }catch(e){} }, 300);
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
/* 지면에 싣는 articles-daily.js 는 최근 45일만. 그 이전 호는 data/articles.json 에서 한 번만 불러와 합친다. */
let ARCHIVE_FULL = null, ARCHIVE_LOADING = false, ARCHIVE_FAILED = false;
function loadFullArchive(){
  if (ARCHIVE_FULL || ARCHIVE_LOADING) return;
  ARCHIVE_LOADING = true;
  fetch('data/articles.json', {cache:'no-store'}).then(r=>r.json()).then(j=>{
    const list = Array.isArray(j) ? j : (j.articles || []);
    const have = {}; ARTICLES.forEach(a=>{ have[a.id]=1; });
    let added = 0;
    list.forEach(a=>{ if (a && a.id && !have[a.id]){ ARTICLES.push(a); BY_ID[a.id]=a; have[a.id]=1; added++; } });
    ARTICLES.sort((a,b)=> String(b.date||'').localeCompare(String(a.date||'')) || num(b.views)-num(a.views));
    ARCHIVE_FULL = list; ARCHIVE_LOADING = false;
    if ((location.hash||'').indexOf('#/archive')===0) render();
  }).catch(()=>{ ARCHIVE_LOADING = false; ARCHIVE_FAILED = true; });
}
function archiveGroups(){
  const daily = ARTICLES.filter(a=>a.date);
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
      <h1>운명사주 정운타임즈 지난 호</h1>
      <p>매일 05:30 새 호가 발행되고, 지난 호는 <b>최근 365일 · 최대 2,600편</b>까지 이곳에 쌓입니다. 지금 ${groups.length}일치 ${total}편이 보입니다.</p>
    </div>
    <a class="btn btn--ink" href="#/4p">무료 4P 보기</a>
  </div>
  <div class="arch-filter" id="archFilter">
    <button type="button" class="is-on" data-af="">전체 ${total}</button>
    ${cats.map(c=>`<button type="button" data-af="${esc(c)}">${esc(catOf(c).ko)} ${groups.reduce((n,g)=>n+g.items.filter(a=>a.cat===c).length,0)}</button>`).join('')}
  </div>
  <p class="arch-load" style="font-size:12px;color:#8b8378;margin:6px 0 0">
    ${ARCHIVE_FULL ? '전체 아카이브를 모두 불러왔습니다.' : (ARCHIVE_FAILED ? '지난 호 전체를 불러오지 못했습니다. 지면에 실린 최근 호만 보입니다.' : '지난 호 전체를 불러오는 중… 아래는 최근 호입니다.')}
  </p>
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
          <span class="arch-meta">${esc(a.writer||'운명사주 정운타임즈')} · ${esc(a.time||'05:30')}</span>
        </a></li>`).join('')}
      </ul>
    </div>`).join('')}
  </div>
  <div class="funnel" style="margin-top:26px">
    <div class="funnel__ttl">지난 호를 읽다 보면, 내 사주가 궁금해집니다.</div>
    <p class="funnel__sub">생년월일시를 넣으면 지금 이 지면의 기준으로 내 여덟 글자를 계산합니다.</p>
    <div class="funnel__btns">
      <a class="btn btn--red" href="#/4p">🔥 무료 4P 맛보기 바로 보기</a>
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
  // 예전에 공유된 4종 링크(#/4p/v1~v3)는 하얀 지면 단일 버전으로 정리한다.
  if (r.view==='4p' && /^#\/4p\/v[0-9]/.test(location.hash || '')){
    try { history.replaceState(null, '', '#/4p'); } catch (e) { /* 구형 브라우저 무시 */ }
  }
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
  else if (r.view==='4p') html = view4P();
  else if (r.view==='archive') html = viewArchive();
  app.innerHTML = html;
  app.classList.remove('fade'); void app.offsetWidth; app.classList.add('fade');
  bindWidget(app);
  bind4P(app);
  if (r.view==='home'){ bindOneline(app); bindDeskTabs(app); bindGame(app); }
  if (r.view==='free') bindFree(app);
  if (r.view==='archive'){ bindArchive(app); loadFullArchive(); }
  if (r.view==='article') bindShare(app, r.id);
  const a = (r.view==='article') ? BY_ID[r.id] : null;
  const cat = (r.view==='section') ? catOf(r.cat) : null;
  document.title = a ? `${a.title} | ${BRAND.name}`
    : cat ? `${cat.ko} | ${BRAND.name}`
    : (r.view==='archive' ? `지난 기사 모아보기 | ${BRAND.name}`
    : (r.view==='4p' ? `무료 4P 맛보기 — 내 사주로 읽는 네 장 | ${BRAND.name}`
    : (r.view==='program' ? `사주분석 프로그램 · 1년 이용권 | ${BRAND.name}` : '운명사주 정운타임즈 | 운명사주, 정운이 풀다')));
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
      <a class="btn btn--ghost" href="#/4p" data-close-program>무료 4P 먼저 보기</a>
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
    <p class="preview-note">화면은 정식 프로그램의 실제 화면입니다. 명식을 직접 입력해 보는 것은 1년 이용권을 받은 뒤 가능합니다. 내 사주를 글로 먼저 읽고 싶다면 무료 4P부터 보세요.</p>
    <div class="paybox__btns">
      <button class="btn btn--gold" type="button" data-program-buy="year">1년 이용권 문의 →</button>
      <a class="btn btn--ghost" href="#/4p" data-close-preview>무료 4P 먼저 보기</a>
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
  /* 설치 시트는 휴대폰에서만 — PC 방문자에게는 본문을 가리지 않는다 */
  const phone = window.matchMedia('(max-width: 820px)').matches;
  if (!isStandalone() && !quiet && phone) setTimeout(openSheet, 1000);
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
    const t = $('#toast'); if (t){ t.textContent='운명사주 정운타임즈가 설치되었습니다. 홈 화면에서 열어 보세요.'; t.classList.add('is-on'); setTimeout(()=>t.classList.remove('is-on'), 3200); }
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
