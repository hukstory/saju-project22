/* ============================================================================
   정운타임즈 · app.js — 매거진 포털 라우터 · 6개 코너 · 공유 카드
   ========================================================================== */
'use strict';

/* ---------- 0. 유틸 ---------- */
const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const nf = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const STORE = {
  get(k, d){ try { const v = localStorage.getItem('jw.' + k); return v ? JSON.parse(v) : d; } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem('jw.' + k, JSON.stringify(v)); } catch(e){} }
};
let toastTimer = null;
function toast(msg){
  const t = $('#toast');
  t.textContent = msg; t.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-on'), 2600);
}
function todayShort(){
  return `${NOW.y}.${String(NOW.m).padStart(2,'0')}.${String(NOW.d).padStart(2,'0')}`;
}
function dateLabelOf(b){
  if (!b) return '';
  return `${b.y}.${String(b.m).padStart(2,'0')}.${String(b.d).padStart(2,'0')}`;
}
function parseBirth(val){
  if (!val) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(val);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (y < 1900 || y > NOW.y) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() + 1 !== mo || dt.getUTCDate() !== d) return null;
  return { y, m:mo, d };
}
function birthOfForm(form){
  const v = form.querySelector('[name="birth"]');
  return parseBirth(v ? v.value : '');
}
const AGE_MAX = `${NOW.y}-${String(NOW.m).padStart(2,'0')}-${String(NOW.d).padStart(2,'0')}`;

/* ---------- 1. 헤더 · 내비 ---------- */
function navHTML(){
  const r = currentRoute();
  return COVERS.map(c => `<a class="navitem${r === c.id ? ' is-on' : ''}" href="${c.route}"><em>${c.no}</em>${c.ko}</a>`).join('')
    + `<a class="navitem navitem--lab${r === 'lab' ? ' is-on' : ''}" href="#/#lab"><em>+</em>운명연구소</a>`;
}
function initHeader(){
  $('#barDate').textContent = `${NOW.y}.${String(NOW.m).padStart(2,'0')}.${String(NOW.d).padStart(2,'0')} (${WD[NOW.wd]})`;
  $('#barGanji').textContent = `${TODAY_YEAR.hanja}年 · ${TODAY_MONTH.hanja}月 · ${TODAY_DAY.hanja}日`;
  $('#barIssue').textContent = `VOL. ${String(ISSUE_NO).padStart(2, '0')}`;
  const burger = $('#burger'), drawer = $('#drawer');
  burger.addEventListener('click', () => {
    drawer.hidden = false; burger.setAttribute('aria-expanded', 'true'); document.body.classList.add('is-locked');
  });
  $('#drawerLinks').innerHTML = navHTML().replace(/class="navitem/g, 'data-dr class="navitem');
  drawer.addEventListener('click', (e) => {
    if (e.target.closest('[data-drawer-close]') || e.target.closest('a')) {
      drawer.hidden = true; burger.setAttribute('aria-expanded', 'false'); document.body.classList.remove('is-locked');
    }
  });
}
function syncNav(){
  $('#mainnavIn').innerHTML = navHTML();
}

/* ---------- 2. 시트(모달) ---------- */
let sheetReturnFocus = null;
function openSheet(html, wide){
  const sheet = $('#sheet');
  sheetReturnFocus = document.activeElement;
  $('#sheetBody').innerHTML = html;
  $('.sheet__panel').classList.toggle('sheet__panel--wide', !!wide);
  sheet.hidden = false;
  document.body.classList.add('is-locked');
  const closeBtn = $('.sheet__x');
  setTimeout(() => closeBtn && closeBtn.focus({ preventScroll:true }), 30);
}
function closeSheet(){
  const sheet = $('#sheet');
  if (sheet.hidden) return;
  sheet.hidden = true;
  $('#sheetBody').innerHTML = '';
  document.body.classList.remove('is-locked');
  if (sheetReturnFocus && sheetReturnFocus.focus) sheetReturnFocus.focus({ preventScroll:true });
}
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-sheet-close]')) closeSheet();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape'){ closeSheet(); const d = $('#drawer'); if (!d.hidden) d.hidden = true; document.body.classList.remove('is-locked'); }
});

/* ---------- 3. 공유 카드 ---------- */
let lastShareCanvas = null;
function shareText(t){
  if (navigator.share){
    navigator.share({ title:t.title, text:t.text, url:SITE }).catch(() => {});
  } else {
    copyText(t.text);
  }
}
function copyText(text){
  if (navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(() => toast('문구를 복사했습니다')).catch(() => fallbackCopy(text));
  } else fallbackCopy(text);
}
function fallbackCopy(text){
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); toast('문구를 복사했습니다'); } catch(e){ toast('복사가 어려우면 길게 눌러 선택해 주세요'); }
  ta.remove();
}
function openShareCard(opt){
  const cv = drawShareCard(opt), url = cv.toDataURL('image/png');
  lastShareCanvas = cv;
  const shareBody = `[정운타임즈] ${opt.title.replace(/<[^>]+>/g, '')}\n${opt.quote || ''}\n${opt.shareUrl || SITE}`;
  openSheet(`
    <p class="eyebrow">SHARE CARD</p>
    <h2 class="pay__title" style="margin:10px 0 6px">공유 카드가 완성되었습니다</h2>
    <p class="hint" style="margin-bottom:16px">이미지로 저장하거나, 그대로 공유해 보세요. 카드에는 지금 이 결과만 담깁니다.</p>
    <div class="shareprev"><img src="${url}" alt="정운타임즈 공유 카드 미리보기" width="1080" height="1350"></div>
    <div class="shareacts">
      <button class="btn btn--line" type="button" data-share-download>이미지 저장</button>
      <button class="btn btn--line" type="button" data-share-copy>문구 복사</button>
      <button class="btn btn--wine btn--block" type="button" data-share-native>공유하기</button>
    </div>
    <div class="sharecopy">
      함께 보낼 문구
      <textarea readonly>${esc(shareBody)}</textarea>
    </div>
    <p class="pay__note">저장한 이미지는 인스타그램·스레드·카카오톡 어디에나 올릴 수 있습니다. 재미로 보는 참고용 콘텐츠입니다.</p>
  `);
  const body = $('#sheetBody');
  body.querySelector('[data-share-download]').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = url; a.download = `jungwoon-share-${Date.now()}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    toast('이미지를 저장했습니다');
  });
  body.querySelector('[data-share-copy]').addEventListener('click', () => copyText(shareBody));
  body.querySelector('[data-share-native]').addEventListener('click', () => shareImageOrText(cv, shareBody, opt.title.replace(/<[^>]+>/g, '')));
}
async function shareImageOrText(cv, text, title){
  try{
    if (navigator.canShare && cv.toBlob){
      const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
      const file = new File([blob], 'jungwoon-share.png', { type:'image/png' });
      if (navigator.canShare({ files:[file] })){
        await navigator.share({ files:[file], text, title });
        return;
      }
    }
    await navigator.share({ text, title, url:SITE });
  } catch(e){
    copyText(text);
  }
}

/* ---------- 4. 990원 맛보기 ---------- */
function openPaywall(ctx){
  const pack = {
    today:   { kicker:'990원 사주맛보기 · 재물운 상세', title:'이번 주 흐름 4P', desc:'오늘의 한 줄은 하루입니다. 이번 주 재물의 흐름과 새는 곳을 4장으로 정리합니다.' },
    people:  { kicker:'990원 사주맛보기 · 인물 상세', title:'그 유형의 사주 풀이 4P', desc:'화제의 유형이 왜 지금 뜨는지, 무엇이 버티게 하는지를 구조로 4장에 담습니다.' },
    mbti:    { kicker:'990원 사주맛보기 · 궁합의 이유', title:'충돌 3가지와 해결책 4P', desc:'점수만으로는 부족합니다. 어디서 부딪히고 어떻게 풀지 4장으로 정리합니다.' },
    dream:   { kicker:'990원 사주맛보기 · 꿈 리포트', title:'꿈과 사주의 연결 4P', desc:'꿈의 상징이 내 사주의 어느 자리에서 올라왔는지, 이번 주 꿈의 흐름을 4장에 담습니다.' },
    pastlife:{ kicker:'990원 사주맛보기 · 전생 상세', title:'전생 직업과 현생 연결 4P', desc:'전생의 역할이 지금의 직업·습관으로 어떻게 남았는지 4장으로 이어 줍니다.' },
    lab:     { kicker:'990원 사주맛보기 · 유형 처방', title:'내 유형의 처방 4P', desc:'49유형 중 내 자리의 열림과 닫힘, 지금 필요한 처방을 4장으로 정리합니다.' }
  }[ctx] || { kicker:'990원 사주맛보기', title:'4P 맛보기 리포트', desc:'더 깊은 풀이를 4장으로 정리해 드립니다.' };

  openSheet(`
    <div class="pay">
      <div class="pay__head">
        <span class="pay__badge">990원 · 4P</span>
        <div>
          <p class="eyebrow eyebrow--ink" style="margin-bottom:8px">${esc(pack.kicker)}</p>
          <h2 class="pay__title" id="sheetTitle">${esc(pack.title)}</h2>
        </div>
      </div>
      <p class="pay__price">990<small>원 / 4페이지 PDF</small></p>
      <p class="pay__deck">${esc(pack.desc)}</p>

      <ul class="pay__toc">
        <li><b>P.1</b><span>지금 내 자리의 기운과 이번 주의 문</span><i>4,200자</i></li>
        <li><b>P.2</b><span>구체적인 숫자와 시기 — 어느 주에 움직일까</span><i>도표 2개</i></li>
        <li><b>P.3</b><span>주의할 충돌과 피하는 방법</span><i>체크리스트</i></li>
        <li><b>P.4</b><span>이번 주 실행 3가지</span><i>한 장 요약</i></li>
      </ul>

      <div class="pay__til">
        <p>${esc(pack.desc)} 이번 주의 문은 생각보다 좁습니다. 들어갈 문을 하나 고르면 나머지는 기다려도 됩니다. 다만 나가는 문은 …</p>
      </div>

      <div class="pay__acts">
        <a class="btn btn--wine btn--block" href="${KAKAO}" target="_blank" rel="noopener">990원으로 4P 받기 <span class="btn__arw">→</span></a>
        <a class="btn btn--line btn--block" href="${AURA}" target="_blank" rel="noopener">정밀 PDF 30P부터 보기</a>
      </div>
      <p class="pay__note">990원 맛보기는 카카오 1:1로 신청하시면 결제 링크와 함께 4P PDF로 보내 드립니다. 결제와 신청은 <b>운명사주 아우라</b> 결제 페이지에서 이루어집니다.</p>
    </div>
  `);
}

/* ---------- 5. 운명연구소 49유형 ---------- */
const LAB_GATE_DESC = {
  '재물의 문':'돈이 오가는 자리가 가장 큰 문입니다. 이 문이 열리면 숫자가 먼저 보이고, 닫히면 아무리 벌어도 남지 않습니다. 처방은 하나 — 들어오는 길을 두 개로 만들지 말고 하나를 깊게 파는 것.',
  '관계의 문':'사람이 곧 기회인 문입니다. 이 문이 열리면 소개와 인연이 먼저 옵니다. 닫히면 혼자 잘해도 일이 커지지 않습니다. 처방은 먼저 연락하는 쪽이 되는 것.',
  '표현의 문':'말과 손으로 밖에 내보내는 문입니다. 열리면 만든 것이 곧 평가가 됩니다. 닫히면 완벽해질 때까지 기다리다 때를 놓칩니다. 처방은 초안을 먼저 공개하는 것.',
  '권한의 문':'책임과 자리의 문입니다. 열리면 규칙을 만들고 사람을 세웁니다. 닫히면 능력에 비해 자리가 작아 답답합니다. 처방은 작은 조직이라도 끝까지 운영해 보는 것.',
  '배움의 문':'받아들이는 문입니다. 열리면 자격·문서·스승이 붙습니다. 닫히면 배우느라 시작을 못 합니다. 처방은 배운 것을 오늘 하나 실행하는 것.',
  '회복의 문':'쉬는 힘의 문입니다. 열리면 오래 가고, 닫히면 한 번에 무너집니다. 처방은 잠과 식사를 일정에 먼저 넣는 것.',
  '이동의 문':'자리를 옮기는 문입니다. 열리면 이사·이직·해외가 자연스럽게 붙습니다. 닫히면 같은 자리에서 방향만 바꿔야 합니다. 처방은 환경을 먼저 바꾸는 것.'
};
const LAB_AIR_DESC = {
  '열기':'지금 기운이 뜨겁습니다. 밀면 열리지만 오래 타면 자신을 태웁니다. 한 번에 하나만.',
  '서늘함':'기운이 차분합니다. 판단은 정확하나 시작이 늦습니다. 작은 것부터 먼저 움직이세요.',
  '건조함':'군더더기가 없습니다. 다만 관계의 온기가 부족해 말이 차갑게 들립니다. 한 마디를 더 붙이세요.',
  '습함':'감정이 깊습니다. 사람을 오래 품지만 쉽게 빠져나오지 못합니다. 선을 그어 두세요.',
  '무게':'기반이 무겁습니다. 쉽게 흔들리지 않으나 변화가 느립니다. 한 칸씩 옮기면 됩니다.',
  '가벼움':'움직임이 빠릅니다. 기회를 잘 잡으나 마무리가 약합니다. 끝내는 규칙을 하나 두세요.',
  '정지':'지금은 멈춤의 시기입니다. 움직이면 흔들립니다. 정리와 준비가 다음 문을 엽니다.'
};
function openLabQuiz(){
  const answers = new Array(LAB.quiz.length).fill(null);
  const qHTML = LAB.quiz.map((q, i) => `
    <div class="quiz__q">
      <p>${esc(q.q)}</p>
      <div class="quiz__opts" data-q="${i}">
        ${q.a.map((a, j) => `<button class="quiz__opt" type="button" data-a="${j}">${esc(a)}</button>`).join('')}
      </div>
    </div>`).join('');

  openSheet(`
    <p class="eyebrow">DESTINY LAB · 49 TYPES</p>
    <h2 class="pay__title" style="margin:10px 0 8px" id="sheetTitle">운명연구소 — 49유형 테스트</h2>
    <p class="hint" style="margin-bottom:20px">여섯 개의 질문으로 지금 내가 서 있는 문과 기운을 찾습니다. 1분이면 충분합니다.</p>
    <form id="labForm">${qHTML}
      <button class="btn btn--wine btn--block" type="submit" disabled>내 유형 찾기</button>
    </form>
  `, true);

  const form = $('#labForm'), submit = form.querySelector('button[type="submit"]');
  form.addEventListener('click', (e) => {
    const b = e.target.closest('.quiz__opt'); if (!b) return;
    const qi = +b.parentElement.dataset.q;
    answers[qi] = +b.dataset.a;
    Array.from(b.parentElement.children).forEach(x => x.classList.toggle('is-on', x === b));
    submit.disabled = answers.some(a => a === null);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const gate = (answers.reduce((s, a, i) => s + a * (i + 2), 0)) % 7;
    const air = (answers.reduce((s, a, i) => s + (1 - a) * (i + 1), 0) + answers.filter(a => a === 1).length) % 7;
    const gateName = LAB.gates[gate], airName = LAB.airs[air];
    const typeNo = gate * 7 + air + 1;
    const cellGrid = Array.from({ length:49 }, (_, i) => `<span class="${i === typeNo - 1 ? 'on' : ''}">${String(i+1).padStart(2,'0')}</span>`).join('');
    openSheet(`
      <p class="eyebrow">DESTINY LAB · RESULT</p>
      <h2 class="pay__title" style="margin:10px 0 4px" id="sheetTitle">${esc(gateName)} · ${esc(airName)}</h2>
      <p class="hint">49유형 중 <b>${typeNo}번</b> — ${esc(gateName)}이 ${esc(airName)}의 온도로 열려 있는 자리</p>
      <div class="typegrid">${cellGrid}</div>
      <div class="vcard" style="margin-bottom:16px">
        <div class="vcard__band"><b>TYPE ${String(typeNo).padStart(2,'0')}</b><span>정운타임즈 운명연구소</span></div>
        <div class="vcard__in">
          <p class="vcard__deck">${esc(LAB_GATE_DESC[gateName])}</p>
          <div class="vcard__cols">
            <div><h4>지금의 온도</h4><p>${esc(LAB_AIR_DESC[airName])}</p></div>
            <div><h4>이번 주 처방</h4><p>${esc(airName === '정지' ? '새로 시작하지 말고, 하던 일을 끝내는 데 집중하세요. 정리가 곧 다음 문의 열쇠입니다.' : '문을 하나만 고르세요. 두 개를 동시에 열면 둘 다 반쯤 열린 채로 남습니다.')}</p></div>
          </div>
          <div class="vcard__acts">
            <button class="btn btn--sm" type="button" data-lab-share>공유 카드 만들기</button>
            <button class="btn btn--line btn--sm" type="button" data-lab-pay>990원 4P 처방 보기</button>
          </div>
          <p class="vcard__foot">운명연구소의 유형은 상징 해석에 기반한 참고용 콘텐츠입니다.</p>
        </div>
      </div>
      <button class="btn btn--line btn--block" type="button" data-lab-retry>다시 테스트</button>
    `, true);
    $('#sheetBody').querySelector('[data-lab-share]').addEventListener('click', () => {
      openShareCard({
        kicker:'DESTINY LAB · 49 TYPES', title:`${gateName}\n${airName}`,
        quote:`49유형 중 ${typeNo}번. ${LAB_AIR_DESC[airName]}`,
        kv:[['유형 번호', `${typeNo} / 49`], ['문', gateName]],
        shareUrl:`${SITE}#/#lab`
      });
    });
    $('#sheetBody').querySelector('[data-lab-pay]').addEventListener('click', () => openPaywall('lab'));
    $('#sheetBody').querySelector('[data-lab-retry]').addEventListener('click', openLabQuiz);
  });
}

/* ---------- 6. 홈 ---------- */
function marqueeHTML(){
  const items = [
    ['01', '오늘의 간지 ' + TODAY_DAY.hanja + ' — 내 일간과 만나는 지점'],
    ['02', '화제의 사주 — 지금 뜨는 유형은 화(火) 과다형'],
    ['03', 'MBTI 궁합 — 점수보다 중요한 것은 충돌의 이유'],
    ['04', '어젯밤 그 꿈 — 상징 사전 88편 수록'],
    ['05', '전생 — 지금 남은 습관의 출처'],
    ['06', '운 부르는 것들 — 부족한 오행을 채우는 큐레이션'],
    ['LAB', '운명연구소 — 49가지 운명 유형 공개']
  ];
  const one = items.map(([n, t]) => `<span class="marq__item"><i>${n}</i>${esc(t)}</span>`).join('');
  return one + one;
}
function gateCards(){
  return COVERS.map((c, i) => `
    <a class="gate" href="${c.route}" data-reveal data-delay="${i}">
      <div class="gate__img">
        <img src="${c.img}" alt="${c.ko} 코너 표지 이미지" loading="${i < 2 ? 'eager' : 'lazy'}" width="1086" height="1448">
        <span class="gate__no">${c.no}</span>
        <span class="gate__en">${c.en}</span>
      </div>
      <div class="gate__body">
        <h3 class="gate__title">${c.ko}</h3>
        <p class="gate__desc">${c.line}</p>
        <div class="gate__foot"><span>${c.tag}</span><span class="gate__go">열기 <i>→</i></span></div>
      </div>
    </a>`).join('');
}
function featureCards(){
  return FEATURES.map(f => `
    <a class="feat" href="#/people" data-article="${f.id}" data-reveal>
      <div class="feat__img"><img src="${f.img}" alt="${f.brand} 칼럼 이미지" loading="lazy" width="1200" height="900"></div>
      <div class="feat__body">
        <p class="feat__kicker">${f.brand}</p>
        <h3 class="feat__title">${esc(f.title)}</h3>
        <p class="feat__deck">${esc(f.deck)}</p>
        <p class="feat__meta">${esc(f.meta)}</p>
      </div>
    </a>`).join('');
}
function shopTeaser(){
  return ['0','1','2','3','4'].map((oh, i) => {
    const O = OH[+oh], item = SHOP_ITEMS.find(x => x.oh === oh);
    return `<a class="stcard" href="#/shop?oh=${oh}" data-reveal data-delay="${i}" style="border-top:2px solid ${O.hex}">
      <span class="stcard__n">0${i+1}</span>
      <p class="stcard__oh" style="color:${O.hex}">${O.h}</p>
      <h3>${O.k}의 기운</h3>
      <p>${esc(item.name)} 등 ${O.k}을 채우는 큐레이션</p>
      <span class="stcard__go">큐레이션 보기 →</span>
    </a>`;
  }).join('');
}
function viewHome(){
  return `
  <section class="hero">
    <div class="shell">
      <div class="hero__grid">
        <div class="hero__copy">
          <div class="hero__kicker">
            <span class="hero__tag">VOL. ${String(ISSUE_NO).padStart(2,'0')} · 표지</span>
            <span class="hero__tagline">운명사주, 정운이 풀다</span>
          </div>
          <h1 class="hero__title">
            <span class="th">The Six Doors</span>
            ${HOME.title}
          </h1>
          <p class="hero__deck">${HOME.deck}</p>
          <div class="hero__acts">
            <a class="btn btn--wine" href="#/today">오늘 내 운명 보기 <span class="btn__arw">→</span></a>
            <a class="btn btn--line" href="#/#gates">여섯 개의 문 둘러보기</a>
          </div>
          <div class="hero__facts">
            ${HOME.heroFacts.map(f => `<div class="hero__fact"><b>${f.n}</b><span>${f.t}</span></div>`).join('')}
          </div>
        </div>
        <figure class="hero__art">
          <img src="assets/img/hero-cover.webp" alt="정운타임즈 표지 아트 — 오행의 빛과 운명의 실을 두른 인물" width="1086" height="1448" fetchpriority="high">
          <span class="hero__seal">正運<br>三號</span>
          <figcaption class="hero__coverlabel">
            <span><span>ON THE COVER</span><b>운명은 여섯 개의 문으로 열린다</b></span>
            <span style="text-align:right"><span>ART DIRECTION</span><b>정운 편집부</b></span>
          </figcaption>
        </figure>
      </div>
    </div>
  </section>

  <div class="marq" aria-hidden="true">
    <div class="marq__in">
      <span class="marq__tag">이번 호</span>
      <div class="marq__vp"><div class="marq__track">${marqueeHTML()}</div></div>
    </div>
  </div>

  <section class="sect" id="gates">
    <div class="shell">
      <div class="secthead">
        <p class="secthead__no">01</p>
        <div>
          <h2 class="secthead__title">이번 호의 여섯 개의 문</h2>
          <p class="secthead__desc">오늘의 기운에서 시작해 사람과 꿈과 전생을 지나, 손에 쥐는 물건까지. 어느 문을 열어도 무료로 시작하고, 필요할 때만 더 깊이 들어갑니다.</p>
        </div>
        <p class="secthead__en">The Six Doors</p>
      </div>
      <div class="gates">${gateCards()}</div>
    </div>
  </section>

  <section class="sect sect--ink" id="lab">
    <div class="shell">
      <div class="lab">
        <figure class="lab__fig" data-reveal>
          <img src="assets/img/lab-research.webp" alt="운명연구소 — 별자리 도표와 황동 도구가 놓인 연구 책상" loading="lazy" width="1600" height="900">
          <span class="lab__badge">49<br>TYPES</span>
          <figcaption class="lab__figcap">DESTINY LAB · 정운의 연구실</figcaption>
        </figure>
        <div data-reveal>
          <p class="eyebrow">바이럴 코너 · 운명연구소</p>
          <h2 class="lab__title">운명은 49개의<br>문으로 <em>나뉜다</em></h2>
          <p class="lab__deck">${HOME ? LAB.deck : ''}</p>
          <ul class="lab__points">
            ${LAB.points.map(([n, t, d]) => `<li><b>${n}</b><span><b>${esc(t)}</b> — ${esc(d)}</span></li>`).join('')}
          </ul>
          <div class="lab__grid" aria-hidden="true">
            ${Array.from({ length:49 }, (_, i) => `<span class="lab__cell ${[3,9,12,19,24,31,38,44,47].includes(i) ? 'lit' : ''}">${String(i+1).padStart(2,'0')}</span>`).join('')}
          </div>
          <button class="btn btn--gold" type="button" id="labStart">내 유형 찾기 — 1분 테스트 <span class="btn__arw">→</span></button>
        </div>
      </div>
    </div>
  </section>

  <section class="sect" id="columns">
    <div class="shell">
      <div class="secthead">
        <p class="secthead__no">02</p>
        <div>
          <h2 class="secthead__title">정운연예 · 정운스포츠</h2>
          <p class="secthead__desc">화제의 무대와 기록 뒤에 있는 사주 구조를 읽는 이슈형 칼럼. 왜 지금 뜨는지, 무엇이 오래 버티게 하는지를 여덟 글자로 봅니다.</p>
        </div>
        <p class="secthead__en">Feature Columns</p>
      </div>
      <div class="feats">${featureCards()}</div>
    </div>
  </section>

  <section class="sect sect--paper2">
    <div class="shell">
      <div class="secthead">
        <p class="secthead__no">03</p>
        <div>
          <h2 class="secthead__title">운 부르는 것들</h2>
          <p class="secthead__desc">내 사주에서 모자란 오행을 골라, 그 기운을 보완하는 물건과 책을 큐레이션합니다. 사는 대신 고르는 매거진 숍.</p>
        </div>
        <p class="secthead__en">Curated Shop</p>
      </div>
      <div class="shopteaser">${shopTeaser()}</div>
      <p style="margin-top:24px"><a class="btn btn--line" href="#/shop">큐레이션 전체 보기 <span class="btn__arw">→</span></a></p>
    </div>
  </section>

  <section class="sect" id="report">
    <div class="shell">
      <div class="secthead">
        <p class="secthead__no">04</p>
        <div>
          <h2 class="secthead__title">리포트 — 하루가 아니라 10년</h2>
          <p class="secthead__desc">매거진이 오늘을 읽는다면, 리포트는 대운과 세운을 읽습니다. 무료 콘텐츠에서 확인한 것을 정밀 PDF로 이어가세요.</p>
        </div>
        <p class="secthead__en">Deep Report</p>
      </div>
      <div class="plans plans--light">
        ${PLANS.map(p => `
          <a class="plan ${p.badge ? 'plan--best' : ''}" href="${AURA}" target="_blank" rel="noopener">
            ${p.badge ? `<span class="plan__badge">${p.badge}</span>` : ''}
            <p class="plan__p">${p.p}</p>
            <p class="plan__price">${p.price}<span>원</span></p>
            <p class="plan__for">${p.forLine}</p>
            <ul class="plan__list">${p.list.map(li => `<li>${li}</li>`).join('')}</ul>
            <span class="plan__cta">신청하기 →</span>
          </a>`).join('')}
      </div>
    </div>
  </section>

  <section class="newsletter">
    <div class="shell newsletter__in">
      <div>
        <p class="eyebrow">WEEKLY LETTER</p>
        <h2 style="margin-top:12px">매주 목요일,<br>한 주의 기운이 도착합니다</h2>
        <p>한 주의 간지와 코너별 하이라이트, 그 주에 조심할 시기와 개운 포인트를 한 장으로 정리합니다. 광고 없이, 지면 내용만.</p>
      </div>
      <form class="nlform" id="nlForm">
        <input type="email" name="email" placeholder="you@example.com" aria-label="이메일 주소" required>
        <button type="submit">신청 <span class="btn__arw">→</span></button>
      </form>
    </div>
  </section>
  <p class="shell" style="font-size:11px;color:var(--muted);padding-bottom:26px">신청하면 메일 앱이 열립니다. 전송 버튼을 누르면 접수됩니다. 수집 항목: 이메일 / 목적: 주간 레터 / 보유: 해지 시 즉시 파기.</p>
  `;
}

/* ---------- 7. 오늘 내 운명 ---------- */
function emptyState(seal, title, text){
  return `<div class="empty"><div class="empty__seal">${seal}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>
    <div class="empty__lines" aria-hidden="true"><i></i><i></i><i></i></div></div>`;
}
function routeSwitch(active){
  return `<div class="chips" style="margin-top:34px;justify-content:center">
    ${COVERS.map(c => `<a class="chip ${c.id === active ? 'is-on' : ''}" href="${c.route}">${c.ko}</a>`).join('')}
  </div>`;
}
function pageHeroHTML(id){
  const c = COVERS.find(x => x.id === id);
  const crumb = `<div class="crumbs"><a href="#/">표지</a><span>/</span><span>${c.ko}</span></div>`;
  return `<section class="phero">
    <div class="shell">
      <div class="phero__in">
        <div class="phero__copy">
          ${crumb}
          <div class="phero__kicker"><span class="phero__no">${c.no}</span><span class="phero__en">${c.kicker}</span></div>
          <h1 class="phero__title">${c.ko}</h1>
          <p class="phero__deck">${c.desc}</p>
          <div class="phero__tags"><span>무료 체험</span><span>공유 카드</span><span>990원 4P</span><span>정밀 PDF 30·60·100P</span></div>
        </div>
        <figure class="phero__art">
          <img src="${c.img}" alt="${c.ko} 표지 이미지" width="1086" height="1448">
          <figcaption class="phero__cap">${c.en} · JUNGWOON TIMES</figcaption>
        </figure>
      </div>
    </div>
  </section>`;
}
function viewToday(){
  const saved = STORE.get('birth', null);
  return `
  ${pageHeroHTML('today')}
  <section class="sect sect--tight">
    <div class="shell">
      <div class="stage">
        <form class="panel panel--sticky" id="todayForm" novalidate>
          <div class="panel__head">
            <span class="panel__num">01</span>
            <h2 class="panel__title">내 생년월일</h2>
            <p class="panel__sub">${TODAY_LABEL}</p>
          </div>
          <label class="field">
            <span class="field__label">생년월일 <span>양력 기준</span></span>
            <input class="input" type="date" name="birth" min="1900-01-01" max="${AGE_MAX}" value="${saved ? dateLabelOf(saved).replace(/\./g,'-') : ''}" autocomplete="bday">
            <span class="hint">생년월일은 브라우저 안에서만 계산됩니다. 서버로 보내지 않습니다.</span>
          </label>
          <div class="field">
            <span class="field__label">생일이 없다면 <span>띠로 간이 풀이</span></span>
            <select class="input" name="zodiac">
              <option value="">띠를 선택하세요</option>
              ${BRANCHES.map((b, i) => `<option value="${i}">${b.animal}띠 (${b.h})</option>`).join('')}
            </select>
          </div>
          <button class="btn btn--wine btn--block" type="submit">오늘의 운세 뽑기 <span class="btn__arw">→</span></button>
          <p class="panel__foot">오늘의 간지는 <b>${TODAY_DAY.hanja}</b>일입니다. 일간(日干)과 오늘의 기운이 만나는 관계로 하루를 읽습니다.</p>
        </form>

        <div class="result" id="todayResult">
          ${emptyState('今', '아직 오늘의 지면이 비어 있습니다', '왼쪽에 생년월일을 넣고 운세를 뽑아 보세요. 오늘 자 간지와 내 기운이 만나는 지점을 한 줄로 써 드립니다.')}
        </div>
      </div>
      ${routeSwitch('today')}
    </div>
  </section>`;
}
function renderToday(r, birth){
  const el = $('#todayResult');
  el.innerHTML = `
    <article class="vcard">
      <div class="vcard__band"><b>TODAY'S READING</b><span>${r.date} · ${r.todayHanja}</span></div>
      <div class="vcard__in">
        <span class="vcard__tag">${r.rel.name} · ${r.rel.short}</span>
        <h2 class="vcard__title">${esc(r.headline)}</h2>
        <div class="score">
          <p class="score__num">${r.score}<span>점</span></p>
          <div class="score__meta">
            <b>오늘의 온도 — ${esc(r.U.k)}${josa(r.U,'gwa')} ${esc(r.T.k)}의 만남</b>
            <p>${r.isHap ? '띠와 오늘의 지지가 합(合)을 이룹니다. 사람과의 일이 부드럽게 풀리는 날.' : r.isClash ? '띠와 오늘의 지지가 충(沖)입니다. 큰 결정은 하루 미루면 훨씬 낫습니다.' : '평온한 흐름입니다. 무리하지 않으면 하루가 길게 갑니다.'}</p>
            <div class="score__bar"><i data-w="${r.score}"></i></div>
          </div>
        </div>
        <p class="vcard__deck">${esc(r.deck)}</p>
        <dl class="vcard__kv">
          <div><dt>행운의 색</dt><dd><span class="swatch" style="background:${r.luckColor.hex}"></span>${esc(r.luckColor.name)}</dd></div>
          <div><dt>행운의 숫자</dt><dd>${r.nums.join(' · ')}</dd></div>
          <div><dt>좋은 시간</dt><dd>${esc(r.timeBest)}</dd></div>
          <div><dt>내 일간</dt><dd>${esc(r.ilganTxt)}${r.pillars ? ` · ${esc(r.pillars.year.b.animal)}띠` : ''}</dd></div>
        </dl>
        <blockquote class="vcard__quote">“${esc(r.advice)}”</blockquote>
        <div class="vcard__cols">
          <div><h4>오늘의 주의</h4><p>${esc(r.caution)}</p></div>
          <div><h4>한 줄 정리</h4><p>${esc(r.oneLine)}. ${esc(r.T.k)}의 기운이 오늘의 문을 엽니다. 문을 하나만 고르세요.</p></div>
        </div>
        <div class="vcard__acts">
          <button class="btn btn--sm" type="button" data-today-share>행운 색 카드 공유</button>
          <button class="btn btn--wine btn--sm" type="button" data-today-pay>990원 4P 맛보기</button>
          <a class="btn btn--line btn--sm" href="${AURA}" target="_blank" rel="noopener">정밀 PDF 보기</a>
        </div>
        <p class="vcard__foot">참고용 콘텐츠입니다. 오늘의 운세는 하루 단위, 정밀 리포트는 대운·세운까지 10년 단위로 봅니다.</p>
      </div>
    </article>`;
  const bar = el.querySelector('.score__bar i');
  requestAnimationFrame(() => { bar.style.width = r.score + '%'; });

  el.querySelector('[data-today-share]').addEventListener('click', () => {
    openShareCard({
      kicker:'TODAY · ' + r.date, title:r.headline,
      quote:r.advice,
      kv:[['행운의 색', r.luckColor.name], ['좋은 시간', r.timeBest], ['오늘의 관계', r.rel.short], ['오늘의 기운', r.T.k]],
      nums:r.nums, numsLabel:'행운의 숫자',
      glyph:r.todayPillar.hanja, glyphLabel:'오늘의 간지',
      shareUrl:`${SITE}#/today`
    });
  });
  el.querySelector('[data-today-pay]').addEventListener('click', () => openPaywall('today'));
}
function bindToday(){
  const form = $('#todayForm');
  const savedBirth = STORE.get('birth', null);
  if (savedBirth){ try { renderToday(buildToday(savedBirth, null), savedBirth); } catch(e){} }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const birth = birthOfForm(form);
    const zsel = form.querySelector('[name="zodiac"]');
    if (!birth && !zsel.value){ toast('생년월일 또는 띠를 선택해 주세요'); (form.querySelector('[name="birth"]') || zsel).focus(); return; }
    const r = birth ? buildToday(birth, null) : buildToday(null, Number(zsel.value));
    if (birth){ STORE.set('birth', birth); const p = sajuOf(birth, null); STORE.set('lack', p.lack); }
    renderToday(r, birth);
    $('#todayResult').scrollIntoView({ behavior:'smooth', block:'center' });
  });
}

/* ---------- 8. 화제의 사주 ---------- */
function viewPeople(){
  return `
  ${pageHeroHTML('people')}
  <section class="sect sect--tight">
    <div class="shell">
      <div class="secthead">
        <p class="secthead__no">①–⑧</p>
        <div>
          <h2 class="secthead__title">지금 화제인 여덟 가지 유형</h2>
          <p class="secthead__desc">이름 대신 구조로 읽습니다. 화제의 인물에게서 반복해서 보이는 사주 유형을 여덟 개로 정리했습니다. 카드를 누르면 풀이가 펼쳐집니다.</p>
        </div>
        <p class="secthead__en">Hot Types</p>
      </div>
      <div class="gates">
        ${PEOPLE.map((p, i) => `
          <button class="gate" type="button" data-person="${p.id}" data-reveal data-delay="${i % 3}">
            <div class="gate__img">
              <img src="${i % 2 ? 'assets/img/cat-people.webp' : 'assets/img/feature-ent.webp'}" alt="${esc(p.title)} 이미지" loading="lazy">
              <span class="gate__no">${String(i+1).padStart(2,'0')}</span>
              <span class="gate__en">${p.section}</span>
            </div>
            <div class="gate__body">
              <h3 class="gate__title" style="font-size:17px;line-height:1.45">${esc(p.title)}</h3>
              <p class="gate__desc">${esc(p.deck)}</p>
              <div class="gate__foot"><span>${esc(p.struct)}</span><span class="gate__go">읽기 <i>→</i></span></div>
            </div>
          </button>`).join('')}
      </div>
      <div style="margin-top:26px;display:flex;gap:10px;flex-wrap:wrap">
        ${FEATURES.slice(0,2).map(f => `<button class="btn btn--line btn--sm" type="button" data-article="${f.id}">${f.brand} 칼럼 · ${esc(f.title.slice(0,18))}…</button>`).join('')}
      </div>
      ${routeSwitch('people')}
    </div>
  </section>`;
}
function openPerson(id){
  const p = PEOPLE.find(x => x.id === id);
  if (!p) return;
  openSheet(`
    <p class="eyebrow">${esc(p.section)} · ${esc(p.kicker)}</p>
    <h2 class="pay__title" id="sheetTitle" style="margin:10px 0 12px;font-size:26px;line-height:1.35">${esc(p.title)}</h2>
    <p class="hint" style="margin-bottom:16px">${esc(p.deck)}</p>
    <div class="vcard">
      <div class="vcard__band"><b>SAJU PROFILE</b><span>정운타임즈 · ${esc(p.section)}</span></div>
      <div class="vcard__in">
        <dl class="vcard__kv">
          ${p.keys.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}
        </dl>
        <div style="display:grid;gap:12px;margin-bottom:16px">
          ${p.read.map(t => `<p style="font-size:13.5px;line-height:1.85;color:var(--ink-3)">${esc(t)}</p>`).join('')}
        </div>
        <blockquote class="vcard__quote">“${esc(p.quote)}”</blockquote>
        <div class="vcard__acts">
          <button class="btn btn--sm" type="button" data-person-share>그 유형 사주 공유</button>
          <button class="btn btn--wine btn--sm" type="button" data-person-pay>인물 상세 4P (990원)</button>
        </div>
        <p class="vcard__foot">특정 실존 인물을 지목한 분석이 아니라, 화제의 유형에서 반복되는 사주 구조를 정리한 참고용 콘텐츠입니다.</p>
      </div>
    </div>
  `);
  const body = $('#sheetBody');
  body.querySelector('[data-person-share]').addEventListener('click', () => {
    openShareCard({
      kicker:`${p.section} · HOT TYPE`, title:p.title, quote:p.quote,
      kv:p.keys.slice(0,4), shareUrl:`${SITE}#/people`
    });
  });
  body.querySelector('[data-person-pay]').addEventListener('click', () => openPaywall('people'));
}
function openArticle(id){
  const f = FEATURES.find(x => x.id === id);
  if (!f) return;
  openSheet(`
    <p class="eyebrow">${esc(f.brand)} · ${esc(f.kicker)}</p>
    <h2 class="pay__title" id="sheetTitle" style="margin:10px 0 14px;font-size:25px;line-height:1.35">${esc(f.title)}</h2>
    <p class="hint" style="margin-bottom:18px">${esc(f.meta)}</p>
    <img src="${f.img}" alt="${esc(f.title)}" style="width:100%;aspect-ratio:16/9;object-fit:cover;margin-bottom:18px">
    <div style="display:grid;gap:14px">
      <p style="font-family:var(--serif);font-size:15.5px;line-height:1.9;color:var(--ink-2)">${esc(f.deck)}</p>
      ${f.body.map(t => `<p style="font-size:14px;line-height:1.9;color:var(--ink-3)">${esc(t)}</p>`).join('')}
    </div>
    <blockquote class="vcard__quote" style="margin:20px 0">“${esc(f.quote)}”</blockquote>
    <div class="pay__acts">
      <a class="btn btn--wine btn--block" href="#/today" data-article-goto>내 사주로 확인하기 <span class="btn__arw">→</span></a>
      <a class="btn btn--line btn--block" href="${AURA}" target="_blank" rel="noopener">정밀 리포트 30P부터</a>
    </div>
  `);
  const goto = $('#sheetBody').querySelector('[data-article-goto]');
  if (goto) goto.addEventListener('click', () => closeSheet());
}
function bindPeople(){
  $$('[data-person]').forEach(b => b.addEventListener('click', () => openPerson(b.dataset.person)));
  $$('[data-article]').forEach(b => b.addEventListener('click', (e) => {
    if (b.tagName === 'A'){ e.preventDefault(); openArticle(b.dataset.article); }
    else openArticle(b.dataset.article);
  }));
}

/* ---------- 9. MBTI 궁합 ---------- */
function mbtiSelect(name, label, value){
  return `
    <div style="margin-bottom:16px">
      <p class="field__label" style="display:flex;justify-content:space-between"><span>${label}</span><span data-mbti-val="${name}">${value || '선택 안 됨'}</span></p>
      <div class="mbti-group" data-mbti-group="${name}">
        ${MBTI_LIST.map(t => `<button class="mbti-btn ${value === t ? 'is-on' : ''}" type="button" data-mbti="${t}">${t}</button>`).join('')}
      </div>
    </div>`;
}
function viewMbti(){
  return `
  ${pageHeroHTML('mbti')}
  <section class="sect sect--tight">
    <div class="shell">
      <div class="stage">
        <div class="panel panel--sticky">
          <div class="panel__head"><span class="panel__num">01</span><h2 class="panel__title">궁합 계산</h2><p class="panel__sub">16 × 16</p></div>
          <div class="seg" id="mbtiMode" style="margin-bottom:18px">
            <button type="button" class="is-on" data-mode="type">MBTI × MBTI</button>
            <button type="button" data-mode="birth">생년월일 조합</button>
          </div>
          <div id="mbtiTypePane">
            ${mbtiSelect('me', '나의 MBTI', STORE.get('mbtiMe', ''))}
            ${mbtiSelect('you', '상대 MBTI', STORE.get('mbtiYou', ''))}
            <div class="mbti-legend"><span><b>E</b> 외향 / <b>I</b> 내향</span><span><b>N</b> 직관 / <b>S</b> 감각</span><span><b>T</b> 사고 / <b>F</b> 감정</span><span><b>J</b> 판단 / <b>P</b> 인식</span></div>
          </div>
          <div id="mbtiBirthPane" hidden>
            <label class="field"><span class="field__label">나의 생년월일</span><input class="input" type="date" name="birthA" min="1900-01-01" max="${AGE_MAX}" value="${STORE.get('birth', null) ? dateLabelOf(STORE.get('birth')).replace(/\./g,'-') : ''}"></label>
            <label class="field"><span class="field__label">상대 생년월일</span><input class="input" type="date" name="birthB" min="1900-01-01" max="${AGE_MAX}"></label>
            <p class="hint">생년월일 조합은 일간(日干)의 오행 관계와 띠의 합·충으로 궁합을 계산합니다.</p>
          </div>
          <button class="btn btn--wine btn--block" type="button" id="mbtiGo" style="margin-top:16px">궁합 보기 <span class="btn__arw">→</span></button>
          <p class="panel__foot">궁합 점수는 네 글자의 일치·보완 관계를 계산한 상징 점수입니다. 사람을 판정하는 도구가 아닙니다.</p>
        </div>
        <div class="result" id="mbtiResult">
          ${emptyState('合', '아직 궁합이 계산되지 않았습니다', '나와 상대의 MBTI를 고르거나 생년월일을 넣어 보세요. 점수와 함께 어디서 부딪히는지까지 보여 드립니다.')}
        </div>
      </div>
      ${routeSwitch('mbti')}
    </div>
  </section>`;
}
function renderMbtiType(res){
  const el = $('#mbtiResult');
  const me = MBTI_TYPES[res.a], you = MBTI_TYPES[res.b];
  el.innerHTML = `
    <article class="vcard">
      <div class="vcard__band"><b>CHEMISTRY</b><span>${res.a} × ${res.b}</span></div>
      <div class="vcard__in">
        <span class="vcard__tag">${esc(res.band.title)}</span>
        <div class="score">
          <p class="score__num">${res.score}<span>점</span></p>
          <div class="score__meta">
            <b>${esc(me.nick)} × ${esc(you.nick)}</b>
            <p>같은 글자 ${res.same}개 · 다른 축 ${4 - res.same}개</p>
            <div class="score__bar"><i data-w="${res.score}"></i></div>
          </div>
        </div>
        <p class="vcard__deck">${esc(res.band.line)}</p>
        <div class="vcard__cols">
          <div><h4>${res.a} — 나</h4><p>${esc(me.line)}</p></div>
          <div><h4>${res.b} — 상대</h4><p>${esc(you.line)}</p></div>
        </div>
        <div style="border-top:1px solid var(--line);padding-top:16px;margin-bottom:16px">
          <h4 style="font-size:11px;letter-spacing:.12em;color:var(--gold);margin-bottom:10px">한눈에 보는 케미</h4>
          <ul style="display:grid;gap:9px">
            ${res.diffs.slice(0,4).map(d => `<li style="display:grid;grid-template-columns:auto 1fr;gap:10px;font-size:12.6px;line-height:1.7;color:var(--ink-3)"><b style="font-family:var(--display);font-size:10.5px;color:var(--wine);letter-spacing:.1em;padding-top:2px">${d.axis}</b><span>${esc(d.text)}</span></li>`).join('')}
          </ul>
        </div>
        <div class="vcard__acts">
          <button class="btn btn--sm" type="button" data-mbti-share>궁합 카드 공유</button>
          <button class="btn btn--wine btn--sm" type="button" data-mbti-pay>점수의 이유 4P (990원)</button>
        </div>
        <p class="vcard__foot">참고용 상징 점수입니다. 관계의 실제는 대화와 약속에서 결정됩니다.</p>
      </div>
    </article>
    ${viralLockbox(res)}`;
  const bar = el.querySelector('.score__bar i');
  requestAnimationFrame(() => { bar.style.width = res.score + '%'; });

  el.querySelector('[data-mbti-share]').addEventListener('click', () => {
    openShareCard({
      kicker:'CHEMISTRY · MBTI', title:`${res.a} × ${res.b} — ${res.band.title}`,
      quote:res.band.line,
      kv:[['궁합 점수', `${res.score}점`], ['같은 글자', `${res.same}개`], ['나', MBTI_TYPES[res.a].nick], ['상대', MBTI_TYPES[res.b].nick]],
      shareUrl:`${SITE}#/mbti`
    });
  });
  el.querySelector('[data-mbti-pay]').addEventListener('click', () => openPaywall('mbti'));
  bindViral(res);
}
function viralLockbox(res){
  const unlocked = STORE.get('mbtiUnlock', false);
  const hiddenScore = Math.max(36, Math.min(97, Math.round(100 - res.score * 0.62 + (res.same * 4))));
  return `
    <div class="lockbox ${unlocked ? 'is-open' : ''}" style="margin-top:16px" id="mbtiLock">
      <p class="eyebrow eyebrow--ink">HIDDEN CHEMISTRY</p>
      <h3 style="font-family:var(--serif);font-size:19px;font-weight:800;letter-spacing:-.03em;margin:10px 0 6px">숨겨진 궁합 — 친구 3명을 넣으면 열립니다</h3>
      <p class="hint" style="margin-bottom:14px">친구 셋의 이름(또는 MBTI)을 넣으면, 두 사람 사이에 끼어들 때 생기는 제3의 궁합을 계산해 드립니다.</p>
      <div class="lockbox__veil" id="mbtiVeil">
        <dl class="vcard__kv" style="margin-bottom:12px">
          <div><dt>삼각 균형도</dt><dd>${hiddenScore}점</dd></div>
          <div><dt>가장 위험한 자리</dt><dd>${res.a[1] === 'N' ? '약속의 해석' : '속도의 차이'}</dd></div>
        </dl>
        <p style="font-size:12.5px;line-height:1.75;color:var(--ink-3)">세 사람이 모이면 두 사람의 궁합은 다시 계산됩니다. 이 조합에서 갈등이 생기는 자리는 대개 말의 속도가 아니라 결정의 순서입니다. 먼저 정하는 사람이 ${res.a[3] === 'J' ? '나' : '상대'}라면, 순서를 미리 합의해 두세요.</p>
      </div>
      <div class="lockbox__cta">
        ${unlocked
          ? `<p class="unlocknote">🔓 잠금이 해제되었습니다 — 숨은 궁합이 열렸습니다.</p>`
          : `<button class="btn btn--gold" type="button" id="mbtiUnlockBtn">친구 3명 입력하고 잠금 해제</button>`}
      </div>
    </div>`;
}
function bindViral(res){
  const btn = $('#mbtiUnlockBtn');
  if (btn) btn.addEventListener('click', () => {
    openSheet(`
      <p class="eyebrow">UNLOCK · HIDDEN CHEMISTRY</p>
      <h2 class="pay__title" id="sheetTitle" style="margin:10px 0 8px">친구 3명을 입력하세요</h2>
      <p class="hint" style="margin-bottom:16px">이름만 넣어도 됩니다. 입력값은 브라우저에만 저장되고 서버로 보내지 않습니다.</p>
      <div class="friendrow">
        <input class="input" type="text" name="f1" placeholder="친구 1" maxlength="12">
        <input class="input" type="text" name="f2" placeholder="친구 2" maxlength="12">
        <input class="input" type="text" name="f3" placeholder="친구 3" maxlength="12">
      </div>
      <button class="btn btn--wine btn--block" type="button" id="unlockGo">잠금 해제</button>
      <p class="pay__note">세 사람의 이름은 이 브라우저에만 남습니다. 실제 사람의 정보를 넣지 않아도 계산은 됩니다.</p>
    `);
    $('#unlockGo').addEventListener('click', () => {
      const names = ['f1','f2','f3'].map(n => $('#sheetBody').querySelector(`[name="${n}"]`).value.trim());
      if (names.some(n => !n)){ toast('세 명 모두 입력해 주세요'); return; }
      STORE.set('mbtiFriends', names);
      STORE.set('mbtiUnlock', true);
      closeSheet();
      openSheet(`
        <p class="eyebrow">UNLOCKED</p>
        <h2 class="pay__title" id="sheetTitle" style="margin:10px 0 10px">숨은 궁합이 열렸습니다</h2>
        <p class="hint" style="margin-bottom:14px">${names.map(esc).join(' · ')} — 세 사람이 모일 때의 궁합입니다.</p>
        <div class="vcard"><div class="vcard__in">
          <p class="vcard__deck">이 조합에서 갈등이 생기는 자리는 말의 속도가 아니라 <b>결정의 순서</b>입니다. 먼저 정하는 사람과 먼저 확인하는 사람이 만나면, 같은 일을 두 번 확인하게 됩니다.</p>
          <dl class="vcard__kv">
            <div><dt>삼각 균형도</dt><dd>${Math.max(36, Math.min(97, Math.round(100 - res.score * 0.62 + res.same * 4)))}점</dd></div>
            <div><dt>모임이 길어지는 조건</dt><dd>역할 분담</dd></div>
          </dl>
          <p style="font-size:12.5px;color:var(--muted);line-height:1.7">세 명이 함께할 때는 누가 결정하고 누가 기록하는지를 먼저 정하세요. 그것만 정해도 궁합은 10점 올라갑니다.</p>
        </div></div>
        <button class="btn btn--line btn--block" type="button" style="margin-top:14px" data-sheet-close>확인</button>
      `);
      const lock = $('#mbtiLock');
      if (lock){ lock.classList.add('is-open'); const cta = lock.querySelector('.lockbox__cta'); if (cta) cta.innerHTML = '<p class="unlocknote">🔓 잠금이 해제되었습니다 — 숨은 궁합이 열렸습니다.</p>'; }
    });
  });
}
function renderMbtiBirth(a, b){
  const sa = sajuOf(a, null), sb = sajuOf(b, null);
  const rel = relationOf(sa.ilgan.oh, sb.ilgan.oh);
  const za = sa.year.b.idx % 12, zb = sb.year.b.idx % 12;
  const isHap = HAP[za] === zb, isClash = CLASH[za] === zb;
  const score = Math.max(32, Math.min(97, 58 + rel.delta + (isHap ? 14 : 0) + (isClash ? -12 : 0)));
  const band = mbtiBand(score);
  const el = $('#mbtiResult');
  el.innerHTML = `
    <article class="vcard">
      <div class="vcard__band"><b>SAJU CHEMISTRY</b><span>${dateLabelOf(a)} × ${dateLabelOf(b)}</span></div>
      <div class="vcard__in">
        <span class="vcard__tag">${esc(rel.name)} · ${esc(band.title)}</span>
        <div class="score">
          <p class="score__num">${score}<span>점</span></p>
          <div class="score__meta">
            <b>${esc(sa.ilgan.h)}(${esc(sa.ilgan.k)}) × ${esc(sb.ilgan.h)}(${esc(sb.ilgan.k)})</b>
            <p>${isHap ? '띠가 합(合)을 이룹니다.' : isClash ? '띠가 충(沖)입니다. 큰 결정은 서두르지 마세요.' : '띠의 관계는 무난합니다.'}</p>
            <div class="score__bar"><i data-w="${score}"></i></div>
          </div>
        </div>
        <p class="vcard__deck">${esc(band.line)} 두 사람의 일간은 ${esc(sa.ilgan.k)}${josa(sa.ilgan,'gwa')} ${esc(sb.ilgan.k)} — ${esc(rel.short)}의 관계입니다.</p>
        <div class="vcard__cols">
          <div><h4>나의 사주</h4><p>${esc(sa.year.hanja)}年 ${esc(sa.month.hanja)}月 ${esc(sa.day.hanja)}日 · ${esc(OH[sa.lack].k)} 부족</p></div>
          <div><h4>상대의 사주</h4><p>${esc(sb.year.hanja)}年 ${esc(sb.month.hanja)}月 ${esc(sb.day.hanja)}日 · ${esc(OH[sb.lack].k)} 부족</p></div>
        </div>
        <div class="vcard__acts">
          <button class="btn btn--sm" type="button" data-mbti-share>궁합 카드 공유</button>
          <button class="btn btn--wine btn--sm" type="button" data-mbti-pay>점수의 이유 4P (990원)</button>
        </div>
        <p class="vcard__foot">생년월일 조합은 일간의 오행과 띠의 합·충만 반영한 간이 계산입니다. 정밀 궁합은 리포트에서 다룹니다.</p>
      </div>
    </article>`;
  const bar = el.querySelector('.score__bar i');
  requestAnimationFrame(() => { bar.style.width = score + '%'; });
  el.querySelector('[data-mbti-share]').addEventListener('click', () => {
    openShareCard({
      kicker:'SAJU CHEMISTRY', title:`${sa.ilgan.h}${sa.ilgan.k} × ${sb.ilgan.h}${sb.ilgan.k} — ${band.title}`,
      quote:band.line,
      kv:[['궁합 점수', `${score}점`], ['오행 관계', rel.short], ['띠 관계', isHap ? '합' : isClash ? '충' : '무난']],
      shareUrl:`${SITE}#/mbti`
    });
  });
  el.querySelector('[data-mbti-pay]').addEventListener('click', () => openPaywall('mbti'));
}
function bindMbti(){
  let me = STORE.get('mbtiMe', ''), you = STORE.get('mbtiYou', '');
  let mode = 'type';
  const selectPane = $('#mbtiTypePane'), birthPane = $('#mbtiBirthPane');
  $$('[data-mbti-group]').forEach(group => {
    group.addEventListener('click', (e) => {
      const b = e.target.closest('[data-mbti]'); if (!b) return;
      const name = group.dataset.mbtiGroup;
      if (name === 'me') me = b.dataset.mbti; else you = b.dataset.mbti;
      $$('.mbti-btn', group).forEach(x => x.classList.toggle('is-on', x === b));
      const lbl = $(`[data-mbti-val="${name}"]`); if (lbl) lbl.textContent = b.dataset.mbti;
      STORE.set(name === 'me' ? 'mbtiMe' : 'mbtiYou', b.dataset.mbti);
    });
  });
  $('#mbtiMode').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode]'); if (!b) return;
    mode = b.dataset.mode;
    $$('#mbtiMode button').forEach(x => x.classList.toggle('is-on', x === b));
    selectPane.hidden = mode !== 'type';
    birthPane.hidden = mode !== 'birth';
  });
  $('#mbtiGo').addEventListener('click', () => {
    if (mode === 'type'){
      if (!me || !you){ toast('두 사람의 MBTI를 모두 선택해 주세요'); return; }
      renderMbtiType(mbtiCompat(me, you));
    } else {
      const a = parseBirth($('#mbtiBirthPane [name="birthA"]').value);
      const b = parseBirth($('#mbtiBirthPane [name="birthB"]').value);
      if (!a || !b){ toast('두 사람의 생년월일을 입력해 주세요'); return; }
      renderMbtiBirth(a, b);
    }
    $('#mbtiResult').scrollIntoView({ behavior:'smooth', block:'center' });
  });
  if (me && you) renderMbtiType(mbtiCompat(me, you));
}

/* ---------- 10. 어젯밤 그 꿈 ---------- */
function dreamIndex(){
  const q = STORE.get('lastDream', '');
  if (q) return;
}
function matchDreams(q){
  const key = q.replace(/\s+/g, '');
  if (!key) return [];
  const scored = [];
  DREAMS.forEach((d, i) => {
    let score = 0;
    if (d.s === q || d.s.includes(q) || q.includes(d.s)) score += 10;
    d.k.forEach(k => { if (q.includes(k) || k.includes(q)) score += 7; });
    if (d.b.includes(q)) score += 3;
    if (score) scored.push({ d, score, i });
  });
  return scored.sort((a, b) => b.score - a.score);
}
function dreamLucky(q){
  const rng = rngOf('dream|' + q + '|' + TODAY_KEY);
  const nums = luckNumbers(rng, 6);
  const colorOh = Math.floor(rng() * 5);
  return { nums, color:LUCK_COLORS[colorOh][Math.floor(rng() * 3)] };
}
function dreamResultHTML(entry, q, auto){
  const lucky = dreamLucky(q);
  const omenMap = { gil:['길몽', 'omen--gil'], jung:['중길', 'omen--jung'], hyung:['주의', 'omen--hyung'] };
  const [omenTxt, omenCls] = omenMap[entry.o] || omenMap.jung;
  return `
    <article class="vcard">
      <div class="vcard__band"><b>DREAM READING</b><span>${esc(q)} · ${todayShort()}</span></div>
      <div class="vcard__in">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">
          <span class="vcard__tag" style="margin:0">${esc(entry.c)} · ${esc(entry.m)}</span>
          <span class="omen ${omenCls}">${omenTxt}${auto ? ' · 자동 매칭' : ''}</span>
        </div>
        <h2 class="vcard__title">${esc(entry.s)} — ${esc(entry.m)}</h2>
        <p class="vcard__deck">${esc(entry.b)}</p>
        <div style="border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:16px 0;margin-bottom:18px">
          <h4 style="font-size:11px;letter-spacing:.12em;color:var(--gold);margin-bottom:10px">행운 번호</h4>
          <div class="lnums">${lucky.nums.map(n => `<span class="lnum">${n}</span>`).join('')}</div>
          <p class="hint" style="margin-top:10px">행운의 색 — <span class="swatch" style="background:${lucky.color.hex}"></span> ${esc(lucky.color.name)}. 숫자와 색은 상징이며 어떤 구매도 권하지 않습니다.</p>
        </div>
        <div class="vcard__cols">
          <div><h4>오늘의 해석</h4><p>${esc(entry.o === 'hyung' ? '꿈은 경고가 아니라 신호입니다. 오늘은 큰 결정을 미루고 몸의 리듬을 먼저 회복하세요.' : entry.o === 'gil' ? '지금의 흐름이 열려 있습니다. 미뤄 둔 연락 하나가 이 흐름을 실제로 연결합니다.' : '방향은 맞지만 속도가 문제입니다. 오늘 결정하지 않아도 됩니다. 조건을 적어 두세요.')}</p></div>
          <div><h4>사주와 연결</h4><p>${esc(birthLink())}</p></div>
        </div>
        <div class="vcard__acts">
          <button class="btn btn--sm" type="button" data-dream-share>행운 번호 카드 공유</button>
          <button class="btn btn--wine btn--sm" type="button" data-dream-pay>이번 주 꿈 리포트 4P</button>
        </div>
        <p class="vcard__foot">꿈 해석은 상징 사전에 기반한 참고용 콘텐츠입니다. 의료·심리 상담을 대체하지 않습니다.</p>
      </div>
    </article>`;
}
function birthLink(){
  const b = STORE.get('birth', null);
  if (!b) return '생년월일을 넣으면 꿈의 상징이 내 사주의 어느 자리에서 올라왔는지 함께 볼 수 있습니다. 오늘 내 운명에서 먼저 등록해 보세요.';
  const p = sajuOf(b, null);
  return `내 일간은 ${p.ilgan.h}(${p.ilgan.k}), 부족한 기운은 ${OH[p.lack].k}입니다. 꿈의 상징은 대개 부족한 ${OH[p.lack].k}을 채우려는 밤의 움직임으로 나타납니다.`;
}
function viewDream(){
  return `
  ${pageHeroHTML('dream')}
  <section class="sect sect--tight">
    <div class="shell">
      <div class="stage">
        <div class="panel panel--sticky">
          <div class="panel__head"><span class="panel__num">01</span><h2 class="panel__title">꿈 키워드</h2><p class="panel__sub">상징 ${DREAMS.length}편</p></div>
          <form id="dreamForm">
            <div class="dream-search">
              <input class="input" type="search" name="q" placeholder="예: 뱀, 이빨 빠지는, 바다" aria-label="꿈 키워드" autocomplete="off">
              <button class="btn btn--wine" type="submit">풀이</button>
            </div>
          </form>
          <p class="hint" style="margin-bottom:14px">단어 하나면 충분합니다. 사전에 없는 꿈도 자동 매칭으로 풀이합니다.</p>
          <div class="dream-cats" id="dreamCats">
            ${DREAM_CATS.map((c, i) => `<button class="chip ${i === 0 ? 'is-on' : ''}" type="button" data-cat="${c}">${c}</button>`).join('')}
          </div>
          <div class="dream-suggest" style="margin-top:14px">
            ${['뱀','이빨','바다','돼지','불','쫓기는','죽음','돈','고양이','결혼'].map(k => `<button type="button" data-suggest="${k}">#${k}</button>`).join('')}
          </div>
          <p class="panel__foot">꿈에 나온 것을 그대로 적어 보세요. 사전에 없는 단어는 가장 가까운 상징과 조합해 풀이합니다.</p>
        </div>
        <div class="result" id="dreamResult">
          ${emptyState('夢', '어젯밤 어떤 꿈을 꾸셨나요?', '키워드 하나를 넣으면 상징 풀이와 길흉, 그리고 행운 번호까지 한 장으로 정리해 드립니다.')}
        </div>
      </div>
      <div style="margin-top:38px">
        <div class="secthead"><p class="secthead__no">사전</p><div><h2 class="secthead__title">꿈 상징 사전</h2><p class="secthead__desc">동물·자연·사람·신체·장소·사물·행동 — ${DREAMS.length}개의 상징을 수록했습니다. 항목을 누르면 바로 풀이가 열립니다.</p></div><p class="secthead__en">Dictionary</p></div>
        <div class="dream-list" id="dreamList"></div>
        <div style="text-align:center;margin-top:22px"><button class="btn btn--line" type="button" id="dreamMore">더 보기</button></div>
      </div>
      ${routeSwitch('dream')}
    </div>
  </section>`;
}
let dreamShown = 12, dreamCat = '전체';
function renderDreamList(){
  const list = DREAMS.filter(d => dreamCat === '전체' || d.c === dreamCat);
  const show = STORE.get('dreamAll', false) ? list : list.slice(0, dreamShown);
  $('#dreamList').innerHTML = show.map(d => `
    <button class="dream-item" type="button" data-dream="${esc(d.s)}">
      <span class="dream-item__ch">${esc(d.s.charAt(0))}</span>
      <span><b>${esc(d.s)}</b><span>${esc(d.m)} · ${esc(d.c)}</span></span>
      <i>${d.o === 'gil' ? '길' : d.o === 'hyung' ? '주의' : '중길'}</i>
    </button>`).join('');
  const more = $('#dreamMore');
  if (more) more.style.display = STORE.get('dreamAll', false) || list.length <= dreamShown ? 'none' : 'inline-flex';
  $$('[data-dream]').forEach(b => b.addEventListener('click', () => runDream(b.dataset.dream)));
}
function runDream(q){
  q = String(q || '').trim();
  if (!q){ toast('꿈 키워드를 입력해 주세요'); return; }
  STORE.set('lastDream', q);
  const hits = matchDreams(q);
  let entry, auto = false;
  if (hits.length){
    entry = hits[0].d;
    if (hits.length > 1 && hits[0].score === hits[1].score){
      const second = hits[1].d;
      entry = { ...entry, b: entry.b + ' 함께 나온 ' + second.s + '의 상징도 겹칩니다 — ' + second.b };
    }
  } else {
    const rng = rngOf('auto|' + q + '|' + TODAY_KEY);
    const base = DREAMS[Math.floor(rng() * DREAMS.length)];
    const omen = ['gil','jung','hyung'][Math.floor(rng() * 3)];
    const tail = pickFrom(DREAM_AUTO[omen], rng);
    entry = {
      s: q, c:'자동 매칭', o:omen, m:'사전에 없는 꿈',
      b: '사전에 정확히 없는 꿈입니다. 가장 가까운 상징 ' + base.s + '의 결을 빌려 읽습니다. ' + base.b + ' ' + tail
    };
    auto = true;
  }
  $('#dreamResult').innerHTML = dreamResultHTML(entry, q, auto);
  const body = $('#dreamResult');
  body.querySelector('[data-dream-share]').addEventListener('click', () => {
    const lucky = dreamLucky(q);
    openShareCard({
      kicker:'DREAM · ' + todayShort(), title:`"${q}" 꿈 — ${entry.m}`,
      quote:entry.b.slice(0, 90) + (entry.b.length > 90 ? '…' : ''),
      kv:[['상징', entry.s], ['판정', entry.o === 'gil' ? '길몽' : entry.o === 'hyung' ? '주의' : '중길'], ['행운의 색', lucky.color.name]],
      nums:lucky.nums, numsLabel:'행운 번호',
      shareUrl:`${SITE}#/dream`
    });
  });
  body.querySelector('[data-dream-pay]').addEventListener('click', () => openPaywall('dream'));
  if (window.innerWidth < 860) body.scrollIntoView({ behavior:'smooth', block:'start' });
}
function bindDream(){
  dreamShown = 12;
  renderDreamList();
  $('#dreamForm').addEventListener('submit', (e) => { e.preventDefault(); runDream(e.target.querySelector('[name="q"]').value); });
  $('#dreamCats').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]'); if (!b) return;
    dreamCat = b.dataset.cat;
    $$('#dreamCats .chip').forEach(x => x.classList.toggle('is-on', x === b));
    renderDreamList();
  });
  $$('[data-suggest]').forEach(b => b.addEventListener('click', () => {
    $('#dreamForm [name="q"]').value = b.dataset.suggest; runDream(b.dataset.suggest);
  }));
  $('#dreamMore').addEventListener('click', () => { STORE.set('dreamAll', true); renderDreamList(); });
  const last = STORE.get('lastDream', '');
  if (last){ $('#dreamForm [name="q"]').value = last; }
}

/* ---------- 11. 전생 ---------- */
function viewPastlife(){
  return `
  ${pageHeroHTML('pastlife')}
  <section class="sect sect--tight">
    <div class="shell">
      <div class="stage">
        <form class="panel panel--sticky" id="plForm" novalidate>
          <div class="panel__head"><span class="panel__num">01</span><h2 class="panel__title">전생을 읽는 정보</h2><p class="panel__sub">3개 항목</p></div>
          <label class="field">
            <span class="field__label">생년월일 <span>필수 · 양력</span></span>
            <input class="input" type="date" name="birth" min="1900-01-01" max="${AGE_MAX}" value="${STORE.get('birth', null) ? dateLabelOf(STORE.get('birth')).replace(/\./g,'-') : ''}">
          </label>
          <div class="field">
            <span class="field__label">태어난 시간 <span>선택</span></span>
            <div class="row2">
              <select class="input" name="hour">
                <option value="">시간 모름</option>
                ${Array.from({ length:24 }, (_, h) => `<option value="${h}">${String(h).padStart(2,'0')}:00경</option>`).join('')}
              </select>
              <label class="check" style="margin:0;align-items:center;border:1px solid var(--line-2);padding:11px 12px;background:var(--paper-2)">
                <input type="checkbox" name="unknownHour" checked> 시간 모름
              </label>
            </div>
            <span class="hint">시간을 모르면 시주(時柱)를 빼고 세 기둥으로 계산합니다.</span>
          </div>
          <div class="field">
            <span class="field__label">성별 <span>필수</span></span>
            <div class="seg" id="plGender">
              <button type="button" class="is-on" data-g="f">여성</button>
              <button type="button" data-g="m">남성</button>
            </div>
          </div>
          <button class="btn btn--wine btn--block" type="submit">내 전생 보기 <span class="btn__arw">→</span></button>
          <p class="panel__foot">전생은 상징 해석입니다. 지금의 습관과 성향을 비추는 거울로만 봐 주세요.</p>
        </form>
        <div class="result" id="plResult">
          ${emptyState('前', '전생의 문이 닫혀 있습니다', '생년월일과 성별을 넣으면 전생의 역할과 지금 남아 있는 습관을 보여 드립니다.')}
        </div>
      </div>
      ${routeSwitch('pastlife')}
    </div>
  </section>`;
}
function renderPastlife(res){
  const t = res.type, el = $('#plResult');
  const unlocked = STORE.get('plUnlock', false);
  el.innerHTML = `
    <article class="vcard">
      <div class="vcard__band"><b>PAST LIFE</b><span>${esc(res.era)} · ${res.gender === 'f' ? '여성' : res.gender === 'm' ? '남성' : '미상'}</span></div>
      <div class="vcard__in">
        <div class="pl-type">
          <div class="pl-emblem">${t.emblem}</div>
          <div>
            <p class="pl-era">${esc(res.era)}</p>
            <h2 class="pl-role">${esc(t.role)}</h2>
            <p style="font-size:12.5px;color:var(--muted);margin-top:6px">${esc(t.oneLine)}</p>
          </div>
        </div>
        <p class="vcard__deck">${esc(t.link)}</p>
        <dl class="vcard__kv">
          <div><dt>전생의 직업</dt><dd>${esc(t.job)}</dd></div>
          <div><dt>남은 습관</dt><dd style="font-size:13px;font-family:var(--sans);font-weight:500">${esc(t.habit)}</dd></div>
          <div><dt>전생의 숙제</dt><dd style="font-size:13px;font-family:var(--sans);font-weight:500">${esc(t.lesson)}</dd></div>
        </dl>
        <blockquote class="vcard__quote">“${esc(t.oneLine)}”</blockquote>
        <div class="vcard__cols">
          <div><h4>현생으로 이어진 것</h4><p>${esc(t.link)}</p></div>
          <div><h4>이번 생의 처방</h4><p>${esc(t.lesson)}. 이것이 전생에서 남은 마지막 숙제입니다.</p></div>
        </div>
        <div class="vcard__acts">
          <button class="btn btn--sm" type="button" data-pl-share>전생 카드 공유</button>
          <button class="btn btn--wine btn--sm" type="button" data-pl-pay>전생 상세 4P (990원)</button>
        </div>
        <p class="vcard__foot">전생 풀이는 상징 해석 기반의 참고용 콘텐츠입니다.</p>
      </div>
    </article>
    <div class="lockbox ${unlocked ? 'is-open' : ''}" style="margin-top:16px" id="plLock">
      <p class="eyebrow eyebrow--ink">HIDDEN PAST LIFE</p>
      <h3 style="font-family:var(--serif);font-size:19px;font-weight:800;letter-spacing:-.03em;margin:10px 0 6px">숨겨진 전생 하나 — 친구 3명을 넣으면 열립니다</h3>
      <p class="hint" style="margin-bottom:14px">전생은 하나가 아닙니다. 친구 셋의 이름을 넣으면 두 번째 전생이 열립니다.</p>
      <div class="lockbox__veil" id="plVeil">
        <div style="display:flex;gap:16px;align-items:center">
          <div class="pl-emblem" style="width:66px;height:66px;font-size:24px">${res.second.emblem}</div>
          <div><p class="pl-era">${esc(res.second.era)}</p><p class="pl-role" style="font-size:18px">${esc(res.second.role)}</p></div>
        </div>
        <p style="font-size:12.5px;color:var(--ink-3);line-height:1.75;margin-top:10px">${esc(res.second.oneLine)} — ${esc(res.second.lesson)}</p>
      </div>
      <div class="lockbox__cta">
        ${unlocked ? '<p class="unlocknote">🔓 잠금이 해제되었습니다 — 두 번째 전생이 열렸습니다.</p>'
          : '<button class="btn btn--gold" type="button" id="plUnlockBtn">친구 3명 입력하고 잠금 해제</button>'}
      </div>
    </div>`;
  el.querySelector('[data-pl-share]').addEventListener('click', () => {
    openShareCard({
      kicker:'PAST LIFE · ' + res.era, title:`${t.role}`,
      quote:t.oneLine + '. ' + t.link,
      kv:[['전생 직업', t.job], ['남은 습관', t.habit], ['숙제', t.lesson]],
      glyph:t.emblem, glyphLabel:'전생의 표식',
      shareUrl:`${SITE}#/pastlife`
    });
  });
  el.querySelector('[data-pl-pay]').addEventListener('click', () => openPaywall('pastlife'));
  const ub = $('#plUnlockBtn');
  if (ub) ub.addEventListener('click', () => {
    openSheet(`
      <p class="eyebrow">UNLOCK · HIDDEN PAST LIFE</p>
      <h2 class="pay__title" id="sheetTitle" style="margin:10px 0 8px">친구 3명을 입력하세요</h2>
      <p class="hint" style="margin-bottom:16px">이름만 넣어도 됩니다. 입력값은 브라우저에만 저장됩니다.</p>
      <div class="friendrow">
        <input class="input" type="text" placeholder="친구 1" maxlength="12" name="f1">
        <input class="input" type="text" placeholder="친구 2" maxlength="12" name="f2">
        <input class="input" type="text" placeholder="친구 3" maxlength="12" name="f3">
      </div>
      <button class="btn btn--wine btn--block" type="button" id="plUnlockGo">잠금 해제</button>
    `);
    $('#plUnlockGo').addEventListener('click', () => {
      const names = ['f1','f2','f3'].map(n => $('#sheetBody').querySelector(`[name="${n}"]`).value.trim());
      if (names.some(n => !n)){ toast('세 명 모두 입력해 주세요'); return; }
      STORE.set('plUnlock', true); STORE.set('plFriends', names);
      closeSheet();
      const lock = $('#plLock');
      if (lock){ lock.classList.add('is-open'); const cta = lock.querySelector('.lockbox__cta'); if (cta) cta.innerHTML = '<p class="unlocknote">🔓 잠금이 해제되었습니다 — 두 번째 전생이 열렸습니다.</p>'; }
      toast('두 번째 전생이 열렸습니다');
    });
  });
}
function bindPastlife(){
  const form = $('#plForm');
  let gender = 'f';
  $('#plGender').addEventListener('click', (e) => {
    const b = e.target.closest('[data-g]'); if (!b) return;
    gender = b.dataset.g;
    $$('#plGender button').forEach(x => x.classList.toggle('is-on', x === b));
  });
  const unknown = form.querySelector('[name="unknownHour"]'), hourSel = form.querySelector('[name="hour"]');
  unknown.addEventListener('change', () => { hourSel.disabled = unknown.checked; if (unknown.checked) hourSel.value = ''; });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const birth = birthOfForm(form);
    if (!birth){ toast('생년월일을 입력해 주세요'); return; }
    const hour = unknown.checked ? null : (hourSel.value === '' ? null : Number(hourSel.value));
    const res = pastlifeOf(birth, hour, gender);
    STORE.set('birth', birth);
    renderPastlife(res);
    $('#plResult').scrollIntoView({ behavior:'smooth', block:'center' });
  });
}

/* ---------- 12. 운 부르는 것들 ---------- */
function viewShop(){
  const params = new URLSearchParams((location.hash.split('?')[1] || ''));
  const initial = params.get('oh') || STORE.get('shopTab', 'all');
  return `
  ${pageHeroHTML('shop')}
  <section class="sect sect--tight">
    <div class="shell">
      <div class="stage stage--wide">
        <div>
          <div class="secthead">
            <p class="secthead__no">選</p>
            <div><h2 class="secthead__title">부족한 오행을 채우는 것들</h2>
            <p class="secthead__desc">내 사주의 모자란 기운을 고르면, 그 기운을 보완하는 물건과 책을 보여 드립니다. 생년월일을 등록했다면 자동으로 계산됩니다.</p></div>
            <p class="secthead__en">Curated Objects</p>
          </div>
          <div class="shop-filter" id="shopFilter">
            ${SHOP_TABS.map(t => `<button class="chip ${String(t.id) === String(initial) ? 'is-on' : ''}" type="button" data-tab="${t.id}">${t.name}</button>`).join('')}
            <button class="btn btn--line btn--sm" type="button" id="autoOh" style="margin-left:auto">내 부족 오행 자동 계산</button>
          </div>
          <p class="hint" id="lackNote" style="margin-bottom:20px"></p>
          <div class="shop-grid" id="shopGrid"></div>
          <p class="shop-note">${esc(SHOP_NOTE)}</p>
        </div>
      </div>

      <div class="secthead" style="margin-top:clamp(40px,5vw,70px)">
        <p class="secthead__no">↗</p>
        <div><h2 class="secthead__title">왜 이 물건인가 — 심층 분석</h2>
        <p class="secthead__desc">아이템은 상징입니다. 왜 내 사주에 그 기운이 필요한지, 어느 자리에 두어야 하는지는 리포트에서 숫자와 시기까지 다룹니다.</p></div>
        <p class="secthead__en">Deep Report</p>
      </div>
      <div class="plans plans--light">
        ${PLANS.map(p => `
          <a class="plan ${p.badge ? 'plan--best' : ''}" href="${AURA}" target="_blank" rel="noopener">
            ${p.badge ? `<span class="plan__badge">${p.badge}</span>` : ''}
            <p class="plan__p">${p.p}</p>
            <p class="plan__price">${p.price}<span>원</span></p>
            <p class="plan__for">${p.forLine}</p>
            <ul class="plan__list">${p.list.map(li => `<li>${li}</li>`).join('')}</ul>
            <span class="plan__cta">신청하기 →</span>
          </a>`).join('')}
      </div>
      <div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap">
        <a class="btn btn--wine" href="${KAKAO}" target="_blank" rel="noopener">구매·상담 문의 <span class="btn__arw">→</span></a>
        <a class="btn btn--line" href="saju-program-preview.html" target="_blank" rel="noopener">만세력 프로그램 체험</a>
      </div>
      ${routeSwitch('shop')}
    </div>
  </section>`;
}
function renderShop(tab){
  const list = tab === 'all' ? SHOP_ITEMS : SHOP_ITEMS.filter(i => String(i.oh) === String(tab));
  $('#shopGrid').innerHTML = list.map(i => {
    const O = i.oh === 'fs' ? { k:'풍수', h:'風', key:'feng' } : i.oh === 'book' ? { k:'책', h:'書', key:'book' } : OH[+i.oh];
    return `<article class="pcard">
      <div class="pcard__oh"><b>${esc(O.h)}</b><span>${esc(i.kind)}</span></div>
      <div class="pcard__b">
        <p class="pcard__kind">${esc(i.kind)} · ${esc(O.k)}</p>
        <h3>${esc(i.name)}</h3>
        <p>${esc(i.why)}</p>
        <div class="pcard__price"><b>${esc(i.price)}</b><span style="font-size:10.5px">${esc(i.mat)}</span></div>
      </div>
    </article>`;
  }).join('');
  const note = $('#lackNote');
  const lack = STORE.get('lack', null);
  if (note){
    note.innerHTML = lack === null
      ? '생년월일을 등록하면 부족한 오행을 자동으로 표시합니다. <a href="#/today" style="border-bottom:1px solid var(--line-2);color:var(--wine)">오늘 내 운명에서 등록 →</a>'
      : `내 사주에서 가장 적은 기운은 <b>${OH[lack].k}(${OH[lack].h})</b>입니다. 아래 ${OH[lack].k} 항목부터 보세요. <a href="#/today" style="border-bottom:1px solid var(--line-2);color:var(--wine)">다시 계산 →</a>`;
  }
}
function bindShop(){
  const params = new URLSearchParams((location.hash.split('?')[1] || ''));
  let tab = params.get('oh') || STORE.get('shopTab', 'all');
  renderShop(tab);
  $('#shopFilter').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    tab = b.dataset.tab; STORE.set('shopTab', tab);
    $$('#shopFilter .chip').forEach(x => x.classList.toggle('is-on', x === b));
    renderShop(tab);
  });
  $('#autoOh').addEventListener('click', () => {
    const b = STORE.get('birth', null);
    if (!b){ toast('먼저 오늘 내 운명에서 생년월일을 등록해 주세요'); return; }
    const p = sajuOf(b, null);
    STORE.set('lack', p.lack);
    tab = String(p.lack);
    $$('#shopFilter .chip').forEach(x => x.classList.toggle('is-on', x.dataset.tab === tab));
    renderShop(tab);
    toast(`${OH[p.lack].k} 기운이 가장 적습니다 — ${OH[p.lack].k} 항목을 보여 드립니다`);
  });
}

/* ---------- 13. 라우터 ---------- */
const VIEWS = { today:viewToday, people:viewPeople, mbti:viewMbti, dream:viewDream, pastlife:viewPastlife, shop:viewShop };
const BIND = { today:bindToday, people:bindPeople, mbti:bindMbti, dream:bindDream, pastlife:bindPastlife, shop:bindShop };
function currentRoute(){
  const h = location.hash.replace(/^#\/?/, '');
  const route = h.split('?')[0].split('#')[0];
  return route && VIEWS[route] ? route : (route === 'lab' ? 'lab' : 'home');
}
function parseHash(){
  const raw = location.hash.replace(/^#\/?/, '');
  const hashPart = raw.includes('#') ? raw.split('#')[1] : '';
  const route = raw.split('?')[0].split('#')[0];
  return { route: route || '', anchor: hashPart, query: raw.split('?')[1] || '' };
}
function render(){
  const { route, anchor } = parseHash();
  const app = $('#app');
  const isHome = !route || route === 'home' || route === 'lab';
  if (isHome){
    app.innerHTML = viewHome();
    syncNav();
    bindHome();
    if (route === 'lab' || anchor === 'lab'){
      setTimeout(() => { const el = document.getElementById('lab'); if (el) el.scrollIntoView({ behavior:'smooth', block:'start' }); }, 120);
    } else if (anchor){
      setTimeout(() => { const el = document.getElementById(anchor); if (el) el.scrollIntoView({ behavior:'smooth', block:'start' }); }, 120);
    } else {
      window.scrollTo({ top:0, behavior:'auto' });
    }
  } else {
    const view = VIEWS[route];
    app.innerHTML = view();
    syncNav();
    BIND[route]();
    if (anchor) setTimeout(() => { const el = document.getElementById(anchor); if (el) el.scrollIntoView({ behavior:'smooth' }); }, 120);
    else window.scrollTo({ top:0, behavior:'auto' });
  }
  initReveal();
  document.title = isHome
    ? '정운타임즈 | 운명사주, 정운이 풀다'
    : `${COVERS.find(c => c.id === route).ko} | 정운타임즈`;
}
function bindHome(){
  const labBtn = $('#labStart');
  if (labBtn) labBtn.addEventListener('click', openLabQuiz);
  $$('[data-article]').forEach(b => b.addEventListener('click', (e) => {
    if (b.tagName === 'A'){ e.preventDefault(); openArticle(b.dataset.article); }
    else openArticle(b.dataset.article);
  }));
  const nl = $('#nlForm');
  if (nl) nl.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = nl.querySelector('[name="email"]').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ toast('이메일을 확인해 주세요'); return; }
    location.href = `mailto:22jutimes@gmail.com?subject=${encodeURIComponent('[정운타임즈] 주간 레터 신청')}&body=${encodeURIComponent('수신 이메일: ' + email + '\n\n주간 사주 편지를 신청합니다.')}`;
    toast('메일 앱이 열립니다. 전송을 눌러 주세요');
  });
}
function initReveal(){
  const els = $$('[data-reveal]');
  if (!('IntersectionObserver' in window)){ els.forEach(e => e.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(en => { if (en.isIntersecting){ en.target.classList.add('is-in'); io.unobserve(en.target); } });
  }, { rootMargin:'0px 0px -8% 0px', threshold:.08 });
  els.forEach((el, i) => {
    const d = el.dataset.delay ? Math.min(+el.dataset.delay, 6) * 70 : 0;
    el.style.transitionDelay = d + 'ms';
    io.observe(el);
  });
}

/* ---------- 14. 부트 ---------- */
function boot(){
  initHeader();
  render();
  window.addEventListener('hashchange', () => { closeSheet(); render(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape'){
      const dr = $('#drawer'); if (!dr.hidden){ dr.hidden = true; $('#burger').setAttribute('aria-expanded','false'); document.body.classList.remove('is-locked'); }
    }
  });
}
document.addEventListener('DOMContentLoaded', boot);
