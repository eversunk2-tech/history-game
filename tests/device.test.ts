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
import { HINT_WINDOWS, NEXT_HINT, NextHint, OWN_TAP, freeTap, hintParts, isNextArrow, pageByKey, stepAdvances, type TalkStepKind } from '../src/ui/advance';
import { guardKeys, holdKeys, keysAreHeld, swallowIfHeld } from '../src/ui/focus';
import { OPEN_GAP_MS, TAP_GAP_MS, TapGate } from '../src/ui/taps';
import { keyWalks } from '../src/screens/MapScreen';
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

// 2026-11-11 사용자 요청: "다음 ▼"을 눌러야만 넘어가는 줄 알아 불편했다. →(와 Space)로, 화면 아무 곳이나 눌러도 넘어가게.
// 화면을 그리지 않고 셈(ui/advance.ts)과 소스로 본다(실제 화면은 머리 없는 크롬으로 따로 보았다).
describe('대화 넘기기 — → 키, 화면 아무 곳, 넘기는 법 알림', () => {
  const source = (end: string): string => SOURCES[Object.keys(SOURCES).find((path) => path.endsWith(end)) ?? ''] ?? '';
  /** 글 파일을 그대로 읽는다(CSS와 문서 — pngSize와 같은 길로 Node의 fs를 부른다) */
  const readText = async (rel: string): Promise<string> => {
    const fs = (await import(/* @vite-ignore */ ['node', 'fs'].join(':'))) as { readFileSync(path: string): Uint8Array };
    return new TextDecoder().decode(fs.readFileSync(decodeURIComponent(new URL(rel, import.meta.url).pathname)));
  };
  const key = (k: string, more: Partial<Pick<KeyboardEvent, 'repeat' | 'altKey' | 'ctrlKey' | 'metaKey'>> = {}) => ({
    key: k,
    repeat: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    ...more,
  });

  it('넘기기가 먹는 단계: 여는 대화·결과·달라진 것·할 수 없는 일, 선택지가 모두 잠긴 때. 선택지를 고르는 동안·놀이·쪽지는 아니다', () => {
    const goes: TalkStepKind[] = ['open', 'result', 'change', 'blocked'];
    const stays: TalkStepKind[] = ['choose', 'play', 'note'];
    for (const kind of goes) expect(stepAdvances(kind, false), kind).toBe(true);
    for (const kind of stays) expect(stepAdvances(kind, false), kind).toBe(false);
    expect(stepAdvances('choose', true)).toBe(true); // 모두 잠김 → 대화창이 "돌아가기"
    expect(stepAdvances('play', true)).toBe(false);
  });

  it('→ 한 번은 넘기는 누름이다. 누르고 있어 되풀이되는 것, Alt·Ctrl·⌘과 함께 누른 것(뒤로 가기 등), 다른 화살표는 아니다', () => {
    expect(isNextArrow(key('ArrowRight'))).toBe(true);
    expect(isNextArrow(key('ArrowRight', { repeat: true }))).toBe(false);
    expect(isNextArrow(key('ArrowRight', { altKey: true }))).toBe(false);
    expect(isNextArrow(key('ArrowRight', { ctrlKey: true }))).toBe(false);
    expect(isNextArrow(key('ArrowRight', { metaKey: true }))).toBe(false);
    for (const other of ['ArrowLeft', 'ArrowUp', 'ArrowDown', 'Enter', ' ']) expect(isNextArrow(key(other)), other).toBe(false);
  });

  it('Talk.tsx: →는 Enter·Space와 같은 advance로 가되, 넘기기가 먹는 단계에서만(선택지를 고르지 않는다)', () => {
    const talk = source('/screens/Talk.tsx');
    const arrow = talk.slice(talk.indexOf("ev.key === 'ArrowRight'"), talk.indexOf("ev.key === 'ArrowDown' || ev.key === 'ArrowUp'"));
    expect(arrow).toMatch(/if \(!isNextArrow\(ev\) \|\| !stepAdvances\(step\.kind, stuckNow\)\) return;/);
    expect(arrow).toMatch(/advance\(\);/);
    expect(arrow).not.toMatch(/choose\(|focus\(/); // 선택지를 고르거나 초점을 옮기지 않는다
    // →는 Enter·Space보다 먼저 가로채지 않는다(선택지 묶음의 Enter 규칙은 그대로)
    expect(talk.indexOf("ev.key === 'Enter' || ev.key === ' '")).toBeLessThan(talk.indexOf("ev.key === 'ArrowRight'"));
    // advance도 같은 판정을 쓴다(누름·Enter·Space·→가 한 규칙)
    expect(talk).toMatch(/if \(!stepAdvances\(step\.kind, stuckNow\)\) return;\s*\n\s*if \(tooSoon\(\)\) return;/);
    // 초점이 대사 창 단추에 있어도 →는 창의 자판 처리로 온다(단추가 스스로 받는 것은 Enter·Space뿐 — focus.ts)
    expect(source('/ui/focus.ts')).toMatch(/const isPress = \(ev: KeyboardEvent\): boolean => ev\.key === 'Enter' \|\| ev\.key === ' ';/);
    expect(source('/ui/focus.ts')).toMatch(/if \(isPress\(ev\) && ev\.target instanceof HTMLButtonElement\) return;/);
  });

  // 가짜 요소: 자신부터 조상까지의 꼴("header", "span", "button", "[data-own]", '[aria-modal="true"]' …)을 적어 둔다.
  // closest는 고른 꼴 가운데 하나라도 맞는 조상이 있으면 그것을 돌려준다(이 시험에 쓰는 단순한 꼴만 안다).
  type Fake = { tag: string; attrs: Record<string, string> };
  const node = (tag: string, attrs: Record<string, string> = {}): Fake => ({ tag, attrs });
  const matches = (one: Fake, selector: string): boolean => {
    const m = /^([a-z]*)(?:\[([a-z-]+)(?:="([^"]*)")?\])?$/.exec(selector.trim());
    if (!m) throw new Error(`모르는 꼴: ${selector}`);
    const [, tag, attr, value] = m;
    if (tag && tag !== one.tag) return false;
    if (attr && !(attr in one.attrs)) return false;
    if (attr && value !== undefined && one.attrs[attr] !== value) return false;
    return true;
  };
  const element = (inScene: boolean, ...chain: Fake[]) => ({
    inScene,
    closest: (selector: string) => chain.find((one) => selector.split(',').some((part) => matches(one, part))) ?? null,
  });
  const scene = { contains: (other: Node | null) => Boolean((other as unknown as { inScene?: boolean })?.inScene) };
  const tap = (el: ReturnType<typeof element>): boolean => freeTap(el as unknown as EventTarget, scene as unknown as Node);
  const band = node('header', { class: 'band compact' });

  it('대화 장면 밖의 누름: 위쪽 띠의 빈 곳과 글(계절·수치·해)은 넘기고, 띠의 단추와 다른 창(세로 안내·물음)은 아니다', () => {
    expect(tap(element(false, band))).toBe(true); // 띠의 빈 곳
    expect(tap(element(false, node('span'), node('div'), band))).toBe(true); // 수치 이름·숫자
    expect(tap(element(false, node('div', { role: 'img' }), band))).toBe(true); // 해 ☀(그림 구실의 묶음)
    expect(tap(element(false, node('p'), band))).toBe(true); // 알림 줄(기록을 남기지 못했어요)
    expect(tap(element(false, node('span'), node('button'), band))).toBe(false); // 띠의 단추(대화 중에 보인다면)
    expect(tap(element(false, node('p'), node('div', { role: 'alertdialog', 'aria-modal': 'true' })))).toBe(false); // 세로 안내
    expect(tap(element(false, node('a', { href: '#' })))).toBe(false);
  });

  it('대화 장면 안의 누름은 장면이 받는다(두 번 넘기지 않게). 요소가 아닌 것과 장면이 없을 때도 넘기지 않는다', () => {
    expect(tap(element(true, node('div', { class: 'talk' })))).toBe(false);
    expect(freeTap(null, scene as unknown as Node)).toBe(false);
    expect(freeTap({} as EventTarget, scene as unknown as Node)).toBe(false);
    expect(freeTap(element(false, band) as unknown as EventTarget, null)).toBe(false);
    // 저마다 받는 것의 꼴에 단추·장면이 받겠다고 한 것이 들어 있다
    for (const one of ['button', '[data-own]', '[role="button"]', 'a[href]', 'input']) expect(OWN_TAP.split(', ')).toContain(one);
  });

  it('Talk.tsx: 장면 밖의 누름은 문서에서 받되, 장면이 뜬 뒤에 시작된 누름만 친다. 이름표는 눌러도 넘어가고 "나중에 할게요"는 저마다 받는다', () => {
    const talk = source('/screens/Talk.tsx');
    expect(talk).toMatch(/document\.addEventListener\('pointerdown', onDown, true\);/);
    expect(talk).toMatch(/document\.addEventListener\('click', onTap\);/);
    expect(talk).toMatch(/if \(began && freeTap\(ev\.target, rootRef\.current\)\) advanceRef\.current\(\);/);
    expect(talk).toMatch(/document\.removeEventListener\('click', onTap\);/);
    // 장면 안: 창 어디를 눌러도 넘어가되 data-own은 저마다 받는다
    expect(talk).toMatch(/if \(ev\.target instanceof Element && ev\.target\.closest\('\[data-own\]'\)\) return;\s*\n\s*advance\(\);/);
    expect(talk).toMatch(/<div class="talk-top">/); // 위쪽 줄 전체가 아니라
    expect(talk).toMatch(/<button type="button" class="talk-later" data-own onClick=\{later\}>/); // "나중에 할게요"만
    // 대화 중의 띠는 단추를 감춘다(줄인 띠 — 계절·곳·수치·해만)
    expect(source('/ui/TopBand.tsx')).toMatch(/const compact = talk\.value !== null;/);
    expect(source('/ui/TopBand.tsx')).toMatch(/\{!compact && \(\s*\n\s*<div class=\{`band-tools/);
  });

  it('넘기는 법 알림은 판마다 처음 세 창에만 보이고, 판이 바뀌면(새로 시작·이어 하기) 다시 센다', () => {
    expect(HINT_WINDOWS).toBe(3);
    const hint = new NextHint();
    expect([1, 1, 1, 1, 1].map((play) => hint.take(play))).toEqual([true, true, true, false, false]);
    expect(hint.take(2)).toBe(true); // 이어 하기로 다시 열었다
    expect(hint.take(2)).toBe(true);
    expect(hint.take(2)).toBe(true);
    expect(hint.take(2)).toBe(false);
    const two = new NextHint(2);
    expect([5, 5, 5].map((play) => two.take(play))).toEqual([true, true, false]);
  });

  it('Talk.tsx: 알림은 "다음 ▼"이 붙은 창(여는 대화·결과·달라진 것)마다 한 번 세고, 그 판의 번호(playNo)로 센다', () => {
    const talk = source('/screens/Talk.tsx');
    expect(talk).toMatch(/const nextWindow = step\.kind === 'open' \|\| step\.kind === 'result' \|\| step\.kind === 'change';/);
    expect(talk).toMatch(/useMemo\(\(\) => nextWindow && nextHint\.take\(playNo\.peek\(\)\), \[windowKey\]\)/);
    // "다음 ▼" 셋 모두 알림과 함께 그린다("돌아가기 ▼"에는 붙지 않는다)
    expect((talk.match(/<NextMark hint=\{hinted\} \/>/g) ?? []).length).toBe(3);
    expect((talk.match(/<NextMark hint=\{false\} label="돌아가기" \/>/g) ?? []).length).toBe(2);
    // (3판 다듬기 ㉠) "다음 ▼"은 옅은 쪽빛 알약이고 ▼만 까딱인다: 글은 label(기본 "다음") + 띄어쓰기 + ▼ 그대로
    expect(talk).toMatch(/function NextMark\(\{ hint, label = '다음' \}/);
    expect(talk).toMatch(/<span class="talk-next">\s*\n\s*\{label\} <span class="talk-next-tri">▼<\/span>/);
    // 알림 줄은 화면 읽기에는 숨기고(창의 글만 읽힌다), 글은 NEXT_HINT를 나눈 조각을 그대로 잇는다
    expect(talk).toMatch(/<span class="talk-next-row" aria-hidden="true">/);
    expect(talk).toMatch(/<span class="talk-hint" data-hint=\{NEXT_HINT\}>/);
    expect(talk).toMatch(/\{hintParts\(NEXT_HINT\)\.map\(\(part, index\) => \(part\.key \? <kbd key=\{index\}>\{part\.text\}<\/kbd> : <span key=\{index\}>\{part\.text\}<\/span>\)\)\}/);
  });

  it('(3판 다듬기 ㉠) 알림 글을 나누는 셈: 조각을 이어 붙이면 NEXT_HINT와 글자 하나 다르지 않고, 자판 꼴은 → 와 Space 둘뿐이다', () => {
    const parts = hintParts(NEXT_HINT);
    expect(parts.map((part) => part.text).join('')).toBe(NEXT_HINT);
    expect(parts.filter((part) => part.key).map((part) => part.text)).toEqual(['→', 'Space']);
    expect(parts.every((part) => part.text !== '')).toBe(true);
    // 다른 글이 와도 글자가 바뀌지 않는다
    for (const text of ['→', 'Space', '→·Space', '아무 글', '']) expect(hintParts(text).map((part) => part.text).join('')).toBe(text);
  });

  it('알림 글: 30자 안, "~요"로 끝나는 쉬운 말, 누르기와 →·Space를 함께 알린다. 글자는 이름표 기준(18px)보다 크다', async () => {
    expect([...NEXT_HINT].length).toBeLessThanOrEqual(30);
    expect(NEXT_HINT).toMatch(/요\)?$/);
    expect(NEXT_HINT).toMatch(/눌러도 넘어가요/);
    expect(NEXT_HINT).toMatch(/→/);
    expect(NEXT_HINT).toMatch(/Space/);
    const css = await readText('../src/styles/talk.css');
    const rule = css.slice(css.indexOf('.talk-hint {'), css.indexOf('}', css.indexOf('.talk-hint {')));
    const rem = Number(/font-size: ([\d.]+)rem;/.exec(rule)?.[1] ?? '0');
    expect(rem * 16).toBeGreaterThan(18); // 1024×768에서 1rem = 16px
    // 글이 세 줄이어도 겹치지 않게 창 안의 흐름에 놓인다(떠 있는 자리가 아니다)
    expect(rule).not.toMatch(/position: absolute/);
    // 글은 기획서(9.2)에 먼저 적었다
    expect(await readText('../docs/spec-3판.md')).toContain(NEXT_HINT);
  });

  it('한 해 돌아보기: →는 "다음", ←는 "앞 장". 넘길 단추가 없으면(첫 장의 ←, 남길 것 장의 →) 아무 일도 없다', () => {
    const count = 4;
    expect(pageByKey(key('ArrowRight'), 0, count)).toBe(1);
    expect(pageByKey(key('ArrowRight'), 2, count)).toBe(3); // 올해의 이름 → 남길 것 고르기
    expect(pageByKey(key('ArrowRight'), 3, count)).toBe(null); // 남길 것: 한 해를 마치는 단추는 →로 누르지 않는다
    expect(pageByKey(key('ArrowLeft'), 3, count)).toBe(2);
    expect(pageByKey(key('ArrowLeft'), 1, count)).toBe(0);
    expect(pageByKey(key('ArrowLeft'), 0, count)).toBe(null);
    expect(pageByKey(key('ArrowRight', { repeat: true }), 0, count)).toBe(null);
    expect(pageByKey(key('ArrowLeft', { altKey: true }), 2, count)).toBe(null); // 브라우저의 뒤로 가기
    expect(pageByKey(key('ArrowLeft', { metaKey: true }), 2, count)).toBe(null);
    for (const other of ['Enter', ' ', 'ArrowUp', 'ArrowDown']) expect(pageByKey(key(other), 1, count), other).toBe(null);
  });

  it('YearReview.tsx: ←→는 단추와 같은 turn(같은 틈)으로 가고, 화면 아무 곳 누르기는 없다', () => {
    const review = source('/screens/YearReview.tsx');
    expect(review).toMatch(/const to = pageByKey\(ev, pageRef\.current, PAGES\.length\);/);
    expect(review).toMatch(/pageRef\.current = page;/); // 그린 때의 장을 읽는다(앞 장의 효과가 남아 셈하지 않게)
    expect(review).toMatch(/turnRef\.current\(to\);/);
    expect(review).toMatch(/window\.addEventListener\('keydown', onKey\);/);
    expect(review).toMatch(/window\.removeEventListener\('keydown', onKey\);/);
    expect(review).not.toMatch(/addEventListener\('click'|addEventListener\('pointerdown'/);
    expect(review).not.toMatch(/<main[^>]*onClick/);
  });
});

// 2026-11-11 Review R1: "돌아가기 ▼" 창을 →로 닫고 누르고 있으면, 닫힌 뒤 오는 → 되풀이를 맵이 받아 주인공이 걸었다.
// 맵은 그 키의 처음 누름을 받았을 때만 되풀이를 걷기로 친다(MapScreen.tsx의 keyWalks). 실제 화면은 머리 없는 크롬으로 따로 보았다.
describe('맵의 방향 키 — 맵이 받지 않은 되풀이는 걷지 않는다', () => {
  const mapSource = SOURCES[Object.keys(SOURCES).find((path) => path.endsWith('/screens/MapScreen.tsx')) ?? ''] ?? '';

  it('처음 누름은 걷고, 되풀이는 맵이 그 키의 처음 누름을 받았을 때만 걷는다', () => {
    expect(keyWalks(new Set(), 'ArrowRight', false)).toBe(true);
    expect(keyWalks(new Set(), 'ArrowRight', true)).toBe(false); // 창을 닫은 → 를 누르고 있음
    expect(keyWalks(new Set(['ArrowRight']), 'ArrowRight', true)).toBe(true); // 맵에서 누르고 있음
    expect(keyWalks(new Set(['ArrowRight']), 'ArrowLeft', true)).toBe(false); // 다른 키의 되풀이
    expect(keyWalks(new Set(['ArrowRight']), 'ArrowUp', false)).toBe(true); // 두 키를 함께
  });

  // MapScreen의 onKeyDown·onKeyUp·onBlur가 held를 다루는 길을 그대로 옮긴 작은 본(창이 떠 있으면 held를 비우고 돌아간다)
  const mapKeys = () => {
    const held = new Set<string>();
    let overlay = false;
    const norm = (key: string): string => (key.length === 1 ? key.toLowerCase() : key);
    return {
      held,
      open: (): void => void (overlay = true),
      close: (): void => void (overlay = false),
      down(key: string, repeat = false): void {
        if (overlay) {
          held.clear();
          return;
        }
        const k = norm(key);
        if (!keyWalks(held, k, repeat)) return;
        held.add(k);
      },
      up: (key: string): void => void held.delete(norm(key)),
      blur: (): void => held.clear(),
    };
  };
  const hold = (keys: ReturnType<typeof mapKeys>, key: string, times: number): void => {
    for (let i = 0; i < times; i += 1) keys.down(key, true);
  };

  it('R1: 창을 →로 닫고 0.5초 누르고 있어도(되풀이 10번) 걷지 않고, 떼었다 다시 누르면 걷는다', () => {
    const keys = mapKeys();
    keys.open(); // 막힌 일의 "돌아가기 ▼" — 처음 누름은 창이 받아 멈추게 한다(맵에 오지 않는다)
    keys.close();
    hold(keys, 'ArrowRight', 10);
    expect([...keys.held]).toEqual([]);
    keys.up('ArrowRight');
    keys.down('ArrowRight');
    expect([...keys.held]).toEqual(['ArrowRight']);
  });

  it('맵에서 누르기: 짧게·길게 걷고, 떼면 멈추고, 두 키를 함께 누르고, 창이 떴다 닫히거나 초점을 잃었다 돌아온 뒤 다시 누르면 걷는다', () => {
    const keys = mapKeys();
    keys.down('ArrowRight');
    expect([...keys.held]).toEqual(['ArrowRight']);
    hold(keys, 'ArrowRight', 10); // 누르고 있으면 계속 걷는다
    expect([...keys.held]).toEqual(['ArrowRight']);
    keys.down('ArrowUp');
    hold(keys, 'ArrowUp', 5); // 둘째 키의 되풀이
    expect([...keys.held].sort()).toEqual(['ArrowRight', 'ArrowUp']);
    keys.up('ArrowUp');
    expect([...keys.held]).toEqual(['ArrowRight']);
    keys.up('ArrowRight');
    expect([...keys.held]).toEqual([]);
    // 글자 키: Shift를 더 눌러 큰 글자로 되풀이되어도 같은 키다
    keys.down('d');
    hold(keys, 'D', 3);
    expect([...keys.held]).toEqual(['d']);
    // 걷는 중에 창이 떴다 닫히면 누르고 있던 것은 멈추고, 다시 누르면 걷는다
    keys.open();
    keys.down('d', true);
    keys.close();
    hold(keys, 'd', 5);
    expect([...keys.held]).toEqual([]);
    keys.up('d');
    keys.down('d');
    expect([...keys.held]).toEqual(['d']);
    // 창(브라우저)이 초점을 잃으면 멈추고, 돌아와 다시 누르면 걷는다
    keys.blur();
    expect([...keys.held]).toEqual([]);
    keys.down('ArrowLeft');
    hold(keys, 'ArrowLeft', 3);
    expect([...keys.held]).toEqual(['ArrowLeft']);
  });

  it('MapScreen.tsx: 방향 키 갈래는 held에 넣기 전에 keyWalks로 거르고, 창·초점 잃음·Enter·Space의 길은 앞과 같다', () => {
    const branch = mapSource.slice(mapSource.indexOf('if (KEY_DIRS[k]) {'), mapSource.indexOf("if (k === 'Enter' || k === ' ') {"));
    expect(branch).toMatch(/if \(!keyWalks\(held, k, ev\.repeat\)\) \{\s*\n\s*ev\.preventDefault\(\);\s*\n\s*return;\s*\n\s*\}\s*\n\s*held\.add\(k\);/);
    expect(mapSource).toMatch(/if \(overlaid\(\)\) \{\s*\n\s*if \(held\.size > 0\) \{\s*\n\s*held\.clear\(\);/);
    expect(mapSource).toMatch(/const onBlur = \(\): void => \{\s*\n\s*held\.clear\(\);/);
    expect(mapSource).toMatch(/const onKeyUp = \(ev: KeyboardEvent\): void => \{[^}]*held\.delete\(k\);/);
    expect(mapSource).toMatch(/if \(!session \|\| ev\.repeat\) return;/); // Enter·Space의 되풀이는 앞과 같이 거른다
    expect(mapSource.match(/keyWalks\(/g)?.length).toBe(2); // 정의 하나와 쓰는 곳 하나
  });
});
