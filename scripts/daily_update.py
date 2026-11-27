#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""정운타임즈 · 매일 자동 리뉴얼 (daily_update.py) — 2026-11-25 전면 개편

무엇이 달라졌나
  1) 하루 4편 → **하루 7편, 모든 지면**. 오늘의운세 · 화제의인물 · MBTI궁합 ·
     사주·재물 · 어젯밤그꿈 · 전생 · 운부르는것들. 남는 지면이 없다.
  2) 기사마다 **고유 일러스트 1장**(scripts/make_art.py). 같은 그림이 두 기사에 다시 쓰이지 않는다.
     생성 뒤 전 지면(정적 기사·매거진 포함) 이미지 중복을 검사해 0건이 아니면 실패로 멈춘다.
  3) 본문을 ‘재미·쉬움’ 원칙으로 다시 씀 — 어려운 용어는 괄호로 즉시 풀고,
     “혹시 나도?” 체크리스트와 무료 4P·정밀분석 유도 카드를 기사마다 넣는다.
  4) 누적 한도 확대 — 최근 365일 · 최대 2,600편(data/articles.json).
     지면에 싣는 articles-daily.js는 최근 45일만(가볍게), 그 이전은 아카이브가 data/articles.json에서 불러온다.

사용
  python3 scripts/daily_update.py                    # 오늘 호 생성 + 검사 (푸시 안 함)
  python3 scripts/daily_update.py --push             # 생성 후 GitHub push
  python3 scripts/daily_update.py --date 2026-11-24  # 특정 날짜 호
  python3 scripts/daily_update.py --person 전지윤     # 오늘 인물 지정
  python3 scripts/daily_update.py --check-only        # 쓰지 않고 검사만
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import date, datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import saju_calc as S  # noqa: E402
import make_art as ART  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")
ART_PATH = os.path.join(DATA_DIR, "articles.json")
POOL_PATH = os.path.join(DATA_DIR, "people.json")
ALERT_PATH = os.path.join(DATA_DIR, "system_alerts.json")
DAILY_JS = os.path.join(ROOT, "assets", "js", "articles-daily.js")
SW_PATH = os.path.join(ROOT, "service-worker.js")
REPO = "/workspace/gh/saju-project22"

MAX_DAYS = 365
MAX_ARTICLES = 2600
DAILY_JS_DAYS = 45          # 지면에 바로 싣는 최근 구간 (그 이전은 아카이브가 따로 불러옴)
SIZE_WARN_MB = 800
SIZE_CRIT_MB = 1000

ORDER = "https://22jutimes.com/order.html"
CTA_FREE = "#/4p"

OH = {
    "목": {"img": "곧게 자라는 나무", "key": "시작", "body": "간과 눈", "season": "봄",
           "color": "청록", "direct": "동쪽", "num": "3과 8", "taste": "신맛", "virtue": "인(仁)"},
    "화": {"img": "위로 타오르는 불", "key": "표현", "body": "심장과 혈관", "season": "여름",
           "color": "주홍", "direct": "남쪽", "num": "2와 7", "taste": "쓴맛", "virtue": "예(禮)"},
    "토": {"img": "두터운 땅", "key": "중심", "body": "위장과 소화", "season": "환절기",
           "color": "황토", "direct": "중앙", "num": "5와 10", "taste": "단맛", "virtue": "신(信)"},
    "금": {"img": "단단한 쇠", "key": "결단", "body": "폐와 피부", "season": "가을",
           "color": "은백", "direct": "서쪽", "num": "4와 9", "taste": "매운맛", "virtue": "의(義)"},
    "수": {"img": "깊은 물", "key": "지혜", "body": "신장과 뼈", "season": "겨울",
           "color": "먹빛", "direct": "북쪽", "num": "1과 6", "taste": "짠맛", "virtue": "지(智)"},
}
SIP_TITLE = {
    "비견": "동료가 많은 사람", "겁재": "겨루며 크는 사람",
    "식신": "만들어 내는 사람", "상관": "틀을 깨는 사람",
    "편재": "큰돈을 만지는 사람", "정재": "새지 않게 모으는 사람",
    "편관": "압박에 강한 사람", "정관": "신뢰를 쌓는 사람",
    "편인": "남다르게 파고드는 사람", "정인": "배워서 이루는 사람",
}
SIP_MEAN = {
    "비견": "동료와 경쟁, 나와 같은 편", "겁재": "빼앗고 겨루는 힘",
    "식신": "꾸준히 만들어 내는 손", "상관": "틀을 뒤집는 표현",
    "편재": "크게 돌아오는 돈", "정재": "새지 않게 모으는 돈",
    "편관": "압박 속의 추진력", "정관": "규칙과 신뢰로 쌓는 자리",
    "편인": "남다른 각도로 파고드는 힘", "정인": "받아들이고 익히는 힘",
}
ANIMALS = ["쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"]
HOUR_RANGE = {
    0: "23:00~00:59", 1: "01:00~02:59", 2: "03:00~04:59", 3: "05:00~06:59",
    4: "07:00~08:59", 5: "09:00~10:59", 6: "11:00~12:59", 7: "13:00~14:59",
    8: "15:00~16:59", 9: "17:00~18:59", 10: "19:00~20:59", 11: "21:00~22:59",
}
TERM_KO = {"소한": "소한", "대한": "대한", "입춘": "입춘", "우수": "우수", "경칩": "경칩",
           "춘분": "춘분", "청명": "청명", "곡우": "곡우", "입하": "입하", "소만": "소만",
           "망종": "망종", "하지": "하지", "소서": "소서", "대서": "대서", "입추": "입추",
           "처서": "처서", "백로": "백로", "추분": "추분", "한로": "한로", "상강": "상강",
           "입동": "입동", "소설": "소설", "대설": "대설", "동지": "동지"}
WD = ["월", "화", "수", "목", "금", "토", "일"]


# ------------------------------------------------------------------ 유틸
def rel(a, b):
    if a == b:
        return "same"
    ovr = [0, 2, 4, 1, 3]
    if (a + 1) % 5 == b:
        return "give"
    if (b + 1) % 5 == a:
        return "take"
    if ovr[(ovr.index(a) + 1) % 5] == b:
        return "beat"
    if ovr[(ovr.index(b) + 1) % 5] == a:
        return "beaten"
    return "same"


REL_LINE = {
    "same": "같은 기운이 겹치는 날 — 힘도 두 배, 고집도 두 배",
    "give": "내 기운을 밖으로 내보내는 날 — 말과 손이 잘 풀린다",
    "take": "바깥 기운이 나를 채우는 날 — 배움과 도움이 들어온다",
    "beat": "내가 상대를 쥐는 날 — 계산과 거래가 맞는다",
    "beaten": "바깥 기운이 나를 누르는 날 — 속도를 줄여야 이긴다",
}
REL_META = {
    "same": ("비화(比和)", "같은 기운끼리 겹칩니다. 힘도 두 배, 고집도 두 배입니다."),
    "give": ("식상(食傷)", "내 기운이 밖으로 나갑니다. 말과 손이 잘 풀립니다."),
    "take": ("인성(印星)", "바깥 기운이 나를 채웁니다. 배움과 도움이 들어옵니다."),
    "beat": ("재성(財星)", "내가 상대를 쥡니다. 계산과 거래가 맞습니다."),
    "beaten": ("관성(官星)", "바깥 기운이 나를 누릅니다. 속도를 줄여야 이깁니다."),
}
REL_SHORT = {
    "same": "겹치는 날 — 힘도 두 배, 고집도 두 배",
    "give": "내보내는 날 — 말과 손이 잘 풀린다",
    "take": "받는 날 — 배움과 도움이 들어온다",
    "beat": "쥐는 날 — 계산과 거래가 맞는다",
    "beaten": "눌리는 날 — 속도를 줄인다",
}


def j(word, kind):
    w = str(word)
    if not w:
        return w
    ch = w[-1]
    code = ord(ch)
    if 0xAC00 <= code <= 0xD7A3:
        has_batchim = (code - 0xAC00) % 28 != 0
    else:
        has_batchim = ch in "013678mnlrMNLR"
    table = {"은": ("은", "는"), "이": ("이", "가"), "을": ("을", "를"),
             "과": ("과", "와"), "으로": ("으로", "로")}
    with_b, without_b = table[kind]
    if kind == "으로":
        if 0xAC00 <= code <= 0xD7A3 and (code - 0xAC00) % 28 == 8:
            return without_b
        return with_b if has_batchim else without_b
    return with_b if has_batchim else without_b


def seed_int(*parts):
    h = hashlib.sha256("|".join(str(p) for p in parts).encode()).hexdigest()
    return int(h[:12], 16)


def views_for(*parts, lo=1200, hi=5800):
    return f"{lo + seed_int(*parts) % (hi - lo + 1):,}"


def load_json(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def save_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")


def kst_today():
    return datetime.now(S.TZ_KST).date() if hasattr(S, "TZ_KST") else datetime.now(S.KST).date()


def cta(title, sub):
    return {"t": "cta", "x": title, "y": sub}


def disclaimer(text):
    return {"t": "p", "x": "※ " + text}


# ------------------------------------------------------------------ 간지
def ganji_context(d):
    ms = S.kst_to_ms(d.year, d.month, d.day, 12, 0)
    year = S.year_pillar_at(ms)
    month = S.month_pillar_at(ms, year)
    day = S.day_pillar_for_date(d.year, d.month, d.day)
    return {"ms": ms, "year": year, "month": month, "day": day,
            "label": f"{year['hanja']}年 · {month['hanja']}月 · {day['hanja']}日",
            "ymd": f"{d.year}년 {d.month}월 {d.day}일 {WD[d.weekday()]}요일"}


def next_terms(d, n=2):
    ms = S.kst_to_ms(d.year, d.month, d.day, 0, 0)
    out, cursor = [], ms
    for _ in range(n):
        t = S.TERMS.after(cursor, jeol_only=False)
        if not t:
            break
        out.append((t["name"], S.ms_to_kst(t["ms"])))
        cursor = t["ms"] + 1000
    return out


def art_for(d, cat):
    """그날·그 지면 전용 일러스트를 만들고 지면 경로를 돌려준다 (하루 한 장, 절대 중복 없음)."""
    return ART.ensure(f"d-{d.isoformat()}-{cat}")


# ------------------------------------------------------------------ ① 오늘의 운세
def article_today(d, g):
    day, month = g["day"], g["month"]
    dstem, dbranch = day["stem"], day["branch"]
    ds, db = S.STEMS[dstem], S.BRANCHES[dbranch]
    doh, boh = S.OHK[ds[2]], S.OHK[db[2]]
    r = rel(ds[2], db[2])
    term, term_line = REL_META[r]
    terms = next_terms(d, 2)
    term_txt = ", ".join(f"{TERM_KO[n]}({t.month}월 {t.day}일)" for n, t in terms)

    zodiac = []
    for i, animal in enumerate(ANIMALS):
        rr = rel(ds[2], S.BRANCHES[i][2])
        line = REL_SHORT[rr]
        if abs(i - dbranch) == 6:
            line = "부딪히는 날 — 큰 계약·말다툼은 하루만 미루면 부드러워진다"
        zodiac.append(f"{animal}띠 — {line}")

    good, bad = [], []
    for br, hb in HOUR_RANGE.items():
        if rel(ds[2], S.BRANCHES[br][2]) in ("give", "same", "take"):
            good.append(hb)
        if abs(br - dbranch) == 6:
            bad.append(hb)
    good_txt = ", ".join(good[:3]) if good else "09:00~10:59"
    bad_txt = ", ".join(bad[:2]) if bad else "없음"

    title = f"{d.month}월 {d.day}일 {day['hangul']}일 — {doh} 기운이 도는 하루, 오늘 돈이 움직이는 시간은?"
    dek = (f"오늘의 일진은 {day['hanja']}({day['hangul']}). {ds[1]}({ds[0]})의 {doh} 기운이 "
           f"{db[1]}({db[0]})의 {boh} 위에 앉았습니다. 같은 날이라도 내 사주에 따라 답이 달라지는 이유, "
           f"그리고 오늘 하루를 가장 쉽게 쓰는 법을 정리했습니다.")
    lead = (f"{g['ymd']} — {g['label']}. 오늘의 중심은 {doh}, {OH[doh]['key']}의 기운입니다. "
            f"이 기운이 오늘의 말과 판단에 먼저 묻어납니다.")

    body = [
        {"t": "p", "x": "아침에 운세를 봤는데 “오늘은 좋은 날”이라고 했다. 그런데 하루 종일 아무 일도 없었다. "
                        "이럴 때 대부분은 “운세는 안 맞아”라고 넘긴다. 하지만 한 가지만 확인하면 이야기가 달라진다. "
                        "그 운세가 <strong>누구의 사주로 쓰였는지</strong>다."},
        {"t": "p", "x": f"오늘의 일진은 <strong>{day['hanja']}</strong>. 천간은 {ds[1]}({ds[0]}), {doh}입니다. "
                        f"{doh}{j(doh, '은')} {OH[doh]['key']}의 기운이고, {OH[doh]['body']}{j(OH[doh]['body'], '이')} 말하는 결입니다. "
                        f"지지는 {db[1]}({db[0]}), {boh}의 자리입니다. 둘이 만나 <strong>{term}</strong>의 관계가 됐습니다. {term_line}"},
        {"t": "h", "x": "같은 날인데 왜 나만 안 풀릴까"},
        {"t": "p", "x": f"일진은 ‘그날의 날씨’다. 같은 날씨라도 우산이 있는 사람과 없는 사람의 하루는 다르다. "
                        f"사주에서 그 우산이 바로 <strong>내 일간(日干, 태어난 날의 천간 — 사주에서 ‘나’를 뜻하는 한 글자)</strong>이다. "
                        f"오늘 들어온 {doh} 기운이 내 일간을 돕는지, 누르는지에 따라 같은 날이 정반대로 갈린다."},
        {"t": "p", "x": f"내 일간이 {doh}{j(doh, '을')} 필요로 하는 사주라면 오늘은 일이 술술 풀린다. "
                        f"이미 {doh}{j(doh, '이')} 넘치는 사주라면 오늘은 비워 두는 편이 낫다. "
                        f"돈이 급하게 들어오는 날과 나가는 날도 여기서 갈린다."},
        {"t": "q", "x": f"“{g['label']} — 하루의 간지는 하루의 문법입니다. 문법을 알면 문장을 덜 틀립니다.” — 정운타임즈"},
        {"t": "h", "x": "띠별 오늘의 한 줄"},
        {"t": "ul", "x": zodiac},
        {"t": "p", "x": f"띠는 태어난 해의 지지다. 12개뿐이라 간단하지만, 같은 띠 안의 수억 명이 같은 말을 듣는다. "
                        f"오늘 지지 {db[1]}{j(db[1], '과')} 정면으로 부딪히는 띠는 따로 표시했다. "
                        f"부딪힌다는 건 나쁜 날이 아니라, 큰 결정을 하루 미루면 훨씬 부드러워지는 날이다."},
        {"t": "h", "x": "오늘 잘 풀리는 시간"},
        {"t": "p", "x": f"오늘 기운이 잘 통하는 시간대는 <strong>{good_txt}</strong>이다. "
                        f"이 시간의 시지 오행이 오늘 천간의 {doh}{j(doh, '을')} 받아 주거나 같은 결이기 때문이다. "
                        f"반대로 <strong>{bad_txt}</strong>에는 오늘 지지와 부딪힌다. 계약·이사·큰 지출은 이 시간을 피하자."},
        {"t": "p", "x": f"절기로 보면 지금은 {month['hanja']}월, 다음 절기는 {term_txt}이다. "
                        f"월지의 기운이 이번 달 전체의 바탕이고, 오늘의 일진은 그 위에 하루치로 얹힌 결이다. "
                        f"하루가 안 풀릴 때 달을 보면 답이 보이는 이유다."},
        cta("내 일간으로 오늘의 기운을 다시 계산해 볼까요?",
            "생년월일만 넣으면 내 여덟 글자로 오늘의 흐름을 다시 씁니다. 결제 없이 네 장이 열립니다."),
        disclaimer("이 기사는 만세력의 간지와 전통 명리학의 상징 해석으로 쓴 참고·오락 정보입니다. 미래의 결과를 보장하지 않습니다."),
    ]
    return {
        "id": f"today-{d.strftime('%Y%m%d')}", "cat": "today", "img": art_for(d, "today"),
        "time": "05:30", "views": views_for("today", d.isoformat(), lo=22000, hi=31000),
        "title": title, "dek": dek, "writer": "정운 선임기자", "lead": lead, "body": body,
        "date": d.isoformat(), "gen": 2,
    }


# ------------------------------------------------------------------ ② 화제의 인물
def person_img(person):
    name = (person.get("img") or "").strip()
    if name and os.path.exists(os.path.join(ROOT, "assets", "img", name + ".webp")):
        return name
    field = person.get("field", "") + " " + person.get("group", "")
    if "피겨" in field or "스케이" in field:
        return "people-ice"
    if "축구" in field:
        return "people-field"
    if "방송인" in field:
        return "people-host"
    if "트로트" in field:
        return "people-trot"
    if "아이돌" in field or "방탄" in field:
        return "people-idol"
    if "뮤지컬" in field or "배우" in field:
        return "people-actress" if person.get("gender") == "여" else "people-actor"
    if person.get("gender") == "여" and "가수" in field:
        return "people-diva"
    if person.get("gender") == "남" and "가수" in field:
        return "people-trot"
    return "people-main"


def article_person(d, g, person):
    b = date.fromisoformat(person["birth"])
    sj = S.saju((b.year, b.month, b.day), person.get("hour"), 0, hour_known=bool(person.get("hour")))
    name = person["name"]
    dstem = sj["day_stem"]
    doh = S.OHK[sj["day_oh"]]
    ds = S.STEMS[dstem]
    pillars = [sj["year"], sj["month"], sj["day"]] + ([sj["hour"]] if sj["hour"] else [])
    pil_txt = " · ".join(p["hanja"] for p in pillars)
    oh_counts = sj["oh_counts"]
    lack = [S.OHK[i] for i, c in enumerate(oh_counts) if c == 0]
    sip = sj["sip"]
    n_jae = sip["편재"] + sip["정재"]
    n_gwan = sip["편관"] + sip["정관"]
    n_sik = sip["식신"] + sip["상관"]
    n_in = sip["편인"] + sip["정인"]
    n_bi = sip["비견"] + sip["겁재"]

    y27_stem_sip = S.SIP[S.shipsin_for_stem(dstem, 3)]
    y27_branch_sip = S.SIP[S.shipsin_for_branch(dstem, 7)]
    chung = [p["hanja"] for p in pillars if abs(p["branch"] - 7) == 6]
    hap_pairs = [(0, 1), (2, 11), (3, 10), (4, 9), (5, 8), (6, 7)]
    hap = [p["hanja"] for p in pillars
           if any((a == p["branch"] and bb == 7) or (bb == p["branch"] and a == 7) for a, bb in hap_pairs)]

    birth_ms = S.kst_to_ms(b.year, b.month, b.day, person.get("hour") or 12, 0)
    year_yang = S.STEMS[sj["year"]["stem"]][3]
    forward = (year_yang and person["gender"] == "남") or (not year_yang and person["gender"] == "여")
    if forward:
        anchor = S.TERMS.after(birth_ms, jeol_only=True)
        days = (anchor["ms"] - birth_ms) / S.DAY
    else:
        anchor = S.TERMS.at_or_before(birth_ms, jeol_only=True)
        days = (birth_ms - anchor["ms"]) / S.DAY
    start_age = int(days / 3.0)

    topic = person.get("topic", "")
    topic_date = person.get("topic_date", "")
    topic_date_ko = ""
    if topic_date and len(topic_date) == 10:
        td = date.fromisoformat(topic_date)
        topic_date_ko = f"{td.year}년 {td.month}월 {td.day}일"

    n_char = "여덟" if person.get("hour") else "여섯"
    sip_top = max(sip.items(), key=lambda kv: kv[1])[0]
    desc = topic_description(person, name)
    title_forms = [
        f"{name}, {desc}… {n_char} 글자로 읽는 {OH[doh]['key']}의 사람",
        f"{name}, {desc}… 사주로 본 ‘{SIP_MEAN[sip_top].split(',')[0]}’의 사람",
        f"{name}의 {n_char} 글자 — {desc}, 그 안에 숨은 {OH[doh]['key']}",
        f"{name}, {desc}… {SIP_TITLE[sip_top]}",
    ]
    title = title_forms[seed_int("people-title", name, d.isoformat()) % len(title_forms)]
    dek = (f"{name}{j(name, '은')} {person['field']}로 활동해 온 인물입니다. "
           f"공개된 생년월일은 {b.year}년 {b.month}월 {b.day}일"
           + (f", 태어난 시각 {person['hour']}시" if person.get("hour") else ", 태어난 시각은 공개되지 않았습니다")
           + f". 정운타임즈가 만세력으로 {'여덟' if person.get('hour') else '여섯'} 글자를 세어 봤습니다 — {pil_txt}.")
    lead = ((f"{topic_date_ko} — " if topic_date_ko else "") + f"{topic}. "
            + f"오늘의 주인공은 {name}, 일간은 {ds[0]}({ds[1]})입니다. 어려운 말은 빼고, 이 사람의 결만 읽어 봤습니다.")

    sip_lines = [f"{k} {v}자리 — {SIP_MEAN[k]}" for k, v in sip.items() if v > 0]

    body = [
        {"t": "p", "x": f"{topic}."},
        {"t": "p", "x": f"연예인의 사주를 읽는 일은 그 사람의 선택을 판정하는 일이 아니다. "
                        f"공개된 생년월일이라는 작은 실마리로 <strong>사람이 어떤 결로 세상을 통과하는지</strong> 배우는 일이다. "
                        f"{name}의 프로필에는 {b.year}년 {b.month}월 {b.day}일생으로 적혀 있다."},
        {"t": "h", "x": f"{name}의 {'여덟' if person.get('hour') else '여섯'} 글자"},
        {"t": "p", "x": f"<strong>{pil_txt}</strong> — 년주 {sj['year']['hanja']}, 월주 {sj['month']['hanja']}, 일주 {sj['day']['hanja']}"
                        + (f", 시주 {sj['hour']['hanja']}." if sj["hour"] else ". 태어난 시각은 공개되지 않아 시주를 뺀 여섯 글자로 본다.")},
        {"t": "p", "x": f"이 중에서 ‘나’를 뜻하는 글자는 일간 <strong>{ds[0]}({ds[1]})</strong> 하나다. "
                        f"{OH[doh]['img']}의 결, {OH[doh]['key']}{j(OH[doh]['key'], '을')} 하는 사람이다. "
                        f"사주에서 여덟 글자 가운데 유일하게 바뀌지 않는 기준점이다."},
        {"t": "p", "x": "오행을 세어 보면 " + ", ".join(f"{S.OHK[i]} {c}개" for i, c in enumerate(oh_counts)) + "이다. "
                        + (f"{'·'.join(lack)} 기운이 원국에 없다. 비어 있는 기운은 약점이 아니라, "
                           f"평생 그 자리를 스스로 만들어 채우게 되는 자리다. 이 사람의 경우 그 빈자리가 곧 활동의 방향이 됐을 가능성이 크다."
                           if lack else "다섯 기운이 모두 자리를 잡고 있다. 어느 하나 크게 비어 있지 않다는 뜻이다.")},
        {"t": "p", "x": "십성(十星, 여덟 글자가 나와 맺는 열 가지 관계)으로는 " + ", ".join(sip_lines) + "이다. "
                        + f"돈을 쥐는 별 {n_jae}자리, 사람을 만나는 별 {n_gwan}자리, 표현하는 별 {n_sik}자리, "
                          f"받아들이는 별 {n_in}자리, 나와 같은 편 {n_bi}자리."},
        {"t": "q", "x": f"“{name}의 사주에서 가장 두터운 기운은 {S.OHK[oh_counts.index(max(oh_counts))]}. "
                        f"그 기운이 사람의 첫인상을 만듭니다.” — 정운타임즈"},
        {"t": "h", "x": "이 사람의 ‘자리’는 어디였나"},
        {"t": "p", "x": f"배우자 자리는 일지, {sj['day']['hanja'][1]}({S.BRANCHES[sj['day']['branch']][1]}) — "
                        f"{S.OHK[S.BRANCHES[sj['day']['branch']][2]]}의 자리다. "
                        + (f"여성 사주에서 배우자를 보는 별은 관성(官星)이고, 원국에 {n_gwan}자리 있다. "
                           if person["gender"] == "여" else
                           f"남성 사주에서 배우자를 보는 별은 재성(財星)이고, 원국에 {n_jae}자리 있다. ")
                        + "무대 위에서 사람을 끄는 힘도 이 자리에서 나오는 경우가 많다."},
        {"t": "h", "x": "2027 정미년에는 무엇이 들어오나"},
        {"t": "p", "x": f"2027년은 정미년(丁未年). {name}의 일간 {ds[0]}에 丁(정)은 <strong>{y27_stem_sip}</strong>"
                        f"{j(y27_stem_sip, '으로')}, 未(미)는 <strong>{y27_branch_sip}</strong>{j(y27_branch_sip, '으로')} 들어온다. "
                        + (f"원국에서 未와 부딪히는 자리({', '.join(chung)})가 있어, 그해에는 자리를 옮기거나 관계를 정리하는 일이 생기기 쉽다. " if chung else "")
                        + (f"반대로 未와 합이 되는 자리({', '.join(hap)})가 있어, 사람을 통해 일이 풀리는 해이기도 하다. " if hap else "")
                        + "세운은 좋고 나쁨보다 ‘무엇이 들어와 무엇이 흔들리는가’로 읽는 편이 정확하다."},
        {"t": "p", "x": f"대운은 {start_age}세에 시작해 {'순행' if forward else '역행'}한다. 10년마다 큰 계절이 바뀌고, "
                        f"그 계절의 기운이 해마다의 세운과 겹치며 사람의 선택을 밀어 준다. "
                        f"{name}의 나이 {d.year - b.year}세는 그 계절의 어느 지점에 서 있다."},
        {"t": "h", "x": "혹시 내 사주에도 이 결이 있을까"},
        {"t": "ul", "x": [
            f"내 일간이 {doh}인지 확인해 보세요. 같은 결이면 이 사람의 선택이 유난히 이해될 겁니다.",
            f"내 오행에 {S.OHK[oh_counts.index(max(oh_counts))]}{j(S.OHK[oh_counts.index(max(oh_counts))], '이')} 많은지 보세요. 첫인상이 비슷합니다.",
            f"{'관성이 강하면 무대·조직' if n_gwan >= 2 else '식상이 강하면 표현·콘텐츠'} 쪽에 재능이 있습니다.",
            "내 여덟 글자는 생년월일만 넣으면 무료 4P에서 바로 나옵니다.",
        ]},
        cta(f"{name}처럼 내 사주에도 숨어 있는 재능이 있을까?",
            "생년월일만 넣으면 내 본성·돈·인연·2027년이 네 장으로 열립니다. 무료입니다."),
        disclaimer(f"{name}의 생년월일은 공개 프로필({person.get('wiki', '')})을 기준으로 했습니다. 이 분석은 전통 명리학의 상징 해석이며, 당사자의 실제 삶·선택과 무관합니다."),
    ]
    return {
        "id": f"people-{d.strftime('%Y%m%d')}", "cat": "people", "img": art_for(d, "people"),
        "time": "05:30", "views": views_for("people", d.isoformat(), lo=11000, hi=17000),
        "title": title, "dek": dek, "writer": "정운타임즈 운명연구소", "lead": lead, "body": body,
        "date": d.isoformat(), "gen": 2, "person": name,
    }


def topic_description(person, name):
    t = person.get("topic", "")
    if "결혼" in t:
        return "결혼이라는 새 출발"
    if "압류" in t or "화제" in t:
        return "다시 불린 이름"
    return person.get("field", "활동")


# ------------------------------------------------------------------ ③ 사주·재물
def article_money(d, g):
    day, month = g["day"], g["month"]
    ds = S.STEMS[day["stem"]]
    doh = S.OHK[ds[2]]
    mds = S.STEMS[month["stem"]]
    moh = S.OHK[mds[2]]
    jae_oh_idx = [0, 2, 4, 1, 3]
    jae_oh = S.OHK[jae_oh_idx[(jae_oh_idx.index(ds[2]) + 1) % 5]]
    good = []
    for br, hb in HOUR_RANGE.items():
        oh = S.BRANCHES[br][2]
        if S.OHK[oh] == jae_oh or rel(oh, ds[2]) == "give":
            good.append(hb)
    good_txt = ", ".join(good[:3]) if good else "09:00~10:59"
    title = f"{d.month}월 {d.day}일의 재물 — {doh}{j(doh, '이')} {jae_oh}{j(jae_oh, '을')} 쥐는 날, 돈이 움직이는 시간"
    dek = (f"오늘 일진 {day['hanja']}의 천간은 {ds[1]}({ds[0]}), {doh}입니다. {doh}{j(doh, '이')} 쥐는 오행은 {jae_oh} — "
           f"사주에서 말하는 ‘재성’의 자리입니다. 오늘 돈이 움직이는 시간과 이번 달의 그릇을 쉬운 말로 정리했습니다.")
    lead = "돈은 날마다 같은 속도로 움직이지 않습니다. 오늘의 간지가 어느 방향으로 돈의 문을 여는지 봅니다."
    body = [
        {"t": "p", "x": "“돈이 안 모여요.” 상담실에서 가장 많이 듣는 말이다. 그런데 대부분은 돈을 못 버는 게 아니다. "
                        "벌 때와 지킬 때를 구분하지 못한다. 벌어야 할 날에 지키기만 하면 기회를 놓치고, "
                        "지켜야 할 날에 벌이면 번 만큼 잃는다."},
        {"t": "p", "x": f"사주에서 돈은 <strong>재성(財星)</strong>이라 부른다. 어렵게 들리지만 뜻은 간단하다. "
                        f"‘내가 쥐고 다루는 힘’이다. 손으로 계산하고, 거래하고, 지키는 힘. "
                        f"오늘 천간의 {doh}{j(doh, '은')} {jae_oh}{j(jae_oh, '을')} 쥔다. 그래서 오늘의 재성은 {jae_oh}이다."},
        {"t": "h", "x": "오늘 돈이 움직이는 시간"},
        {"t": "p", "x": f"시지의 오행이 {jae_oh}이거나, 오늘 천간의 {doh}에게 기운을 보내는 시간대가 좋다 — "
                        f"<strong>{good_txt}</strong>. 입금 확인, 견적, 청구, 협상은 이 시간에 두는 편이 낫다. "
                        f"같은 일도 시간을 바꾸면 결과가 달라진다."},
        {"t": "p", "x": f"반대로 오늘 지지 {day['hanja'][1]}{j(day['hanja'][1], '과')} 부딪히는 시간대에는 큰 지출을 미루자. "
                        f"부딪힌다는 건 돈이 새는 자리가 아니라, <strong>판단이 급해지는 자리</strong>다. "
                        f"급한 판단이 돈을 잃게 만든다."},
        {"t": "h", "x": "이번 달의 그릇"},
        {"t": "p", "x": f"이번 달의 월건은 {month['hanja']}, 월간은 {mds[0]}({mds[1]}), {moh}이다. "
                        f"이번 달의 결정은 {moh}{j(moh, '으로')} 판단된다 — {OH[moh]['key']}의 결로 읽는 달이다. "
                        f"{OH[moh]['key']}{j(OH[moh]['key'], '이')} 강한 달에는 그 방향의 일이 유독 잘 풀리고, 반대 방향은 자꾸 미끄러진다."},
        {"t": "ul", "x": [
            "들어올 돈은 오전에 확인하자. 미루면 다음 달로 넘어간다.",
            f"오늘의 재성은 {jae_oh} — {OH[jae_oh]['key']}{j(OH[jae_oh]['key'], '과')} 관계된 지출(도구·배움·이동)은 남는 지출이다.",
            "사람에게 돈을 빌려주는 약속은 오늘 하지 않는 편이 좋다.",
            "지갑 속 영수증은 오늘 버리자. 돈이 머물 자리를 비우는 일이다.",
        ]},
        {"t": "q", "x": "“재물운은 그릇의 크기보다, 그릇에 물을 붓는 시기의 문제입니다.” — 정운타임즈"},
        {"t": "h", "x": "2027 정미년의 재물"},
        {"t": "p", "x": "2027년은 정미년(丁未年). 丁은 火, 未는 土 — 불이 흙을 낳는 해다. "
                        "화생토(火生土)의 해는 벌이는 힘보다 <strong>쌓는 힘</strong>이 강해진다. "
                        "큰 판을 새로 여는 것보다, 이미 가진 것을 단단히 굳히는 쪽이 남는다. "
                        "올해 안에 기반을 다져 둔 사람에게 2027년은 조용히 커지는 해가 된다."},
        {"t": "p", "x": "정운타임즈의 재물 기사는 오늘의 간지와 절기로 쓴다. "
                        "내 사주에서 재성이 어디에 놓였는지는 여덟 글자로 확인할 수 있다. "
                        "같은 날이라도 내 재성의 자리에 따라 조언이 정반대로 바뀐다."},
        cta("내 사주에서 돈이 새는 자리는 어디일까?",
            "생년월일만 넣으면 ‘돈이 새는 습관’과 2027년 변화가 네 장으로 열립니다. 무료 4P."),
        disclaimer("이 기사는 전통 명리학의 상징 해석으로 쓴 참고·오락 정보입니다. 투자·금융 판단의 근거가 될 수 없습니다."),
    ]
    return {
        "id": f"money-{d.strftime('%Y%m%d')}", "cat": "money", "img": art_for(d, "money"),
        "time": "05:30", "views": views_for("money", d.isoformat(), lo=6000, hi=10000),
        "title": title, "dek": dek, "writer": "정운 선임기자", "lead": lead, "body": body,
        "date": d.isoformat(), "gen": 2,
    }


# ------------------------------------------------------------------ ④ 어젯밤 그 꿈
DREAM_BOOK = [
    ("돼지가 집으로 들어오는 꿈", "재물", "돼지", "옛날부터 가장 좋은 꿈으로 꼽혔다. 들어오는 재물의 상징.",
     "꿈을 꾼 뒤 지갑과 통장을 먼저 정리해 보자. 자리가 없으면 돈도 못 들어온다."),
    ("맑은 물이 발목까지 차오르는 꿈", "재물", "물", "맑은 물은 흐르는 재물, 흐린 물은 감정의 소용돌이.",
     "물의 색이 맑았다면 오늘 벌이기 시작해도 좋다. 흐렸다면 결정을 하루 미루자."),
    ("달이 두 개 뜬 꿈", "귀인", "달", "두 달은 도와주는 사람이 둘이라는 옛 해석. 이미 곁에 있는 인연을 못 알아보는 신호.",
     "요즘 나를 챙겨 주는 사람의 이름을 세 명만 적어 보자. 그중 한 명이 답이다."),
    ("용이 구름을 타고 오르는 꿈", "승진·큰일", "용", "큰 흐름을 타는 상징. 미뤄 둔 제안을 꺼내기 좋은 때.",
     "미룬 제안 하나를 오늘 오전에 보내자. 오후엔 판단이 급해진다."),
    ("뱀이 허물을 벗는 꿈", "전환", "뱀", "국면 전환의 상징. 끝난 일을 정리하면 다음 문이 열린다.",
     "정리해야 할 관계·습관·구독 하나를 오늘 끊어 보자."),
    ("이가 빠지고 새 이가 나는 꿈", "새 출발", "이", "옛것이 나가고 새것이 들어온다는 뜻. 다만 아프면 건강 신호.",
     "몸이 먼저다. 잠을 30분 앞당기고, 아프면 병원부터."),
    ("옛집에 들어가는 꿈", "정리", "옛집", "아직 정리하지 못한 마음의 방을 보여 준다.",
     "꿈에서 어느 방에 있었는지 떠올려 보자. 안방은 가족, 부엌은 생계, 다락은 기억이다."),
    ("불이 집으로 번지는 꿈", "소문·열기", "불", "무섭지 않았다면 열기가 커지는 상징. 꺼졌다면 급한 마음을 다스려야.",
     "오늘 말을 아끼자. 불은 말이 많을 때 가장 크게 번진다."),
    ("누군가에게 쫓기는 꿈", "경고", "쫓김", "피하고 있는 대화가 있다는 신호.",
     "미룬 답장 하나를 오늘 보내자. 쫓기는 꿈의 절반이 여기서 멈춘다."),
    ("계단에서 떨어지는 꿈", "경고", "떨어짐", "통제감을 잃었다는 신호. 결정을 미루고 있을 때 온다.",
     "작은 결정 하나를 오늘 정하자. 결정이 쌓이면 꿈이 줄어든다."),
    ("곡식이 곳간에 쌓이는 꿈", "축적", "곡식", "꾸준히 준비한 사람에게 오는 저장의 상징.",
     "지금 쌓고 있는 것을 멈추지 말자. 이 꿈은 이미 쌓고 있다는 뜻이다."),
    ("닭이 새벽에 우는 꿈", "때", "닭", "때를 알리는 상징. 미뤄 둔 연락을 지금 하라는 신호.",
     "연락 미룬 사람에게 “생각나서” 세 글자만 보내 보자."),
]


def article_dream(d, g):
    idx = d.toordinal() % len(DREAM_BOOK)
    dream, kind, key, mean, action = DREAM_BOOK[idx]
    animal = ANIMALS[g["day"]["branch"]]
    db = S.BRANCHES[g["day"]["branch"]]
    title = f"오늘 밤 ‘{dream}’을 꾼다면 — {kind}의 신호"
    dek = (f"오늘의 일지(日支)는 {db[0]}({db[1]}), {animal}입니다. 정운타임즈가 오늘의 기운에 맞춰 "
           f"옛 꿈사전의 상징 하나를 골랐습니다 — {dream}. 꿈은 예고가 아니라 오늘 내가 미처 말하지 못한 것의 언어입니다.")
    lead = f"{mean} 꿈을 꿨다면, 오늘 할 일은 하나입니다. {action}"
    body = [
        {"t": "p", "x": "새벽에 이상하게 마음이 쓰여 눈이 떴다. 방금 꿈에서 뭔가를 봤는데, "
                        "검색해 보면 해몽 사이트마다 말이 다르다. 어떤 곳은 길몽, 어떤 곳은 흉몽. "
                        "그래서 꿈 해석이 더 헷갈린다."},
        {"t": "p", "x": "갈리는 이유는 간단하다. 꿈은 미래의 예고가 아니라 <strong>오늘 내가 미처 말하지 못한 것</strong>의 언어이기 때문이다. "
                        f"같은 장면을 봐도 어제 무슨 일이 있었는지에 따라 뜻이 달라진다. 옛 꿈사전은 그중 가장 자주 반복되는 패턴을 적어 둔 것이다."},
        {"t": "h", "x": f"{dream} — {kind}"},
        {"t": "p", "x": f"{mean}"},
        {"t": "p", "x": f"오늘의 지지는 {db[1]}({db[0]}), {animal}이다. {animal}의 오행은 {S.OHK[db[2]]}, "
                        f"{OH[S.OHK[db[2]]]['key']}의 결이다. 오늘 천간 {g['day']['hanja'][0]}의 기운과 만나 "
                        f"‘{REL_LINE[rel(S.STEMS[g['day']['stem']][2], db[2])]}’로 읽힌다. "
                        f"꿈의 상징과 오늘의 기운이 같은 방향을 가리키는 날이다."},
        {"t": "q", "x": "“꿈은 미래의 예고가 아니라, 오늘 내가 미처 말하지 못한 것의 언어입니다.” — 정운타임즈"},
        {"t": "h", "x": "이 꿈을 꿨다면 오늘 할 일"},
        {"t": "ul", "x": [
            action,
            "꿈에서 느낀 감정을 먼저 적자 — 장면보다 감정이 정확하다.",
            "같은 꿈이 3번 이상 반복되면 예고가 아니라 숙제다. 미룬 일 하나를 정리하자.",
            "잠에서 깬 직후 30초가 가장 선명하다. 한 단어라도 적어 두자.",
        ]},
        {"t": "h", "x": "내 꿈의 사전은 따로 있다"},
        {"t": "p", "x": "꿈에 자주 나오는 상징은 사람마다 다르다. 그 차이는 사주의 오행에서 갈린다. "
                        "물이 많은 사주는 물·비·강이, 불이 많은 사주는 해·불·용이 자주 나온다. "
                        "토가 많은 사주는 집·흙·옛것이, 금이 많은 사주는 칼·가위·이별이 자주 나온다. "
                        "내 사주에 어떤 기운이 많은지 알면, 내 꿈의 언어도 훨씬 쉽게 읽힌다."},
        cta("내 꿈에는 왜 그 장면이 자꾸 나올까?",
            "내 사주의 오행 비율을 알면 꿈의 언어가 보입니다. 생년월일만 넣으면 무료 4P가 열립니다."),
        disclaimer("꿈 해석은 전통 상징과 심리학적 해석을 섞은 참고 정보입니다. 의료·심리 상담을 대신하지 않습니다."),
    ]
    return {
        "id": f"dream-{d.strftime('%Y%m%d')}", "cat": "dream", "img": art_for(d, "dream"),
        "time": "05:30", "views": views_for("dream", d.isoformat(), lo=5000, hi=9000),
        "title": title, "dek": dek, "writer": "정운타임즈 취재팀", "lead": lead, "body": body,
        "date": d.isoformat(), "gen": 2,
    }


# ------------------------------------------------------------------ ⑤ MBTI 궁합 (매일 다른 주제)
MBTI_THEMES = [
    {
        "title": "T인데 사주는 감성 폭발 — 그 반전이 매력인 유형",
        "dek": "“저 T인데요, 원래 안 우는데요.” 그런데 여덟 글자를 펼치면 새벽 두 시에 우는 사주인 경우가 적지 않다. 도구와 재질이 다르기 때문이다.",
        "hook": "MBTI는 지금 내가 쓰기로 한 방식, 사주는 그 방식을 쓰게 만든 재질이다.",
        "blocks": [
            ("h", "T와 감정형 사주가 어긋나는 이유"),
            ("p", "사주에서 결단의 기운은 금(金)이다. 선을 긋고 정리한다. T와 닮았다. 그런데 금은 차가운 게 아니라 뜨거워지면 식지 않는 것이다. 감정이 없는 게 아니라 감정을 정리해서 꺼낸다."),
            ("p", "여기에 물(水)이 많으면 겉으로는 “결론이 뭐야”라고 말하는 사람이 밤에 혼자 그 대화를 다시 재생한다. 이 사주는 울지 않는 게 아니라 남이 없을 때 운다."),
            ("ul", ["INTJ × 경금 — 무심한 척 미리 사다 놓는 다정함", "ENFP × 기토 — 모두를 웃게 하고 자기 감정은 흙에 심어 둠", "ESTJ × 계수 — 조직의 믿음직한 사람, 속으로는 몇 년 뒤 계획", "ISTP × 신금 — 말은 없는데 취향은 절대 안 꺾음"]),
        ],
    },
    {
        "title": "I인데 말 많은 사주 — 조용한데 수다스러운 사람의 비밀",
        "dek": "모임에서는 조용한데, 친한 사람 앞에서는 말이 폭발한다. 이 간극이 이상하게 매력적인 이유를 사주로 풀었다.",
        "hook": "I는 에너지를 혼자 충전하고, 사주의 식상은 말로 기운을 내보낸다. 둘은 충돌하지 않는다.",
        "blocks": [
            ("h", "조용함과 말 많음은 모순이 아니다"),
            ("p", "I는 사람에게서 에너지를 뺏기는 유형이다. 그래서 낯선 자리에서는 말을 아낀다. 그런데 사주에 식상(食傷, 표현하는 기운)이 살아 있으면 친한 사람 앞에서 그 표현이 터진다. 아끼던 걸 한 번에 쏟아내는 것."),
            ("p", "이 유형은 처음 만난 사람에게는 과묵하고, 세 번째 만남에서 갑자기 재미있어진다. 그래서 “너 원래 이런 애였어?”라는 말을 자주 듣는다."),
            ("ul", ["INFP × 정화 — 촛불처럼 한 사람에게만 오래 밝힘", "ISTJ × 무토 — 산처럼 묵직, 친해지면 농담이 많음", "INFJ × 계수 — 스며들듯 말하다가 결국 다 적심", "ISFP × 을목 — 조용한데 취향 이야기만 나오면 폭발"]),
        ],
    },
    {
        "title": "P인데 계획표에 집착하는 사주 — 즉흥형의 숨은 완벽주의",
        "dek": "여행은 즉흥으로 떠나는데, 지갑 속 영수증은 날짜별로 정리되어 있다. 이 모순 같은 조합의 정체.",
        "hook": "P는 결정을 미루는 게 아니라, 결정의 순간을 아끼는 것이다.",
        "blocks": [
            ("h", "즉흥과 완벽주의는 함께 온다"),
            ("p", "P는 미리 정하는 걸 답답해한다. 그런데 사주에 인성(印星, 쌓고 익히는 기운)이 강하면 ‘준비’에 집착한다. 여행 계획은 안 세우면서 가방은 완벽하게 싸는 사람. 이게 이 조합이다."),
            ("p", "이 유형의 함정은 시작이 늦다는 것. 준비가 100%가 아니면 못 나가는데, 즉흥형이라 준비를 미리 못 한다. 결국 벼락치기. 그런데 의외로 잘한다."),
            ("ul", ["ENFP × 기토 — 즉흥인데 챙길 건 다 챙김", "ESTP × 병화 — 일단 부딪히고 수습은 빠름", "INTP × 신금 — 게으른 완벽주의의 정석", "ESFP × 정화 — 노는 것도 계획 없이 완벽하게"]),
        ],
    },
    {
        "title": "“우리 안 맞는 것 같아”가 가장 많이 나오는 조합 — 그런데 오래 간다",
        "dek": "INFP×ESTJ, ENFP×ISTJ. 네 글자가 거의 반대인 커플이 초반엔 힘들어도 장기 유지율은 높다. 이유가 있다.",
        "hook": "안 맞는 게 아니라, 서로에게 없는 것을 가졌다는 걸 받아들이는 데 시간이 걸릴 뿐이다.",
        "blocks": [
            ("h", "반대 조합이 오래 가는 구조"),
            ("p", "네 글자가 완전히 같은 커플은 초반 만족도가 높다. 말이 통한다. 그런데 같은 약점을 함께 가졌기 때문에 위기가 오면 둘 다 같은 방식으로 무너진다. 사주에서도 같은 오행이 지나치게 겹치면 ‘강한데 막히는’ 구조가 된다."),
            ("p", "반대 조합은 서로의 빈칸을 채운다. 시간이 걸릴 뿐, 채워지고 나면 관계가 단단해진다. 핵심은 ‘다르다’를 ‘틀렸다’로 읽지 않는 것."),
            ("ul", ["다툰 뒤 30분 안에 “내가 서운했던 지점은 여기야” 한 문장", "상대가 조용해질 때 20분을 정해 두고 기다리기", "큰 결정은 즉흥형이 먼저 제안, 계획형이 마지막 확인", "한 달에 한 번 서로가 주도하는 데이트"]),
        ],
    },
    {
        "title": "연락이 끊기는 유형 vs 연락을 못 끊는 유형 — 사주로 본 이별의 방식",
        "dek": "헤어지면 연락을 다 지우는 사람과, 3년째 생일 축하를 보내는 사람. 이 차이는 성격이 아니라 기운의 흐름이다.",
        "hook": "끊는 사람은 미련이 없어서가 아니라, 미련을 정리하는 방식이 다를 뿐이다.",
        "blocks": [
            ("h", "끊는 쪽과 못 끊는 쪽"),
            ("p", "금(金)이 강한 사주는 끊는다. 선을 긋는 기운이 강해서다. 미련이 없어서가 아니라, 미련이 남으면 더 아프다는 걸 알아서 먼저 자른다. 물(水)이 강한 사주는 못 끊는다. 감정이 스며들어서 시간이 오래 걸린다."),
            ("p", "문제는 두 유형이 만날 때다. 끊는 쪽은 빨리 정리되고, 못 끊는 쪽은 오래 아파한다. 이때 필요한 건 연락이 아니라 ‘정한 날짜’다. 3개월 뒤에 다시 생각하기로 정하는 것."),
            ("ul", ["끊는 유형 — 정리했다고 말해 주세요. 말없이 사라지면 상대는 3년을 아파합니다.", "못 끊는 유형 — 3개월 규칙을 정하세요. 그 안에는 연락하지 않기.", "둘 다 — 마지막 대화를 문자로 남기면 정리에 도움이 됩니다.", "사주에서 금·수 비율을 보면 내 방식이 보입니다."]),
        ],
    },
    {
        "title": "고백 타이밍 — 사주가 말하는 ‘오늘 말해도 되는 날’",
        "dek": "같은 고백도 어떤 날은 통하고 어떤 날은 어색해진다. 기운의 방향을 타는 고백 타이밍.",
        "hook": "고백은 용기가 아니라 타이밍이다. 기운이 밖으로 나가는 날에 말해야 도착한다.",
        "blocks": [
            ("h", "말이 잘 도착하는 날"),
            ("p", "사주에서 오늘의 기운이 내 기운을 밖으로 내보내는 날(식상)에는 말이 잘 도착한다. 반대로 바깥 기운이 나를 누르는 날(관성)에는 같은 말도 무겁게 들린다. 대화가 잘 풀리는 날이 고백하기 좋은 날이다."),
            ("p", "상대의 기운도 봐야 한다. 상대가 지친 날에는 어떤 고백도 부담이 된다. 그래서 고백은 ‘내가 용기 낸 날’이 아니라 ‘상대가 들을 수 있는 날’에 해야 한다."),
            ("ul", ["상대가 최근에 힘든 일을 말했다면 — 일주일 뒤가 좋습니다.", "대화가 자연스럽게 길어지는 날 — 그날이 타이밍입니다.", "술자리 고백은 피하세요. 기운이 흐려진 상태의 말은 도착하지 않습니다.", "고백 뒤에는 기다리세요. 3일은 기다려야 답이 옵니다."]),
        ],
    },
    {
        "title": "결혼하면 달라지는 유형 — 사주가 말하는 ‘배우자 자리’의 힘",
        "dek": "연애 때와 결혼 후가 다른 사람이 있다. 배우자 자리(일지)가 강한 사주일수록 그 변화가 크다.",
        "hook": "배우자 자리는 사주에서 단 한 글자. 그 글자가 결혼 후의 나를 만든다.",
        "blocks": [
            ("h", "일지가 강한 사람은 결혼 후가 다르다"),
            ("p", "사주에서 배우자는 일지 한 글자에 담긴다. 이 자리가 강하면 결혼 후 생활 방식이 크게 바뀐다. 좋은 쪽으로 바뀌면 안정되고, 나쁜 쪽으로 바뀌면 자기 삶을 잃는다. 차이는 상대가 아니라 ‘내가 자리를 지키는 방식’에서 갈린다."),
            ("p", "결혼 후에도 혼자만의 시간을 유지하는 사람은 일지가 강해도 무너지지 않는다. 반대로 모든 걸 맞추려는 사람은 3년 안에 지친다."),
            ("ul", ["결혼 전에 ‘혼자만의 시간’을 협상하세요. 이게 가장 중요합니다.", "배우자 자리가 충이면 — 갈등이 아니라 ‘규칙’이 필요합니다.", "배우자 자리가 합이면 — 사람을 통해 일이 풀립니다.", "내 일지가 무엇인지 무료 4P 세 번째 장에서 확인하세요."]),
        ],
    },
    {
        "title": "싸울 때 말이 많아지는 유형 vs 조용해지는 유형 — 이걸 모르면 10년을 싸운다",
        "dek": "한 사람은 말로 풀고, 한 사람은 시간으로 푼다. 이 차이를 모르면 같은 싸움을 평생 반복한다.",
        "hook": "말이 많아지는 건 공격이 아니고, 조용해지는 건 무시가 아니다. 둘 다 회복하는 방식이다.",
        "blocks": [
            ("h", "회복의 방식이 다를 뿐"),
            ("p", "말이 많아지는 사람은 말하면서 감정을 정리한다. 조용해지는 사람은 혼자 있어야 정리된다. 문제는 두 사람이 동시에 싸우면, 한 사람은 말이 없어서 불안하고 다른 한 사람은 말이 많아서 지친다."),
            ("p", "해결은 간단하다. “20분 뒤에 다시 얘기하자”는 규칙 하나. 이 문장이 두 사람의 회복 방식을 모두 존중한다."),
            ("ul", ["싸운 직후 — 각자 20분을 갖기", "20분 뒤 — “내가 서운했던 장면은 이거야” 한 문장씩", "조용한 쪽 — “무시하는 게 아니라 정리하는 중”이라고 말해 주기", "말 많은 쪽 — 결론을 30분 뒤로 미루기"]),
        ],
    },
]


def article_mbti(d, g):
    t = MBTI_THEMES[d.toordinal() % len(MBTI_THEMES)]
    body = [
        {"t": "p", "x": "MBTI와 사주를 같이 보면 이상하게 설명이 되는 순간이 있다. 네 글자로는 이해가 안 되던 행동이, 여덟 글자를 펼치면 딱 맞아떨어질 때. "
                        "그 이유는 단순하다. <strong>MBTI는 지금 내가 쓰기로 한 방식이고, 사주는 그 방식을 쓰게 만든 재질</strong>이기 때문이다."},
        {"t": "p", "x": f"{t['hook']}"},
    ]
    for kind, text in t["blocks"]:
        if kind == "ul":
            body.append({"t": "ul", "x": text})
        else:
            body.append({"t": kind, "x": text})
    body += [
        {"t": "q", "x": "“도구와 재질이 다를 때, 사람은 가장 매력적이고 가장 자주 오해받습니다.” — 정운타임즈"},
        {"t": "p", "x": f"오늘의 일진은 {g['day']['hangul']}일. 오늘 하루의 기운은 {S.OHK[S.STEMS[g['day']['stem']][2]]}이다. "
                        f"이 기운이 내 사주에 어떻게 들어오는지 알면, 오늘의 관계도 조금 다르게 보인다."},
        cta("내 MBTI와 내 사주는 어디서 어긋날까?",
            "생년월일만 넣으면 내 일간과 기운의 비율이 네 장으로 열립니다. 무료 4P."),
        disclaimer("이 기사는 상담 사례와 전통 상징을 바탕으로 한 참고·오락 정보입니다."),
    ]
    return {
        "id": f"mbti-{d.strftime('%Y%m%d')}", "cat": "mbti", "img": art_for(d, "mbti"),
        "time": "05:30", "views": views_for("mbti", d.isoformat(), lo=7000, hi=12000),
        "title": t["title"], "dek": t["dek"], "writer": "정운 선임기자", "lead": t["hook"], "body": body,
        "date": d.isoformat(), "gen": 2,
    }


# ------------------------------------------------------------------ ⑥ 전생 (12유형 회전)
PAST_TYPES = [
    ("musician", "궁중의 악사", "조선 중기 · 장악원", "사람의 마음을 소리로 옮기던 손",
     "좋아하는 노래를 반복해서 듣는다", "표현하지 않으면 악보만 남는다", "연주·작곡·콘텐츠 기획",
     "혼자 있을 때 이상하게 콧노래가 나온다", "감정이 차오르면 말 대신 소리로 정리하는 습관이 남아 있다."),
    ("sword", "유랑하는 검객", "고려 말 · 변방", "정의보다 생존을 먼저 배운 사람",
     "부당한 일을 보면 지나치지 못한다", "칼을 내려놓는 용기", "영업·협상·보안",
     "갈등이 생기면 몸이 먼저 굳는다", "방어본능이 남아 있어, 싸움이 아니어도 몸이 먼저 반응한다."),
    ("courier", "서찰을 나르는 역졸", "조선 후기 · 파발", "소식을 가장 먼저 알고 가장 늦게 말하던 사람",
     "남의 소식을 먼저 확인한다", "내 소식도 전해야 한다", "유통·물류·커뮤니케이션",
     "남의 이름은 잘 알리는데 내 이름은 못 알린다", "연결의 재능은 큰데 자기 브랜드가 약하다."),
    ("painter", "불화를 그리던 화공", "조선 후기 · 사찰", "보이지 않는 것을 보이게 만든 사람",
     "사진과 색을 오래 들여다본다", "완성하지 못한 것도 작품이다", "디자인·영상·브랜딩",
     "시작은 많은데 마무리가 어렵다", "큰 그림을 혼자 그리던 습관이 남아 완성이 두렵다."),
    ("merchant", "바다를 건너는 상인", "남해 · 개항기", "위험을 값으로 바꾸는 계산",
     "새로운 시장을 먼저 살핀다", "혼자 다 벌지 않는 법", "사업·무역·투자 판단",
     "돈의 흐름을 남보다 빨리 읽는다", "장부가 손끝에 남아 있어 숫자에 민감하다."),
    ("farmer", "씨앗을 지키는 농부", "삼국 · 들녘", "계절을 믿고 기다릴 줄 알던 사람",
     "해마다 같은 것을 다시 시작한다", "때를 놓치지 않는 용기", "교육·재배·장기 운영",
     "느리지만 꾸준한 쪽이 결국 남는다", "인내가 몸에 남아 급한 결정을 어려워한다."),
    ("herbalist", "약초를 캐던 산의 의원", "조선 · 산중", "병보다 사람을 먼저 본 사람",
     "사람의 컨디션을 먼저 살핀다", "내 몸도 환자로 대우하기", "상담·돌봄·의료",
     "남의 아픔을 오래 듣다 정작 내 병을 놓친다", "돌봄의 습관이 남아 자기 몸을 뒤로 미룬다."),
    ("teacher", "아이들을 가르친 훈장", "조선 · 서당", "같은 말을 다르게 반복하던 사람",
     "설명이 길어진다", "듣는 사람의 속도", "강의·기획·작가",
     "설명을 잘하지만 상대가 지치는 지점을 놓친다", "가르치는 기쁨이 커서 듣는 사람의 속도를 잊는다."),
    ("physician", "궁의 의녀", "조선 · 궁중", "말하지 못한 병을 읽어낸 사람",
     "표정을 먼저 읽는다", "내 감정도 진찰 대상", "기획·상담·서비스",
     "분위기를 지나치게 감지해 지친다", "진맥하던 손이 남아 남의 기분을 먼저 읽는다."),
    ("smith", "쇠를 다루던 장인", "철기 시대 · 대장간", "불과 망치로 형태를 만든 사람",
     "도구와 장비에 집착한다", "완벽한 도구보다 지금의 손", "제작·개발·엔지니어링",
     "장비를 갖추다 시작이 늦다", "대장간이 아직 뜨거워 준비만 하다 때를 놓친다."),
    ("astronomer", "별을 읽던 천문관", "조선 · 관상감", "사람보다 하늘을 먼저 본 사람",
     "밤에 생각이 많아진다", "하늘 아래의 오늘", "전략·연구·데이터",
     "큰 그림은 잘 그리는데 오늘의 일이 밀린다", "밤하늘이 남아 큰 것만 보다 작은 일을 놓친다."),
    ("clown", "장터의 광대", "조선 · 장터", "웃음으로 진실을 말하던 사람",
     "분위기가 무거우면 농담을 던진다", "슬픔도 말해도 된다", "방송·마케팅·콘텐츠",
     "사람을 웃기지만 정작 내 이야기는 안 한다", "탈이 남아 웃음 뒤에 진심을 숨긴다."),
]


def article_past(d, g):
    (key, role, era, one, habit, lesson, job, sign, why) = PAST_TYPES[d.toordinal() % len(PAST_TYPES)]
    title = f"전생이 ‘{role}’였다면 — 지금도 남아 있는 습관 하나"
    dek = (f"전생을 믿지 않아도 재미있는 이유는, 그 이야기가 지금의 습관을 비추기 때문입니다. "
           f"오늘의 기운에 맞춰 열두 유형 중 ‘{role}’형을 골랐습니다. {era}의 {one}.")
    lead = f"“{sign}” — 이 문장이 찔린다면, 이 유형의 숙제가 아직 남아 있는 것입니다."
    body = [
        {"t": "p", "x": "“전생 같은 건 안 믿어요.” 상담실에서 이 말을 먼저 하는 사람일수록, 전생 유형을 들은 뒤 조용해진다. "
                        "이유는 간단하다. 전생 이야기가 사실 여부와 별개로 <strong>지금의 습관을 아주 정확하게 비추기</strong> 때문이다."},
        {"t": "p", "x": f"오늘의 유형은 <strong>{role}</strong>. {era}, {one}. "
                        f"어려운 말로 하면 ‘{key}’의 기운이 강한 사람이다. 쉽게 말하면 {why}"},
        {"t": "h", "x": "지금도 남아 있는 습관"},
        {"t": "p", "x": f"이 유형의 가장 큰 특징은 <strong>{habit}</strong>이다. 남들이 보면 별것 아닌데, 본인은 그걸 안 하면 불안하다. "
                        f"전생에서 그 일을 하지 않으면 목숨이 위험했기 때문이라고 해석한다. 요즘 말로 하면 ‘몸에 밴 생존 습관’이다."},
        {"t": "p", "x": f"그래서 이 유형은 {sign}. 이 문장이 찔린다면, 지금 그 습관이 나를 돕는 게 아니라 붙잡고 있다는 뜻이다."},
        {"t": "q", "x": f"“전생은 변명이 아니라 설명입니다. 설명을 알면 습관을 고를 수 있습니다.”"},
        {"t": "h", "x": "이번 생의 숙제"},
        {"t": "p", "x": f"이 유형의 숙제는 <strong>{lesson}</strong>이다. 재능은 이미 충분하다. 문제는 그 재능을 어디에 쓰느냐다. "
                        f"전생에서 못 한 일이 이번 생에 다시 온다는 해석은, 심리학적으로 보면 ‘같은 상황이 반복되는 이유’를 설명하는 옛날식 언어다."},
        {"t": "ul", "x": [
            f"이 유형에게 맞는 일 — {job}",
            f"이번 주에 해 볼 것 — {habit} 대신 다른 방식으로 같은 감정을 풀어 보기",
            "숙제가 반복된다면 — 상황이 아니라 내 반응이 반복되는지 살펴보세요.",
            "전생 유형이 궁금하면 — 생년월일만 넣으면 열두 유형 중 하나가 나옵니다.",
        ]},
        {"t": "p", "x": f"오늘의 일진 {g['day']['hangul']}일과 이 유형은 잘 맞는 편이다. 오늘은 이 유형의 재능이 조금 더 또렷하게 드러나는 날이다. "
                        f"누군가에게 먼저 말을 걸어 보자. 이 유형의 재능은 사람 사이에서 살아난다."},
        cta("내 전생 유형은 열두 가지 중 무엇일까?",
            "생년월일만 넣으면 재능·숙제·기억까지 한 번에 나옵니다. 무료입니다."),
        disclaimer("전생 유형은 전통 상징과 심리 해석을 결합한 오락 콘텐츠입니다. 사실 여부를 주장하지 않습니다."),
    ]
    return {
        "id": f"past-{d.strftime('%Y%m%d')}", "cat": "past", "img": art_for(d, "past"),
        "time": "05:30", "views": views_for("past", d.isoformat(), lo=4500, hi=8500),
        "title": title, "dek": dek, "writer": "정운타임즈 취재팀", "lead": lead, "body": body,
        "date": d.isoformat(), "gen": 2,
    }


# ------------------------------------------------------------------ ⑦ 운부르는것들 (개운 소품 회전)
SHOP_ITEMS = [
    ("황동 거북", "수(水)·토(土)", "뒤를 지키는 것", "책상 왼쪽 또는 현관 들어와 왼쪽 선반",
     "머리는 방 안쪽을 향하게", "일주일에 한 번 닦으며 이번 주에 지킬 것 하나를 정한다",
     "거북은 오래 사는 것과 뒤를 지키는 것의 상징이다. 등껍질은 단단하고 걸음은 느리지만 방향을 잃지 않는다."),
    ("옥(玉)", "금(金)·토(土)", "품으면 따뜻해지는 것", "손목이나 손가락, 몸에 붙이는 것이 좋다",
     "깨진 옥은 작은 그릇에 담아 둔다", "닦을 때 오늘 감사한 일 하나를 떠올린다",
     "옥은 차가운 돌이 아니라 품으면 따뜻해지는 돌이다. 하루에 몇 번씩 손이 가면서 잠깐 멈추게 된다."),
    ("붉은 실", "화(火)", "끊는 것", "손목에 한 번 감는다",
     "한 달 뒤에 풀어도 좋다", "감을 때 “올해는 이것을 끊겠다”고 말한다",
     "붉은 실은 인연의 상징으로 알려졌지만, 개운법에서는 미련과 나쁜 습관을 끊는 의식으로도 쓴다."),
    ("소금 한 그릇", "금(金)·수(水)", "정화", "현관이나 화장실 구석",
     "한 달에 한 번 새로 갈아 준다", "갈아 줄 때 “나간 것은 나가게”라고 말한다",
     "소금은 오래된 정화의 상징이다. 눈에 안 보이는 것을 씻는다는 뜻으로 쓴다."),
    ("동양난 화분", "목(木)", "천천히 자라는 것", "거실 창가, 해가 드는 쪽",
     "잎을 일주일에 한 번 닦아 준다", "새 잎이 나면 그달의 목표 하나를 정한다",
     "난은 급하게 키울 수 없다. 그래서 기다림의 상징이 된다. 개운은 속도를 늦추는 일이기도 하다."),
    ("향", "화(火)·목(木)", "공간을 바꾸는 것", "현관이나 서재, 공부하는 자리",
     "하루 10분만 피운다", "향을 피우는 동안 오늘 할 일 하나만 정한다",
     "향은 공간의 냄새를 바꾼다. 냄새가 바뀌면 기분이 바뀌고, 기분이 바뀌면 판단이 바뀐다."),
    ("나무 그릇", "목(木)", "담는 것", "부엌에서 가장 잘 보이는 곳",
     "물기 없이 닦아 뒤집어 둔다", "그릇에 오늘 먹을 것을 담으며 “충분하다”고 말한다",
     "그릇은 재물의 상징이다. 큰 그릇보다 매일 쓰는 그릇이 운을 만든다."),
    ("벽시계", "금(金)", "때를 아는 것", "거실에서 가장 잘 보이는 벽",
     "멈추면 바로 고친다", "매달 1일에 시계를 맞추며 이번 달 목표를 정한다",
     "시계가 멈춘 집은 시간이 멈춘 집이라는 옛말이 있다. 때를 아는 것이 개운의 시작이다."),
    ("신발장 정리", "토(土)", "나가는 문", "현관 신발장",
     "신발은 세 켤레 이하로", "일요일마다 신발을 닦는다",
     "신발장은 나가는 문이다. 신발이 정리되어 있으면 “나갈 준비가 되어 있다”는 신호가 된다."),
    ("달 모양 소품", "수(水)", "비추는 것", "창가나 침대 머리 쪽",
     "은은한 빛이면 충분하다", "자기 전에 오늘 잘한 일 하나를 떠올린다",
     "달은 어두운 곳을 밝히는 상징이다. 해가 짧아지는 계절에 마음이 가라앉을 때 두면 좋다."),
    ("매화 가지", "목(木)", "겨울에 피는 것", "현관이나 서재",
     "물을 자주 갈아 준다", "꽃이 필 때까지 기다리며 한 가지 일을 정한다",
     "매화는 눈 속에서 핀다. 어려운 때의 시작을 뜻한다. 아직 피지 않아도 되는 때라는 위로가 된다."),
    ("문고리", "금(金)", "들어오는 것", "현관 문 안쪽",
     "한 달에 한 번 닦는다", "문을 열 때 “오늘 좋은 것이 들어온다”고 말한다",
     "문고리는 기운이 들어오는 손잡이다. 매일 만지는 것이라 의식이 되기 쉽다."),
]


def article_shop(d, g):
    (name, oh, meaning, place, tip, act, why) = SHOP_ITEMS[d.toordinal() % len(SHOP_ITEMS)]
    title = f"{name}, 어디에 두면 좋을까 — {meaning}의 상징과 오늘 바로 하는 법"
    dek = (f"좋은 소품도 자리가 틀리면 묻힙니다. {name}이 상징하는 것, 두는 자리, 그리고 오늘 바로 할 수 있는 일 하나. "
           f"비싼 부적보다 매일 보이는 물건 하나가 운을 바꿉니다.")
    lead = f"{name}은 {meaning}의 상징입니다. 사주로 보면 {oh}의 기운을 다루는 물건이고, 그래서 자리가 중요합니다."
    body = [
        {"t": "p", "x": "“부적 같은 거 안 믿어요.” 그러면서도 책상 위에 작은 물건 하나는 두고 있는 사람이 많다. "
                        "왜 하필 그 물건일까. 그리고 왜 하필 그 자리일까."},
        {"t": "p", "x": f"{why} 사주에서 개운은 특별한 것을 더하는 일이 아니라 <strong>자리를 바로잡는 일</strong>이다. {name}은 그 자리를 만드는 도구다."},
        {"t": "h", "x": f"{name} — 어디에 두나"},
        {"t": "p", "x": f"두는 자리는 <strong>{place}</strong>. 이유는 시야에 자주 들어와야 하기 때문이다. "
                        f"보이지 않는 소품은 아무 의미가 없다. 눈에 들어올 때마다 “지금 내가 지켜야 할 것은 무엇인가”를 한 번씩 되묻게 하는 것, 그게 개 운의 실체다."},
        {"t": "h", "x": "오늘 바로 하는 법"},
        {"t": "ul", "x": [
            f"자리 — {place}",
            f"방향·상태 — {tip}",
            f"하는 일 — {act}",
            "한 가지 원칙 — 자주 보이게. 안 보이면 안 한 것과 같다.",
        ]},
        {"t": "q", "x": "“개운은 특별한 것을 더하는 일이 아니라, 자리를 바로잡는 일입니다.” — 정운타임즈"},
        {"t": "h", "x": "내 사주에 맞는 소품은 따로 있다"},
        {"t": "p", "x": f"{name}은 {oh}의 기운을 다루는 물건이다. 내 사주에 그 기운이 부족하면 채워 주고, 넘치면 오히려 부담이 된다. "
                        f"그래서 같은 소품도 사람마다 맞고 안 맞고가 갈린다. 무료 4P의 첫 장에서 내 오행 비율을 먼저 확인해 보자."},
        {"t": "p", "x": f"오늘의 일진 {g['day']['hangul']}일은 {S.OHK[S.STEMS[g['day']['stem']][2]]}의 기운이 도는 날이다. "
                        f"이 기운과 {name}의 {oh}가 어떻게 만나는지도 재미로 비교해 보자."},
        cta("내 사주에 부족한 기운은 무엇일까?",
            "오행의 비율과 빈자리를 알면 어떤 소품이 나에게 맞는지 보입니다. 무료 4P."),
        disclaimer("개운 소품은 전통 상징에 따른 참고 정보입니다. 효과를 보장하지 않습니다."),
    ]
    return {
        "id": f"shop-{d.strftime('%Y%m%d')}", "cat": "shop", "img": art_for(d, "shop"),
        "time": "05:30", "views": views_for("shop", d.isoformat(), lo=4000, hi=8000),
        "title": title, "dek": dek, "writer": "정운타임즈 취재팀", "lead": lead, "body": body,
        "date": d.isoformat(), "gen": 2,
    }


# ------------------------------------------------------------------ 인물 회전
def pick_person(pool, articles, forced=None, today=None):
    people = pool["people"]
    if forced:
        for p in people:
            if p["name"] == forced:
                return p
        return None
    recent = []
    for a in sorted(articles, key=lambda x: x.get("date", ""), reverse=True):
        n = a.get("person")
        if n and n not in recent:
            recent.append(n)
        if len(recent) >= 6:
            break
    if not recent:
        return people[0]
    last = recent[0]
    idx = next((i for i, p in enumerate(people) if p["name"] == last), -1)
    for step in range(1, len(people) + 1):
        cand = people[(idx + step) % len(people)]
        if cand["name"] not in recent:
            return cand
    return people[(idx + 1) % len(people)]


# ------------------------------------------------------------------ 이미지 중복 검사
def static_image_keys():
    """정적 기사·매거진이 쓰는 이미지 이름을 모은다 (중복 검사용)."""
    out = []
    js_dir = os.path.join(ROOT, "assets", "js")
    for name in ("articles-1.js", "articles-2.js", "articles-3.js", "articles-top7.js"):
        p = os.path.join(js_dir, name)
        if not os.path.exists(p):
            continue
        s = open(p, encoding="utf-8").read()
        for aid, img in re.findall(r"id:'([^']+)',\s*cat:'[^']+',\s*img:'([^']+)'", s):
            out.append(("static:" + aid, img))
    mag = os.path.join(js_dir, "magazine.js")
    if os.path.exists(mag):
        s = open(mag, encoding="utf-8").read()
        for cid, img in re.findall(r"\{ id:'([^']+)', img:'([^']+)', kicker:", s):
            out.append(("mag:" + cid, img))
    return out


def check_images(articles, verbose=True):
    """지면 전체에서 같은 그림이 두 번 쓰이면 실패. (정적 기사 + 매거진 + 누적 기사)"""
    used = {}
    problems = []
    for key, img in static_image_keys():
        if img in used:
            problems.append(f"{used[img]} ↔ {key} ({img})")
        else:
            used[img] = key
    for a in articles:
        img = a.get("img", "")
        key = a.get("id", "?")
        if img in used:
            problems.append(f"{used[img]} ↔ {key} ({img})")
        else:
            used[img] = key
        path = os.path.join(ROOT, "assets", "img", img)
        if not os.path.exists(path):
            problems.append(f"파일 없음: {key} → {img}")
    if verbose:
        print(f"  · 그림 {len(used)}장 / 기사 {len(articles)}편 · 중복·누락 {len(problems)}건")
        for p in problems[:12]:
            print("    ! " + p)
    return problems


# ------------------------------------------------------------------ 누적·정리
def prune(articles, today):
    by_date = {}
    for a in articles:
        by_date.setdefault(a.get("date", ""), []).append(a)
    cutoff = (today - timedelta(days=MAX_DAYS - 1)).isoformat()
    kept = []
    for ds in sorted(by_date, reverse=True):
        if ds and ds < cutoff:
            continue
        kept.extend(by_date[ds])
    if len(kept) > MAX_ARTICLES:
        kept = kept[:MAX_ARTICLES]
    return kept


# ------------------------------------------------------------------ 한도
def dir_size(path):
    total = 0
    for base, dirs, files in os.walk(path):
        if ".git" in dirs:
            dirs.remove(".git")
        for f in files:
            try:
                total += os.path.getsize(os.path.join(base, f))
            except OSError:
                pass
    return total


def check_limits(extra_alerts=None):
    alerts = list(extra_alerts or [])
    size = dir_size(ROOT)
    mb = size / (1024 * 1024)
    info = {"site_size_mb": round(mb, 1), "limit_mb": SIZE_CRIT_MB,
            "bandwidth": "측정 불가 — GitHub Pages 무료 한도는 월 100GB(소프트)"}
    if mb >= SIZE_CRIT_MB:
        alerts.append({"level": "critical",
                       "msg": f"사이트 용량 {mb:.0f}MB — GitHub Pages 권장 한도(1GB)에 도달했습니다. 이미지·기사 정리가 필요합니다."})
    elif mb >= SIZE_WARN_MB:
        alerts.append({"level": "warn",
                       "msg": f"사이트 용량 {mb:.0f}MB — GitHub Pages 권장 한도(1GB)의 {mb/10:.0f}%에 이르렀습니다."})
    return alerts, info


# ------------------------------------------------------------------ 쓰기
def write_daily_js(articles, today):
    cutoff = (today - timedelta(days=DAILY_JS_DAYS - 1)).isoformat()
    recent = [a for a in articles if (a.get("date") or "") >= cutoff]
    payload = json.dumps(recent, ensure_ascii=False, separators=(",", ":"))
    text = ("/* 자동 생성 파일 — scripts/daily_update.py 가 매일 다시 씁니다. 직접 고치지 마세요.\n"
            f"   마지막 갱신: {datetime.now(S.KST).strftime('%Y-%m-%d %H:%M')} KST · 최근 {DAILY_JS_DAYS}일 {len(recent)}편\n"
            "   그 이전 호는 data/articles.json 에 보관되고, 지난 기사 지면이 필요할 때 불러옵니다. */\n"
            "const ARTICLES_DAILY = " + payload + ";\n")
    with open(DAILY_JS, "w", encoding="utf-8") as f:
        f.write(text)
    return len(recent)


def bump_service_worker():
    try:
        s = open(SW_PATH, encoding="utf-8").read()
    except OSError:
        return False
    m = re.search(r"const VERSION = 'jw-times-v(\d+)';", s)
    if m:
        nxt = int(m.group(1)) + 1
        s = s.replace(m.group(0), f"const VERSION = 'jw-times-v{nxt}';")
    if "articles-extra.js" in s:
        s = s.replace("  './assets/js/articles-extra.js',\n", "")
    with open(SW_PATH, "w", encoding="utf-8") as f:
        f.write(s)
    return True


def publish(commit_msg):
    if not os.path.isdir(os.path.join(REPO, ".git")):
        return False, f"미러 저장소가 없습니다: {REPO}"
    pull = subprocess.run(["git", "-C", REPO, "pull", "--ff-only"], capture_output=True, text=True)
    if pull.returncode != 0:
        return False, "원격 동기화 실패(다른 커밋이 있음): " + pull.stderr[-300:]
    for name in os.listdir(ROOT):
        if name in (".git",):
            continue
        src = os.path.join(ROOT, name)
        dst = os.path.join(REPO, name)
        if os.path.isdir(src):
            if os.path.isdir(dst):
                shutil.rmtree(dst)
            shutil.copytree(src, dst)
        else:
            shutil.copy2(src, dst)
    subprocess.run(["git", "-C", REPO, "add", "-A"], capture_output=True, text=True)
    diff = subprocess.run(["git", "-C", REPO, "status", "--porcelain"], capture_output=True, text=True)
    if not diff.stdout.strip():
        return True, "변경 없음(이미 최신)"
    commit = subprocess.run(["git", "-C", REPO, "-c", "user.name=hukstory",
                             "-c", "user.email=22jutimes@gmail.com", "commit", "-q", "-m", commit_msg],
                            capture_output=True, text=True)
    if commit.returncode != 0:
        return False, "commit 실패: " + commit.stderr[-300:]
    push = subprocess.run(["git", "-C", REPO, "push", "-q", "origin", "main"], capture_output=True, text=True)
    if push.returncode != 0:
        return False, "push 실패: " + push.stderr[-300:]
    head = subprocess.run(["git", "-C", REPO, "log", "-1", "--oneline"], capture_output=True, text=True)
    return True, head.stdout.strip()


# ------------------------------------------------------------------ main
def build_day(today, g, person, prev):
    return [article_today(today, g), article_person(today, g, person),
            article_money(today, g), article_dream(today, g),
            article_mbti(today, g), article_past(today, g), article_shop(today, g)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", help="YYYY-MM-DD (기본: 오늘 KST)")
    ap.add_argument("--person", help="화제의 인물 이름")
    ap.add_argument("--push", action="store_true")
    ap.add_argument("--check-only", action="store_true")
    ap.add_argument("--reset", action="store_true", help="기존 누적을 비우고 시작(새 서식으로 다시 채울 때)")
    ap.add_argument("--backfill", type=int, default=0, help="오늘 포함 최근 N일치를 새 서식으로 다시 생성")
    args = ap.parse_args()

    today = date.fromisoformat(args.date) if args.date else kst_today()
    pool = load_json(POOL_PATH, {"people": []})
    store = load_json(ART_PATH, {"schema": 1, "articles": []})
    prev = [] if args.reset else store.get("articles", [])

    if args.backfill:
        prev = [] if args.reset else [a for a in prev if (a.get("date") or "") <
                                      (today - timedelta(days=args.backfill - 1)).isoformat()]
        for i in range(args.backfill - 1, -1, -1):
            d = today - timedelta(days=i)
            g = ganji_context(d)
            same = next((a for a in prev if a.get("date") == d.isoformat() and a.get("person")), None)
            forced = args.person if (args.person and d == today) else (same.get("person") if same else None)
            person = pick_person(pool, prev, forced, d)
            if not person:
                print("인물 풀에서 대상을 찾지 못했습니다:", args.person)
                return 2
            fresh = build_day(d, g, person, prev)
            prev = [a for a in prev if a.get("date") != d.isoformat()] + fresh
            print(f"  · {d} 생성 — {person['name']} · {len(fresh)}편")
        merged = prune(prev, today)
        g = ganji_context(today)
        person = pick_person(pool, merged, args.person, today)
        fresh = [a for a in merged if a.get("date") == today.isoformat()]
    else:
        g = ganji_context(today)
        same_day = next((a for a in prev if a.get("date") == today.isoformat() and a.get("person")), None)
        forced = args.person or (same_day.get("person") if same_day else None)
        person = pick_person(pool, prev, forced, today)
        if not person:
            print("인물 풀에서 대상을 찾지 못했습니다:", args.person)
            return 2
        fresh = build_day(today, g, person, prev)
        merged = prune([a for a in prev if a.get("date") != today.isoformat()] + fresh, today)

    merged.sort(key=lambda a: (a.get("date", ""), a.get("cat", "")), reverse=True)
    days = {}
    for a in merged:
        days[a.get("date", "")] = days.get(a.get("date", ""), 0) + 1

    store_out = {
        "schema": 2,
        "site": "jeongwoon-times",
        "updated_at": datetime.now(S.KST).strftime("%Y-%m-%dT%H:%M:%S+09:00"),
        "issue": today.isoformat(),
        "ganji": g["label"],
        "retention": {"max_days": MAX_DAYS, "max_articles": MAX_ARTICLES},
        "count": len(merged),
        "days": days,
        "articles": merged,
    }

    problems = check_images(merged)
    alerts, info = check_limits(
        [{"level": "warn", "msg": f"이미지 중복·누락 {len(problems)}건: " + "; ".join(problems[:3])}] if problems else None)
    alert_out = {
        "checked_at": store_out["updated_at"],
        "site_size_mb": info["site_size_mb"],
        "alerts": alerts,
        "image_issues": problems[:20],
        "note": "이 파일은 사장님(사용자)에게만 보고하는 내부 점검 기록입니다. 지면에는 표시하지 않습니다.",
    }

    today_person = next((a.get("person") for a in merged if a.get("date") == today.isoformat() and a.get("person")), person["name"])
    print(f"[{today} {g['label']}] 인물={today_person} · 오늘 {len([a for a in merged if a.get('date')==today.isoformat()])}편 · "
          f"누적 {len(merged)}편/{len(days)}일")
    for a in [x for x in merged if x.get("date") == today.isoformat()]:
        print(f"  - {a['cat']:7s} {a['title'][:56]}")
    if alerts:
        for al in alerts:
            print(f"  ! ALERT[{al['level']}] {al['msg']}")
    else:
        print(f"  · 한도 점검: 정상 (사이트 {info['site_size_mb']}MB / 1000MB)")

    if args.check_only:
        print("(check-only: 파일을 쓰지 않았습니다)")
        return 1 if problems else 0
    if problems:
        print("이미지 중복·누락이 있어 저장하지 않았습니다. 위 목록을 고친 뒤 다시 실행하세요.")
        return 4

    save_json(ART_PATH, store_out)
    save_json(ALERT_PATH, alert_out)
    n_js = write_daily_js(merged, today)
    bump_service_worker()
    print(f"  · data/articles.json({len(merged)}편) · articles-daily.js({n_js}편) · service-worker.js 갱신")

    if args.push:
        ok, msg = publish(f"feat(daily): {today.isoformat()} 호 — 전 지면 7편 자동 발행 · 고유 일러스트 · 재미 리라이팅")
        print(("  · push 완료: " if ok else "  · push 실패: ") + msg)
        if not ok:
            return 3
    return 0


if __name__ == "__main__":
    sys.exit(main())
