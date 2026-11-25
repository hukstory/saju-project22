#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""정운타임즈 · 매일 자동 리뉴얼 (daily_update.py)

하는 일
  1) 오늘 날짜(KST)의 간지(년·월·일)를 만세력으로 계산한다.
  2) 오늘의 기사 4편을 만든다 — ① 1면 오늘의 운세 ② 화제의 인물 ③ 사주·재물 ④ 어젯밤 그 꿈.
     · 화제의 인물은 data/people.json 풀에서 매일 다음 사람으로 넘어간다(공개 생년월일 확인된 인물만).
     · 인물 기사는 그 사람의 실제 사주팔자·오행·십성·2027 세운을 계산해 쓴다.
  3) data/articles.json 에 누적한다 — 최근 60일 / 최대 120편까지만 보관(그 이전은 자동 삭제).
  4) assets/js/articles-daily.js 를 다시 써서 지면이 당일 호를 읽게 하고,
     service-worker.js 캐시 버전을 올려 방문자 브라우저의 옛 캐시를 갈아치운다.
  5) GitHub Pages 한도(저장소 1GB·월 100GB 대역폭)에 가까워지면 data/system_alerts.json 에 경고를 남긴다.
     → 이 경고는 지면에 띄우지 않고 사장님(사용자)에게만 보고하는 용도다.
  6) --push 를 주면 hukstory/saju-project22 main 에 커밋·푸시한다.

사용
  python3 scripts/daily_update.py                    # 오늘 호 생성 + 검사 (푸시 안 함)
  python3 scripts/daily_update.py --push             # 생성 후 GitHub push
  python3 scripts/daily_update.py --date 2026-11-24  # 특정 날짜 호를 만들 때
  python3 scripts/daily_update.py --person 전지윤     # 오늘 인물을 직접 지정
  python3 scripts/daily_update.py --check-only        # 파일을 쓰지 않고 계산·검사만

의존성: 표준 라이브러리만 (만세력 계산은 scripts/saju_calc.py)
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
from datetime import date, datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import saju_calc as S  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "data")
ART_PATH = os.path.join(DATA_DIR, "articles.json")
POOL_PATH = os.path.join(DATA_DIR, "people.json")
ALERT_PATH = os.path.join(DATA_DIR, "system_alerts.json")
DAILY_JS = os.path.join(ROOT, "assets", "js", "articles-daily.js")
SW_PATH = os.path.join(ROOT, "service-worker.js")
REPO = "/workspace/gh/saju-project22"

MAX_DAYS = 60
MAX_ARTICLES = 120
SIZE_WARN_MB = 800
SIZE_CRIT_MB = 1000

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
    """오행 관계 — saju_calc 와 같은 규칙. (a를 기준으로 b가 무엇인지)"""
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




def j(word, kind):
    """한국어 조사 — 받침 유무로 고른다. kind: '은' '이' '을' '과' '으로'"""
    w = str(word)
    if not w:
        return w
    ch = w[-1]
    code = ord(ch)
    if 0xAC00 <= code <= 0xD7A3:
        has_batchim = (code - 0xAC00) % 28 != 0
    else:
        has_batchim = ch in "013678mnlrMNLR"
    table = {
        "은": ("은", "는"), "이": ("이", "가"), "을": ("을", "를"),
        "과": ("과", "와"), "으로": ("으로", "로"),
    }
    with_b, without_b = table[kind]
    if kind == "으로":
        # ㄹ 받침은 '로'
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
        json.dump(obj, f, ensure_ascii=False, indent=1)
        f.write("\n")


def kst_today():
    return datetime.now(S.TZ_KST).date() if hasattr(S, "TZ_KST") else datetime.now(S.KST).date()


# ------------------------------------------------------------------ 간지 맥락
def ganji_context(d):
    ms = S.kst_to_ms(d.year, d.month, d.day, 12, 0)
    year = S.year_pillar_at(ms)
    month = S.month_pillar_at(ms, year)
    day = S.day_pillar_for_date(d.year, d.month, d.day)
    return {"ms": ms, "year": year, "month": month, "day": day,
            "label": f"{year['hanja']}年 · {month['hanja']}月 · {day['hanja']}日",
            "ymd": f"{d.year}년 {d.month}월 {d.day}일 {WD[d.weekday()]}요일"}


def next_terms(d, n=3):
    ms = S.kst_to_ms(d.year, d.month, d.day, 0, 0)
    out = []
    cursor = ms
    for _ in range(n):
        t = S.TERMS.after(cursor, jeol_only=False)
        if not t:
            break
        out.append((t["name"], S.ms_to_kst(t["ms"])))
        cursor = t["ms"] + 1000
    return out


# ------------------------------------------------------------------ ① 오늘의 운세
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
            line = "충(沖) — 큰 계약과 말다툼은 하루 미루면 부드러워진다"
        zodiac.append(f"{animal}띠 — {line}")

    good, bad = [], []
    for br, hb in HOUR_RANGE.items():
        if rel(ds[2], S.BRANCHES[br][2]) in ("give", "same", "take"):
            good.append(hb)
        if abs(br - dbranch) == 6:
            bad.append(hb)
    good_txt = ", ".join(good[:3]) if good else "09:00~10:59"
    bad_txt = ", ".join(bad[:2]) if bad else "없음"

    title = f"{d.month}월 {d.day}일 {day['hangul']}일 — {doh}의 기운이 {boh} 위로 지나갑니다"
    dek = (f"오늘의 일진은 {day['hanja']}({day['hangul']}). 천간 {ds[0]}({ds[1]})의 {doh} 기운이 "
           f"지지 {db[0]}({db[1]})의 {boh} 위에 앉았습니다. 정운타임즈가 오늘의 간지로 하루의 흐름을 세어 봤습니다.")
    lead = (f"{g['ymd']} — {g['label']}. 오늘 하루의 중심은 {doh}입니다. "
            f"{doh}{j(doh, '은')} {OH[doh]['key']}의 기운, {OH[doh]['body']}{j(OH[doh]['body'], '이')} 말하는 결입니다. "
            f"이 기운이 오늘 하루의 말과 판단에 먼저 묻어납니다.")

    body = [
        {"t": "p", "x": f"하루의 성질은 일진의 천간과 지지가 만드는 한 쌍으로 정해집니다. 간지는 60일마다 한 바퀴를 돌고, "
                        f"그 안에서 매일 결이 달라집니다. 오늘은 {day['hanja']}일, 천간은 <strong>{ds[0]}({ds[1]})</strong>입니다. "
                        f"{doh} 기운 가운데에서도 {ds[1]}{j(ds[1], '은')} {'양(陽)' if ds[3] else '음(陰)'}의 결이라, "
                        f"{'밖으로 먼저 나가려는' if ds[3] else '안에서 먼저 익히는'} 힘이 있습니다."},
        {"t": "p", "x": f"지지는 <strong>{db[0]}({db[1]})</strong>, {boh}의 자리입니다. "
                        f"천간의 {doh}{j(doh, '과')} 지지의 {boh}{j(boh, '이')} 만나 <strong>{term}</strong>의 관계가 됐습니다. {term_line}"},
        {"t": "h", "x": f"오늘의 기운 — {term}"},
        {"t": "p", "x": f"사주에서 하루의 일진은 '내 사주에 잠깐 들어오는 손님'입니다. 오늘 들어온 손님은 {doh}입니다. "
                        f"내 일간이 {doh}{j(doh, '을')} 필요로 하는 사주라면 오늘은 일이 풀리고, 이미 {doh}{j(doh, '이')} 넘치는 사주라면 "
                        f"오늘은 잠시 비워 두는 편이 낫습니다. 같은 날짜라도 사람마다 답이 다른 이유입니다."},
        {"t": "q", "x": f"“{g['label']} — 하루의 간지는 하루의 문법입니다. 문법을 알면 문장을 덜 틀립니다.” — 정운타임즈 운명연구소"},
        {"t": "h", "x": "띠별 오늘의 한 줄"},
        {"t": "ul", "x": zodiac},
        {"t": "p", "x": f"띠는 태어난 해의 지지입니다. 오늘 천간의 {doh}{j(doh, '과')} 내 띠의 오행이 어떤 관계인지로 한 줄을 세웠고, "
                        f"오늘 지지 {db[1]}{j(db[1], '과')} 정면으로 부딪히는 띠(충)는 따로 표시했습니다. "
                        f"충은 나쁜 날이 아니라, 큰 결정을 하루 미루면 훨씬 부드러워지는 날입니다."},
        {"t": "h", "x": "오늘의 시간"},
        {"t": "p", "x": f"오늘 기운이 잘 통하는 시간대는 <strong>{good_txt}</strong>입니다. "
                        f"이 시간의 시지 오행이 오늘 천간의 {doh}{j(doh, '을')} 받아 주거나 같은 결이기 때문입니다. "
                        f"반대로 <strong>{bad_txt}</strong>에는 오늘 지지와 충이 걸립니다. 계약·이사·큰 지출은 이 시간을 피해 잡으세요."},
        {"t": "p", "x": f"절기로 보면 지금은 {month['hanja']}월, 다음 절기는 {term_txt}입니다. "
                        f"월지 {month['hanja']}의 기운이 이번 달 전체의 바탕이고, 오늘의 일진은 그 위에 하루치로 얹힌 결입니다. "
                        f"하루가 안 풀릴 때 달을 보면 답이 보이는 이유입니다."},
        {"t": "p", "x": "정운타임즈의 오늘의 운세는 회원가입도, 결제도 없이 볼 수 있습니다. "
                        "내 생년월일을 넣으면 오늘의 기운을 내 사주 기준으로 다시 계산해 드립니다. "
                        "더 깊은 재물·애정·커리어의 흐름은 무료 4P에서 이어집니다."},
        {"t": "p", "x": "※ 이 기사는 만세력의 간지와 전통 명리학의 상징 해석으로 쓴 참고·오락 정보입니다. 미래의 결과를 보장하지 않습니다."},
    ]
    return {
        "id": f"today-{d.strftime('%Y%m%d')}", "cat": "today", "img": "today-main",
        "time": "05:30", "views": views_for("today", d.isoformat(), lo=22000, hi=31000),
        "title": title, "dek": dek, "writer": "정운 선임기자", "lead": lead, "body": body,
        "date": d.isoformat(), "gen": 1,
    }


# ------------------------------------------------------------------ ② 화제의 인물
def person_img(person):
    """인물 기사 썸네일 — 그 사람의 분위기에 맞춘 매거진 일러스트 이름.
    people.json 의 img 를 먼저 쓰고, 없으면 활동 분야로 고른다.
    (실존 인물의 사진·초상은 쓰지 않는다. assets/img/people-*.webp 는 전부 창작 일러스트)"""
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
    day = sj["day"]
    dstem = sj["day_stem"]
    doh = S.OHK[sj["day_oh"]]
    ds = S.STEMS[dstem]
    pillars = [sj["year"], sj["month"], sj["day"]] + ([sj["hour"]] if sj["hour"] else [])
    pil_txt = " · ".join(p["hanja"] for p in pillars)
    oh_counts = sj["oh_counts"]
    total = sum(oh_counts)
    lack = [S.OHK[i] for i, c in enumerate(oh_counts) if c == 0]
    sip = sj["sip"]
    n_jae = sip["편재"] + sip["정재"]
    n_gwan = sip["편관"] + sip["정관"]
    n_sik = sip["식신"] + sip["상관"]
    n_in = sip["편인"] + sip["정인"]
    n_bi = sip["비견"] + sip["겁재"]

    # 2027 정미년(丁未)
    y27_stem_sip = S.SIP[S.shipsin_for_stem(dstem, 3)]
    y27_branch_sip = S.SIP[S.shipsin_for_branch(dstem, 7)]
    chung = [p["hanja"] for p in pillars if abs(p["branch"] - 7) == 6]
    hap_pairs = [(0, 1), (2, 11), (3, 10), (4, 9), (5, 8), (6, 7)]
    hap = [p["hanja"] for p in pillars
           if any((a == p["branch"] and bb == 7) or (bb == p["branch"] and a == 7) for a, bb in hap_pairs)]

    # 대운 시작
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
    elif topic_date:
        topic_date_ko = topic_date.replace("-", "년 ", 1).replace("-", "월 ") + "월"

    title = f"{name}, {topic_description(person, name)}… 여섯 글자로 읽는 {OH[doh]['key']}의 사람"
    dek = (f"{name}{j(name, '은')} {person['field']}로 활동해 온 인물입니다. "
           f"공개된 프로필의 생년월일은 {b.year}년 {b.month}월 {b.day}일"
           + (f", 태어난 시각 {person['hour']}시" if person.get("hour") else ", 태어난 시각은 공개되지 않았습니다")
           + f". 정운타임즈가 만세력으로 {"여덟" if person.get("hour") else "여섯"} 글자를 세어 봤습니다 — {pil_txt}.")
    lead = ((f"{topic}. " if (topic_date_ko and topic.startswith(topic_date_ko)) else f"{(topic_date_ko + ' — ') if topic_date_ko else ''}{topic}. ")
            + f"정운타임즈는 화제의 인물을 만날 때마다 공개된 생년월일로 사주를 세어 봅니다. "
            + f"오늘의 주인공은 {name}, 일간은 {ds[0]}({ds[1]})입니다.")

    sip_lines = [f"{k} {v}자리 — {SIP_MEAN[k]}" for k, v in sip.items() if v > 0]
    body = [
        {"t": "p", "x": f"{topic}."},
        {"t": "p", "x": f"{name}의 공개 프로필에는 생년월일이 {b.year}년 {b.month}월 {b.day}일로 적혀 있습니다. "
                        + ("태어난 시각까지 공개돼 있어 여덟 글자를 모두 세울 수 있습니다." if person.get("hour")
                           else "태어난 시각은 공개돼 있지 않습니다. 그래서 여덟 글자 중 시주를 뺀 여섯 글자로 봅니다. "
                                "사주에서 시주는 말년과 자식·아랫사람의 자리라, 여섯 글자만으로도 사람의 결은 절반 이상 드러납니다.")},
        {"t": "h", "x": f"{name}의 {'여덟' if person.get('hour') else '여섯'} 글자"},
        {"t": "p", "x": f"<strong>{pil_txt}</strong> — "
                        f"년주 {sj['year']['hanja']}, 월주 {sj['month']['hanja']}, 일주 {sj['day']['hanja']}"
                        + (f", 시주 {sj['hour']['hanja']}." if sj["hour"] else ".")},
        {"t": "p", "x": f"일간은 <strong>{ds[0]}({ds[1]})</strong> — {OH[doh]['img']}입니다. "
                        f"{OH[doh]['key']}의 기운, {OH[doh]['body']}{j(OH[doh]['body'], '이')} 말하는 결입니다. "
                        f"일간은 사주에서 '나'를 뜻합니다. 여덟 글자 가운데 유일하게 바뀌지 않는 기준점입니다."},
        {"t": "p", "x": f"오행을 세어 보면 " + ", ".join(f"{S.OHK[i]} {c}개" for i, c in enumerate(oh_counts)) + "입니다. "
                        + (f"{'·'.join(lack)} 기운이 원국에 없습니다. 비어 있는 기운은 약점이 아니라, "
                           f"평생 그 자리를 스스로 만들어 채우게 되는 자리입니다." if lack
                           else "다섯 기운이 모두 자리를 잡고 있습니다. 어느 하나 크게 비어 있지 않다는 뜻입니다.")},
        {"t": "p", "x": "십성으로는 " + ", ".join(sip_lines) + "입니다. "
                        + (f"재성 {n_jae}자리, 관성 {n_gwan}자리, 식상 {n_sik}자리 — "
                           f"돈을 쥐는 별과 사람을 만나는 별, 표현하는 별이 이렇게 놓여 있습니다.")},
        {"t": "p", "x": f"배우자 자리는 일지입니다. {name}의 일지는 {sj['day']['hanja'][1]}({S.BRANCHES[sj['day']['branch']][1]}) — {S.OHK[S.BRANCHES[sj['day']['branch']][2]]}의 자리입니다. "
                        + (f"여성 사주에서 배우자를 보는 별은 관성(官星)이고, 원국에 {n_gwan}자리 있습니다. "
                           if person["gender"] == "여" else
                           f"남성 사주에서 배우자를 보는 별은 재성(財星)이고, 원국에 {n_jae}자리 있습니다. ")
                        + f"2027년 未(미)가 {y27_branch_sip}{j(y27_branch_sip, '으로')} 들어오니, 그 해의 관계 변화는 이 자리에서 먼저 읽습니다."},
        {"t": "q", "x": f"“{name}의 사주에서 가장 두터운 기운은 {S.OHK[oh_counts.index(max(oh_counts))]}. "
                        f"그 기운이 사람의 첫인상을 만듭니다.” — 정운타임즈 운명연구소"},
        {"t": "h", "x": "2027 정미년, 무엇이 들어오는가"},
        {"t": "p", "x": f"2027년은 정미년(丁未年)입니다. {name}의 일간 {ds[0]}에 丁(정)은 <strong>{y27_stem_sip}</strong>{j(y27_stem_sip, '으로')}, "
                        f"未(미)는 <strong>{y27_branch_sip}</strong>{j(y27_branch_sip, '으로')} 들어옵니다. "
                        + (f"원국에서 未와 부딪히는 자리({', '.join(chung)})가 있어, 그 해에는 자리를 옮기거나 관계를 정리하는 일이 생기기 쉽습니다. " if chung else "")
                        + (f"반대로 未와 합이 되는 자리({', '.join(hap)})가 있어, 사람을 통해 일이 풀리는 해이기도 합니다. " if hap else "")
                        + "세운은 좋고 나쁨보다 '무엇이 들어와 무엇이 흔들리는가'로 읽는 편이 정확합니다."},
        {"t": "p", "x": f"대운은 {start_age}세에 시작해 {'순행' if forward else '역행'}합니다. "
                        f"10년마다 바뀌는 큰 계절이 있고, 그 계절의 기운이 해마다의 세운과 겹치며 사람의 선택을 밀어 줍니다. "
                        f"{name}의 나이 {d.year - b.year}세는 그 계절의 어느 지점에 서 있습니다."},
        {"t": "h", "x": "화제의 인물을 사주로 읽는 이유"},
        {"t": "p", "x": f"연예인의 사주를 읽는 일은 그 사람의 선택을 판정하는 일이 아닙니다. "
                        f"공개된 생년월일이라는 작은 실마리로, 사람이 어떤 결로 세상을 통과하는지를 배우는 일입니다. "
                        f"{name}의 여섯 글자에서 읽히는 것은 {OH[doh]['key']}의 결이고, "
                        f"그 결이 무대 위에서 어떻게 쓰였는지는 대중이 이미 오래 지켜본 이야기입니다."},
        {"t": "p", "x": "정운타임즈는 인물 기사를 쓸 때마다 생년월일의 출처를 함께 적습니다. "
                        "확인되지 않은 정보로 사람의 운을 말하지 않는 것이 이 지면의 규칙입니다."},
        {"t": "p", "x": f"※ {name}의 생년월일은 공개 프로필({person.get('wiki', '')})을 기준으로 했습니다. "
                        "이 분석은 전통 명리학의 상징 해석이며, 당사자의 실제 삶·선택과 무관합니다. "
                        "미래의 결과를 보장하지 않습니다."},
    ]
    return {
        "id": f"people-{d.strftime('%Y%m%d')}", "cat": "people", "img": person_img(person),
        "time": "05:30", "views": views_for("people", d.isoformat(), lo=11000, hi=17000),
        "title": title, "dek": dek, "writer": "정운타임즈 운명연구소", "lead": lead, "body": body,
        "date": d.isoformat(), "gen": 1, "person": name,
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
    # 돈의 자리: 오늘 천간이 극하는 오행 = 오늘의 재성
    jae_oh_idx = [0, 2, 4, 1, 3]
    jae_oh = S.OHK[jae_oh_idx[(jae_oh_idx.index(ds[2]) + 1) % 5]]
    good = []
    for br, hb in HOUR_RANGE.items():
        oh = S.BRANCHES[br][2]
        if S.OHK[oh] == jae_oh or rel(oh, ds[2]) == "give":
            good.append(hb)
    title = f"{d.month}월 {d.day}일의 재물 — {doh}{j(doh, '이')} {jae_oh}{j(jae_oh, '을')} 쥐는 날"
    dek = (f"오늘 일진 {day['hanja']}의 천간은 {ds[0]}({ds[1]}), {doh}입니다. "
           f"{doh}{j(doh, '이')} 극하는 오행은 {jae_oh} — 사주에서 말하는 '재성'의 자리입니다. "
           f"오늘 돈이 움직이는 시간과 이번 달의 그릇을 정운타임즈가 세어 봤습니다.")
    lead = f"돈은 날마다 같은 속도로 움직이지 않습니다. 오늘의 간지가 어느 방향으로 재성을 여는지 봅니다."
    body = [
        {"t": "p", "x": f"사주에서 재성(財星)은 '내가 극하는 오행'입니다. 손으로 쥐고, 계산하고, 거래하는 힘입니다. "
                        f"오늘 천간의 {doh}{j(doh, '은')} {jae_oh}{j(jae_oh, '을')} 극합니다. 그래서 오늘 하루의 재성은 {jae_oh}입니다."},
        {"t": "h", "x": "오늘 돈이 움직이는 시간"},
        {"t": "p", "x": f"시지의 오행이 {jae_oh}이거나 오늘 천간의 {doh}에게 기운을 보내는 시간대가 좋습니다 — "
                        f"<strong>{', '.join(good[:3]) if good else '오전 09:00~10:59'}</strong>. "
                        f"입금 확인, 견적, 청구, 협상은 이 시간에 두는 편이 낫습니다."},
        {"t": "p", "x": f"반대로 오늘 지지 {day['hanja'][1]}{j(day['hanja'][1], '과')} 충이 되는 시간대에는 큰 지출을 미루세요. "
                        f"충은 돈이 새는 자리가 아니라, 판단이 급해지는 자리입니다."},
        {"t": "h", "x": "이번 달의 그릇"},
        {"t": "p", "x": f"이번 달의 월건은 {month['hanja']}, 월간은 {mds[0]}({mds[1]}), {moh}입니다. "
                        f"이번 달의 결정은 {moh}{j(moh, '으로')} 판단됩니다 — {OH[moh]['key']}의 결로 읽는 달입니다. "
                        f"{OH[moh]['key']}{j(OH[moh]['key'], '이')} 강한 달에는 그 방향의 일이 유독 잘 풀리고, 반대 방향은 자꾸 미끄러집니다."},
        {"t": "ul", "x": [
            f"들어올 돈은 오전에 확인하세요. 미루면 다음 달로 넘어갑니다.",
            f"오늘의 재성은 {jae_oh} — {OH[jae_oh]['key']}{j(OH[jae_oh]['key'], '과')} 관계된 지출(도구·배움·이동)이 남는 지출입니다.",
            f"사람에게 돈을 빌려주는 약속은 오늘 하지 않는 편이 좋습니다.",
        ]},
        {"t": "q", "x": "“재물운은 그릇의 크기보다, 그릇에 물을 붓는 시기의 문제입니다.” — 정운타임즈 운명연구소"},
        {"t": "h", "x": "2027 정미년의 재물"},
        {"t": "p", "x": "2027년은 정미년(丁未年)입니다. 丁은 火, 未는 土 — 불이 흙을 낳는 해입니다. "
                        "화생토(火生土)의 해는 벌이는 힘보다 쌓는 힘이 강해지는 해입니다. "
                        "큰 판을 새로 여는 것보다, 이미 가진 것을 단단히 굳히는 쪽이 남습니다."},
        {"t": "p", "x": "정운타임즈의 재물 기사는 오늘의 간지와 절기만으로 씁니다. "
                        "내 사주에서 재성이 어디에 놓였는지는 무료 4P에서 여덟 글자로 확인할 수 있습니다."},
        {"t": "p", "x": "※ 이 기사는 전통 명리학의 상징 해석으로 쓴 참고·오락 정보입니다. 투자·금융 판단의 근거가 될 수 없습니다."},
    ]
    return {
        "id": f"money-{d.strftime('%Y%m%d')}", "cat": "money", "img": "money-main",
        "time": "05:30", "views": views_for("money", d.isoformat(), lo=6000, hi=10000),
        "title": title, "dek": dek, "writer": "정운 선임기자", "lead": lead, "body": body,
        "date": d.isoformat(), "gen": 1,
    }


# ------------------------------------------------------------------ ④ 어젯밤 그 꿈
DREAM_OF = {
    "쥐": ("쥐가 곡식 창고로 들어가는 꿈", "재물이 작은 통로로 들어온다는 옛 해석이 있습니다. 큰돈보다 잔돈이 먼저 움직이는 시기입니다."),
    "소": ("소가 마당에 서 있는 꿈", "소는 부지런함과 재산의 상징입니다. 일이 느려 보여도 끝까지 가는 쪽이 남습니다."),
    "호랑이": ("호랑이가 집 앞을 지나가는 꿈", "권위와 두려움이 함께 오는 상징입니다. 큰 사람을 만나게 되거나, 큰 결정을 앞두게 됩니다."),
    "토끼": ("토끼가 달 아래로 뛰어가는 꿈", "민첩함과 도피의 상징입니다. 미뤄 둔 일을 작게라도 시작하면 풀립니다."),
    "용": ("용이 구름을 타고 오르는 꿈", "큰 흐름을 타는 상징입니다. 오래 미뤄 둔 제안을 꺼내기 좋은 때입니다."),
    "뱀": ("뱀이 허물을 벗는 꿈", "국면 전환의 상징입니다. 끝난 일을 정리하면 다음 문이 열립니다."),
    "말": ("말이 달리는 꿈", "속도와 이동의 상징입니다. 계획을 앞당기면 좋고, 서두르면 흔들립니다."),
    "양": ("양 떼가 언덕에 있는 꿈", "온순함과 무리의 상징입니다. 혼자보다 여럿이 움직일 때 일이 됩니다."),
    "원숭이": ("원숭이가 나무를 오르는 꿈", "재주와 요령의 상징입니다. 머리로 푸는 일이 손으로 푸는 일보다 빠릅니다."),
    "닭": ("닭이 새벽에 우는 꿈", "때를 알리는 상징입니다. 미뤄 둔 연락을 지금 하는 것이 좋습니다."),
    "개": ("개가 문을 지키는 꿈", "신뢰와 경계의 상징입니다. 사람을 가려야 할 시기입니다."),
    "돼지": ("돼지가 집으로 들어오는 꿈", "재물과 복의 상징입니다. 오래전부터 가장 좋은 꿈으로 꼽혀 왔습니다."),
}


def article_dream(d, g):
    animal = ANIMALS[g["day"]["branch"]]
    dream, mean = DREAM_OF[animal]
    db = S.BRANCHES[g["day"]["branch"]]
    title = f"{dream} — 오늘 {animal}의 상징이 뜨는 이유"
    dek = (f"오늘의 일지(日支)는 {db[0]}({db[1]}), {animal}입니다. 옛 꿈사전은 {animal}{j(animal, '을')} 어떻게 적어 두었을까요. "
           f"정운타임즈가 오늘의 지지로 꿈 상징 하나를 골랐습니다.")
    lead = f"{mean}"
    body = [
        {"t": "p", "x": f"꿈 해석의 출발은 간지입니다. 오늘의 일지가 {db[0]}({db[1]})이니, 오늘 밤의 상징은 {animal}입니다. "
                        f"옛 사람들은 하루의 지지를 그날의 동물로 읽었고, 그 동물이 꿈에 나타나면 그날의 기운이 꿈으로 새어 나온다고 여겼습니다."},
        {"t": "h", "x": f"{animal} — {dream}"},
        {"t": "p", "x": f"{mean}"},
        {"t": "p", "x": f"{animal}의 오행은 {S.OHK[db[2]]}, {OH[S.OHK[db[2]]]['key']}의 결입니다. "
                        f"{animal}의 오행 {S.OHK[db[2]]}는 오늘 천간 {g['day']['hanja'][0]}의 기운과 만나 "
                        f"\"{REL_LINE[rel(S.STEMS[g['day']['stem']][2], db[2])]}\"로 읽힙니다."},
        {"t": "q", "x": "“꿈은 미래의 예고가 아니라, 오늘 내가 미처 말하지 못한 것의 언어입니다.” — 정운타임즈 운명연구소"},
        {"t": "h", "x": "꿈을 기억하려면"},
        {"t": "ul", "x": [
            "잠에서 깬 직후 30초가 가장 선명합니다. 휴대폰 대신 한 단어라도 적어 두세요.",
            "꿈에 나온 사람의 이름보다, 그 사람에게 느낀 감정을 먼저 적습니다.",
            "같은 상징이 반복되면 그 꿈은 예고가 아니라 숙제입니다.",
        ]},
        {"t": "p", "x": "정운타임즈의 꿈 지면은 매일 오늘의 지지로 상징 하나를 골라 짧게 적습니다. "
                        "긴 해석이 필요하면 무료 1분 분석의 꿈 탭에서 단어로 찾아볼 수 있습니다."},
        {"t": "p", "x": "※ 꿈 해석은 전통 상징과 심리학적 해석을 섞은 참고 정보입니다. 의료·심리 상담을 대신하지 않습니다."},
    ]
    return {
        "id": f"dream-{d.strftime('%Y%m%d')}", "cat": "dream", "img": "dream-main",
        "time": "05:30", "views": views_for("dream", d.isoformat(), lo=5000, hi=9000),
        "title": title, "dek": dek, "writer": "정운타임즈 취재팀", "lead": lead, "body": body,
        "date": d.isoformat(), "gen": 1,
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


# ------------------------------------------------------------------ 한도 검사
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
            "bandwidth": "측정 불가(방문자 분석 없음) — GitHub Pages 무료 한도는 월 100GB(소프트)"}
    if mb >= SIZE_CRIT_MB:
        alerts.append({"level": "critical",
                       "msg": f"사이트 용량 {mb:.0f}MB — GitHub Pages 권장 한도(1GB)에 도달했습니다. 이미지·기사 정리가 필요합니다."})
    elif mb >= SIZE_WARN_MB:
        alerts.append({"level": "warn",
                       "msg": f"사이트 용량 {mb:.0f}MB — GitHub Pages 권장 한도(1GB)의 {mb/10:.0f}%에 이르렀습니다."})
    return alerts, info


# ------------------------------------------------------------------ 쓰기
def write_daily_js(articles):
    payload = json.dumps(articles, ensure_ascii=False, separators=(",", ":"))
    text = ("/* 자동 생성 파일 — scripts/daily_update.py 가 매일 다시 씁니다. 직접 고치지 마세요.\n"
            f"   마지막 갱신: {datetime.now(S.KST).strftime('%Y-%m-%d %H:%M')} KST · 기사 {len(articles)}편 */\n"
            "const ARTICLES_DAILY = " + payload + ";\n")
    with open(DAILY_JS, "w", encoding="utf-8") as f:
        f.write(text)


def bump_service_worker(build_id):
    try:
        s = open(SW_PATH, encoding="utf-8").read()
    except OSError:
        return False
    import re
    m = re.search(r"const VERSION = 'jw-times-v(\d+)';", s)
    if m:
        nxt = int(m.group(1)) + 1
        s = s.replace(m.group(0), f"const VERSION = 'jw-times-v{nxt}';")
    if "articles-daily.js" not in s:
        s = s.replace("  './assets/js/articles-extra.js',",
                      "  './assets/js/articles-extra.js',\n  './assets/js/articles-daily.js',")
    with open(SW_PATH, "w", encoding="utf-8") as f:
        f.write(s)
    return True


def publish(commit_msg):
    """워크스페이스 사이트 → GitHub 저장소 미러 → commit & push"""
    if not os.path.isdir(os.path.join(REPO, ".git")):
        os.makedirs(os.path.dirname(REPO), exist_ok=True)
        r = subprocess.run(["git", "clone", "https://github.com/hukstory/saju-project22.git", REPO],
                           capture_output=True, text=True)
        if r.returncode != 0:
            return False, "clone 실패: " + r.stderr[-300:]
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
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", help="YYYY-MM-DD (기본: 오늘 KST)")
    ap.add_argument("--person", help="화제의 인물 이름 (기본: 풀에서 자동 회전)")
    ap.add_argument("--push", action="store_true", help="GitHub main 에 커밋·푸시")
    ap.add_argument("--check-only", action="store_true", help="파일을 쓰지 않고 계산만")
    args = ap.parse_args()

    today = date.fromisoformat(args.date) if args.date else kst_today()
    g = ganji_context(today)
    pool = load_json(POOL_PATH, {"people": []})
    store = load_json(ART_PATH, {"schema": 1, "articles": []})
    prev = store.get("articles", [])

    # 같은 날짜를 다시 만들 때는 그날 이미 쓴 인물을 그대로 쓴다(재실행해도 인물이 바뀌지 않게)
    same_day = next((a for a in prev if a.get("date") == today.isoformat() and a.get("person")), None)
    forced = args.person or (same_day.get("person") if same_day else None)
    person = pick_person(pool, prev, forced, today)
    if not person:
        print("인물 풀에서 대상을 찾지 못했습니다:", args.person)
        return 2

    fresh = [article_today(today, g), article_person(today, g, person),
             article_money(today, g), article_dream(today, g)]

    # 같은 날짜 기사는 새로 만든 것으로 교체
    merged = [a for a in prev if a.get("date") != today.isoformat()] + fresh
    merged = prune(merged, today)
    merged.sort(key=lambda a: (a.get("date", ""), a.get("cat", "")), reverse=True)

    days = {}
    for a in merged:
        days[a.get("date", "")] = days.get(a.get("date", ""), 0) + 1

    store_out = {
        "schema": 1,
        "site": "jeongwoon-times",
        "updated_at": datetime.now(S.KST).strftime("%Y-%m-%dT%H:%M:%S+09:00"),
        "issue": today.isoformat(),
        "ganji": g["label"],
        "retention": {"max_days": MAX_DAYS, "max_articles": MAX_ARTICLES},
        "count": len(merged),
        "days": days,
        "articles": merged,
    }

    alerts, info = check_limits()
    alert_out = {
        "checked_at": store_out["updated_at"],
        "site_size_mb": info["site_size_mb"],
        "alerts": alerts,
        "note": "이 파일은 사장님(사용자)에게만 보고하는 내부 점검 기록입니다. 지면에는 표시하지 않습니다.",
    }

    print(f"[{today} {g['label']}] 인물={person['name']} · 기사 {len(fresh)}편 생성 · 누적 {len(merged)}편/{len(days)}일")
    for a in fresh:
        print(f"  - {a['cat']:7s} {a['title'][:60]}")
    if alerts:
        for al in alerts:
            print(f"  ! ALERT[{al['level']}] {al['msg']}")
    else:
        print(f"  · 한도 점검: 정상 (사이트 {info['site_size_mb']}MB / 1000MB)")

    if args.check_only:
        print("(check-only: 파일을 쓰지 않았습니다)")
        return 0

    save_json(ART_PATH, store_out)
    save_json(ALERT_PATH, alert_out)
    write_daily_js(merged)
    bump_service_worker(today.isoformat())
    print("  · data/articles.json · assets/js/articles-daily.js · service-worker.js 갱신")

    if args.push:
        ok, msg = publish(f"chore(daily): {today.isoformat()} 호 자동 리뉴얼 — {person['name']}")
        print(("  · push 완료: " if ok else "  · push 실패: ") + msg)
        if not ok:
            return 3
    return 0


if __name__ == "__main__":
    sys.exit(main())
