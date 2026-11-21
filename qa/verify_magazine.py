"""정운타임즈 매거진 포털 — 로컬 검수 (Playwright)
사용: LD_LIBRARY_PATH=... python3 qa/verify.py
"""
import json, os, sys, threading, functools, http.server, socketserver, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
CHROME = '/workspace/.cache/dl/chrome-linux64/chrome'
OUT = ROOT / 'qa'
OUT.mkdir(exist_ok=True)
os.makedirs('/workspace/downloads', exist_ok=True)

PORT = 8131
Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
Handler = functools.partial(Q, directory=str(ROOT))
class Srv(socketserver.TCPServer):
    allow_reuse_address = True
httpd = Srv(('127.0.0.1', PORT), Handler)
threading.Thread(target=httpd.serve_forever, daemon=True).start()

from playwright.sync_api import sync_playwright

report = {'console': [], 'console_count': {}, 'checks': [], 'shots': []}
errors = []


def scroll_all(pg, step=700, pause=90):
    h = pg.evaluate("document.body.scrollHeight")
    y = 0
    while y < h:
        pg.evaluate(f"window.scrollTo(0,{y})")
        pg.wait_for_timeout(pause)
        y += step
        h = pg.evaluate("document.body.scrollHeight")
    pg.evaluate("window.scrollTo(0,0)")
    pg.wait_for_timeout(250)

def check(name, ok, detail=''):
    report['checks'].append({'name': name, 'ok': bool(ok), 'detail': str(detail)[:400]})
    print(('PASS ' if ok else 'FAIL ') + name + ((' — ' + str(detail)[:200]) if detail else ''))

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox', '--font-render-hinting=none'])
    ctx = browser.new_context(viewport={'width': 1440, 'height': 940}, device_scale_factor=1, locale='ko-KR')
    page = ctx.new_page()

    def on_console(m):
        if m.type in ('error', 'warning'):
            errors.append({'type': m.type, 'text': m.text[:400]})
    page.on('console', on_console)
    page.on('pageerror', lambda e: errors.append({'type': 'pageerror', 'text': str(e)[:400]}))

    base = f'http://127.0.0.1:{PORT}/'
    page.goto(base, wait_until='networkidle')
    page.emulate_media(reduced_motion='reduce')
    page.wait_for_timeout(1400)

    # 1. 홈
    check('홈 타이틀', '정운타임즈' in page.title(), page.title())
    check('홈 히어로 이미지 로드', page.evaluate("(()=>{const i=document.querySelector('.hero__art img');return i&&i.complete&&i.naturalWidth>0})()"))
    check('홈 여섯 카드', page.locator('.gate').count() >= 6, page.locator('.gate').count())
    check('홈 49격자', page.locator('.lab__cell').count() == 49, page.locator('.lab__cell').count())
    scroll_all(page)
    check('홈 가로 스크롤 없음', page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 2"), page.evaluate("document.documentElement.scrollWidth"))
    check('홈 전체 리빌 노출', page.evaluate("Array.from(document.querySelectorAll('[data-reveal]')).every(e=>e.classList.contains('is-in'))"))
    page.screenshot(path=str(OUT / 'desktop_home.png'), full_page=True)
    report['shots'].append(str(OUT / 'desktop_home.png'))

    # 2. 라우트별 진입 + 콘솔
    routes = ['today', 'people', 'mbti', 'dream', 'pastlife', 'shop']
    for r in routes:
        page.goto(base + '#/' + r, wait_until='load')
        page.wait_for_timeout(500)
        h1 = page.locator('.phero__title').first.inner_text()
        check(f'라우트 #{r}', len(h1) > 0, h1)
        check(f'라우트 #{r} nav active', page.locator('.navitem.is-on').count() == 1)

    # 3. 오늘의 운세 실제 계산
    page.goto(base + '#/today', wait_until='load')
    page.wait_for_timeout(400)
    page.fill('#todayForm [name="birth"]', '1977-01-06')
    page.click('#todayForm button[type="submit"]')
    page.wait_for_timeout(700)
    card = page.locator('#todayResult .vcard')
    check('운세 결과 카드', card.count() == 1)
    title = page.locator('#todayResult .vcard__title').inner_text()
    check('운세 헤드라인 생성', len(title) > 6, title)
    check('운세 점수', page.locator('.score__num').first.inner_text().strip() != '', page.locator('.score__num').first.inner_text())
    nums = page.locator('#todayResult .vcard__kv div').nth(1).inner_text()
    check('행운 숫자/색 노출', '행운' in page.locator('#todayResult .vcard__kv').inner_text())
    page.screenshot(path=str(OUT / 'desktop_today.png'), full_page=False)
    report['shots'].append(str(OUT / 'desktop_today.png'))

    # 공유 카드
    page.click('#todayResult [data-today-share]')
    page.wait_for_timeout(900)
    check('공유 카드 모달', page.locator('.shareprev img').count() == 1)
    src = page.evaluate("document.querySelector('.shareprev img').getAttribute('src').slice(0,30)")
    check('공유 카드 canvas 데이터', src.startswith('data:image/png'), src)
    page.screenshot(path=str(OUT / 'desktop_share.png'))
    report['shots'].append(str(OUT / 'desktop_share.png'))
    page.keyboard.press('Escape')
    page.wait_for_timeout(300)

    # 990 모달
    page.click('#todayResult [data-today-pay]')
    page.wait_for_timeout(500)
    check('990원 모달', page.locator('.pay__price').count() == 1, page.locator('.pay__price').first.inner_text())
    check('990 CTA 카카오', page.locator('.pay__acts a[href*="pf.kakao"]').count() == 1)
    page.keyboard.press('Escape')
    page.wait_for_timeout(300)

    # 4. 화제의 사주
    page.goto(base + '#/people', wait_until='load')
    page.wait_for_timeout(400)
    check('화제 카드 8개', page.locator('[data-person]').count() == 8, page.locator('[data-person]').count())
    page.locator('[data-person]').first.click()
    page.wait_for_timeout(500)
    check('인물 상세 모달', page.locator('#sheetBody .vcard').count() == 1)
    page.keyboard.press('Escape')
    page.wait_for_timeout(300)

    # 5. MBTI
    page.goto(base + '#/mbti', wait_until='load')
    page.wait_for_timeout(400)
    page.click('[data-mbti-group="me"] [data-mbti="ENFP"]')
    page.click('[data-mbti-group="you"] [data-mbti="ISTJ"]')
    page.click('#mbtiGo')
    page.wait_for_timeout(400)
    score = page.locator('#mbtiResult .score__num').inner_text()
    check('MBTI 궁합 점수', score.strip() != '', score)
    page.click('[data-mbti-share]')
    page.wait_for_timeout(700)
    check('MBTI 공유 카드', page.locator('.shareprev canvas, .shareprev img').count() == 1)
    page.keyboard.press('Escape')
    page.wait_for_timeout(300)
    page.click('#mbtiUnlockBtn')
    page.wait_for_timeout(400)
    for i, n in enumerate(['민수', '지영', '도현'], 1):
        page.fill(f'#sheetBody [name="f{i}"]', n)
    page.click('#unlockGo')
    page.wait_for_timeout(500)
    check('친구 3명 잠금 해제', page.locator('#mbtiLock.is-open').count() == 1)
    page.keyboard.press('Escape')
    page.wait_for_timeout(200)
    page.screenshot(path=str(OUT / 'desktop_mbti.png'), full_page=False)
    report['shots'].append(str(OUT / 'desktop_mbti.png'))

    # 6. 꿈
    page.goto(base + '#/dream', wait_until='load')
    page.wait_for_timeout(400)
    page.fill('#dreamForm [name="q"]', '뱀')
    page.click('#dreamForm button[type="submit"]')
    page.wait_for_timeout(500)
    check('꿈 풀이 결과', page.locator('#dreamResult .vcard__title').count() == 1, page.locator('#dreamResult .vcard__title').inner_text())
    check('행운 번호 6개', page.locator('#dreamResult .lnum').count() == 6, page.locator('#dreamResult .lnum').count())
    page.fill('#dreamForm [name="q"]', '우주선에 타는 꿈')
    page.click('#dreamForm button[type="submit"]')
    page.wait_for_timeout(400)
    check('사전에 없는 꿈 자동 매칭', '자동 매칭' in page.locator('#dreamResult').inner_text())
    page.screenshot(path=str(OUT / 'desktop_dream.png'), full_page=False)
    report['shots'].append(str(OUT / 'desktop_dream.png'))

    # 7. 전생
    page.goto(base + '#/pastlife', wait_until='load')
    page.wait_for_timeout(400)
    page.fill('#plForm [name="birth"]', '1988-03-15')
    page.click('#plForm button[type="submit"]')
    page.wait_for_timeout(500)
    check('전생 결과', page.locator('.pl-role').count() >= 1, page.locator('.pl-role').first.inner_text())
    page.screenshot(path=str(OUT / 'desktop_pastlife.png'), full_page=False)
    report['shots'].append(str(OUT / 'desktop_pastlife.png'))
    page.click('[data-pl-share]')
    page.wait_for_timeout(700)
    check('전생 공유 카드', page.locator('.shareprev img').count() == 1)
    page.keyboard.press('Escape')
    page.wait_for_timeout(200)

    # 8. 숍
    page.goto(base + '#/shop?oh=1', wait_until='load')
    page.wait_for_timeout(400)
    n_fire = page.locator('#shopGrid .pcard').count()
    check('숍 화(火) 필터', n_fire == 3, n_fire)
    page.click('[data-tab="book"]')
    page.wait_for_timeout(300)
    check('숍 책 필터', page.locator('#shopGrid .pcard').count() >= 3, page.locator('#shopGrid .pcard').count())
    page.screenshot(path=str(OUT / 'desktop_shop.png'), full_page=False)
    report['shots'].append(str(OUT / 'desktop_shop.png'))

    # 9. 운명연구소 퀴즈
    page.goto(base + '#/', wait_until='load')
    page.wait_for_timeout(400)
    page.click('#labStart')
    page.wait_for_timeout(400)
    for q in range(6):
        page.locator(f'.quiz__opts[data-q="{q}"] .quiz__opt').nth(q % 2).click()
    page.click('#labForm button[type="submit"]')
    page.wait_for_timeout(500)
    check('49유형 결과', page.locator('.typegrid span.on').count() == 1, page.locator('.typegrid span.on').count())
    page.screenshot(path=str(OUT / 'desktop_lab.png'))
    report['shots'].append(str(OUT / 'desktop_lab.png'))
    page.keyboard.press('Escape')

    # 10. 모바일
    m = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale='ko-KR')
    mp = m.new_page()
    mp.on('console', on_console)
    mp.on('pageerror', lambda e: errors.append({'type': 'pageerror', 'text': 'mobile: ' + str(e)[:400]}))
    mp.goto(base, wait_until='networkidle')
    mp.wait_for_timeout(1000)
    scroll_all(mp)
    check('모바일 가로그램 없음', mp.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), mp.evaluate("document.documentElement.scrollWidth"))
    check('모바일 메뉴 버튼', mp.locator('#burger').is_visible())
    mp.screenshot(path=str(OUT / 'mobile_home.png'), full_page=False)
    report['shots'].append(str(OUT / 'mobile_home.png'))
    mp.goto(base + '#/today', wait_until='load')
    mp.wait_for_timeout(400)
    mp.fill('#todayForm [name="birth"]', '1992-07-21')
    mp.click('#todayForm button[type="submit"]')
    mp.wait_for_timeout(600)
    check('모바일 운세 결과', mp.locator('#todayResult .vcard').count() == 1)
    mp.screenshot(path=str(OUT / 'mobile_today.png'), full_page=False)
    report['shots'].append(str(OUT / 'mobile_today.png'))
    mp.goto(base + '#/dream', wait_until='load')
    mp.wait_for_timeout(400)
    mp.fill('#dreamForm [name="q"]', '바다')
    mp.click('#dreamForm button[type="submit"]')
    mp.wait_for_timeout(500)
    check('모바일 꿈 결과', mp.locator('#dreamResult .lnum').count() == 6)
    mp.screenshot(path=str(OUT / 'mobile_dream.png'), full_page=False)
    report['shots'].append(str(OUT / 'mobile_dream.png'))

    # 최종 산출물 (브리프 지정 경로)
    page.goto(base, wait_until='networkidle'); page.wait_for_timeout(600); scroll_all(page, 800)
    page.screenshot(path='/workspace/downloads/jeongwoon_magazine_desktop.png', full_page=True)
    mp.goto(base, wait_until='networkidle'); mp.wait_for_timeout(900); scroll_all(mp, 700)
    mp.screenshot(path='/workspace/downloads/jeongwoon_magazine_mobile.png', full_page=True)

    # 금지어/필수 문구
    html = page.evaluate("document.documentElement.outerHTML")
    check('금지 표현(로또) 없음', '로또' not in html)
    for need in ['제이투포커스', '159-47-00699', '2022-고양일산서-1589', '경기도 고양시 일산서구 가좌동 1088', '22jutimes@gmail.com']:
        check('푸터 문구 — ' + need, need in html)
    check('카카오 플로팅 링크', 'https://pf.kakao.com/_TguvX/chat' in html)

    browser.close()

httpd.shutdown()
report['console'] = errors
from collections import Counter
report['console_count'] = dict(Counter(e['type'] for e in errors))
report['errors_total'] = len(errors)
report['fails'] = [c for c in report['checks'] if not c['ok']]
print('\n콘솔 에러/경고:', len(errors))
for e in errors[:10]:
    print(' -', e)
(OUT / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=1))
print('실패:', len(report['fails']), '총 검사:', len(report['checks']))
sys.exit(1 if report['fails'] else 0)
