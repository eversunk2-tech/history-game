// 코드로 그린 배경. 그림 파일이 없는 자리(또는 아직 못 받은 자리)에 나온다.
// 맵의 도트 그림(src/pixel)을 그대로 가져다 옆에서 본 풍경으로 늘어놓는다. 바깥 그림 파일을 쓰지 않는다.
// 자리는 이름으로 부른다:
//   entrance(마을 어귀) · paddy(논) · well(우물가) · temple(절 마당) · hill(뒷산 숲) · yard(집 마당)
//   stream(냇가) · road(큰길·길목) · threshing(타작 마당) · pass(고갯마루) · hyanggyo(향교 앞) · manor(양반 댁 대문 앞) · room(집 안)
//   neighbor(옆집 — 우리 집 마당 yard와 다른 작고 허름한 초가)
// 모르는 이름이면 먼 마을 풍경이 나온다. 계절의 빛은 맵과 같은 팔레트에서 온다.
//
// 계절마다 달라 보인다(빛깔만이 아니라): 논은 물 댄 논 → 푸른 벼 → 누런 벼와 볏단 → 빈 논과 눈,
// 밭은 갈아 놓은 흙 → 푸른 것 → 거둔 그루 → 눈, 바닥에는 가을의 떨어진 잎과 겨울의 눈, 지붕과 담과 돌 위의 눈,
// 냇가에는 단오의 그네와 씨름판(여름)과 살얼음(겨울), 타작 마당에는 볏단 더미와 개상과 멍석(가을).
//
// 그때 없던 것은 그리지 않는다(spec 9.6): 간판·글씨·엽전·줄 맞춘 모·장터·유리창이 없다. 논의 벼는 줄을 맞추지 않았다.
// 집 안은 흙벽·나무 기둥·널문·살창·멍석뿐이다(종이 바른 문과 세간은 확인하지 못해 그리지 않았다).
// 중요한 것은 가운데에 두고, 아래 4분의 1은 대화창 자리로 비워 둔다. 가운데에는 사람이 서므로 볼거리는 양옆과 위에 둔다.

import type { Season } from '../engine/types';
import { MAKERS } from '../pixel/catalog';
import { paletteOf, type Palette, type Ramp } from '../pixel/palette';
import { Px, bayer, clamp, fbm, hash2, hex, mix, pick, vnoise, type Color } from '../pixel/px';
import type { SpriteDef } from '../pixel/shapes';

export const BACKDROP_PLACES = [
  'entrance',
  'paddy',
  'well',
  'temple',
  'hill',
  'yard',
  'stream',
  'road',
  'threshing',
  'pass',
  'hyanggyo',
  'manor',
  'room',
  'neighbor',
] as const;

// ── 맵의 도트 그림 가져오기 ────────────────────────────────────

const spriteCache = new Map<string, SpriteDef | null>();

function spriteOf(pal: Palette, kind: string, variant: number): SpriteDef | null {
  const key = `${pal.season}:${kind}:${variant}`;
  if (!spriteCache.has(key)) {
    const make = MAKERS[kind];
    let def: SpriteDef | null = null;
    try {
      def = make ? make(pal, variant) : null;
    } catch {
      def = null; // 그림 하나가 안 그려져도 배경은 나온다
    }
    spriteCache.set(key, def);
  }
  return spriteCache.get(key) ?? null;
}

/** 눈의 빛깔(어두움 → 밝음). 팔레트에 눈이 없으면 이 벌을 쓴다. */
const SNOW_PLAIN: Ramp = ['#aebccb', '#c9d5df', '#e0e8ed', '#f1f5f6', '#ffffff'].map((c) => hex(c));
const snowOf = (pal: Palette): Ramp => (pal as Partial<Palette>).snow ?? SNOW_PLAIN;

/** 겨울에 위쪽에 눈이 얹히는 것들(지붕, 담, 울타리, 짚가리, 돌, 나뭇더미) */
const SNOWY = new Set([
  'choga',
  'hut',
  'hall',
  'shed',
  'manor',
  'wing',
  'temple',
  'gate',
  'wallH',
  'stonewallH',
  'fenceH',
  'strawstack',
  'woodpile',
  'jars',
  'well',
  'pagoda',
  'lantern',
  'cairn',
  'rockS',
  'rockM',
  'rockL',
  'flatstone',
  'log',
  'stump',
  'fallen',
]);

const snowCache = new Map<string, Px>();

/**
 * 그림의 위쪽 테두리를 따라 눈을 얹는다. 평평한 곳에는 두껍게, 가파른 곳에는 얇게 쌓인다.
 * 먹빛 테두리(맨 위 한 점)는 그대로 두고 그 아래에 얹어, 밝은 겨울 하늘 앞에서도 생김새가 또렷하다.
 */
function snowCapped(img: Px, pal: Palette, seed: number): Px {
  const out = img.clone();
  const snow = snowOf(pal);
  const top: number[] = [];
  for (let x = 0; x < img.w; x++) {
    let t = -1;
    for (let y = 0; y < img.h; y++) {
      if (img.d[y * img.w + x] !== 0) {
        t = y;
        break;
      }
    }
    top.push(t);
  }
  for (let x = 0; x < img.w; x++) {
    const t = top[x];
    if (t < 0) continue;
    const l = top[Math.max(0, x - 1)];
    const r = top[Math.min(img.w - 1, x + 1)];
    const slope = Math.max(l < 0 ? 9 : Math.abs(l - t), r < 0 ? 9 : Math.abs(r - t));
    const thick = slope <= 1 ? 3 : slope <= 3 ? 2 : slope <= 6 ? 1 : 0;
    for (let k = 1; k <= thick; k++) {
      const y = t + k;
      if (out.get(x, y) === 0) break;
      if (k === thick && thick > 1 && hash2(x, y, seed) < 0.38) continue; // 아래쪽 끝은 들쭉날쭉하게
      out.set(x, y, snow[snow.length - (k === 1 ? 1 : k === 2 ? 2 : 3)]);
    }
  }
  return out;
}

/** 세운 것 하나를 발치가 (x, y)에 오게 놓는다. 겨울에는 지붕과 담과 돌 위에 눈이 얹힌다. */
function put(px: Px, pal: Palette, kind: string, x: number, y: number, variant = 0, flip = false): void {
  const def = spriteOf(pal, kind, variant);
  if (!def || def.frames.length === 0) return;
  let img = def.frames[0];
  if (pal.season === 'winter' && SNOWY.has(kind)) {
    const key = `${kind}:${variant}`;
    let capped = snowCache.get(key);
    if (!capped) {
      capped = snowCapped(img, pal, 700 + variant);
      snowCache.set(key, capped);
    }
    img = capped;
  }
  const ax = flip ? img.w - 1 - def.ax : def.ax;
  px.blit(img, Math.round(x - ax), Math.round(y - def.ay), flip);
}

// ── 하늘, 산, 땅 ──────────────────────────────────────────────

const SKY: Record<Season, [string, string, string]> = {
  // 위 · 가운데 · 산마루 가까이
  spring: ['#86bfe6', '#b9def0', '#eef4e0'],
  summer: ['#69aee2', '#a3d3ee', '#e2f1e4'],
  autumn: ['#8dbbe0', '#cbe0ea', '#f6e9c8'],
  winter: ['#b4c2d4', '#d3dce6', '#eef0ee'],
};

function paintSky(px: Px, season: Season, horizon: number): void {
  const [top, mid, low] = SKY[season].map((s) => hex(s));
  const steps = 9;
  for (let y = 0; y < horizon; y++) {
    for (let x = 0; x < px.w; x++) {
      const t = clamp((y / Math.max(1, horizon)) * steps + (bayer(x, y) - 0.5) * 0.9, 0, steps);
      const u = Math.round(t) / steps;
      px.set(x, y, u < 0.6 ? mix(top, mid, u / 0.6) : mix(mid, low, (u - 0.6) / 0.4));
    }
  }
}

/** 구름. 여름에는 뭉게구름이 크고, 가을에는 높고 엷으며, 겨울에는 낮게 깔린다. */
function paintClouds(px: Px, season: Season, horizon: number, seed: number): void {
  const light = hex(season === 'winter' ? '#e9edf1' : '#ffffff');
  const shade = hex(season === 'winter' ? '#c8d1dc' : '#dbe8f0');
  const grow = season === 'summer' ? 1.45 : season === 'autumn' ? 0.8 : 1;
  const flat = season === 'autumn' ? 0.55 : season === 'winter' ? 0.7 : 1;
  const spots: [number, number, number][] = [
    [0.16, 0.2, 1],
    [0.74, 0.13, 1.25],
    [0.93, 0.34, 0.8],
    [0.42, 0.08, 0.7],
  ];
  spots.forEach(([fx, fy, size], i) => {
    const cx = Math.round(px.w * fx + (hash2(i, 3, seed) - 0.5) * 20);
    const cy = Math.round(horizon * fy);
    const k = size * grow;
    for (let n = 0; n < 5; n++) {
      const dx = (n - 2) * 9 * k;
      const r = (6 + hash2(i, n, seed) * 5) * k;
      px.ellipse(cx + dx, cy + 2, r * 1.5, r * 0.8 * flat, shade);
      px.ellipse(cx + dx - 1, cy - 1, r * 1.4, r * 0.75 * flat, light);
    }
    // 여름의 뭉게구름은 위로 봉긋 솟는다
    if (season === 'summer') {
      px.ellipse(cx - 4, cy - 7 * k, 9 * k, 7 * k, light);
      px.ellipse(cx + 9 * k, cy - 4 * k, 7 * k, 5 * k, light);
    }
  });
}

/** 산줄기 하나. top(x)까지를 채운다. */
function paintRidge(px: Px, horizon: number, base: number, amp: number, freq: number, ramp: Ramp, seed: number, haze: Color | null): void {
  for (let x = 0; x < px.w; x++) {
    const n = fbm(x * freq, 0.5, seed) * 0.7 + vnoise(x * freq * 3.1, 2.5, seed + 9) * 0.3;
    const top = Math.round(horizon - base - amp * n);
    for (let y = Math.max(0, top); y < horizon; y++) {
      // 왼쪽 위가 밝고 골짜기가 어둡다
      const tex = fbm(x / 5, y / 3.5, seed + 3);
      const depth = (y - top) / Math.max(1, horizon - top);
      let c = pick(ramp, 0.72 - depth * 0.35 + (tex - 0.5) * 0.6, x, y, 0.7);
      if (haze !== null) c = mix(c, haze, 0.52);
      px.set(x, y, c);
    }
  }
}

/** 바닥(풀·흙·마당). 멀수록 조금 밝다. */
function paintGround(px: Px, y0: number, ramp: Ramp, seed: number, tone = 0.5): void {
  for (let y = Math.max(0, y0); y < px.h; y++) {
    const far = 1 - (y - y0) / Math.max(1, px.h - y0);
    for (let x = 0; x < px.w; x++) {
      const tex = fbm(x / 13, y / 6, seed) * 0.65 + hash2(x, y, seed + 1) * 0.35;
      px.set(x, y, pick(ramp, tone + far * 0.14 + (tex - 0.5) * 0.5, x, y, 0.6));
    }
  }
}

/** 다져진 마당 흙. 위쪽 끝은 풀밭과 들쭉날쭉하게 만난다. */
function paintYard(px: Px, pal: Palette, y0: number, seed: number, tone = 0.5, ragged = 12): void {
  for (let y = Math.max(0, y0 - ragged); y < px.h; y++) {
    for (let x = 0; x < px.w; x++) {
      const edge = (vnoise(x / 18, y / 6, seed) - 0.5) * ragged;
      if (y < y0 + edge) continue;
      const tex = fbm(x / 11, y / 5, seed + 1) * 0.6 + hash2(x, y, seed + 2) * 0.4;
      px.set(x, y, pick(pal.yard, tone + (tex - 0.5) * 0.5, x, y, 0.6));
    }
  }
}

type Skip = (x: number, y: number) => boolean;

/** 풀포기와 들꽃을 드문드문 */
function paintTufts(px: Px, pal: Palette, y0: number, seed: number, skip?: Skip): void {
  // 여름에는 풀이 우거지고, 겨울에는 마른 풀포기만 드문드문 눈 위로 올라온다
  const thick = pal.season === 'summer' ? 60 : pal.season === 'winter' ? 170 : 90;
  const n = Math.round((px.w * (px.h - y0)) / thick);
  for (let i = 0; i < n; i++) {
    const x = Math.floor(hash2(i, 1, seed) * px.w);
    const y = y0 + 2 + Math.floor(hash2(i, 2, seed) * (px.h - y0 - 3));
    if (skip?.(x, y)) continue;
    const kind = hash2(i, 3, seed);
    if (pal.flowers && kind > 0.82) {
      px.set(x, y, kind > 0.92 ? pal.yellow[pal.yellow.length - 1] : pal.blossomWhite[pal.blossomWhite.length - 1]);
    } else {
      const tip = pal.grassTip[Math.min(pal.grassTip.length - 1, 1 + Math.floor(kind * 3))];
      px.set(x, y, tip);
      px.set(x, y - 1, tip);
      if (kind > 0.4) px.set(x + 1, y, pal.grass[0]);
    }
  }
}

/** 겨울: 바닥에 눈이 얼룩얼룩 쌓였다. cover가 클수록 넓게 덮인다(0~1). 다른 계절에는 아무것도 하지 않는다. */
function paintSnow(px: Px, pal: Palette, y0: number, seed: number, cover = 0.45, skip?: Skip): void {
  if (pal.season !== 'winter') return;
  const snow = snowOf(pal);
  const cut = 1 - cover;
  for (let y = Math.max(0, y0); y < px.h; y++) {
    for (let x = 0; x < px.w; x++) {
      if (skip?.(x, y)) continue;
      const n = fbm(x / 21, y / 7, seed) * 0.72 + vnoise(x / 6, y / 3, seed + 3) * 0.28;
      if (n <= cut) continue;
      // 눈더미의 가장자리는 그늘져 푸르고 가운데는 희다
      px.set(x, y, pick(snow, 0.35 + (n - cut) * 3.2, x, y, 0.6));
    }
  }
}

/** 가을: 바닥에 떨어진 잎이 흩어져 있다. 다른 계절에는 아무것도 하지 않는다. */
function paintLitter(px: Px, pal: Palette, y0: number, seed: number, per = 70, skip?: Skip): void {
  if (pal.season !== 'autumn') return;
  const n = Math.round((px.w * (px.h - y0)) / per);
  for (let i = 0; i < n; i++) {
    const x = Math.floor(hash2(i, 5, seed) * px.w);
    const y = y0 + 1 + Math.floor(hash2(i, 6, seed) * (px.h - y0 - 2));
    if (skip?.(x, y)) continue;
    const kind = hash2(i, 7, seed);
    const c = kind > 0.5 ? pal.leaf[3 + Math.floor(kind * 3) % 3] : pal.leafDeep[3 + Math.floor(kind * 6) % 3];
    px.set(x, y, c);
    if (kind > 0.7) px.set(x + 1, y, c);
  }
}

/** 하늘에 날리는 것: 겨울의 눈송이, 가을의 낙엽 몇 잎(드문드문 — 그림을 어지럽히지 않을 만큼) */
function paintDrift(px: Px, pal: Palette, seed: number, upto = px.h): void {
  if (pal.season !== 'winter' && pal.season !== 'autumn') return;
  const winter = pal.season === 'winter';
  const n = Math.round((px.w * upto) / (winter ? 300 : 1500));
  const snow = snowOf(pal);
  for (let i = 0; i < n; i++) {
    const x = Math.floor(hash2(i, 11, seed) * px.w);
    const y = Math.floor(hash2(i, 12, seed) * upto);
    if (winter) {
      px.set(x, y, snow[snow.length - 1]);
      if (hash2(i, 13, seed) > 0.7) px.set(x + 1, y, snow[snow.length - 2]);
    } else {
      const c = pal.leaf[3 + (i % 3)];
      px.set(x, y, c);
      px.set(x + 1, y + (i % 2), c);
    }
  }
}

/**
 * 멀어지며 좁아지는 흙길. 아래 가운데에서 시작해 (endX, y0)로 간다. 길 위인지 알려 주는 함수를 돌려준다.
 */
function paintPath(px: Px, ramp: Ramp, y0: number, endX: number, wTop: number, wBot: number, seed: number, bend = 0): Skip {
  const cx = px.w / 2;
  const span = Math.max(1, px.h - y0);
  const centerAt = (y: number): number => {
    const t = (y - y0) / span; // 0 멀리 · 1 가까이
    return endX + (cx - endX) * t + Math.sin(t * Math.PI) * bend;
  };
  const halfAt = (y: number): number => {
    const t = (y - y0) / span;
    return (wTop + (wBot - wTop) * t * t) / 2;
  };
  const on = (x: number, y: number): boolean => {
    if (y < y0 || y >= px.h) return false;
    const edge = (vnoise(y / 5, x / 40, seed) - 0.5) * 4;
    return Math.abs(x - centerAt(y)) <= halfAt(y) + edge;
  };
  for (let y = y0; y < px.h; y++) {
    for (let x = 0; x < px.w; x++) {
      if (!on(x, y)) continue;
      const tex = fbm(x / 9, y / 4, seed + 5) * 0.6 + hash2(x, y, seed + 6) * 0.4;
      px.set(x, y, pick(ramp, 0.55 + (tex - 0.5) * 0.55, x, y, 0.6));
    }
  }
  return on;
}

/**
 * 논 한 배미. 계절에 따라 모습이 바뀐다(줄을 맞추지 않는다 — 볍씨를 논에 바로 뿌렸다).
 *   봄: 갈아엎어 물을 댄 논. 흙덩이가 물 위로 드문드문 보인다.
 *   여름: 푸른 벼가 논을 덮고, 벼 사이로 물빛이 드문드문 비친다.
 *   가을: 누렇게 익은 벼. 물은 빠졌다.
 *   겨울: 벤 그루만 남은 빈 논에 눈이 얼룩얼룩 쌓였다.
 */
function paintPaddy(px: Px, pal: Palette, x0: number, x1: number, y0: number, y1: number, seed: number): void {
  const state = pal.paddyState;
  const snow = snowOf(pal);
  for (let y = Math.max(0, y0); y < Math.min(px.h, y1); y++) {
    const far = 1 - (y - y0) / Math.max(1, y1 - y0);
    for (let x = Math.max(0, x0); x < Math.min(px.w, x1); x++) {
      let c: Color;
      if (state === 'bare') {
        const tex = fbm(x / 8, y / 4, seed) * 0.6 + hash2(x, y, seed) * 0.4;
        c = pick(pal.mud, 0.45 + (tex - 0.5) * 0.6, x, y, 0.6);
        if (hash2(x, y, seed + 4) > 0.955) c = pal.crop[1]; // 벤 그루터기
        if (pal.season === 'winter') {
          const lie = fbm(x / 19, y / 5, seed + 21) * 0.75 + vnoise(x / 5, y / 2.5, seed + 22) * 0.25;
          if (lie > 0.47) c = pick(snow, 0.4 + (lie - 0.47) * 3, x, y, 0.6);
        }
      } else if (state === 'water') {
        // 물: 멀수록 하늘빛이 밝게 비친다. 잔물결은 가로로 눕는다.
        const ripple = vnoise(x / 14, y / 2.2, seed + 2);
        c = pick(pal.paddy, 0.3 + far * 0.5 + (ripple - 0.5) * 0.3, x, y, 0.5);
        // 물 위로 올라온 흙덩이
        const clod = fbm(x / 6, y / 3, seed + 7);
        if (clod > 0.75) c = pick(pal.mud, 0.2 + (clod - 0.75) * 2.6, x, y, 0.5);
      } else {
        // 벼가 논을 덮었다. 포기마다 키와 빛이 달라 얼룩덜룩하다.
        const grow = hash2(x, y, seed + 11) * 0.45 + fbm(x / 5, y / 3, seed + 12) * 0.55;
        c = pick(pal.crop, 0.18 + far * 0.2 + grow * 0.72, x, y, 0.6);
        // 가까운 논은 포기 사이의 그늘이 세로로 선다
        if (far < 0.6 && hash2(x, y >> 1, seed + 14) > 0.84) c = pal.crop[0];
        const gap = vnoise(x / 9, y / 2.4, seed + 13);
        if (state === 'green' && grow < 0.24 && gap > 0.5) c = pick(pal.paddy, 0.3 + far * 0.45, x, y, 0.5); // 벼 사이의 물빛
        if (state === 'gold' && grow < 0.16 && gap > 0.5) c = pick(pal.mud, 0.55, x, y, 0.5); // 이삭 사이의 논바닥
      }
      px.set(x, y, c);
    }
  }
}

/** 벼를 벤 자리: 논바닥과 그루터기(가을걷이를 한 논의 한쪽) */
function paintStubble(px: Px, pal: Palette, x0: number, x1: number, y0: number, y1: number, seed: number): void {
  for (let y = Math.max(0, y0); y < Math.min(px.h, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(px.w, x1); x++) {
      const edge = (vnoise(y / 4, x / 30, seed + 3) - 0.5) * 8;
      if (x < x0 + 4 + edge) continue;
      const tex = fbm(x / 8, y / 4, seed) * 0.6 + hash2(x, y, seed) * 0.4;
      let c = pick(pal.mud, 0.5 + (tex - 0.5) * 0.6, x, y, 0.6);
      if (hash2(x, y, seed + 4) > 0.93) c = pal.crop[2];
      px.set(x, y, c);
    }
  }
}

/** 논둑: 풀이 난 흙 둑. 가로로 눕되 살짝 구불거린다. */
function paintBund(px: Px, pal: Palette, y: number, thick: number, seed: number, x0 = 0, x1 = px.w): void {
  for (let x = Math.max(0, x0); x < Math.min(px.w, x1); x++) {
    const wob = Math.round((vnoise(x / 22, 0.3, seed) - 0.5) * 5);
    for (let k = 0; k < thick; k++) {
      const yy = y + wob + k;
      const t = k / Math.max(1, thick - 1);
      const tex = hash2(x, yy, seed + 2);
      px.set(x, yy, t < 0.55 ? pick(pal.grass, 0.55 - t * 0.5 + (tex - 0.5) * 0.4, x, yy, 0.5) : pick(pal.soil, 0.75 - (t - 0.55) * 1.4 + (tex - 0.5) * 0.3, x, yy, 0.5));
    }
  }
}

/**
 * 밭 한 뙈기. 봄에는 갈아 놓은 흙, 여름에는 푸른 것이 덮고, 가을에는 거둔 그루가 남고, 겨울에는 눈이 덮인다.
 */
function paintPlowed(px: Px, pal: Palette, x0: number, x1: number, y0: number, y1: number, seed: number): void {
  const snow = snowOf(pal);
  for (let y = Math.max(0, y0); y < Math.min(px.h, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(px.w, x1); x++) {
      const edge = (vnoise(x / 9, y / 3, seed + 3) - 0.5) * 6;
      if (x < x0 + 3 + edge || x > x1 - 3 + edge) continue;
      const tex = fbm(x / 7, y / 2.5, seed) * 0.55 + hash2(x, y, seed + 1) * 0.45;
      let c = pick(pal.soil, 0.5 + (tex - 0.5) * 0.9, x, y, 0.6);
      const grow = hash2(x, y, seed + 5) * 0.6 + fbm(x / 4, y / 2, seed + 6) * 0.4;
      if (pal.season === 'summer' && grow > 0.3) c = pick(pal.crop, 0.2 + grow * 0.75, x, y, 0.6);
      else if (pal.season === 'autumn' && grow > 0.62) c = pick(pal.crop, 0.3 + grow * 0.5, x, y, 0.6);
      else if (pal.season === 'winter') {
        const lie = fbm(x / 15, y / 4, seed + 8) * 0.7 + hash2(x, y, seed + 9) * 0.3;
        if (lie > 0.42) c = pick(snow, 0.4 + (lie - 0.42) * 2.6, x, y, 0.6);
      }
      px.set(x, y, c);
    }
  }
}

/**
 * 냇물 한 줄기. top(x)와 bot(x) 사이를 물로 채운다. 먼 쪽 물가는 그늘지고, 가까운 쪽에는 모래톱이 드러난다.
 * 겨울에는 물가에 살얼음이 낀다.
 */
function paintWater(px: Px, pal: Palette, top: (x: number) => number, bot: (x: number) => number, seed: number): void {
  const winter = pal.season === 'winter';
  const snow = snowOf(pal);
  const ice = mix(pal.water[pal.water.length - 2], snow[snow.length - 2], 0.6);
  const sand = pal.path;
  for (let x = 0; x < px.w; x++) {
    const t = Math.round(top(x));
    const b = Math.round(bot(x));
    // 먼 쪽 물가: 둑의 그늘
    px.set(x, t - 1, pal.soil[1]);
    px.set(x, t - 2, pick(pal.grass, 0.25, x, t, 0.4));
    for (let y = t; y <= b; y++) {
      const d = (y - t) / Math.max(1, b - t); // 0 먼 쪽 · 1 가까운 쪽
      const ripple = vnoise(x / 11 + y * 0.35, y / 1.7, seed);
      let c = pick(pal.water, 0.22 + (1 - d) * 0.28 + (ripple - 0.5) * 0.55, x, y, 0.6);
      if (ripple > 0.78 && hash2(x, y, seed + 1) > 0.45) c = pal.water[pal.water.length - 1]; // 반짝이는 물결
      if (y - t < 1) c = pal.water[0];
      if (winter && Math.min(y - t, b - y) < 2.5 + vnoise(x / 8, 0.4, seed + 5) * 3.5) c = hash2(x, y, seed + 6) > 0.8 ? snow[snow.length - 1] : ice;
      px.set(x, y, c);
    }
    // 가까운 쪽 물가: 젖은 모래와 자갈
    const beach = 3 + Math.round(vnoise(x / 13, 0.7, seed + 2) * 5);
    for (let k = 1; k <= beach; k++) {
      const y = b + k;
      let c = pick(sand, 0.55 + (k / beach) * 0.3 + (hash2(x, y, seed + 3) - 0.5) * 0.3, x, y, 0.5);
      if (hash2(x, y, seed + 4) > 0.9) c = pal.stone[2 + (x % 3)];
      px.set(x, y, c);
    }
  }
}

/** 가로로 늘어선 담이나 울타리 */
function putRow(px: Px, pal: Palette, kind: string, x0: number, x1: number, y: number, step = 16): void {
  let i = 0;
  for (let x = x0; x <= x1; x += step) put(px, pal, kind, x, y, i++ % 3);
}

// ── 자리마다 ──────────────────────────────────────────────────

interface Frame {
  px: Px;
  pal: Palette;
  season: Season;
  /** 가운데 */
  cx: number;
  /** 산마루(하늘과 땅이 만나는 줄) */
  horizon: number;
  /** 대화창 위쪽 끝쯤(세운 것의 발치를 여기 위에 둔다) */
  floor: number;
}

function open(f: Frame, far = true): void {
  const { px, pal, season, horizon } = f;
  paintSky(px, season, horizon);
  paintClouds(px, season, horizon, 11);
  const haze = hex(SKY[season][2]);
  if (far) paintRidge(px, horizon, 20, 34, 1 / 70, pal.leafDeep, 21, haze);
  paintRidge(px, horizon, 4, 24, 1 / 46, pal.leafDeep, 37, mix(haze, pal.leafDeep[1], 0.55));
}

function entrance(f: Frame): void {
  const { px, pal, cx, horizon, floor } = f;
  open(f);
  paintGround(px, horizon, pal.grass, 5);
  // 길 양쪽의 밭(봄에는 갈아 놓은 흙, 여름에는 푸른 것, 가을에는 거둔 그루, 겨울에는 눈)
  paintPlowed(px, pal, cx - px.w, cx - 46, horizon + 26, horizon + 46, 61);
  paintPlowed(px, pal, cx + 60, cx + px.w, horizon + 34, horizon + 58, 62);
  const onPath = paintPath(px, pal.path, horizon + 6, cx + 34, 8, px.w * 0.42, 71, -18);
  paintTufts(px, pal, horizon + 2, 81, onPath);
  paintLitter(px, pal, floor - 30, 82, 46);
  paintSnow(px, pal, horizon + 8, 83, 0.4);
  // 멀리 초가 몇 채와 돌담
  put(px, pal, 'choga', cx - 128, horizon + 24, 3);
  put(px, pal, 'hut', cx + 132, horizon + 22, 2);
  put(px, pal, 'choga', cx + 214, horizon + 30, 4);
  putRow(px, pal, 'stonewallH', cx - 196, cx - 190 + 16 * 2, horizon + 30);
  putRow(px, pal, 'stonewallH', cx + 86, cx + 86 + 16 * 2, horizon + 30);
  put(px, pal, 'blossom', cx - 60, horizon + 20, 0);
  put(px, pal, 'blossom', cx + 176, horizon + 18, 2);
  // 한가운데의 큰 느티나무
  put(px, pal, 'zelkova', cx - 6, floor - 4, 0);
  put(px, pal, 'flatstone', cx + 44, floor + 2, 0);
  put(px, pal, 'rockS', cx - 58, floor + 4, 1);
  paintDrift(px, pal, 84, floor);
}

function paddy(f: Frame): void {
  const { px, pal, cx, horizon, floor } = f;
  open(f);
  paintGround(px, horizon, pal.grass, 5);
  // 멀리 마을
  put(px, pal, 'hut', cx - 150, horizon + 12, 1);
  put(px, pal, 'hut', cx + 120, horizon + 10, 3);
  put(px, pal, 'young', cx + 70, horizon + 10, 1);
  put(px, pal, 'willow', cx - 96, horizon + 14, 0);
  // 논배미 셋(먼 것부터). 사이사이에 논둑.
  const y1 = horizon + 16;
  const y2 = horizon + 40;
  const y3 = Math.max(y2 + 30, floor - 4);
  paintPaddy(px, pal, 0, px.w, y1, y2, 101);
  paintPaddy(px, pal, 0, px.w, y2, y3, 102);
  paintPaddy(px, pal, 0, px.w, y3, px.h, 103);
  // 가을: 가운데 논의 오른쪽은 벌써 벼를 베었다. 벤 볏단을 논에 세워 말린다.
  const reaped = pal.paddyState === 'gold';
  if (reaped) paintStubble(px, pal, cx + 62, px.w, y2, y3, 104);
  paintBund(px, pal, y1 - 3, 4, 111);
  paintBund(px, pal, y2 - 3, 5, 112);
  paintBund(px, pal, y3 - 3, 7, 113);
  if (reaped) {
    put(px, pal, 'sheaf', cx + 96, y3 - 8, 0);
    put(px, pal, 'sheaf', cx + 128, y3 - 14, 1);
    put(px, pal, 'sheaf', cx + 160, y3 - 7, 0);
    put(px, pal, 'sheaf', cx + 192, y3 - 13, 1);
  }
  // 논둑에 난 풀과 돌
  put(px, pal, 'reed', cx - 120, y2 + 1, 0);
  put(px, pal, 'reed', cx + 150, y3 + 2, 1);
  put(px, pal, 'tuft', cx + 40, y2 + 1, 0);
  put(px, pal, 'rockS', cx - 30, y3 + 3, 0);
  paintDrift(px, pal, 114, floor);
}

function wellPlace(f: Frame): void {
  const { px, pal, cx, horizon, floor } = f;
  open(f);
  paintGround(px, horizon, pal.grass, 5);
  // 우물 둘레의 다져진 마당 흙
  paintYard(px, pal, horizon + 34, 131);
  paintLitter(px, pal, horizon + 40, 134, 120);
  paintSnow(px, pal, horizon + 30, 135, 0.42);
  put(px, pal, 'choga', cx + 118, horizon + 34, 1);
  put(px, pal, 'hut', cx - 150, horizon + 28, 0);
  putRow(px, pal, 'stonewallH', cx - 100, cx - 100 + 16 * 3, horizon + 30);
  put(px, pal, 'blossom', cx - 62, horizon + 28, 1);
  put(px, pal, 'young', cx + 196, horizon + 26, 0);
  put(px, pal, 'jars', cx + 60, horizon + 40, 0);
  // 우물은 한가운데에서 조금 왼쪽, 사람이 설 자리 곁에
  put(px, pal, 'well', cx - 72, floor - 2, 0);
  put(px, pal, 'flatstone', cx - 30, floor + 3, 1);
  put(px, pal, 'tuft', cx + 96, floor, 1);
  paintDrift(px, pal, 136, floor);
}

function temple(f: Frame): void {
  const { px, pal, cx, horizon, floor } = f;
  // 산이 바짝 다가와 있다
  paintSky(px, f.season, horizon);
  paintClouds(px, f.season, horizon, 17);
  const haze = hex(SKY[f.season][2]);
  paintRidge(px, horizon, 30, 44, 1 / 60, pal.leafDeep, 41, mix(haze, pal.leafDeep[1], 0.4));
  paintRidge(px, horizon, 8, 30, 1 / 38, pal.pine, 43, null);
  paintGround(px, horizon, pal.forest, 7, 0.55);
  // 마당의 고운 흙
  paintYard(px, pal, horizon + 36, 151, 0.56, 10);
  paintLitter(px, pal, horizon + 38, 154, 90);
  paintSnow(px, pal, horizon + 32, 155, 0.44);
  // 뒤의 소나무
  put(px, pal, 'pine', cx - 150, horizon + 20, 0);
  put(px, pal, 'oldpine', cx - 104, horizon + 26, 0);
  put(px, pal, 'pine', cx + 112, horizon + 22, 1);
  put(px, pal, 'pineS', cx + 160, horizon + 28, 0);
  put(px, pal, 'pine', cx + 204, horizon + 20, 2);
  put(px, pal, 'pine', cx - 206, horizon + 24, 2);
  // 법당과 돌탑
  put(px, pal, 'temple', cx, Math.min(floor - 14, horizon + 58), 0);
  put(px, pal, 'pagoda', cx + 104, floor - 2, 0);
  put(px, pal, 'azalea', cx - 96, floor - 6, 0);
  put(px, pal, 'rockM', cx - 132, floor, 0);
  paintDrift(px, pal, 156, floor);
}

function hill(f: Frame): void {
  const { px, pal, cx, floor } = f;
  // 숲속이라 하늘이 조금만 보인다
  const horizon = Math.round(px.h * 0.3);
  paintSky(px, f.season, horizon);
  const haze = hex(SKY[f.season][2]);
  paintRidge(px, horizon, 10, 26, 1 / 50, pal.leafDeep, 51, mix(haze, pal.leafDeep[1], 0.5));
  paintGround(px, horizon, pal.forest, 9, 0.5);
  const onPath = paintPath(px, pal.path, horizon + 18, cx - 26, 6, px.w * 0.36, 171, 22);
  paintTufts(px, pal, horizon + 20, 181, onPath);
  paintLitter(px, pal, horizon + 20, 182, 34);
  paintSnow(px, pal, horizon + 14, 183, 0.5, onPath);
  // 뒤쪽 나무들(촘촘히)
  const back = ['pine', 'pineS', 'oak', 'pine', 'young', 'pineS'];
  for (let i = -7; i <= 7; i++) {
    const x = cx + i * 30 + Math.round((hash2(i, 1, 191) - 0.5) * 14);
    if (Math.abs(x - (cx - 22)) < 18) continue; // 길은 비운다
    put(px, pal, back[(i + 70) % back.length], x, horizon + 22 + Math.round(hash2(i, 2, 191) * 8), (i + 70) % 3);
  }
  // 가운데 줄
  const mid: [string, number, number, number][] = [
    ['oak', -150, 46, 0],
    ['pine', -92, 52, 1],
    ['oldpine', 92, 50, 0],
    ['oak', 158, 54, 1],
    ['pine', 214, 48, 0],
    ['pineS', -214, 50, 1],
  ];
  for (const [kind, dx, dy, v] of mid) put(px, pal, kind, cx + dx, horizon + dy, v);
  // 나무하는 자리: 그루터기와 쓰러진 나무
  put(px, pal, 'stump', cx + 58, floor - 2, 0);
  put(px, pal, 'fallen', cx - 98, floor + 2, 0);
  put(px, pal, 'azalea', cx + 128, floor - 6, 1);
  put(px, pal, 'rockM', cx - 160, floor - 4, 1);
  put(px, pal, 'bush', cx + 176, floor + 4, 0);
  paintDrift(px, pal, 184, floor);
}

function yard(f: Frame): void {
  const { px, pal, cx, horizon, floor } = f;
  open(f);
  paintGround(px, horizon, pal.grass, 5);
  // 마당 흙
  paintYard(px, pal, horizon + 18, 201, 0.5, 0);
  paintLitter(px, pal, horizon + 24, 203, 150);
  paintSnow(px, pal, horizon + 22, 204, 0.4);
  // 울타리 너머의 나무
  put(px, pal, 'young', cx + 150, horizon + 14, 1);
  put(px, pal, 'blossom', cx - 170, horizon + 14, 0);
  putRow(px, pal, 'fenceH', cx - 240, cx + 240, horizon + 20);
  // 초가 한 채, 장독, 짚가리, 나뭇더미
  put(px, pal, 'choga', cx - 8, Math.min(floor - 12, horizon + 66), 0);
  put(px, pal, 'jars', cx + 86, floor - 10, 0);
  put(px, pal, 'jars', cx + 112, floor - 6, 1);
  put(px, pal, 'strawstack', cx - 112, floor - 8, 0);
  put(px, pal, 'woodpile', cx - 150, floor - 2, 0);
  // 가을: 거둔 볏단을 처마 밑에 세워 두었다
  if (pal.paddyState === 'gold') {
    put(px, pal, 'sheaf', cx + 150, floor - 8, 0);
    put(px, pal, 'sheaf', cx + 172, floor - 3, 1);
  }
  paintDrift(px, pal, 205, floor);
}

/**
 * 옆집: 우리 집 마당(yard)과 다른 집이다. 더 작고 허름한 초가 한 채(묵은 짚 지붕), 군데군데 무너진 낮은 돌담,
 * 성기게 엮은 울타리 한 토막, 그루터기. 짚가리도 장독 무더기도 없다(곡식이 떨어진 집 — 겨울 덤 「곡식이 떨어진 옆집」).
 */
function neighbor(f: Frame): void {
  const { px, pal, cx, horizon, floor } = f;
  open(f);
  paintGround(px, horizon, pal.grass, 5);
  // 좁고 고르지 않은 마당
  paintYard(px, pal, horizon + 30, 361, 0.44, 14);
  paintTufts(px, pal, horizon + 2, 362, (_x, y) => y > horizon + 36);
  paintLitter(px, pal, horizon + 30, 363, 110);
  paintSnow(px, pal, horizon + 26, 364, 0.46);
  // 먼 데: 나무 몇 그루(집은 이 한 채뿐이다 — 우리 집 마당과 헷갈리지 않게)
  put(px, pal, 'oak', cx + 150, horizon + 16, 0);
  put(px, pal, 'young', cx + 104, horizon + 16, 2);
  put(px, pal, 'oak', cx - 196, horizon + 26, 1);
  // 무너진 데가 있는 낮은 돌담(왼쪽)과 성긴 울타리 한 토막(오른쪽)
  put(px, pal, 'stonewallH', cx - 168, horizon + 34, 1);
  put(px, pal, 'stonewallH', cx - 152, horizon + 34, 2);
  put(px, pal, 'rockS', cx - 132, horizon + 35, 0);
  put(px, pal, 'stonewallH', cx - 104, horizon + 34, 0);
  put(px, pal, 'fenceH', cx + 76, horizon + 38, 2);
  put(px, pal, 'fenceH', cx + 92, horizon + 39, 1);
  // 작고 허름한 초가(묵은 짚). 가운데에서 조금 왼쪽 — 사람이 서는 자리 뒤에 지붕이 보인다.
  put(px, pal, 'hut', cx - 44, Math.min(floor - 16, horizon + 62), 3);
  // 마당에는 그루터기와 돌 하나뿐
  put(px, pal, 'stump', cx + 118, floor - 6, 1);
  put(px, pal, 'rockS', cx - 128, floor, 1);
  put(px, pal, 'tuft', cx + 150, floor + 2, 0);
  paintDrift(px, pal, 365, floor);
}

/** 냇가: 냇물이 가로질러 흐르고 징검돌이 놓였다. 가까운 쪽 물가에 큰 나무가 선다. 단오(여름)에는 그네와 씨름판이 차려진다. */
function stream(f: Frame): void {
  const { px, pal, cx, horizon, floor } = f;
  open(f);
  paintGround(px, horizon, pal.grass, 5);
  // 건너편: 멀리 초가 한 채, 물가의 버드나무
  put(px, pal, 'hut', cx - 168, horizon + 14, 2);
  put(px, pal, 'young', cx + 60, horizon + 12, 0);
  put(px, pal, 'willow', cx - 84, horizon + 22, 0);
  put(px, pal, 'willow', cx + 176, horizon + 24, 1);
  put(px, pal, 'reed', cx + 108, horizon + 26, 0);
  // 냇물: 왼쪽 위에서 오른쪽 아래로 살짝 기울어 흐른다
  const top = (x: number): number => horizon + 25 + (x / px.w) * 9 + (vnoise(x / 30, 0.5, 301) - 0.5) * 8;
  const bot = (x: number): number => top(x) + 21 + (x / px.w) * 9 + (vnoise(x / 26, 1.5, 302) - 0.5) * 6;
  paintWater(px, pal, top, bot, 303);
  // 징검돌: 물을 비스듬히 건넌다
  for (let i = 0; i < 5; i++) {
    const x = cx - 132 + i * 10;
    put(px, pal, 'flatstone', x, top(x) + ((bot(x) - top(x)) * (i + 0.6)) / 5.2 + 3, i % 2);
  }
  const wet: Skip = (x, y) => y <= bot(x) + 8;
  paintTufts(px, pal, horizon + 2, 304, (x, y) => y >= top(x) - 3 && wet(x, y));
  paintLitter(px, pal, floor - 40, 305, 60, wet);
  paintSnow(px, pal, horizon + 4, 306, 0.46, (x, y) => y >= top(x) - 1 && wet(x, y));
  // 물가의 돌과 갈대
  put(px, pal, 'rockM', cx - 60, bot(cx - 60) + 8, 0);
  put(px, pal, 'reed', cx - 30, bot(cx - 30) + 7, 1);
  put(px, pal, 'rockS', cx + 96, bot(cx + 96) + 9, 1);
  put(px, pal, 'reed', cx + 150, bot(cx + 150) + 8, 0);
  // 단오의 냇가(여름): 모래를 깐 씨름판, 창포 삶은 물을 담은 함지, 큰 나무에 맨 그네
  const dano = pal.season === 'summer';
  if (dano) {
    put(px, pal, 'sandring', cx - 116, floor + 6, 0);
    put(px, pal, 'basin', cx - 44, floor - 12, 0);
    put(px, pal, 'swing', cx + 102, floor - 15, 0);
  }
  // 가까운 쪽의 큰 나무(그네를 맬 만한 굵은 가지가 있다). 그네 줄의 위쪽은 잎에 가려진다.
  put(px, pal, 'bigtree', cx + 134, floor - 2, 0);
  put(px, pal, 'bush', cx + 196, floor + 4, 1);
  paintDrift(px, pal, 307, floor);
}

/** 큰길·길목: 넓은 흙길이 들을 지나 먼 산 쪽으로 멀어진다. 길가에 늙은 소나무와 바위. */
function road(f: Frame): void {
  const { px, pal, cx, horizon, floor } = f;
  open(f);
  paintGround(px, horizon, pal.grass, 5);
  // 길 양쪽의 밭과 논
  paintPlowed(px, pal, cx - px.w, cx - 70, horizon + 20, horizon + 38, 311);
  paintPaddy(px, pal, cx + 84, px.w, horizon + 14, horizon + 34, 312);
  paintBund(px, pal, horizon + 12, 3, 313, cx + 80, px.w);
  paintBund(px, pal, horizon + 33, 4, 314, cx + 74, px.w);
  // 큰길: 넓고, 멀리 산 사이로 사라진다
  const onPath = paintPath(px, pal.path, horizon + 1, cx - 34, 12, px.w * 0.66, 315, 30);
  paintTufts(px, pal, horizon + 2, 316, (x, y) => onPath(x, y) || (x > cx + 74 && y < horizon + 38));
  paintLitter(px, pal, horizon + 40, 317, 80);
  paintSnow(px, pal, horizon + 6, 318, 0.4, (x, y) => x > cx + 74 && y < horizon + 38);
  // 멀리 길가의 나무와 마을
  put(px, pal, 'hut', cx + 150, horizon + 10, 1);
  put(px, pal, 'young', cx - 96, horizon + 14, 1);
  put(px, pal, 'pineS', cx + 22, horizon + 12, 0);
  put(px, pal, 'oak', cx - 172, horizon + 30, 1);
  // 가까운 길가: 늙은 소나무, 바위(돌무더기는 그리지 않는다 — 대화 그림 목록과 맞춘다)
  put(px, pal, 'oldpine', cx - 132, floor - 10, 0);
  put(px, pal, 'pine', cx + 168, floor - 16, 1);
  put(px, pal, 'rockS', cx + 122, floor - 2, 0);
  put(px, pal, 'rockM', cx - 176, floor + 2, 1);
  put(px, pal, 'bush', cx + 200, floor + 4, 0);
  paintDrift(px, pal, 319, floor);
}

/** 타작 마당: 넓게 다져진 마당. 가을에는 볏단 더미와 낟알을 떠는 개상, 낟알을 넌 멍석이 놓인다. */
function threshing(f: Frame): void {
  const { px, pal, cx, horizon, floor } = f;
  open(f);
  paintGround(px, horizon, pal.grass, 5);
  paintYard(px, pal, horizon + 22, 321, 0.54, 8);
  paintLitter(px, pal, horizon + 30, 322, 130);
  paintSnow(px, pal, horizon + 24, 323, 0.38);
  // 마당 뒤의 집과 나무
  put(px, pal, 'oak', cx - 40, horizon + 20, 0);
  put(px, pal, 'young', cx + 84, horizon + 18, 1);
  put(px, pal, 'choga', cx - 150, horizon + 44, 2);
  put(px, pal, 'hut', cx + 158, horizon + 40, 1);
  put(px, pal, 'shed', cx + 62, horizon + 34, 0);
  putRow(px, pal, 'fenceH', cx - 84, cx + 12, horizon + 26);
  // 짚가리는 사철 서 있다
  put(px, pal, 'strawstack', cx + 126, floor - 12, 0);
  put(px, pal, 'strawstack', cx + 160, floor - 4, 1);
  if (pal.paddyState === 'gold') {
    // 가을걷이: 볏단 더미, 개상(통나무에 볏단을 내리쳐 낟알을 떤다), 낟알을 넌 멍석
    put(px, pal, 'sheafpile', cx - 150, floor - 14, 0);
    put(px, pal, 'sheafpile', cx - 112, floor - 6, 0);
    put(px, pal, 'sheaf', cx - 180, floor - 4, 1);
    put(px, pal, 'gaesang', cx - 70, floor + 4, 0);
    put(px, pal, 'grainmat', cx + 70, floor + 6, 0);
  } else {
    put(px, pal, 'woodpile', cx - 150, floor - 6, 0);
    put(px, pal, 'log', cx - 96, floor + 2, 0);
    put(px, pal, 'jars', cx - 190, floor - 12, 1);
  }
  paintDrift(px, pal, 324, floor);
}

/** 고갯마루: 양쪽 비탈 사이로 길이 넘어간다. 고개 너머로 겹겹의 산이 내려다보인다. */
function pass(f: Frame): void {
  const { px, pal, cx, floor } = f;
  const horizon = Math.round(px.h * 0.5);
  paintSky(px, f.season, horizon);
  paintClouds(px, f.season, horizon, 23);
  const haze = hex(SKY[f.season][2]);
  // 고개 너머: 멀수록 엷은 산줄기가 낮게 겹친다
  paintRidge(px, horizon, 10, 30, 1 / 110, pal.leafDeep, 331, mix(haze, pal.leafDeep[2], 0.12));
  paintRidge(px, horizon, 2, 20, 1 / 64, pal.leafDeep, 332, mix(haze, pal.leafDeep[1], 0.4));
  paintGround(px, horizon, pal.forest, 9, 0.54);
  // 양쪽 비탈: 가운데(고개의 목)에서 멀어질수록 높아진다. 산등성이는 둥글고 울퉁불퉁하다.
  const half = px.w / 2;
  const slope = (x: number): number => {
    const d = Math.abs(x - cx) / half;
    const u = clamp((d - 0.16) / 0.84, 0, 1);
    const rise = (u * u * (3 - 2 * u) * 0.75 + u * 0.25) * px.h * 0.6;
    const bump = (fbm(x / 26, 0.4, 333) - 0.5) * 22 + (vnoise(x / 7, 1.3, 341) - 0.5) * 5;
    return horizon + 3 - rise - bump * Math.min(1, u * 3);
  };
  for (let x = 0; x < px.w; x++) {
    const t = Math.round(slope(x));
    for (let y = Math.max(0, t); y < horizon + 4; y++) {
      const tex = fbm(x / 7, y / 4, 334) * 0.6 + hash2(x, y, 335) * 0.4;
      const depth = (y - t) / Math.max(1, horizon + 4 - t);
      // 등성이는 밝고 골은 어둡다. 덤불이 얼룩얼룩 덮였다.
      const bushy = fbm(x / 11, y / 7, 342) > 0.56;
      px.set(x, y, pick(bushy ? pal.leafDeep : pal.forest, (bushy ? 0.5 : 0.72) - depth * 0.3 + (tex - 0.5) * 0.5, x, y, 0.6));
    }
  }
  const onPath = paintPath(px, pal.path, horizon + 1, cx + 8, 12, px.w * 0.44, 336, -16);
  paintTufts(px, pal, horizon + 4, 337, onPath);
  paintLitter(px, pal, horizon + 6, 338, 44);
  paintSnow(px, pal, 0, 339, 0.48, (x, y) => y < slope(x) || onPath(x, y));
  // 비탈의 소나무(비탈의 높이를 따라 선다)
  const trees: [string, number, number, number][] = [
    ['pine', -196, 18, 0],
    ['pineS', -146, 16, 1],
    ['pine', 150, 16, 2],
    ['oldpine', 200, 20, 0],
    ['pineS', -104, 12, 0],
    ['pine', 112, 12, 1],
  ];
  for (const [kind, dx, dy, v] of trees) put(px, pal, kind, cx + dx, Math.min(horizon + 10, slope(cx + dx) + dy), v);
  // 고갯마루의 바위(돌무더기는 그리지 않는다 — 대화 그림 목록과 맞춘다)
  put(px, pal, 'rockS', cx + 62, horizon + 26, 1);
  put(px, pal, 'rockL', cx - 92, floor - 6, 0);
  put(px, pal, 'rockM', cx + 150, floor - 2, 1);
  put(px, pal, 'oak', cx - 172, floor - 2, 1);
  put(px, pal, 'bush', cx + 100, floor + 4, 0);
  paintDrift(px, pal, 340, floor);
}

/** 돌을 쌓은 낮은 축대(가로로 길게). 향교와 양반 댁의 담 밑에 쓴다. */
function paintTerrace(px: Px, pal: Palette, y: number, thick: number, seed: number): void {
  for (let k = 0; k < thick; k++) {
    for (let x = 0; x < px.w; x++) {
      const block = Math.floor((x + (k % 2) * 5) / 10);
      const joint = (x + (k % 2) * 5) % 10 === 0;
      const tone = 0.45 + (hash2(block, k, seed) - 0.5) * 0.35 - (k / thick) * 0.15;
      px.set(x, y + k, joint ? pal.stone[1] : pick(pal.stone, tone, x, y + k, 0.4));
    }
  }
  for (let x = 0; x < px.w; x++) px.set(x, y + thick, pal.stone[0]);
}

/** 향교 앞: 축대 위에 담과 문이 있고, 담 너머로 글 가르치는 큰 집의 기와지붕이 보인다. 현판은 그리지 않는다(글씨를 넣지 않는다). */
function hyanggyo(f: Frame): void {
  const { px, pal, cx, horizon, floor } = f;
  paintSky(px, f.season, horizon);
  paintClouds(px, f.season, horizon, 29);
  const haze = hex(SKY[f.season][2]);
  paintRidge(px, horizon, 26, 40, 1 / 66, pal.leafDeep, 341, mix(haze, pal.leafDeep[1], 0.45));
  paintRidge(px, horizon, 6, 24, 1 / 40, pal.pine, 342, null);
  paintGround(px, horizon, pal.grass, 5);
  // 담 안쪽: 뒤의 소나무와 큰 집 두 채(가운데의 가르치는 집, 옆의 작은 집)
  put(px, pal, 'pine', cx - 190, horizon + 22, 0);
  put(px, pal, 'pine', cx + 196, horizon + 20, 2);
  put(px, pal, 'oldpine', cx + 150, horizon + 28, 0);
  put(px, pal, 'wing', cx - 132, horizon + 38, 0);
  put(px, pal, 'manor', cx + 16, horizon + 42, 0);
  // 축대와 담, 가운데 왼쪽의 문
  const wallY = horizon + 54;
  const gateX = cx - 92;
  putRow(px, pal, 'wallH', cx - 248, gateX - 12, wallY);
  putRow(px, pal, 'wallH', gateX + 68, cx + 248, wallY);
  paintTerrace(px, pal, wallY + 3, 6, 343);
  // 문 앞마당의 흙과 문으로 오르는 돌계단
  paintYard(px, pal, wallY + 12, 344, 0.56, 4);
  for (let step = 0; step < 3; step++) {
    const y = wallY + 3 + step * 3;
    for (let x = gateX + 6 - step * 3; x < gateX + 50 + step * 3; x++) {
      px.set(x, y, pal.stone[4]);
      px.set(x, y + 1, pal.stone[3]);
      px.set(x, y + 2, pal.stone[1]);
    }
  }
  put(px, pal, 'gate', gateX, wallY + 2, 0);
  paintLitter(px, pal, wallY + 14, 345, 70);
  paintSnow(px, pal, wallY + 12, 346, 0.4);
  // 문 앞의 큰 나무와 돌
  put(px, pal, 'bigtree', cx + 150, floor - 4, 0);
  put(px, pal, 'flatstone', cx + 96, floor + 4, 0);
  put(px, pal, 'rockS', cx - 170, floor + 2, 1);
  put(px, pal, 'bush', cx - 196, floor - 4, 0);
  paintDrift(px, pal, 347, floor);
}

/** 양반 댁 대문 앞: 기와 얹은 담이 길게 이어지고 대문이 있다. 담 너머로 큰 기와집의 지붕과 나무가 보인다. */
function manorGate(f: Frame): void {
  const { px, pal, cx, horizon, floor } = f;
  open(f);
  paintGround(px, horizon, pal.grass, 5);
  // 담 안쪽: 큰 집과 곁채, 나무
  put(px, pal, 'young', cx - 196, horizon + 24, 0);
  put(px, pal, 'blossom', cx + 36, horizon + 28, 2);
  put(px, pal, 'manor', cx - 86, horizon + 40, 0);
  put(px, pal, 'wing', cx + 150, horizon + 38, 0);
  // 담과 대문(가운데 오른쪽)
  const wallY = horizon + 52;
  const gateX = cx + 40;
  putRow(px, pal, 'wallH', cx - 248, gateX - 12, wallY);
  putRow(px, pal, 'wallH', gateX + 68, cx + 248, wallY);
  put(px, pal, 'gate', gateX, wallY, 0);
  // 대문으로 난 길과 담 밑의 풀
  const onPath = paintPath(px, pal.path, wallY + 1, gateX + 28, 34, px.w * 0.5, 351, -10);
  paintTufts(px, pal, wallY + 4, 352, onPath);
  paintLitter(px, pal, wallY + 6, 353, 70);
  paintSnow(px, pal, wallY + 4, 354, 0.42);
  put(px, pal, 'flatstone', gateX + 18, wallY + 5, 0);
  put(px, pal, 'flatstone', gateX + 40, wallY + 5, 1);
  // 담 밖: 버드나무와 바위, 떨기나무
  put(px, pal, 'willow', cx - 150, floor - 14, 0);
  put(px, pal, 'rockM', cx - 104, floor - 2, 0);
  put(px, pal, 'bush', cx + 176, floor - 2, 1);
  put(px, pal, 'tuft', cx + 132, floor + 4, 0);
  paintDrift(px, pal, 355, floor);
}

/** 집 안(초가의 방): 흙벽과 나무 기둥, 널문과 살창, 바닥에 깐 멍석. 문틈과 살창으로 계절의 빛이 든다. */
function room(f: Frame): void {
  const { px, pal, cx, season } = f;
  const { w, h } = px;
  const top = Math.round(h * 0.1); // 서까래 밑
  const base = Math.round(h * 0.6); // 벽과 바닥이 만나는 줄
  const winter = season === 'winter';
  // 밖의 빛(문틈과 살창으로 보인다): 봄·여름은 풀빛이 돌고, 가을은 누렇고, 겨울은 눈빛이다
  const outside = winter ? mix(hex(SKY.winter[1]), snowOf(pal)[4], 0.6) : mix(hex(SKY[season][2]), pal.grass[5], season === 'autumn' ? 0.5 : 0.35);
  const dim = winter ? 0.84 : 1; // 겨울의 방은 문을 닫아 어둑하다

  // 천장: 서까래와 그늘
  for (let y = 0; y < top; y++) {
    for (let x = 0; x < w; x++) {
      const rafter = (x + Math.floor(y * 0.6)) % 22 < 5;
      px.set(x, y, rafter ? pal.wood[1 + ((x + y) % 2)] : pal.wood[0]);
    }
  }
  // 흙벽: 짚을 섞어 바른 흙. 위쪽과 구석은 그늘지고, 군데군데 얼룩이 졌다.
  for (let y = top; y < base; y++) {
    for (let x = 0; x < w; x++) {
      const tex = fbm(x / 16, y / 10, 361) * 0.55 + hash2(x, y, 362) * 0.25 + vnoise(x / 47, y / 31, 368) * 0.2;
      const shade = Math.max(0, 1 - (y - top) / 28) * 0.24 + (Math.abs(x - cx) / w) * 0.2 + Math.max(0, 1 - (base - y) / 10) * 0.1;
      let c = pick(pal.clay, (0.62 + (tex - 0.5) * 0.5 - shade) * dim, x, y, 0.6);
      if (hash2(x, y, 363) > 0.988) c = pal.thatch[3]; // 벽에 섞인 짚
      px.set(x, y, c);
    }
  }
  // 바닥: 다진 흙
  for (let y = base; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tex = fbm(x / 12, y / 5, 364) * 0.6 + hash2(x, y, 365) * 0.4;
      px.set(x, y, pick(pal.soil, (0.78 + (tex - 0.5) * 0.4) * dim, x, y, 0.6));
    }
  }
  // 기둥과 가로 나무(위의 도리, 아래의 하방)
  const posts = [cx - 160, cx - 58, cx + 58, cx + 160];
  const beam = (y: number, thick: number): void => {
    for (let k = 0; k < thick; k++) for (let x = 0; x < w; x++) px.set(x, y + k, pal.wood[k === 0 ? 4 : k === thick - 1 ? 1 : 2 + ((x >> 2) % 2)]);
  };
  beam(top, 5);
  beam(base - 4, 5);
  for (const x0 of posts) {
    for (let y = top; y < base; y++) {
      for (let k = 0; k < 7; k++) px.set(x0 + k, y, pal.wood[k === 0 ? 4 : k === 6 ? 1 : 2 + ((y >> 3) % 2)]);
    }
  }

  // 오른쪽 칸: 널문(나무 널을 이어 댄 문). 겨울에는 닫혀 있고, 다른 계절에는 조금 열려 밖의 빛이 든다.
  const dx0 = cx + 80;
  const dx1 = cx + 140;
  const dTop = top + 16;
  for (let y = dTop; y < base - 4; y++) {
    for (let x = dx0; x < dx1; x++) {
      const plank = (x - dx0) % 12;
      let c = pal.wood[plank === 0 ? 1 : 3 + ((x + (y >> 4)) % 2)];
      if (plank !== 0 && hash2(x, y >> 2, 369) > 0.9) c = pal.wood[2]; // 나뭇결
      if ((y === dTop + 10 || y === dTop + 11 || y === base - 16 || y === base - 15) && plank !== 0) c = pal.wood[y % 2 === 0 ? 4 : 1]; // 띠장
      px.set(x, y, c);
    }
  }
  for (let y = dTop - 2; y < base - 4; y++) {
    px.set(dx0 - 1, y, pal.wood[1]);
    px.set(dx0 - 2, y, pal.wood[4]);
    px.set(dx1, y, pal.wood[1]);
    px.set(dx1 + 1, y, pal.wood[4]);
  }
  for (let x = dx0 - 2; x <= dx1 + 1; x++) {
    px.set(x, dTop - 2, pal.wood[4]);
    px.set(x, dTop - 1, pal.wood[1]);
  }
  if (!winter) {
    // 문틈으로 든 빛: 문 안쪽 가장자리와 바닥에 길게 눕는다
    for (let y = dTop; y < base - 4; y++) {
      for (let x = dx0; x < dx0 + 6; x++) px.set(x, y, x < dx0 + 5 ? outside : pal.wood[4]);
    }
    for (let y = base + 1; y < Math.min(h, base + 40); y++) {
      const reach = (y - base) * 1.25;
      for (let x = Math.round(dx0 - 6 - reach); x < Math.round(dx0 + 6 - reach * 0.45); x++) {
        if (bayer(x, y) > 0.3) px.set(x, y, mix(px.get(x, y), outside, 0.45));
      }
    }
  }

  // 왼쪽 칸: 살창(나무 살을 세운 작은 창. 종이도 유리도 없다) — 밖의 빛이 살 사이로 보인다
  const wx0 = cx - 130;
  const wy0 = top + 16;
  for (let y = wy0; y < wy0 + 20; y++) {
    for (let x = wx0; x < wx0 + 40; x++) {
      const bar = (x - wx0) % 6 < 2;
      px.set(x, y, bar ? pal.wood[(x - wx0) % 6 === 0 ? 3 : 1] : outside);
    }
  }
  for (let x = wx0 - 2; x < wx0 + 42; x++) {
    px.set(x, wy0 - 2, pal.wood[4]);
    px.set(x, wy0 - 1, pal.wood[2]);
    px.set(x, wy0 + 20, pal.wood[1]);
    px.set(x, wy0 + 21, pal.wood[3]);
  }
  for (let y = wy0 - 2; y < wy0 + 22; y++) {
    px.set(wx0 - 2, y, pal.wood[3]);
    px.set(wx0 - 1, y, pal.wood[1]);
    px.set(wx0 + 40, y, pal.wood[3]);
    px.set(wx0 + 41, y, pal.wood[1]);
  }

  // 살창 밑의 시렁(벽에 가로지른 긴 나무) 위: 짚 바구니와 접어 둔 베
  const sy = wy0 + 46;
  for (let x = cx - 148; x < cx - 68; x++) {
    px.set(x, sy, pal.wood[4]);
    px.set(x, sy + 1, pal.wood[2]);
    px.set(x, sy + 2, pal.wood[0]);
  }
  for (const bx of [cx - 142, cx - 76]) for (let k = 0; k < 6; k++) px.set(bx + (bx < cx - 100 ? 0 : -1), sy + 3 + k, pal.wood[1]); // 받침
  // 바구니(짚으로 엮은 것)
  for (let y = 0; y < 11; y++) {
    const halfW = 10 - Math.floor(y / 3);
    for (let x = -halfW; x <= halfW; x++) px.set(cx - 126 + x, sy - 11 + y, pal.thatch[y === 0 ? 5 : (x + y) % 2 === 0 ? 4 : 2]);
  }
  // 접어 둔 베 두 필(물들이지 않은 삼베 빛)
  for (let fold = 0; fold < 2; fold++) {
    const bx = cx - 108 + fold * 4;
    const by = sy - 5 - fold * 5;
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 26 - fold * 8; x++) px.set(bx + x, by + y, y === 0 ? pal.plaster[3] : y === 4 ? pal.plaster[0] : pal.plaster[1 + ((x >> 2) % 2)]);
    }
  }

  // 바닥의 멍석(짚으로 엮은 자리): 가까울수록 넓어 보인다. 짚의 결이 가로로 눕고 엮은 줄이 드문드문 세로로 지난다.
  const my0 = base + 12;
  for (let y = my0; y < h; y++) {
    const t = (y - my0) / Math.max(1, h - my0);
    const halfW = Math.round(w * (0.24 + t * 0.12));
    for (let x = cx - halfW; x <= cx + halfW; x++) {
      const u = (x - cx) / halfW; // -1 ~ 1
      const edge = Math.abs(u) > 0.975 || y === my0;
      const strand = hash2(x >> 2, y, 367) * 0.5 + hash2(x, y, 370) * 0.2;
      let c = pick(pal.thatch, (0.55 + strand * 0.35) * dim, x, y, 0.5);
      if ((y - my0) % 4 === 3 && hash2(x >> 1, y, 371) > 0.3) c = pal.thatch[2]; // 짚 사이의 골
      const tie = Math.abs((u * 3.5) % 1);
      if (tie < 0.045 && (y - my0) % 2 === 0) c = pal.thatch[1]; // 엮은 줄
      if (edge) c = pal.thatch[1];
      px.set(x, y, c);
    }
  }

  // 시렁 밑의 독
  put(px, pal, 'jars', cx - 118, base + 12, 0);
  // 겨울: 등잔불(작은 종지에 심지를 담근 불)을 나무 받침에 올려 두었다. 불빛이 둘레를 살짝 밝힌다.
  if (winter) {
    const lx = cx - 84;
    const ly = base + 10;
    for (let y = 0; y < 14; y++) for (let x = -1; x <= 1; x++) px.set(lx + x, ly - y, pal.wood[x === -1 ? 3 : 1]);
    for (let x = -5; x <= 5; x++) {
      px.set(lx + x, ly, pal.wood[2]);
      px.set(lx + x, ly - 14, pal.wood[3]);
    }
    for (let x = -3; x <= 3; x++) px.set(lx + x, ly - 15, pal.stone[3]);
    const glow = hex('#ffd98a');
    for (let y = -40; y <= 10; y++) {
      for (let x = -30; x <= 30; x++) {
        const d = Math.hypot(x, (y + 16) * 1.1) / 30;
        if (d < 1 && bayer(lx + x, ly + y) > d * d) px.set(lx + x, ly + y, mix(px.get(lx + x, ly + y), glow, 0.3 * (1 - d)));
      }
    }
    px.set(lx, ly - 16, hex('#f2b443'));
    px.set(lx, ly - 17, hex('#ffe9a8'));
    px.set(lx, ly - 18, hex('#fff6d8'));
  }
}

function village(f: Frame): void {
  const { px, pal, cx, horizon, floor } = f;
  open(f);
  paintGround(px, horizon, pal.grass, 5);
  const onPath = paintPath(px, pal.path, horizon + 8, cx + 10, 8, px.w * 0.4, 211, 10);
  paintTufts(px, pal, horizon + 2, 212, onPath);
  paintLitter(px, pal, horizon + 20, 213, 90);
  paintSnow(px, pal, horizon + 6, 214, 0.4);
  put(px, pal, 'hut', cx - 120, horizon + 22, 0);
  put(px, pal, 'choga', cx + 126, horizon + 28, 2);
  put(px, pal, 'oak', cx - 60, horizon + 24, 0);
  put(px, pal, 'young', cx + 62, horizon + 20, 1);
  put(px, pal, 'rockS', cx - 70, floor, 0);
  paintDrift(px, pal, 215, floor);
}

const PAINTERS: Record<string, (f: Frame) => void> = {
  entrance,
  paddy,
  well: wellPlace,
  temple,
  hill,
  yard,
  stream,
  road,
  threshing,
  pass,
  hyanggyo,
  manor: manorGate,
  room,
  neighbor,
};

/** 배경 한 장을 w × h 점으로 그린다(화면에는 정수배로 키워 쓴다). */
export function paintBackdrop(place: string, season: Season, w: number, h: number): Px {
  const px = new Px(Math.max(8, w), Math.max(8, h));
  const frame: Frame = {
    px,
    pal: paletteOf(season),
    season,
    cx: Math.round(px.w / 2),
    horizon: Math.round(px.h * 0.46),
    floor: Math.round(px.h * 0.76),
  };
  // 'in'은 constructor 같은 물려받은 이름까지 참으로 보므로 쓰지 않는다
  const painter = Object.prototype.hasOwnProperty.call(PAINTERS, place) ? PAINTERS[place] : village;
  painter(frame);
  return px;
}
