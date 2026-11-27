/* ============================================================================
   운명사주 정운타임즈 · fourp.js
   990원 4P 특별분석 — 실제 만세력 엔진(saju-engine.js = korean-saju 0.3.0 이식)으로
   신청자의 생년월일시(양/음력·성별·이름)를 계산해 4P 지면을 개인화한다.
   - 입력: URL 파라미터(?n=이름&g=여&c=solar&y=1980&m=1&d=22&t=1716) 또는 지면 폼
   - 계산: 년주·월주·일주·시주 / 오행 비율 / 십성 / 격국 / 억부(신강·신약) / 용신 /
           대운 / 2027 정미년 세운 / 월별 길흉
   - 출력: 지면별 리포트 HTML (지면은 4p/04.html 단일 — 요약 3장판, 하얀 지면)
   ========================================================================== */
(function () {
  'use strict';

  var E = window.SajuEngine;
  if (!E || !E.calculate) {
    if (window.console) console.error('[4P] 만세력 엔진(saju-engine.js)을 불러오지 못했습니다.');
    return;
  }

  var V = parseInt((document.body && document.body.getAttribute('data-fourp')) || '1', 10);
  if (!(V >= 1 && V <= 4)) V = 1;

  var TABLES = E.tables;
  var STEMS = TABLES.STEMS, BRANCHES = TABLES.BRANCHES;
  var OHK = ['목', '화', '토', '금', '수'];
  var OHH = ['木', '火', '土', '金', '水'];
  var SIP = TABLES.SIP;
  var UNSEONG = TABLES.UNSEONG;

  /* ------------------------------------------------------------------ *
   * 유틸
   * ------------------------------------------------------------------ */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function hanjaOf(p) { return p && p.ganji ? p.ganji.hanja : ''; }
  function jj(word, kind){
    var w = String(word || '');
    if (!w) return w;
    var c = w.charCodeAt(w.length - 1);
    var hasBatchim = (c >= 0xAC00 && c <= 0xD7A3) ? ((c - 0xAC00) % 28 !== 0) : '013678mnlrMNLR'.indexOf(w[w.length-1]) >= 0;
    var withB = { '은':'은','이':'이','을':'을','과':'과','으로':'으로' }[kind] || '';
    var noB   = { '은':'는','이':'가','을':'를','과':'와','으로':'로' }[kind] || '';
    if (kind === '으로' && c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 === 8) return '로';
    return hasBatchim ? withB : noB;
  }
  function won(n) { return Number(n).toLocaleString('ko-KR'); }

  /* ------------------------------------------------------------------ *
   * 1. 입력 — URL 파라미터 / 지면 폼
   * ------------------------------------------------------------------ */
  var PARAM_KEYS = ['n', 'g', 'c', 'lp', 'y', 'm', 'd', 't', 'u'];

  function readParams() {
    var q = new URLSearchParams(window.location.search || '');
    if (!PARAM_KEYS.some(function (k) { return q.has(k); })) return null;
    var y = parseInt(q.get('y'), 10), m = parseInt(q.get('m'), 10), d = parseInt(q.get('d'), 10);
    if (!(y && m && d)) return null;
    var t = (q.get('t') || '').replace(/[^0-9]/g, '');
    var hourKnown = q.get('u') !== '1' && t.length >= 3;
    return {
      name: (q.get('n') || '').trim(),
      gender: q.get('g') === '여' ? '여' : '남',
      calendar: q.get('c') === 'lunar' ? 'lunar' : 'solar',
      lunarLeap: q.get('lp') === '1',
      y: y, mo: m, d: d,
      hourKnown: hourKnown,
      h: hourKnown ? parseInt(t.slice(0, t.length - 2), 10) : 0,
      mi: hourKnown ? parseInt(t.slice(-2), 10) : 0,
      standardTime: true
    };
  }

  function formHTML() {
    return '' +
      '<div class="input-row"><label for="fpName">이름 (없으면 비워도 됩니다)</label>' +
      '<input type="text" id="fpName" maxlength="20" placeholder="이름 (예: 김하늘)" autocomplete="name"></div>' +
      '<div class="input-row fp-two">' +
      '  <div><label for="fpGender">성별</label><select id="fpGender"><option value="여">여성</option><option value="남">남성</option></select></div>' +
      '  <div><label for="fpCal">달력</label><select id="fpCal"><option value="solar">양력</option><option value="lunar">음력</option></select></div>' +
      '</div>' +
      '<div class="input-row" id="fpLeapRow" style="display:none"><label class="fp-check"><input type="checkbox" id="fpLeap"> 음력 윤달입니다</label></div>' +
      '<div class="input-row"><label for="fpBirth">생년월일</label><input type="date" id="fpBirth" min="1900-01-01" max="2026-12-31"></div>' +
      '<div class="input-row"><label class="fp-check"><input type="checkbox" id="fpTimeKnown" checked> 태어난 시각을 압니다 (모르면 체크 해제)</label></div>' +
      '<div class="input-row fp-two" id="fpTimeRow">' +
      '  <div><label for="fpHour">시</label><select id="fpHour"></select></div>' +
      '  <div><label for="fpMin">분</label><select id="fpMin"></select></div>' +
      '</div>' +
      '<p class="fp-formnote">입력한 정보는 서버로 보내지 않고, 이 화면 안에서만 계산합니다.</p>';
  }

  function ensureForm() {
    var host = $('.input-group');
    if (host) { host.innerHTML = formHTML(); }
    else {
      var card = $('.free-card');
      var box = document.createElement('div');
      box.className = 'input-group';
      box.style.marginTop = '18px';
      box.innerHTML = formHTML();
      if (card) card.insertBefore(box, card.querySelector('.kakao-btn'));
      else return;
    }
    // 시·분 옵션
    var hSel = $('#fpHour'), mSel = $('#fpMin');
    if (hSel) {
      for (var h = 0; h < 24; h++) {
        var o = document.createElement('option');
        o.value = h; o.textContent = pad2(h) + '시';
        hSel.appendChild(o);
      }
      hSel.value = '12';
    }
    if (mSel) {
      for (var mi = 0; mi < 60; mi += 5) {
        var om = document.createElement('option');
        om.value = mi; om.textContent = pad2(mi) + '분';
        mSel.appendChild(om);
      }
      mSel.value = '0';
    }
    var cal = $('#fpCal'), leapRow = $('#fpLeapRow');
    if (cal && leapRow) cal.addEventListener('change', function () {
      leapRow.style.display = cal.value === 'lunar' ? '' : 'none';
    });
    var tk = $('#fpTimeKnown'), timeRow = $('#fpTimeRow');
    if (tk && timeRow) tk.addEventListener('change', function () {
      timeRow.style.display = tk.checked ? '' : 'none';
    });
    $$('.kakao-btn, [data-fp-go]').forEach(function (b) {
      if (b.getAttribute('data-fp-bound')) return;
      b.setAttribute('data-fp-bound', '1');
      b.removeAttribute('onclick');
      b.addEventListener('click', function (ev) {
        ev.preventDefault();
        go();
      });
    });
  }

  function readForm() {
    var nameEl = $('#fpName'), gEl = $('#fpGender'), cEl = $('#fpCal');
    var bEl = $('#fpBirth'), tkEl = $('#fpTimeKnown'), hEl = $('#fpHour'), mEl = $('#fpMin');
    var leapEl = $('#fpLeap');
    if (!bEl) return null;
    var raw = bEl.value;
    if (!raw) { flash('생년월일을 넣어 주세요.'); return null; }
    var p = raw.split('-').map(Number);
    var hourKnown = !tkEl || tkEl.checked;
    return {
      name: (nameEl && nameEl.value || '').trim(),
      error: null,
      gender: gEl && gEl.value === '남' ? '남' : '여',
      calendar: cEl && cEl.value === 'lunar' ? 'lunar' : 'solar',
      lunarLeap: !!(leapEl && leapEl.checked),
      y: p[0], mo: p[1], d: p[2],
      hourKnown: hourKnown,
      h: hourKnown ? parseInt(hEl && hEl.value || '0', 10) : 0,
      mi: hourKnown ? parseInt(mEl && mEl.value || '0', 10) : 0,
      standardTime: true
    };
  }

  function flash(msg) {
    var el = document.getElementById('fpFlash');
    if (!el) {
      el = document.createElement('p');
      el.id = 'fpFlash';
      el.className = 'fp-flash';
      var step = document.getElementById('step-hooking');
      if (step) step.appendChild(el);
    }
    el.textContent = msg;
    el.style.display = 'block';
  }

  function fillForm(p) {
    if (!p) return;
    var set = function (id, v) { var e = document.getElementById(id); if (e && v != null) e.value = v; };
    set('fpName', p.name || '');
    set('fpGender', p.gender);
    set('fpCal', p.calendar === 'lunar' ? 'lunar' : 'solar');
    set('fpBirth', p.y + '-' + pad2(p.mo) + '-' + pad2(p.d));
    var leap = document.getElementById('fpLeap'), leapRow = document.getElementById('fpLeapRow');
    if (leap) leap.checked = !!p.lunarLeap;
    if (leapRow) leapRow.style.display = p.calendar === 'lunar' ? '' : 'none';
    var tk = document.getElementById('fpTimeKnown');
    if (tk) tk.checked = !!p.hourKnown;
    set('fpHour', p.h); set('fpMin', p.mi);
    var tr = document.getElementById('fpTimeRow');
    if (tr) tr.style.display = p.hourKnown ? '' : 'none';
  }

  /* ------------------------------------------------------------------ *
   * 2. 모델 — 실제 계산값에서 지수와 문장을 만든다
   * ------------------------------------------------------------------ */
  var JAE = [4, 5], GWAN = [6, 7], SIK = [2, 3], IN = [8, 9], BI = [0, 1];
  function sumOf(sipCounts, idx) { return idx.reduce(function (a, i) { return a + sipCounts[i]; }, 0); }

  var OH_IMG = {
    목: { img: '곧게 자라는 나무', key: '시작과 성장', body: '간·눈·인대', season: '봄', dir: '동쪽', color: '청록', num: '3·8' },
    화: { img: '위로 타오르는 불', key: '표현과 열정', body: '심장·혈관', season: '여름', dir: '남쪽', color: '주홍', num: '2·7' },
    토: { img: '두터운 땅', key: '중심과 신뢰', body: '위장·소화', season: '환절기', dir: '중앙', color: '황토', num: '5·10' },
    금: { img: '단단한 쇠', key: '결단과 질서', body: '폐·피부', season: '가을', dir: '서쪽', color: '은백', num: '4·9' },
    수: { img: '깊은 물', key: '지혜와 저장', body: '신장·뼈', season: '겨울', dir: '북쪽', color: '먹빛', num: '1·6' }
  };
  var GYEOK_DESC = {
    '정인격': '받아들이고 익혀 자기 것으로 만드는 힘', '편인격': '남들이 보지 못하는 각도로 파고드는 힘',
    '식신격': '꾸준히 만들어 내는 손', '상관격': '기존의 틀을 뒤집는 표현력',
    '편재격': '판을 크게 보고 사람을 움직이는 감각', '정재격': '새지 않게 모으고 지키는 계산',
    '편관격': '압박 속에서도 버티는 추진력', '정관격': '규칙과 신뢰로 쌓는 자리',
    '건록격': '스스로 서서 끝까지 해내는 자립심', '양인격': '한번 정하면 물러서지 않는 결단',
    '지지합화격': '주변과 엮이며 판을 만드는 힘'
  };

  function buildModel(input) {
    var r;
    try { r = E.calculate(input); }
    catch (err) { return { error: err && err.message ? err.message : '계산할 수 없는 날짜입니다.' }; }

    var dayOh = r.dayMaster.oh;
    var dayStem = r.dayMaster.stem;
    var sip = r.sipCounts.slice();
    var nJae = sumOf(sip, JAE), nGwan = sumOf(sip, GWAN), nSik = sumOf(sip, SIK),
        nIn = sumOf(sip, IN), nBi = sumOf(sip, BI);
    var spouseN = r.input.gender === '여' ? nGwan : nJae;
    var spouseOh = r.input.gender === '여' ? (dayOh + 3) % 5 : (dayOh + 2) % 5;

    var jaeOh = (dayOh + 2) % 5, gwanOh = (dayOh + 3) % 5, sikOh = (dayOh + 1) % 5, inOh = (dayOh + 4) % 5;

    var level = r.eokbu.level;                       // 신강 / 중화 / 신약
    var yong = r.yongsin.yong, hee = r.yongsin.hee;
    var yongKey = r.yongsin.yongKey, heeKey = r.yongsin.heeKey;

    var dayBranch = null, ilji = null;
    r.pillars.forEach(function (p) {
      if (p.key === 'day' && !p.unknown) { dayBranch = p.branch.idx; ilji = p; }
    });

    // 오행 분포
    var counts = r.ohCounts.slice();
    var ratios = r.ohRatio.slice();
    var lack = [];
    counts.forEach(function (c, i) { if (c === 0) lack.push(OHK[i]); });
    var maxI = counts.indexOf(Math.max.apply(null, counts));

    // 지수 — 실제 배치에서 계산 (랜덤 없음, 같은 사람은 항상 같은 값)
    var wealth = clamp(38 + 7 * Math.min(nJae, 6) + (level === '신강' ? 6 : level === '신약' ? -4 : 2)
      + (yong === jaeOh ? 10 : 0) + (counts[jaeOh] >= 3 ? 4 : 0), 28, 97);
    var career = clamp(38 + 7 * Math.min(nGwan, 6) + (nSik > 0 ? 5 : 0)
      + (yong === gwanOh ? 8 : 0) + (/관격/.test(r.gyeokguk.name) ? 6 : 0), 28, 97);
    var love = clamp(36 + 7 * Math.min(spouseN, 6) + (dayBranch !== null && BRANCHES[dayBranch].oh === spouseOh ? 8 : 0)
      + (level === '중화' ? 5 : 0), 26, 96);
    var vitality = clamp(64 + (r.eokbu.deukRyeong ? 8 : 0) + (r.eokbu.deukJi ? 6 : 0)
      + 3 * r.eokbu.allyCount - 5 * lack.length, 22, 98);

    // 2027 정미년(丁未) 세운
    var s2027 = null;
    r.sewoon.forEach(function (s) { if (s.year === 2027) s2027 = s; });
    var y27 = s2027 ? analyseYear(r, s2027, dayStem, dayOh) : null;

    // 5년 재물 흐름 (2026~2030) — 해마다 천간이 일간에 어떤 십성인지로 계산
    var bars = r.sewoon.filter(function (s) { return s.year >= 2026 && s.year <= 2030; }).map(function (s) {
      var sipYear = E.internal.shipsinForStem(dayStem, s.stem);
      var base = 44;
      if (sipYear === 4 || sipYear === 5) base += 34;            // 재성
      else if (sipYear === 2 || sipYear === 3) base += 24;       // 식상
      else if (sipYear === 8 || sipYear === 9) base += 14;       // 인성
      else if (sipYear === 6 || sipYear === 7) base += 6;        // 관성
      else base += 2;                                            // 비겁
      if (BRANCHES[s.branch].oh === jaeOh) base += 8;
      if (BRANCHES[s.branch].oh === jaeOh && (yong === jaeOh)) base += 4;
      return { year: s.year, ganji: s.hanja, score: clamp(base, 30, 99), sip: SIP[sipYear] };
    });
    var bestBar = bars.slice().sort(function (a, b) { return b.score - a.score; })[0];

    // 대운 — 지금 나이의 대운
    var age = new Date().getFullYear() - r.solar.y;
    var curDae = null, nextDae = null;
    r.daewoon.entries.forEach(function (d, i) {
      if (d.startAge <= age) curDae = d;
      if (!nextDae && d.startAge > age) nextDae = d;
    });

    // 2027년 열두 달 — 절기 기준 월지와 용신·세운지지의 합충
    var months = monthLuck(r, yong, s2027 ? s2027.branch : 7);

    return {
      input: input, r: r, name: (input.name || '신청자'),
      dayOh: dayOh, dayStem: dayStem, dayHanja: r.dayMaster.hanja, dayHangul: r.dayMaster.hangul,
      level: level, gyeok: r.gyeokguk, yongKey: yongKey, heeKey: heeKey,
      yongOh: yong, heeOh: hee, yongReason: r.yongsin.reason,
      counts: counts, ratios: ratios, lack: lack, maxI: maxI,
      sip: sip, nJae: nJae, nGwan: nGwan, nSik: nSik, nIn: nIn, nBi: nBi,
      jaeOh: jaeOh, gwanOh: gwanOh, sikOh: sikOh, inOh: inOh, spouseOh: spouseOh, spouseN: spouseN,
      wealth: wealth, career: career, love: love, vitality: vitality,
      bars: bars, bestYear: bestBar, y2027: y27, curDae: curDae, nextDae: nextDae,
      months: months, age: age,
      daySibisal: r.daySibisal, johu: r.yongsin.johu
    };
  }

  /* 세운 한 해 해석 */
  function analyseYear(r, s, dayStem, dayOh) {
    var stemSip = E.internal.shipsinForStem(dayStem, s.stem);
    var branchSip = E.internal.shipsinForBranch(dayStem, s.branch);
    var hits = [];
    r.pillars.forEach(function (p) {
      if (p.unknown || !p.ganji) return;
      var b = p.ganji.branch;
      if (Math.abs(b - s.branch) === 6) hits.push({ type: 'chung', label: p.label, branch: b });
      if (isYukhap(b, s.branch)) hits.push({ type: 'hap', label: p.label, branch: b });
    });
    var chung = hits.filter(function (h) { return h.type === 'chung'; });
    var hap = hits.filter(function (h) { return h.type === 'hap'; });
    var tone = 'jung';
    if (JAE.indexOf(stemSip) >= 0 || stemSip === 7 || stemSip === 9) tone = 'gil';
    if (stemSip === 3 || stemSip === 6 || stemSip === 1) tone = 'hyung';
    if (chung.length && tone === 'gil') tone = 'jung';
    if (chung.length >= 2) tone = 'hyung';
    var score = clamp(58 + (tone === 'gil' ? 18 : tone === 'hyung' ? -14 : 0) + hap.length * 4 - chung.length * 6, 22, 96);
    return {
      hanja: s.hanja, hangul: s.hangul, stemSip: SIP[stemSip], branchSip: SIP[branchSip],
      tone: tone, score: score, chung: chung, hap: hap, year: s.year, age: s.age
    };
  }
  function isYukhap(a, b) {
    var P = [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]];
    return P.some(function (p) { return (p[0] === a && p[1] === b) || (p[1] === a && p[0] === b); });
  }

  /* 2027년 절기 기준 월별 — 용신과 세운지지(未)의 합·충으로 길한 달을 고른다 */
  function monthLuck(r, yong, sewoonBranch) {
    var terms = E.terms;
    var names = ['입춘', '경칩', '청명', '입하', '망종', '소서', '입추', '백로', '한로', '입동', '대설', '소한'];
    var branchOf = { '입춘': 2, '경칩': 3, '청명': 4, '입하': 5, '망종': 6, '소서': 7,
      '입추': 8, '백로': 9, '한로': 10, '입동': 11, '대설': 0, '소한': 1 };
    var out = [];
    names.forEach(function (n) {
      var b = branchOf[n], t = null;
      try { t = terms.get(2027, n); } catch (e) { t = null; }
      var ms = t && t.ms ? t.ms : null;
      if (!ms) return;
      var d = new Date(ms + 9 * 3600 * 1000);
      var oh = BRANCHES[b].oh;
      var sc = 50;
      if (oh === yong) sc += 30;
      else if (oh === (yong + 4) % 5) sc += 16;                 // 용신을 생하는 오행
      if (isYukhap(b, sewoonBranch)) sc += 14;
      if (Math.abs(b - sewoonBranch) === 6) sc -= 26;
      out.push({ month: d.getUTCMonth() + 1, branch: b, oh: oh, score: clamp(sc, 10, 99) });
    });
    return out;
  }

  /* ------------------------------------------------------------------ *
   * 3. 문장 — 계산값을 한국어 문장으로
   * ------------------------------------------------------------------ */
  function strengthLine(m) {
    if (m.level === '신강') return '기운이 안쪽으로 두터운 <b>신강(身强)</b> 사주입니다. 내 힘으로 밀고 나가는 대신, 힘을 쓸 곳을 정하지 못하면 같은 자리에서 소모됩니다.';
    if (m.level === '신약') return '기운이 바깥으로 얇은 <b>신약(身弱)</b> 사주입니다. 혼자 밀어붙이기보다 사람과 제도, 배움을 빌릴 때 훨씬 멀리 갑니다.';
    return '치는 쪽과 받는 쪽이 반반인 <b>중화(中和)</b> 사주입니다. 어느 한쪽으로 기울지 않아, 판이 바뀌는 자리에서 유연하게 적응합니다.';
  }
  function yongLine(m) {
    return '이 사주의 균형추는 <b>' + m.yongKey + '(' + OHH[m.yongOh] + ')</b>이고, 그를 돕는 기운은 <b>' + m.heeKey + '</b>입니다. ' +
      OH_IMG[m.yongKey].key + '이 살아나는 환경에서 판단이 흔들리지 않습니다.';
  }
  function ohPortrait(m) {
    var c = m.counts;
    var word = m.r.charTotal === 8 ? '여덟 글자' : '여섯 글자';
    var s = '원국 ' + word + '는 ' + OHK.map(function (k, i) { return k + ' ' + c[i]; }).join(' · ') + '개로 놓여 있습니다. ';
    if (!m.lack.length) s += '다섯 기운이 모두 자리를 잡아, 무엇 하나 크게 비어 있지 않습니다. ';
    else s += m.lack.join('·') + ' 기운이 원국에 없어, 그 자리는 스스로 만들어 채워야 합니다. ';
    s += OHK[m.maxI] + ' 기운이 가장 두터워(' + c[m.maxI] + '개) 삶의 중심도 그쪽으로 기웁니다 — ' + OH_IMG[OHK[m.maxI]].key + '.';
    return s;
  }

  /* ------------------------------------------------------------------ *
   * 4. 렌더 — 지면 공통 부품
   * ------------------------------------------------------------------ */
  function styleTag() {
    if (document.getElementById('fpStyle')) return;
    var accent = V === 4 ? '#b8955f' : '#c9a063';
    var css = ''
      + ':root{--fp-acc:' + accent + '}'
      + '.fp-sec{margin:0 0 38px}'
      + '.fp-kicker{font-family:"Noto Serif KR",serif;font-size:11px;letter-spacing:.22em;color:var(--fp-acc);font-weight:700;margin-bottom:10px}'
      + '.fp-h2{font-family:"Noto Serif KR",serif;font-size:21px;line-height:1.45;color:#fff;font-weight:700;margin-bottom:14px;letter-spacing:-.03em}'
      + '.fp-h2 b{color:var(--fp-acc);font-weight:700}'
      + '.fp-p{font-size:14px;line-height:1.85;color:#b9c0cc;letter-spacing:-.02em;margin-bottom:14px}'
      + '.fp-p b{color:#f3e9d5;font-weight:700}'
      + '.fp-p em{color:var(--fp-acc);font-style:normal;font-weight:700}'
      + '.fp-table{width:100%;border-collapse:collapse;margin:6px 0 18px;table-layout:fixed}'
      + '.fp-table th{font-size:11px;color:#8d8578;font-weight:600;padding:6px 2px;letter-spacing:.06em}'
      + '.fp-table td{text-align:center;padding:7px 2px;border-top:1px solid rgba(255,255,255,.07);vertical-align:middle}'
      + '.fp-gz{font-family:"Noto Serif KR",serif;font-size:24px;font-weight:700;color:#fff;line-height:1.25;display:block}'
      + '.fp-gz small{display:block;font-family:Pretendard,sans-serif;font-size:10.5px;color:#948b7c;font-weight:500;letter-spacing:0;margin-top:2px}'
      + '.fp-sip{font-size:11px;color:var(--fp-acc);font-weight:700;display:block;margin-top:4px}'
      + '.fp-us{font-size:10px;color:#7f8794;display:block}'
      + '.fp-unk{color:#6b7280;font-size:15px;font-family:"Noto Serif KR",serif}'
      + '.fp-bars{margin:12px 0 18px}'
      + '.fp-bar{display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:12px}'
      + '.fp-bar span:first-child{width:26px;color:#cbd2dc;font-weight:700}'
      + '.fp-bar .track{flex:1;height:9px;border-radius:5px;background:rgba(255,255,255,.13);overflow:hidden}'
      + '.fp-bar .fill{height:100%;border-radius:5px;background:linear-gradient(90deg,#d8b979,#f0dcb0)}'
      + '.fp-bar .val{width:62px;text-align:right;color:#b3a992;font-size:11px}'
      + '.fp-boxes{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0 18px}'
      + '.fp-box{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:14px}'
      + '.fp-box b{display:block;font-size:11.5px;color:var(--fp-acc);letter-spacing:.04em;margin-bottom:6px}'
      + '.fp-box p{font-size:12.5px;line-height:1.7;color:#a9b0bc}'
      + '.fp-score{display:flex;align-items:center;gap:16px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:16px;margin:12px 0 18px}'
      + '.fp-ring{position:relative;width:74px;height:74px;flex:0 0 74px}'
      + '.fp-ring svg{transform:rotate(-90deg)}'
      + '.fp-ring circle{fill:none;stroke-width:6}'
      + '.fp-ring .bg{stroke:rgba(255,255,255,.09)}'
      + '.fp-ring .fg{stroke:var(--fp-acc);stroke-linecap:round}'
      + '.fp-ring b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:"Noto Serif KR",serif;font-size:20px;color:#fff}'
      + '.fp-score .t{font-size:12.5px;line-height:1.7;color:#a9b0bc}'
      + '.fp-score .t strong{display:block;color:#f1e6d2;font-size:13.5px;margin-bottom:3px}'
      + '.fp-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0 18px}'
      + '.fp-card{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:12px 10px;text-align:center}'
      + '.fp-card span{display:block;font-size:10.5px;color:#8d8578;margin-bottom:6px}'
      + '.fp-card b{font-family:"Noto Serif KR",serif;font-size:16px;color:#fff;display:block}'
      + '.fp-card i{display:block;font-size:10.5px;color:var(--fp-acc);font-style:normal;margin-top:4px}'
      + '.fp-teaser{background:rgba(201,160,99,.07);border:1px solid rgba(201,160,99,.24);border-radius:8px;padding:14px;margin:16px 0}'
      + '.fp-teaser .q{font-size:13px;font-weight:700;color:#eadfc8;margin-bottom:8px}'
      + '.fp-teaser .blur{font-size:12.5px;line-height:1.75;color:#9aa1ad;filter:blur(3.4px);user-select:none}'
      + '.fp-table2{width:100%;border-collapse:collapse;margin:10px 0 18px;font-size:12px}'
      + '.fp-table2 th,.fp-table2 td{border-bottom:1px solid rgba(255,255,255,.07);padding:8px 6px;text-align:left;color:#a9b0bc}'
      + '.fp-table2 th{color:#8d8578;font-weight:600;font-size:11px}'
      + '.fp-table2 td b{color:#f1e6d2}'
      + '.fp-tl{position:relative;padding-left:18px;margin:10px 0 18px}'
      + '.fp-tl:before{content:"";position:absolute;left:4px;top:6px;bottom:6px;width:1px;background:rgba(201,160,99,.35)}'
      + '.fp-tl .it{position:relative;margin-bottom:14px}'
      + '.fp-tl .it:before{content:"";position:absolute;left:-18px;top:6px;width:9px;height:9px;border-radius:50%;background:#0b0d10;border:2px solid var(--fp-acc)}'
      + '.fp-tl .it.on:before{background:var(--fp-acc)}'
      + '.fp-tl .d{font-size:12px;font-weight:700;color:var(--fp-acc);margin-bottom:3px}'
      + '.fp-tl .x{font-size:12.5px;line-height:1.7;color:#a9b0bc}'
      + '.fp-note{font-size:11.5px;line-height:1.7;color:#7c8492;border-top:1px dashed rgba(255,255,255,.1);padding-top:12px;margin-top:8px}'
      + '.fp-cta{background:linear-gradient(160deg,#1b1610,#2b2114);border:1px solid var(--fp-acc);border-radius:10px;padding:24px 20px;margin:10px 0 26px;text-align:center}'
      + '.fp-cta .k{font-family:"Noto Serif KR",serif;font-size:12px;letter-spacing:.14em;color:var(--fp-acc);font-weight:700;margin-bottom:8px}'
      + '.fp-cta .t{font-family:"Noto Serif KR",serif;font-size:20px;line-height:1.45;color:#fff;font-weight:700}'
      + '.fp-cta .t b{color:#e8c987}'
      + '.fp-cta p{font-size:13px;color:#b9b0a1;line-height:1.75;margin:10px 0 14px}'
      + '.fp-cta a{display:block;background:linear-gradient(90deg,#d8b979,#c9a063);color:#171209;font-weight:900;font-size:15px;padding:15px;border-radius:6px;text-decoration:none}'
      + '.fp-cta .p{font-size:11.5px;color:#a99f8d;margin-top:9px}'
      + '.input-row select{width:100%;padding:12px 15px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:4px;color:#fff;font-size:14px;font-family:Pretendard,sans-serif;outline:none;color-scheme:dark}'
      + '.input-row select:focus{border-color:var(--fp-acc)}'
      + '.input-row label{display:block;font-size:12.5px;color:var(--fp-acc);font-weight:700;margin-bottom:7px}'
      + '.input-row input[type=text],.input-row input[type=date]{width:100%;padding:12px 14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:4px;color:#fff;font-size:14.5px;font-family:Pretendard,sans-serif;outline:none;color-scheme:dark}'
      + '.input-row input:focus{border-color:var(--fp-acc)}'
      + '#step-hooking .input-group{background:rgba(17,24,39,.6);border:1px solid rgba(201,160,99,.22);border-radius:8px;padding:20px 18px;margin:0 0 24px;text-align:left}'
      + '#step-hooking .input-row{margin-bottom:13px}'
      + '.input-row .fp-two{gap:10px}'
      + '.fp-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}'
      + '.fp-check{display:flex;align-items:center;gap:7px;font-size:12px;color:#c9d1dc;font-weight:500;line-height:1.5}'
      + '.fp-check input{width:auto}'
      + '.fp-formnote{font-size:11px;color:#7c8492;margin-top:10px;line-height:1.6}'
      + '.fp-flash{display:none;margin-top:12px;font-size:12.5px;color:#f0b4a8;text-align:center}'
      + '.fp-cta__more{display:block;width:100%;margin-top:10px;background:none;border:1px solid rgba(201,160,99,.5);color:#e8c987;font-weight:700;font-size:13.5px;padding:12px;border-radius:6px;cursor:pointer;font-family:inherit}'
      + '.fp-back{display:flex;gap:8px;justify-content:center;margin:18px 0 4px;flex-wrap:wrap}'
      + '.fp-back a,.fp-back button{font-size:12px;padding:9px 14px;border-radius:20px;border:1px solid rgba(201,160,99,.45);background:none;color:var(--fp-acc);cursor:pointer;text-decoration:none}'
      + '#step-detail .detail-content{padding-bottom:0}'
      /* ---- 2026-11-25 개편: 쉬운 말 4장 ---- */
      + '.fp-8{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:14px 0 18px}'
      + '.fp-8 div{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:7px;padding:11px 6px;text-align:center}'
      + '.fp-8 span{display:block;font-size:9.5px;color:var(--fp-acc);letter-spacing:.04em;margin-bottom:4px}'
      + '.fp-8 b{display:block;font-family:"Noto Serif KR",serif;font-size:22px;line-height:1.2;color:#fff}'
      + '.fp-8 i{display:block;font-style:normal;font-size:9.5px;color:#8d8578;margin-top:4px}'
      + '.fp-say{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-left:3px solid var(--fp-acc);border-radius:0 7px 7px 0;padding:14px 15px;margin:14px 0 18px}'
      + '.fp-say .q{font-family:"Noto Serif KR",serif;font-size:13.5px;font-weight:700;color:#f0e3c6;margin-bottom:8px;line-height:1.5}'
      + '.fp-say ul{list-style:none;margin:0;padding:0}'
      + '.fp-say li{position:relative;padding-left:14px;font-size:12.5px;line-height:1.8;color:#a9b0bc}'
      + '.fp-say li:before{content:"·";position:absolute;left:3px;color:var(--fp-acc);font-weight:900}'
      + '.fp-turn{display:flex;align-items:center;gap:9px;margin:6px 0 30px;font-family:"Noto Serif KR",serif;font-size:12px;color:var(--fp-acc);letter-spacing:.04em}'
      + '.fp-turn:after{content:"";flex:1;height:1px;background:linear-gradient(90deg,rgba(201,160,99,.4),transparent)}'
      + '.fp-month{display:grid;grid-template-columns:repeat(12,1fr);gap:3px;align-items:end;height:78px;margin:14px 0 4px}'
      + '.fp-month i{display:block;background:linear-gradient(180deg,#e0c489,#a9812f);border-radius:2px 2px 0 0;opacity:.9}'
      + '.fp-monthlab{display:grid;grid-template-columns:repeat(12,1fr);gap:3px;font-size:8.5px;color:#948b7c;text-align:center;margin-bottom:14px}'
      + '.fp-cliff{background:linear-gradient(160deg,#211a10,#2e2314);border:1px solid rgba(201,160,99,.5);border-radius:9px;padding:20px 18px;margin:16px 0 18px}'
      + '.fp-cliff .k{font-family:"Noto Serif KR",serif;font-size:11.5px;letter-spacing:.16em;color:var(--fp-acc);font-weight:700;margin-bottom:8px}'
      + '.fp-cliff p{font-family:"Noto Serif KR",serif;font-size:16px;line-height:1.7;color:#f2e7d2;font-weight:700;letter-spacing:-.02em}'
      + '.fp-cliff p b{color:#e8c987}'
      + '.fp-cliff em{font-style:normal;color:#b3a992;font-family:Pretendard,sans-serif;font-size:12px;font-weight:500;display:block;margin-top:10px;line-height:1.7}'
      + '.fp-cta .a2{display:block;margin-top:9px;background:none;border:1px solid rgba(201,160,99,.45);color:#e8c987;font-weight:700;font-size:12.5px;padding:11px;border-radius:6px;text-decoration:none}'
      + '.fp-cta .price{font-size:12px;color:#cbbd9e;margin-top:10px;letter-spacing:.01em}'
      + 'body[data-fourp="4"] .fp-8 div{background:#f8f9fc;border-color:#e1e6ee}'
      + 'body[data-fourp="4"] .fp-8 b{color:#1a2533}'
      + 'body[data-fourp="4"] .fp-say{background:#fdf7e9;border-color:#e0cda6;border-left-color:#b8955f}'
      + 'body[data-fourp="4"] .fp-say .q{color:#6b4e1f}'
      + 'body[data-fourp="4"] .fp-say li{color:#43505f}'
      + 'body[data-fourp="4"] .fp-cliff{background:#fdf7e9;border-color:#d8b979}'
      + 'body[data-fourp="4"] .fp-cliff p{color:#2b2114}'
      + 'body[data-fourp="4"] .fp-cliff p b{color:#8f1d17}'
      + 'body[data-fourp="4"] .fp-cliff em{color:#6d6353}'
      + 'body[data-fourp="4"] .fp-cta{background:linear-gradient(160deg,#1b1610,#2b2114)}'
      + 'body[data-fourp="4"] .fp-cta .t{color:#fff}'
      + 'body[data-fourp="4"] .fp-cta p{color:#cbbfa6}'
      + 'body[data-fourp="4"] .fp-month span{color:#948b7c}'
      + 'body[data-fourp="4"] #step-hooking .input-group{background:#f8f9fc;border-color:rgba(184,149,95,.45)}'
      + 'body[data-fourp="4"] .input-row label{color:#8a6d34}'
      + 'body[data-fourp="4"] .input-row input[type=text],body[data-fourp="4"] .input-row input[type=date],body[data-fourp="4"] .input-row select{background:#fff;border:1px solid #d7dce5;color:#1a2533;color-scheme:light}'
      + 'body[data-fourp="4"] .fp-check{color:#43505f}'
      + 'body[data-fourp="4"] .fp-formnote{color:#7c8492}'
      + 'body[data-fourp="4"] .fp-h2{color:#1a2533}'
      + 'body[data-fourp="4"] .fp-p{color:#43505f}'
      + 'body[data-fourp="4"] .fp-p b{color:#111c2b}'
      + 'body[data-fourp="4"] .fp-gz{color:#1a2533}'
      + 'body[data-fourp="4"] .fp-table td{border-top-color:rgba(26,37,51,.12)}'
      + 'body[data-fourp="4"] .fp-box,body[data-fourp="4"] .fp-score,body[data-fourp="4"] .fp-card{background:#f8f9fc;border-color:#e1e6ee}'
      + 'body[data-fourp="4"] .fp-box p,body[data-fourp="4"] .fp-score .t,body[data-fourp="4"] .fp-tl .x,body[data-fourp="4"] .fp-table2 td{color:#43505f}'
      + 'body[data-fourp="4"] .fp-score .t strong,body[data-fourp="4"] .fp-card b,body[data-fourp="4"] .fp-table2 td b{color:#1a2533}'
      + 'body[data-fourp="4"] .fp-ring b{color:#1a2533}'
      + 'body[data-fourp="4"] .fp-teaser{background:#fdf7e9;border-color:#e0cda6}'
      + 'body[data-fourp="4"] .fp-teaser .q{color:#6b4e1f}'
      + 'body[data-fourp="4"] .fp-teaser .blur{color:#6d7787}'
      + 'body[data-fourp="4"] .fp-bar span:first-child{color:#43505f}'
      + 'body[data-fourp="4"] .fp-bar .track{background:rgba(26,37,51,.09)}'
      + 'body[data-fourp="4"] .fp-back a,body[data-fourp="4"] .fp-back button{border-color:#c3a97a}'
      + '@media (max-width:420px){.fp-boxes,.fp-two{grid-template-columns:1fr}.fp-cards{grid-template-columns:repeat(3,1fr);gap:6px}.fp-card b{font-size:14px}.fp-gz{font-size:21px}}'
      + '@media print{.fp-p,.fp-box p,.fp-score .t,.fp-tl .x,.fp-table2 td{color:#222!important}'
      + '.fp-h2,.fp-gz,.fp-card b,.fp-table2 td b,.fp-cta .t{color:#111!important}.fp-teaser .blur{filter:none!important;color:#333!important}'
      + '.fp-sec{page-break-inside:avoid}body{background:#fff!important}}';
    var st = document.createElement('style');
    st.id = 'fpStyle';
    st.textContent = css;
    document.head.appendChild(st);
  }

  function gzCell(p) {
    if (!p || p.unknown) return '<td><span class="fp-unk">時?</span><span class="fp-us">시각 미상</span></td>';
    return '<td><span class="fp-gz">' + STEMS[p.stem.idx].hanja + BRANCHES[p.branch.idx].hanja + '</span>' +
      '<small>' + STEMS[p.stem.idx].hangul + BRANCHES[p.branch.idx].hangul + '</small>' +
      '<span class="fp-us">' + p.unseong.name + '</span></td>';
  }

  function wonTable(m) {
    var p = {};
    m.r.pillars.forEach(function (x) { p[x.key] = x; });
    return '<table class="fp-table"><thead><tr><th></th><th>시주 時柱</th><th>일주 日柱</th><th>월주 月柱</th><th>년주 年柱</th></tr></thead><tbody>' +
      '<tr><td style="text-align:left;font-size:10.5px;color:#7f8794">십성</td>' +
      ['hour', 'day', 'month', 'year'].map(function (k) {
        var x = p[k];
        if (!x || x.unknown) return '<td class="fp-us">—</td>';
        return '<td><span class="fp-sip">' + (x.stem.sip === null ? '일간' : SIP[x.stem.sip]) + '</span></td>';
      }).join('') + '</tr>' +
      '<tr><td style="text-align:left;font-size:10.5px;color:#7f8794">천간·지지</td>' +
      ['hour', 'day', 'month', 'year'].map(function (k) { return gzCell(p[k]); }).join('') + '</tr>' +
      '<tr><td style="text-align:left;font-size:10.5px;color:#7f8794">지지 십성</td>' +
      ['hour', 'day', 'month', 'year'].map(function (k) {
        var x = p[k];
        if (!x || x.unknown) return '<td class="fp-us">—</td>';
        return '<td style="font-size:11px;color:#a9b0bc">' + SIP[x.branch.sip] + '</td>';
      }).join('') + '</tr>' +
      '<tr><td style="text-align:left;font-size:10.5px;color:#7f8794">12운성</td>' +
      ['hour', 'day', 'month', 'year'].map(function (k) {
        var x = p[k];
        if (!x || x.unknown) return '<td class="fp-us">—</td>';
        return '<td style="font-size:11px;color:#a9b0bc">' + x.unseong.name + '</td>';
      }).join('') + '</tr>' +
      '</tbody></table>';
  }

  function ohBars(m) {
    return '<div class="fp-bars">' + m.counts.map(function (c, i) {
      var pct = m.ratios[i];
      return '<div class="fp-bar"><span>' + OHK[i] + '</span><span class="track"><span class="fill" style="width:' + Math.max(3, pct) + '%"></span></span>' +
        '<span class="val">' + c + '개 ' + pct + '%</span></div>';
    }).join('') + '</div>';
  }

  function sipTable(m) {
    var rows = [
      ['비겁', m.sip[0] + m.sip[1], '나와 같은 편 — 동료·경쟁'],
      ['식상', m.nSik, '내가 내보내는 것 — 말·창작·기술'],
      ['재성', m.nJae, '내가 쥐는 것 — 돈·거래·현실'],
      ['관성', m.nGwan, '나를 누르는 것 — 직장·책임·규칙'],
      ['인성', m.nIn, '나를 채우는 것 — 배움·보호·문서']
    ];
    return '<table class="fp-table2"><thead><tr><th>십성</th><th>개수</th><th>삶에서 하는 일</th></tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr><td><b>' + r[0] + '</b></td><td>' + r[1] + '</td><td>' + r[2] + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  function scoreRing(score, label) {
    var c = 2 * Math.PI * 30;
    var off = c - (score / 100) * c;
    return '<div class="fp-score"><div class="fp-ring"><svg width="74" height="74" viewBox="0 0 74 74">' +
      '<circle class="bg" cx="37" cy="37" r="30"></circle>' +
      '<circle class="fg" cx="37" cy="37" r="30" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"></circle>' +
      '</svg><b>' + score + '</b></div><div class="t"><strong>' + esc(label) + '</strong>' + '</div></div>';
  }

  /* ---------------- 지면 ① 본질 ---------------- */
  function secEssence(m) {
    var s = m.dayStem, oh = m.dayOh;
    var title;
    if (m.level === '신강') title = '당신은 <b>' + OHK[oh] + '의 기운</b>을 안쪽에 깊이 쌓은 사람입니다.';
    else if (m.level === '신약') title = '당신은 <b>' + OHK[oh] + '의 기운</b>이 얇게 스며, 사람과 환경이 곧 힘이 됩니다.';
    else title = '당신은 <b>' + OHK[oh] + '의 기운</b>이 반반으로 놓여, 어느 쪽으로도 기울지 않습니다.';
    var gd = GYEOK_DESC[m.gyeok.name] || '자기 자리에서 끝까지 해내는 힘';

    return '<section class="fp-sec">' +
      '<div class="fp-kicker">PAGE 01 · 본질 — ' + (m.r.charTotal === 8 ? '여덟' : '여섯') + ' 글자의 첫 문장</div>' +
      '<h2 class="fp-h2">' + title + '</h2>' +
      '<p class="fp-p">일간(日干)은 <b>' + m.dayHanja + '(' + m.dayHangul + ')</b> — ' + OH_IMG[OHK[oh]].img + '입니다. ' +
      '태어난 달의 기운과 만나 <b>' + m.gyeok.name + '</b>으로 잡혔습니다 — ' + gd + '의 구조입니다.</p>' +
      wonTable(m) +
      '<p class="fp-p">' + ohPortrait(m) + '</p>' +
      ohBars(m) +
      '<p class="fp-p">' + strengthLine(m) + '</p>' +
      '<p class="fp-p">' + yongLine(m) + '</p>' +
      '<div class="fp-boxes">' +
      '<div class="fp-box"><b>겉으로 보이는 당신</b><p>' + OH_IMG[OHK[oh]].key + jj(OH_IMG[OHK[oh]].key, '이') + ' 먼저 드러납니다. ' +
      '처음 만나는 사람은 당신을 <b>' + OHK[oh] + '</b>의 사람으로 기억합니다 — ' + OH_IMG[OHK[oh]].body + jj(OH_IMG[OHK[oh]].body, '이') + ' 말하는 인상입니다.</p></div>' +
      '<div class="fp-box"><b>안쪽의 진짜 당신</b><p>가장 두터운 기운은 <b>' + OHK[m.maxI] + '</b>(' + m.counts[m.maxI] + '개)입니다. ' +
      '결정적인 순간에 손이 먼저 가는 쪽은 ' + OH_IMG[OHK[m.maxI]].key + '입니다.</p></div>' +
      '</div>' +
      '<div class="fp-teaser"><div class="q">그럼 이 여덟 글자에서 돈은 어디로 들어옵니까?</div>' +
      '<div class="blur">재성은 원국에서 ' + m.nJae + '자리, 재물의 그릇은 ' + (m.wealth >= 70 ? '넓은' : m.wealth >= 55 ? '중간' : '좁지만 단단한') + ' 편입니다. ' +
      '어느 해에 그 그릇이 커지고, 어느 달에 돈이 실제로 움직이는지는 다음 장에서 숫자로 확인합니다.</div></div>' +
      '</section>';
  }

  /* ---------------- 지면 ② 재물 ---------------- */
  function secWealth(m) {
    var maxBar = m.bestYear;
    var jaePos = [];
    m.r.pillars.forEach(function (p) {
      if (p.unknown) return;
      if (JAE.indexOf(E.internal.shipsinForStem(m.dayStem, p.stem.idx)) >= 0) jaePos.push(p.label + ' 천간');
      if (JAE.indexOf(E.internal.shipsinForBranch(m.dayStem, p.branch.idx)) >= 0) jaePos.push(p.label + ' 지지');
    });
    var goodMonth = m.months.slice().sort(function (a, b) { return b.score - a.score; })[0];
    var badMonth = m.months.slice().sort(function (a, b) { return a.score - b.score; })[0];

    return '<section class="fp-sec">' +
      '<div class="fp-kicker">PAGE 02 · 재물 — 그릇과 때</div>' +
      '<h2 class="fp-h2">돈은 <b>' + (m.nJae >= 3 ? '이미 여러 통로로' : m.nJae >= 1 ? '한두 개의 좁은 문으로' : '아직 문이 열리지 않은 채') + '</b> 들어오는 사주입니다.</h2>' +
      '<p class="fp-p">재성(財星)은 <b>' + m.nJae + '자리</b>' + (jaePos.length ? ' — ' + jaePos.slice(0, 4).join(', ') + '에 놓였습니다' : ' — 원국에 드러난 재성이 적습니다') + '. ' +
      '재성은 <b>' + OHK[m.jaeOh] + '</b>의 기운이고, 이 사주의 용신은 <b>' + m.yongKey + '</b>입니다. ' +
      (m.yongOh === m.jaeOh ? '용신과 재성이 같은 방향이라, 돈을 좇는 일이 곧 균형을 잡는 일이 됩니다.' : '용신과 재성이 다른 방향이라, 돈은 균형을 잡은 다음에 따라옵니다. 조급함이 가장 큰 비용입니다.') + '</p>' +
      '<div class="fp-score">' +
      '<div class="fp-ring"><svg width="74" height="74" viewBox="0 0 74 74"><circle class="bg" cx="37" cy="37" r="30"></circle>' +
      '<circle class="fg" cx="37" cy="37" r="30" stroke-dasharray="188.5" stroke-dashoffset="' + (188.5 - m.wealth / 100 * 188.5).toFixed(1) + '"></circle></svg><b>' + m.wealth + '</b></div>' +
      '<div class="t"><strong>재물 그릇 지수 ' + m.wealth + ' / 100</strong>' +
      '재성 ' + m.nJae + '자리 · ' + m.level + ' · 용신 ' + m.yongKey + ' 기준으로 계산했습니다. ' +
      (m.wealth >= 75 ? '그릇이 큰 편입니다. 문제는 크기가 아니라 시기입니다.' : m.wealth >= 55 ? '그릇은 충분합니다. 새는 곳 하나만 막으면 남습니다.' : '그릇은 작지만 단단합니다. 크게 벌이기보다 오래 쥐는 쪽이 맞습니다.') +
      '</div></div>' +
      '<p class="fp-p">앞으로 5년의 재물 흐름은 이렇게 계산됩니다. 해마다 들어오는 간지의 천간이 일간에 어떤 십성으로 작용하는지, 지지가 재성의 자리와 만나는지를 합산한 값입니다.</p>' +
      '<div class="fp-bars">' + m.bars.map(function (b) {
        return '<div class="fp-bar"><span>' + b.year + '</span><span class="track"><span class="fill" style="width:' + b.score + '%"></span></span>' +
          '<span class="val">' + b.score + ' · ' + b.sip + '</span></div>';
      }).join('') + '</div>' +
      '<p class="fp-p">가장 힘이 실리는 해는 <b>' + maxBar.year + '년(' + maxBar.ganji + ')</b>입니다. 이 해의 천간은 일간에 <b>' + maxBar.sip + '</b>' + jj(maxBar.sip, '으로') + ' 작용합니다. ' +
      (m.y2027 ? '2027 정미년(丁未)은 천간이 <b>' + m.y2027.stemSip + '</b>, 지지가 <b>' + m.y2027.branchSip + '</b>' + jj(m.y2027.branchSip, '으로') + ' 들어오는 해입니다. ' + yearToneText(m.y2027) : '') + '</p>' +
      (goodMonth ? '<p class="fp-p">2027년 안에서 재물이 실제로 움직이는 달은 <b>' + goodMonth.month + '월</b>(' + OHK[goodMonth.oh] + ' 기운, ' + goodMonth.score + '점)입니다. ' +
        (badMonth ? '반대로 <b>' + badMonth.month + '월</b>은 결제·계약을 미루는 편이 낫습니다.' : '') + '</p>' : '') +
      '<div class="fp-teaser"><div class="q">그 돈이 들어올 때, 당신 곁에 누가 서 있습니까?</div>' +
      '<div class="blur">배우자 자리(일지)와 애정의 별이 어디에 놓였는지에 따라 인연의 모양이 달라집니다. 애정 지수는 ' + m.love + '점으로 계산되었고, 그 점수를 만든 자리는 다음 장에 있습니다.</div></div>' +
      '</section>';
  }
  function yearToneText(y) {
    if (y.tone === 'gil') return '들어오는 기운이 재물과 명예 쪽이라, 미뤄 둔 일을 꺼내기 좋은 해입니다.';
    if (y.tone === 'hyung') return '들어오는 기운이 나를 누르거나 흔드는 쪽이라, 확장보다 정리가 유리한 해입니다.';
    return y.chung.length ? '들어오는 기운이 ' + y.chung.map(function (c) { return c.label; }).join('·') + '와 부딪힙니다. 크게 벌이기보다 수습이 중요한 해입니다.' : '무난한 흐름입니다. 크게 벌지도, 크게 잃지도 않는 해입니다.';
  }

  /* ---------------- 지면 ③ 애정 ---------------- */
  function secLove(m) {
    var p = null;
    m.r.pillars.forEach(function (x) { if (x.key === 'day' && !x.unknown) p = x; });
    var spouseStars = m.input.gender === '여' ? '관성(官星)' : '재성(財星)';
    return '<section class="fp-sec">' +
      '<div class="fp-kicker">PAGE 03 · 애정 — 배우자 자리</div>' +
      '<h2 class="fp-h2">인연은 <b>' + (m.spouseN >= 3 ? '여러 번 스쳐' : m.spouseN >= 1 ? '한 번 깊게' : '늦게, 그러나 오래') + '</b> 오는 사주입니다.</h2>' +
      '<p class="fp-p">' + (m.input.gender === '여' ? '여성' : '남성') + ' 사주에서 배우자를 보는 별은 <b>' + spouseStars + '</b>입니다. 원국에 <b>' + m.spouseN + '자리</b>가 있습니다. ' +
      (m.spouseN === 0 ? '드러난 별이 없다고 인연이 없다는 뜻은 아닙니다. 대운·세운에서 그 별이 들어오는 해에 관계가 시작되는 경우가 많습니다.'
        : m.spouseN >= 3 ? '별이 여러 개면 선택의 순간이 여러 번 오고, 그때마다 기준이 흔들리지 않는 것이 중요합니다.'
        : '별이 하나로 모여 있어, 한 사람에게 마음이 깊게 가는 구조입니다.') + '</p>' +
      '<div class="fp-score"><div class="fp-ring"><svg width="74" height="74" viewBox="0 0 74 74"><circle class="bg" cx="37" cy="37" r="30"></circle>' +
      '<circle class="fg" cx="37" cy="37" r="30" stroke-dasharray="188.5" stroke-dashoffset="' + (188.5 - m.love / 100 * 188.5).toFixed(1) + '"></circle></svg><b>' + m.love + '</b></div>' +
      '<div class="t"><strong>애정 지수 ' + m.love + ' / 100</strong>' +
      (p ? '배우자 자리(일지)는 <b>' + STEMS[p.stem.idx].hanja + BRANCHES[p.branch.idx].hanja + '(' + BRANCHES[p.branch.idx].hangul + ')</b>, 12운성으로 <b>' + p.unseong.name + '</b>입니다. ' +
        (m.love >= 70 ? '관계에서 내 자리를 잃지 않는 편이라, 오래 갈수록 편안해집니다.' : m.love >= 50 ? '상대를 살피느라 내 감정을 늦게 말하는 편입니다.' : '가까워지는 속도보다 신뢰를 쌓는 시간이 긴 편입니다.') : '') +
      '</div></div>' +
      '<div class="fp-boxes">' +
      '<div class="fp-box"><b>끌리는 사람</b><p>' + OHK[m.spouseOh] + '의 기운을 가진 사람 — ' + OH_IMG[OHK[m.spouseOh]].key + jj(OH_IMG[OHK[m.spouseOh]].key, '이') + ' 분명한 사람에게 마음이 먼저 갑니다.</p></div>' +
      '<div class="fp-box"><b>오래 가는 조건</b><p>' + (m.level === '신강' ? '내 힘이 센 편이라, 말투를 낮추는 것만으로 관계가 길어집니다.' : m.level === '신약' ? '상대의 속도에 맞추다 지치지 않도록, 내가 원하는 것을 먼저 말해야 합니다.' : '관계의 규칙을 함께 정할 때 가장 안정됩니다.') + '</p></div>' +
      '</div>' +
      (m.y2027 ? '<p class="fp-p">2027 정미년은 배우자 자리와 ' + (m.y2027.hap.length ? '합(合)으로 이어집니다. 인연이 구체적인 형태로 좁혀지는 해입니다.' : m.y2027.chung.length ? '부딪히는 자리가 생깁니다. 큰 결정은 한 번 더 확인하고 움직이세요.' : '직접 엮이지 않습니다. 관계보다 나를 정비하는 해입니다.') + '</p>' : '') +
      '<div class="fp-teaser"><div class="q">커리어의 전환점은 숫자로 나옵니다.</div>' +
      '<div class="blur">관성 ' + m.nGwan + '자리 · 식상 ' + m.nSik + '자리. 이 두 별의 배치가 직장과 사업 중 어디가 편한지를 가릅니다. 다음 장에서 대운과 함께 확인합니다.</div></div>' +
      '</section>';
  }

  /* ---------------- 지면 ④ 커리어 ---------------- */
  function secCareer(m) {
    var cur = m.curDae, nxt = m.nextDae;
    var sipOf = function (d) { return E.internal.shipsinForStem(m.dayStem, d.stem); };
    var tone = function (d) {
      var s = sipOf(d);
      if (JAE.indexOf(s) >= 0 || s === 7) return '자리를 넓히는 대운';
      if (s === 2 || s === 3) return '만든 것을 세상에 내놓는 대운';
      if (s === 8 || s === 9) return '배우고 정리하는 대운';
      if (s === 6 || s === 3) return '압박을 통해 단단해지는 대운';
      return '동료와 힘을 겨루는 대운';
    };
    return '<section class="fp-sec">' +
      '<div class="fp-kicker">PAGE 04 · 커리어 — 대운과 세운</div>' +
      '<h2 class="fp-h2">' + (m.nGwan >= 3 ? '조직에서 <b>자리를 만드는</b> 사주' : m.nSik >= 3 ? '내 이름으로 <b>만들어 파는</b> 사주' : '한 우물에서 <b>깊어지는</b> 사주') + '</h2>' +
      '<p class="fp-p">관성(官星)은 <b>' + m.nGwan + '자리</b>, 식상(食傷)은 <b>' + m.nSik + '자리</b>입니다. ' +
      (m.nGwan > m.nSik ? '규칙과 책임이 많은 자리에서 오히려 안정됩니다. 직장·공공·관리 쪽이 편합니다.' :
        m.nSik > m.nGwan ? '내 손으로 만든 것이 평가받는 자리에서 힘이 납니다. 기술·창작·판매 쪽이 편합니다.' :
          '조직과 독립 어느 쪽도 가능합니다. 다만 두 쪽을 동시에 하면 어느 쪽도 깊어지지 않습니다.') + '</p>' +
      '<div class="fp-cards">' +
      '<div class="fp-card"><span>커리어 지수</span><b>' + m.career + '</b><i>' + (m.career >= 70 ? '강점' : m.career >= 55 ? '안정' : '보완') + '</i></div>' +
      '<div class="fp-card"><span>격국</span><b style="font-size:14px">' + m.gyeok.name + '</b><i>' + m.level + '</i></div>' +
      '<div class="fp-card"><span>일간</span><b style="font-size:15px">' + m.dayHanja + '</b><i>' + OHK[m.dayOh] + ' · ' + OH_IMG[OHK[m.dayOh]].key + '</i></div>' +
      '</div>' +
      (cur ? '<p class="fp-p">지금 나이 <b>' + m.age + '세</b>는 <b>' + cur.hanja + '(' + cur.hangul + ')</b> 대운 안에 있습니다. ' + tone(cur) + '입니다. ' +
        (nxt ? '다음 대운은 <b>' + nxt.startAge + '세</b>에 시작하는 <b>' + nxt.hanja + '</b> — ' + tone(nxt) + '.' : '') + '</p>' : '') +
      '<div class="fp-tl">' +
      m.bars.map(function (b, i) {
        return '<div class="it' + (i === 0 ? ' on' : '') + '"><div class="d">' + b.year + '년 · ' + b.ganji + ' · ' + b.sip + '</div>' +
          '<div class="x">' + yearSipText(b) + '</div></div>';
      }).join('') +
      '</div>' +
      '<div class="fp-teaser"><div class="q">가장 조심해야 할 달은 따로 있습니다.</div>' +
      '<div class="blur">2027년 중 충(沖)이 걸리는 달과 공망이 겹치는 시기에는 계약·이사·큰 지출을 미루는 편이 낫습니다. 정확한 달과 대처법은 마지막 장에서 정리합니다.</div></div>' +
      '</section>';
  }

  /* ---------------- 지면 ⑤ 맺음 · 위기 ---------------- */
  function secEnd(m) {
    var bad = m.months.slice().sort(function (a, b) { return a.score - b.score; })[0];
    return '<section class="fp-sec">' +
      '<div class="fp-kicker">' + (V >= 3 ? 'PAGE 03' : 'PAGE 05') + ' · 맺음 — 피해야 할 때와 남은 이야기</div>' +
      '<h2 class="fp-h2">빛이 강한 해에는 <b>그림자도 같이</b> 옵니다.</h2>' +
      (m.y2027 ? '<p class="fp-p">2027 정미년(丁未)의 총평 점수는 <b>' + m.y2027.score + '점</b>입니다. ' + yearToneText(m.y2027) + '</p>' : '') +
      (bad ? '<p class="fp-p">이 해에 가장 조심할 달은 <b>' + bad.month + '월</b>입니다(' + OHK[bad.oh] + ' 기운, ' + bad.score + '점). ' +
        '큰 계약·이사·보증·충동적 투자는 이 달을 피해 잡으세요.</p>' : '') +
      '<p class="fp-p">일지 기준 12신살은 <b>' + m.daySibisal + '</b>, 조후는 <b>' + m.johu.label + '</b>입니다. ' +
        (m.lack.length ? '원국에 ' + m.lack.join('·') + ' 기운이 없어, 그 자리는 의식적으로 채워야 균형이 잡힙니다. ' : '') +
        '용신 <b>' + m.yongKey + '</b>' + jj(m.yongKey, '을') + ' 살리는 색은 ' + OH_IMG[m.yongKey].color + ', 방위는 ' + OH_IMG[m.yongKey].dir + ', 숫자는 ' + OH_IMG[m.yongKey].num + '입니다.</p>' +
      '<div class="fp-note">' +
      '· 계산 근거: 양력 ' + m.r.birthLabel.solar + (m.r.birthLabel.time ? ' ' + m.r.birthLabel.time : ' (시각 미상)') +
      (m.r.birthLabel.correctedTime && m.r.input.hourKnown ? ' · 진태양시 보정 ' + m.r.birthLabel.correctedTime : '') +
      ' · 사주 ' + m.r.saju.year + ' ' + m.r.saju.month + ' ' + m.r.saju.day + (m.r.saju.hour ? ' ' + m.r.saju.hour : '') +
      '<br>· 엔진: KASI 24절기·음양력 + 진태양시 보정 만세력(korean-saju 0.3.0 이식, 15개 교차검증 일치)' +
      '<br>· 이 리포트는 전통 명리학의 상징 해석이며, 미래의 결과를 보장하지 않습니다. 의료·투자·법률 판단의 근거로 삼을 수 없습니다.' +
      '</div>' +
      '</section>';
  }

  function ctaBlock() {
    return '<div class="fp-cta">' +
      '<div class="k">만족하셨다면</div>' +
      '<div class="t">찐 정밀 전문분석지<br><b>30P · 60P · 100P</b></div>' +
      '<p>여기까지는 여덟 글자의 첫 장입니다. 월별 길흉, 귀인의 얼굴, 위기를 피하는 달, 평생 재물의 그릇까지 — 정밀 분석지가 이어집니다.</p>' +
      '<a href="https://22jutimes.com/order.html" target="_blank" rel="noopener">✨ 30P · 60P · 100P 정밀분석 보러가기</a>' +
      '<button type="button" class="fp-cta__more" data-fp-pricing>요금제 3종 나란히 보기 →</button>' +
      '<div class="p">30P 19,900원 · 60P 29,900원 · 100P 49,900원</div></div>';
  }

  /* ---------------- 조립 ---------------- */
  function renderReport(m) {
    if (m.error) { flash(m.error); return; }
    styleTag();
    var host = $('#step-detail .detail-content');
    if (!host) return;

    var head = $('#step-detail .detail-header');
    ORDER_QS = queryOf(m.input);
    if (head) {
      var h1 = head.querySelector('h1');
      var lunarNote = (m.r.input.calendar === '음력' && m.r.lunar)
        ? ' · 음력 ' + m.r.lunar.year + '.' + pad2(m.r.lunar.month) + '.' + pad2(m.r.lunar.day) + (m.r.lunar.leap ? '(윤달)' : '') + ' → 양력'
        : '';
      if (h1) h1.innerHTML = '<span class="name">' + esc(m.name) + '</span> 님의 <span style="color:#b8955f">4장</span><br><span style="font-size:13px;color:#a0b0c0;font-weight:500">' +
        m.r.birthLabel.solar + (m.r.birthLabel.time ? ' ' + m.r.birthLabel.time : ' · 시각 미상') + lunarNote + '</span>';
      var p = head.querySelector('p');
      if (p) p.textContent = '타고난 본성 · 돈 · 인연 · 2027 — 여덟 글자로 읽었습니다';
    }

    var pages = [secEssence(m), secWealth(m)];
    if (V === 1) pages.push(secLove(m), secCareer(m), secEnd(m), ctaBlock());
    else if (V === 2) pages.push(secLove(m), secCareer(m), sipTableWrap(m), secEnd(m), ctaBlock());
    else if (V === 3) pages.push(secEnd(m), ctaBlock());
    else pages = easyPages(m);

    host.innerHTML = pages.join('') +
      '<div class="fp-back"><a href="../index.html#/4p">운명사주 정운타임즈 4P</a>' +
      '<button type="button" data-fp-restart>다른 생년월일로 다시 보기</button>' +
      '<a href="' + orderHref() + '" target="_blank" rel="noopener">정밀분석 30~100P 주문</a></div>';

    /* 지면 상단·요금제 링크도 같은 주문 주소로 맞춘다 */
    var topLink = document.querySelector('.zw-top a');
    if (topLink) topLink.href = orderHref();
    $$('.pricing-card').forEach(function (c) { c.setAttribute('data-fp-order', '1'); });

    var pb = host.querySelector('[data-fp-pricing]');
    if (pb) pb.addEventListener('click', function () {
      var sd = $('#step-detail'), sp = $('#step-pricing');
      if (sp) { sd && sd.classList.remove('active'); sp.classList.add('active'); if (window.scrollTo) window.scrollTo(0, 0); }
      else if (window.showPricing) window.showPricing();
    });

    var rb = host.querySelector('[data-fp-restart]');
    if (rb) rb.addEventListener('click', function () {
      var sd = $('#step-detail'), sh = $('#step-hooking');
      if (sd) sd.classList.remove('active');
      if (sh) sh.classList.add('active');
      if (window.scrollTo) window.scrollTo(0, 0);
    });

    var sh2 = $('#step-hooking'), sd2 = $('#step-detail');
    if (sh2) sh2.classList.remove('active');
    if (sd2) sd2.classList.add('active');
    if (window.scrollTo) window.scrollTo(0, 0);
  }

  function yearSipText(b) {
    var t = {
      '비견': '동료와 힘을 합치거나, 같은 자리를 두고 겨루는 해입니다. 역할을 먼저 나누세요.',
      '겁재': '돈이 새기 쉬운 해입니다. 보증·동업·큰 지출은 문서로 남기세요.',
      '식신': '만들어 내는 해입니다. 꾸준히 쌓은 것이 평가받습니다.',
      '상관': '표현이 강해지는 해입니다. 말과 글로 기회를 잡고, 말실수도 조심하세요.',
      '편재': '판이 넓어지는 해입니다. 큰 거래·투자·이동이 들어옵니다.',
      '정재': '새지 않게 모으는 해입니다. 현실적인 계약과 수입 관리에 좋습니다.',
      '편관': '압박이 들어오는 해입니다. 규칙과 기록으로 버티면 자리가 단단해집니다.',
      '정관': '자리가 정해지는 해입니다. 승진·계약·책임이 구체화됩니다.',
      '편인': '혼자 파고드는 해입니다. 공부·연구·기술에 시간을 쓰면 남습니다.',
      '정인': '배움이 들어오는 해입니다. 자격·문서·보호가 함께 옵니다.'
    };
    var base = t[b.sip] || '한 걸음씩 쌓는 해입니다.';
    if (b.score >= 80) return base + ' 흐름이 강하게 실리니, 미뤄 둔 제안을 이 해에 놓으세요.';
    if (b.score >= 65) return base;
    return base + ' 속도를 조금 줄이고 마무리에 힘을 쓰는 편이 낫습니다.';
  }

  function sipTableWrap(m) {
    return '<section class="fp-sec"><div class="fp-kicker">APPENDIX · 십성 분포</div>' +
      '<h2 class="fp-h2">다섯 별의 <b>개수</b>가 삶의 무게를 나눕니다.</h2>' +
      sipTable(m) +
      '<p class="fp-p">이 개수는 원국 여덟 글자(시각 미상이면 여섯 글자)에 드러난 십성을 센 값입니다. 지장간까지 펼치면 해석이 더 깊어지고, 정밀분석지에서는 그 지장간까지 모두 씁니다.</p>' +
      '</section>';
  }

  function secYear2027(m) {
    var y = m.y2027;
    if (!y) return '';
    return '<section class="fp-sec"><div class="fp-kicker">PAGE 03 · 2027 정미년 — 세운</div>' +
      '<h2 class="fp-h2">2027년은 <b>' + y.hanja + '</b>, 천간이 <b>' + y.stemSip + '</b>으로 들어옵니다.</h2>' +
      '<p class="fp-p">세운의 천간은 일간에 <b>' + y.stemSip + '</b>, 지지는 <b>' + y.branchSip + '</b>으로 작용합니다. ' + yearToneText(y) + '</p>' +
      '<div class="fp-cards">' +
      '<div class="fp-card"><span>세운 총평</span><b>' + y.score + '</b><i>' + (y.tone === 'gil' ? '길' : y.tone === 'hyung' ? '주의' : '중립') + '</i></div>' +
      '<div class="fp-card"><span>천간 십성</span><b style="font-size:14px">' + y.stemSip + '</b><i>丁</i></div>' +
      '<div class="fp-card"><span>지지 십성</span><b style="font-size:14px">' + y.branchSip + '</b><i>未</i></div>' +
      '</div>' +
      '<table class="fp-table2"><thead><tr><th>2027년 달</th><th>기운</th><th>점수</th></tr></thead><tbody>' +
      m.months.slice().sort(function (a, b) { return a.month - b.month; }).map(function (mo) {
        var mark = mo.score >= 75 ? ' <span style="color:#c9a063">▲</span>' : (mo.score <= 30 ? ' <span style="color:#a35b52">▼</span>' : '');
        return '<tr><td><b>' + mo.month + '월</b></td><td>' + OHK[mo.oh] + mark + '</td><td>' + mo.score + '</td></tr>';
      }).join('') + '</tbody></table>' +
      '<p class="fp-p">점수는 이 사주의 용신 <b>' + m.yongKey + '</b>' + jj(m.yongKey, '과') + ' 그 달의 기운이 맞는지, 세운 지지(未)와 합·충이 걸리는지를 합산한 값입니다. 70 이상인 달에 중요한 일을 놓으세요.</p>' +
      secEndBody(m) +
      '</section>';
  }
  function secEndBody(m) {
    return '<div class="fp-note">· 계산 근거: 사주 ' + m.r.saju.year + ' ' + m.r.saju.month + ' ' + m.r.saju.day + (m.r.saju.hour ? ' ' + m.r.saju.hour : '') +
      ' · 용신 ' + m.yongKey + ' · 격국 ' + m.gyeok.name + ' · ' + m.level +
      '<br>· 전통 명리학의 상징 해석이며 결과를 보장하지 않습니다.</div>';
  }

  /* ================================================================== *
   * 4-2. 쉬운 말 4장 (2026-11-25 개편) — 전문용어 없이, 생활 공감 문장으로
   *   ① 타고난 본성·속마음 ② 돈이 들어오고 새는 습관
   *   ③ 인간관계·연애 스타일 ④ 2027년 가장 큰 변화 → 끊고 정밀 분석지로 직행
   * ================================================================== */
  var ORDER_URL = 'https://22jutimes.com/order.html';
  var ORDER_QS = '';

  /* 정밀분석 주문 페이지(aura-saju/order.html)가 읽는 형식 —
     ?name=홍길동&birth=1990-03-15&time=14:30&gender=남&cal=solar|lunar|lunar-leap
     생시를 모르면 time=모름 으로 보내면 주문 폼이 ‘시각 모름’을 체크한다. */
  function queryOf(inp) {
    var q = new URLSearchParams();
    if (inp.name) q.set('name', inp.name);
    q.set('birth', inp.y + '-' + pad2(inp.mo) + '-' + pad2(inp.d));
    q.set('time', inp.hourKnown ? pad2(inp.h) + ':' + pad2(inp.mi) : '모름');
    q.set('gender', inp.gender === '남' ? '남' : '여');
    q.set('cal', inp.calendar === 'lunar' ? (inp.lunarLeap ? 'lunar-leap' : 'lunar') : 'solar');
    return q.toString();
  }
  function orderHref() { return ORDER_URL + (ORDER_QS ? '?' + ORDER_QS : ''); }
  window.fpOrderHref = orderHref;
  window.goReport = function () { window.open(orderHref(), '_blank', 'noopener'); };

  /* --- 쉬운 말 사전 --- */
  var DAY_HEAD = [
    '당신은 <b>자라야 직성이 풀리는</b> 사람입니다.',
    '당신은 <b>드러내야 직성이 풀리는</b> 사람입니다.',
    '당신은 <b>중심을 잡아야 편한</b> 사람입니다.',
    '당신은 <b>정리해야 다음으로 가는</b> 사람입니다.',
    '당신은 <b>읽고 나서 움직이는</b> 사람입니다.'
  ];
  var DAY_TRAIT = [
    '멈춰 있는 걸 못 견딥니다. 뭐든 자라게 하고 싶어 하고, 새로 시작할 때 눈이 반짝입니다.',
    '속에 담아두는 걸 못 합니다. 기분이 얼굴에 그대로 쓰이고, 사람들 앞에서 말할 때 힘이 올라갑니다.',
    '중간에서 판을 정리하고 끝까지 남아 있는 쪽입니다. 약속을 지키고, 남들이 기대는 자리에 자주 섭니다.',
    '애매한 걸 못 견딥니다. 선을 긋는 데 빠르고, 한 번 정하면 잘 뒤집지 않습니다. 그래서 차갑다는 말도 듣습니다.',
    '말보다 관찰이 먼저입니다. 사람을 다 읽고 나서야 한마디 하고, 머릿속에는 늘 저장된 게 많습니다.'
  ];
  var SAYS = [
    ['“시작은 잘하는데 마무리가…”', '“새 프로젝트 얘기만 나오면 눈이 커진다”', '“계획표 만드는 걸 좋아한다”'],
    ['“기분이 얼굴에 다 써 있다”', '“분위기 띄우는 건 너밖에 없다”', '“싫은 건 싫다고 바로 말한다”'],
    ['“결국 너한테 물어보게 된다”', '“중간에서 조율하는 역할을 맡는다”', '“약속은 안 깨는 편이다”'],
    ['“칼같다, 선이 분명하다”', '“한 번 싫어하면 다시 안 본다”', '“정리정돈은 확실하다”'],
    ['“속을 알 수 없다는 말을 듣는다”', '“말수는 적은데 핵심은 정확하다”', '“조용히 다 준비해 놓는다”']
  ];
  var LEVEL_SAY = {
    '신강': '기운이 안쪽에 두텁게 쌓여 있습니다. 시키기 전에 이미 시작하고, 도움 없이도 끝까지 갑니다. 대신 혼자 다 하려다 몸이 먼저 지칩니다.',
    '중화': '힘을 주는 쪽과 받는 쪽이 반반입니다. 판이 바뀌면 생각도 같이 바뀌는 유연함이 있어서, 어디에 놓여도 크게 무너지지 않습니다.',
    '신약': '기운이 바깥으로 얇게 퍼져 있습니다. 혼자 밀어붙이면 금방 지치지만, 좋은 사람과 좋은 제도를 만나면 몇 배로 커집니다. 주변을 고르는 게 곧 실력입니다.'
  };
  var OH_NOUN = ['나무', '불', '흙', '쇠', '물'];
  var LACK_SAY = {
    '목': '“일단 해보자” 하고 첫발을 떼는 힘',
    '화': '기분을 말로 꺼내는 힘',
    '토': '중간에서 버티며 중심을 잡는 힘',
    '금': '손절하고 끊어내는 힘',
    '수': '멈추고 쉬면서 생각을 가라앉히는 힘'
  };
  var OVER_SAY = {
    '목': '늘 뭔가를 시작해야 안심이 되는데, 벌여놓은 것들이 서로 시간을 잡아먹습니다.',
    '화': '표현이 앞서서 말이 생각보다 먼저 나갑니다. 그 말이 사람을 세우기도 하고 자르기도 합니다.',
    '토': '책임을 자꾸 떠안습니다. 남의 일까지 받으면 정작 내 일이 밀립니다.',
    '금': '선을 너무 빨리 긋습니다. 한 번 정리한 관계는 다시 열기가 어렵습니다.',
    '수': '생각이 많아 결정이 늦습니다. 머릿속에서 이미 세 번 끝낸 일을 다시 시작해야 합니다.'
  };
  var JAE_POS_SAY = {
    '년': '돈 감각이 일찍 생겼고, 집안·부모 쪽에서 받은 영향이 큽니다.',
    '월': '직장과 사회에서 버는 힘이 큽니다. 조직 안에 있을 때 돈이 따라옵니다.',
    '일': '내 자리에 돈이 붙어 있습니다. 혼자 벌기보다 함께 벌 때 커집니다.',
    '시': '뒤로 갈수록 커집니다. 늦게 크는 돈이라 조급해할 필요가 없습니다.'
  };
  var SPOUSE_UNSEONG = {
    '장생': '나를 자라게 하는 사람', '목욕': '분위기와 감정이 풍부한 사람', '관대': '태도가 단정한 사람',
    '임관': '자기 일이 분명한 사람', '제왕': '주도권이 강한 사람', '쇠': '조용하고 안정된 사람',
    '병': '섬세하고 예민한 사람', '사': '마무리가 확실한 사람', '묘': '속을 잘 안 보여주는 사람',
    '절': '거리감을 지키는 사람', '태': '보호본능이 생기는 사람', '양': '편안하고 포근한 사람'
  };
  var YEAR_THEME = {
    '비견': '내 이름으로 다시 서는 일', '겁재': '경쟁이 붙고 돈이 나가는 일',
    '식신': '만들어 둔 것이 결과로 나오는 일', '상관': '말과 표현이 힘을 얻는 일',
    '편재': '돈의 판이 커지는 일', '정재': '돈이 구체적으로 들어오는 일',
    '편관': '압박이 오고, 그 압박이 자리를 만드는 일', '정관': '자리가 정해지는 일 — 직함·계약·책임',
    '편인': '혼자 파고들어 무언가를 얻는 일', '정인': '배움·자격·보호가 들어오는 일'
  };
  var SIP_PLACE = { '비겁': '사람과의 관계', '식상': '내가 만드는 일', '재성': '돈과 거래', '관성': '직장과 책임', '인성': '문서·집·배움' };
  function sipGroup(s) {
    if (!s) return '비겁';
    if (s === '비견' || s === '겁재') return '비겁';
    if (s === '식신' || s === '상관') return '식상';
    if (s === '편재' || s === '정재') return '재성';
    if (s === '편관' || s === '정관') return '관성';
    return '인성';
  }

  /* PAGE 01 — 타고난 본성과 속마음 */
  function p1(m) {
    var oh = m.dayOh, p = {};
    m.r.pillars.forEach(function (x) { p[x.key] = x; });
    var strip = '';
    ['hour', 'day', 'month', 'year'].forEach(function (k) {
      var x = p[k];
      var role = k === 'hour' ? '말년·자식' : k === 'day' ? '나·배우자' : k === 'month' ? '부모·사회' : '초년·집안';
      strip += '<div><span>' + (k === 'hour' ? '태어난 시' : k === 'day' ? '태어난 날' : k === 'month' ? '태어난 달' : '태어난 해') + '</span>' +
        (x && !x.unknown
          ? '<b>' + STEMS[x.stem.idx].hanja + BRANCHES[x.branch.idx].hanja + '</b><i>' + STEMS[x.stem.idx].hangul + BRANCHES[x.branch.idx].hangul + ' · ' + role + '</i>'
          : '<b style="font-size:15px;color:#9aa1ad">모름</b><i>' + role + '</i>') + '</div>';
    });

    var sayBox = '<div class="fp-say"><div class="q">이런 말을 들어본 적 있다면, 그건 성격이 아니라 여덟 글자입니다.</div><ul>' +
      SAYS[oh].map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul></div>';

    var inner = (m.maxI !== oh)
      ? '처음 보는 사람은 당신을 <b>' + OH_NOUN[oh] + ' 같은 사람</b>으로 기억합니다 — ' + OH_IMG[OHK[oh]].img + ' 쪽. 그런데 가까운 사람만 아는 진짜 무게는 <b>' + OH_NOUN[m.maxI] + '</b>에 있습니다. 결정적인 순간에 손이 먼저 가는 쪽도 그쪽입니다.'
      : '겉과 속이 같은 결입니다. 처음 본 사람과 오래된 친구가 당신을 똑같이 설명합니다 — <b>' + OH_NOUN[oh] + ' 같은 사람</b>. 기분이 그대로 보여서 숨기기가 어렵고, 그래서 사람을 빨리 가려냅니다.';

    var weak = '';
    if (m.lack.length) {
      weak = '여덟 글자에 <b>' + m.lack.map(function (k) { return OH_NOUN[OHK.indexOf(k)]; }).join('·') + '</b> 기운이 한 자리도 없습니다. ' + LACK_SAY[m.lack[0]] + ' — 이건 타고난 게 아니라 평생 만들어가야 하는 숙제입니다. 그래서 이 부분에서 스스로를 자주 의심합니다.';
    } else if (m.counts[m.maxI] >= 4) {
      weak = '<b>' + OH_NOUN[m.maxI] + '</b> 기운이 여덟 글자에 ' + m.counts[m.maxI] + '개나 됩니다. 넘치면 장점이 습관이 되고, 습관이 되면 발목을 잡습니다. ' + OVER_SAY[OHK[m.maxI]];
    } else {
      weak = '다섯 기운이 골고루 놓여 있습니다. 큰 구멍이 없다는 건 큰 장점이고, 대신 <b>눈에 띄는 무기 하나</b>가 없다는 뜻이기도 합니다. 하나를 골라 깊게 파면 나머지가 따라옵니다.';
    }

    return '<section class="fp-sec">' +
      '<div class="fp-kicker">PAGE 01 · 타고난 본성</div>' +
      '<h2 class="fp-h2">' + DAY_HEAD[oh] + '</h2>' +
      '<p class="fp-p">태어난 날의 글자는 <b>' + m.dayHanja + '(' + m.dayHangul + ')</b>입니다. ' + DAY_TRAIT[oh] + '</p>' +
      '<div class="fp-8">' + strip + '</div>' +
      '<p class="fp-p">' + LEVEL_SAY[m.level] + '</p>' +
      '<p class="fp-p">' + inner + '</p>' +
      '<p class="fp-p">' + weak + '</p>' +
      sayBox +
      '<div class="fp-teaser"><div class="q">그런데 이 사람은, 돈 앞에서 완전히 달라집니다.</div>' +
      '<div class="blur">본성은 사람을 설명하지만 통장을 설명하지는 못합니다. 돈이 어디로 들어오고 어디서 새는지는 여덟 글자의 다른 자리가 정합니다. 다음 장에서 숫자로 확인합니다.</div></div>' +
      '<div class="fp-turn">다음 장 · 돈이 들어오는 문과 새는 구멍</div>' +
      '</section>';
  }

  /* PAGE 02 — 돈 */
  function p2(m) {
    var jaePos = [];
    m.r.pillars.forEach(function (x) {
      if (x.unknown) return;
      if (JAE.indexOf(E.internal.shipsinForStem(m.dayStem, x.stem.idx)) >= 0) jaePos.push(x.label.charAt(0));
      if (JAE.indexOf(E.internal.shipsinForBranch(m.dayStem, x.branch.idx)) >= 0) jaePos.push(x.label.charAt(0));
    });
    var head = m.nJae >= 3 ? '돈은 <b>여러 문으로 동시에</b> 들어옵니다.'
      : m.nJae === 2 ? '돈은 <b>두 개의 문</b>으로 들어옵니다.'
      : m.nJae === 1 ? '돈은 <b>한 개의 문</b>으로 들어옵니다.'
      : '돈은 <b>쫓아가면 멀어지고, 자리를 잡으면 들어오는</b> 사주입니다.';
    var inText = m.nJae >= 3 ? '한 곳이 막혀도 다른 곳에서 들어오는 구조입니다. 다만 관리하지 않으면 여러 곳에서 동시에 샙니다.'
      : m.nJae === 2 ? '하나는 안정적이고, 하나는 변동이 큽니다. 변동이 큰 쪽에 전 재산을 걸지 마세요.'
      : m.nJae === 1 ? '그 한 곳을 깊게 파는 쪽이 훨씬 유리합니다. 여기저기 손대면 어느 것도 남지 않습니다.'
      : '눈에 보이는 문이 없습니다. 그래서 돈은 “들어오는” 게 아니라 “만들어지는” 쪽입니다 — 기술·콘텐츠·사람을 통해.';
    var posText = jaePos.length ? JAE_POS_SAY[jaePos[0]] : '돈이 드러나 있지 않아, 스스로 구조를 만들어야 합니다.';

    var leaks = [];
    if (m.nBi >= 3) leaks.push(['사람에서 샙니다', '보증, 동업, 밥값. 빌려주고 못 받은 돈을 세어보면 생각보다 큽니다.']);
    if (m.nSik >= 3) leaks.push(['쓰는 손이 큽니다', '벌면 바로 씁니다. 갖고 싶은 게 생기면 계산보다 결제가 먼저입니다.']);
    if (m.nIn >= 3) leaks.push(['배움·문서·집에 갑니다', '나쁜 지출은 아니지만 현금이 묶여 있다는 느낌이 듭니다.']);
    if (m.nGwan >= 3) leaks.push(['책임에 묶입니다', '직장·가족·규칙 때문에 쓰고 싶어도 못 쓰는 지출이 생깁니다.']);
    if (!leaks.length) leaks.push(['큰 구멍은 없습니다', '다만 한 달이 끝나면 남는 게 없습니다. 작은 결제가 새는 쪽입니다.']);
    var fix = m.nBi >= 3 ? '돈 나가는 자리를 미리 정해두세요. 사람 만나기 전에 쓸 금액을 정하고 나가면 그 달이 남습니다.'
      : m.nSik >= 3 ? '갖고 싶은 것이 생기면 3일만 기다리세요. 3일 뒤에도 사고 싶으면 사도 됩니다.'
      : m.nIn >= 3 ? '배움에 쓰는 돈은 예산을 따로 떼어두세요. 통장 하나를 “공부·문서”로 분리하면 새는 느낌이 사라집니다.'
      : m.nGwan >= 3 ? '책임 비용을 고정지출로 먼저 계산해 두세요. 남는 돈으로 사는 습관을 만들면 덜 답답합니다.'
      : '일주일 지출을 한 번만 적어보세요. 새는 곳은 거의 똑같이 반복됩니다.';

    return '<section class="fp-sec">' +
      '<div class="fp-kicker">PAGE 02 · 돈</div>' +
      '<h2 class="fp-h2">' + head + '</h2>' +
      '<p class="fp-p">' + posText + ' ' + (m.nJae >= 3 ? '여러 문이 열려 있는 만큼, 관리가 곧 재능입니다.' : m.nJae === 2 ? '두 문 중 어디에 힘을 줄지가 관건입니다.' : m.nJae === 1 ? '그 한 문을 깊게 파는 쪽이 훨씬 유리합니다.' : '문이 보이지 않는다면, 문을 만드는 쪽이 맞습니다.') + '</p>' +
      '<div class="fp-score">' +
      '<div class="fp-ring"><svg width="74" height="74" viewBox="0 0 74 74"><circle class="bg" cx="37" cy="37" r="30"></circle>' +
      '<circle class="fg" cx="37" cy="37" r="30" stroke-dasharray="188.5" stroke-dashoffset="' + (188.5 - m.wealth / 100 * 188.5).toFixed(1) + '"></circle></svg><b>' + m.wealth + '</b></div>' +
      '<div class="t"><strong>돈 그릇 ' + m.wealth + ' / 100</strong>' +
      (m.wealth >= 75 ? '그릇이 큰 편입니다. 문제는 크기가 아니라 시기입니다.' : m.wealth >= 55 ? '그릇은 충분합니다. 새는 곳 하나만 막으면 남습니다.' : '그릇은 작지만 단단합니다. 크게 벌이기보다 오래 쥐는 쪽이 맞습니다.') +
      '</div></div>' +
      '<div class="fp-boxes">' +
      '<div class="fp-box"><b>돈이 들어오는 통로</b><p>' + inText + '</p></div>' +
      '<div class="fp-box"><b>돈이 새는 곳</b><p><b>' + leaks[0][0] + '</b> — ' + leaks[0][1] + (leaks[1] ? '<br><b>' + leaks[1][0] + '</b> — ' + leaks[1][1] : '') + '</p></div>' +
      '</div>' +
      '<p class="fp-p"><b>그래서 이렇게 하세요.</b> ' + fix + '</p>' +
      '<div class="fp-teaser"><div class="q">그런데 이 습관이 가장 크게 새는 달이 따로 있습니다.</div>' +
      '<div class="blur">2027년 열두 달 중 돈이 크게 나가는 달과 크게 들어오는 달은 같은 사람이라도 정반대입니다. 그 달을 피하는 법은 마지막 장에서 정리합니다.</div></div>' +
      '<div class="fp-turn">다음 장 · 곁에 오는 사람과 마음이 가는 쪽</div>' +
      '</section>';
  }

  /* PAGE 03 — 사람·인연 */
  function p3(m) {
    var p = null;
    m.r.pillars.forEach(function (x) { if (x.key === 'day' && !x.unknown) p = x; });
    var head = m.spouseN >= 3 ? '인연은 <b>여러 번 스치고, 그때마다 기준이 흔들립니다.</b>'
      : m.spouseN >= 1 ? '인연은 <b>한 번 깊게</b> 옵니다.'
      : '인연은 <b>늦게, 그러나 오래</b> 옵니다.';
    var starText = m.spouseN >= 3 ? '별이 여러 개면 선택의 순간이 여러 번 옵니다. 그때마다 기준이 흔들리지 않는 게 중요합니다.'
      : m.spouseN >= 1 ? '별이 하나로 모여 있어, 한 사람에게 마음이 깊게 가는 구조입니다.'
      : '드러난 별이 없다고 인연이 없다는 뜻은 아닙니다. 흐름이 그 별을 데려오는 해에 관계가 시작되는 경우가 많습니다.';
    var pattern = m.nBi >= m.nIn && m.nBi >= m.nSik && m.nBi >= m.nGwan ? '친구와 연인의 경계가 흐릿합니다. 편한 사람에게 마음이 가고, 그래서 시작이 늦거나 끝이 흐려집니다.'
      : m.nIn >= m.nSik && m.nIn >= m.nGwan ? '보호받고 싶은 마음이 큽니다. 상대가 나를 얼마나 챙기는지로 애정을 확인하는 편입니다.'
      : m.nSik >= m.nGwan ? '표현이 앞섭니다. 좋으면 다 보여주고, 서운하면 바로 티가 납니다.'
      : m.nGwan >= 3 ? '책임지는 사람에게 끌립니다. 다만 그 사람이 무너지면 나도 같이 흔들립니다.'
      : '관계의 속도가 일정합니다. 급하게 달아오르지도, 쉽게 식지도 않습니다.';

    return '<section class="fp-sec">' +
      '<div class="fp-kicker">PAGE 03 · 사람과 인연</div>' +
      '<h2 class="fp-h2">' + head + '</h2>' +
      '<p class="fp-p">' + starText + '</p>' +
      '<p class="fp-p">' + pattern + '</p>' +
      '<div class="fp-boxes">' +
      '<div class="fp-box"><b>먼저 마음이 가는 사람</b><p>' + OH_NOUN[m.spouseOh] + ' 같은 사람 — ' + OH_IMG[OHK[m.spouseOh]].key + jj(OH_IMG[OHK[m.spouseOh]].key, '이') + ' 분명한 사람. 말보다 태도로 보여주는 쪽에 약합니다.</p></div>' +
      '<div class="fp-box"><b>곁에 오는 사람</b><p>' + (p ? (SPOUSE_UNSEONG[p.unseong.name] || '편안한 사람') + ' — 배우자 자리에 앉은 글자가 그런 사람을 데려옵니다.' : '배우자 자리를 읽으려면 태어난 시각이 필요합니다.') + '</p></div>' +
      '</div>' +
      '<p class="fp-p"><b>오래 가는 조건.</b> ' + (m.level === '신강' ? '내 힘이 센 편이라, 말투를 낮추는 것만으로 관계가 길어집니다.' : m.level === '신약' ? '상대의 속도에 맞추다 지치지 않도록, 내가 원하는 것을 먼저 말해야 합니다.' : '관계의 규칙을 함께 정할 때 가장 안정됩니다.') + '</p>' +
      (m.y2027 ? '<p class="fp-p">2027년에는 이 자리와 ' + (m.y2027.hap.length ? '이어지는 흐름이 생깁니다. 인연이 구체적인 형태로 좁혀지는 해입니다.' : m.y2027.chung.length ? '부딪히는 흐름이 생깁니다. 큰 결정은 한 번 더 확인하고 움직이세요.' : '직접 엮이지 않습니다. 관계보다 나를 정비하는 해입니다.') + '</p>' : '') +
      '<div class="fp-teaser"><div class="q">2027년, 이 사람에게 가장 큰 변화가 오는 때</div>' +
      '<div class="blur">바뀌는 건 돈도 사람도 아닐 수 있습니다. 여덟 글자에 새로 얹히는 한 글자가 어느 자리를 건드리느냐가 방향을 정합니다.</div></div>' +
      '<div class="fp-turn">다음 장 · 2027년, 가장 큰 변화</div>' +
      '</section>';
  }

  /* PAGE 04 — 2027 (여기서 끊는다) */
  function p4(m) {
    var y = m.y2027;
    if (!y) return '';
    var byMonth = {};
    m.months.forEach(function (x) { byMonth[x.month] = x.score; });
    var vals = [];
    for (var i = 1; i <= 12; i++) vals.push(typeof byMonth[i] === 'number' ? byMonth[i] : 55);
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    var bars = vals.map(function (sc) {
      var t = (sc - mn) / ((mx - mn) || 1);
      var h = 20 + Math.round(t * 50);
      var op = (0.4 + t * 0.6).toFixed(2);
      return '<i style="height:' + h + 'px;opacity:' + op + '"></i>';
    }).join('');
    var theme = YEAR_THEME[y.stemSip] || '생활의 판이 바뀌는 일';
    var place = SIP_PLACE[sipGroup(y.branchSip)] || '내 자리';
    var toneText = y.tone === 'gil' ? '들어오는 기운이 재물과 명예 쪽이라, 미뤄 둔 일을 꺼내기 좋은 해입니다.'
      : y.tone === 'hyung' ? '들어오는 기운이 나를 누르거나 흔드는 쪽이라, 확장보다 정리가 유리한 해입니다.'
      : y.chung.length ? '들어오는 기운이 ' + y.chung.map(function (c) { return c.label; }).join('·') + '와 부딪힙니다. 크게 벌이기보다 수습이 중요한 해입니다.'
      : '무난한 흐름입니다. 크게 벌지도, 크게 잃지도 않는 해입니다.';
    var toneLabel = y.tone === 'gil' ? '순풍' : y.tone === 'hyung' ? '주의' : '무난';

    return '<section class="fp-sec">' +
      '<div class="fp-kicker">PAGE 04 · 2027년</div>' +
      '<h2 class="fp-h2">2027년, 당신에게 오는 가장 큰 변화는 <b>' + theme + '</b>입니다.</h2>' +
      '<p class="fp-p">2027년은 정미(丁未)년입니다. 당신의 여덟 글자 위에 새 글자 한 쌍이 얹히는 해이고, 그중 위 글자는 <b>' + theme + '</b> 쪽으로 들어옵니다. ' + toneText + '</p>' +
      '<div class="fp-cards">' +
      '<div class="fp-card"><span>2027년 총운</span><b>' + y.score + '</b><i>' + toneLabel + '</i></div>' +
      '<div class="fp-card"><span>변화의 방향</span><b style="font-size:13px">' + theme + '</b><i>2027</i></div>' +
      '<div class="fp-card"><span>변화가 오는 자리</span><b style="font-size:14px">' + place + '</b><i>2027</i></div>' +
      '</div>' +
      '<p class="fp-p">열두 달의 무게는 이렇게 다릅니다. 막대가 높은 달에 문이 열리고, 낮은 달에 돈과 사람이 새기 쉽습니다.</p>' +
      '<div class="fp-month">' + bars + '</div>' +
      '<div class="fp-monthlab">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (n) { return '<span>' + n + '</span>'; }).join('') + '</div>' +
      '<div class="fp-cliff"><div class="k">여기서 끊습니다</div>' +
      '<p>정확히 <b>몇 월에 조심해야 하는지</b>, 그리고 <b>돈이 가장 크게 움직이는 달</b>은 — 이 4장에서는 알려드리지 않습니다.</p>' +
      '<em>그 달을 피하는 법과 그 달에 꼭 해야 할 한 가지는 정밀 분석지에 있습니다. 네 장으로는 여기까지가 한계입니다.</em></div>' +
      '<div class="fp-cta">' +
      '<div class="k">4P는 맛보기입니다</div>' +
      '<div class="t">내 2027년 정밀 분석지<br><b>바로 받기</b></div>' +
      '<p>같은 여덟 글자로 30장을 씁니다. 열두 달의 길흉, 조심할 달과 해야 할 일, 돈이 움직이는 시기, 귀인의 얼굴까지.</p>' +
      '<a href="' + orderHref() + '" target="_blank" rel="noopener">👉 내 2027년 정밀 분석지 바로 받기</a>' +
      '<div class="price">30P 19,900원 · 60P 29,900원 · 100P 49,900원</div>' +
      '<div class="p">2장 요약본이 아니라, 30장부터 시작하는 정밀 분석입니다 · 생년월일은 방금 넣은 값 그대로 이어집니다</div>' +
      '<button type="button" class="fp-cta__more" data-fp-pricing>30P · 60P · 100P 차이 보기 →</button>' +
      '<a class="a2" href="../index.html#/free" target="_top" rel="noopener">오늘의 무료 운세 먼저 보기</a>' +
      '</div>' +
      '<div class="fp-note">· 계산 근거: 양력 ' + m.r.birthLabel.solar + (m.r.birthLabel.time ? ' ' + m.r.birthLabel.time : ' (시각 미상)') +
      ' · 엔진: KASI 24절기·음양력 + 진태양시 보정 만세력(korean-saju 0.3.0 이식)' +
      '<br>· 이 리포트는 전통 명리학의 상징 해석이며, 미래의 결과를 보장하지 않습니다. 의료·투자·법률 판단의 근거로 삼을 수 없습니다.' +
      '</div>' +
      '</section>';
  }

  function easyPages(m) {
    return [p1(m), p2(m), p3(m), p4(m)];
  }

  /* ------------------------------------------------------------------ *
   * 5. 요금제 — 확정 요금으로 다시 그린다 (표시 오류 방지)
   * ------------------------------------------------------------------ */
  var PLANS = [
    { pages: '30', name: '운명의 나침반', price: '19,900', desc: '재물·애정·직업 3대 운을 심층 분석' },
    { pages: '60', name: '운명의 지도', price: '29,900', desc: '월별 길흉·귀인·위기 대처까지', pick: true },
    { pages: '100', name: '마스터 플랜', price: '49,900', desc: '평생 재물 그릇·인생 총정리' }
  ];
  function renderPricing() {
    var host = $('#step-pricing');
    if (!host) return;
    var head = host.querySelector('.pricing-header');
    var sub = host.querySelector('.pricing-sub');
    // 지면마다 가격 클래스가 다르다: 04는 .pkg-price, 나머지는 .pkg-price-wrap/.pkg-price-discount
    var plain = !host.querySelector('.pkg-price-wrap');
    $$('.pricing-card', host).forEach(function (c) { c.remove(); });
    var html = PLANS.map(function (p) {
      var priceHTML = plain
        ? '<div class="pkg-price">' + p.price + '<span>원</span></div>'
        : '<div class="pkg-price-wrap"><span class="pkg-price-discount">' + p.price + '<span>원</span></span></div>';
      return '<div class="pricing-card' + (p.pick ? ' recommend' : '') + '" onclick="goReport()" style="cursor:pointer">' +
        (p.pick ? '<div class="recommend-badge">가장 많이 선택</div>' : '') +
        '<div class="pkg-title">' + p.name + '</div>' +
        '<div class="pkg-pages">' + p.pages + ' Pages</div>' +
        '<div class="pkg-desc">' + p.desc + '</div>' +
        priceHTML +
        '<div class="pkg-btn' + (p.pick ? ' gold' : '') + '">선택하기</div>' +
        '</div>';
    }).join('');
    if (sub) sub.insertAdjacentHTML('afterend', html);
    else if (head) head.insertAdjacentHTML('afterend', html);
    else host.insertAdjacentHTML('beforeend', html);
  }

  /* ------------------------------------------------------------------ *
   * 6. 실행
   * ------------------------------------------------------------------ */
  var lastModel = null;
  function go() {
    var inp = readForm();
    if (!inp) return;
    var m = buildModel(inp);
    if (m.error) { flash(m.error); return; }
    lastModel = m;
    renderReport(m);
    // 주소창에 입력값을 남겨 새로고침·공유에도 유지 (개인정보는 서버로 가지 않음)
    try {
      var q = new URLSearchParams();
      q.set('n', inp.name || ''); q.set('g', inp.gender);
      q.set('c', inp.calendar); if (inp.lunarLeap) q.set('lp', '1');
      q.set('y', inp.y); q.set('m', inp.mo); q.set('d', inp.d);
      if (inp.hourKnown) q.set('t', pad2(inp.h) + pad2(inp.mi)); else q.set('u', '1');
      history.replaceState(null, '', location.pathname + '?' + q.toString());
    } catch (e) { /* 구형 브라우저는 주소 유지 생략 */ }
  }
  window.fpGo = go;

  function boot() {
    styleTag();
    window.openKakaoAndUnlock = go;   // 지면에 남아 있는 inline onclick 대비
    ensureForm();
    renderPricing();
    var p = readParams();
    if (p) {
      fillForm(p);
      var m = buildModel(p);
      if (m.error) { flash(m.error); return; }
      renderReport(m);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
