// 그림 규칙의 수치(spec 4.7.5의 ㄴ~ㅎ). 셈은 docs/mockup-art/lib.mjs와 같다(시안과 같은 잣대로 잰다).
// 그리고 시안의 자리(대문 앞, docs/mockup-art/region.json)를 게임의 그림 코드로 버퍼에만 그려 맞춰 보는 도구.
// 캔버스를 쓰지 않는다.

import regionJson from '../docs/mockup-art/region.json';
import { neutigol } from '../src/content/maps/neutigol';
import { anchorOf, shadesFor, thingDefs, thingKey } from '../src/pixel/catalog';
import * as critters from '../src/pixel/critters';
import { GROUND_TILE, groundJob, snapperOf, type GroundMap, type Shade } from '../src/pixel/ground';
import { paletteOf, type Palette } from '../src/pixel/palette';
import { PERSON_AX, PERSON_AY, footShadow, personFrame, personOf } from '../src/pixel/people';
import { ART, Px, type Color } from '../src/pixel/px';
import { buildAtlas, footBox, needsOf, type Atlas } from '../src/pixel/atlas';
import { buildScene, render } from '../src/map/draw';
import { createWorld } from '../src/map/world';
import type { Season } from '../src/engine/types';
import type { MapData, Weather } from '../src/map/types';

const R = (c: Color): number => c & 255;
const G = (c: Color): number => (c >> 8) & 255;
const B = (c: Color): number => (c >> 16) & 255;
const A = (c: Color): number => (c >>> 24) & 255;
/** 밝기 Y′(0~1, Rec.709 — 감마를 풀지 않는다) */
export const luma = (c: Color): number => (0.2126 * R(c) + 0.7152 * G(c) + 0.0722 * B(c)) / 255;

/** 대비 큰 외톨이 점(ㄹ): 이웃 여덟 점이 모두 다른 빛이고 가장 가까운 이웃과도 밝기 차가 big 넘는 점. 그림 점 천 개당. */
export function harshOrphans(img: Px, big = 0.12): number {
  const { w, h, d } = img;
  let n = 0;
  let all = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const c = d[y * w + x];
      if (A(c) === 0) continue;
      all++;
      let alone = true;
      let nearest = 1;
      const lc = luma(c);
      for (let j = -1; j <= 1 && alone; j++) {
        for (let i = -1; i <= 1; i++) {
          if (!i && !j) continue;
          const q = d[(y + j) * w + x + i];
          if (q === c) {
            alone = false;
            break;
          }
          nearest = Math.min(nearest, Math.abs(luma(q) - lc));
        }
      }
      if (alone && nearest > big) n++;
    }
  }
  return all === 0 ? 0 : (n * 1000) / all;
}

/** 대비 큰 체크무늬(ㄷ): 2×2가 a b / b a이고 밝기 차가 big 넘는 것. 그림 점 천 개당. */
export function harshChecker(img: Px, big = 0.1): number {
  const { w, h, d } = img;
  let n = 0;
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const a = d[y * w + x];
      const b = d[y * w + x + 1];
      if (a !== b && d[(y + 1) * w + x] === b && d[(y + 1) * w + x + 1] === a && Math.abs(luma(a) - luma(b)) > big) n++;
    }
  }
  return (n * 1000) / (w * h);
}

/** 땅의 한 자리: 그림 점 (x0, y0)부터 w×h. 칸의 갈래를 묻는 code(그림 점 → 'grass' | 'dirt' | null)와 함께. */
export interface GroundView {
  px: Px;
  code: (X: number, Y: number) => 'grass' | 'dirt' | null;
}

/** 큰 결과 평탄 조각(ㅌ — lib.mjs의 monotony). k = 그림 점 / 맵 점. */
export function monotony(v: GroundView, k = ART): Record<'grass' | 'dirt', { lumaStd: number; warmStd: number; tones: number; flatPct: number }> {
  const ground = v.px;
  const out = {} as Record<'grass' | 'dirt', { lumaStd: number; warmStd: number; tones: number; flatPct: number }>;
  for (const kind of ['grass', 'dirt'] as const) {
    const lum: number[] = [];
    const warm: number[] = [];
    const counts = new Map<Color, number>();
    let area = 0;
    let flat = 0;
    let small = 0;
    for (const [size, big] of [
      [8, true],
      [4, false],
    ] as const) {
      const s = size * k;
      for (let y0 = 0; y0 + s <= ground.h; y0 += s) {
        for (let x0 = 0; x0 + s <= ground.w; x0 += s) {
          if (![v.code(x0, y0), v.code(x0 + s - 1, y0), v.code(x0, y0 + s - 1), v.code(x0 + s - 1, y0 + s - 1)].every((c) => c === kind)) continue;
          let L = 0;
          let W = 0;
          const local = new Map<Color, number>();
          for (let y = y0; y < y0 + s; y++) {
            for (let x = x0; x < x0 + s; x++) {
              const c = ground.d[y * ground.w + x];
              L += luma(c);
              W += (R(c) - B(c)) / 255;
              local.set(c, (local.get(c) ?? 0) + 1);
              if (big) counts.set(c, (counts.get(c) ?? 0) + 1);
            }
          }
          const n = s * s;
          if (big) {
            lum.push(L / n);
            warm.push(W / n);
            area += n;
          } else {
            small++;
            if (Math.max(...local.values()) >= 0.9 * n) flat++;
          }
        }
      }
    }
    const sd = (a: number[]): number => {
      const m = a.reduce((p, q) => p + q, 0) / Math.max(1, a.length);
      return Math.sqrt(a.reduce((p, q) => p + (q - m) * (q - m), 0) / Math.max(1, a.length));
    };
    out[kind] = {
      lumaStd: sd(lum) * 100,
      warmStd: sd(warm) * 100,
      tones: [...counts.values()].filter((n) => n >= area * 0.01).length,
      flatPct: small === 0 ? 0 : (flat * 100) / small,
    };
  }
  return out;
}

/** 얼룩덜룩함(ㅎ — lib.mjs의 blotch): 맵 점 8×8 조각과 오른쪽·아래 이웃 조각의 평균 밝기 차 ×100 */
export function blotch(v: GroundView, k = ART): Record<'grass' | 'dirt', number> {
  const ground = v.px;
  const s = 8 * k;
  const bw = Math.floor(ground.w / s);
  const bh = Math.floor(ground.h / s);
  const mean = new Float32Array(bw * bh).fill(-1);
  const kind: ('grass' | 'dirt' | null)[] = new Array(bw * bh).fill(null);
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      const x0 = bx * s;
      const y0 = by * s;
      const c = [v.code(x0, y0), v.code(x0 + s - 1, y0), v.code(x0, y0 + s - 1), v.code(x0 + s - 1, y0 + s - 1)];
      if (!c.every((q) => q === c[0]) || !c[0]) continue;
      let L = 0;
      for (let y = y0; y < y0 + s; y++) for (let x = x0; x < x0 + s; x++) L += luma(ground.d[y * ground.w + x]);
      mean[by * bw + bx] = L / (s * s);
      kind[by * bw + bx] = c[0];
    }
  }
  const out = {} as Record<'grass' | 'dirt', number>;
  for (const want of ['grass', 'dirt'] as const) {
    let sum = 0;
    let n = 0;
    for (let by = 0; by < bh; by++) {
      for (let bx = 0; bx < bw; bx++) {
        const i = by * bw + bx;
        if (kind[i] !== want) continue;
        for (const j of [bx + 1 < bw ? i + 1 : -1, by + 1 < bh ? i + bw : -1]) {
          if (j < 0 || kind[j] !== want) continue;
          sum += Math.abs(mean[i] - mean[j]);
          n++;
        }
      }
    }
    out[want] = n ? (sum * 100) / n : 0;
  }
  return out;
}

/**
 * 따뜻함(ㅍ — lib.mjs의 warmth). 장면 그림을 점마다 잰다(lib.mjs는 세 배로 키운 그림을 세 점마다 재므로 같은 셈이다).
 * greenHue: 풀빛의 평균 색상각, warmth: 화면 전체의 R−B 평균, darkWarmth·darkShare: 어두운 점(HSL 밝기 0.3 아래)의 R−B 평균과 몫(%).
 */
export function warmth(img: Px): { greenHue: number; warmth: number; darkWarmth: number; darkShare: number; lum: number } {
  const { d } = img;
  let n = 0;
  let rb = 0;
  let lumSum = 0;
  let gH = 0;
  let gN = 0;
  let darkRB = 0;
  let darkN = 0;
  for (let i = 0; i < d.length; i++) {
    const v = d[i];
    const r = R(v);
    const g = G(v);
    const b = B(v);
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const l = (mx + mn) / 510;
    const s = mx === mn ? 0 : (mx - mn) / mx;
    n++;
    rb += r - b;
    lumSum += l;
    let hue = 0;
    if (mx !== mn) {
      if (mx === r) hue = ((g - b) / (mx - mn)) % 6;
      else if (mx === g) hue = (b - r) / (mx - mn) + 2;
      else hue = (r - g) / (mx - mn) + 4;
      hue *= 60;
      if (hue < 0) hue += 360;
    }
    if (g > r && g > b && s > 0.2) {
      gH += hue;
      gN++;
    }
    if (l < 0.3) {
      darkRB += r - b;
      darkN++;
    }
  }
  return { greenHue: gH / Math.max(1, gN), warmth: rb / n, darkWarmth: darkRB / Math.max(1, darkN), darkShare: (darkN / n) * 100, lum: lumSum / n };
}

/**
 * 사람이 바닥에서 떨어져 보이는 정도(ㅁ — lib.mjs의 edgeContrast): 사람 그림의 가장 바깥 점마다 바로 밖(위·아래·옆)의 바닥 점과의
 * 밝기 차 평균. ground는 사람을 그리기 전의 바닥, (x0, y0)은 사람 그림이 놓인 왼쪽 위(그림 점).
 * bare(있으면): 움직이는 발밑 그림자를 얹기 전의 바닥 — ㅁ의 "바로 밖 바닥"은 이것으로 잰다(spec 4.7.5, 그림 올리기 ①의 다시 보기 뒤).
 */
export function edgeContrast(sprite: Px, x0: number, y0: number, ground: Px, bare?: Px): number {
  const floor = bare ?? ground;
  const { w, h, d } = sprite;
  const on = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && A(d[y * w + x]) > 0;
  let sum = 0;
  let n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!on(x, y)) continue;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        if (on(x + dx, y + dy)) continue;
        const g = floor.get(x0 + x + dx, y0 + y + dy);
        if (A(g) === 0) continue;
        sum += Math.abs(luma(d[y * w + x]) - luma(g));
        n++;
      }
    }
  }
  return n === 0 ? 0 : sum / n;
}

/**
 * 1배 그림을 키운 맛(ㄱ — 그림 올리기 ②): 짝수 자리의 2×2 칸 가운데, 둘레 4×4 안에서 빛이 바뀌는(빛이 둘 이상인) 칸이 한 빛인 몫.
 * 넓은 한 빛 판(회벽, 구름의 안쪽)은 세지 않고, 꼴과 결이 바뀌는 곳만 본다. 1배 그림을 가까운 점 그대로 ART배로 키운 그림은
 * 경계가 모두 짝수 줄에 놓여 1이 되고, 그림 점으로 그린 그림은 경계가 홀수 줄에도 놓여 그보다 한참 낮다.
 * 네 점이 다 찍힌 칸만 센다. 셀 칸이 least보다 적으면(아주 작은 그림) null.
 */
export function upscaledShare(img: Px, least = 12): number | null {
  const { w, h, d } = img;
  let same = 0;
  let all = 0;
  for (let y = 0; y + 1 < h; y += 2) {
    for (let x = 0; x + 1 < w; x += 2) {
      const a = d[y * w + x];
      if (A(a) === 0 || A(d[y * w + x + 1]) === 0 || A(d[(y + 1) * w + x]) === 0 || A(d[(y + 1) * w + x + 1]) === 0) continue;
      let mixed = false;
      for (let j = -1; j <= 2 && !mixed; j++) {
        for (let i = -1; i <= 2; i++) {
          const X = x + i;
          const Y = y + j;
          if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
          if (d[Y * w + X] !== a) {
            mixed = true;
            break;
          }
        }
      }
      if (!mixed) continue;
      all++;
      if (d[y * w + x + 1] === a && d[(y + 1) * w + x] === a && d[(y + 1) * w + x + 1] === a) same++;
    }
  }
  return all < least ? null : same / all;
}

/** 시험용: 그림을 가까운 점 그대로 반으로 줄였다가 ART배로 키운다(1배 그림을 키워 쓴 것과 같은 꼴) */
export function upscaledCopy(img: Px): Px {
  const out = new Px(img.w - (img.w % ART), img.h - (img.h % ART));
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) out.d[y * out.w + x] = img.d[(y - (y % ART)) * img.w + x - (x % ART)];
  return out;
}

/**
 * 큰비 날 땅의 웅덩이 덩이의 크기(그림 점): 물빛 점(파랑이 빨강보다 크거나 같은 점 — 젖은 흙은 따뜻한 빛이다)을 위아래·옆으로 이은
 * 덩이 가운데 작은 티(least 점 아래)를 뺀 것들의 평균 넓이와 수. 웅덩이의 꼴은 1-라처럼 맵 점으로 셈한다(①의 Review 권고 8).
 */
export function puddleBlobs(img: Px, least = 6): { mean: number; count: number } {
  const { w, h, d } = img;
  const wet = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (A(d[i]) > 0 && B(d[i]) >= R(d[i])) wet[i] = 1;
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  let sum = 0;
  let count = 0;
  for (let i = 0; i < w * h; i++) {
    if (!wet[i] || seen[i]) continue;
    let n = 0;
    stack.push(i);
    seen[i] = 1;
    while (stack.length) {
      const k = stack.pop()!;
      n++;
      const x = k % w;
      const y = (k - x) / w;
      for (const q of [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, y > 0 ? k - w : -1, y < h - 1 ? k + w : -1]) {
        if (q >= 0 && wet[q] && !seen[q]) {
          seen[q] = 1;
          stack.push(q);
        }
      }
    }
    if (n >= least) {
      sum += n;
      count++;
    }
  }
  return { mean: count ? sum / count : 0, count };
}

// ── 시안의 자리(대문 앞)를 게임의 그림 코드로 버퍼에 그린다 ─────────────────

interface Region {
  cam: { x: number; y: number };
  view: { w: number; h: number };
  tiles: { x0: number; y0: number; codes: string };
  terrain: string[];
  /** 시안이 그린 세운 것(맵 자료의 그 자리에 있는 것 — 화면 위 끝에 조금 걸린 사랑채는 시안이 뺐다) */
  things: { kind: string; variant: number; tx: number; ty: number }[];
  people: { id: string; sprite: string; x: number; y: number; dir: 'down'; act: 'idle' | 'work'; frame: number }[];
  critters: { id: string; sprite: string; x: number; y: number; flip: boolean }[];
}

export const REGION = regionJson as unknown as Region;

/** 맵의 한 네모(맵 점)를 칠한 땅(그림 점, 한 벌에 맞춘 것)과 칸의 갈래 */
export function groundView(map: MapData, pal: Palette, mx: number, my: number, mw: number, mh: number, shades: readonly Shade[]): GroundView {
  const job = groundJob(map as GroundMap, pal, shades);
  const px = job.paint(mx * ART, my * ART, mw * ART, mh * ART);
  const code = (X: number, Y: number): 'grass' | 'dirt' | null => {
    const tx = Math.floor((X / ART + mx) / 16);
    const ty = Math.floor((Y / ART + my) / 16);
    const t = map.terrain[ty * map.w + tx];
    // g·m 칸(풀밭·들꽃 풀밭)과 p·y 칸(흙길·마당) — region.json의 갈래와 같다
    return t === 0 || t === 1 ? 'grass' : t === 4 || t === 5 ? 'dirt' : null;
  };
  return { px, code };
}

/** 곱하기로 얹는 발밑 그림자를 버퍼에 얹는다(게임의 drawFoot와 같은 셈) */
function multiplyFoot(ground: Px, foot: Px, x0: number, y0: number, w = foot.w, h = foot.h): void {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const f = foot.get(Math.floor((x * foot.w) / w), Math.floor((y * foot.h) / h));
      if (A(f) === 0) continue;
      const X = x0 + x;
      const Y = y0 + y;
      if (!ground.inb(X, Y)) continue;
      const g = ground.get(X, Y);
      ground.set(X, Y, ((255 << 24) | (Math.round((B(g) * B(f)) / 255) << 16) | (Math.round((G(g) * G(f)) / 255) << 8) | Math.round((R(g) * R(f)) / 255)) >>> 0);
    }
  }
}

export interface GateScene {
  /** 장면 전체(그림 점) */
  scene: Px;
  /** 사람을 세우기 전의 바닥(발밑 그림자 포함) */
  floor: Px;
  /** 발밑 그림자를 얹기 전의 바닥(ㅁ을 잰다) */
  bare: Px;
  /** 사람·짐승의 발밑 그림자를 얹은 네모(그림 점 — 그림자 짙기를 잰다) */
  feet: { id: string; x: number; y: number; w: number; h: number; ax: number; ay: number }[];
  /** 땅만 */
  ground: GroundView;
  people: { id: string; sprite: Px; x: number; y: number }[];
}

/** 시안의 자리(대문 앞, 봄)를 게임의 그림으로: 땅 + 세운 것(그림 점) + 사람 셋 + 닭과 까치 */
export function gateScene(season: Season = 'spring', weather: Weather = 'clear'): GateScene {
  const map = neutigol(season, weather);
  const pal = paletteOf(season, weather);
  const snap = snapperOf(pal);
  const defs = thingDefs(pal);
  const shades = shadesFor((k) => defs.get(k)?.shades, map.objects);
  const { cam, view } = REGION;
  const ground = groundView(map, pal, cam.x, cam.y, view.w, view.h, shades);
  const bare = ground.px.clone();
  const floor = ground.px.clone();
  const foot = footShadow(pal);
  const feet: GateScene['feet'] = [];
  type Sprite = { px: Px; x: number; y: number; sortY: number; person?: string };
  const sprites: Sprite[] = [];
  // 시안과 같은 것만 놓는다(봄의 맵 자료로 고른 자리 — 다른 계절에는 그 자리의 그 갈래가 있으면 놓는다)
  const listed = new Set(REGION.things.map((t) => `${t.kind}@${t.tx},${t.ty}`));
  for (const o of map.objects) {
    if (!listed.has(`${o.kind}@${o.tx},${o.ty}`)) continue;
    const def = defs.get(thingKey(o.kind, o.gate ? 0 : o.variant));
    if (!def) continue;
    const at = anchorOf(o.kind, o.tx, o.ty, o.dx, o.dy);
    const f = snap.apply(def.frames[0].clone());
    const x = Math.round((at.x - cam.x) * ART - def.ax);
    const y = Math.round((at.y - cam.y) * ART - def.ay);
    if (x > floor.w || y > floor.h || x + f.w < 0 || y + f.h < 0) continue;
    sprites.push({ px: f, x, y, sortY: at.y + (def.sort ?? 0) });
  }
  const people: GateScene['people'] = [];
  for (const p of REGION.people) {
    const person = personOf(p.sprite);
    if (!person) continue;
    const f = snap.apply(personFrame(person, 'down', p.act, p.frame));
    const ax = Math.round((p.x - cam.x) * ART);
    const ay = Math.round((p.y - cam.y) * ART);
    const b = footBox(foot);
    multiplyFoot(floor, foot, ax + b.x, ay + b.y, b.w, b.h);
    feet.push({ id: p.id, x: ax + b.x, y: ay + b.y, w: b.w, h: b.h, ax, ay });
    sprites.push({ px: f, x: ax - PERSON_AX, y: ay - PERSON_AY, sortY: p.y, person: p.id });
    people.push({ id: p.id, sprite: f, x: ax - PERSON_AX, y: ay - PERSON_AY });
  }
  for (const c of REGION.critters ?? []) {
    const make = (critters as unknown as Record<string, () => critters.Critter>)[c.sprite];
    if (!make) continue;
    const cr = make();
    const f0 = snap.apply(cr.frames[0].clone());
    const f = c.flip ? f0.flipX() : f0;
    // 뒤집은 그림의 발치는 그리기(draw.ts)와 같은 셈(발치 점 둘을 한 덩이로)
    const ax = c.flip ? cr.frames[0].w - ART - cr.ax : cr.ax;
    const X = Math.round((c.x - cam.x) * ART);
    const Y = Math.round((c.y - cam.y) * ART);
    const b = footBox(foot, f.w);
    multiplyFoot(floor, foot, X + b.x, Y + b.y, b.w, b.h);
    feet.push({ id: c.id, x: X + b.x, y: Y + b.y, w: b.w, h: b.h, ax: X, ay: Y });
    sprites.push({ px: f, x: X - ax, y: Y - cr.ay, sortY: c.y });
  }
  const scene = floor.clone();
  sprites.sort((a, b) => a.sortY - b.sortY);
  for (const s of sprites) scene.blit(s.px, s.x, s.y);
  // 곱한 그림자의 빛은 한 벌 밖일 수 있다(게임도 곱해 그린다) — 장면의 나머지는 한 벌 안이다
  return { scene, floor, bare, feet, ground, people };
}

// ── 게임의 그리기(map/draw.ts의 render)를 버퍼에 받는 캔버스 흉내 ─────────────────
// 시험이 "실제 화면"과 같은 값을 내도록, 게임이 쓰는 drawImage·fillRect·putImageData·곱하기·비침만 흉내 낸다(가까운 점 그대로 늘인다).

interface SoftCanvas {
  width: number;
  height: number;
  px: Px | null;
  getContext(): SoftCtx;
}

/** 흉내 낸 캔버스의 점(시험이 그림 벌의 캔버스를 견줄 때) */
export const softPixels = (c: unknown): Px => buf(c as SoftCanvas);

function buf(c: SoftCanvas): Px {
  if (!c.px || c.px.w !== c.width || c.px.h !== c.height) c.px = new Px(c.width, c.height);
  return c.px;
}

const parseFill = (style: string): [number, number, number, number] => {
  if (style.startsWith('#')) {
    const v = parseInt(style.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 1];
  }
  const m = /rgba?\(([^)]+)\)/.exec(style);
  if (!m) return [0, 0, 0, 0];
  const [r, g, b, a = '1'] = m[1].split(',').map((t) => t.trim());
  return [Number(r), Number(g), Number(b), Number(a)];
};

class SoftCtx {
  globalAlpha = 1;
  globalCompositeOperation = 'source-over';
  imageSmoothingEnabled = false;
  fillStyle: string | object = '#000';
  constructor(private readonly canvas: SoftCanvas) {}
  setTransform(): void {}
  createLinearGradient(): { addColorStop(): void } {
    return { addColorStop: () => undefined };
  }
  putImageData(img: { data: Uint8ClampedArray; width: number; height: number }, x: number, y: number): void {
    const out = buf(this.canvas);
    const src = new Uint32Array(img.data.buffer, img.data.byteOffset, img.width * img.height);
    for (let j = 0; j < img.height; j++) for (let i = 0; i < img.width; i++) out.set(x + i, y + j, src[j * img.width + i]);
  }
  private put(X: number, Y: number, r: number, g: number, b: number, a: number): void {
    const out = buf(this.canvas);
    if (!out.inb(X, Y) || a <= 0) return;
    const d = out.get(X, Y);
    const dr = R(d);
    const dg = G(d);
    const db = B(d);
    const da = A(d) / 255;
    let nr = r;
    let ng = g;
    let nb = b;
    if (this.globalCompositeOperation === 'multiply' && da > 0) {
      nr = (r * dr) / 255;
      ng = (g * dg) / 255;
      nb = (b * db) / 255;
    }
    const oa = a + da * (1 - a);
    const mixc = (s: number, q: number): number => Math.round((s * a + q * da * (1 - a)) / Math.max(1e-6, oa));
    out.set(X, Y, ((Math.round(oa * 255) << 24) | (mixc(nb, db) << 16) | (mixc(ng, dg) << 8) | mixc(nr, dr)) >>> 0);
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    if (typeof this.fillStyle !== 'string') return; // 하루의 빛(그러데이션)은 쓰지 않는다
    const [r, g, b, a] = parseFill(this.fillStyle);
    for (let Y = Math.max(0, Math.round(y)); Y < Math.round(y + h); Y++) for (let X = Math.max(0, Math.round(x)); X < Math.round(x + w); X++) this.put(X, Y, r, g, b, a * this.globalAlpha);
  }
  drawImage(src: SoftCanvas, ...n: number[]): void {
    const s = src.px;
    if (!s) return;
    let [sx, sy, sw, sh, dx, dy, dw, dh] = n.length >= 8 ? n : n.length === 4 ? [0, 0, s.w, s.h, n[0], n[1], n[2], n[3]] : [0, 0, s.w, s.h, n[0], n[1], s.w, s.h];
    dx = Math.round(dx);
    dy = Math.round(dy);
    dw = Math.round(dw);
    dh = Math.round(dh);
    const out = buf(this.canvas);
    for (let Y = Math.max(0, dy); Y < Math.min(out.h, dy + dh); Y++) {
      const v = sy + Math.floor(((Y - dy + 0.5) * sh) / dh);
      for (let X = Math.max(0, dx); X < Math.min(out.w, dx + dw); X++) {
        const c = s.get(sx + Math.floor(((X - dx + 0.5) * sw) / dw), v);
        if (A(c) === 0) continue;
        this.put(X, Y, R(c), G(c), B(c), (A(c) / 255) * this.globalAlpha);
      }
    }
  }
}

/** 캔버스와 ImageData를 흉내 낸 채로 run을 돌린다(시험 밖의 전역을 남기지 않는다) */
export function withSoftCanvas<T>(run: () => T): T {
  const g = globalThis as unknown as Record<string, unknown>;
  const before = { document: g.document, ImageData: g.ImageData };
  g.ImageData = class {
    constructor(
      readonly data: Uint8ClampedArray,
      readonly width: number,
      readonly height: number,
    ) {}
  };
  g.document = {
    createElement: (): SoftCanvas => {
      const c: SoftCanvas = { width: 0, height: 0, px: null, getContext: () => ctx };
      const ctx = new SoftCtx(c);
      return c;
    },
  };
  try {
    return run();
  } finally {
    g.document = before.document;
    g.ImageData = before.ImageData;
  }
}

/**
 * 시안의 자리(대문 앞)를 **게임의 그리기 그대로**(map/draw.ts의 render — 땅·물결·세운 것·사람·짐승·발밑 그림자·계절의 빛) 그린 화면.
 * 배율은 맵 점 하나 = 화소 둘(그림 점 하나 = 화소 하나)이다. 구름 그림자·날림·표시·하루의 빛은 그때그때 달라 넣지 않는다.
 */
export function gameGateScene(season: Season = 'spring', weather: Weather = 'clear'): Px {
  const hero = REGION.people.find((p) => p.id === 'hero');
  return gameView(season, weather, REGION.cam, REGION.view, hero ? { x: hero.x, y: hero.y } : undefined);
}

/**
 * 맵의 한 자리(맵 점의 네모)를 게임의 그리기 그대로 그린 화면(gameGateScene과 같은 셈). time만큼 흐른 뒤의 장(흔들림·물결)을 그린다.
 * atlasOf를 주면 그 그림 벌로 그린다(미리 짓기가 처음 화면만 지은 벌 — 그리기가 그 자리에서 지은 수를 late로 돌려준다).
 */
export function gameView(
  season: Season,
  weather: Weather,
  cam: { x: number; y: number },
  view: { w: number; h: number },
  hero?: { x: number; y: number },
  time = 0,
  atlasOf?: (map: MapData) => Atlas,
  late?: { n: number; people?: number; critters?: number },
): Px {
  return withSoftCanvas(() => {
    const map = neutigol(season, weather);
    const atlas = atlasOf ? atlasOf(map) : buildAtlas(season, weather, needsOf(map, ['farmer-boy']));
    const at = hero ?? { x: cam.x + view.w / 2, y: cam.y + view.h / 2 };
    const world = createWorld(map, { role: 'farmer', look: 'boy' }, 'farmer-boy', [Math.floor(at.x / 16), Math.floor(at.y / 16)]);
    world.player.x = at.x;
    world.player.y = at.y;
    world.view = { w: view.w, h: view.h };
    world.cam = { x: cam.x, y: cam.y };
    world.glow = { morning: 0, dusk: 0 };
    world.time = time;
    const scene = buildScene(map, atlas, world);
    scene.clouds = [];
    const canvas = document.createElement('canvas') as unknown as SoftCanvas;
    canvas.width = view.w * ART;
    canvas.height = view.h * ART;
    const before = [atlas.people.size, atlas.critters.size];
    render({ ctx: canvas.getContext() as unknown as CanvasRenderingContext2D, w: canvas.width, h: canvas.height, scale: ART }, world, scene);
    if (late) {
      late.n = scene.late;
      late.people = atlas.people.size - before[0];
      late.critters = atlas.critters.size - before[1];
    }
    return buf(canvas);
  });
}

/** 땅의 네모를 칠할 계절의 맵과 그림자 */
export function seasonGround(season: Season, weather: Weather, mx: number, my: number, mw: number, mh: number): GroundView {
  const map = neutigol(season, weather);
  const pal = paletteOf(season, weather);
  const defs = thingDefs(pal);
  return groundView(map, pal, mx, my, mw, mh, shadesFor((k) => defs.get(k)?.shades, map.objects));
}

export { GROUND_TILE };
