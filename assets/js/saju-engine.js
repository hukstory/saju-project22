/* 정운타임즈 사주 분석 엔진
 * ------------------------------------------------------------------
 * Python 패키지 korean-saju 0.3.0 의 계산 로직을 그대로 옮긴 순수 JS 구현.
 *  - KASI 24절기(2000~2027) + 범위 밖은 Meeus 태양황경 계산
 *  - KASI 음양력(1900~2050)
 *  - 연주(입춘 기준) / 월주(절 기준) / 일주(Julian Day) / 시주(진태양시·오서둔)
 *  - 야자시 분리법, 십성, 지장간, 12운성, 12신살, 공망, 대운, 세운
 *  - 격국(자평진전), 억부 신강/신약, 조후, 용신·희신
 * 브라우저에서 file:// 로 열어도 동작하도록 외부 의존성이 없다.
 */
(function (global) {
  'use strict';

  const RAW = global.SAJU_DATA;

  /* ============================ 기본 상수 ============================ */

  const OH = [
    { key: '목', hanja: '木', en: 'wood' },
    { key: '화', hanja: '火', en: 'fire' },
    { key: '토', hanja: '土', en: 'earth' },
    { key: '금', hanja: '金', en: 'metal' },
    { key: '수', hanja: '水', en: 'water' },
  ];
  const OH_INDEX = { 목: 0, 화: 1, 토: 2, 금: 3, 수: 4 };

  // 천간 0=갑 … 9=계
  const STEMS = [
    { hanja: '甲', hangul: '갑', yang: true, oh: 0 },
    { hanja: '乙', hangul: '을', yang: false, oh: 0 },
    { hanja: '丙', hangul: '병', yang: true, oh: 1 },
    { hanja: '丁', hangul: '정', yang: false, oh: 1 },
    { hanja: '戊', hangul: '무', yang: true, oh: 2 },
    { hanja: '己', hangul: '기', yang: false, oh: 2 },
    { hanja: '庚', hangul: '경', yang: true, oh: 3 },
    { hanja: '辛', hangul: '신', yang: false, oh: 3 },
    { hanja: '壬', hangul: '임', yang: true, oh: 4 },
    { hanja: '癸', hangul: '계', yang: false, oh: 4 },
  ];

  // 지지 0=자 … 11=해  (음양은 라이브러리 정의 그대로)
  const BRANCHES = [
    { hanja: '子', hangul: '자', yang: false, oh: 4 },
    { hanja: '丑', hangul: '축', yang: false, oh: 2 },
    { hanja: '寅', hangul: '인', yang: true, oh: 0 },
    { hanja: '卯', hangul: '묘', yang: false, oh: 0 },
    { hanja: '辰', hangul: '진', yang: true, oh: 2 },
    { hanja: '巳', hangul: '사', yang: true, oh: 1 },
    { hanja: '午', hangul: '오', yang: false, oh: 1 },
    { hanja: '未', hangul: '미', yang: false, oh: 2 },
    { hanja: '申', hangul: '신', yang: true, oh: 3 },
    { hanja: '酉', hangul: '유', yang: false, oh: 3 },
    { hanja: '戌', hangul: '술', yang: true, oh: 2 },
    { hanja: '亥', hangul: '해', yang: true, oh: 4 },
  ];

  const ROLE = ['여기', '중기', '본기']; // 0,1,2
  const ROLE_HANJA = ['餘氣', '中氣', '本氣'];

  // 지장간: [천간 index, 역할] — 여기 → 중기 → 본기 순서
  const JIJANGGAN = [
    [[8, 0], [9, 2]],              // 子
    [[9, 0], [7, 1], [5, 2]],      // 丑
    [[4, 0], [2, 1], [0, 2]],      // 寅
    [[0, 0], [1, 2]],              // 卯
    [[1, 0], [9, 1], [4, 2]],      // 辰
    [[4, 0], [6, 1], [2, 2]],      // 巳
    [[2, 0], [5, 1], [3, 2]],      // 午
    [[3, 0], [1, 1], [5, 2]],      // 未
    [[4, 0], [8, 1], [6, 2]],      // 申
    [[6, 0], [7, 2]],              // 酉
    [[7, 0], [3, 1], [4, 2]],      // 戌
    [[4, 0], [0, 1], [8, 2]],      // 亥
  ];

  const SIP = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'];
  const SIP_HANJA = ['比肩', '劫財', '食神', '傷官', '偏財', '正財', '偏官', '正官', '偏印', '正印'];

  const UNSEONG = ['장생', '목욕', '관대', '임관', '제왕', '쇠', '병', '사', '묘', '절', '태', '양'];
  const UNSEONG_HANJA = ['長生', '沐浴', '冠帶', '臨官', '帝旺', '衰', '病', '死', '墓', '絶', '胎', '養'];

  const SIBISINSAL = ['겁살', '재살', '천살', '지살', '연살', '월살', '망신살', '장성살', '반안살', '역마살', '육해살', '화개살'];

  const JANGSAENG = [11, 6, 2, 9, 2, 9, 5, 0, 8, 3]; // 갑해 을오 병인 정유 무인 기유 경사 신자 임신 계묘

  const ROK = [2, 3, 5, 6, 5, 6, 8, 9, 11, 0]; // 갑인 을묘 병사 정오 무사 기오 경신 신유 임해 계자

  const YANGIN = { 0: 3, 2: 6, 4: 6, 6: 9, 8: 0 }; // 양일간만: 갑묘 병오 무오 경유 임자

  const JEOL_TO_BRANCH = {
    입춘: 2, 경칩: 3, 청명: 4, 입하: 5, 망종: 6, 소서: 7,
    입추: 8, 백로: 9, 한로: 10, 입동: 11, 대설: 0, 소한: 1,
  };
  const JEOL_NAMES = new Set(Object.keys(JEOL_TO_BRANCH));

  const TERM_LONGITUDE = {
    소한: 285, 대한: 300, 입춘: 315, 우수: 330, 경칩: 345, 춘분: 0,
    청명: 15, 곡우: 30, 입하: 45, 소만: 60, 망종: 75, 하지: 90,
    소서: 105, 대서: 120, 입추: 135, 처서: 150, 백로: 165, 추분: 180,
    한로: 195, 상강: 210, 입동: 225, 소설: 240, 대설: 255, 동지: 270,
  };
  const TERM_APPROX = {
    소한: [1, 5], 대한: [1, 20], 입춘: [2, 4], 우수: [2, 19], 경칩: [3, 5], 춘분: [3, 20],
    청명: [4, 5], 곡우: [4, 20], 입하: [5, 5], 소만: [5, 21], 망종: [6, 5], 하지: [6, 21],
    소서: [7, 7], 대서: [7, 22], 입추: [8, 7], 처서: [8, 23], 백로: [9, 7], 추분: [9, 23],
    한로: [10, 8], 상강: [10, 23], 입동: [11, 7], 소설: [11, 22], 대설: [12, 7], 동지: [12, 21],
  };
  const TERM_ORDER = ['소한', '대한', '입춘', '우수', '경칩', '춘분', '청명', '곡우', '입하', '소만',
    '망종', '하지', '소서', '대서', '입추', '처서', '백로', '추분', '한로', '상강', '입동', '소설', '대설', '동지'];

  const HOUR = 3600000;
  const DAY = 86400000;

  /* ============================ 시간 유틸 ============================ */

  // KST 벽시계 → UTC epoch ms
  function kstToMs(y, mo, d, h, mi, s) {
    return Date.UTC(y, mo - 1, d, h || 0, mi || 0, s || 0) - 9 * HOUR;
  }

  function msToUTC(ms) {
    const dt = new Date(ms);
    return {
      y: dt.getUTCFullYear(), mo: dt.getUTCMonth() + 1, d: dt.getUTCDate(),
      h: dt.getUTCHours(), mi: dt.getUTCMinutes(), s: dt.getUTCSeconds(),
    };
  }

  // KST 벽시계 값 (UTC ms 에서 +9)
  function msToKST(ms) {
    const dt = new Date(ms + 9 * HOUR);
    return {
      y: dt.getUTCFullYear(), mo: dt.getUTCMonth() + 1, d: dt.getUTCDate(),
      h: dt.getUTCHours(), mi: dt.getUTCMinutes(), s: dt.getUTCSeconds(),
      wd: dt.getUTCDay(),
    };
  }

  function pad(n, w) { n = String(n); while (n.length < (w || 2)) n = '0' + n; return n; }

  function fmtDate(y, mo, d) { return y + '-' + pad(mo) + '-' + pad(d); }

  /* ============================ Julian Day ============================ */

  function jdFromUTC(y, mo, d, h, mi, s) {
    let yy = y, mm = mo;
    if (mm <= 2) { yy -= 1; mm += 12; }
    const a = Math.floor(yy / 100);
    const b = 2 - a + Math.floor(a / 4);
    const dayFrac = d + ((h || 0) * 3600 + (mi || 0) * 60 + (s || 0)) / 86400;
    return Math.floor(365.25 * (yy + 4716)) + Math.floor(30.6001 * (mm + 1)) + dayFrac + b - 1524.5;
  }

  function jdToMsUTC(jd) {
    const z = Math.floor(jd + 0.5);
    const f = (jd + 0.5) - z;
    let a;
    if (z < 2299161) a = z;
    else {
      const alpha = Math.floor((z - 1867216.25) / 36524.25);
      a = z + 1 + alpha - Math.floor(alpha / 4);
    }
    const b = a + 1524;
    const c = Math.floor((b - 122.1) / 365.25);
    const d = Math.floor(365.25 * c);
    const e = Math.floor((b - d) / 30.6001);
    const dayWithFraction = b - d - Math.floor(30.6001 * e) + f;
    const day = Math.floor(dayWithFraction);
    const dayFrac = dayWithFraction - day;
    const month = e < 14 ? e - 1 : e - 13;
    const year = month > 2 ? c - 4716 : c - 4715;
    const totalMs = Math.round(dayFrac * 86400 * 1000);
    return Date.UTC(year, month - 1, day) + totalMs;
  }

  /* ============================ ΔT · 태양황경 ============================ */

  function deltaT(year, month) {
    const y = year + (month - 0.5) / 12;
    if (year < 1900) { const t = (y - 1820) / 100; return -20 + 32 * t * t; }
    if (year < 1920) {
      const t = y - 1900;
      return -2.79 + 1.494119 * t - 0.0598939 * t ** 2 + 0.0061966 * t ** 3 - 0.000197 * t ** 4;
    }
    if (year < 1941) { const t = y - 1920; return 21.20 + 0.84493 * t - 0.0761 * t ** 2 + 0.0020936 * t ** 3; }
    if (year < 1961) { const t = y - 1950; return 29.07 + 0.407 * t - t ** 2 / 233 + t ** 3 / 2547; }
    if (year < 1986) { const t = y - 1975; return 45.45 + 1.067 * t - t ** 2 / 260 - t ** 3 / 718; }
    if (year < 2005) {
      const t = y - 2000;
      return 63.86 + 0.3345 * t - 0.060374 * t ** 2 + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5;
    }
    if (year < 2050) { const t = y - 2000; return 62.92 + 0.32217 * t + 0.005589 * t ** 2; }
    if (year <= 2150) return -20 + 32 * ((y - 1820) / 100) ** 2 - 0.5628 * (2150 - y);
    const t = (y - 1820) / 100;
    return -20 + 32 * t * t;
  }

  function norm360(x) { x = x % 360; if (x < 0) x += 360; return x; }

  function sunApparentLongitude(jdTT, ) {
    const t = (jdTT - 2451545.0) / 36525.0;
    const l0 = norm360(280.46646 + t * (36000.76983 + t * 0.0003032));
    const m = 357.52911 + t * (35999.05029 - t * 0.0001537);
    const mr = m * Math.PI / 180;
    const c = (1.914602 - t * (0.004817 + t * 0.000014)) * Math.sin(mr)
      + (0.019993 - t * 0.000101) * Math.sin(2 * mr)
      + 0.000289 * Math.sin(3 * mr);
    const trueLon = l0 + c;
    const omega = 125.04 - 1934.136 * t;
    return norm360(trueLon - 0.00569 - 0.00478 * Math.sin(omega * Math.PI / 180));
  }

  function findCrossing(year, targetLon, approxMonth, approxDay) {
    let jdUT = jdFromUTC(year, approxMonth, approxDay);
    const DAILY = 0.9856, TOL = 1e-5;
    for (let i = 0; i < 30; i++) {
      const dt = deltaT(year, approxMonth);
      const jdTT = jdUT + dt / 86400.0;
      const lon = sunApparentLongitude(jdTT);
      let diff = targetLon - lon;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      if (Math.abs(diff) < TOL) break;
      jdUT += diff / DAILY;
    }
    return jdToMsUTC(jdUT);
  }

  /* ============================ 절기 소스 ============================ */

  const TERM_SOURCE = (function () {
    const byYear = new Map();
    const list = (RAW && RAW.terms) || [];
    for (const [year, name, iso] of list) {
      if (!byYear.has(year)) byYear.set(year, []);
      byYear.get(year).push({ year: year, name: name, ms: Date.parse(iso) });
    }
    const computed = new Map();

    function isJEOL(name) { return JEOL_NAMES.has(name); }

    function computeYear(year) {
      if (computed.has(year)) return computed.get(year);
      const out = TERM_ORDER.map(function (name) {
        const ap = TERM_APPROX[name];
        return { year: year, name: name, ms: findCrossing(year, TERM_LONGITUDE[name], ap[0], ap[1]) };
      });
      computed.set(year, out);
      return out;
    }

    function termsForYear(year) {
      const kasi = byYear.get(year);
      if (kasi && kasi.length === 24) return kasi.slice().sort(function (a, b) { return a.ms - b.ms; });
      return computeYear(year).slice().sort(function (a, b) { return a.ms - b.ms; });
    }

    function get(year, name) {
      const arr = termsForYear(year);
      for (const t of arr) if (t.name === name) return t;
      return null;
    }

    function spanCandidates(ms) {
      const u = msToUTC(ms);
      const out = termsForYear(u.y - 1).concat(termsForYear(u.y), termsForYear(u.y + 1));
      out.sort(function (a, b) { return a.ms - b.ms; });
      return out;
    }

    function termAtOrBefore(ms, jeolOnly) {
      const cands = spanCandidates(ms);
      let result = null;
      for (const t of cands) {
        if (jeolOnly && !isJEOL(t.name)) continue;
        if (t.ms > ms) break;
        result = t;
      }
      return result;
    }

    function termAfter(ms, jeolOnly) {
      const cands = spanCandidates(ms);
      for (const t of cands) {
        if (jeolOnly && !isJEOL(t.name)) continue;
        if (t.ms > ms) return t;
      }
      return null;
    }

    return {
      termsForYear: termsForYear,
      get: get,
      termAtOrBefore: termAtOrBefore,
      termAfter: termAfter,
      isJEOL: isJEOL,
      accuracyFor: function (year) { return (year >= 2000 && year <= 2027) ? 'kasi' : 'computed'; },
    };
  })();

  /* ============================ 음양력 ============================ */

  const LUNAR = (function () {
    const rows = ((RAW && RAW.lunar) || []).map(function (r) {
      const parts = r[0].split('-').map(Number);
      return {
        startMs: Date.UTC(parts[0], parts[1] - 1, parts[2]),
        startY: parts[0], startM: parts[1], startD: parts[2],
        year: r[1], month: r[2], leap: !!r[3],
      };
    });
    rows.sort(function (a, b) { return a.startMs - b.startMs; });
    const starts = rows.map(function (r) { return r.startMs; });

    function bisectRight(arr, v) {
      let lo = 0, hi = arr.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (v < arr[mid]) hi = mid; else lo = mid + 1; }
      return lo;
    }

    function solarToLunar(y, mo, d) {
      if (!rows.length) return null;
      const t = Date.UTC(y, mo - 1, d);
      if (t < starts[0]) return null;
      if (t > starts[starts.length - 1] + 30 * DAY) return null;
      const idx = bisectRight(starts, t) - 1;
      if (idx < 0) return null;
      const m = rows[idx];
      const diff = Math.round((t - m.startMs) / DAY);
      return { year: m.year, month: m.month, day: diff + 1, leap: m.leap };
    }

    function lunarToSolar(year, month, day, isLeap) {
      if (day < 1) return null;
      let idx = -1;
      for (let i = 0; i < rows.length; i++) {
        const m = rows[i];
        if (m.year === year && m.month === month && m.leap === !!isLeap) { idx = i; break; }
      }
      if (idx < 0) return null;
      const target = rows[idx];
      const nextStart = (idx + 1 < rows.length) ? rows[idx + 1].startMs : target.startMs + 30 * DAY;
      const monthLen = Math.round((nextStart - target.startMs) / DAY);
      if (day > monthLen) return null;
      const ms = target.startMs + (day - 1) * DAY;
      const dt = new Date(ms);
      return { y: dt.getUTCFullYear(), mo: dt.getUTCMonth() + 1, d: dt.getUTCDate(), len: monthLen };
    }

    function hasLeapMonth(year, month) {
      return rows.some(function (m) { return m.year === year && m.month === month && m.leap; });
    }

    function monthsOfYear(year) {
      const out = [];
      for (const m of rows) if (m.year === year) out.push({ month: m.month, leap: m.leap });
      return out;
    }

    return {
      solarToLunar: solarToLunar,
      lunarToSolar: lunarToSolar,
      hasLeapMonth: hasLeapMonth,
      monthsOfYear: monthsOfYear,
      range: rows.length ? [rows[0], rows[rows.length - 1]] : [],
    };
  })();

  /* ============================ 간지 유틸 ============================ */

  function ganjiByIndex(i) {
    i = ((i % 60) + 60) % 60;
    return { idx: i, stem: i % 10, branch: i % 12 };
  }
  function ganjiOf(stem, branch) {
    return { idx: ((stem * 6 - branch * 5) % 60 + 60) % 60, stem: stem, branch: branch };
  }
  function stemOf(gi) { return STEMS[gi.stem]; }
  function branchOf(gi) { return BRANCHES[gi.branch]; }
  function ganjiHanja(gi) { return STEMS[gi.stem].hanja + BRANCHES[gi.branch].hanja; }
  function ganjiHangul(gi) { return STEMS[gi.stem].hangul + BRANCHES[gi.branch].hangul; }

  /* ============================ 사주 4기둥 ============================ */

  function yearPillarAt(kstMs) {
    const kst = msToKST(kstMs);
    const utc = msToUTC(kstMs);
    const ipchun = TERM_SOURCE.get(kst.y, '입춘');
    const utcMs = kstToMs(utc.y, utc.mo, utc.d, utc.h, utc.mi, utc.s);
    const effYear = utcMs < ipchun.ms ? kst.y - 1 : kst.y;
    return ganjiByIndex(((effYear - 4) % 60 + 60) % 60);
  }

  function monthPillarAt(kstMs, yearPillar) {
    const utc = msToUTC(kstMs);
    const utcMs = kstToMs(utc.y, utc.mo, utc.d, utc.h, utc.mi, utc.s);
    const lastJeol = TERM_SOURCE.termAtOrBefore(utcMs, true);
    const monthBranch = JEOL_TO_BRANCH[lastJeol.name];
    const ordinal = ((monthBranch - 2) + 12) % 12;
    const stemIdx = (yearPillar.stem * 2 + ordinal + 2) % 10;
    return ganjiOf(stemIdx, monthBranch);
  }

  function dayPillarForDate(y, mo, d) {
    const jd = jdFromUTC(y, mo, d);
    const diff = Math.round(jd - 2415050.5);
    return ganjiByIndex(40 + diff);
  }

  function branchForAstHour(h) {
    if (h === 23 || h === 0) return 0;
    return ((h + 1) >> 1) % 12;
  }

  function hourPillarAt(dayStem, astHour) {
    const branch = branchForAstHour(astHour);
    const stemIdx = (dayStem * 2 + branch) % 10;
    return ganjiOf(stemIdx, branch);
  }

  /**
   * 사주 계산 (korean-saju Saju.from_birth 동일)
   * @param {object} o
   *   birth: {y, mo, d, h, mi} KST 벽시계
   *   hourKnown: bool
   *   longitude: number (기본 서울 126.9784)
   *   yajaSeparated: bool (기본 true)
   */
  function computeSaju(o) {
    const birth = o.birth;
    const kstMs = kstToMs(birth.y, birth.mo, birth.d, birth.h, birth.mi, 0);
    const lon = (o.longitude === undefined || o.longitude === null) ? 126.9784 : o.longitude;
    const hourKnown = o.hourKnown !== false;
    const yajaSeparated = o.yajaSeparated !== false;

    const yearP = yearPillarAt(kstMs);
    const monthP = monthPillarAt(kstMs, yearP);

    const offsetMin = (lon - 135.0) * 4.0;
    const astMs = kstMs + offsetMin * 60000;
    const ast = msToKST(astMs); // 벽시계 값 그대로 사용

    const isYaja = ast.h === 23;
    let dayY = ast.y, dayMo = ast.mo, dayD = ast.d;
    if (isYaja && !yajaSeparated) {
      const t = Date.UTC(dayY, dayMo - 1, dayD) + DAY;
      const dt = new Date(t);
      dayY = dt.getUTCFullYear(); dayMo = dt.getUTCMonth() + 1; dayD = dt.getUTCDate();
    }
    const dayP = dayPillarForDate(dayY, dayMo, dayD);

    let hourP = null;
    if (hourKnown) {
      let hourDayStem;
      if (isYaja) {
        const t = Date.UTC(ast.y, ast.mo - 1, ast.d) + DAY;
        const dt = new Date(t);
        hourDayStem = dayPillarForDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()).stem;
      } else {
        hourDayStem = dayP.stem;
      }
      hourP = hourPillarAt(hourDayStem, ast.h);
    }

    return {
      kstMs: kstMs,
      longitude: lon,
      offsetMinutes: offsetMin,
      ast: ast,
      isYaja: isYaja,
      year: yearP, month: monthP, day: dayP, hour: hourP,
      dayStem: dayP.stem,
    };
  }

  /* ============================ 십성 · 12운성 ============================ */

  function generates(a, b) { return (a + 1) % 5 === b; }          // 목→화→토→금→수
  const OVR = [0, 2, 4, 1, 3];                                    // 목→토→수→화→금
  function overcomes(a, b) { return OVR[(OVR.indexOf(a) + 1) % 5] === b; }

  function shipsinForStem(dayStem, targetStem) {
    const d = STEMS[dayStem], t = STEMS[targetStem];
    const same = (d.yang === t.yang);
    if (d.oh === t.oh) return same ? 0 : 1;                        // 비견 / 겁재
    if (generates(d.oh, t.oh)) return same ? 2 : 3;                // 식신 / 상관
    if (generates(t.oh, d.oh)) return same ? 8 : 9;                // 편인 / 정인
    if (overcomes(d.oh, t.oh)) return same ? 4 : 5;                // 편재 / 정재
    if (overcomes(t.oh, d.oh)) return same ? 6 : 7;                // 편관 / 정관
    throw new Error('unreachable shipsin');
  }

  function bongiOf(branchIdx) {
    const jj = JIJANGGAN[branchIdx];
    for (const [stem, role] of jj) if (role === 2) return stem;
    return jj[jj.length - 1][0];
  }

  function shipsinForBranch(dayStem, branchIdx) {
    return shipsinForStem(dayStem, bongiOf(branchIdx));
  }

  function unseongFor(dayStem, branchIdx) {
    const js = JANGSAENG[dayStem];
    const step = STEMS[dayStem].yang ? 1 : -1;
    let phase = (branchIdx - js) * step;
    phase = ((phase % 12) + 12) % 12;
    return phase;
  }

  function sibisinsalFor(refBranch, targetBranch) {
    let groupStart;
    if ([2, 6, 10].indexOf(refBranch) >= 0) groupStart = 2;
    else if ([8, 0, 4].indexOf(refBranch) >= 0) groupStart = 8;
    else if ([5, 9, 1].indexOf(refBranch) >= 0) groupStart = 5;
    else groupStart = 11;
    const geopIdx = (groupStart - 3 + 12) % 12;
    return (targetBranch - geopIdx + 12) % 12;
  }

  function kongmangFor(dayGanji) {
    const start = Math.floor(dayGanji.idx / 10) * 10;
    const b = start % 12;
    return [(b + 10) % 12, (b + 11) % 12];
  }

  /* ============================ 합 · 충 ============================ */

  const SAM_HAP = [
    { members: [8, 0, 4], hwa: 4 },   // 신자진 → 수
    { members: [2, 6, 10], hwa: 1 },  // 인오술 → 화
    { members: [5, 9, 1], hwa: 3 },   // 사유축 → 금
    { members: [11, 3, 7], hwa: 0 },  // 해묘미 → 목
  ];
  const BANG_HAP = [
    { members: [2, 3, 4], hwa: 0 },
    { members: [5, 6, 7], hwa: 1 },
    { members: [8, 9, 10], hwa: 3 },
    { members: [11, 0, 1], hwa: 4 },
  ];
  const BAN_HAP = [
    { members: [8, 0], hwa: 4 }, { members: [0, 4], hwa: 4 },
    { members: [2, 6], hwa: 1 }, { members: [6, 10], hwa: 1 },
    { members: [5, 9], hwa: 3 }, { members: [9, 1], hwa: 3 },
    { members: [11, 3], hwa: 0 }, { members: [3, 7], hwa: 0 },
  ];
  const YUK_HAP = [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]];
  const CHUNG = [[0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]];
  const CHEONGAN_HAP = [
    { members: [0, 5], hwa: 2 }, // 갑기 → 토
    { members: [1, 6], hwa: 3 }, // 을경 → 금
    { members: [2, 7], hwa: 4 }, // 병신 → 수
    { members: [3, 8], hwa: 0 }, // 정임 → 목
    { members: [4, 9], hwa: 1 }, // 무계 → 화
  ];

  function hapEffectiveOh(branchIdx, branchSet) {
    for (const h of SAM_HAP.concat(BANG_HAP)) {
      if (h.members.indexOf(branchIdx) < 0) continue;
      if (h.members.every(function (m) { return branchSet.indexOf(m) >= 0; })) return h.hwa;
    }
    return null;
  }

  /* ============================ 격국 ============================ */

  const GYEOKGUK_BY_SIP = ['건록격', '양인격', '식신격', '상관격', '편재격', '정재격', '편관격', '정관격', '편인격', '정인격'];

  const BYEONG_TABLE = {
    정관격: { byeong: 3, yak: 9, reason: '상관견관(傷官見官) → 인수제상(印綬制傷)' },
    편관격: { byeong: 5, yak: 2, reason: '재생살(財生殺) 過 → 식신제살(食神制殺)' },
    정인격: { byeong: 5, yak: 0, reason: '재극인(財剋印) → 비견 분재(分財)' },
    편인격: { byeong: 5, yak: 0, reason: '재극인 → 비견 분재' },
    식신격: { byeong: 8, yak: 4, reason: '도식(倒食) — 편인이 식신 탈취 → 재극인' },
    상관격: { byeong: 7, yak: 4, reason: '상관견관 — 재성으로 통관 (상관생재→재생관)' },
    정재격: { byeong: 1, yak: 7, reason: '군겁쟁재(群劫爭財) → 관성으로 비겁 제압' },
    편재격: { byeong: 1, yak: 7, reason: '군겁쟁재 → 관성 제압' },
    건록격: { byeong: null, yak: 7, reason: '비겁 旺 → 관살로 설기·제압' },
    양인격: { byeong: null, yak: 6, reason: '양인 旺 → 칠살로 합살·제인' },
  };

  function jijangganBongiFirst(branchIdx) {
    const jj = JIJANGGAN[branchIdx];
    const bongi = jj.filter(function (c) { return c[1] === 2; });
    const junggi = jj.filter(function (c) { return c[1] === 1; });
    const yeogi = jj.filter(function (c) { return c[1] === 0; });
    return bongi.concat(junggi, yeogi);
  }

  function determineGyeokguk(saju) {
    const monthBranch = saju.month.branch;
    const dayStem = saju.dayStem;
    const stems = [saju.year.stem, saju.month.stem];
    if (saju.hour) stems.push(saju.hour.stem);
    const branches = [saju.year.branch, saju.month.branch, saju.day.branch];
    if (saju.hour) branches.push(saju.hour.branch);

    function result(name, basisStem, basis, isSeong) {
      const by = BYEONG_TABLE[name] || null;
      return {
        name: name,
        basisStem: basisStem,
        basis: basis,
        isSeonggyeok: isSeong,
        byeong: by ? by.byeong : null,
        yakSin: by ? by.yak : 0,
        byeongReason: by ? by.reason : '정의 없음',
      };
    }

    if (ROK[dayStem] === monthBranch) {
      return result('건록격', dayStem,
        '월지 ' + BRANCHES[monthBranch].hangul + '이 일간 ' + STEMS[dayStem].hangul + '의 록(祿) 위치', true);
    }
    if (YANGIN[dayStem] !== undefined && YANGIN[dayStem] === monthBranch) {
      return result('양인격', dayStem,
        '월지 ' + BRANCHES[monthBranch].hangul + '이 일간 ' + STEMS[dayStem].hangul + '의 양인(제왕) 위치', true);
    }

    for (const comp of jijangganBongiFirst(monthBranch)) {
      const stem = comp[0];
      if (stems.indexOf(stem) >= 0) {
        const sip = shipsinForStem(dayStem, stem);
        if (sip === 0 || sip === 1) continue;
        return result(GYEOKGUK_BY_SIP[sip], stem, '월지 ' + ROLE[comp[1]] + ' 투간', true);
      }
    }

    const monthHwa = hapEffectiveOh(monthBranch, branches);
    if (monthHwa !== null) {
      const yangStem = [0, 2, 4, 6, 8][monthHwa];
      return result('지지합화격', yangStem,
        '월지 ' + BRANCHES[monthBranch].hangul + ' → ' + OH[monthHwa].key + '국 지지합화 (투간 없음)', true);
    }

    const bongi = bongiOf(monthBranch);
    const bongiSip = shipsinForStem(dayStem, bongi);
    if (bongiSip === 0 || bongiSip === 1) {
      for (const comp of jijangganBongiFirst(monthBranch)) {
        if (comp[1] === 2) continue;
        const s = shipsinForStem(dayStem, comp[0]);
        if (s === 0 || s === 1) continue;
        return result(GYEOKGUK_BY_SIP[s], comp[0],
          '월지 본기 비겁 — ' + ROLE[comp[1]] + ' ' + STEMS[comp[0]].hangul + ' 차용 (잡기재관)', false);
      }
    }
    return result(GYEOKGUK_BY_SIP[bongiSip], bongi, '월지 본기 (투간 없음)', false);
  }

  /* ============================ 억부 (신강/신약) ============================ */

  const WANG_JI = [0, 6, 3, 9];
  const MYO_JI = [4, 10, 1, 7];

  function isAlly(oh, dayOh) { return oh === dayOh || generates(oh, dayOh); }

  function myoJiBlocked(dayOh, branch) {
    if (dayOh === 1) return branch === 1 || branch === 4;
    if (dayOh === 4) return branch === 4 || branch === 10 || branch === 1 || branch === 7;
    return false;
  }

  function classifyEokbu(saju) {
    const dayOh = STEMS[saju.dayStem].oh;
    const monthBranch = saju.month.branch;
    const dayBranch = saju.day.branch;
    const branchesList = [saju.year.branch, saju.month.branch, saju.day.branch];
    if (saju.hour) branchesList.push(saju.hour.branch);
    const branchSet = branchesList.slice();

    const monthHap = hapEffectiveOh(monthBranch, branchSet);
    const dayHap = hapEffectiveOh(dayBranch, branchSet);
    const effMonthOh = (monthHap !== null) ? monthHap : BRANCHES[monthBranch].oh;
    const effDayOh = (dayHap !== null) ? dayHap : BRANCHES[dayBranch].oh;

    let deukRyeong = isAlly(effMonthOh, dayOh);
    let deukJi = isAlly(effDayOh, dayOh);

    if (monthHap === null && myoJiBlocked(dayOh, monthBranch)) deukRyeong = false;
    if (dayHap === null && myoJiBlocked(dayOh, dayBranch)) deukJi = false;

    const wangJiPremium = WANG_JI.indexOf(monthBranch) >= 0 && WANG_JI.indexOf(dayBranch) >= 0
      && isAlly(BRANCHES[monthBranch].oh, dayOh) && isAlly(BRANCHES[dayBranch].oh, dayOh);

    let allyCount = 0;
    const stems = [saju.year.stem, saju.month.stem];
    if (saju.hour) stems.push(saju.hour.stem);
    for (const s of stems) if (isAlly(STEMS[s].oh, dayOh)) allyCount += 1;
    const otherBranches = [saju.year.branch];
    if (saju.hour) otherBranches.push(saju.hour.branch);
    for (const b of otherBranches) if (isAlly(BRANCHES[b].oh, dayOh)) allyCount += 1;

    const samju = !saju.hour;
    if (samju) allyCount += 1;

    let level, caseDesc;
    if (deukRyeong && deukJi) {
      caseDesc = 'Case1(득령+득지)';
      if (allyCount >= 1) level = '신강';
      else if (wangJiPremium) level = '신강';
      else level = '중화';
    } else if (deukRyeong && !deukJi) {
      caseDesc = 'Case2(득령+실지)';
      if (allyCount >= 2) level = (MYO_JI.indexOf(monthBranch) >= 0) ? '중화' : '신강';
      else if (allyCount === 1) level = '중화';
      else level = '신약';
    } else if (!deukRyeong && deukJi) {
      caseDesc = 'Case3(실령+득지)';
      if (allyCount >= 4) level = '신강';
      else if (allyCount === 3) level = '중화';
      else level = '신약';
    } else {
      caseDesc = 'Case4(실령+실지)';
      level = (allyCount >= 3) ? '중화' : '신약';
    }

    const parts = [
      caseDesc,
      '월지 ' + BRANCHES[monthBranch].hangul + (monthHap !== null ? '(' + OH[monthHap].key + '국 합화)' : '') + ' ' + (deukRyeong ? '득령' : '실령'),
      '일지 ' + BRANCHES[dayBranch].hangul + (dayHap !== null ? '(' + OH[dayHap].key + '국 합화)' : '') + ' ' + (deukJi ? '득지' : '실지'),
      '인비 ' + allyCount + '개' + (samju ? ' (6글자 +1 보정)' : ''),
    ];
    if (wangJiPremium) parts.push('★왕지 프리미엄');

    return {
      level: level,
      deukRyeong: deukRyeong,
      deukJi: deukJi,
      allyCount: allyCount,
      wangJiPremium: wangJiPremium,
      reason: parts.join(' / '),
    };
  }

  /* ============================ 조후 ============================ */

  const HANSEUP_GROUP = [8, 9, 11, 0, 1];
  const NANJO_GROUP = [2, 6, 10, 5, 7];
  const WINTER = [11, 0, 1];
  const SUMMER = [5, 6, 7];
  const SPRING = [2, 3, 4];

  function johuClassify(saju) {
    const branches = [saju.year.branch, saju.month.branch, saju.day.branch];
    if (saju.hour) branches.push(saju.hour.branch);
    const monthBranch = saju.month.branch;

    function countGroup(group, saengJi, companions) {
      const hasComp = branches.some(function (b) { return companions.indexOf(b) >= 0; });
      let c = 0;
      for (const b of branches) {
        if (group.indexOf(b) < 0) continue;
        if (b === saengJi && !hasComp) continue;
        c += 1;
      }
      return c;
    }

    const hanseupCount = countGroup(HANSEUP_GROUP, 8, [0, 4]);
    const nanjoCount = countGroup(NANJO_GROUP, 2, [6, 10]);

    function seasonLabel(m) {
      if (WINTER.indexOf(m) >= 0) return '冬';
      if (SUMMER.indexOf(m) >= 0) return '夏';
      if (SPRING.indexOf(m) >= 0) return '春';
      return '秋';
    }

    const season = seasonLabel(monthBranch);
    if (nanjoCount >= 3 && hanseupCount < 3) {
      return { state: '난조', label: '暖燥', season: season, hanseupCount: hanseupCount, nanjoCount: nanjoCount,
        reason: '난조 — 寅午戌巳未 ' + nanjoCount + '개 태과' };
    }
    if (hanseupCount >= 3 && nanjoCount < 3) {
      return { state: '한습', label: '寒濕', season: season, hanseupCount: hanseupCount, nanjoCount: nanjoCount,
        reason: '한습 — 申酉亥子丑 ' + hanseupCount + '개 태과' };
    }
    if (WINTER.indexOf(monthBranch) >= 0) {
      return { state: '한습', label: '寒濕', season: season, hanseupCount: hanseupCount, nanjoCount: nanjoCount,
        reason: '한습 — 월지 ' + BRANCHES[monthBranch].hangul + '(' + season + ') 동월생' };
    }
    if (SUMMER.indexOf(monthBranch) >= 0) {
      return { state: '난조', label: '暖燥', season: season, hanseupCount: hanseupCount, nanjoCount: nanjoCount,
        reason: '난조 — 월지 ' + BRANCHES[monthBranch].hangul + '(' + season + ') 하월생' };
    }
    return { state: '평탄', label: '平坦', season: season, hanseupCount: hanseupCount, nanjoCount: nanjoCount,
      reason: '평탄 — 월지 ' + BRANCHES[monthBranch].hangul + '(' + season + '), 태과 없음' };
  }

  /* ============================ 용신 ============================ */

  function generatedBy(o) { return (o + 1) % 5; }          // 나를 생하는 오행
  function generatingOf(o) { return (o + 4) % 5; }         // 내가 생하는 오행
  function overcomingOf(o) { return OVR[(OVR.indexOf(o) + 1) % 5]; }
  function overcomingFrom(o) { return OVR[(OVR.indexOf(o) + 4) % 5]; }

  function classifyWith(yong, hee) {
    const gi = overcomingFrom(yong);
    const gu = generatingOf(gi);
    const roles = ['한신', '한신', '한신', '한신', '한신'];
    roles[gu] = '구신';
    roles[gi] = '기신';
    roles[hee] = '희신';
    roles[yong] = '용신';
    return roles;
  }

  function deriveYongsin(saju, eokbu) {
    const dayOh = STEMS[saju.dayStem].oh;
    const johu = johuClassify(saju);
    let yong, hee, method, reason;

    function sinyakConflict(jy) {
      if (eokbu.level !== '신약') return false;
      const inbi = [dayOh, generatingOf(dayOh)];
      return inbi.indexOf(jy) < 0;
    }

    if (johu.state === '한습') {
      yong = 1; method = '조후';
      if (sinyakConflict(1)) {
        hee = generatingOf(dayOh);
        reason = '[조후 우선·신약보정] ' + johu.reason + ' → 용신 火, 희신 ' + OH[hee].key + '(인성 — 신약 충돌 보정)';
      } else {
        hee = 0;
        reason = '[조후 우선] ' + johu.reason + ' → 용신 火, 희신 木 (억부 ' + eokbu.level + ' 불문)';
      }
    } else if (johu.state === '난조') {
      yong = 4; method = '조후';
      if (sinyakConflict(4)) {
        hee = generatingOf(dayOh);
        reason = '[조후 우선·신약보정] ' + johu.reason + ' → 용신 水, 희신 ' + OH[hee].key + '(인성 — 신약 충돌 보정)';
      } else {
        hee = 3;
        reason = '[조후 우선] ' + johu.reason + ' → 용신 水, 희신 金 (억부 ' + eokbu.level + ' 불문)';
      }
    } else {
      method = '억부';
      if (eokbu.level === '신강' || eokbu.level === '극신강') {
        yong = generatedBy(dayOh); hee = overcomingOf(dayOh);
        reason = '[억부] ' + johu.reason + ' → 신강 → 용신 식상(' + OH[yong].key + '), 희신 재성(' + OH[hee].key + ')';
      } else if (eokbu.level === '중화') {
        yong = overcomingFrom(dayOh); hee = overcomingOf(dayOh);
        reason = '[억부] ' + johu.reason + ' → 중화 → 용신 관성(' + OH[yong].key + '), 희신 재성(' + OH[hee].key + ')';
      } else {
        yong = generatingOf(dayOh); hee = dayOh;
        reason = '[억부] ' + johu.reason + ' → 신약 → 용신 인성(' + OH[yong].key + '), 희신 비겁(' + OH[hee].key + ')';
      }
    }

    return {
      yong: yong, hee: hee,
      yongKey: OH[yong].key, heeKey: OH[hee].key,
      method: method,
      roles: classifyWith(yong, hee),
      reason: eokbu.reason + ' → 억부 ' + eokbu.level + '. ' + reason,
      johu: johu,
    };
  }

  /* ============================ 대운 · 세운 ============================ */

  function computeDaewoon(saju, gender) {
    const yearStemYang = STEMS[saju.year.stem].yang;
    const forward = (yearStemYang && gender === '남') || (!yearStemYang && gender === '여');
    const birthMs = saju.kstMs;
    let daysToBoundary;
    if (forward) {
      const nxt = TERM_SOURCE.termAfter(birthMs, true);
      daysToBoundary = (nxt.ms - birthMs) / DAY;
    } else {
      const prev = TERM_SOURCE.termAtOrBefore(birthMs, true);
      daysToBoundary = (birthMs - prev.ms) / DAY;
    }
    const startFloat = daysToBoundary / 3.0;
    const startAge = Math.floor(startFloat);
    const monthsRemainder = Math.round((startFloat - startAge) * 12);

    let cur = saju.month.idx + (forward ? 1 : -1);
    const entries = [];
    for (let i = 0; i < 10; i++) {
      const g = ganjiByIndex(cur);
      entries.push({
        startAge: startAge + i * 10,
        monthsOffset: i === 0 ? monthsRemainder : 0,
        ganji: g,
        hanja: ganjiHanja(g),
        hangul: ganjiHangul(g),
        stem: g.stem,
        branch: g.branch,
      });
      cur += forward ? 1 : -1;
    }
    return {
      forward: forward,
      daysToBoundary: daysToBoundary,
      startAge: startAge,
      monthsOffset: monthsRemainder,
      entries: entries,
    };
  }

  function sewoonFor(year) {
    const ipchun = TERM_SOURCE.get(year, '입춘');
    const juneFirst = kstToMs(year, 6, 1, 0, 0, 0);
    // 6월 1일은 항상 입춘 이후이므로 그 해 연주
    const utc = msToUTC(juneFirst);
    const utcMs = kstToMs(utc.y, utc.mo, utc.d, utc.h, utc.mi, utc.s);
    const eff = utcMs < ipchun.ms ? year - 1 : year;
    return ganjiByIndex(((eff - 4) % 60 + 60) % 60);
  }

  /* ============================ 종합 계산 ============================ */

  /**
   * @param {object} input
   *  name, gender('남'|'여'), calendar('solar'|'lunar'), lunarLeap(bool),
   *  y, mo, d, h, mi, hourKnown(bool), standardTime(bool)
   */
  function calculate(input) {
    const gender = input.gender === '여' ? '여' : '남';
    let solar;
    let lunarInfo = null;
    let note = [];

    if (input.calendar === 'lunar') {
      const conv = LUNAR.lunarToSolar(input.y, input.mo, input.d, !!input.lunarLeap);
      if (!conv) {
        throw new Error('음력 ' + input.y + '년 ' + (input.lunarLeap ? '윤' : '') + input.mo + '월 ' + input.d + '일은 달력에 없습니다. 날짜나 윤달 표시를 확인해 주세요.');
      }
      solar = { y: conv.y, mo: conv.mo, d: conv.d };
      lunarInfo = { year: input.y, month: input.mo, day: input.d, leap: !!input.lunarLeap };
      note.push('음력 ' + input.y + '.' + pad(input.mo) + '.' + pad(input.d) + (input.lunarLeap ? ' (윤달)' : '') + ' → 양력 ' + fmtDate(solar.y, solar.mo, solar.d));
    } else {
      solar = { y: input.y, mo: input.mo, d: input.d };
      lunarInfo = LUNAR.solarToLunar(solar.y, solar.mo, solar.d);
    }

    const hourKnown = !!input.hourKnown;
    const longitude = input.standardTime === false ? 135.0 : 126.9784;
    const birth = { y: solar.y, mo: solar.mo, d: solar.d, h: hourKnown ? (input.h || 0) : 12, mi: hourKnown ? (input.mi || 0) : 0 };

    const saju = computeSaju({ birth: birth, hourKnown: hourKnown, longitude: longitude });
    const dayStem = saju.dayStem;

    const positions = [
      { key: 'hour', label: '시주', hanja: '時柱', role: '자녀·말년', ganji: saju.hour },
      { key: 'day', label: '일주', hanja: '日柱', role: '나·배우자', ganji: saju.day },
      { key: 'month', label: '월주', hanja: '月柱', role: '부모·사회', ganji: saju.month },
      { key: 'year', label: '년주', hanja: '年柱', role: '조상·초년', ganji: saju.year },
    ];

    const dayKong = kongmangFor(saju.day);
    const yearKong = kongmangFor(saju.year);

    const pillars = positions.map(function (p) {
      if (!p.ganji) {
        return { key: p.key, label: p.label, hanja: p.hanja, role: p.role, unknown: true };
      }
      const g = p.ganji;
      const stemSip = (p.key === 'day') ? null : shipsinForStem(dayStem, g.stem);
      const branchSip = shipsinForBranch(dayStem, g.branch);
      const unseong = unseongFor(dayStem, g.branch);
      const jj = JIJANGGAN[g.branch].map(function (c) {
        return {
          stem: c[0], hangul: STEMS[c[0]].hangul, hanja: STEMS[c[0]].hanja,
          role: ROLE[c[1]], roleHanja: ROLE_HANJA[c[1]],
          sip: shipsinForStem(dayStem, c[0]),
          oh: STEMS[c[0]].oh,
        };
      });
      const kong = [];
      if (dayKong.indexOf(g.branch) >= 0) kong.push('일');
      if (yearKong.indexOf(g.branch) >= 0) kong.push('년');
      // 12신살은 일지 기준(표준)과 연지 기준(보조)으로 본다.
      const sibisal = {
        day: SIBISINSAL[sibisinsalFor(saju.day.branch, g.branch)],
        year: SIBISINSAL[sibisinsalFor(saju.year.branch, g.branch)],
      };
      return {
        key: p.key, label: p.label, hanja: p.hanja, role: p.role, unknown: false,
        ganji: g,
        stem: { idx: g.stem, hanja: STEMS[g.stem].hanja, hangul: STEMS[g.stem].hangul, oh: STEMS[g.stem].oh, yang: STEMS[g.stem].yang, sip: stemSip },
        branch: { idx: g.branch, hanja: BRANCHES[g.branch].hanja, hangul: BRANCHES[g.branch].hangul, oh: BRANCHES[g.branch].oh, yang: BRANCHES[g.branch].yang, sip: branchSip },
        jijanggan: jj,
        unseong: { idx: unseong, name: UNSEONG[unseong], hanja: UNSEONG_HANJA[unseong] },
        kongmang: kong,
        sibisal: sibisal,
      };
    });

    // 오행 분포 (글자 수 기준 8글자 / 시각 모름 6글자)
    const ohCounts = [0, 0, 0, 0, 0];
    const chars = [];
    for (const pos of [saju.year, saju.month, saju.day, saju.hour]) {
      if (!pos) continue;
      ohCounts[STEMS[pos.stem].oh] += 1;
      ohCounts[BRANCHES[pos.branch].oh] += 1;
      chars.push({ oh: STEMS[pos.stem].oh, kind: 'stem' });
      chars.push({ oh: BRANCHES[pos.branch].oh, kind: 'branch' });
    }
    const charTotal = chars.length;

    // 십성 분포 (일간 자신은 비견 1자리로 계산 — saju_calc.py와 동일)
    const sipCounts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    sipCounts[0] += 1;
    for (const pos of [saju.year, saju.month, saju.hour]) {
      if (!pos) continue;
      sipCounts[shipsinForStem(dayStem, pos.stem)] += 1;
    }
    for (const pos of [saju.year, saju.month, saju.day, saju.hour]) {
      if (!pos) continue;
      sipCounts[shipsinForBranch(dayStem, pos.branch)] += 1;
    }

    const gyeokguk = determineGyeokguk(saju);
    const eokbu = classifyEokbu(saju);
    const yongsin = deriveYongsin(saju, eokbu);
    const daewoon = computeDaewoon(saju, gender);

    const birthYear = solar.y;
    const sewoon = [];
    for (let y = 2026; y <= 2035; y++) {
      const g = sewoonFor(y);
      sewoon.push({
        year: y, age: y - birthYear, ganji: g,
        hanja: ganjiHanja(g), hangul: ganjiHangul(g), stem: g.stem, branch: g.branch,
      });
    }

    // 12신살 (일지 기준)
    const daySibisal = SIBISINSAL[sibisinsalFor(saju.day.branch, saju.day.branch)];

    return {
      input: {
        name: input.name || '',
        gender: gender,
        calendar: input.calendar === 'lunar' ? '음력' : '양력',
        hourKnown: hourKnown,
        standardTime: input.standardTime !== false,
      },
      solar: solar,
      lunar: lunarInfo,
      birthLabel: {
        solar: fmtDate(solar.y, solar.mo, solar.d),
        lunar: lunarInfo ? fmtDate(lunarInfo.year, lunarInfo.month, lunarInfo.day) : null,
        lunarLeap: lunarInfo ? lunarInfo.leap : false,
        time: hourKnown ? pad(input.h) + ':' + pad(input.mi) : null,
        correctedTime: hourKnown ? msToKST(saju.kstMs + saju.offsetMinutes * 60000).h + ':' + pad(msToKST(saju.kstMs + saju.offsetMinutes * 60000).mi) : null,
        offsetMinutes: saju.offsetMinutes,
      },
      note: note,
      saju: {
        year: ganjiHanja(saju.year), month: ganjiHanja(saju.month), day: ganjiHanja(saju.day),
        hour: saju.hour ? ganjiHanja(saju.hour) : null,
        hourUnknown: !saju.hour,
        isYaja: saju.isYaja,
      },
      pillars: pillars,
      dayMaster: {
        stem: dayStem,
        hanja: STEMS[dayStem].hanja,
        hangul: STEMS[dayStem].hangul,
        oh: STEMS[dayStem].oh,
        yang: STEMS[dayStem].yang,
      },
      ohCounts: ohCounts,
      ohRatio: ohCounts.map(function (c) { return Math.round(c / charTotal * 1000) / 10; }),
      charTotal: charTotal,
      sipCounts: sipCounts,
      sipNames: SIP,
      sipHanja: SIP_HANJA,
      sipTotal: sipCounts.reduce(function (a, b) { return a + b; }, 0),
      gyeokguk: gyeokguk,
      eokbu: eokbu,
      yongsin: yongsin,
      daewoon: daewoon,
      sewoon: sewoon,
      daySibisal: daySibisal,
      dataRange: {
        terms: TERM_SOURCE.accuracyFor(solar.y),
      },
    };
  }

  global.SajuEngine = {
    calculate: calculate,
    tables: {
      STEMS: STEMS, BRANCHES: BRANCHES, OH: OH, SIP: SIP, SIP_HANJA: SIP_HANJA,
      UNSEONG: UNSEONG, SIBISINSAL: SIBISINSAL, JIJANGGAN: JIJANGGAN, ROLE: ROLE,
    },
    lunar: LUNAR,
    terms: TERM_SOURCE,
    internal: {
      computeSaju: computeSaju, dayPillarForDate: dayPillarForDate,
      shipsinForStem: shipsinForStem, shipsinForBranch: shipsinForBranch,
      unseongFor: unseongFor, kongmangFor: kongmangFor,
      determineGyeokguk: determineGyeokguk, classifyEokbu: classifyEokbu,
      johuClassify: johuClassify, deriveYongsin: deriveYongsin,
      computeDaewoon: computeDaewoon, sewoonFor: sewoonFor,
      solarTerm: termInfo,
    },
  };

  function termInfo(year) {
    return TERM_SOURCE.termsForYear(year).map(function (t) {
      return { name: t.name, iso: new Date(t.ms).toISOString() };
    });
  }
})(window);
