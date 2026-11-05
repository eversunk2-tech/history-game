// 그림 올리기 ①(spec 4.7.5)의 그림 규칙: 촘촘함과 배율(ㄱ), 사람(ㄴ·ㅁ·ㅊ), 땅(ㄷ·ㄹ·ㅌ·ㅎ)과 따뜻함(ㅍ), 무게(ㅋ).
// tests/pixel.test.ts에 있던 것을 그대로 옮겼다(따로 돌아 시험이 빨리 끝난다). 캔버스 없이 버퍼만 본다.

import { describe, expect, it, vi } from 'vitest';
import { neutigol, type Stage } from '../src/content/maps/neutigol';
import { SEASONS, type Season } from '../src/engine/types';
import { TILE, type Weather } from '../src/map/types';
import { anchorOf } from '../src/pixel/catalog';
import { GROUND_TILE, waterFrames } from '../src/pixel/ground';
import { MASTER, TONES, type Tone } from '../src/pixel/master';
import { paletteOf } from '../src/pixel/palette';
import { DIRS, GUISES, HEROES, PERSON_AX, PERSON_AY, PERSON_H, PERSON_W, SHEET_COLS, VILLAGERS, personFrame, personOf, personSheet } from '../src/pixel/people';
import { ART, blue, green, hex, red } from '../src/pixel/px';
import { Snapper } from '../src/pixel/quant';
import { baseSteps, buildAtlas, ensureAll, ensureBase, groundCanvas, needsOf, paintChunk, prepareSteps, runSteps, shadesOf, workGround } from '../src/pixel/atlas';
import { atlasFor } from '../src/map/session';
import { CLOTH } from '../src/pixel/palette';
import { footShadow } from '../src/pixel/people';
import { artScale, scaleFor } from '../src/map/camera';
import { blotch, edgeContrast, gateScene, harshChecker, harshOrphans, luma, monotony, seasonGround, warmth } from './artRules';

/** 그림 벌 다섯: 네 계절과 큰비가 온 해의 여름 */
const SKIES: [Tone, Season, Weather][] = [
  ['spring', 'spring', 'clear'],
  ['summer', 'summer', 'clear'],
  ['rain', 'summer', 'rain'],
  ['autumn', 'autumn', 'clear'],
  ['winter', 'winter', 'clear'],
];

vi.setConfig({ testTimeout: 60_000 });

const SHEET_LOOKS: { name: string; season: Season; weather: Weather; stage: Stage; flood?: boolean }[] = [
  { name: '봄', season: 'spring', weather: 'clear', stage: 'late' },
  { name: '여름', season: 'summer', weather: 'clear', stage: 'late' },
  { name: '큰비 여름(단오 전)', season: 'summer', weather: 'rain', stage: 'early' },
  { name: '큰비 여름(단오 뒤)', season: 'summer', weather: 'rain', stage: 'late' },
  { name: '가을(떠나기 전)', season: 'autumn', weather: 'clear', stage: 'early' },
  { name: '가을(떠난 뒤)', season: 'autumn', weather: 'clear', stage: 'gone' },
  { name: '가을(돌아온 뒤)', season: 'autumn', weather: 'clear', stage: 'late' },
  { name: '가을(가을걷이 뒤)', season: 'autumn', weather: 'clear', stage: 'done' },
  { name: '큰비 해 가을', season: 'autumn', weather: 'clear', stage: 'done', flood: true },
  { name: '겨울', season: 'winter', weather: 'clear', stage: 'late' },
];

// ── 그림 올리기 ①의 규칙(spec 4.7.5) ─────────────────────────────
// 수치는 docs/mockup-art/lib.mjs와 같은 셈(tests/artRules.ts)으로, 시안의 자리(대문 앞 — region.json)를 게임의 그림 코드로 그려 잰다.
// 괄호 안은 기획서의 기준(지금 → 3.1차 시안)이다.

describe('그림 올리기 ①: 촘촘함과 배율(ㄱ)', () => {
  it('그림 점은 맵 점의 반이다: 땅 한 칸 32, 사람 48×64(발끝 24·60), 물결 128. 맵의 칸은 16 그대로다', () => {
    expect(ART).toBe(2);
    expect(TILE).toBe(16);
    expect(GROUND_TILE).toBe(32);
    expect([PERSON_W, PERSON_H, PERSON_AX, PERSON_AY]).toEqual([48, 64, 24, 60]);
    expect(waterFrames(paletteOf('spring'), 1)[0].w).toBe(128);
    // 세운 것의 발치와 그림자는 맵 점 그대로다
    expect(anchorOf('choga', 10, 20)).toEqual({ x: 10 * 16 + 48, y: 21 * 16 - 2 });
  });

  it('배율이 그림 점의 정수배가 아니면 가장 가까운 짝수로: 사람의 CSS 키가 96에 가까운 쪽, 같으면 큰 쪽(13.1의 53번)', () => {
    expect(artScale(6, 2)).toBe(6);
    expect(artScale(4, 1.5)).toBe(4);
    expect(artScale(4, 1)).toBe(4);
    expect(artScale(8, 2)).toBe(8);
    expect(artScale(3, 1)).toBe(4); // 크롬북·작은 PC 3 → 4
    expect(artScale(5, 1.75)).toBe(6);
    expect(artScale(7, 2.25)).toBe(6);
    expect(artScale(2, 1)).toBe(2);
    // 기기마다 사람의 CSS 키(맵 점 32 × 배율 ÷ 화소 비율). 무대는 위 띠(CSS 120)를 뺀 높이다.
    const cssTall = (cssW: number, cssH: number, dpr: number): number => {
      const s = artScale(scaleFor(cssW * dpr, (cssH - 120) * dpr, dpr), dpr, ART);
      expect(s % ART, `${cssW}×${cssH}@${dpr}`).toBe(0);
      return Math.round((32 * s) / dpr);
    };
    expect(cssTall(1180, 820, 2)).toBe(96); // 아이패드 에어
    expect(cssTall(1080, 810, 2)).toBe(96); // 아이패드 9·10세대
    expect(cssTall(1280, 800, 1.5)).toBe(85); // 갤럭시탭(1.5)
    expect(cssTall(1280, 800, 2)).toBe(96); // 갤럭시탭(2)
    expect(cssTall(1920, 1080, 1)).toBe(128); // 교사 TV·PC
    expect(cssTall(1366, 768, 1)).toBe(128); // 크롬북·작은 PC: 3 → 4(96 → 128)
  });
});

describe('그림 올리기 ①: 사람(ㄴ·ㅁ·ㅊ)', () => {
  const everyone = { ...HEROES, ...VILLAGERS, ...GUISES };
  it('서른일곱 모습 모두 네 방향 × 걷기 넉 장·숨쉬기 두 장·일 넉 장·앉기 두 장이 시트에 있다', () => {
    expect(Object.keys(everyone).length).toBe(37);
    for (const [name, p] of Object.entries(everyone)) {
      const sheet = personSheet(p);
      expect([sheet.w, sheet.h], name).toEqual([PERSON_W * SHEET_COLS, PERSON_H * 4]);
      // 빈 칸이 없다
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < SHEET_COLS; col++) {
          let on = 0;
          for (let y = 0; y < PERSON_H; y++) for (let x = 0; x < PERSON_W; x++) if (sheet.get(col * PERSON_W + x, row * PERSON_H + y) !== 0) on++;
          expect(on, `${name} ${row},${col}`).toBeGreaterThan(400);
        }
      }
    }
  });

  it('테두리는 (나) 제 빛깔을 짙게 한 부드러운 테두리다: 먹빛 검은 선이 아니고, 따뜻하다(빨강이 파랑보다 크거나 같다)', () => {
    const INK = hex('#2a2422');
    for (const [name, p] of Object.entries(everyone)) {
      for (const dir of DIRS) {
        const f = personFrame(p, dir, 'idle', 0);
        let edge = 0;
        let warm = 0;
        for (let y = 0; y < f.h; y++) {
          for (let x = 0; x < f.w; x++) {
            const c = f.get(x, y);
            if (c === 0) continue;
            if (f.get(x - 1, y) !== 0 && f.get(x + 1, y) !== 0 && f.get(x, y - 1) !== 0 && f.get(x, y + 1) !== 0) continue;
            edge++;
            expect(c, `${name} ${dir}`).not.toBe(INK);
            if (red(c) >= blue(c)) warm++;
          }
        }
        expect(warm / edge, `${name} ${dir}`).toBeGreaterThan(0.97);
      }
    }
  });

  it('테두리는 거의 먹빛도 아니다: 테두리 점 가운데 밝기 0.2 이하의 몫에 위 한도(모두 0.4, 한 모습 0.9, 흰옷의 주인공 0.45·어른 0.1·아주머니 0.25)', () => {
    // 머리·짙은 옷의 테두리는 본디 어둡다(검은 갓의 관원·남빛 치마의 아씨가 0.8 남짓). 테두리에 먹빛을 반만 섞어도 모두 0.45를 넘는다
    let edges = 0;
    let darks = 0;
    const share: Record<string, number> = {};
    for (const [name, p] of Object.entries(everyone)) {
      let edge = 0;
      let dark = 0;
      for (const dir of DIRS) {
        const f = personFrame(p, dir, 'idle', 0);
        for (let y = 0; y < f.h; y++) {
          for (let x = 0; x < f.w; x++) {
            const c = f.get(x, y);
            if (c === 0) continue;
            if (f.get(x - 1, y) !== 0 && f.get(x + 1, y) !== 0 && f.get(x, y - 1) !== 0 && f.get(x, y + 1) !== 0) continue;
            edge++;
            if (luma(c) <= 0.2) dark++;
          }
        }
      }
      share[name] = dark / edge;
      edges += edge;
      darks += dark;
      expect(share[name], name).toBeLessThanOrEqual(0.9);
    }
    expect(darks / edges).toBeLessThanOrEqual(0.4);
    expect(share['farmer-boy']).toBeLessThanOrEqual(0.45);
    expect(share.elderMan).toBeLessThanOrEqual(0.1);
    expect(share.wellWoman).toBeLessThanOrEqual(0.25);
  });

  it('얼굴과 발(3.1차 시안): 앞모습의 입은 계절의 벌에 맞춰도 붉고, 바지 입은 사람의 두 짝 신은 갈라져 있다(37모습 모두)', () => {
    for (const [name, p] of Object.entries(everyone)) {
      const f = personFrame(p, 'down', 'idle', 0);
      for (const tone of TONES) {
        const snap = new Snapper(MASTER[tone]);
        const g = snap.apply(f.clone());
        // 입: 얼굴 가운데에 붉은 점이 둘 넘는 줄이 있고 그 밑은 턱(살빛)이다(빨강이 초록보다 0.3 넘게 크다 — 볼의 분홍과 살빛은 그만큼 붉지 않다)
        const skin = new Set<number>(p.skin.map((c) => snap.nearest(c)));
        let lip = 0;
        for (let y = 4; y < PERSON_AY - 8; y++) {
          let n = 0;
          for (let x = PERSON_AX - 2; x <= PERSON_AX + 1; x++) {
            const c = g.get(x, y);
            if (c !== 0 && red(c) - green(c) > 0.3 * 255 && red(c) < 200) n++;
          }
          if (n >= 2 && skin.has(g.get(PERSON_AX - 1, y + 1))) lip = Math.max(lip, n);
        }
        if (!p.beard) expect(lip, `${name} ${tone} 입`).toBeGreaterThanOrEqual(2);
      }
      if (p.bottom !== 'pants') continue;
      // 신의 줄(발바닥 바로 위)에서 가운데 두 점은 신이 아니고(테두리가 메운 틈), 그 양옆은 신이다
      const y = PERSON_AY - 2;
      const shoe = new Set<number>(p.shoes);
      expect(shoe.has(f.get(PERSON_AX - 1, y)) || shoe.has(f.get(PERSON_AX, y)), `${name} 신 사이`).toBe(false);
      expect(f.get(PERSON_AX - 1, y), `${name} 신 사이`).not.toBe(0);
      expect(shoe.has(f.get(PERSON_AX - 3, y)), `${name} 왼짝`).toBe(true);
      expect(shoe.has(f.get(PERSON_AX + 2, y)), `${name} 오른짝`).toBe(true);
    }
  });

  it('얼굴: 앞모습에 2×3의 눈 둘(젊은이와 아이는 왼쪽 위에 반짝임)과 입이 있다', () => {
    const f = personFrame(HEROES['farmer-boy'], 'down', 'idle', 0);
    const INK = hex('#2a2422');
    let ink = 0;
    let shine = 0;
    for (const c of f.d) {
      if (c === INK) ink++;
      if (c === hex('#faf6ec')) shine++;
    }
    expect(ink).toBeGreaterThanOrEqual(8); // 눈 두 쪽(반짝임 빼고 다섯 점씩 남짓)
    expect(shine).toBe(2);
  });

  it('흰 무명옷은 그대로다(고증) — 바닥과는 테두리와 발밑 그림자로 가른다: 사람의 가장 바깥 점과 바로 밖 바닥의 밝기 차 0.3 이상', () => {
    expect(HEROES['farmer-boy'].top).toBe(CLOTH.cotton);
    const g = gateScene('spring');
    expect(g.people.length).toBe(3);
    // 바로 밖 바닥은 움직이는 발밑 그림자를 얹기 전의 바닥으로 잰다(spec 4.7.5 — 발밑 그림자는 아래 시험이 따로 본다)
    for (const p of g.people) expect(edgeContrast(p.sprite, p.x, p.y, g.floor, g.bare), p.id).toBeGreaterThanOrEqual(0.3);
  });

  it('발밑의 그림자는 따뜻하다(곱해 얹는 빛이 바닥을 붉은 밤빛 쪽으로 어둡게 한다. 겨울에는 붉은 보랏빛)', () => {
    for (const season of SEASONS) {
      const f = footShadow(paletteOf(season));
      const core = f.get(f.w >> 1, f.h >> 1);
      expect(red(core) > blue(core) || season === 'winter', season).toBe(true);
      expect(red(core) + green(core) + blue(core), season).toBeLessThan(255 * 3 * 0.85);
      if (season === 'winter') expect(red(core)).toBeGreaterThanOrEqual(green(core)); // 푸르스름하지 않다
    }
  });
});

describe('그림 올리기 ①: 땅(ㄷ·ㄹ·ㅌ·ㅎ)과 따뜻함(ㅍ) — 대문 앞', () => {
  const g = gateScene('spring');

  it('대비 큰 체크무늬 천 개당 0.5 이하, 대비 큰 외톨이 점 천 개당 1 이하(1.92 → 0.08, 7.65 → 0.10)', () => {
    expect(harshChecker(g.ground.px)).toBeLessThanOrEqual(0.5);
    expect(harshOrphans(g.ground.px)).toBeLessThanOrEqual(1);
  });

  it('수채화 같은 큰 결: 풀 밝기 5.6·색조 3.7·갈래 7 이상·평탄 18.5% 이하, 흙 밝기 5.4·색조 3.3·갈래 8 이상·평탄 36% 이하', () => {
    const m = monotony(g.ground);
    expect(m.grass.lumaStd).toBeGreaterThanOrEqual(5.6);
    expect(m.grass.warmStd).toBeGreaterThanOrEqual(3.7);
    expect(m.grass.tones).toBeGreaterThanOrEqual(7);
    expect(m.grass.flatPct).toBeLessThanOrEqual(18.5);
    expect(m.dirt.lumaStd).toBeGreaterThanOrEqual(5.4);
    expect(m.dirt.warmStd).toBeGreaterThanOrEqual(3.3);
    expect(m.dirt.tones).toBeGreaterThanOrEqual(8);
    expect(m.dirt.flatPct).toBeLessThanOrEqual(36);
  });

  it('얼룩덜룩함의 위 한도: 흙 3.8·풀 4.0 이하(이웃 조각끼리 부드럽게 이어진다)', () => {
    const b = blotch(g.ground);
    expect(b.dirt).toBeLessThanOrEqual(3.8);
    expect(b.grass).toBeLessThanOrEqual(4.0);
  });

  it('따뜻함: 풀빛 색상각 95~105°, 화면의 R−B 49 이상, 어두운 점의 R−B 0 이상·몫 7% 이하', () => {
    const w = warmth(g.scene);
    expect(w.greenHue).toBeGreaterThanOrEqual(95);
    expect(w.greenHue).toBeLessThanOrEqual(105);
    expect(w.warmth).toBeGreaterThanOrEqual(49);
    expect(w.darkWarmth).toBeGreaterThanOrEqual(0);
    expect(w.darkShare).toBeLessThanOrEqual(7);
  });

  it('땅은 네 계절과 큰비 모두 대비 큰 잡티가 없다(들판·냇가·뒷산·마당)', () => {
    const spots: [number, number][] = [
      [600, 780],
      [620, 980],
      [480, 40],
      [470, 420],
    ];
    for (const [, season, weather] of SKIES) {
      for (const [x, y] of spots) {
        const v = seasonGround(season, weather, x, y, 240, 180);
        expect(harshOrphans(v.px), `${season}/${weather} ${x},${y}`).toBeLessThanOrEqual(1);
        expect(harshChecker(v.px), `${season}/${weather} ${x},${y}`).toBeLessThanOrEqual(0.5);
      }
    }
  }, 60000);

  it('계절마다 대문 앞의 그늘이 푸르스름해지지 않는다(어두운 점의 R−B 0 이상)', () => {
    for (const [, season, weather] of SKIES) expect(warmth(gateScene(season, weather).scene).darkWarmth, `${season}/${weather}`).toBeGreaterThanOrEqual(0);
  }, 60000);
});

describe('그림 올리기 ①: 무게(ㅋ)', () => {
  it('캔버스 넓이의 합 80MB 이하, 한 장 1,600만 점 이하(계절마다 그 맵에 놓인 것과 나오는 사람만 지은 한 벌 + 땅 한 장)', () => {
    const made: { width: number; height: number }[] = [];
    vi.stubGlobal(
      'ImageData',
      class {
        data: Uint8ClampedArray;
        width: number;
        height: number;
        constructor(data: Uint8ClampedArray, width: number, height: number) {
          this.data = data;
          this.width = width;
          this.height = height;
        }
      },
    );
    vi.stubGlobal('document', {
      createElement: () => {
        const c = { width: 0, height: 0, getContext: () => ({ putImageData: () => undefined }) };
        made.push(c);
        return c;
      },
    });
    try {
      for (const look of SHEET_LOOKS) {
        made.length = 0;
        const map = neutigol(look.season, look.weather, look.stage, look.flood);
        const atlas = buildAtlas(look.season, look.weather, needsOf(map, ['farmer-boy', 'farmer-girl']));
        // 벌의 바탕(물결·날림·표시·구름 그림자)은 처음 쓸 때 짓는다 — 다 지은 넓이로 센다
        ensureBase(atlas);
        groundCanvas(atlas, map, shadesOf(atlas, map.objects));
        const area = made.reduce((n, c) => n + c.width * c.height, 0);
        const biggest = Math.max(...made.map((c) => c.width * c.height));
        expect((area * 4) / 2 ** 20, look.name).toBeLessThanOrEqual(80);
        expect(biggest, look.name).toBeLessThanOrEqual(16_000_000);
      }
    } finally {
      vi.unstubAllGlobals();
    }
  }, 120000);

  /** 캔버스를 흉내 낸다: 만든 캔버스를 모으고, 캔버스에 놓은 점(putImageData)을 자리와 함께 적어 둔다 */
  interface FakeCanvas {
    width: number;
    height: number;
    puts: { x: number; y: number; w: number; h: number; d: Uint32Array }[];
    getContext(): { putImageData(img: { data: Uint8ClampedArray; width: number; height: number }, x: number, y: number): void };
  }
  const fakeCanvas = (): FakeCanvas[] => {
    const made: FakeCanvas[] = [];
    vi.stubGlobal(
      'ImageData',
      class {
        data: Uint8ClampedArray;
        width: number;
        height: number;
        constructor(data: Uint8ClampedArray, width: number, height: number) {
          this.data = data;
          this.width = width;
          this.height = height;
        }
      },
    );
    vi.stubGlobal('document', {
      createElement: () => {
        const c: FakeCanvas = {
          width: 0,
          height: 0,
          puts: [],
          getContext: () => ({
            putImageData: (img, x, y) => void c.puts.push({ x, y, w: img.width, h: img.height, d: new Uint32Array(img.data.slice().buffer) }),
          }),
        };
        made.push(c);
        return c;
      },
    });
    return made;
  };

  it('한 벌만 든다: 다른 계절(이나 큰비)을 부르면 들고 있던 벌을 놓는다', () => {
    fakeCanvas();
    try {
      const spring = atlasFor('spring');
      expect(atlasFor('spring')).toBe(spring);
      const summer = atlasFor('summer');
      expect(summer).not.toBe(spring);
      const rain = atlasFor('summer', 'rain');
      expect(rain).not.toBe(summer);
      // 봄으로 돌아오면 새로 짓는다(앞의 봄 벌을 들고 있지 않았다)
      const again = atlasFor('spring');
      expect(again).not.toBe(spring);
      expect(again.season).toBe('spring');
      // 봄·가을·겨울은 비가 와도 같은 벌
      expect(atlasFor('spring', 'rain')).toBe(again);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('그림 벌에는 그 맵에 놓인 것과 나오는 사람·짐승만 짓는다(땅을 칠해도 더 짓지 않는다)', () => {
    fakeCanvas();
    try {
      for (const look of SHEET_LOOKS) {
        const map = neutigol(look.season, look.weather, look.stage, look.flood);
        const needs = needsOf(map, ['farmer-boy', 'farmer-girl']);
        const atlas = buildAtlas(look.season, look.weather, needs);
        const g = groundCanvas(atlas, map, shadesOf(atlas, map.objects));
        paintChunk(g, 0, 0);
        expect([...atlas.things.keys()].sort(), look.name).toEqual([...needs.things].sort());
        expect([...atlas.people.keys()].sort(), look.name).toEqual([...needs.people].sort());
        expect([...atlas.critters.keys()].sort(), look.name).toEqual([...needs.critters].sort());
        // 맵에 없는 사람은 짓지 않았다
        expect(atlas.people.has('official') === needs.people.includes('official'), look.name).toBe(true);
      }
    } finally {
      vi.unstubAllGlobals();
    }
  }, 120000);

  it('벌의 사람 시트는 personSheet(한 장 48×64)를 벌에 맞춘 것과 점 하나까지 같다(한 번에 지어도, 방향 한 줄씩 나눠 지어도)', () => {
    const made = fakeCanvas();
    try {
      const map = neutigol('spring');
      const needs = needsOf(map, ['farmer-boy', 'farmer-girl']);
      const whole = buildAtlas('spring', 'clear', { things: [], people: [], critters: [] });
      ensureAll(whole, { things: [], people: needs.people, critters: [] });
      const parts = buildAtlas('spring', 'clear', { things: [], people: [], critters: [] });
      const steps = prepareSteps(parts, { things: [], people: needs.people, critters: [] });
      // 벌의 바탕(물결 스물넉 장, 날림, 표시 …) 다음에 사람마다 방향 한 줄씩 넷
      expect(steps.length).toBe(baseSteps(parts).length + needs.people.length * 4);
      runSteps(steps);
      for (const name of needs.people) {
        const p = personOf(name);
        if (!p) continue;
        const want = whole.snap.apply(personSheet(p));
        expect([want.w, want.h]).toEqual([PERSON_W * SHEET_COLS, PERSON_H * 4]);
        expect([PERSON_W, PERSON_H]).toEqual([48, 64]);
        for (const atlas of [whole, parts]) {
          const c = atlas.people.get(name) as unknown as FakeCanvas;
          expect(made.includes(c), name).toBe(true);
          expect([c.width, c.height], name).toEqual([want.w, want.h]);
          expect(c.puts.length, name).toBe(1);
          expect(c.puts[0].d.every((v, i) => v === want.d[i]), name).toBe(true);
        }
      }
    } finally {
      vi.unstubAllGlobals();
    }
  }, 60000);

  it('땅 조각을 한 장의 시간 안에 잘게 나눠 칠해도(차례를 바꾸고 도중에 다른 조각을 끼워도) 한 번에 칠한 것과 점 하나까지 같다', () => {
    fakeCanvas();
    try {
      const map = neutigol('spring');
      const atlas = buildAtlas('spring', 'clear', needsOf(map));
      const shades = shadesOf(atlas, map.objects);
      const a = groundCanvas(atlas, map, shades);
      const b = groundCanvas(atlas, map, shades);
      // 대문 둘레의 조각 여섯
      const ids: number[] = [];
      for (let cy = 1; cy <= 2; cy++) for (let cx = 1; cx <= 3; cx++) ids.push(cy * a.cw + cx);
      for (const i of ids) paintChunk(a, i % a.cw, Math.floor(i / a.cw));
      const order = [...ids].reverse();
      let calls = 0;
      while (ids.some((i) => !b.done[i])) {
        // 0밀리초: 한 번에 한 걸음만
        workGround(b, 0, () => order.find((i) => !b.done[i]) ?? -1);
        calls++;
        // 나눠 칠하던 조각이 있는 동안 다른 조각을 먼저 다 칠한다(걸어가 화면에 들어온 조각)
        if (calls === 7) paintChunk(b, ids[0] % b.cw, Math.floor(ids[0] / b.cw));
      }
      expect(calls).toBeGreaterThan(ids.length * 10);
      expect(b.cur).toBe(null);
      const put = (g: typeof a): Map<string, Uint32Array> => new Map((g.canvas as unknown as FakeCanvas).puts.map((q) => [`${q.x},${q.y},${q.w},${q.h}`, q.d]));
      const pa = put(a);
      const pb = put(b);
      expect([...pb.keys()].sort()).toEqual([...pa.keys()].sort());
      for (const [k, d] of pa) expect(d.every((v, i) => v === pb.get(k)?.[i]), k).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  }, 60000);
});
