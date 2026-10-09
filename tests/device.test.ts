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
