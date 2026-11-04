// 버퍼에 찍은 그림들을 캔버스로 옮겨 한 벌로 묶는다(브라우저에서만). 계절마다 한 벌.
//
// 모든 낱그림의 크기·발치·가림 마스크는 그림 점(ART — 맵 점의 반) 단위다(spec 4.7.5의 ㄱ).
// 그림 올리기 ①에서 다시 그린 것은 사람과 땅이다. 집·나무·소품·짐승·날림·표시는 ② 전까지
// 지금(1-라)의 1배 그림을 가까운 점 그대로 ART배로 키워 쓴다(ㄱ의 예외 — 그동안 그 그림만 점이 굵다).
//
// 무게(ㅋ): 지은 그림은 그 맵에 놓인 갈래와 그 맵에 나오는 사람·짐승뿐이다(나머지는 처음 부를 때 짓는다).
// 땅은 화면 둘레부터 조각으로 나눠 칠하고 나머지는 쉬는 틈에 칠한다(GroundCanvas).

import type { Season } from '../engine/types';
import { shadesFor, thingDef, thingKey } from './catalog';
import * as critters from './critters';
import { GROUND_TILE, groundJob, snapperOf, waterFrames, type Ground, type GroundJob, type GroundMap, type Shade } from './ground';
import { paletteOf, type Palette } from './palette';
import { FOOT_SHIFT, GUISES, HEROES, PERSON_H, PERSON_W, SHEET_COLS, VILLAGERS, footShadow, personOf, personSheet, personSheetRow } from './people';
import { ART, Px, strip, toCanvas, upscale } from './px';
import type { Snapper } from './quant';
import type { SpriteDef } from './shapes';
import { THINGS } from '../map/things';
import type { MapData, Placed, Weather } from '../map/types';

export interface Img {
  canvas: HTMLCanvasElement;
  /** 좌우를 뒤집은 것(짐승만 — 오른쪽을 볼 때) */
  flipped: HTMLCanvasElement | null;
  /** 한 장의 크기(그림 점) */
  w: number;
  h: number;
  n: number;
  /** 발치(그림 점) */
  ax: number;
  ay: number;
  seq: number[];
  /** 장을 넘기는 빠르기(초당 장 수) */
  rate: number;
  /** 앞뒤 가림의 기준 줄을 발치에서 옮긴다(맵 점) */
  sort: number;
  /** 바닥 그림자(맵 점) */
  shades: NonNullable<SpriteDef['shades']>;
  /** 굴뚝 끝(그림 점) */
  smoke?: { x: number; y: number };
  /** 그림이 찍힌 자리(MASK_CELL 그림 점짜리 칸마다 0/1). 주인공이 실제로 가려지는지 볼 때 쓴다. */
  mask: Uint8Array;
  mw: number;
  mh: number;
}

/** 가림 마스크의 칸 하나(그림 점). 맵 점 넷 — 1-라의 마스크와 같은 넓이를 본다. */
export const MASK_CELL = 4 * ART;

function maskOf(px: Px): { mask: Uint8Array; mw: number; mh: number } {
  const C = MASK_CELL;
  const mw = Math.ceil(px.w / C);
  const mh = Math.ceil(px.h / C);
  const mask = new Uint8Array(mw * mh);
  const need = Math.ceil((C * C * 6) / 16);
  for (let cy = 0; cy < mh; cy++) {
    for (let cx = 0; cx < mw; cx++) {
      let n = 0;
      for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) if (px.get(cx * C + i, cy * C + j) !== 0) n++;
      mask[cy * mw + cx] = n >= need ? 1 : 0;
    }
  }
  return { mask, mw, mh };
}

/**
 * 낱그림 한 벌(여러 장)을 캔버스로. k는 그림을 그림 점으로 옮기는 배수(1배 그림이면 ART, 그림 점으로 그린 것이면 1).
 * 발치(ax, ay)는 그 그림의 점이고, 옮긴 뒤의 발치는 ×k다.
 */
function imgOf(snap: Snapper, frames: Px[], ax: number, ay: number, def: Partial<SpriteDef> | undefined, k: number, flips = false): Img {
  for (const f of frames) snap.apply(f);
  const big = frames.map((f) => upscale(f, k));
  const w = big[0].w;
  const h = big[0].h;
  return {
    canvas: toCanvas(strip(big)),
    flipped: flips ? toCanvas(strip(big.map((f) => f.flipX()))) : null,
    w,
    h,
    n: big.length,
    ax: ax * k,
    ay: ay * k,
    seq: def?.seq ?? big.map((_, i) => i),
    rate: def?.rate ?? 1.7,
    sort: def?.sort ?? 0,
    shades: def?.shades ?? [],
    smoke: def?.smoke ? { x: def.smoke.x * k, y: def.smoke.y * k } : undefined,
    ...maskOf(big[0]),
  };
}

export interface Atlas {
  season: Season;
  weather: Weather;
  pal: Palette;
  /** 세운 것(지은 것만 — thingImg가 처음 부를 때 짓는다) */
  things: Map<string, Img>;
  /** 사람 시트(지은 것만 — personCanvas가 처음 부를 때 짓는다). 한 장은 PERSON_W×PERSON_H 그림 점이다. */
  people: Map<string, HTMLCanvasElement>;
  critters: Map<string, Img>;
  drift: Img[];
  smoke: Img[];
  glint: Img;
  /** 풀밭을 지나가는 바람결, 논물의 잔물결, 날아가는 새 */
  gust: Img;
  ripple: Img;
  bird: Img;
  cloud: Img;
  flag: Img;
  bubble: Img;
  lock: Img;
  rings: Img;
  arrows: Img[];
  /** 사람·짐승 발밑의 따뜻한 그림자(곱하기로 얹는다 — 바닥 빛을 한 단계 어둡게) */
  foot: Img;
  butterflies: Img[];
  /** 여름의 잠자리(빛깔 둘), 논의 벼를 지나가는 바람결, 논에 들어선 사람의 발치를 가리는 벼 */
  dragonflies: Img[];
  cropGust: Img;
  cropFront: Img;
  /** 비: 빗줄기(길이 셋)와 땅에 튀는 물방울(석 장) */
  rain: Img[];
  splash: Img;
  /** 냇물의 물결(가로로 이어 붙인 장들. 한 장은 WATER_TILE 그림 점 네모) */
  water: HTMLCanvasElement;
  waterN: number;
  snap: Snapper;
}

/** 물결 한 장의 크기(그림 점) */
export const WATER_TILE = 64 * ART;

/** 짐승의 갈래 → 그림 */
const CRITTERS: Record<string, () => critters.Critter> = {
  hen: critters.hen,
  rooster: critters.rooster,
  chick: critters.chick,
  dog: critters.dog,
  ox: critters.ox,
  plowTeam: critters.plowTeam,
  magpie: critters.magpie,
  egret: critters.egret,
  sparrow: critters.sparrow,
};

/** 맵 하나를 그리는 데 드는 것: 세운 것의 열쇠, 사람의 이름, 짐승의 이름 */
export interface Needs {
  things: string[];
  people: string[];
  critters: string[];
}

/** 그 맵에 놓인 갈래와 나오는 사람·짐승(주인공 포함) */
export function needsOf(map: MapData, heroes: readonly string[] = []): Needs {
  const things = new Set<string>();
  for (const o of map.objects) {
    things.add(thingKey(o.kind, o.variant));
    // 문짝은 그 문이 닫힌 사람에게 닫힌 모습(1)으로 보인다
    if (o.gate) {
      things.add(thingKey(o.kind, 0));
      things.add(thingKey(o.kind, 1));
    }
  }
  const people = new Set<string>(heroes);
  const animals = new Set<string>();
  for (const d of map.dwellers) {
    if (d.animal || CRITTERS[d.sprite]) animals.add(d.sprite);
    else people.add(d.sprite);
  }
  return { things: [...things], people: [...people], critters: [...animals] };
}

const kindVariant = (key: string): [string, number] => {
  const at = key.lastIndexOf(':');
  return [key.slice(0, at), Number(key.slice(at + 1))];
};

/** 세운 것 하나(처음 부를 때 짓는다) */
export function thingImg(atlas: Atlas, key: string): Img | undefined {
  let img = atlas.things.get(key);
  if (!img) {
    const [kind, v] = kindVariant(key);
    let def: SpriteDef;
    try {
      def = thingDef(atlas.pal, kind, v);
    } catch {
      return undefined;
    }
    img = imgOf(atlas.snap, def.frames, def.ax, def.ay, def, ART);
    atlas.things.set(key, img);
  }
  return img;
}

/** 사람 시트 하나(처음 부를 때 짓는다) */
export function personCanvas(atlas: Atlas, name: string): HTMLCanvasElement | undefined {
  let sheet = atlas.people.get(name);
  if (!sheet) {
    const p = personOf(name);
    if (!p) return undefined;
    sheet = toCanvas(atlas.snap.apply(personSheet(p)));
    atlas.people.set(name, sheet);
  }
  return sheet;
}

/** 짐승 하나(처음 부를 때 짓는다) */
export function critterImg(atlas: Atlas, name: string): Img | undefined {
  let img = atlas.critters.get(name);
  if (!img) {
    const make = CRITTERS[name];
    if (!make) return undefined;
    const c = make();
    img = imgOf(atlas.snap, c.frames, c.ax, c.ay, undefined, c.art ? 1 : ART, true);
    atlas.critters.set(name, img);
  }
  return img;
}

/** 지을 것을 미리 다 짓는다(나눠 짓고 싶으면 한 가지씩 부른다 — prepareSteps) */
export function ensureAll(atlas: Atlas, needs: Needs): void {
  for (const k of needs.things) thingImg(atlas, k);
  for (const n of needs.people) personCanvas(atlas, n);
  for (const n of needs.critters) critterImg(atlas, n);
}

/**
 * 지을 것을 한 가지씩 짓는 일감들(쉬는 틈에 하나씩 부른다). 사람 시트는 방향 한 줄(열두 장)씩 넷으로 나눠 짓는다 —
 * 일감 하나가 낮은 사양에서도 한 장의 시간 안에 들게.
 */
export function prepareSteps(atlas: Atlas, needs: Needs): (() => void)[] {
  const people: (() => void)[] = [];
  for (const name of needs.people) {
    const p = personOf(name);
    if (!p || atlas.people.has(name)) continue;
    const sheet = new Px(PERSON_W * SHEET_COLS, PERSON_H * 4);
    for (let row = 0; row < 4; row++) {
      people.push(() => {
        if (atlas.people.has(name)) return;
        personSheetRow(p, sheet, row);
        if (row === 3) atlas.people.set(name, toCanvas(atlas.snap.apply(sheet)));
      });
    }
  }
  return [...needs.things.map((k) => () => void thingImg(atlas, k)), ...people, ...needs.critters.map((n) => () => void critterImg(atlas, n))];
}

const single = (snap: Snapper, px: Px, ax = Math.floor(px.w / 2), ay = px.h - 1): Img => imgOf(snap, [px], ax, ay, undefined, ART);

/**
 * 계절(과 날씨)의 그림 벌. needs를 주면 그것만 미리 짓고(나머지는 처음 부를 때), 없으면 모든 갈래를 짓는다(그림 견본).
 */
export function buildAtlas(season: Season, weather: Weather = 'clear', needs?: Needs): Atlas {
  const pal = paletteOf(season, weather);
  const snap = snapperOf(pal);
  const water = waterFrames(pal).map((f) => snap.apply(f));
  const arrows = critters.arrowMarks().map((px) => single(snap, px, Math.floor(px.w / 2), Math.floor(px.h / 2)));
  const rain = critters.rainSprites(pal);
  const atlas: Atlas = {
    season,
    weather: pal.rain ? 'rain' : 'clear',
    pal,
    things: new Map(),
    people: new Map(),
    critters: new Map(),
    drift: critters.driftSprites(pal).map((px) => single(snap, px)),
    smoke: critters.smokePuffs().map((px) => single(snap, px, Math.floor(px.w / 2), Math.floor(px.h / 2))),
    glint: imgOf(
      snap,
      critters.glintFrames(pal).map((f) => {
        // 세 장의 크기를 맞춘다
        const out = new Px(5, 5);
        out.blit(f, Math.floor((5 - f.w) / 2), Math.floor((5 - f.h) / 2));
        return out;
      }),
      2,
      2,
      undefined,
      ART,
    ),
    gust: imgOf(snap, critters.gustFrames(pal), 0, 0, undefined, ART),
    ripple: imgOf(snap, critters.rippleFrames(pal), 0, 0, undefined, ART),
    bird: imgOf(snap, critters.birdFrames(), 3, 2, undefined, ART),
    cloud: single(snap, critters.cloudShadow(), 0, 0),
    flag: single(snap, critters.flagMark(), 3, 15),
    bubble: single(snap, critters.bubbleMark(), 5, 10),
    lock: single(snap, critters.barMark(), 7, 12),
    rings: imgOf(snap, critters.targetRings(), 9, 5, undefined, ART),
    arrows,
    // 발밑 그림자는 그림 점으로 그렸다(곱하기로 얹으므로 한 벌에 맞추지 않는다)
    foot: footImg(pal),
    butterflies: [critters.butterfly('white'), critters.butterfly('yellow')].map((c) => imgOf(snap, c.frames, c.ax, c.ay, undefined, ART)),
    dragonflies: [critters.dragonfly('blue'), critters.dragonfly('amber')].map((c) => imgOf(snap, c.frames, c.ax, c.ay, undefined, ART)),
    cropGust: imgOf(snap, critters.cropGustFrames(pal), 0, 0, undefined, ART),
    cropFront: single(snap, critters.cropFront(pal), 7, 3),
    rain: rain.streaks.map((px) => single(snap, px, 0, px.h - 1)),
    splash: imgOf(snap, rain.splash, 3, 2, undefined, ART),
    water: toCanvas(strip(water)),
    waterN: water.length,
    snap,
  };
  if (needs) ensureAll(atlas, needs);
  else {
    for (const k of allThingKeys()) thingImg(atlas, k);
    for (const n of allPeople()) personCanvas(atlas, n);
    for (const n of Object.keys(CRITTERS)) critterImg(atlas, n);
  }
  return atlas;
}

function footImg(pal: Palette): Img {
  const px = footShadow(pal);
  return {
    canvas: toCanvas(px),
    flipped: null,
    w: px.w,
    h: px.h,
    n: 1,
    // 발치(그림을 놓는 점)에서 그림자의 가운데가 FOOT_SHIFT만큼 오른쪽 아래에 오게
    ax: (px.w >> 1) - FOOT_SHIFT.x,
    ay: (px.h >> 1) - FOOT_SHIFT.y,
    seq: [0],
    rate: 1,
    sort: 0,
    shades: [],
    mask: new Uint8Array(0),
    mw: 0,
    mh: 0,
  };
}

function allThingKeys(): string[] {
  const out: string[] = [];
  for (const [kind, def] of Object.entries(THINGS)) for (let v = 0; v < def.variants; v++) out.push(thingKey(kind, v));
  return out;
}
function allPeople(): string[] {
  return Object.keys({ ...HEROES, ...VILLAGERS, ...GUISES });
}

/** 세운 것들이 바닥에 드리우는 그림자(맵 점). 그 맵의 세운 것을 모두 짓는다. */
export function shadesOf(atlas: Atlas, objects: readonly Placed[]): Shade[] {
  return shadesFor((key) => thingImg(atlas, key)?.shades, objects);
}

// ── 땅: 한 장의 캔버스에 조각으로 나눠 칠한다 ─────────────────────────

/** 땅의 조각 하나(그림 점) — 맵 칸 8×8 */
export const GROUND_CHUNK = GROUND_TILE * 8;

export interface GroundCanvas {
  canvas: HTMLCanvasElement;
  job: GroundJob;
  /** 칸마다 물결/논물/벼(칠한 조각의 칸만 wet이 맞다) */
  wet: Uint8Array;
  glint: Uint8Array;
  crop: Uint8Array;
  cw: number;
  ch: number;
  /** 조각마다 칠했는가 */
  done: Uint8Array;
  left: number;
  /** 잘게 나눠 칠하는 중인 조각(없으면 null) */
  cur: { i: number; steps: Generator<undefined, Px, undefined> } | null;
}

/** 땅의 캔버스를 만든다(아직 칠하지 않는다) */
export function groundCanvas(atlas: Atlas, map: GroundMap, shades: readonly Shade[]): GroundCanvas {
  const job = groundJob(map, atlas.pal, shades);
  const canvas = document.createElement('canvas');
  canvas.width = job.W;
  canvas.height = job.H;
  const cw = Math.ceil(job.W / GROUND_CHUNK);
  const ch = Math.ceil(job.H / GROUND_CHUNK);
  return { canvas, job, wet: job.wet, glint: job.glint, crop: job.crop, cw, ch, done: new Uint8Array(cw * ch), left: cw * ch, cur: null };
}

function chunkRect(g: GroundCanvas, i: number): [number, number, number, number] {
  const x = (i % g.cw) * GROUND_CHUNK;
  const y = Math.floor(i / g.cw) * GROUND_CHUNK;
  return [x, y, Math.min(GROUND_CHUNK, g.job.W - x), Math.min(GROUND_CHUNK, g.job.H - y)];
}

function putChunk(g: GroundCanvas, i: number, px: Px): void {
  if (g.done[i]) return;
  const [x, y] = chunkRect(g, i);
  const ctx = g.canvas.getContext('2d');
  if (ctx) ctx.putImageData(new ImageData(new Uint8ClampedArray(px.d.buffer as ArrayBuffer), px.w, px.h), x, y);
  g.done[i] = 1;
  g.left--;
}

/** 조각 하나를 지금 다 칠한다(나눠 칠하던 조각이면 남은 것을 마저 칠한다) */
export function paintChunk(g: GroundCanvas, cx: number, cy: number): void {
  const i = cy * g.cw + cx;
  if (g.done[i]) return;
  let steps: Generator<undefined, Px, undefined>;
  if (g.cur && g.cur.i === i) {
    steps = g.cur.steps;
    g.cur = null;
  } else steps = g.job.steps(...chunkRect(g, i));
  let r = steps.next();
  while (!r.done) r = steps.next();
  putChunk(g, i, r.value);
}

/** 맵 점의 네모(둘레 pad 맵 점까지)에 걸친 조각을 모두 지금 칠한다. 칠한 조각의 수를 돌려준다. */
export function paintAround(g: GroundCanvas, x0: number, y0: number, x1: number, y1: number, pad = 0): number {
  if (g.left === 0) return 0;
  const c0x = Math.max(0, Math.floor(((x0 - pad) * ART) / GROUND_CHUNK));
  const c0y = Math.max(0, Math.floor(((y0 - pad) * ART) / GROUND_CHUNK));
  const c1x = Math.min(g.cw - 1, Math.floor(((x1 + pad) * ART) / GROUND_CHUNK));
  const c1y = Math.min(g.ch - 1, Math.floor(((y1 + pad) * ART) / GROUND_CHUNK));
  let n = 0;
  for (let cy = c0y; cy <= c1y; cy++) {
    for (let cx = c0x; cx <= c1x; cx++) {
      if (g.done[cy * g.cw + cx]) continue;
      paintChunk(g, cx, cy);
      n++;
    }
  }
  return n;
}

/** 아직 칠하지 않은 조각 가운데 (맵 점) 자리에서 가장 가까운 것(없으면 −1). within(맵 점의 네모)을 주면 그 안에 걸친 것만. */
export function nearestChunk(g: GroundCanvas, x: number, y: number, within?: [number, number, number, number]): number {
  let best = -1;
  let bestD = Infinity;
  const [r0x, r0y, r1x, r1y] = within ? within.map((v) => (v * ART) / GROUND_CHUNK) : [0, 0, g.cw, g.ch];
  for (let cy = 0; cy < g.ch; cy++) {
    if (cy + 1 <= r0y || cy > r1y) continue;
    for (let cx = 0; cx < g.cw; cx++) {
      if (cx + 1 <= r0x || cx > r1x) continue;
      if (g.done[cy * g.cw + cx]) continue;
      const dx = (cx + 0.5) * GROUND_CHUNK - x * ART;
      const dy = (cy + 0.5) * GROUND_CHUNK - y * ART;
      const d = dx * dx + dy * dy * 1.4;
      if (d < bestD) {
        bestD = d;
        best = cy * g.cw + cx;
      }
    }
  }
  return best;
}

/**
 * 땅을 budget 밀리초쯤만 칠한다(조각을 잘게 나눠 — 한 장을 오래 막지 않는다). pick이 다음에 칠할 조각을 고른다(없으면 −1).
 * 나눠 칠하던 조각이 있으면 그것부터 잇는다. 다 칠한 조각의 수를 돌려준다.
 */
export function workGround(g: GroundCanvas, budgetMs: number, pick: () => number): number {
  if (g.left === 0) return 0;
  const t0 = performance.now();
  let finished = 0;
  do {
    if (!g.cur) {
      const i = pick();
      if (i < 0 || g.done[i]) return finished;
      g.cur = { i, steps: g.job.steps(...chunkRect(g, i)) };
    }
    const r = g.cur.steps.next();
    if (r.done) {
      putChunk(g, g.cur.i, r.value);
      g.cur = null;
      finished++;
      if (g.left === 0) return finished;
    }
  } while (performance.now() - t0 < budgetMs);
  return finished;
}

/** 아직 칠하지 않은 조각 가운데 (맵 점) 자리에서 가장 가까운 것 하나를 다 칠한다. 칠할 것이 없으면 false. */
export function paintNearest(g: GroundCanvas, x: number, y: number): boolean {
  const i = nearestChunk(g, x, y);
  if (i < 0) return false;
  paintChunk(g, i % g.cw, Math.floor(i / g.cw));
  return true;
}

/** 땅을 다 칠한다(그림 견본, 시험용) */
export function paintAll(g: GroundCanvas): void {
  for (let cy = 0; cy < g.ch; cy++) for (let cx = 0; cx < g.cw; cx++) paintChunk(g, cx, cy);
}

/** 땅을 칠하고 빛깔 한 벌에 맞춰 캔버스로 옮긴다(한꺼번에 — 그림 견본이 쓴다) */
export function paintedGround(atlas: Atlas, map: GroundMap, shades: readonly Shade[]): { ground: Ground; canvas: HTMLCanvasElement } {
  const g = groundCanvas(atlas, map, shades);
  paintAll(g);
  return { ground: { px: new Px(0, 0), wet: g.wet, glint: g.glint, crop: g.crop }, canvas: g.canvas };
}
