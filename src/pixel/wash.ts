// 그림 점(ART)으로 다시 그린 세운 것·짐승의 마무리(그림 올리기 ② — spec 4.7.5의 ㄴ·ㄷ·ㄹ·ㅅ·ㅌ·ㅎ).
// 셈은 사용자가 승인한 3.1차 시안(docs/mockup-art/make-v31.mjs)의 watercolor·selfRim·calmSprite·outline과 같다.
//
//   ㄴ 먹빛 테두리를 쓰지 않는다: 땅·집·담·나무·소품은 그림 안쪽 가장자리를 제 빛깔로 가른다(selfRim).
//      짐승은 사람과 같은 (나) 제 빛깔을 짙게 한 부드러운 테두리(softOutline).
//   ㅌ 수채화 같은 결: 큰 결과 고운 결의 무늬로 단계를 한 칸씩 오르내린다(이웃 단계로만 — watercolor).
//   ㅎ 때를 쓰지 않는다: 어둡게 옮기는 문턱을 밝게 옮기는 문턱보다 높게 두어 어둡게 된 점이 적다(watercolor가 그 몫을 돌려준다).
//   ㄹ 대비 큰 외톨이 점은 이웃의 빛으로 고른다(calmSprite). 고운 결은 남긴다.

import { CLOTH, HAIR, SKIN, type Palette, type Ramp } from './palette';
import { Px, clamp, hex, mix, vnoise, type Color } from './px';

/** 그늘을 짙게 할 때 섞는 따뜻한 밤빛(푸름으로 옮기지 않는다 — ㅇ) */
export const WARM_DARK = hex('#4a3020');
/** 볕을 밝게 할 때 섞는 금빛 */
export const WARM_LIGHT = hex('#fff0c4');

/** 빛깔 → [그 빛깔이 든 단계, 단계 안의 자리] */
export type RampIndex = Map<Color, readonly [Ramp, number]>;

const luma = (c: Color): number => (0.2126 * (c & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * ((c >> 16) & 255)) / 255;

const cache = new WeakMap<Palette, RampIndex>();

/**
 * 그 계절 벌의 재질 단계로 찾는 표. 같은 빛깔이 여러 단계에 있으면 앞의 것(집·돌·나무의 재질이 먼저)을 쓴다.
 * extra는 그 그림만 쓰는 단계(질그릇 독 등) — 표 끝에 더한다.
 */
export function rampsOf(pal: Palette, extra: readonly Ramp[] = []): RampIndex {
  let base = cache.get(pal);
  if (!base) {
    base = new Map();
    const list: Ramp[] = [
      pal.tile,
      pal.plaster,
      pal.stone,
      pal.wood,
      pal.thatchOld,
      pal.thatch,
      pal.clay,
      pal.bark,
      pal.pineBark,
      pal.snow,
      pal.path,
      pal.yard,
      pal.soil,
      pal.mud,
      pal.water,
      pal.paddy,
      pal.crop,
      pal.grass,
      pal.grassTip,
      pal.forest,
      pal.leaf,
      pal.leafWarm,
      pal.leafDeep,
      pal.pine,
      pal.blossom,
      pal.blossomWhite,
      pal.azalea,
      pal.yellow,
      ...Object.values(CLOTH),
      ...Object.values(HAIR),
      ...Object.values(SKIN),
    ];
    for (const ramp of list) ramp.forEach((c, i) => void (base!.has(c) || base!.set(c, [ramp, i])));
    cache.set(pal, base);
  }
  if (extra.length === 0) return base;
  const out: RampIndex = new Map(base);
  for (const ramp of extra) ramp.forEach((c, i) => void (out.has(c) || out.set(c, [ramp, i])));
  return out;
}

export interface WashOpts {
  /** 큰 결의 크기(그림 점) — 가로·세로 */
  big?: number;
  bigY?: number;
  /** 큰 결의 세기 */
  amp?: number;
  /** 고운 결의 세기 */
  fine?: number;
  /** 결 방향으로 길게 늘인 결(짚, 나뭇결): [가로 크기, 세로 크기, 세기] */
  streak?: readonly [number, number, number];
  /** 밝게 옮기는 문턱(기본 0.32)과 어둡게 옮기는 문턱(기본 0.42 — 높을수록 때가 적다) */
  up?: number;
  down?: number;
  /** 이 점만 결을 입힌다(없으면 모두) */
  keep?: (x: number, y: number) => boolean;
}

/**
 * 수채화 같은 결(ㅌ): 점마다 큰 결과 고운 결의 무늬로 단계를 한 칸 오르내린다(이웃 단계로만 — ㄹ). streak가 있으면 그 방향으로
 * 길게 늘인 결을 더한다. 3.1차 시안의 셈 그대로(큰 결 ×0.6, 고운 결 ×0.55, 짚 결 ×0.5).
 * 돌려주는 값: 결이 한 칸 어둡게 만든 점의 몫(%, 찍힌 점 가운데) — ㅎ의 "어둡게 된 점"이다.
 */
export function watercolor(px: Px, ramps: RampIndex, seed: number, o: WashOpts = {}): number {
  const { w, h, d } = px;
  const up = o.up ?? 0.32;
  const down = -(o.down ?? 0.42);
  let on = 0;
  let darker = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = d[y * w + x];
      if (c >>> 24 !== 255) continue;
      on++;
      if (o.keep && !o.keep(x, y)) continue;
      const info = ramps.get(c);
      if (!info) continue;
      const [ramp, i] = info;
      let n = (vnoise(x / (o.big ?? 8), y / (o.bigY ?? 6.5), seed) - 0.5) * (o.amp ?? 1.7) * 0.6 + (vnoise(x / 2.7, y / 2.3, seed + 1) - 0.5) * (o.fine ?? 0.8) * 0.55;
      if (o.streak) n += (vnoise(x / o.streak[0], y / o.streak[1], seed + 2) - 0.5) * o.streak[2] * 0.5;
      const step = n > up ? 1 : n < down ? -1 : 0;
      if (step === 0) continue;
      const j = clamp(i + step, 0, ramp.length - 1);
      if (j < i) darker++;
      d[y * w + x] = ramp[j];
    }
  }
  return on ? (darker * 100) / on : 0;
}

/**
 * 제 빛깔 그늘(ㄴ): 그림의 아래·오른쪽 가장자리 한 점은 제 단계에서 한 칸 어둡게, 위·왼쪽 가장자리 한 점은 한 칸 밝게.
 * 그림 안쪽에서 가른다 — 선을 두르지 않는다. 단계에 없는 빛은 따뜻한 밤빛·금빛을 조금 섞는다.
 */
export function selfRim(px: Px, ramps: RampIndex): void {
  const src = px.d.slice();
  const { w, h } = px;
  const on = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] >>> 24 > 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!on(x, y)) continue;
      const c = src[y * w + x];
      const info = ramps.get(c);
      if (!on(x, y + 1) || !on(x + 1, y)) px.d[y * w + x] = info ? info[0][Math.max(0, info[1] - 1)] : mix(c, WARM_DARK, 0.3);
      else if (!on(x, y - 1) || !on(x - 1, y)) px.d[y * w + x] = info ? info[0][Math.min(info[0].length - 1, info[1] + 1)] : mix(c, WARM_LIGHT, 0.2);
    }
  }
}

/** 낱그림 안의 대비 큰 외톨이 점(ㄹ)을 이웃에서 가장 많은 빛으로 고른다(빈 점은 이웃으로 치지 않는다) */
export function calmSprite(px: Px, big = 0.14): void {
  const { w, h } = px;
  const src = px.d.slice();
  const L = new Float32Array(w * h);
  for (let i = 0; i < L.length; i++) L[i] = luma(src[i]);
  const near: number[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const o = y * w + x;
      const c = src[o];
      if (c >>> 24 === 0) continue;
      let alone = true;
      let nearest = 1;
      let opaque = 0;
      const lc = L[o];
      near.length = 0;
      for (let j = -1; j <= 1 && alone; j++) {
        for (let i = -1; i <= 1; i++) {
          if (!i && !j) continue;
          const q = src[o + j * w + i];
          if (q >>> 24 === 0) continue;
          if (q === c) {
            alone = false;
            break;
          }
          opaque++;
          near.push(q);
          nearest = Math.min(nearest, Math.abs(L[o + j * w + i] - lc));
        }
      }
      if (!alone || opaque < 3 || nearest <= big) continue;
      // 이웃에서 가장 많은 빛(같으면 먼저 본 것)
      let best = near[0];
      let bestN = 0;
      for (let a = 0; a < near.length; a++) {
        let n = 0;
        for (let b = 0; b < near.length; b++) if (near[b] === near[a]) n++;
        if (n > bestN) {
          best = near[a];
          bestN = n;
        }
      }
      px.d[o] = best;
    }
  }
}

/**
 * 세운 것 한 장의 마무리: 수채화 같은 결(wash가 있으면) → 제 빛깔 그늘 → 외톨이 점 고르기.
 * 돌려주는 값은 결이 어둡게 만든 점의 몫(%) — ㅎ.
 */
export function finish(px: Px, ramps: RampIndex, seed: number, wash: WashOpts | null): number {
  const dark = wash ? watercolor(px, ramps, seed, wash) : 0;
  selfRim(px, ramps);
  calmSprite(px);
  return dark;
}

/**
 * (나) 제 빛깔을 짙게 한 부드러운 테두리(사람과 같다 — 13.1의 57번): 바깥 한 점을 곁의 빛깔이 든 단계의 가장 어두운 빛에
 * 따뜻한 밤빛을 섞은 빛으로 두른다. 위(그림의 아랫줄 밑)에 닿은 점이 먼저, 다음 옆, 아래. 귀퉁이(대각선)는 두르지 않는다.
 */
export function softOutline(px: Px, ramps: RampIndex, k = 0.68): void {
  const src = px.d.slice();
  const { w, h } = px;
  const at = (x: number, y: number): Color => (x >= 0 && y >= 0 && x < w && y < h ? src[y * w + x] : 0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (src[y * w + x] !== 0) continue;
      const near = [at(x, y - 1), at(x - 1, y), at(x + 1, y), at(x, y + 1)].find((c) => c >>> 24 === 255);
      if (near === undefined) continue;
      const info = ramps.get(near);
      const dark = info ? info[0][0] : mix(near, WARM_DARK, 0.35);
      px.d[y * w + x] = mix(dark, WARM_DARK, k);
    }
  }
}

export interface BallOpts {
  /** 쓰는 단계의 아래·위 끝(기본 1 ~ 끝) */
  lo?: number;
  hi?: number;
  /** 오른쪽 아래 가장자리의 그늘 골 단계(기본 0) */
  rim?: number;
  bias?: number;
  keep?: (x: number, y: number) => boolean;
}

/**
 * 둥근 덩어리(돌, 단지, 짐승의 몸)를 빛 하나(왼쪽 위)로 칠한다: 단계는 띠로 나뉘고 섞음 무늬가 없다(ㄷ).
 * 오른쪽 아래 가장자리 한 점 남짓은 rim 단계로 그늘 골을 둔다. 3.1차 시안의 ball과 같다.
 */
export function ball(px: Px, cx: number, cy: number, rx: number, ry: number, ramp: Ramp, o: BallOpts = {}): void {
  const lo = o.lo ?? 1;
  const hi = o.hi ?? ramp.length - 1;
  const rim = o.rim ?? 0;
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const d2 = dx * dx + dy * dy;
      if (d2 > 1) continue;
      if (o.keep && !o.keep(x, y)) continue;
      const nz = Math.sqrt(1 - d2);
      const light = -0.5 * dx - 0.62 * dy + 0.6 * nz;
      const t = clamp(0.42 + 0.62 * light + (o.bias ?? 0), 0, 0.999);
      let i = lo + Math.floor(t * (hi - lo + 1));
      if (d2 > Math.pow(1 - 1.25 / Math.min(rx, ry), 2) && dx + dy > 0.25) i = rim;
      px.set(x, y, ramp[clamp(i, 0, ramp.length - 1)]);
    }
  }
}
