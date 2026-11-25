#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""정운타임즈 · 기사 전용 일러스트 생성기 (make_art.py)

기사 하나에 그림 하나. 같은 그림이 두 기사에 쓰이지 않도록,
기사 id(또는 임의의 고유 키)를 씨앗으로 삼아 **매번 다른** 동양풍 SVG 일러스트를 그린다.

  · 외부 API·유료 이미지 없음. 표준 라이브러리만 쓴다.
  · 결정적(deterministic) — 같은 키는 항상 같은 그림이 나온다(재실행해도 그림이 바뀌지 않음).
  · 16:9 (1200×675) — 카드 썸네일·기사 대표 그림·매거진 카드에 모두 맞는다.
  · 팔레트 14종 × 구도 8종(산·먹그림·물결·탑·소나무·매화·대나무·달빛) × 요소 조합으로 수천 가지.

사용
  python3 scripts/make_art.py --keys today-20261125 money-20261125 mbti-20261125
  python3 scripts/make_art.py --all-static          # 정적 기사·매거진 카드 전부
  (daily_update.py 는 ensure() 를 직접 불러 그날 기사 그림을 만든다)
"""
from __future__ import annotations

import argparse
import hashlib
import math
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART_DIR = os.path.join(ROOT, "assets", "img", "g")

W, H = 1200, 675

# ---------------------------------------------------------------- 팔레트
# (하늘 위, 하늘 아래, 먹(산·나무), 강조(해·달·꽃), 안개)
PALETTES = [
    ("#f7f1e3", "#e6d6b8", "#2b2721", "#c19a4e", "#fffaf0"),   # 한지 새벽
    ("#101b29", "#20374c", "#0a1119", "#e6c078", "#7f97ab"),   # 달밤
    ("#eef2e9", "#cfdccc", "#22302a", "#5b7d55", "#f8fbf6"),   # 소나무 숲
    ("#2a1f2b", "#553139", "#170f18", "#d99a5b", "#8d6470"),   # 노을
    ("#e9f1ed", "#c2d9d1", "#1e3a35", "#7ba294", "#f6fbf9"),   # 청자
    ("#f4f2ec", "#d4cec0", "#1b1b1b", "#8a8070", "#fbfaf5"),   # 수묵
    ("#191310", "#33261a", "#0c0906", "#d9b169", "#6d5a3c"),   # 금야
    ("#faf0ea", "#ecd3c8", "#3a2721", "#b8705d", "#fffaf7"),   # 연분홍
    ("#0f241f", "#204236", "#08130f", "#8fc0a4", "#5d8574"),   # 옥빛 밤
    ("#16203a", "#28345e", "#0b1122", "#aebbe8", "#6f7ba6"),   # 남색
    ("#f5ead3", "#e0c9a0", "#3b2f1f", "#9c7836", "#fdf7e8"),   # 모래
    ("#f8ede3", "#ead0bf", "#3b1f1a", "#b04c33", "#fff8f2"),   # 주홍
    ("#eaf0f4", "#c5d7e3", "#1d2b36", "#5f8095", "#f7fbfe"),   # 수평선
    ("#f3efe6", "#d8cdb9", "#332d24", "#a98b52", "#fffdf6"),   # 낡은 책
]

MOTIFS = ["mountain", "mountain", "enso", "wave", "pagoda", "pine", "bamboo", "plum", "moonlit"]


def _h(key: str) -> int:
    return int(hashlib.sha256(str(key).encode("utf-8")).hexdigest()[:16], 16)


def _lum(hexcolor: str) -> float:
    c = hexcolor.lstrip("#")
    r, g, b = int(c[0:2], 16) / 255, int(c[2:4], 16) / 255, int(c[4:6], 16) / 255
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


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
        return int(self.r(a, b + 1)) if b >= a else a

    def pick(self, seq):
        return seq[self.n() % len(seq)]


# ---------------------------------------------------------------- 도형
def _ridge(rng: Rng, base_y: float, amp: float, seg: int = 5) -> str:
    """산 능선 path — 봉우리와 골짜기를 이어 만든다."""
    seg = max(3, seg)
    pts = [(-30.0, base_y + rng.r(10, 40))]
    for k in range(1, seg):
        x = W * k / seg + rng.r(-W / (seg * 3), W / (seg * 3))
        pts.append((x, base_y - rng.r(0.35, 1.0) * amp))
        pts.append((x + W / (seg * 2) + rng.r(-30, 30), base_y + rng.r(4, 0.22 * amp)))
    pts.append((W + 30.0, base_y + rng.r(10, 40)))
    d = f"M -30 {H + 30} L {pts[0][0]:.1f} {pts[0][1]:.1f} "
    for i in range(1, len(pts)):
        px, py = pts[i - 1]
        cx, cy = pts[i]
        d += f"Q {px:.1f} {py:.1f} {(px + cx) / 2:.1f} {(py + cy) / 2:.1f} "
    d += f"L {pts[-1][0]:.1f} {pts[-1][1]:.1f} L {W + 30} {H + 30} Z"
    return d


def _pine(x: float, y: float, h: float, ink: str, op: float) -> str:
    out = [f'<path d="M{x:.1f} {y:.1f} v{-h:.1f}" stroke="{ink}" stroke-width="2.4" opacity="{op}"/>']
    for k in range(3):
        yy = y - h * (0.26 + 0.24 * k)
        ww = h * (0.38 - 0.07 * k)
        out.append(
            f'<path d="M{x - ww:.1f} {yy + 8:.1f} Q {x - ww * 0.4:.1f} {yy - 12:.1f} {x:.1f} {yy - 26:.1f} '
            f'Q {x + ww * 0.4:.1f} {yy - 12:.1f} {x + ww:.1f} {yy + 8:.1f} Z" '
            f'fill="{ink}" opacity="{op * 0.92:.3f}"/>'
        )
    return "".join(out)


def _bird(x: float, y: float, s: float, ink: str, op: float) -> str:
    return (f'<path d="M{x:.1f} {y:.1f} q {s * 0.45:.1f} {-s * 0.55:.1f} {s * 0.9:.1f} 0 '
            f'q {s * 0.45:.1f} {-s * 0.55:.1f} {s * 0.9:.1f} 0" fill="none" stroke="{ink}" '
            f'stroke-width="2.2" stroke-linecap="round" opacity="{op}"/>')


def _blossom(x: float, y: float, r: float, color: str, op: float) -> str:
    petals = "".join(
        f'<circle cx="{x + math.cos(a) * r * 0.85:.2f}" cy="{y + math.sin(a) * r * 0.85:.2f}" '
        f'r="{r * 0.52:.2f}" fill="{color}" opacity="{op}"/>'
        for a in [0, 1.2566, 2.5133, 3.7699, 5.0265]
    )
    return petals + f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r * 0.34:.2f}" fill="#f7e6b8" opacity="{op}"/>'


def _enso(cx: float, cy: float, r: float, ink: str, op: float, rng: Rng) -> str:
    """먹그림 원(禪圓) — 붓이 지나간 자국처럼 두께를 달리해 두 번 긋는다."""
    a0 = rng.r(-0.6, 0.4)
    sweep = rng.r(5.3, 5.95)
    def arc(rr, sw, aa0, aa1, o):
        x1, y1 = cx + rr * math.cos(aa0), cy + rr * math.sin(aa0)
        x2, y2 = cx + rr * math.cos(aa1), cy + rr * math.sin(aa1)
        large = 1 if (aa1 - aa0) % (2 * math.pi) > math.pi else 0
        return (f'<path d="M{x1:.1f} {y1:.1f} A {rr:.1f} {rr:.1f} 0 {large} 1 {x2:.1f} {y2:.1f}" '
                f'fill="none" stroke="{ink}" stroke-width="{sw:.1f}" stroke-linecap="round" opacity="{o}"/>')
    return (arc(r, rng.r(26, 40), a0, a0 + sweep * 0.62, op)
            + arc(r * 0.995, rng.r(10, 18), a0 + sweep * 0.6, a0 + sweep, op * 0.9))


def _pagoda(x: float, y: float, w: float, ink: str, op: float) -> str:
    """탑 실루엣 — 5층 지붕과 상륜."""
    out = []
    tiers = 5
    body_w = w * 0.42
    for k in range(tiers):
        ty = y - k * w * 0.42
        tw = w * (1 - k * 0.14)
        roof_h = w * 0.16
        out.append(
            f'<path d="M{x - tw / 2:.1f} {ty:.1f} Q {x - tw * 0.22:.1f} {ty - roof_h:.1f} {x:.1f} {ty - roof_h * 1.35:.1f} '
            f'Q {x + tw * 0.22:.1f} {ty - roof_h:.1f} {x + tw / 2:.1f} {ty:.1f} '
            f'L {x + tw / 2 - 4:.1f} {ty + 4:.1f} L {x - tw / 2 + 4:.1f} {ty + 4:.1f} Z" fill="{ink}" opacity="{op}"/>'
        )
        out.append(f'<rect x="{x - body_w / 2 + k * 0.6:.1f}" y="{ty:.1f}" width="{body_w - k * 1.2:.1f}" '
                   f'height="{w * 0.42 - 8:.1f}" fill="{ink}" opacity="{op * 0.82:.3f}"/>')
    top = y - tiers * w * 0.42
    out.append(f'<path d="M{x:.1f} {top:.1f} v{-w * 0.34:.1f}" stroke="{ink}" stroke-width="3" opacity="{op}"/>')
    out.append(f'<circle cx="{x:.1f}" cy="{top - w * 0.4:.1f}" r="{w * 0.05:.1f}" fill="{ink}" opacity="{op}"/>')
    return "".join(out)


def _waves(rng: Rng, y0: float, ink: str, accent: str) -> str:
    """겹겹 물결 — 아래로 갈수록 진하게."""
    out = []
    layers = rng.i(3, 4)
    for k in range(layers):
        yy = y0 + k * (H - y0) / (layers + 0.6)
        op = 0.18 + 0.14 * k
        step = rng.r(150, 240)
        d = f"M -30 {yy:.1f} "
        x = -30.0
        flip = 1
        while x < W + 30:
            d += f"q {step / 2:.1f} {(-1 if flip > 0 else 1) * rng.r(12, 34):.1f} {step:.1f} 0 "
            x += step
            flip *= -1
        d += f"L {W + 30} {H + 30} L -30 {H + 30} Z"
        out.append(f'<path d="{d}" fill="{ink}" opacity="{op:.2f}"/>')
        # 물마루의 거품 점
        if k == layers - 1:
            for _ in range(rng.i(6, 12)):
                cx = rng.r(0, W)
                cy = yy + rng.r(-18, 8)
                out.append(f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{rng.r(2, 5):.1f}" fill="{accent}" opacity="{rng.r(0.25, 0.6):.2f}"/>')
    return "".join(out)


def make_svg(key: str, motif: str | None = None, palette_idx: int | None = None) -> str:
    h = _h(key)
    rng = Rng(h)
    pal = PALETTES[(h >> 8) % len(PALETTES)] if palette_idx is None else PALETTES[int(palette_idx) % len(PALETTES)]
    sky_a, sky_b, ink, accent, mist = pal
    light = _lum(sky_b) > 0.55
    gid = (h % 99991)
    if motif is None:
        motif = rng.pick(MOTIFS)

    want_water = motif in ("wave", "moonlit")
    want_pine = motif == "pine"
    want_plum = motif == "plum"
    want_bamboo = motif == "bamboo"
    want_birds = rng.r() < 0.5
    want_stars = (not light) and (motif == "moonlit" or rng.r() < 0.45)
    want_disc = motif not in ("enso",)
    want_clouds = rng.r() < 0.6

    disc_x = rng.r(W * 0.56, W * 0.88) if motif != "enso" else 0
    disc_y = rng.r(H * 0.15, H * 0.4)
    disc_r = rng.r(62, 140)

    p: list[str] = []
    p.append(
        f'<defs>'
        f'<linearGradient id="sky{gid}" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0" stop-color="{sky_a}"/><stop offset="1" stop-color="{sky_b}"/></linearGradient>'
        f'<radialGradient id="disc{gid}" cx="0.42" cy="0.38" r="0.62">'
        f'<stop offset="0" stop-color="{accent}" stop-opacity="0.98"/>'
        f'<stop offset="0.72" stop-color="{accent}" stop-opacity="0.86"/>'
        f'<stop offset="1" stop-color="{accent}" stop-opacity="0.55"/></radialGradient>'
        f'<linearGradient id="mist{gid}" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0" stop-color="{mist}" stop-opacity="0"/>'
        f'<stop offset="0.5" stop-color="{mist}" stop-opacity="{0.6 if light else 0.38}"/>'
        f'<stop offset="1" stop-color="{mist}" stop-opacity="0"/></linearGradient>'
        f'<linearGradient id="fade{gid}" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0" stop-color="{sky_b}" stop-opacity="0"/>'
        f'<stop offset="1" stop-color="{sky_b}" stop-opacity="{0.55 if light else 0.3}"/></linearGradient>'
        f'<radialGradient id="vig{gid}" cx="0.5" cy="0.45" r="0.8">'
        f'<stop offset="0.55" stop-color="#000" stop-opacity="0"/>'
        f'<stop offset="1" stop-color="#000" stop-opacity="{0.09 if light else 0.32}"/></radialGradient>'
        f'<filter id="grain{gid}" x="0" y="0" width="100%" height="100%">'
        f'<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>'
        f'<feColorMatrix type="saturate" values="0"/></filter>'
        f'</defs>'
    )
    p.append(f'<rect width="{W}" height="{H}" fill="url(#sky{gid})"/>')

    if want_stars:
        p.append("<g>")
        for _ in range(rng.i(30, 60)):
            x, y = rng.r(0, W), rng.r(0, H * 0.6)
            r = rng.r(0.8, 2.4)
            p.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.1f}" fill="{mist}" opacity="{rng.r(0.2, 0.8):.2f}"/>')
        p.append("</g>")

    # ---- 해·달
    if want_disc:
        p.append(
            f'<g><circle cx="{disc_x:.0f}" cy="{disc_y:.0f}" r="{disc_r * 1.95:.0f}" fill="none" '
            f'stroke="{accent}" stroke-width="1.1" opacity="0.14"/>'
            f'<circle cx="{disc_x:.0f}" cy="{disc_y:.0f}" r="{disc_r * 1.42:.0f}" fill="none" '
            f'stroke="{accent}" stroke-width="1.1" opacity="0.2"/>'
            f'<circle cx="{disc_x:.0f}" cy="{disc_y:.0f}" r="{disc_r:.0f}" fill="url(#disc{gid})"/></g>'
        )

    # ---- 구름 띠
    if want_clouds:
        for _ in range(rng.i(1, 3)):
            cy = rng.r(H * 0.18, H * 0.52)
            ch = rng.r(14, 34)
            cw = rng.r(W * 0.32, W * 0.66)
            cx = rng.r(-70, W - cw * 0.35)
            p.append(f'<rect x="{cx:.0f}" y="{cy:.0f}" width="{cw:.0f}" height="{ch:.0f}" rx="{ch / 2:.0f}" '
                     f'fill="url(#mist{gid})" opacity="{rng.r(0.6, 1.0):.2f}"/>')

    # ---- 구도별 몸통
    if motif == "enso":
        p.append(f'<path d="M0 {H * 0.72:.0f} h{W}" stroke="{ink}" stroke-width="1.4" opacity="0.18"/>')
        p.append(_enso(rng.r(W * 0.34, W * 0.52), rng.r(H * 0.42, H * 0.5), rng.r(150, 210), ink, 0.72, rng))
        for _ in range(rng.i(2, 6)):
            p.append(f'<circle cx="{rng.r(W * 0.2, W * 0.85):.0f}" cy="{rng.r(H * 0.75, H * 0.95):.0f}" '
                     f'r="{rng.r(2, 7):.1f}" fill="{ink}" opacity="{rng.r(0.15, 0.4):.2f}"/>')
        p.append(f'<path d="M{rng.r(60, 240):.0f} {H * 0.86:.0f} q 120 -26 250 -6" fill="none" stroke="{ink}" '
                 f'stroke-width="3" stroke-linecap="round" opacity="0.25"/>')

    if motif == "wave":
        p.append(_waves(rng, H * rng.r(0.5, 0.6), ink, accent))

    if motif == "pagoda":
        base = H * rng.r(0.66, 0.74)
        for k in range(rng.i(3, 4)):
            p.append(f'<path d="{_ridge(rng, base + k * 26, rng.r(70, 130), rng.i(4, 6))}" fill="{ink}" '
                     f'opacity="{0.12 + 0.11 * k:.2f}"/>')
        p.append(_pagoda(rng.r(W * 0.62, W * 0.8), base - 26, rng.r(110, 150), ink, 0.62))
        for _ in range(rng.i(2, 5)):
            p.append(_pine(rng.r(0, W), base + rng.r(16, 40), rng.r(60, 120), ink, 0.5))

    if motif in ("mountain", "pine", "plum", "bamboo", "moonlit", "pagoda") and motif != "wave":
        base = H * (0.62 if want_water else 0.7)
        for k in range(rng.i(3, 5)):
            p.append(f'<path d="{_ridge(rng, base + k * rng.r(18, 34), rng.r(70, 150) * (1 - k * 0.1), rng.i(4, 7))}" '
                     f'fill="{ink}" opacity="{(0.11 + 0.115 * k) * (0.8 if light else 1.0):.3f}"/>')

    if want_water and motif != "wave":
        wy = H * rng.r(0.72, 0.8)
        p.append(f'<rect x="0" y="{wy:.0f}" width="{W}" height="{H - wy:.0f}" fill="{ink}" opacity="0.07"/>')
        for k in range(rng.i(6, 11)):
            y = wy + (H - wy) * (k + 1) / 9
            x1 = rng.r(0, W * 0.5)
            ln = rng.r(W * 0.14, W * 0.46)
            p.append(f'<path d="M{x1:.0f} {y:.0f} h{ln:.0f}" stroke="{ink}" stroke-width="{rng.r(1, 2.4):.1f}" '
                     f'stroke-linecap="round" opacity="{rng.r(0.1, 0.3):.3f}"/>')
        if want_disc:
            for k in range(rng.i(3, 6)):
                y = wy + (H - wy) * (k + 1) / 7
                ln = disc_r * rng.r(0.7, 1.5) * (1 + k * 0.22)
                p.append(f'<path d="M{disc_x - ln / 2:.0f} {y:.0f} h{ln:.0f}" stroke="{accent}" '
                         f'stroke-width="2.6" stroke-linecap="round" opacity="{rng.r(0.22, 0.45):.3f}"/>')

    if want_pine:
        hill = H * rng.r(0.76, 0.88)
        p.append(f'<path d="{_ridge(rng, hill, rng.r(30, 60), 5)}" fill="{ink}" opacity="{0.55 if light else 0.66}"/>')
        for _ in range(rng.i(4, 8)):
            p.append(_pine(rng.r(-20, W + 20), hill + rng.r(2, 26), rng.r(80, 170), ink, rng.r(0.45, 0.85)))

    if want_plum:
        side = rng.pick([0, 1])
        sx = -30 if side == 0 else W + 30
        sy = rng.r(H * 0.85, H * 1.02)
        dirx = 1 if side == 0 else -1
        p1 = (sx + dirx * rng.r(50, 90), sy - rng.r(90, 150))
        p2 = (sx + dirx * rng.r(140, 210), sy - rng.r(190, 260))
        tip = (sx + dirx * rng.r(200, 300), sy - rng.r(250, 330))
        p.append(f'<path d="M{sx:.0f} {sy:.0f} C {p1[0]:.0f} {p1[1]:.0f} {p2[0]:.0f} {p2[1]:.0f} {tip[0]:.0f} {tip[1]:.0f}" '
                 f'fill="none" stroke="{ink}" stroke-width="{rng.r(10, 15):.1f}" stroke-linecap="round" opacity="0.68"/>')
        p.append(f'<path d="M{p1[0]:.0f} {p1[1]:.0f} q {dirx * 40:.0f} -60 {-dirx * 10:.0f} -110" fill="none" '
                 f'stroke="{ink}" stroke-width="{rng.r(4, 7):.1f}" stroke-linecap="round" opacity="0.55"/>')
        for k in range(rng.i(10, 16)):
            t = (k + 1) / 18
            bx = (1 - t) ** 3 * sx + 3 * (1 - t) ** 2 * t * p1[0] + 3 * (1 - t) * t ** 2 * p2[0] + t ** 3 * tip[0]
            by = (1 - t) ** 3 * sy + 3 * (1 - t) ** 2 * t * p1[1] + 3 * (1 - t) * t ** 2 * p2[1] + t ** 3 * tip[1]
            p.append(_blossom(bx + rng.r(-26, 26), by + rng.r(-26, 26), rng.r(10, 17),
                              rng.pick([accent, "#e8b7b0", "#f6ded6"]), rng.r(0.55, 0.95)))

    if want_bamboo:
        for _ in range(rng.i(2, 4)):
            x = rng.r(40, W - 40)
            top = rng.r(H * 0.05, H * 0.24)
            lean = rng.r(-30, 30)
            bw = rng.r(8, 13)
            p.append(f'<path d="M{x:.0f} {H + 10} L {x + lean:.0f} {top:.0f}" stroke="{ink}" '
                     f'stroke-width="{bw:.1f}" stroke-linecap="round" opacity="0.4"/>')
            for k in range(rng.i(4, 6)):
                ly = top + (H - top) * (k + 1) / 7
                lx = x + lean * (1 - (ly - top) / (H - top))
                p.append(f'<path d="M{lx - bw / 2:.0f} {ly:.0f} h{bw:.0f}" stroke="{sky_b}" stroke-width="1.8" opacity="0.55"/>')
            for k in range(rng.i(3, 5)):
                ly = top + (H - top) * (k + 1) / 8
                lx = x + lean * (1 - (ly - top) / (H - top))
                d = 1 if k % 2 == 0 else -1
                for j in range(rng.i(3, 5)):
                    ex = lx + d * rng.r(60, 130)
                    ey = ly - rng.r(10, 58) * (1 + j * 0.12)
                    ang = math.degrees(math.atan2(ey - ly, ex - lx))
                    ln = math.hypot(ex - lx, ey - ly) * rng.r(0.6, 0.9)
                    cy = (ly + ey) / 2
                    cx = (lx + ex) / 2
                    p.append(f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{ln / 2:.1f}" ry="{rng.r(4, 7):.1f}" '
                             f'fill="{ink}" opacity="{rng.r(0.3, 0.5):.2f}" '
                             f'transform="rotate({ang:.1f} {cx:.1f} {cy:.1f})"/>')

    if want_birds:
        bx, by = rng.r(W * 0.08, W * 0.45), rng.r(H * 0.12, H * 0.32)
        p.append("<g>")
        for k in range(rng.i(2, 5)):
            p.append(_bird(bx + k * rng.r(26, 48), by + rng.r(-24, 24), rng.r(7, 13), ink, rng.r(0.35, 0.7)))
        p.append("</g>")

    # ---- 지면 안개·번짐·먼지
    p.append(f'<rect x="0" y="{H * 0.55:.0f}" width="{W}" height="{H * 0.45:.0f}" fill="url(#fade{gid})"/>')
    for _ in range(rng.i(0, 3)):
        p.append(f'<circle cx="{rng.r(0, W):.0f}" cy="{rng.r(0, H):.0f}" r="{rng.r(30, 120):.0f}" '
                 f'fill="{ink}" opacity="{rng.r(0.015, 0.05):.3f}"/>')
    p.append(f'<rect width="{W}" height="{H}" fill="url(#vig{gid})"/>')
    p.append(f'<rect width="{W}" height="{H}" filter="url(#grain{gid})" opacity="{0.05 if light else 0.1}"/>')

    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
            f'role="img" aria-label="정운타임즈 동양풍 일러스트">'
            f'<title>정운타임즈 일러스트</title>{"".join(p)}</svg>')


def path_for(key: str) -> str:
    safe = re.sub(r"[^0-9a-zA-Z가-힣._-]+", "-", str(key)).strip("-")[:70]
    return os.path.join(ART_DIR, safe + ".svg")


def ensure(key: str, force: bool = False, palette_idx: int | None = None, motif: str | None = None) -> str:
    """키에 대응하는 그림 파일을 만들고, 지면에 쓸 상대 경로(g/xxx.svg)를 돌려준다.
    palette_idx·motif 를 주면 그 값으로 강제한다(매거진처럼 한 화면에 여러 장이 붙는 자리에서 색이 겹치지 않게)."""
    os.makedirs(ART_DIR, exist_ok=True)
    p = path_for(key)
    if force or not os.path.exists(p) or os.path.getsize(p) < 400:
        with open(p, "w", encoding="utf-8") as f:
            f.write(make_svg(key, motif=motif, palette_idx=palette_idx))
    return "g/" + os.path.basename(p)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--keys", nargs="*", default=[])
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()
    if not a.keys:
        print("만들 키가 없습니다. --keys <키...>")
        return 1
    for k in a.keys:
        rel = ensure(k, force=a.force)
        print(f"  {k:34s} → assets/img/{rel}")
    print(f"총 {len(a.keys)}장 · 저장 위치 assets/img/g/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
