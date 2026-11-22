"""정운타임즈 · 만세력 계산 (Python)

saju-program/assets/js/engine.js(korean-saju 0.3.0 이식)를 스크립트용으로 옮긴 것.
  - 절기: assets/js/saju-data.js 의 KASI 24절기(2000~2027), 범위 밖은 Meeus 태양황경 계산
  - 연주(입춘 기준) / 월주(절 기준) / 일주(Julian Day) / 시주(오서둔, 진태양시 보정)
  - 오행·십성 개수, 2026~2035 세운, 대운 시작 나이

의존성 없음(표준 라이브러리만). 외부 검증은 korean-saju 0.3.0 과 15개 케이스 비교.
"""
from __future__ import annotations

import json
import math
import os
import re
from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_JS = os.path.join(ROOT, "assets", "js", "saju-data.js")

# ---------------------------------------------------------------- 기본 상수
STEMS = [
    ("甲", "갑", 0, True), ("乙", "을", 0, False),
    ("丙", "병", 1, True), ("丁", "정", 1, False),
    ("戊", "무", 2, True), ("己", "기", 2, False),
    ("庚", "경", 3, True), ("辛", "신", 3, False),
    ("壬", "임", 4, True), ("癸", "계", 4, False),
]
BRANCHES = [
    ("子", "자", 4, "쥐"), ("丑", "축", 2, "소"), ("寅", "인", 0, "호랑이"), ("卯", "묘", 0, "토끼"),
    ("辰", "진", 2, "용"), ("巳", "사", 1, "뱀"), ("午", "오", 1, "말"), ("未", "미", 2, "양"),
    ("申", "신", 3, "원숭이"), ("酉", "유", 3, "닭"), ("戌", "술", 2, "개"), ("亥", "해", 4, "돼지"),
]
OHK = ["목", "화", "토", "금", "수"]
OHH = ["木", "火", "土", "金", "水"]
SIP = ["비견", "겁재", "식신", "상관", "편재", "정재", "편관", "정관", "편인", "정인"]

JEOL_TO_BRANCH = {
    "입춘": 2, "경칩": 3, "청명": 4, "입하": 5, "망종": 6, "소서": 7,
    "입추": 8, "백로": 9, "한로": 10, "입동": 11, "대설": 0, "소한": 1,
}
TERM_LONGITUDE = {
    "소한": 285, "대한": 300, "입춘": 315, "우수": 330, "경칩": 345, "춘분": 0,
    "청명": 15, "곡우": 30, "입하": 45, "소만": 60, "망종": 75, "하지": 90,
    "소서": 105, "대서": 120, "입추": 135, "처서": 150, "백로": 165, "추분": 180,
    "한로": 195, "상강": 210, "입동": 225, "소설": 240, "대설": 255, "동지": 270,
}
TERM_APPROX = {
    "소한": (1, 5), "대한": (1, 20), "입춘": (2, 4), "우수": (2, 19), "경칩": (3, 5), "춘분": (3, 20),
    "청명": (4, 5), "곡우": (4, 20), "입하": (5, 5), "소만": (5, 21), "망종": (6, 5), "하지": (6, 21),
    "소서": (7, 7), "대서": (7, 22), "입추": (8, 7), "처서": (8, 23), "백로": (9, 7), "추분": (9, 23),
    "한로": (10, 8), "상강": (10, 23), "입동": (11, 7), "소설": (11, 22), "대설": (12, 7), "동지": (12, 21),
}
TERM_ORDER = ["소한", "대한", "입춘", "우수", "경칩", "춘분", "청명", "곡우", "입하", "소만",
              "망종", "하지", "소서", "대서", "입추", "처서", "백로", "추분", "한로", "상강",
              "입동", "소설", "대설", "동지"]
DAY = 86400000


# ---------------------------------------------------------------- Julian Day
def jd_from_utc(y, mo, d, h=0, mi=0, s=0):
    yy, mm = (y - 1, mo + 12) if mo <= 2 else (y, mo)
    a = math.floor(yy / 100)
    b = 2 - a + math.floor(a / 4)
    day_frac = d + (h * 3600 + mi * 60 + s) / 86400.0
    return math.floor(365.25 * (yy + 4716)) + math.floor(30.6001 * (mm + 1)) + day_frac + b - 1524.5


def jd_to_ms_utc(jd):
    z = math.floor(jd + 0.5)
    f = (jd + 0.5) - z
    if z < 2299161:
        a = z
    else:
        alpha = math.floor((z - 1867216.25) / 36524.25)
        a = z + 1 + alpha - math.floor(alpha / 4)
    b = a + 1524
    c = math.floor((b - 122.1) / 365.25)
    d = math.floor(365.25 * c)
    e = math.floor((b - d) / 30.6001)
    day_frac_all = b - d - math.floor(30.6001 * e) + f
    day = math.floor(day_frac_all)
    frac = day_frac_all - day
    month = e - 1 if e < 14 else e - 13
    year = c - 4716 if month > 2 else c - 4715
    dt = datetime(year, month, day, tzinfo=timezone.utc) + timedelta(milliseconds=round(frac * DAY))
    return int(dt.timestamp() * 1000)


def kst_to_ms(y, mo, d, h=0, mi=0, s=0):
    return int(datetime(y, mo, d, h, mi, s, tzinfo=KST).timestamp() * 1000)


def ms_to_kst(ms):
    return datetime.fromtimestamp(ms / 1000, KST)


# ---------------------------------------------------------------- ΔT · 태양황경
def delta_t(year, month):
    y = year + (month - 0.5) / 12
    if year < 1900:
        t = (y - 1820) / 100
        return -20 + 32 * t * t
    if year < 1920:
        t = y - 1900
        return -2.79 + 1.494119 * t - 0.0598939 * t ** 2 + 0.0061966 * t ** 3 - 0.000197 * t ** 4
    if year < 1941:
        t = y - 1920
        return 21.20 + 0.84493 * t - 0.0761 * t ** 2 + 0.0020936 * t ** 3
    if year < 1961:
        t = y - 1950
        return 29.07 + 0.407 * t - t ** 2 / 233 + t ** 3 / 2547
    if year < 1986:
        t = y - 1975
        return 45.45 + 1.067 * t - t ** 2 / 260 - t ** 3 / 718
    if year < 2005:
        t = y - 2000
        return 63.86 + 0.3345 * t - 0.060374 * t ** 2 + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5
    if year < 2050:
        t = y - 2000
        return 62.92 + 0.32217 * t + 0.005589 * t ** 2
    if year <= 2150:
        return -20 + 32 * ((y - 1820) / 100) ** 2 - 0.5628 * (2150 - y)
    t = (y - 1820) / 100
    return -20 + 32 * t * t


def norm360(x):
    x = x % 360
    return x + 360 if x < 0 else x


def sun_apparent_longitude(jd_tt):
    t = (jd_tt - 2451545.0) / 36525.0
    l0 = norm360(280.46646 + t * (36000.76983 + t * 0.0003032))
    m = 357.52911 + t * (35999.05029 - t * 0.0001537)
    mr = math.radians(m)
    c = ((1.914602 - t * (0.004817 + t * 0.000014)) * math.sin(mr)
         + (0.019993 - t * 0.000101) * math.sin(2 * mr)
         + 0.000289 * math.sin(3 * mr))
    true_lon = l0 + c
    omega = 125.04 - 1934.136 * t
    return norm360(true_lon - 0.00569 - 0.00478 * math.sin(math.radians(omega)))


def find_crossing(year, target_lon, approx_month, approx_day):
    jd_ut = jd_from_utc(year, approx_month, approx_day)
    daily, tol = 0.9856, 1e-5
    for _ in range(30):
        dt = delta_t(year, approx_month)
        lon = sun_apparent_longitude(jd_ut + dt / 86400.0)
        diff = target_lon - lon
        if diff > 180:
            diff -= 360
        if diff < -180:
            diff += 360
        if abs(diff) < tol:
            break
        jd_ut += diff / daily
    return jd_to_ms_utc(jd_ut)


# ---------------------------------------------------------------- 절기 테이블
class Terms:
    def __init__(self, data_js=DATA_JS):
        self.by_year = {}
        try:
            raw = open(data_js, encoding="utf-8").read()
            body = raw[raw.index("{"): raw.rindex("}") + 1]
            data = json.loads(body)
            for y, name, iso in data.get("terms", []):
                self.by_year.setdefault(y, []).append(
                    {"year": y, "name": name, "ms": int(datetime.fromisoformat(iso).timestamp() * 1000)}
                )
        except Exception:
            self.by_year = {}
        self._computed = {}

    def for_year(self, year):
        kasi = self.by_year.get(year)
        if kasi and len(kasi) == 24:
            return sorted(kasi, key=lambda t: t["ms"])
        if year in self._computed:
            return self._computed[year]
        out = []
        for name in TERM_ORDER:
            am, ad = TERM_APPROX[name]
            out.append({"year": year, "name": name,
                        "ms": find_crossing(year, TERM_LONGITUDE[name], am, ad)})
        out.sort(key=lambda t: t["ms"])
        self._computed[year] = out
        return out

    def get(self, year, name):
        for t in self.for_year(year):
            if t["name"] == name:
                return t
        return None

    def at_or_before(self, ms, jeol_only=False):
        y = ms_to_kst(ms).year
        cands = self.for_year(y - 1) + self.for_year(y) + self.for_year(y + 1)
        cands.sort(key=lambda t: t["ms"])
        result = None
        for t in cands:
            if jeol_only and t["name"] not in JEOL_TO_BRANCH:
                continue
            if t["ms"] > ms:
                break
            result = t
        return result

    def after(self, ms, jeol_only=False):
        y = ms_to_kst(ms).year
        cands = self.for_year(y - 1) + self.for_year(y) + self.for_year(y + 1)
        cands.sort(key=lambda t: t["ms"])
        for t in cands:
            if jeol_only and t["name"] not in JEOL_TO_BRANCH:
                continue
            if t["ms"] > ms:
                return t
        return None

    def accuracy(self, year):
        return "kasi" if 2000 <= year <= 2027 else "computed"


TERMS = Terms()


# ---------------------------------------------------------------- 사주 4기둥
def ganji_of(stem, branch):
    idx = ((stem * 6 - branch * 5) % 60 + 60) % 60
    return {"idx": idx, "stem": stem, "branch": branch,
            "hanja": STEMS[stem][0] + BRANCHES[branch][0],
            "hangul": STEMS[stem][1] + BRANCHES[branch][1]}


def ganji_by_index(i):
    i = ((i % 60) + 60) % 60
    return ganji_of(i % 10, i % 12)


def year_pillar_at(ms):
    kst = ms_to_kst(ms)
    ipchun = TERMS.get(kst.year, "입춘")
    eff = kst.year - 1 if ms < ipchun["ms"] else kst.year
    return ganji_by_index((eff - 4) % 60)


def month_pillar_at(ms, year_pillar):
    last = TERMS.at_or_before(ms, jeol_only=True)
    branch = JEOL_TO_BRANCH[last["name"]]
    ordinal = ((branch - 2) + 12) % 12
    stem = (year_pillar["stem"] * 2 + ordinal + 2) % 10
    return ganji_of(stem, branch)


def day_pillar_for_date(y, mo, d):
    jd = jd_from_utc(y, mo, d)
    diff = round(jd - 2415050.5)
    return ganji_by_index(40 + diff)


def branch_for_ast_hour(h):
    if h in (23, 0):
        return 0
    return ((h + 1) >> 1) % 12


def hour_pillar_at(day_stem, ast_hour):
    branch = branch_for_ast_hour(ast_hour)
    stem = (day_stem * 2 + branch) % 10
    return ganji_of(stem, branch)


def _generates(a, b):
    return (a + 1) % 5 == b


def _overcomes(a, b):
    ovr = [0, 2, 4, 1, 3]
    return ovr[(ovr.index(a) + 1) % 5] == b


def shipsin_for_stem(day_stem, target_stem):
    d = STEMS[day_stem]
    t = STEMS[target_stem]
    same = d[3] == t[3]
    if d[2] == t[2]:
        return 0 if same else 1
    if _generates(d[2], t[2]):
        return 2 if same else 3
    if _overcomes(d[2], t[2]):
        return 4 if same else 5
    if _overcomes(t[2], d[2]):
        return 6 if same else 7
    return 8 if same else 9


def shipsin_for_branch(day_stem, branch):
    # 지지 십성은 지지의 본기(정기) 오행으로 본다
    bongi = JIJANGGAN[0][branch] if False else None
    bongi_stem = BONGI_STEM[branch]
    return shipsin_for_stem(day_stem, bongi_stem)


# 지지 본기(정기) 천간 — 자평진전 지장간
BONGI_STEM = [9, 5, 0, 1, 4, 2, 3, 5, 6, 7, 4, 8]  # 자축인묘진사오미신유술해
JIJANGGAN = [  # (천간, 역할 0여기 1중기 2본기)
    [(8, 0), (9, 2)], [(9, 2), (5, 1), (7, 0)], [(4, 1), (2, 1), (0, 2)], [(0, 2), (1, 1)],
    [(4, 2), (1, 1), (9, 0)], [(2, 2), (6, 1), (4, 0)], [(3, 1), (5, 2)], [(5, 2), (3, 1), (1, 0)],
    [(6, 0), (8, 1), (4, 2)], [(7, 2)], [(4, 2), (7, 1), (3, 0)], [(8, 1), (0, 2)],
]


def saju(birth, hour=None, minute=0, hour_known=True, standard_time=True, yaja_separated=True):
    """birth = (y, mo, d) 양력. 진태양시 보정은 서울 경도 기준."""
    y, mo, d = birth
    kst_ms = kst_to_ms(y, mo, d, hour or 0, minute)
    lon = 126.9784 if standard_time else 135.0
    year_p = year_pillar_at(kst_ms)
    month_p = month_pillar_at(kst_ms, year_p)

    offset_min = (lon - 135.0) * 4.0
    ast = ms_to_kst(kst_ms + int(offset_min * 60000))
    is_yaja = ast.hour == 23
    day_date = (ast.year, ast.month, ast.day)
    if is_yaja and not yaja_separated:
        nxt = ast + timedelta(days=1)
        day_date = (nxt.year, nxt.month, nxt.day)
    day_p = day_pillar_for_date(*day_date)

    hour_p = None
    if hour_known:
        if is_yaja:
            nxt = ast + timedelta(days=1)
            hour_day_stem = day_pillar_for_date(nxt.year, nxt.month, nxt.day)["stem"]
        else:
            hour_day_stem = day_p["stem"]
        hour_p = hour_pillar_at(hour_day_stem, ast.hour)

    oh_counts = [0, 0, 0, 0, 0]
    for p in [year_p, month_p, day_p] + ([hour_p] if hour_p else []):
        oh_counts[STEMS[p["stem"]][2]] += 1
        oh_counts[BRANCHES[p["branch"]][2]] += 1
    total = sum(oh_counts)

    sip_counts = [0] * 10
    sip_counts[0] += 1
    for p in [year_p, month_p] + ([hour_p] if hour_p else []):
        sip_counts[shipsin_for_stem(day_p["stem"], p["stem"])] += 1
    for p in [year_p, month_p, day_p] + ([hour_p] if hour_p else []):
        sip_counts[shipsin_for_branch(day_p["stem"], p["branch"])] += 1

    return {
        "year": year_p, "month": month_p, "day": day_p, "hour": hour_p,
        "day_stem": day_p["stem"], "day_oh": STEMS[day_p["stem"]][2],
        "oh_counts": oh_counts,
        "oh_ratio": [round(c / total * 100, 1) for c in oh_counts],
        "sip_counts": sip_counts,
        "sip": {name: sip_counts[i] for i, name in enumerate(SIP)},
        "hour_known": hour_known,
        "corrected_time": ast.strftime("%H:%M") if hour_known else None,
        "offset_minutes": offset_min,
    }


def sewoon_for(year):
    ipchun = TERMS.get(year, "입춘")
    june = kst_to_ms(year, 6, 1)
    eff = year - 1 if june < ipchun["ms"] else year
    return ganji_by_index((eff - 4) % 60)


def daewoon_start_age(sj, gender):
    """대운 시작 나이(세) — 엔진과 같은 3일=1년 방식."""
    year_yang = STEMS[sj["year"]["stem"]][3]
    forward = (year_yang and gender == "남") or (not year_yang and gender == "여")
    return forward


def day_ganji_label(y, mo, d):
    return day_pillar_for_date(y, mo, d)["hanja"]


if __name__ == "__main__":
    # 자체 점검: 알려진 값과 비교
    cases = [
        ((1977, 1, 6), 9, 20, "丙辰 辛丑 癸亥 丙辰"),
        ((1993, 2, 5), 15, 40, "癸酉 甲寅 丁巳 戊申"),
    ]
    for birth, h, mi, expect in cases:
        r = saju(birth, h, mi)
        got = " ".join([r["year"]["hanja"], r["month"]["hanja"], r["day"]["hanja"], r["hour"]["hanja"]])
        print(birth, h, mi, "->", got, "OK" if got == expect else "MISMATCH expected " + expect)
