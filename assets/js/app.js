/* ============================================================================
   정운타임즈 · app.js — 라우터 · 지면 렌더 · 오늘의 운세 · 4P 뷰어 · PWA
   ========================================================================== */
'use strict';

const ARTICLES = [].concat(ARTICLES_1, ARTICLES_2, ARTICLES_3);

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
const byCat = (id)=> inCat(id).slice().sort((a,b)=> (b.top?1:0)-(a.top?1:0) || num(b.views)-num(a.views));
const dateStr = (a)=>{ const d=(a.date||'2026-11-22').split('-'); return `${d[0]}.${d[1]}.${d[2]}. ${a.time||'06:00'}`; };

/* ---------- 상단 ---------- */
function renderTicker(){
  const track = $('#tickerTrack'); if (!track) return;
  const one = TICKER.map(t=>`<span class="ticker__item"><b>${esc(t.cat)}</b>${esc(t.text)}</span>`).join('');
  track.innerHTML = one + one;
}
function renderTabs(active){
  const nav = $('#tabsIn'); if (!nav) return;
  nav.innerHTML = CATS.map(c=>{
    const on = (c.id===active) ? ' is-active' : '';
    const hot = (c.id==='mbti'||c.id==='today') ? '<span class="hot">NEW</span>' : '';
    return `<a class="tab${on}${c.point?' tab--point':''}" href="${c.route}">${c.ko}${c.point?'':hot}</a>`;
  }).join('');
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

/* ---------- 메인 ---------- */
function viewHome(){
  const lead = BY_ID['mbti-main'];
  const trio = [BY_ID['today-1122'], BY_ID['money-timing'], BY_ID['dream-moon']];
  const mid = [BY_ID['past-musician'], BY_ID['people-stage'], BY_ID['shop-turtle'], BY_ID['lab-49'],
               BY_ID['mbti-tf'], BY_ID['money-people'], BY_ID['dream-animal'], BY_ID['today-week']];
  const top7 = ARTICLES.slice().sort((a,b)=> (b.top?1:0)-(a.top?1:0) || num(b.views)-num(a.views)).slice(0,7);

  const sections = ['mbti','today','money','dream','past','people','shop','lab'].map(cid=>{
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
  <div class="home-top">
    <article class="lead">
      <a class="lead__media" href="#/article/${lead.id}">
        <span class="kicker">1면 톱 · ${esc(catOf(lead.cat).ko)}</span>
        <img src="${IMG(lead.img)}" alt="${esc(lead.title)}">
      </a>
      <div class="lead__body">
        <a href="#/article/${lead.id}"><h1 class="lead__title">${esc(lead.title)}</h1></a>
        <p class="lead__dek">${esc(lead.dek)}</p>
        <div class="meta"><b>${esc(lead.writer)}</b><span class="dot"></span><span>입력 ${dateStr(lead)}</span><span class="dot"></span><span>조회 ${num(lead.views)}</span></div>
      </div>
    </article>
    <aside class="home-top__rail">
      <div class="widget">${widgetMarkup('home')}</div>
      <a class="talk" href="${KAKAO}" target="_blank" rel="noopener">
        <span class="talk__ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 3C6.5 3 2 6.5 2 10.8c0 2.9 1.9 5.4 4.6 6.8-.4.8-1 2.8-1.6 3.9-.4.7.1 1 .8.7 2-.8 4.2-2 5.5-2.8.5.1 1 .1 1.6.1 5.5 0 10-3.5 10-7.8C22 6.5 17.5 3 12 3Z" fill="#231f20"/></svg></span>
        <span><b>카톡 1:1 상담</b><span>정운이 직접 답합니다 · 평일 10~19시</span></span>
      </a>
    </aside>
  </div>

  <div class="trio">${trio.map(a=>thumbCard(a)).join('')}</div>

  <div class="home-mid">
    <div>
      <div class="sec-head">
        <div class="sec-head__l"><h2>주요 뉴스</h2><span class="en">LATEST</span></div>
        <a class="sec-head__more" href="#/today">전체 기사 →</a>
      </div>
      <div class="newslist">${mid.map(listItem).join('')}</div>
    </div>
    <aside class="rail">
      <div class="panel">
        <div class="panel__head"><h3>Top 7 인기뉴스</h3><span>RANKING</span></div>
        <ol class="top7">
          ${top7.map((a,i)=>`<li><a href="#/article/${a.id}">
            <span class="num">${i+1}</span>
            <span><span class="cat">${esc(catOf(a.cat).ko)}</span><span class="tt">${esc(a.title)}</span></span>
          </a></li>`).join('')}
        </ol>
      </div>
      <div class="promo">
        <span class="promo__tag">990원 SPECIAL</span>
        <h4>4페이지로 먼저 확인하는<br>내 운명의 맛보기</h4>
        <p>5장 정밀판·3장 요약판까지 4가지 버전. 지금 지면에서 바로 넘겨 보세요.</p>
        <div class="promo__price"><b>990</b><span>원 · 4P 분석지</span></div>
        <a class="btn btn--gold btn--block" href="#/4p">4P 바로 보기 →</a>
      </div>
      <a class="talk" href="${AURA}" target="_blank" rel="noopener">
        <span class="talk__ico" style="background:#171513"><span style="font-family:var(--serif);color:#c9a86a;font-size:13px">正</span></span>
        <span><b>30P · 60P · 100P 정밀분석</b><span>19,900원부터 · 만족도 최상위</span></span>
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
    <a class="btn btn--ink" href="#/free">무료로 내 운세 보기</a>
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
      <p class="funnel__note">4P 마지막 페이지에서 정밀 전문분석지(30P·60P·100P)로 바로 이어집니다. 모든 분석은 참고·오락 정보입니다.</p>
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
function viewToday(){
  const main = BY_ID['today-1122'];
  return `
  <div class="today-hero">
    <div>
      <div class="kicker">DAILY FORTUNE · ${esc(TODAY_LABEL||'')}</div>
      <h1 class="today-title">오늘, 내 기운은<br>어디로 흐르는가</h1>
      <div class="today-ganji"><b>丙午年 · 己亥月 · 庚子日</b><span>소설(小雪) 지나 대설(大雪)로</span></div>
      <p class="deck">${esc(main.dek)}</p>
      <div class="meta" style="margin-top:10px"><b>${esc(main.writer)}</b><span class="dot"></span><span>매일 05:30 갱신</span></div>
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
  const today = BY_ID['today-1122'];
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
  <div class="fourp-tabs">
    ${FOURP.map((f,i)=>`<button type="button" data-4p="${i}" class="${i===idx?'is-on':''}">${f.title}</button>`).join('')}
  </div>
  <div class="fourp-meta">
    <span>현재: ${esc(cur.title)}</span><span>·</span><span>${esc(cur.note)}</span>
  </div>
  <div class="fourp-stage">
    <div>
      <div class="phone">
        <iframe id="fourpFrame" src="${cur.file}" title="990원 4P 분석지 ${esc(cur.title)}" loading="lazy"></iframe>
      </div>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:14px;flex-wrap:wrap">
        <a class="btn btn--ghost" href="${cur.file}" target="_blank" rel="noopener" id="fourpOpen">새 창에서 크게 보기</a>
        <a class="btn btn--ghost" href="${cur.file}" target="_blank" rel="noopener">인쇄용으로 열기</a>
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
}

/* ---------- 라우터 ---------- */
function parseHash(){
  const h = (location.hash || '#/').replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean);
  if (!parts.length) return { view:'home' };
  if (parts[0]==='article' && parts[1]) return { view:'article', id:parts[1] };
  if (parts[0]==='4p'){
    const v = parts[1] && parts[1].startsWith('v') ? Number(parts[1].slice(1)) : 0;
    return { view:'4p', v: v||0 };
  }
  if (parts[0]==='fourp_talk') return { view:'4p', v:0 };
  if (parts[0]==='free') return { view:'free' };
  if (parts[0]==='today') return { view:'today' };
  const cat = CATS.find(c=>c.id===parts[0]);
  if (cat && cat.id!=='main') return { view:'section', cat:cat.id };
  return { view:'home' };
}
function render(){
  const r = parseHash();
  const app = $('#app');
  renderTabs(r.view==='home' ? 'main' : (r.view==='section' ? r.cat : (r.view==='4p' ? 'fourp' : (r.view==='today' ? 'today' : (r.view==='free' ? 'free' : (r.view==='article' ? BY_ID[r.id]?.cat : 'main'))))));
  let html='';
  if (r.view==='home') html = viewHome();
  else if (r.view==='section') html = viewSection(r.cat);
  else if (r.view==='article') html = viewArticle(r.id);
  else if (r.view==='today') html = viewToday();
  else if (r.view==='free') html = viewFree();
  else if (r.view==='4p') html = view4P(r.v);
  app.innerHTML = html;
  app.classList.remove('fade'); void app.offsetWidth; app.classList.add('fade');
  bindWidget(app);
  bind4P(app);
  if (r.view==='free') bindFree(app);
  if (r.view==='article') bindShare(app, r.id);
  const a = (r.view==='article') ? BY_ID[r.id] : null;
  const cat = (r.view==='section') ? catOf(r.cat) : null;
  document.title = a ? `${a.title} | ${BRAND.name}` : cat ? `${cat.ko} | ${BRAND.name}` : '정운타임즈 | 운명사주, 정운이 풀다';
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
  window.addEventListener('beforeinstallprompt', (e)=>{
    e.preventDefault(); deferredPrompt = e;
    $$('[data-install]').forEach(b=>{ b.style.display='inline-flex'; });
  });
  window.addEventListener('appinstalled', ()=>{
    deferredPrompt = null;
    document.body.classList.add('installed');
    $$('[data-install]').forEach(b=> b.style.display='none');
    const t = $('#toast'); if (t){ t.textContent='정운타임즈가 설치되었습니다. 홈 화면에서 열어 보세요.'; t.classList.add('is-on'); setTimeout(()=>t.classList.remove('is-on'), 3200); }
  });
  $$('[data-install]').forEach(b=>{
    b.addEventListener('click', async ()=>{
      if (deferredPrompt){
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome !== 'accepted') showInstallGuide();
        deferredPrompt = null;
      } else {
        showInstallGuide();
      }
    });
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
  renderTicker(); renderMastDate(); setupNav(); setupPWA();
  render();
});
window.addEventListener('hashchange', render);
