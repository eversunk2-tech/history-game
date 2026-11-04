// 그림 규칙의 수치(spec 4.7.5의 ㄴ~ㅎ). 셈은 docs/mockup-art/lib.mjs와 같다(시안과 같은 잣대로 잰다).
// 그리고 시안의 자리(대문 앞, docs/mockup-art/region.json)를 게임의 그림 코드로 버퍼에만 그려 맞춰 보는 도구.
// 캔버스를 쓰지 않는다.

import regionJson from '../docs/mockup-art/region.json';
import { neutigol } from '../src/content/maps/neutigol';
import { anchorOf, shadesFor, thingDefs, thingKey } from '../src/pixel/catalog';
import * as critters from '../src/pixel/critters';
import { GROUND_TILE, groundJob, snapperOf, type GroundMap, type Shade } from '../src/pixel/ground';
import { paletteOf, type Palette } from '../src/pixel/palette';
import { FOOT_SHIFT, PERSON_AX, PERSON_AY, footShadow, personFrame, personOf } from '../src/pixel/people';
import { ART, Px, upscale, type Color } from '../src/pixel/px';
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
 * 밝기 차 평균. ground는 사람을 그리기 전의 바닥(발밑 그림자 포함), (x0, y0)은 사람 그림이 놓인 왼쪽 위(그림 점).
 */
export function edgeContrast(sprite: Px, x0: number, y0: number, ground: Px): number {
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
        const g = ground.get(x0 + x + dx, y0 + y + dy);
        if (A(g) === 0) continue;
        sum += Math.abs(luma(d[y * w + x]) - luma(g));
        n++;
      }
    }
  }
  return n === 0 ? 0 : sum / n;
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
  /** 땅만 */
  ground: GroundView;
  people: { id: string; sprite: Px; x: number; y: number }[];
}

/** 시안의 자리(대문 앞, 봄)를 게임의 그림으로: 땅 + 세운 것(1배 그림을 ART배로) + 사람 셋 + 닭과 까치 */
export function gateScene(season: Season = 'spring', weather: Weather = 'clear'): GateScene {
  const map = neutigol(season, weather);
  const pal = paletteOf(season, weather);
  const snap = snapperOf(pal);
  const defs = thingDefs(pal);
  const shades = shadesFor((k) => defs.get(k)?.shades, map.objects);
  const { cam, view } = REGION;
  const ground = groundView(map, pal, cam.x, cam.y, view.w, view.h, shades);
  const floor = ground.px.clone();
  const foot = footShadow(pal);
  type Sprite = { px: Px; x: number; y: number; sortY: number; person?: string };
  const sprites: Sprite[] = [];
  // 시안과 같은 것만 놓는다(봄의 맵 자료로 고른 자리 — 다른 계절에는 그 자리의 그 갈래가 있으면 놓는다)
  const listed = new Set(REGION.things.map((t) => `${t.kind}@${t.tx},${t.ty}`));
  for (const o of map.objects) {
    if (!listed.has(`${o.kind}@${o.tx},${o.ty}`)) continue;
    const def = defs.get(thingKey(o.kind, o.gate ? 0 : o.variant));
    if (!def) continue;
    const at = anchorOf(o.kind, o.tx, o.ty, o.dx, o.dy);
    const f = upscale(snap.apply(def.frames[0].clone()), ART);
    const x = Math.round((at.x - cam.x) * ART - def.ax * ART);
    const y = Math.round((at.y - cam.y) * ART - def.ay * ART);
    if (x > floor.w || y > floor.h || x + f.w < 0 || y + f.h < 0) continue;
    sprites.push({ px: f, x, y, sortY: at.y + (def.sort ?? 0) });
  }
  const people: GateScene['people'] = [];
  for (const p of REGION.people) {
    const person = personOf(p.sprite);
    if (!person) continue;
    const f = snap.apply(personFrame(person, 'down', p.act, p.frame));
    const x = Math.round((p.x - cam.x) * ART) - PERSON_AX;
    const y = Math.round((p.y - cam.y) * ART) - PERSON_AY;
    multiplyFoot(floor, foot, Math.round((p.x - cam.x) * ART) + FOOT_SHIFT.x - (foot.w >> 1), Math.round((p.y - cam.y) * ART) + FOOT_SHIFT.y - (foot.h >> 1));
    sprites.push({ px: f, x, y, sortY: p.y, person: p.id });
    people.push({ id: p.id, sprite: f, x, y });
  }
  for (const c of REGION.critters ?? []) {
    const make = (critters as unknown as Record<string, () => critters.Critter>)[c.sprite];
    if (!make) continue;
    const cr = make();
    const f0 = upscale(snap.apply(cr.frames[0].clone()), cr.art ? 1 : ART);
    const f = c.flip ? f0.flipX() : f0;
    const ax = (c.flip ? cr.frames[0].w - 1 - cr.ax : cr.ax) * (cr.art ? 1 : ART);
    const ay = cr.ay * (cr.art ? 1 : ART);
    const X = Math.round((c.x - cam.x) * ART);
    const Y = Math.round((c.y - cam.y) * ART);
    const fw = Math.min(foot.w, Math.round(f.w * 0.8));
    multiplyFoot(floor, foot, X + ART - Math.round(fw / 2), Y - 2 * ART, fw, 4 * ART);
    sprites.push({ px: f, x: X - ax, y: Y - ay, sortY: c.y });
  }
  const scene = floor.clone();
  sprites.sort((a, b) => a.sortY - b.sortY);
  for (const s of sprites) scene.blit(s.px, s.x, s.y);
  // 곱한 그림자의 빛은 한 벌 밖일 수 있다(게임도 곱해 그린다) — 장면의 나머지는 한 벌 안이다
  return { scene, floor, ground, people };
}

/** 땅의 네모를 칠할 계절의 맵과 그림자 */
export function seasonGround(season: Season, weather: Weather, mx: number, my: number, mw: number, mh: number): GroundView {
  const map = neutigol(season, weather);
  const pal = paletteOf(season, weather);
  const defs = thingDefs(pal);
  return groundView(map, pal, mx, my, mw, mh, shadesFor((k) => defs.get(k)?.shades, map.objects));
}

export { GROUND_TILE };
