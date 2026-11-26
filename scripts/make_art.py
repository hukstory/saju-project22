#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""정운타임즈 · 기사 전용 일러스트 생성기 (make_art.py) — 2026-11-26 개편

무엇이 달라졌나
  · 달(moon) 위주의 풍경화를 걷어내고, 기사 주제에 맞는 **사람(초상·실루엣)과
    구체적 사물(엽전·서찰·열쇠·달력·나침반·거북·모래시계 등)**을 크게 그린다.
  · 그림 하나에 장면 하나 — 기사 키로 장면을 고르고, 같은 장면이라도 키 해시에
    따라 인물·소품·색·구도를 달리해 매일 다른 그림이 나온다.
  · 외부 API·유료 이미지 없음. 표준 라이브러리만. 결정적(deterministic).
  · 1200×675 (16:9) — 카드 썸네일·기사 대표 그림·매거진 카드에 모두 맞는다.

사용
  python3 scripts/make_art.py --keys money-2027 today-1122
  python3 scripts/make_art.py --all            # assets/img/g/*.svg 전부 다시 그리기
  (daily_update.py 는 ensure() 를 직접 불러 그날 기사 그림을 만든다)
"""
from __future__ import annotations

import argparse
import glob
import hashlib
import math
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART_DIR = os.path.join(ROOT, "assets", "img", "g")

W, H = 1200, 675

# ---------------------------------------------------------------- 팔레트
PALS = [
    dict(paper=("#fdf8ec", "#f1e4c7"), ink="#1e1a14", gold="#b98a3e", red="#b3261e", soft="#e9ddc0"),
    dict(paper=("#f1f5ed", "#d9e6dc"), ink="#1b2a24", gold="#8f9a63", red="#ad2f28", soft="#d0ddcf"),
    dict(paper=("#eef2f8", "#d8e1ef"), ink="#1b2233", gold="#a8904f", red="#b3261e", soft="#cfd8e7"),
    dict(paper=("#fcf1e9", "#f1dccb"), ink="#2a1d18", gold="#b3703f", red="#b3261e", soft="#eed6c1"),
    dict(paper=("#f7f3e9", "#e5dcc9"), ink="#20201d", gold="#9a8a5c", red="#a8322a", soft="#ded4be"),
    dict(paper=("#f8f4e7", "#e7dbc3"), ink="#221c15", gold="#c09a4a", red="#8f1d17", soft="#e4d7ba"),
    dict(paper=("#eef3f0", "#d6e2dd"), ink="#16241f", gold="#8ca896", red="#a8322a", soft="#cddad4"),
]

HAIRS = ["topknot", "bun", "short", "bob", "gat", "band"]


def _h(key: str) -> int:
    return int(hashlib.sha256(str(key).encode("utf-8")).hexdigest()[:16], 16)


class Rng:
    """씨앗 고정 난수 — 같은 키면 같은 그림."""

    def __init__(self, seed: int):
        self.s = seed & 0xFFFFFFFFFFFFFFFF

    def n(self) -> int:
        self.s = (self.s * 6364136223846793005 + 1442695040888963407) & 0xFFFFFFFFFFFFFFFF
        return (self.s >> 17) & 0xFFFFFFFF

    def r(self, a=0.0, b=1.0) -> float:
        return a + (b - a) * (self.n() / 0xFFFFFFFF)

    def i(self, a, b) -> int:
        return int(self.r(a, b + 0.499))

    def pick(self, seq):
        return seq[self.n() % len(seq)]

    def chance(self, p: float) -> bool:
        return self.r() < p


# ---------------------------------------------------------------- 도형 도우미
def _d(v: float) -> str:
    return f"{v:.1f}"


def path(d, fill="none", stroke="ink", w=6, op=None, dash=None, cap="round"):
    s = (f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{w}" '
         f'stroke-linecap="{cap}" stroke-linejoin="round"')
    if op is not None:
        s += f' opacity="{op}"'
    if dash:
        s += f' stroke-dasharray="{dash}"'
    return s + "/>"


def circle(cx, cy, r, fill="none", stroke="ink", w=6, op=None):
    s = f'<circle cx="{_d(cx)}" cy="{_d(cy)}" r="{_d(r)}" fill="{fill}" stroke="{stroke}" stroke-width="{w}"'
    if op is not None:
        s += f' opacity="{op}"'
    return s + "/>"


def ellipse(cx, cy, rx, ry, fill="none", stroke="ink", w=6, op=None, rot=None):
    s = (f'<ellipse cx="{_d(cx)}" cy="{_d(cy)}" rx="{_d(rx)}" ry="{_d(ry)}" '
         f'fill="{fill}" stroke="{stroke}" stroke-width="{w}"')
    if op is not None:
        s += f' opacity="{op}"'
    if rot is not None:
        s += f' transform="rotate({_d(rot)} {_d(cx)} {_d(cy)})"'
    return s + "/>"


def rect(x, y, w_, h_, fill="none", stroke="ink", w=6, rx=0, op=None):
    s = (f'<rect x="{_d(x)}" y="{_d(y)}" width="{_d(w_)}" height="{_d(h_)}" rx="{_d(rx)}" '
         f'fill="{fill}" stroke="{stroke}" stroke-width="{w}"')
    if op is not None:
        s += f' opacity="{op}"'
    return s + "/>"


def line(x1, y1, x2, y2, stroke="ink", w=6, op=None, dash=None, cap="round"):
    s = (f'<line x1="{_d(x1)}" y1="{_d(y1)}" x2="{_d(x2)}" y2="{_d(y2)}" '
         f'stroke="{stroke}" stroke-width="{w}" stroke-linecap="{cap}"')
    if op is not None:
        s += f' opacity="{op}"'
    if dash:
        s += f' stroke-dasharray="{dash}"'
    return s + "/>"


def text(x, y, s, size=40, fill="ink", anchor="middle", weight=700, family="monospace", op=None):
    st = (f'<text x="{_d(x)}" y="{_d(y)}" font-family="{family}" font-size="{size}" '
          f'font-weight="{weight}" text-anchor="{anchor}" fill="{fill}"')
    if op is not None:
        st += f' opacity="{op}"'
    return st + f">{s}</text>"


def seal(cx, cy, s, pal, op=0.92):
    """빨간 낙관 — '正運' 대신 획 두 줄로 새긴다(폰트 의존 없음)."""
    ink, red = pal["ink"], pal["red"]
    half = s / 2
    return "".join([
        rect(cx - half, cy - half, s, s, fill=red, stroke=ink, w=3, rx=s * 0.08, op=op),
        line(cx - half * 0.5, cy - half * 0.18, cx + half * 0.5, cy - half * 0.18, stroke="#f8e9cd", w=s * 0.1),
        line(cx - half * 0.18, cy - half * 0.5, cx - half * 0.18, cy + half * 0.5, stroke="#f8e9cd", w=s * 0.1),
        line(cx + half * 0.22, cy - half * 0.02, cx + half * 0.22, cy + half * 0.5, stroke="#f8e9cd", w=s * 0.1),
    ])


# ---------------------------------------------------------------- 인물
def bust(cx, base_y, r=120, hair="bun", face="calm", pal=None, tilt=0.0, w=6.0, garment="soft"):
    """가슴 위 초상 — 눈을 감은 최소 표정. 같은 사람이 반복되지 않게 머리 모양을 바꾼다."""
    ink, gold, red, soft = pal["ink"], pal["gold"], pal["red"], pal["soft"]
    ry = r * 1.1
    cyh = base_y - r * 2.0
    neck_y = cyh + ry * 0.9
    sw = r * 2.95
    g = [f'<g transform="rotate({_d(tilt)} {_d(cx)} {_d(base_y)})">']

    # 뒤 머리
    if hair in ("bun", "bob", "short", "band", "turban"):
        g.append(ellipse(cx, cyh - r * 0.04, r * 1.05, ry * 1.01, fill=ink, stroke=ink, w=w * 0.7, op=0.92))

    # 몸
    body = (f"M {_d(cx - sw / 2)} {_d(base_y + 4)} "
            f"C {_d(cx - sw / 2)} {_d(base_y - r * 0.92)} {_d(cx - r * 0.9)} {_d(neck_y + r * 0.12)} {_d(cx)} {_d(neck_y + r * 0.12)} "
            f"C {_d(cx + r * 0.9)} {_d(neck_y + r * 0.12)} {_d(cx + sw / 2)} {_d(base_y - r * 0.92)} {_d(cx + sw / 2)} {_d(base_y + 4)} Z")
    g.append(path(body, fill=soft, stroke=ink, w=w))
    # 옷깃
    g.append(path(f"M {_d(cx - r * 0.66)} {_d(neck_y + r * 0.16)} C {_d(cx - r * 0.22)} {_d(neck_y + r * 0.66)} "
                  f"{_d(cx + r * 0.04)} {_d(neck_y + r * 0.9)} {_d(cx + r * 0.08)} {_d(base_y)}",
                  stroke=ink, w=w * 0.6, op=0.85))
    g.append(path(f"M {_d(cx + r * 0.66)} {_d(neck_y + r * 0.16)} C {_d(cx + r * 0.26)} {_d(neck_y + r * 0.64)} "
                  f"{_d(cx + r * 0.0)} {_d(neck_y + r * 0.9)} {_d(cx - r * 0.04)} {_d(base_y)}",
                  stroke=ink, w=w * 0.6, op=0.5))
    # 목
    g.append(rect(cx - r * 0.3, neck_y - r * 0.06, r * 0.6, r * 0.42,
                  fill=pal["paper"][0], stroke="none", w=0))
    g.append(line(cx - r * 0.3, neck_y - r * 0.04, cx - r * 0.3, neck_y + r * 0.34, stroke=ink, w=w * 0.65, op=0.85))
    g.append(line(cx + r * 0.3, neck_y - r * 0.04, cx + r * 0.3, neck_y + r * 0.34, stroke=ink, w=w * 0.65, op=0.85))

    # 얼굴
    g.append(ellipse(cx, cyh, r, ry, fill=pal["paper"][0], stroke=ink, w=w))
    # 앞머리
    g.append(path(f"M {_d(cx - r * 0.94)} {_d(cyh - ry * 0.3)} C {_d(cx - r * 0.74)} {_d(cyh - ry * 1.1)} "
                  f"{_d(cx + r * 0.74)} {_d(cyh - ry * 1.1)} {_d(cx + r * 0.94)} {_d(cyh - ry * 0.3)} "
                  f"C {_d(cx + r * 0.5)} {_d(cyh - ry * 0.86)} {_d(cx - r * 0.5)} {_d(cyh - ry * 0.86)} "
                  f"{_d(cx - r * 0.94)} {_d(cyh - ry * 0.3)} Z", fill=ink, stroke=ink, w=w * 0.5, op=0.94))
    ex, ey = r * 0.37, cyh + ry * 0.06
    for sx in (-1, 1):
        g.append(path(f"M {_d(cx + sx * ex - r * 0.15)} {_d(ey)} q {_d(r * 0.15)} {_d(r * 0.13)} {_d(r * 0.3)} 0",
                      stroke=ink, w=w * 0.85))
    g.append(path(f"M {_d(cx)} {_d(cyh + ry * 0.24)} q {_d(r * 0.09)} {_d(r * 0.14)} {-r * 0.02:.1f} {_d(r * 0.18)}",
                  stroke=ink, w=w * 0.55, op=0.7))
    if face == "smile":
        g.append(path(f"M {_d(cx - r * 0.19)} {_d(cyh + ry * 0.5)} q {_d(r * 0.19)} {_d(r * 0.15)} {_d(r * 0.38)} 0",
                      stroke=ink, w=w * 0.8))
    else:
        g.append(line(cx - r * 0.13, cyh + ry * 0.5, cx + r * 0.15, cyh + ry * 0.5, stroke=ink, w=w * 0.7))
    for sx in (-1, 1):
        g.append(circle(cx + sx * r * 0.6, cyh + ry * 0.36, r * 0.06, fill=gold, stroke=gold, w=1, op=0.85))

    # 머리 모양별 디테일
    if hair == "bun":
        g.append(circle(cx - r * 0.95, cyh - ry * 0.5, r * 0.32, fill=ink, stroke=ink, w=w * 0.6))
        g.append(circle(cx + r * 0.95, cyh - ry * 0.36, r * 0.2, fill=ink, stroke=ink, w=w * 0.5, op=0.85))
    elif hair == "bob":
        for sx in (-1, 1):
            g.append(path(f"M {_d(cx + sx * r * 1.02)} {_d(cyh - ry * 0.1)} C {_d(cx + sx * r * 1.24)} {_d(cyh + ry * 0.8)} "
                          f"{_d(cx + sx * r * 0.86)} {_d(cyh + ry * 1.14)} {_d(cx + sx * r * 0.62)} {_d(cyh + ry * 1.06)}",
                          stroke=ink, w=r * 0.46))
    elif hair == "topknot":
        g.append(path(f"M {_d(cx - r * 0.9)} {_d(cyh - ry * 0.44)} C {_d(cx - r * 0.66)} {_d(cyh - ry * 1.46)} "
                      f"{_d(cx + r * 0.66)} {_d(cyh - ry * 1.46)} {_d(cx + r * 0.9)} {_d(cyh - ry * 0.44)} Z",
                      fill=ink, stroke=ink, w=w * 0.7))
        g.append(rect(cx - r * 0.16, cyh - ry * 1.24, r * 0.32, r * 0.2, fill=ink, stroke=ink, w=w * 0.4))
        g.append(circle(cx, cyh - ry * 1.38, r * 0.24, fill=ink, stroke=ink, w=w * 0.5))
        g.append(path(f"M {_d(cx - r * 0.02)} {_d(cyh - ry * 1.5)} q {_d(r * 0.14)} {_d(-r * 0.22)} {_d(r * 0.3)} {_d(-r * 0.3)}",
                      stroke=ink, w=w * 0.45))
    elif hair == "band":
        g.append(path(f"M {_d(cx - r * 1.02)} {_d(cyh - ry * 0.44)} L {_d(cx + r * 1.02)} {_d(cyh - ry * 0.44)}",
                      stroke=gold, w=w * 1.1))
        g.append(circle(cx, cyh - ry * 0.44, r * 0.09, fill=gold, stroke=ink, w=w * 0.4))
    elif hair == "gat":
        g.append(ellipse(cx, cyh - ry * 0.86, r * 1.9, r * 0.28, fill=ink, stroke=ink, w=w * 0.6))
        g.append(path(f"M {_d(cx - r * 0.62)} {_d(cyh - ry * 0.92)} C {_d(cx - r * 0.56)} {_d(cyh - ry * 1.82)} "
                      f"{_d(cx + r * 0.56)} {_d(cyh - ry * 1.82)} {_d(cx + r * 0.62)} {_d(cyh - ry * 0.92)} Z",
                      fill=ink, stroke=ink, w=w * 0.6))
        g.append(line(cx - r * 0.46, cyh - ry * 1.14, cx + r * 0.46, cyh - ry * 1.14, stroke=gold, w=w * 0.45, op=0.7))
    elif hair == "turban":
        g.append(path(f"M {_d(cx - r * 1.06)} {_d(cyh - ry * 0.36)} C {_d(cx - r * 0.9)} {_d(cyh - ry * 1.4)} "
                      f"{_d(cx + r * 0.9)} {_d(cyh - ry * 1.4)} {_d(cx + r * 1.06)} {_d(cyh - ry * 0.36)} Z",
                      fill=soft, stroke=ink, w=w * 0.7))
        for k in range(3):
            g.append(path(f"M {_d(cx - r * 0.92)} {_d(cyh - ry * (0.52 + 0.2 * k))} q {_d(r * 0.9)} {_d(-r * 0.12)} {_d(r * 1.84)} 0",
                          stroke=ink, w=w * 0.45, op=0.55))
    g.append("</g>")
    return "".join(g)


# ---------------------------------------------------------------- 사물
def coin(cx, cy, r, pal, w=5):
    ink, gold = pal["ink"], pal["gold"]
    return "".join([circle(cx, cy, r, fill=pal["paper"][0], stroke=ink, w=w),
                    circle(cx, cy, r * 0.78, fill="none", stroke=gold, w=w * 0.7, op=0.95),
                    rect(cx - r * 0.28, cy - r * 0.28, r * 0.56, r * 0.56,
                         fill=pal["paper"][1], stroke=ink, w=w * 0.7)])


def purse(cx, cy, w_, pal):
    """복주머니 — 조인 목, 부푼 자루, 짧은 끈."""
    ink, gold, red = pal["ink"], pal["gold"], pal["red"]
    h = w_ * 1.08
    top = cy - h * 0.46
    neck = cy - h * 0.26
    body = (f"M {_d(cx - w_ * 0.17)} {_d(top)} "
            f"C {_d(cx - w_ * 0.2)} {_d(neck)} {_d(cx - w_ * 0.4)} {_d(cy - h * 0.08)} {_d(cx - w_ * 0.44)} {_d(cy + h * 0.14)} "
            f"C {_d(cx - w_ * 0.47)} {_d(cy + h * 0.52)} {_d(cx - w_ * 0.24)} {_d(cy + h * 0.62)} {_d(cx)} {_d(cy + h * 0.62)} "
            f"C {_d(cx + w_ * 0.24)} {_d(cy + h * 0.62)} {_d(cx + w_ * 0.47)} {_d(cy + h * 0.52)} {_d(cx + w_ * 0.44)} {_d(cy + h * 0.14)} "
            f"C {_d(cx + w_ * 0.4)} {_d(cy - h * 0.08)} {_d(cx + w_ * 0.2)} {_d(neck)} {_d(cx + w_ * 0.17)} {_d(top)} Z")
    return "".join([
        path(body, fill=red, stroke=ink, w=5, op=0.9),
        # 조임끈
        rect(cx - w_ * 0.19, top - h * 0.06, w_ * 0.38, h * 0.1, fill=gold, stroke=ink, w=4, rx=4),
        circle(cx, top - h * 0.1, w_ * 0.05, fill=gold, stroke=ink, w=3),

        # 자루 표식
        circle(cx, cy + h * 0.2, w_ * 0.19, fill=gold, stroke=ink, w=4, op=0.95),
        circle(cx, cy + h * 0.2, w_ * 0.1, fill="none", stroke=ink, w=3, op=0.55),
    ])


def ingot(cx, cy, w_, pal):
    ink, gold = pal["ink"], pal["gold"]
    h = w_ * 0.58
    d = (f"M {_d(cx - w_ / 2)} {_d(cy)} "
         f"C {_d(cx - w_ / 2)} {_d(cy + h * 0.8)} {_d(cx - w_ * 0.2)} {_d(cy + h)} {_d(cx)} {_d(cy + h)} "
         f"C {_d(cx + w_ * 0.2)} {_d(cy + h)} {_d(cx + w_ / 2)} {_d(cy + h * 0.8)} {_d(cx + w_ / 2)} {_d(cy)} "
         f"C {_d(cx + w_ * 0.26)} {_d(cy - h * 0.36)} {_d(cx - w_ * 0.26)} {_d(cy - h * 0.36)} {_d(cx - w_ / 2)} {_d(cy)} Z")
    return path(d, fill=gold, stroke=ink, w=5, op=0.95) + \
        path(f"M {_d(cx - w_ * 0.24)} {_d(cy + h * 0.2)} C {_d(cx - w_ * 0.1)} {_d(cy - h * 0.04)} "
             f"{_d(cx + w_ * 0.1)} {_d(cy - h * 0.04)} {_d(cx + w_ * 0.24)} {_d(cy + h * 0.2)}",
             stroke="#fdf6e4", w=4, op=0.8)


def abacus(x, y, w_, h_, pal, cols=4, rows=3):
    """주판 — 테두리와 세로 막대, 구슬."""
    ink, gold, red = pal["ink"], pal["gold"], pal["red"]
    out = [rect(x, y, w_, h_, fill=pal["paper"][0], stroke=ink, w=7, rx=8),
           rect(x + 14, y + 14, w_ - 28, h_ - 28, fill="none", stroke=ink, w=3, op=0.35),
           line(x + 14, y + h_ * 0.34, x + w_ - 14, y + h_ * 0.34, stroke=ink, w=5)]
    for c in range(cols):
        cx = x + w_ * (c + 0.5) / cols
        out.append(line(cx, y + 14, cx, y + h_ - 14, stroke=ink, w=4, op=0.55))
        for r in range(rows):
            by = y + h_ * (0.2 + r * 0.26 + (0.04 if c % 2 else 0))
            out.append(circle(cx, by, h_ * 0.085, fill=(red if r == 0 else gold), stroke=ink, w=3))
    return "".join(out)


def book_open(cx, cy, w_, pal, w=5):
    ink, gold = pal["ink"], pal["gold"]
    h = w_ * 0.56
    out = [path(f"M {_d(cx)} {_d(cy - h * 0.4)} C {_d(cx - w_ * 0.18)} {_d(cy - h * 0.56)} "
                f"{_d(cx - w_ * 0.42)} {_d(cy - h * 0.5)} {_d(cx - w_ / 2)} {_d(cy - h * 0.34)} "
                f"L {_d(cx - w_ / 2)} {_d(cy + h * 0.56)} "
                f"C {_d(cx - w_ * 0.4)} {_d(cy + h * 0.42)} {_d(cx - w_ * 0.16)} {_d(cy + h * 0.46)} {_d(cx)} {_d(cy + h * 0.58)} Z",
                fill=pal["paper"][0], stroke=ink, w=w),
           path(f"M {_d(cx)} {_d(cy - h * 0.4)} C {_d(cx + w_ * 0.18)} {_d(cy - h * 0.56)} "
                f"{_d(cx + w_ * 0.42)} {_d(cy - h * 0.5)} {_d(cx + w_ / 2)} {_d(cy - h * 0.34)} "
                f"L {_d(cx + w_ / 2)} {_d(cy + h * 0.56)} "
                f"C {_d(cx + w_ * 0.4)} {_d(cy + h * 0.42)} {_d(cx + w_ * 0.16)} {_d(cy + h * 0.46)} {_d(cx)} {_d(cy + h * 0.58)} Z",
                fill=pal["paper"][1], stroke=ink, w=w),
           line(cx, cy - h * 0.36, cx, cy + h * 0.56, stroke=ink, w=w * 0.7)]
    for k in range(3):
        out.append(line(cx - w_ * 0.42, cy - h * 0.14 + k * h * 0.17, cx - w_ * 0.1, cy - h * 0.1 + k * h * 0.17,
                        stroke=gold, w=3, op=0.75))
        out.append(line(cx + w_ * 0.1, cy - h * 0.1 + k * h * 0.17, cx + w_ * 0.42, cy - h * 0.14 + k * h * 0.17,
                        stroke=gold, w=3, op=0.5))
    return "".join(out)


def letter(cx, cy, w_, pal, tilt=-6):
    ink, gold, red = pal["ink"], pal["gold"], pal["red"]
    h = w_ * 0.64
    return "".join([
        f'<g transform="rotate({_d(tilt)} {_d(cx)} {_d(cy)})">',
        rect(cx - w_ / 2, cy - h / 2, w_, h, fill=pal["paper"][0], stroke=ink, w=6, rx=4),
        path(f"M {_d(cx - w_ / 2)} {_d(cy - h / 2)} L {_d(cx)} {_d(cy + h * 0.1)} L {_d(cx + w_ / 2)} {_d(cy - h / 2)}",
             stroke=ink, w=5, op=0.85),
        circle(cx, cy + h * 0.08, w_ * 0.1, fill=red, stroke=ink, w=5),
        path(f"M {_d(cx - w_ * 0.035)} {_d(cy + h * 0.02)} h {_d(w_ * 0.07)} M {_d(cx)} {_d(cy - h * 0.01)} "
             f"v {_d(h * 0.13)}", stroke="#f7e6c8", w=4),
        "</g>"])


def scroll(cx, cy, w_, pal, tilt=-7):
    ink, gold = pal["ink"], pal["gold"]
    h = w_ * 0.34
    return "".join([
        f'<g transform="rotate({_d(tilt)} {_d(cx)} {_d(cy)})">',
        rect(cx - w_ / 2, cy - h / 2, w_, h, fill=pal["paper"][0], stroke=ink, w=6, rx=3),
        rect(cx - w_ / 2 + 7, cy - h / 2 + 7, w_ - 14, h - 14, fill="none", stroke=gold, w=3, rx=2, op=0.5),
        circle(cx - w_ / 2, cy, h * 0.34, fill=pal["paper"][1], stroke=ink, w=5),
        circle(cx + w_ / 2, cy, h * 0.34, fill=pal["paper"][1], stroke=ink, w=5),
        line(cx - w_ * 0.32, cy - h * 0.12, cx + w_ * 0.16, cy - h * 0.12, stroke=ink, w=3, op=0.45),
        line(cx - w_ * 0.32, cy + h * 0.02, cx + w_ * 0.28, cy + h * 0.02, stroke=ink, w=3, op=0.45),
        line(cx - w_ * 0.28, cy + h * 0.15, cx + w_ * 0.06, cy + h * 0.15, stroke=ink, w=3, op=0.45),
        "</g>"])


def key(cx, cy, L, pal, tilt=0):
    ink, gold = pal["ink"], pal["gold"]
    r = L * 0.24
    return "".join([
        f'<g transform="rotate({_d(tilt)} {_d(cx)} {_d(cy)})">',
        circle(cx - L * 0.32, cy, r, fill="none", stroke=ink, w=9),
        circle(cx - L * 0.32, cy, r * 0.4, fill=gold, stroke=ink, w=4),
        line(cx - L * 0.08, cy, cx + L * 0.46, cy, stroke=ink, w=9),
        rect(cx + L * 0.22, cy, L * 0.055, L * 0.17, fill=gold, stroke=ink, w=3),
        rect(cx + L * 0.34, cy, L * 0.055, L * 0.21, fill=gold, stroke=ink, w=3),
        "</g>"])


def door(x, y, w_, h_, pal):
    ink, gold = pal["ink"], pal["gold"]
    return "".join([rect(x, y, w_, h_, fill=pal["paper"][1], stroke=ink, w=7),
                    rect(x + w_ * 0.12, y + h_ * 0.09, w_ * 0.76, h_ * 0.34, fill="none", stroke=ink, w=4, op=0.7),
                    rect(x + w_ * 0.12, y + h_ * 0.52, w_ * 0.76, h_ * 0.36, fill="none", stroke=ink, w=4, op=0.7),
                    circle(x + w_ * 0.82, y + h_ * 0.5, w_ * 0.035, fill=gold, stroke=ink, w=4)])


def calendar(cx, cy, w_, pal, mark=17):
    ink, gold, red = pal["ink"], pal["gold"], pal["red"]
    h = w_ * 1.04
    x, y = cx - w_ / 2, cy - h / 2
    out = [rect(x, y, w_, h, fill=pal["paper"][0], stroke=ink, w=7, rx=6),
           rect(x, y, w_, h * 0.15, fill=pal["soft"], stroke=ink, w=6, rx=6),
           line(x, y + h * 0.15, x + w_, y + h * 0.15, stroke=ink, w=6),
           text(x + w_ * 0.5, y + h * 0.112, "11", size=int(w_ * 0.085), fill=ink, weight=800)]
    cols, rows = 7, 5
    gx0, gy0 = x + w_ * 0.06, y + h * 0.21
    cw, ch = w_ * 0.88 / cols, h * 0.7 / rows
    for r in range(rows):
        for c in range(cols):
            bx, by = gx0 + c * cw, gy0 + r * ch
            out.append(rect(bx, by, cw, ch, fill="none", stroke=ink, w=2, op=0.22))
            num = r * cols + c + 1
            if num <= 30:
                out.append(text(bx + cw / 2, by + ch * 0.7, str(num), size=int(cw * 0.4),
                                fill=ink, weight=600, op=0.75))
    mcol, mrow = (mark - 1) % 7, (mark - 1) // 7
    mcx, mcy = gx0 + mcol * cw + cw / 2, gy0 + mrow * ch + ch / 2
    out.append(ellipse(mcx, mcy, cw * 0.52, ch * 0.47, fill=red, stroke=red, w=5, op=0.92))
    out.append(text(mcx, mcy + ch * 0.15, str(mark), size=int(cw * 0.4), fill="#fff8ea", weight=800))
    return "".join(out)


def hourglass(cx, cy, w_, pal):
    ink, gold = pal["ink"], pal["gold"]
    h = w_ * 1.5
    return "".join([
        rect(cx - w_ * 0.62, cy - h / 2 - w_ * 0.09, w_ * 1.24, w_ * 0.13, fill=pal["soft"], stroke=ink, w=6, rx=3),
        rect(cx - w_ * 0.62, cy + h / 2 - w_ * 0.04, w_ * 1.24, w_ * 0.13, fill=pal["soft"], stroke=ink, w=6, rx=3),
        path(f"M {_d(cx - w_ / 2)} {_d(cy - h / 2)} L {_d(cx + w_ / 2)} {_d(cy - h / 2)} "
             f"C {_d(cx + w_ / 2)} {_d(cy - h * 0.1)} {_d(cx + w_ * 0.08)} {_d(cy - h * 0.04)} {_d(cx)} {_d(cy)} "
             f"C {_d(cx - w_ * 0.08)} {_d(cy + h * 0.04)} {_d(cx - w_ / 2)} {_d(cy + h * 0.1)} {_d(cx - w_ / 2)} {_d(cy + h / 2)} "
             f"L {_d(cx + w_ / 2)} {_d(cy + h / 2)} "
             f"C {_d(cx + w_ / 2)} {_d(cy + h * 0.1)} {_d(cx + w_ * 0.08)} {_d(cy + h * 0.04)} {_d(cx)} {_d(cy)} "
             f"C {_d(cx - w_ * 0.08)} {_d(cy - h * 0.04)} {_d(cx - w_ / 2)} {_d(cy - h * 0.1)} {_d(cx - w_ / 2)} {_d(cy - h / 2)} Z",
             fill=pal["paper"][0], stroke=ink, w=6),
        path(f"M {_d(cx - w_ * 0.34)} {_d(cy + h * 0.44)} L {_d(cx + w_ * 0.34)} {_d(cy + h * 0.44)} "
             f"L {_d(cx + w_ * 0.16)} {_d(cy + h * 0.2)} L {_d(cx - w_ * 0.05)} {_d(cy + h * 0.2)} Z",
             fill=gold, stroke=ink, w=4, op=0.9),
        line(cx, cy + h * 0.2, cx, cy + h * 0.42, stroke=gold, w=5),
        path(f"M {_d(cx - w_ * 0.05)} {_d(cy - h * 0.34)} L {_d(cx + w_ * 0.05)} {_d(cy - h * 0.34)} "
             f"L {_d(cx)} {_d(cy - h * 0.16)} Z", fill=gold, stroke=ink, w=4),
    ])


def compass_rose(cx, cy, r, pal):
    ink, gold, red = pal["ink"], pal["gold"], pal["red"]
    out = [circle(cx, cy, r, fill=pal["paper"][0], stroke=ink, w=7),
           circle(cx, cy, r * 0.84, fill="none", stroke=ink, w=3, op=0.45),
           circle(cx, cy, r * 0.1, fill=gold, stroke=ink, w=4)]
    for k in range(8):
        a = math.radians(k * 45)
        out.append(line(cx + math.cos(a) * r * 0.78, cy + math.sin(a) * r * 0.78,
                        cx + math.cos(a) * r * 0.94, cy + math.sin(a) * r * 0.94,
                        stroke=ink, w=5 if k % 2 == 0 else 3, op=0.8))
    a = math.radians(-52)
    out.append(path(f"M {_d(cx)} {_d(cy)} L {_d(cx + math.cos(a) * r * 0.74)} {_d(cy + math.sin(a) * r * 0.74)} "
                    f"L {_d(cx + math.cos(a + 0.55) * r * 0.16)} {_d(cy + math.sin(a + 0.55) * r * 0.16)} Z",
                    fill=red, stroke=ink, w=5))
    out.append(path(f"M {_d(cx)} {_d(cy)} L {_d(cx - math.cos(a) * r * 0.74)} {_d(cy - math.sin(a) * r * 0.74)} "
                    f"L {_d(cx - math.cos(a + 0.55) * r * 0.16)} {_d(cy - math.sin(a + 0.55) * r * 0.16)} Z",
                    fill=pal["paper"][1], stroke=ink, w=5))
    return "".join(out)


def turtle(cx, cy, w_, pal):
    """황동 거북 — 위에서 본 등딱지와 판 무늬, 머리·다리 넷."""
    ink, gold = pal["ink"], pal["gold"]
    rx, ry = w_ * 0.34, w_ * 0.25
    out = []
    # 다리 넷
    for dx, dy, rot in ((-0.95, -0.62, -32), (0.95, -0.62, 32), (-0.95, 0.62, 32), (0.95, 0.62, -32)):
        lx, ly = cx + rx * dx, cy + ry * dy
        out.append(f'<rect x="{_d(lx - w_ * 0.055)}" y="{_d(ly - w_ * 0.035)}" width="{_d(w_ * 0.11)}" '
                   f'height="{_d(w_ * 0.07)}" rx="{_d(w_ * 0.03)}" fill="{gold}" stroke="{ink}" '
                   f'stroke-width="5" transform="rotate({rot} {_d(lx)} {_d(ly)})"/>')
    # 꼬리
    out.append(path(f"M {_d(cx - rx * 0.95)} {_d(cy)} l {_d(-w_ * 0.09)} {_d(-w_ * 0.03)} "
                    f"l {_d(w_ * 0.02)} {_d(w_ * 0.06)} Z", fill=gold, stroke=ink, w=4))
    # 머리
    hx = cx + rx * 1.12
    out.append(path(f"M {_d(cx + rx * 0.9)} {_d(cy - w_ * 0.035)} L {_d(hx - w_ * 0.03)} {_d(cy - w_ * 0.045)} "
                    f"L {_d(hx - w_ * 0.03)} {_d(cy + w_ * 0.045)} L {_d(cx + rx * 0.9)} {_d(cy + w_ * 0.035)} Z",
                    fill=gold, stroke=ink, w=4))
    out.append(ellipse(hx, cy, w_ * 0.085, w_ * 0.07, fill=gold, stroke=ink, w=5))
    out.append(circle(hx + w_ * 0.02, cy - w_ * 0.02, w_ * 0.014, fill=ink, stroke=ink, w=1))
    # 등딱지
    out.append(ellipse(cx, cy, rx, ry, fill=gold, stroke=ink, w=6, op=0.95))
    out.append(ellipse(cx, cy, rx * 0.78, ry * 0.78, fill="none", stroke=ink, w=3, op=0.45))
    for px, py in ((0, -0.42), (-0.46, -0.1), (0.46, -0.1), (-0.28, 0.42), (0.28, 0.42)):
        hx2, hy2 = cx + rx * px, cy + ry * py
        rr = rx * 0.19
        pts = " ".join(f"{_d(hx2 + rr * math.cos(math.radians(60 * i + 30)))},"
                       f"{_d(hy2 + rr * 0.9 * math.sin(math.radians(60 * i + 30)))}" for i in range(6))
        out.append(f'<polygon points="{pts}" fill="none" stroke="{ink}" stroke-width="3.5" opacity="0.45"/>')
    # 등딱지 테두리 점
    out.append(ellipse(cx, cy, rx * 0.9, ry * 0.9, fill="none", stroke=ink, w=2, op=0.25))
    return "".join(out)


def incense(cx, base_y, w_, pal, rng):
    """향로 — 뚜껑이 얹힌 항아리형 몸체, 다리 셋, 가는 연기."""
    ink, gold = pal["ink"], pal["gold"]
    h = w_ * 0.72
    rim_y = base_y - h * 0.42
    bw = w_ * 0.34
    out = []
    # 다리
    for dx, tilt in ((-0.22, -1), (0.22, 1), (0, 0)):
        x0 = cx + w_ * dx
        out.append(line(x0, rim_y + h * 0.26, x0 + w_ * 0.04 * tilt, base_y,
                        stroke=ink, w=9))
    # 몸체
    out.append(path(f"M {_d(cx - bw)} {_d(rim_y)} "
                    f"C {_d(cx - bw * 1.05)} {_d(rim_y + h * 0.42)} {_d(cx - bw * 0.5)} {_d(rim_y + h * 0.5)} "
                    f"{_d(cx)} {_d(rim_y + h * 0.5)} "
                    f"C {_d(cx + bw * 0.5)} {_d(rim_y + h * 0.5)} {_d(cx + bw * 1.05)} {_d(rim_y + h * 0.42)} "
                    f"{_d(cx + bw)} {_d(rim_y)} Z", fill=gold, stroke=ink, w=6, op=0.92))
    out.append(ellipse(cx, rim_y, bw * 1.1, h * 0.08, fill=pal["paper"][1], stroke=ink, w=5))
    # 뚜껑
    out.append(path(f"M {_d(cx - bw * 0.92)} {_d(rim_y - h * 0.02)} "
                    f"C {_d(cx - bw * 0.86)} {_d(rim_y - h * 0.46)} {_d(cx + bw * 0.86)} {_d(rim_y - h * 0.46)} "
                    f"{_d(cx + bw * 0.92)} {_d(rim_y - h * 0.02)} Z", fill=pal["soft"], stroke=ink, w=6))
    out.append(circle(cx, rim_y - h * 0.35, w_ * 0.036, fill=pal["paper"][0], stroke=ink, w=5))
    # 몸체 무늬
    out.append(line(cx - bw * 0.55, rim_y + h * 0.2, cx + bw * 0.55, rim_y + h * 0.2, stroke=ink, w=3, op=0.35))
    # 연기
    for k in range(2):
        x0 = cx + (k - 0.5) * w_ * 0.07
        out.append(path(f"M {_d(x0)} {_d(rim_y - h * 0.42)} "
                        f"C {_d(x0 - 34)} {_d(rim_y - h * 0.72)} {_d(x0 + 26)} {_d(rim_y - h * 0.92)} "
                        f"{_d(x0 + rng.r(-18, 18))} {_d(rim_y - h * 1.3)}", stroke=ink, w=4, op=0.3))
    return "".join(out)


def red_thread(cx, cy, w_, pal):
    """붉은 실뭉치 — 감긴 실의 결, 아래로 풀린 한 가닥."""
    ink, red = pal["ink"], pal["red"]
    r = w_ * 0.26
    out = [circle(cx, cy, r, fill=red, stroke=ink, w=6, op=0.92)]
    for k, rot in enumerate((-28, 12, 52)):
        out.append(f'<ellipse cx="{_d(cx)}" cy="{_d(cy)}" rx="{_d(r * 0.94)}" ry="{_d(r * 0.42)}" '
                   f'fill="none" stroke="{ink}" stroke-width="3.5" opacity="0.35" '
                   f'transform="rotate({rot} {_d(cx)} {_d(cy)})"/>')
    out.append(f'<ellipse cx="{_d(cx)}" cy="{_d(cy)}" rx="{_d(r * 0.5)}" ry="{_d(r * 0.22)}" '
               f'fill="none" stroke="{ink}" stroke-width="3" opacity="0.25" '
               f'transform="rotate(8 {_d(cx)} {_d(cy)})"/>')
    # 풀린 실
    out.append(path(f"M {_d(cx + r * 0.82)} {_d(cy + r * 0.5)} C {_d(cx + r * 1.5)} {_d(cy + r * 0.9)} "
                    f"{_d(cx + r * 1.3)} {_d(cy + r * 1.8)} {_d(cx + r * 2.2)} {_d(cy + r * 2.1)}",
                    stroke=red, w=7))
    out.append(path(f"M {_d(cx - r * 0.9)} {_d(cy + r * 0.35)} C {_d(cx - r * 1.5)} {_d(cy + r * 0.9)} "
                    f"{_d(cx - r * 1.2)} {_d(cy + r * 1.7)} {_d(cx - r * 1.9)} {_d(cy + r * 2.0)}",
                    stroke=red, w=7, op=0.8))
    return "".join(out)


def bed(cx, base_y, w_, pal):
    """침대와 잠든 사람 — 이불은 언덕처럼 부풀게(사람이 덮고 있는 모양)."""
    ink, gold, red, soft = pal["ink"], pal["gold"], pal["red"], pal["soft"]
    h = w_ * 0.5
    x = cx - w_ / 2
    my = base_y - h * 0.34
    r = w_ * 0.05
    hx, hy = x + w_ * 0.235, my - h * 0.26
    out = [
        # 머리판·발판
        rect(x, my - h * 0.5, w_ * 0.095, h * 0.84, fill=pal["paper"][1], stroke=ink, w=7, rx=12),
        rect(x + w_ * 0.905, my - h * 0.18, w_ * 0.095, h * 0.52, fill=pal["paper"][1], stroke=ink, w=7, rx=10),
        # 다리
        line(x + w_ * 0.08, base_y, x + w_ * 0.08, base_y + h * 0.08, stroke=ink, w=8),
        line(x + w_ * 0.92, base_y, x + w_ * 0.92, base_y + h * 0.08, stroke=ink, w=8),
        # 매트리스
        rect(x + w_ * 0.08, my, w_ * 0.84, h * 0.3, fill=soft, stroke=ink, w=7, rx=14),
        rect(x + w_ * 0.08, my + h * 0.3, w_ * 0.84, h * 0.07, fill=pal["paper"][1], stroke=ink, w=7, rx=4),
        # 베개
        rect(x + w_ * 0.1, my - h * 0.16, w_ * 0.17, h * 0.14, fill=pal["paper"][0], stroke=ink, w=5, rx=12),
        # 이불 언덕
        path(f"M {_d(x + w_ * 0.26)} {_d(my + h * 0.02)} "
             f"L {_d(x + w_ * 0.26)} {_d(my - h * 0.12)} "
             f"C {_d(x + w_ * 0.36)} {_d(my - h * 0.5)} {_d(x + w_ * 0.66)} {_d(my - h * 0.5)} "
             f"{_d(x + w_ * 0.82)} {_d(my - h * 0.18)} "
             f"L {_d(x + w_ * 0.82)} {_d(my + h * 0.02)} Z",
             fill=red, stroke=ink, w=6, op=0.13),
        path(f"M {_d(x + w_ * 0.26)} {_d(my - h * 0.12)} "
             f"C {_d(x + w_ * 0.36)} {_d(my - h * 0.5)} {_d(x + w_ * 0.66)} {_d(my - h * 0.5)} "
             f"{_d(x + w_ * 0.82)} {_d(my - h * 0.18)} "
             f"C {_d(x + w_ * 0.86)} {_d(my - h * 0.06)} {_d(x + w_ * 0.84)} {_d(my + h * 0.01)} {_d(x + w_ * 0.8)} {_d(my + h * 0.02)}",
             stroke=ink, w=5, op=0.55),
        # 머리
        ellipse(hx, hy, r, r * 1.06, fill=pal["paper"][0], stroke=ink, w=6),
        path(f"M {_d(hx - r * 0.98)} {_d(hy - r * 0.12)} C {_d(hx - r * 0.86)} {_d(hy - r * 1.18)} "
             f"{_d(hx + r * 0.86)} {_d(hy - r * 1.18)} {_d(hx + r * 0.98)} {_d(hy - r * 0.12)} Z",
             fill=ink, stroke=ink, w=4, op=0.92),
        path(f"M {_d(hx - r * 0.34)} {_d(hy + r * 0.14)} q {_d(r * 0.32)} {_d(r * 0.22)} {_d(r * 0.64)} 0",
             stroke=ink, w=3),
        circle(hx - r * 0.62, hy + r * 0.12, r * 0.055, fill=ink, stroke=ink, w=1),
    ]
    return "".join(out)


def house(cx, base_y, w_, pal):
    ink, gold = pal["ink"], pal["gold"]
    h = w_ * 0.62
    x = cx - w_ / 2
    return "".join([
        rect(x + w_ * 0.12, base_y - h * 0.7, w_ * 0.76, h * 0.7, fill=pal["paper"][0], stroke=ink, w=7),
        path(f"M {_d(x)} {_d(base_y - h * 0.68)} L {_d(cx)} {_d(base_y - h * 1.22)} L {_d(x + w_)} {_d(base_y - h * 0.68)} "
             f"L {_d(x + w_ * 0.94)} {_d(base_y - h * 0.56)} L {_d(cx)} {_d(base_y - h * 1.04)} "
             f"L {_d(x + w_ * 0.06)} {_d(base_y - h * 0.56)} Z", fill=ink, stroke=ink, w=5, op=0.9),
        rect(x + w_ * 0.42, base_y - h * 0.46, w_ * 0.16, h * 0.46, fill=pal["soft"], stroke=ink, w=5),
        rect(x + w_ * 0.2, base_y - h * 0.56, w_ * 0.14, h * 0.16, fill="none", stroke=ink, w=4),
        rect(x + w_ * 0.66, base_y - h * 0.56, w_ * 0.14, h * 0.16, fill="none", stroke=ink, w=4),
        line(x + w_ * 0.2, base_y - h * 0.02, x + w_ * 0.8, base_y - h * 0.02, stroke=ink, w=4, op=0.45)])


def speech(cx, cy, w_, h_, pal, fill=None, tail="left"):
    """말풍선 — 꼬리 방향을 고를 수 있다."""
    ink = pal["ink"]
    f = fill or pal["paper"][0]
    x, y = cx - w_ / 2, cy - h_ / 2
    if tail == "left":
        t = (f"L {_d(x + w_ * 0.22)} {_d(cy + h_ / 2)} L {_d(x + w_ * 0.1)} {_d(cy + h_ * 1.02)} "
             f"L {_d(x + w_ * 0.4)} {_d(cy + h_ / 2)}")
    else:
        t = (f"L {_d(x + w_ * 0.78)} {_d(cy + h_ / 2)} L {_d(x + w_ * 0.9)} {_d(cy + h_ * 1.02)} "
             f"L {_d(x + w_ * 0.6)} {_d(cy + h_ / 2)}")
    d = (f"M {_d(x + w_ * 0.2)} {_d(y)} L {_d(x + w_ * 0.8)} {_d(y)} "
         f"Q {_d(x + w_)} {_d(y)} {_d(x + w_)} {_d(y + h_ * 0.3)} "
         f"L {_d(x + w_)} {_d(cy + h_ * 0.2)} Q {_d(x + w_)} {_d(cy + h_ / 2)} {_d(x + w_ * 0.8)} {_d(cy + h_ / 2)} "
         + t +
         f" L {_d(x + w_ * 0.2)} {_d(cy + h_ / 2)} Q {_d(x)} {_d(cy + h_ / 2)} {_d(x)} {_d(cy + h_ * 0.2)} "
         f"L {_d(x)} {_d(y + h_ * 0.3)} Q {_d(x)} {_d(y)} {_d(x + w_ * 0.2)} {_d(y)} Z")
    return path(d, fill=f, stroke=ink, w=5)


def bell(cx, cy, w_, pal):
    """경고 — 종과 붉은 신호."""
    ink, gold, red = pal["ink"], pal["gold"], pal["red"]
    h = w_ * 1.1
    out = [path(f"M {_d(cx - w_ / 2)} {_d(cy + h * 0.28)} C {_d(cx - w_ * 0.44)} {_d(cy - h * 0.2)} "
                f"{_d(cx - w_ * 0.2)} {_d(cy - h * 0.5)} {_d(cx)} {_d(cy - h * 0.5)} "
                f"C {_d(cx + w_ * 0.2)} {_d(cy - h * 0.5)} {_d(cx + w_ * 0.44)} {_d(cy - h * 0.2)} "
                f"{_d(cx + w_ / 2)} {_d(cy + h * 0.28)} Z", fill=gold, stroke=ink, w=6, op=0.9),
           line(cx - w_ * 0.58, cy + h * 0.28, cx + w_ * 0.58, cy + h * 0.28, stroke=ink, w=7),
           circle(cx, cy + h * 0.4, w_ * 0.08, fill=red, stroke=ink, w=4),
           circle(cx, cy - h * 0.56, w_ * 0.06, fill=ink, stroke=ink, w=3)]
    for k in range(2):
        rr = w_ * (0.66 + k * 0.2)
        out.append(path(f"M {_d(cx - rr)} {_d(cy - h * 0.3)} q {_d(rr * 0.36)} {_d(-h * 0.26)} {_d(rr * 0.72)} 0",
                        stroke=red, w=5, op=0.7 - k * 0.22))
        out.append(path(f"M {_d(cx + rr)} {_d(cy - h * 0.3)} q {_d(-rr * 0.36)} {_d(-h * 0.26)} {-rr * 0.72:.1f} 0",
                        stroke=red, w=5, op=0.7 - k * 0.22))
    return "".join(out)


def rings(cx, cy, r, pal):
    """두 반지 — 배우자·인연."""
    ink, gold, red = pal["ink"], pal["gold"], pal["red"]
    return "".join([
        circle(cx - r * 0.52, cy, r * 0.62, fill="none", stroke=gold, w=12),
        circle(cx + r * 0.52, cy, r * 0.62, fill="none", stroke=gold, w=12),
        circle(cx - r * 0.52, cy, r * 0.62, fill="none", stroke=ink, w=3, op=0.35),
        circle(cx + r * 0.52, cy, r * 0.62, fill="none", stroke=ink, w=3, op=0.35),
        path(f"M {_d(cx - r * 0.52)} {_d(cy - r * 0.6)} l {_d(-r * 0.1)} {_d(-r * 0.13)} "
             f"l {_d(r * 0.1)} {_d(-r * 0.13)} l {_d(r * 0.1)} {_d(r * 0.13)} Z",
             fill=pal["paper"][0], stroke=ink, w=4),
    ])


def lamp(cx, base_y, w_, pal):
    ink, gold = pal["ink"], pal["gold"]
    h = w_ * 1.1
    return "".join([
        path(f"M {_d(cx)} {_d(base_y)} L {_d(cx)} {_d(base_y - h * 0.6)} L {_d(cx + w_ * 0.3)} {_d(base_y - h * 0.86)}",
             stroke=ink, w=7),
        path(f"M {_d(cx + w_ * 0.14)} {_d(base_y - h * 0.98)} L {_d(cx + w_ * 0.62)} {_d(base_y - h * 0.74)} "
             f"L {_d(cx + w_ * 0.44)} {_d(base_y - h * 0.5)} L {_d(cx - w_ * 0.04)} {_d(base_y - h * 0.74)} Z",
             fill=gold, stroke=ink, w=6, op=0.85),
        ellipse(cx, base_y, w_ * 0.3, w_ * 0.06, fill=ink, stroke=ink, w=4, op=0.85)])


def laptop(cx, base_y, w_, pal):
    ink, gold = pal["ink"], pal["gold"]
    h = w_ * 0.62
    return "".join([
        path(f"M {_d(cx - w_ * 0.42)} {_d(base_y)} L {_d(cx - w_ * 0.36)} {_d(base_y - h)} "
             f"L {_d(cx + w_ * 0.36)} {_d(base_y - h)} L {_d(cx + w_ * 0.42)} {_d(base_y)} Z",
             fill=pal["paper"][0], stroke=ink, w=6),
        rect(cx - w_ * 0.3, base_y - h * 0.86, w_ * 0.6, h * 0.66, fill=pal["soft"], stroke=ink, w=4),
        line(cx - w_ * 0.5, base_y, cx + w_ * 0.5, base_y, stroke=ink, w=7),
        path(f"M {_d(cx - w_ * 0.22)} {_d(base_y - h * 0.66)} h {_d(w_ * 0.28)} "
             f"M {_d(cx - w_ * 0.22)} {_d(base_y - h * 0.52)} h {_d(w_ * 0.4)} "
             f"M {_d(cx - w_ * 0.22)} {_d(base_y - h * 0.38)} h {_d(w_ * 0.2)}", stroke=ink, w=4, op=0.5)])


def cup(cx, base_y, w_, pal):
    ink, gold = pal["ink"], pal["gold"]
    h = w_ * 0.9
    return "".join([
        path(f"M {_d(cx - w_ * 0.34)} {_d(base_y - h)} L {_d(cx - w_ * 0.26)} {_d(base_y)} "
             f"L {_d(cx + w_ * 0.26)} {_d(base_y)} L {_d(cx + w_ * 0.34)} {_d(base_y - h)} Z",
             fill=pal["paper"][0], stroke=ink, w=6),
        path(f"M {_d(cx + w_ * 0.32)} {_d(base_y - h * 0.74)} q {_d(w_ * 0.24)} {_d(h * 0.2)} 0 {_d(h * 0.42)}",
             stroke=ink, w=6),
        ellipse(cx, base_y - h * 0.96, w_ * 0.32, w_ * 0.07, fill=pal["soft"], stroke=ink, w=4),
        path(f"M {_d(cx - w_ * 0.1)} {_d(base_y - h * 1.16)} q {_d(w_ * 0.12)} {_d(-h * 0.16)} 0 {_d(-h * 0.3)}",
             stroke=ink, w=4, op=0.35)])


def scene_bg(pal, rng, kind):
    """배경 — 종이결 + 은은한 원광 + 지평선. 달 대신 작은 해·원 테두리."""
    ink, gold, red = pal["ink"], pal["gold"], pal["red"]
    parts = []
    cx = rng.r(520, 680)
    cy = rng.r(300, 360)
    parts.append(f'<circle cx="{_d(cx)}" cy="{_d(cy)}" r="{_d(rng.r(300, 380))}" fill="url(#wash)" opacity="0.85"/>')
    if kind == "arch":
        parts.append(path(f"M {_d(cx - 260)} 620 L {_d(cx - 260)} 300 A 260 260 0 0 1 {_d(cx + 260)} 300 L {_d(cx + 260)} 620",
                          stroke=ink, w=3, op=0.2))
    elif kind == "rings":
        for k in range(3):
            parts.append(circle(cx, cy - 20, 200 + k * 62, stroke=gold, w=2, op=0.28 - k * 0.06))
    elif kind == "rays":
        for k in range(9):
            a = math.radians(-72 + k * 18)
            parts.append(line(cx + math.cos(a) * 210, cy - 30 + math.sin(a) * 210,
                              cx + math.cos(a) * 520, cy - 30 + math.sin(a) * 520,
                              stroke=gold, w=2, op=0.22))
    elif kind == "grid":
        for k in range(8):
            parts.append(line(0, 80 + k * 70, W, 80 + k * 70, stroke=ink, w=1.5, op=0.07))
    # 지평선
    gy = rng.r(560, 600)
    parts.append(line(60, gy, W - 60, gy, stroke=ink, w=2.5, op=0.22))
    parts.append(rect(0, gy, W, H - gy, fill=ink, op=0.03))
    # 작은 해
    sx, sy, sr = rng.r(940, 1060), rng.r(110, 170), rng.r(26, 42)
    parts.append(circle(sx, sy, sr, fill=gold, stroke=gold, w=1, op=0.5))
    parts.append(circle(sx, sy, sr * 1.6, stroke=gold, w=1.2, op=0.18))
    return "".join(parts)


def frame(pal, op=0.28):
    return "".join([rect(24, 24, W - 48, H - 48, stroke=pal["ink"], w=2.2, op=op),
                    rect(34, 34, W - 68, H - 68, stroke=pal["ink"], w=1.2, op=op * 0.6)])


# ---------------------------------------------------------------- 장면
def ground_shadow(cx, base_y, rx, pal, op=0.07):
    return ellipse(cx, base_y, rx, rx * 0.13, fill=pal["ink"], stroke="none", w=0, op=op)


def _mirror(parts, on):
    if not on:
        return "".join(parts)
    return f'<g transform="translate({W} 0) scale(-1 1)">' + "".join(parts) + "</g>"


def scene_portrait(rng, pal):
    """사람 초상 — 화제의인물·일반 기사. 조명 아래 서 있는 모습으로도 그린다."""
    kind = rng.pick(["arch", "rings", "grid", "rays"])
    parts = [scene_bg(pal, rng, kind)]
    if kind == "rays":
        parts.append(path("M 600 30 L 350 700 L 850 700 Z", fill=pal["gold"], stroke="none", w=0, op=0.09))
    r = rng.r(136, 154)
    cx = 600 + rng.r(-46, 46)
    parts.append(ground_shadow(cx, 668, r * 2.1, pal, 0.05))
    parts.append(bust(cx, 706, r=r, hair=rng.pick(HAIRS), face=rng.pick(["calm", "smile"]),
                      pal=pal, tilt=rng.r(-2.5, 2.5), w=6.5))
    parts.append(seal(rng.r(1010, 1050), 596, 56, pal, 0.85))
    return parts


def scene_duo(rng, pal):
    """두 사람 — MBTI 궁합·인연. 사이에 붉은 실과 말풍선."""
    parts = [scene_bg(pal, rng, rng.pick(["rings", "arch"]))]
    r = rng.r(94, 104)
    lx, rx_ = 600 - rng.r(152, 178), 600 + rng.r(152, 178)
    parts.append(ground_shadow(600, 676, 330, pal, 0.045))
    parts.append(bust(lx, 712, r=r, hair=rng.pick(["bun", "bob", "short"]), pal=pal, tilt=4, w=6))
    parts.append(bust(rx_, 712, r=r, hair=rng.pick(["short", "topknot", "band", "gat"]), pal=pal, tilt=-4, w=6))
    mid = (lx + rx_) / 2
    parts.append(red_thread(mid, 336, 210, pal))
    bw = 132
    parts.append(speech(mid - 86, 186, bw, 78, pal, tail="left"))
    parts.append(line(mid - 128, 186, mid - 52, 186, stroke=pal["ink"], w=4, op=0.5))
    parts.append(line(mid - 128, 204, mid - 70, 204, stroke=pal["ink"], w=4, op=0.35))
    parts.append(speech(mid + 92, 238, 108, 68, pal, tail="right"))
    parts.append(circle(mid + 92, 240, 11, fill=pal["red"], stroke=pal["red"], w=2))
    return parts


def scene_money(rng, pal):
    """재물 — 엽전 그릇·복주머니·주판·금괴."""
    mirror = rng.chance(0.5)
    parts = [scene_bg(pal, rng, rng.pick(["grid", "rays", "arch"]))]
    props = [
        abacus(80, 300, 290, 220, pal),
        purse(960, 400, 230, pal),
        coin(250, 210, 40, pal),
        coin(300, 154, 30, pal, w=4),
    ]
    parts.append(_mirror(props, mirror))
    parts.append(ground_shadow(600, 668, 250, pal, 0.06))
    bowl_y = 506
    parts.append(path(f"M {_d(410)} {_d(bowl_y)} C {_d(410)} {_d(bowl_y + 108)} {_d(452)} {_d(bowl_y + 140)} "
                      f"{_d(600)} {_d(bowl_y + 140)} C {_d(748)} {_d(bowl_y + 140)} {_d(790)} {_d(bowl_y + 108)} "
                      f"{_d(790)} {_d(bowl_y)} Z", fill=pal["soft"], stroke=pal["ink"], w=7))
    parts.append(ellipse(600, bowl_y, 190, 30, fill=pal["paper"][1], stroke=pal["ink"], w=6))
    for (dx, dy, rr) in [(-96, -46, 52), (0, -66, 56), (94, -44, 50), (-46, -104, 42), (52, -100, 40)]:
        parts.append(coin(600 + dx, bowl_y + dy, rr, pal))
    parts.append(ingot(600, 700, 170, pal))
    return parts


def scene_today(rng, pal):
    """오늘의 운세 — 달력과 붉은 동그라미, 그 옆의 붓."""
    parts = [scene_bg(pal, rng, rng.pick(["grid", "rings"]))]
    parts.append(ground_shadow(600, 660, 240, pal, 0.05))
    parts.append(calendar(600, 372, rng.r(340, 380), pal, mark=rng.i(3, 28)))
    props = [coin(214, 512, 44, pal), coin(258, 596, 32, pal, w=4),
             seal(1016, 596, 52, pal, 0.8)]
    parts.append(_mirror(props, rng.chance(0.5)))
    # 붓
    bx, by = rng.r(880, 950), 300
    parts.append(path(f"M {_d(bx)} {_d(by)} L {_d(bx + 120)} {_d(by + 190)}", stroke=pal["ink"], w=10))
    parts.append(path(f"M {_d(bx - 12)} {_d(by - 22)} L {_d(bx + 15)} {_d(by + 26)} L {_d(bx - 3)} {_d(by + 8)} Z",
                      fill=pal["gold"], stroke=pal["ink"], w=4))
    return parts


def scene_dream(rng, pal):
    """어젯밤 그 꿈 — 잠든 사람과, 떠오르는 꿈의 조각들."""
    parts = [scene_bg(pal, rng, rng.pick(["rings", "grid"]))]
    w_ = rng.r(620, 660)
    h = w_ * 0.5
    base = 604
    my = base - h * 0.34
    hy = my - h * 0.26
    hx = 590 - w_ / 2 + w_ * 0.235
    parts.append(bed(590, base, w_, pal))
    for k in range(2):
        parts.append(text(hx + 40 + 26 * k, hy - 46 - k * 30, "z", size=34 - k * 8, fill=pal["ink"],
                          weight=800, family="serif", op=0.42 - k * 0.12))
    bx, by = rng.r(880, 920), 236
    parts.append(speech(bx, by, 300, 172, pal, fill=pal["paper"][0], tail="left"))
    parts.append(coin(bx - 92, by - 4, 34, pal, w=4))
    parts.append(key(bx + 6, by - 8, 104, pal, tilt=-12))
    parts.append(house(bx + 84, by + 48, 112, pal))
    for k in range(3):
        parts.append(circle(bx - 132 + k * 26, by + 96 - k * 36, 7 + (k % 2) * 3,
                            fill=pal["gold"], stroke=pal["gold"], w=1, op=0.5))
    return parts


def scene_past(rng, pal):
    """전생 — 서찰·두루마리·옛 책."""
    parts = [scene_bg(pal, rng, rng.pick(["arch", "grid"]))]
    variant = rng.i(0, 2)
    if variant == 0:
        parts.append(letter(600, 330, 460, pal, tilt=rng.r(-8, -3)))
        parts.append(scroll(820, 560, 330, pal, tilt=-12))
    elif variant == 1:
        parts.append(scroll(600, 320, 600, pal, tilt=-5))
        parts.append(letter(790, 560, 340, pal, tilt=6))
    else:
        parts.append(book_open(600, 320, 560, pal))
        parts.append(letter(830, 560, 300, pal, tilt=8))
    parts.append(seal(rng.r(180, 240), 560, 54, pal, 0.8))
    return parts


def scene_shop(rng, pal):
    """운부르는 것들 — 거북·향로·붉은 실."""
    parts = [scene_bg(pal, rng, rng.pick(["rings", "grid"]))]
    parts.append(ground_shadow(600, 654, 230, pal, 0.06))
    variant = rng.i(0, 2)
    if variant == 0:
        parts.append(turtle(600, 430, 420, pal))
        props = [coin(840, 540, 44, pal), coin(892, 596, 32, pal, w=4)]
    elif variant == 1:
        parts.append(incense(600, 574, 380, pal, rng))
        props = [coin(300, 566, 40, pal)]
    else:
        parts.append(red_thread(600, 400, 470, pal))
        props = [coin(860, 552, 42, pal)]
    parts.append(_mirror(props, rng.chance(0.5)))
    parts.append(seal(1024, 176, 50, pal, 0.75))
    return parts


def scene_people(rng, pal):
    """화제의인물 — 조명 아래 사람."""
    parts = [scene_bg(pal, rng, "rays")]
    parts.append(path("M 600 40 L 360 700 L 840 700 Z", fill=pal["gold"], stroke="none", w=0, op=0.1))
    parts.append(ground_shadow(600, 672, 300, pal, 0.05))
    parts.append(bust(600, 706, r=rng.r(124, 138), hair=rng.pick(HAIRS), face="smile", pal=pal, w=6.5))
    for k in range(5):
        parts.append(circle(360 + k * 120, 120 + (k % 2) * 30, 5 + (k % 2) * 3,
                            fill=pal["gold"], stroke=pal["gold"], w=1, op=0.55))
    return parts


def scene_work(rng, pal):
    """월급 vs 사업 — 책상 위의 노트북과 서류."""
    parts = [scene_bg(pal, rng, "grid")]
    parts.append(rect(300, 606, 600, 14, fill=pal["ink"], stroke=pal["ink"], w=2, op=0.82))
    parts.append(laptop(520, 606, 340, pal))
    parts.append(cup(830, 606, 110, pal))
    parts.append(lamp(300, 606, 130, pal))
    parts.append(rect(700, 596, 120, 10, fill=pal["paper"][0], stroke=pal["ink"], w=3))
    parts.append(rect(716, 586, 120, 10, fill=pal["paper"][1], stroke=pal["ink"], w=3))
    parts.append(coin(940, 566, 38, pal))
    return parts


def scene_timing(rng, pal):
    """타이밍 — 나침반 또는 모래시계."""
    parts = [scene_bg(pal, rng, rng.pick(["rings", "rays"]))]
    if rng.chance(0.5):
        parts.append(ground_shadow(600, 640, 230, pal, 0.06))
        parts.append(compass_rose(600, 372, rng.r(210, 240), pal))
    else:
        parts.append(ground_shadow(600, 640, 190, pal, 0.05))
        parts.append(hourglass(600, 360, 230, pal))
        parts.append(coin(870, 560, 40, pal))
    return parts


def scene_house(rng, pal):
    """집 — 한옥 지붕과 대문."""
    parts = [scene_bg(pal, rng, "grid")]
    parts.append(ground_shadow(560, 640, 300, pal, 0.06))
    parts.append(house(520, 630, rng.r(460, 520), pal))
    parts.append(door(870, 450, 160, 210, pal))
    parts.append(coin(230, 560, 40, pal))
    return parts


def scene_warning(rng, pal):
    """경고 꿈 — 종과 붉은 신호."""
    parts = [scene_bg(pal, rng, "rays")]
    parts.append(ground_shadow(600, 620, 180, pal, 0.05))
    parts.append(bell(600, 366, 260, pal))
    return parts


def scene_key_door(rng, pal):
    """열쇠와 문 — 새는 돈·막힌 결정."""
    parts = [scene_bg(pal, rng, "arch")]
    parts.append(door(410, 200, 320, 440, pal))
    parts.append(key(740, 400, 290, pal, tilt=-14))
    parts.append(coin(950, 566, 42, pal))
    return parts


def scene_love(rng, pal):
    """배우자·인연 — 맞물린 두 반지와 붉은 실."""
    parts = [scene_bg(pal, rng, "rings")]
    r = rng.r(176, 196)
    cy = 360
    # 실은 반지 뒤로 지나간다
    parts.append(path(f"M {_d(600 - r * 2.1)} {_d(cy + r * 0.72)} C {_d(600 - r)} {_d(cy + r * 0.2)} "
                      f"{_d(600 + r)} {_d(cy + r * 1.2)} {_d(600 + r * 2.1)} {_d(cy + r * 0.62)}",
                      stroke=pal["red"], w=8, op=0.85))
    parts.append(rings(600, cy, r, pal))
    hs = r * 0.19
    hx, hy = 600, cy - r * 0.98
    parts.append(path(f"M {_d(hx)} {_d(hy + hs)} "
                      f"C {_d(hx - hs * 1.16)} {_d(hy - hs * 0.4)} {_d(hx - hs * 0.58)} {_d(hy - hs * 1.16)} {_d(hx)} {_d(hy - hs * 0.46)} "
                      f"C {_d(hx + hs * 0.58)} {_d(hy - hs * 1.16)} {_d(hx + hs * 1.16)} {_d(hy - hs * 0.4)} {_d(hx)} {_d(hy + hs)} Z",
                      fill=pal["red"], stroke=pal["ink"], w=4, op=0.92))
    return parts


def scene_sprout(rng, pal):
    """개운·시작 — 화분에서 돋는 새싹."""
    parts = [scene_bg(pal, rng, "grid")]
    base = 596
    parts.append(ground_shadow(600, base + 6, 190, pal, 0.06))
    parts.append(path(f"M 470 {base} L 500 452 L 700 452 L 730 {base} Z",
                      fill=pal["soft"], stroke=pal["ink"], w=7))
    parts.append(rect(452, 430, 296, 30, fill=pal["gold"], stroke=pal["ink"], w=6, rx=7))
    parts.append(path(f"M 470 {base - 6} q 130 26 260 0", stroke=pal["ink"], w=3, op=0.25))
    parts.append(sprout(600, 430, 270, pal))
    return parts


def sprout(cx, base_y, w_, pal):
    """화분에서 돋는 새싹 — 시작·개운."""
    ink, gold = pal["ink"], pal["gold"]
    top = base_y - w_ * 0.9
    return "".join([
        path(f"M {_d(cx)} {_d(base_y)} C {_d(cx - 8)} {_d(base_y - w_ * 0.4)} {_d(cx - 6)} {_d(top + 20)} {_d(cx - 4)} {_d(top)}",
             stroke=ink, w=8),
        # 왼쪽 잎
        path(f"M {_d(cx - 6)} {_d(base_y - w_ * 0.5)} C {_d(cx - w_ * 0.22)} {_d(base_y - w_ * 0.62)} "
             f"{_d(cx - w_ * 0.33)} {_d(base_y - w_ * 0.72)} {_d(cx - w_ * 0.35)} {_d(base_y - w_ * 0.77)} "
             f"C {_d(cx - w_ * 0.4)} {_d(base_y - w_ * 0.58)} {_d(cx - w_ * 0.2)} {_d(base_y - w_ * 0.48)} "
             f"{_d(cx - 6)} {_d(base_y - w_ * 0.5)} Z", fill=gold, stroke=ink, w=5, op=0.55),
        # 오른쪽 잎
        path(f"M {_d(cx - 2)} {_d(top + 14)} C {_d(cx + w_ * 0.16)} {_d(top - w_ * 0.04)} "
             f"{_d(cx + w_ * 0.26)} {_d(top - w_ * 0.01)} {_d(cx + w_ * 0.3)} {_d(top + 0.02)} "
             f"C {_d(cx + w_ * 0.32)} {_d(top + w_ * 0.14)} {_d(cx + w_ * 0.13)} {_d(top + w_ * 0.17)} "
             f"{_d(cx - 2)} {_d(top + 14)} Z", fill=gold, stroke=ink, w=5, op=0.8),
        # 흙
        path(f"M {_d(cx - 56)} {_d(base_y - 6)} q {_d(56)} {_d(16)} {_d(112)} 0", stroke=ink, w=4, op=0.35),
    ])


SCENES = {
    "portrait": scene_portrait,
    "duo": scene_duo,
    "money": scene_money,
    "today": scene_today,
    "dream": scene_dream,
    "past": scene_past,
    "shop": scene_shop,
    "people": scene_people,
    "work": scene_work,
    "timing": scene_timing,
    "house": scene_house,
    "warning": scene_warning,
    "keydoor": scene_key_door,
    "love": scene_love,
    "sprout": scene_sprout,
}

# 기사 키 → 장면 (앞에서부터 먼저 맞는 규칙)
RULES = [
    ("marriage", "love"), ("love", "love"), ("gwiin", "love"),
    ("warning", "warning"), ("caution", "warning"),
    ("house", "house"),
    ("dream", "dream"),
    ("mbti", "duo"),
    ("past", "past"),
    ("leak", "keydoor"),
    ("shop", "shop"), ("gaewoon", "shop"),
    ("work", "work"),
    ("cycle", "timing"), ("timing", "timing"),
    ("people", "portrait"),
    ("money", "money"), ("today", "today"),
    ("key", "keydoor"), ("door", "keydoor"),
]


def scene_for(key: str) -> str:
    k = str(key).lower()
    for needle, scene in RULES:
        if needle in k:
            return scene
    return "portrait"


def make_svg(key: str, motif: str | None = None, palette_idx: int | None = None, subject: str | None = None) -> str:
    h = _h(key)
    rng = Rng(h)
    pal = PALS[(h >> 11) % len(PALS)] if palette_idx is None else PALS[int(palette_idx) % len(PALS)]
    scene = subject or motif or scene_for(key)
    if scene not in SCENES:
        scene = scene_for(key)
    gid = h % 99991
    ink = pal["ink"]
    body = "".join(SCENES[scene](rng, pal)).replace("url(#wash)", f"url(#wash{gid})")

    defs = (
        f'<defs>'
        f'<linearGradient id="paper{gid}" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0" stop-color="{pal["paper"][0]}"/><stop offset="1" stop-color="{pal["paper"][1]}"/>'
        f'</linearGradient>'
        f'<radialGradient id="wash{gid}" cx="0.5" cy="0.5" r="0.5">'
        f'<stop offset="0" stop-color="{pal["gold"]}" stop-opacity="0.16"/>'
        f'<stop offset="0.62" stop-color="{pal["gold"]}" stop-opacity="0.07"/>'
        f'<stop offset="1" stop-color="{pal["gold"]}" stop-opacity="0"/>'
        f'</radialGradient>'
        f'<linearGradient id="fade{gid}" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0" stop-color="{pal["paper"][1]}" stop-opacity="0"/>'
        f'<stop offset="1" stop-color="{ink}" stop-opacity="0.10"/>'
        f'</linearGradient>'
        f'<radialGradient id="vig{gid}" cx="0.5" cy="0.46" r="0.78">'
        f'<stop offset="0.6" stop-color="#000" stop-opacity="0"/>'
        f'<stop offset="1" stop-color="#000" stop-opacity="0.08"/>'
        f'</radialGradient>'
        f'<filter id="grain{gid}" x="0" y="0" width="100%" height="100%">'
        f'<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/>'
        f'<feColorMatrix type="saturate" values="0"/></filter>'
        f'</defs>'
    )
    head = [
        f'<rect width="{W}" height="{H}" fill="url(#paper{gid})"/>',
        body,
        frame(pal, 0.9),
        f'<rect width="{W}" height="{H}" fill="url(#vig{gid})"/>',
        f'<rect width="{W}" height="{H}" filter="url(#grain{gid})" opacity="0.055"/>',
    ]
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
            f'role="img" aria-label="정운타임즈 일러스트 · {scene}">'
            f'<title>정운타임즈 일러스트</title>{defs}{"".join(head)}</svg>')


def path_for(key: str) -> str:
    safe = re.sub(r"[^0-9a-zA-Z가-힣._-]+", "-", str(key)).strip("-")[:70]
    return os.path.join(ART_DIR, safe + ".svg")


def ensure(key: str, force: bool = False, palette_idx: int | None = None, motif: str | None = None,
           subject: str | None = None) -> str:
    """키에 대응하는 그림 파일을 만들고 지면에 쓸 상대 경로(g/xxx.svg)를 돌려준다."""
    os.makedirs(ART_DIR, exist_ok=True)
    p = path_for(key)
    if force or not os.path.exists(p) or os.path.getsize(p) < 900:
        with open(p, "w", encoding="utf-8") as f:
            f.write(make_svg(key, motif=motif, palette_idx=palette_idx, subject=subject))
    return "g/" + os.path.basename(p)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--keys", nargs="*", default=[])
    ap.add_argument("--all", action="store_true", help="assets/img/g/*.svg 전부 새로 그리기")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    keys = list(a.keys)
    if a.all:
        keys += [os.path.splitext(os.path.basename(p))[0] for p in glob.glob(os.path.join(ART_DIR, "*.svg"))]
        keys = sorted(set(keys))
        a.force = True
    if not keys:
        print("그릴 키가 없습니다. --keys <키...> 또는 --all")
        return 1
    for k in keys:
        rel = ensure(k, force=a.force)
        print(f"  {k:34s} {scene_for(k):9s} → assets/img/{rel}")
    print(f"총 {len(keys)}장 · 저장 위치 assets/img/g/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
