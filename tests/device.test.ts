// 태블릿과 홈 화면: 기기 가리기, 홈 화면에서 열렸는지, 새 판 알아차리기의 셈, 매니페스트와 아이콘, 안내의 글.
// 브라우저 없이 돈다(실제 설치와 기기의 모습은 사용자의 점검표에서 본다).

import { describe, expect, it } from 'vitest';
import { kindOf, standaloneOf } from '../src/state/device';
import { AWAY_MS, awayLongEnough, isNewBuild, scriptNameIn } from '../src/state/update';
import {
  GUIDE_ADD,
  GUIDE_ADDED,
  GUIDE_ADDING,
  GUIDE_ADDING_LONG,
  GUIDE_AFTER,
  GUIDE_AFTER_BUTTON,
  GUIDE_LEAD,
  GUIDE_SHOW_STEPS,
  GUIDE_STEPS,
  GUIDE_TITLE,
  GUIDE_WIFI,
  guideKinds,
  guideShape,
} from '../src/ui/InstallGuide';
import { guardKeys, holdKeys, keysAreHeld, swallowIfHeld } from '../src/ui/focus';
import { OPEN_GAP_MS, TAP_GAP_MS, TapGate } from '../src/ui/taps';
import { turnNeeded } from '../src/ui/TurnNotice';

const UA = {
  galaxyTab: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  ipadChrome: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1',
  ipadDesktopSite: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  // 큰 갤럭시탭(10인치·8GB 이상)의 크롬은 "데스크톱 사이트"가 기본이라 리눅스 컴퓨터라고 말한다
  galaxyTabDesktopSite: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  chromebook: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
};

describe('기기 가리기', () => {
  it('갤럭시탭(안드로이드 크롬), 아이패드(크롬), 컴퓨터를 가린다', () => {
    expect(kindOf(UA.galaxyTab, 5)).toBe('android');
    expect(kindOf(UA.ipadChrome, 5)).toBe('ipad');
    expect(kindOf(UA.mac, 0)).toBe('other');
    expect(kindOf(UA.windows, 0)).toBe('other');
    expect(kindOf('', 0)).toBe('other');
  });

  it('아이패드가 "데스크톱 사이트"로 맥이라고 말해도 손가락 닿는 점이 여럿이면 아이패드로 본다', () => {
    expect(kindOf(UA.ipadDesktopSite, 5)).toBe('ipad');
    expect(kindOf(UA.ipadDesktopSite, 0)).toBe('other');
    // 손가락이 닿는 윈도 노트북은 태블릿으로 보지 않는다
    expect(kindOf(UA.windows, 10)).toBe('other');
  });

  it('큰 갤럭시탭이 "데스크톱 사이트"로 리눅스 컴퓨터라고 말해도 손가락 닿는 점이 여럿이면 갤럭시탭으로 본다', () => {
    expect(kindOf(UA.galaxyTabDesktopSite, 5)).toBe('android');
    expect(kindOf(UA.galaxyTabDesktopSite, 10)).toBe('android');
    // 손가락이 닿지 않는 리눅스 컴퓨터, 마우스만 있는 것처럼 점이 하나인 것은 컴퓨터다
    expect(kindOf(UA.galaxyTabDesktopSite, 0)).toBe('other');
    expect(kindOf(UA.galaxyTabDesktopSite, 1)).toBe('other');
    // 크롬북은 CrOS라고 말하므로 손가락이 닿아도 태블릿으로 보지 않는다
    expect(kindOf(UA.chromebook, 10)).toBe('other');
  });

  it('가린 갈래별: 안내가 저절로 뜨고 세로 안내가 뜨는 것은 태블릿으로 가린 기기뿐이다', () => {
    const cases: [string, number, 'android' | 'ipad' | 'other'][] = [
      [UA.galaxyTab, 5, 'android'],
      [UA.galaxyTabDesktopSite, 5, 'android'],
      [UA.ipadChrome, 5, 'ipad'],
      [UA.ipadDesktopSite, 5, 'ipad'],
      [UA.mac, 0, 'other'],
      [UA.windows, 10, 'other'],
      [UA.chromebook, 10, 'other'],
      [UA.galaxyTabDesktopSite, 0, 'other'],
    ];
    for (const [ua, touch, kind] of cases) {
      expect(kindOf(ua, touch), ua).toBe(kind);
      // 세로 안내: 태블릿이고 세로일 때만
      expect(turnNeeded(kindOf(ua, touch), true), ua).toBe(kind !== 'other');
      expect(turnNeeded(kindOf(ua, touch), false), ua).toBe(false);
    }
  });
});

describe('홈 화면에서 열렸는지', () => {
  const win = (modes: string[], standalone?: boolean) => ({
    matchMedia: (query: string) => ({ matches: modes.some((mode) => query === `(display-mode: ${mode})`) }),
    navigator: { standalone },
  });

  it('브라우저 탭이면 아니다', () => {
    expect(standaloneOf(win(['browser']))).toBe(false);
    expect(standaloneOf(win([]))).toBe(false);
  });

  it('화면 가득(매니페스트의 fullscreen)이나 따로 뜬 앱(standalone)으로 열렸으면 그렇다', () => {
    expect(standaloneOf(win(['fullscreen']))).toBe(true);
    expect(standaloneOf(win(['standalone']))).toBe(true);
    expect(standaloneOf(win(['minimal-ui']))).toBe(true);
  });

  it('WebKit이 알려 주는 값(navigator.standalone)이 참이면 그렇다', () => {
    expect(standaloneOf(win([], true))).toBe(true);
    expect(standaloneOf(win([], false))).toBe(false);
  });

  it('미디어 질의를 못 쓰는 곳에서도 던지지 않는다', () => {
    expect(standaloneOf({})).toBe(false);
    expect(
      standaloneOf({
        matchMedia: () => {
          throw new Error('막힘');
        },
      }),
    ).toBe(false);
  });
});

describe('새 판 알아차리기', () => {
  const html = (name: string): string => `<!doctype html><html><head><script type="module" crossorigin src="./assets/${name}"></script></head><body></body></html>`;

  it('첫 문서에서 코드 파일의 이름을 찾는다', () => {
    expect(scriptNameIn(html('index-BFB7H3DK.js'))).toBe('index-BFB7H3DK.js');
    expect(scriptNameIn('./assets/index-a_b-9Z.js')).toBe('index-a_b-9Z.js');
    expect(scriptNameIn('<html><body>인터넷에 연결되어 있지 않음</body></html>')).toBeNull();
    expect(scriptNameIn('/src/main.tsx')).toBeNull();
  });

  it('다른 스크립트만 있는 문서에서는 이름을 찾지 못한다(와이파이 로그인 쪽의 스크립트를 코드 파일로 잘못 보지 않는다)', () => {
    for (const other of [
      '<html><script src="/login/captive.js"></script><body>와이파이에 로그인하세요</body></html>',
      '<script src="https://example.com/assets/app.js"></script>',
      '<script type="module" src="./assets/vendor-AAAA1111.js"></script>',
      '<script src="./assets/index.js"></script>',
      '<script src="./index-AAAA1111.js"></script>',
      '<link rel="stylesheet" href="./assets/index-AAAA1111.css">',
      'assets/index-.js',
    ]) {
      expect(scriptNameIn(other), other).toBeNull();
      expect(isNewBuild('./assets/index-AAAA1111.js', other), other).toBe(false);
    }
  });

  it('코드 파일의 이름이 다를 때만 새 판이다', () => {
    expect(isNewBuild('./assets/index-AAAA1111.js', html('index-BBBB2222.js'))).toBe(true);
    expect(isNewBuild('./assets/index-AAAA1111.js', html('index-AAAA1111.js'))).toBe(false);
    // 주소의 앞부분이 달라도(상대 주소, 절대 주소) 이름이 같으면 같은 판이다
    expect(isNewBuild('https://joseon-year.vercel.app/assets/index-AAAA1111.js', html('index-AAAA1111.js'))).toBe(false);
  });

  it('어느 한쪽이라도 이름을 모르면 아무것도 하지 않는다(개발 서버, 받다 만 문서, 다른 화면)', () => {
    expect(isNewBuild(null, html('index-BBBB2222.js'))).toBe(false);
    expect(isNewBuild('/src/main.tsx', html('index-BBBB2222.js'))).toBe(false);
    expect(isNewBuild('./assets/index-AAAA1111.js', '')).toBe(false);
    expect(isNewBuild('./assets/index-AAAA1111.js', '<html>와이파이에 로그인하세요</html>')).toBe(false);
  });

  it('30분 넘게 가려졌다 돌아왔을 때만 본다', () => {
    expect(AWAY_MS).toBe(30 * 60 * 1000);
    const t = 1_000_000_000;
    expect(awayLongEnough(null, t)).toBe(false);
    expect(awayLongEnough(t, t + 60 * 1000)).toBe(false);
    expect(awayLongEnough(t, t + AWAY_MS - 1)).toBe(false);
    expect(awayLongEnough(t, t + AWAY_MS)).toBe(true);
    expect(awayLongEnough(t, t + 8 * 60 * 60 * 1000)).toBe(true);
  });
});

describe('홈 화면에 추가하는 법(spec 5.4의 글)', () => {
  it('뼈대: 추가하면 기록이 안전하다, 늘 느티나무로 연다, 아이콘으로 열 때도 와이파이가 있어야 한다', () => {
    expect(GUIDE_TITLE).toBe('홈 화면에 추가하면 기록이 안전해요');
    expect(GUIDE_LEAD).toContain('늘 느티나무');
    // "이 창"은 안내 종이로 읽히기 쉬워 무엇을 닫는지 적는다(review 3번 ㉠)
    expect(GUIDE_AFTER).toBe('이제 크롬을 닫고, 홈 화면의 느티나무를 눌러서 열어요.');
    expect(GUIDE_AFTER).not.toContain('이 창');
    expect(GUIDE_WIFI).toBe('느티나무를 눌러 열 때도 와이파이가 있어야 해요.');
  });

  it('단추 하나짜리 안내의 글: 추가하기 전에는 "이제…"가 아니라 "추가한 다음에는…"이다', () => {
    expect(GUIDE_ADD).toBe('홈 화면에 추가');
    expect(GUIDE_AFTER_BUTTON).toBe('추가한 다음에는 크롬을 닫고, 홈 화면의 느티나무를 눌러서 열어요.');
    expect(GUIDE_AFTER_BUTTON.startsWith('이제')).toBe(false);
    expect(GUIDE_SHOW_STEPS).toBe('차례대로 하는 법 보기');
    // 설치 물음에 답한 뒤: 추가하는 중 → 생겼어요(오래 걸리면 차례대로 하는 법을 함께 보인다)
    expect(GUIDE_ADDING).toBe('홈 화면에 추가하는 중이에요. 잠깐만 기다려요.');
    expect(GUIDE_ADDED).toBe('홈 화면에 느티나무가 생겼어요.');
    expect(GUIDE_ADDING_LONG).toContain('차례대로');
    for (const text of [GUIDE_AFTER_BUTTON, GUIDE_ADDING, GUIDE_ADDED, GUIDE_ADDING_LONG]) expect(text.endsWith('요.'), text).toBe(true);
  });

  it('안내의 모양: 설치 물음이 와 있으면 기기를 어떻게 가렸든 단추 하나, 아니면 그 기기의 세 걸음', () => {
    // 설치 물음이 와 있다(크롬 엔진): 갤럭시탭으로 가렸든 컴퓨터로 가렸든 단추 하나
    expect(guideShape('android', true)).toBe('button');
    expect(guideShape('other', true)).toBe('button');
    // 물음이 없다: 가린 기기의 세 걸음, 못 가렸으면 두 기기를 나란히
    expect(guideShape('android', false)).toBe('steps');
    expect(guideShape('ipad', false)).toBe('steps');
    expect(guideShape('other', false)).toBe('both');
    // 세 걸음을 보일 기기: 가린 기기의 것만. 물음이 왔는데 못 가렸으면 갤럭시탭의 것(물음은 크롬 엔진에만 온다)
    expect(guideKinds('android', false)).toEqual(['android']);
    expect(guideKinds('android', true)).toEqual(['android']);
    expect(guideKinds('ipad', false)).toEqual(['ipad']);
    expect(guideKinds('other', true)).toEqual(['android']);
    expect(guideKinds('other', false)).toEqual(['android', 'ipad']);
  });

  it('기기마다 세 걸음이고, 그 기기의 메뉴 이름이 들어 있다', () => {
    expect(GUIDE_STEPS.android.steps).toHaveLength(3);
    expect(GUIDE_STEPS.ipad.steps).toHaveLength(3);
    expect(GUIDE_STEPS.android.steps.join(' ')).toMatch(/점 세 개.*설치 및 바로가기 만들기.*설치/);
    expect(GUIDE_STEPS.ipad.steps.join(' ')).toMatch(/공유 단추.*홈 화면에 추가.*추가/);
    for (const kind of ['android', 'ipad'] as const) {
      for (const step of GUIDE_STEPS[kind].steps) {
        expect(step.length, step).toBeLessThanOrEqual(45);
        expect(step.endsWith('요.'), step).toBe(true);
      }
    }
  });
});

// ── 매니페스트, 아이콘, index.html ───────────────────────────────

const RAW = import.meta.glob<string>(['../public/manifest.webmanifest', '../index.html'], { eager: true, query: '?raw', import: 'default' });
const ICONS = import.meta.glob<string>('../public/icons/*.png', { eager: true, query: '?url', import: 'default' });
const SOURCES = import.meta.glob<string>(['../src/**/*.ts', '../src/**/*.tsx', '../index.html'], { eager: true, query: '?raw', import: 'default' });

/** PNG의 머리(IHDR)에서 가로·세로를 읽는다 */
async function pngSize(name: string): Promise<[number, number]> {
  // 파일을 읽는 것은 이 시험뿐이다. 이름을 이어 붙여 불러온다(이 프로젝트에는 Node의 형 정의를 두지 않는다).
  const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as { readFileSync(path: string): Uint8Array };
  const path = decodeURIComponent(new URL(`../public/icons/${name}`, import.meta.url).pathname);
  const bytes = fs.readFileSync(path);
  expect([...bytes.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return [view.getUint32(16), view.getUint32(20)];
}

describe('매니페스트와 아이콘', () => {
  const manifest = JSON.parse(RAW['../public/manifest.webmanifest']) as Record<string, unknown> & { icons: { src: string; sizes: string; type: string; purpose: string }[] };
  const page = RAW['../index.html'];

  it('spec 10절의 값: 이름, 화면 가득, 가로, 한지 빛, 주소', () => {
    expect(manifest.name).toBe('조선에서 한 해 살기');
    expect(manifest.short_name).toBe('조선 한 해');
    expect([...(manifest.short_name as string)].length).toBeLessThanOrEqual(6);
    expect(manifest.lang).toBe('ko');
    expect(manifest.display).toBe('fullscreen');
    expect(manifest.orientation).toBe('landscape');
    expect(manifest.background_color).toBe('#f4ecd9');
    expect(manifest.theme_color).toBe('#f4ecd9');
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
    expect(manifest.id).toBe('/');
  });

  it('아이콘: 192·512와 가장자리가 잘려도 되는 512. 파일이 있고 크기가 적힌 대로다', async () => {
    expect(manifest.icons.map((icon) => `${icon.sizes} ${icon.purpose}`).sort()).toEqual(['192x192 any', '512x512 any', '512x512 maskable']);
    for (const icon of manifest.icons) {
      expect(icon.type).toBe('image/png');
      const name = icon.src.replace('icons/', '');
      expect(Object.keys(ICONS), icon.src).toContain(`../public/icons/${name}`);
      const side = Number(icon.sizes.split('x')[0]);
      expect(await pngSize(name), icon.src).toEqual([side, side]);
    }
    expect(await pngSize('apple-touch-icon.png')).toEqual([180, 180]);
  });

  it('index.html: 매니페스트 링크, 진짜 아이콘, 아이패드용 아이콘과 이름, 띠 빛', () => {
    expect(page).toContain('<link rel="manifest" href="./manifest.webmanifest" />');
    expect(page).toContain('rel="icon" type="image/png" sizes="192x192" href="./icons/icon-192.png"');
    expect(page).toContain('rel="apple-touch-icon" sizes="180x180" href="./icons/apple-touch-icon.png"');
    expect(page).toContain('<meta name="apple-mobile-web-app-title" content="조선 한 해" />');
    expect(page).toContain('<meta name="theme-color" content="#f4ecd9" />');
    expect(page).not.toContain('href="data:,"');
  });

  it('서비스 워커를 등록하지 않는다(인터넷이 있을 때만 연다 — 사용자 결정)', () => {
    for (const [path, text] of Object.entries(SOURCES)) {
      expect(/serviceWorker\s*\.\s*register|navigator\.serviceWorker/.test(text), path).toBe(false);
    }
  });
});

// 태블릿 바퀴 Review의 9번: 세로 안내가 떠 있는 동안에는 어떤 창(대화 장면·종이·물음)이 떠 있어도 자판이 통하지 않는다.
// 얹힌 창은 뜰 때 창 전체의 자판을 먼저 잡는 자리(window의 capture)에 걸어 두므로, 문지기는 그보다 먼저 걸려 있어야 하고,
// 늦게 걸렸더라도 얹힌 창의 처리가 스스로 물러나야 한다. 브라우저 없이 EventTarget으로 본다.
describe('세로 안내가 떠 있는 동안의 자판', () => {
  const press = (target: EventTarget, kind = 'keydown'): Event => {
    const ev = new Event(kind, { cancelable: true });
    target.dispatchEvent(ev);
    return ev;
  };

  it('막혀 있지 않으면 문지기는 아무것도 하지 않는다', () => {
    holdKeys(false);
    const target = new EventTarget();
    const off = guardKeys(target);
    const seen: string[] = [];
    target.addEventListener('keydown', () => seen.push('창'), true);
    const ev = press(target);
    expect(seen).toEqual(['창']);
    expect(ev.defaultPrevented).toBe(false);
    off();
  });

  it('막혀 있으면 뒤에 걸린 것(얹힌 창, 맵)이 누름을 받지 못한다 — 누름·뗌 모두', () => {
    const target = new EventTarget();
    const off = guardKeys(target);
    const seen: string[] = [];
    // 얹힌 창은 문지기보다 나중에 걸린다(대화 장면이 뜰 때)
    target.addEventListener('keydown', () => seen.push('창'), true);
    target.addEventListener('keydown', () => seen.push('맵'));
    target.addEventListener('keyup', () => seen.push('맵 뗌'));
    holdKeys(true);
    expect(keysAreHeld()).toBe(true);
    expect(press(target).defaultPrevented).toBe(true);
    expect(press(target, 'keyup').defaultPrevented).toBe(true);
    expect(seen).toEqual([]);
    // 가로로 돌아오면 다시 받는다
    holdKeys(false);
    press(target);
    press(target, 'keyup');
    expect(seen).toEqual(['창', '맵', '맵 뗌']);
    off();
  });

  it('문지기보다 먼저 걸린 창이 있어도, 그 창의 처리가 스스로 물러난다(swallowIfHeld)', () => {
    const target = new EventTarget();
    const seen: string[] = [];
    // 얹힌 창의 자판 처리와 같은 꼴: 막혀 있으면 삼키고 아무것도 하지 않는다
    target.addEventListener('keydown', (ev) => {
      if (swallowIfHeld(ev)) return;
      seen.push('창이 넘김');
    }, true);
    target.addEventListener('keydown', () => seen.push('밑의 화면'));
    const off = guardKeys(target);
    holdKeys(true);
    expect(press(target).defaultPrevented).toBe(true);
    expect(seen).toEqual([]);
    holdKeys(false);
    press(target);
    expect(seen).toEqual(['창이 넘김', '밑의 화면']);
    off();
  });

  it('삼킨 누름은 true, 막혀 있지 않은 누름은 false를 돌려준다', () => {
    const calls: string[] = [];
    const fake = { stopImmediatePropagation: () => calls.push('stop'), preventDefault: () => calls.push('prevent') };
    holdKeys(false);
    expect(swallowIfHeld(fake)).toBe(false);
    expect(calls).toEqual([]);
    holdKeys(true);
    expect(swallowIfHeld(fake)).toBe(true);
    expect(calls).toEqual(['stop', 'prevent']);
    holdKeys(false);
  });

  it('거둔 문지기는 더 삼키지 않는다', () => {
    const target = new EventTarget();
    const off = guardKeys(target);
    off();
    holdKeys(true);
    const seen: string[] = [];
    target.addEventListener('keydown', () => seen.push('창'));
    press(target);
    expect(seen).toEqual(['창']);
    holdKeys(false);
  });

  it('얹힌 창의 자판 처리(focus.ts)와 세로 안내(TurnNotice.tsx)가 이 막기를 쓴다', () => {
    const focus = SOURCES[Object.keys(SOURCES).find((path) => path.endsWith('/ui/focus.ts')) ?? ''] ?? '';
    const turn = SOURCES[Object.keys(SOURCES).find((path) => path.endsWith('/ui/TurnNotice.tsx')) ?? ''] ?? '';
    // 창 밖에서 생긴 누름과 창 안에서 생긴 누름, 두 곳 모두에서 먼저 물러난다
    expect((focus.match(/if \(swallowIfHeld\(ev\)\) return;/g) ?? []).length).toBe(2);
    // 세로가 되는 그 자리에서 막고, 문지기는 파일이 불릴 때(창이 뜨기 전에) 건다
    expect(turn).toMatch(/holdKeys\(need\)/);
    expect(turn).toMatch(/^if \(typeof window !== 'undefined'\) guardKeys\(window\);/m);
  });
});

// Review 1-라 6번: 일 놀이를 끝낸 바로 뒤의 첫 결과 창("벼는 그대로 두고 풀만 말끔히 뽑았구나")이 보이지도 않고 넘어갔다.
// 자판 Enter로 놀이를 끝내면 그 누름이 대화 장면에 닿고, 끝내기 단추를 0.17~0.37초 사이에 두 번 누르면 둘째가 닿았다.
// 대화 장면은 결과를 띄울 때 누름의 문(TapGate)을 다시 막는다 — 열 때와 같은 틈.
describe('대화 장면 — 잇달아 누르기와 놀이 뒤의 첫 결과 창', () => {
  it('틈: 잇달아 누름은 0.26초, 새 창이 뜬 뒤는 0.38초', () => {
    expect(TAP_GAP_MS).toBe(260);
    expect(OPEN_GAP_MS).toBe(380);
    expect(OPEN_GAP_MS).toBeGreaterThan(TAP_GAP_MS);
  });

  it('대화가 열린 바로 뒤 0.38초는 누름을 받지 않는다(맵을 누른 손가락이 첫 창을 넘기지 않게)', () => {
    const gate = new TapGate(1000);
    expect(gate.pass(1000)).toBe(false);
    expect(gate.pass(1379)).toBe(false);
    expect(gate.pass(1380)).toBe(true);
  });

  it('잇달아 누름: 받은 누름에서 0.26초 안의 누름은 하나로 친다', () => {
    const gate = new TapGate(0);
    expect(gate.pass(5000)).toBe(true);
    expect(gate.pass(5100)).toBe(false);
    expect(gate.pass(5259)).toBe(false);
    expect(gate.pass(5260)).toBe(true);
  });

  it('놀이를 끝낸 그 누름(자판 Enter)과 0.17~0.37초 뒤의 둘째 누름이 첫 결과 창을 넘기지 않는다', () => {
    const gate = new TapGate(0);
    expect(gate.pass(4000)).toBe(true); // 선택지를 고른다 → 일 놀이(1분쯤, 그동안 대화 장면에는 누름이 없다)
    const end = 64_000;
    gate.hold(end); // 놀이를 끝내 결과의 첫 창이 뜬다
    expect(gate.pass(end)).toBe(false); // 놀이를 끝낸 Enter가 그대로 대화 장면에 닿는다
    for (const later of [170, 250, 300, 370, 379]) expect(gate.pass(end + later), `${later}ms`).toBe(false);
    expect(gate.pass(end + OPEN_GAP_MS)).toBe(true); // 그 뒤에는 넘긴다
  });

  it('다시 막지 않으면(고치기 전처럼) 둘째 누름이 첫 결과 창을 넘긴다 — 위의 시험이 잘못을 잡는다', () => {
    const gate = new TapGate(0);
    expect(gate.pass(4000)).toBe(true);
    expect(gate.pass(64_000)).toBe(true);
    expect(gate.pass(64_170)).toBe(false);
    const fresh = new TapGate(0);
    fresh.pass(4000);
    expect(fresh.pass(64_170)).toBe(true);
  });

  it('이미 더 길게 막혀 있으면 막는 것을 줄이지 않는다', () => {
    const gate = new TapGate(10_000); // 10.38초까지 막혀 있다
    gate.hold(9_000);
    expect(gate.pass(10_200)).toBe(false);
    expect(gate.pass(10_380)).toBe(true);
  });

  it('Talk.tsx는 일을 마치고 결과를 띄울 때 문을 다시 막는다', () => {
    const talk = SOURCES[Object.keys(SOURCES).find((path) => path.endsWith('/screens/Talk.tsx')) ?? ''] ?? '';
    const commit = talk.slice(talk.indexOf('const commit = '), talk.indexOf('const afterChoice = '));
    expect(commit).toMatch(/commitTalk\(/);
    expect(commit).toMatch(/gate\.current\?\.hold\(Date\.now\(\)\)/);
    // 막는 것이 결과를 띄우기(setDeed) 앞에 있다
    expect(commit.indexOf('hold(')).toBeLessThan(commit.indexOf('setDeed('));
    // 누름을 받을지 가르는 것은 이 문 하나다
    expect(talk).toMatch(/const tooSoon = \(\): boolean => !\(gate\.current as TapGate\)\.pass\(Date\.now\(\)\);/);
  });
});

// Review 1-라 37번 ㉠: 같은 일을 하는 함수가 따로 있지 않다 — 수를 우리말로 세는 countWord는 src/ui/words.ts의 하나뿐이다.
describe('코드 — 하나만 있어야 하는 것', () => {
  it('countWord는 src/ui/words.ts에만 있다(다른 곳은 불러 쓴다)', () => {
    const defining = Object.entries(SOURCES)
      .filter(([, text]) => /(function countWord\s*\(|const countWord\s*=)/.test(text))
      .map(([path]) => path.replace(/^.*\/src\//, 'src/'));
    expect(defining).toEqual(['src/ui/words.ts']);
  });
});

// Review 1-라 28번 ㉡㉢: 선택지가 뜬 바로 뒤의 자판, 세로 안내가 걷힌 뒤의 초점
describe('자판 — 선택지의 첫 자리와 세로 안내 뒤의 초점', () => {
  const source = (end: string): string => SOURCES[Object.keys(SOURCES).find((path) => path.endsWith(end)) ?? ''] ?? '';

  it('Tab의 첫 자리는 창이 정한 data-first-tab(대화 장면에서는 첫 열린 선택지)이다', () => {
    expect(source('/ui/focus.ts')).toMatch(/root\.querySelector<HTMLElement>\('\[data-first-tab\]'\) \?\? items\[0\]/);
    expect(source('/screens/Talk.tsx')).toMatch(/data-first-tab=\{view\.id === firstOpen \? true : undefined\}/);
  });

  it('선택지 묶음에서 Enter는 첫 선택지로 옮길 뿐 고르지 않는다', () => {
    const talk = source('/screens/Talk.tsx');
    expect(talk).toMatch(/document\.activeElement === list/);
    expect(talk).toMatch(/querySelector<HTMLElement>\('button\.talk-choice'\)\?\.focus\(\)/);
  });

  it('세로 안내가 걷히면 지우기 전의 초점으로 돌아간다', () => {
    const turn = source('/ui/TurnNotice.tsx');
    expect(turn).toMatch(/const kept = /);
    expect(turn).toMatch(/kept\.focus\(\{ preventScroll: true \}\)/);
  });
});
