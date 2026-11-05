// 버퍼에 찍은 그림들을 캔버스로 옮겨 한 벌로 묶는다(브라우저에서만). 계절마다 한 벌.
//
// 모든 낱그림의 크기·발치·가림 마스크는 그림 점(ART — 맵 점의 반) 단위다(spec 4.7.5의 ㄱ). 그림 올리기 ①에서 사람과 땅을,
// ②에서 집·나무·소품·짐승·날림·표시를 그림 점으로 다시 그렸다 — 1배 그림을 키워 쓰는 것은 없다.
//
// 무게(ㅋ): 지은 그림은 그 맵에 놓인 갈래와 그 맵에 나오는 사람·짐승뿐이다(나머지는 처음 부를 때 짓는다).
// 물결·날림·표시 같은 벌의 바탕도 처음 쓸 때 짓고, 미리 짓기(prepareSteps)는 그것을 작은 일감으로 나눠 짓는다(한 장을 오래 막지 않는다).
// 땅은 화면 둘레부터 조각으로 나눠 칠하고 나머지는 쉬는 틈에 칠한다(GroundCanvas).

import type { Season } from '../engine/types';
import { shadesFor, thingDef, thingJob, thingKey } from './catalog';
import * as critters from './critters';
import { GROUND_TILE, groundJob, snapperOf, waterFrame, type Ground, type GroundJob, type GroundMap, type Shade } from './ground';
import { paletteOf, type Palette } from './palette';
import { FOOT_SHIFT, GUISES, HEROES, PERSON_H, PERSON_W, SHEET_COLS, VILLAGERS, footShadow, personOf, personSheet, personSheetRow } from './people';
import { ART, Px, strip, toCanvas } from './px';
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

/**
 * 그림이 찍힌 자리를 ART점 넓힌다(위아래·옆으로). 1-라 그림은 둘레에 맵 점 하나 굵기의 먹빛 테두리가 있었고 가림 마스크도 그 몫을 쳤다.
 * 2배 그림은 테두리가 없으므로 그만큼 넓혀 재야 집·나무 뒤로 돌아갈 때 가려지는 자리가 1-라와 같다.
 */
function grown(px: Px): Uint8Array {
  const { w, h } = px;
  let cur = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) cur[i] = px.d[i] !== 0 ? 1 : 0;
  for (let t = 0; t < ART; t++) {
    const out = cur.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (cur[i]) continue;
        if ((x > 0 && cur[i - 1]) || (x < w - 1 && cur[i + 1]) || (y > 0 && cur[i - w]) || (y < h - 1 && cur[i + w])) out[i] = 1;
      }
    }
    cur = out;
  }
  return cur;
}

function maskOf(px: Px): { mask: Uint8Array; mw: number; mh: number } {
  const C = MASK_CELL;
  const on = grown(px);
  const mw = Math.ceil(px.w / C);
  const mh = Math.ceil(px.h / C);
  const mask = new Uint8Array(mw * mh);
  const need = Math.ceil((C * C * 6) / 16);
  for (let cy = 0; cy < mh; cy++) {
    for (let cx = 0; cx < mw; cx++) {
      let n = 0;
      for (let j = 0; j < C; j++) {
        const y = cy * C + j;
        if (y >= px.h) break;
        for (let i = 0; i < C; i++) {
          const x = cx * C + i;
          if (x < px.w && on[y * px.w + x]) n++;
        }
      }
      mask[cy * mw + cx] = n >= need ? 1 : 0;
    }
  }
  return { mask, mw, mh };
}

/** 낱그림 한 벌(여러 장, 그림 점)을 빛깔 한 벌에 맞춰 캔버스로. 발치(ax, ay)와 굴뚝 끝은 그림 점이다. */
function imgOf(snap: Snapper, frames: Px[], ax: number, ay: number, def: Partial<SpriteDef> | undefined, flips = false): Img {
  for (const f of frames) snap.apply(f);
  const w = frames[0].w;
  const h = frames[0].h;
  return {
    canvas: toCanvas(strip(frames)),
    flipped: flips ? toCanvas(strip(frames.map((f) => f.flipX()))) : null,
    w,
    h,
    n: frames.length,
    ax,
    ay,
    seq: def?.seq ?? frames.map((_, i) => i),
    rate: def?.rate ?? 1.7,
    sort: def?.sort ?? 0,
    shades: def?.shades ?? [],
    smoke: def?.smoke ? { x: def.smoke.x, y: def.smoke.y } : undefined,
    ...maskOf(frames[0]),
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
    img = imgOf(atlas.snap, def.frames, def.ax, def.ay, def);
    atlas.things.set(key, img);
  }
  return img;
}

/**
 * 세운 것 하나를 쉬어 가며 짓는 일감. 부를 때마다 조금씩 짓고, 아직 남았으면 true를 돌려준다(그러면 다시 부른다).
 * 큰 나무는 잎 뭉치 하나씩, 다른 것은 한 번에 짓는다. 다 지은 것은 thingImg와 같다.
 */
function thingStep(atlas: Atlas, key: string): () => boolean {
  let job: ReturnType<typeof thingJob> | null = null;
  let def: SpriteDef | null = null;
  return () => {
    if (atlas.things.has(key)) return false;
    try {
      if (!def) {
        const [kind, v] = kindVariant(key);
        job ??= thingJob(atlas.pal, kind, v);
        const r = job.next();
        if (!r.done) return true;
        // 벌에 맞춰 캔버스로 옮기는 것은 다음 번에(큰 나무는 그것만으로도 무겁다)
        def = r.value;
        return true;
      }
      atlas.things.set(key, imgOf(atlas.snap, def.frames, def.ax, def.ay, def));
    } catch {
      // 그림이 없는 갈래(처음 부를 때 thingImg가 undefined를 돌려준다)
    }
    return false;
  };
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
    img = imgOf(atlas.snap, c.frames, c.ax, c.ay, undefined, true);
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

/** 미리 짓기의 일감 하나: 부를 때마다 조금씩 하고, 아직 남았으면 true(다시 부른다) */
export type Step = () => boolean | void;

/** 일감들을 모두 끝까지 한다(시험과 그림 견본) */
export function runSteps(steps: readonly Step[]): void {
  for (const step of steps) while (step() === true);
}

/**
 * 지을 것을 한 가지씩 짓는 일감들(쉬는 틈에 하나씩 부른다). 벌의 바탕(물결은 한 장씩), 세운 것(큰 나무는 잎 뭉치 하나씩),
 * 사람 시트(방향 한 줄 — 열두 장씩 넷으로), 짐승 — 일감 하나가 낮은 사양에서도 한 장의 시간 안에 들게.
 */
export function prepareSteps(atlas: Atlas, needs: Needs): Step[] {
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
  return [...baseSteps(atlas), ...needs.things.map((k) => thingStep(atlas, k)), ...people, ...needs.critters.map((n) => () => void critterImg(atlas, n))];
}

const single = (snap: Snapper, px: Px, ax = Math.floor(px.w / 2), ay = px.h - 1): Img => imgOf(snap, [px], ax, ay, undefined);

/** 가운데 발치(그림 점): 1-라 그림의 가운데 점(floor(1배 너비 ÷ 2))의 ART배 — 화면의 자리가 1-라와 같게 */
const mid = (n: number): number => Math.floor(n / ART / 2) * ART;

/** 여러 장의 크기를 가장 큰 장에 맞춘다(가운데에 놓는다) */
function padded(frames: Px[]): Px[] {
  const w = Math.max(...frames.map((f) => f.w));
  const h = Math.max(...frames.map((f) => f.h));
  return frames.map((f) => {
    if (f.w === w && f.h === h) return f;
    const out = new Px(w, h);
    out.blit(f, Math.floor((w - f.w) / 2), Math.floor((h - f.h) / 2));
    return out;
  });
}

/** 벌의 바탕(물결을 뺀 것): 처음 쓸 때 짓는다 */
type BaseKey = Exclude<keyof Atlas, 'season' | 'weather' | 'pal' | 'things' | 'people' | 'critters' | 'snap' | 'water' | 'waterN'>;

/** 물결의 장 수 */
const WATER_FRAMES = 24;

function baseMakers(pal: Palette, snap: Snapper): { [K in BaseKey]: () => Atlas[K] } {
  return {
    drift: () => critters.driftSprites(pal).map((px) => single(snap, px, 0, 0)),
    smoke: () => critters.smokePuffs().map((px) => single(snap, px, mid(px.w), mid(px.h))),
    glint: () => {
      const frames = padded(critters.glintFrames(pal));
      return imgOf(snap, frames, mid(frames[0].w), mid(frames[0].h), undefined);
    },
    gust: () => imgOf(snap, critters.gustFrames(pal), 0, 0, undefined),
    ripple: () => imgOf(snap, critters.rippleFrames(pal), 0, 0, undefined),
    bird: () => imgOf(snap, critters.birdFrames(), 3 * ART, 2 * ART, undefined),
    cloud: () => cloudImg(critters.cloudShadow(pal)),
    flag: () => single(snap, critters.flagMark(), 3 * ART, 15 * ART),
    bubble: () => single(snap, critters.bubbleMark(), 5 * ART, 10 * ART),
    lock: () => single(snap, critters.barMark(), 7 * ART, 12 * ART),
    rings: () => imgOf(snap, critters.targetRings(), 9 * ART, 5 * ART, undefined),
    arrows: () => critters.arrowMarks().map((px) => single(snap, px, mid(px.w), mid(px.h))),
    // 발밑 그림자는 곱하기로 얹으므로 한 벌에 맞추지 않는다
    foot: () => footImg(pal),
    butterflies: () => [critters.butterfly('white'), critters.butterfly('yellow')].map((c) => imgOf(snap, c.frames, c.ax, c.ay, undefined)),
    dragonflies: () => [critters.dragonfly('blue'), critters.dragonfly('amber')].map((c) => imgOf(snap, c.frames, c.ax, c.ay, undefined)),
    cropGust: () => imgOf(snap, critters.cropGustFrames(pal), 0, 0, undefined),
    cropFront: () => single(snap, critters.cropFront(pal), 7 * ART, 3 * ART),
    rain: () => critters.rainSprites(pal).streaks.map((px) => single(snap, px, 0, px.h - 1)),
    splash: () => imgOf(snap, critters.rainSprites(pal).splash, 3 * ART, 2 * ART, undefined),
  };
}

/** 벌의 바탕을 짓는 상태(물결은 한 장씩 캔버스에 칠한다) */
interface BaseState {
  made: Set<string>;
  waterCanvas: HTMLCanvasElement | null;
  waterDone: number;
}
const BASE = new WeakMap<Atlas, BaseState>();

function waterStep(atlas: Atlas, st: BaseState): void {
  if (st.waterDone >= WATER_FRAMES) return;
  if (!st.waterCanvas) {
    st.waterCanvas = document.createElement('canvas');
    st.waterCanvas.width = WATER_TILE * WATER_FRAMES;
    st.waterCanvas.height = WATER_TILE;
  }
  const f = atlas.snap.apply(waterFrame(atlas.pal, st.waterDone, WATER_FRAMES));
  const ctx = st.waterCanvas.getContext('2d');
  if (ctx) ctx.putImageData(new ImageData(new Uint8ClampedArray(f.d.buffer as ArrayBuffer), f.w, f.h), st.waterDone * WATER_TILE, 0);
  st.waterDone++;
}

/** 벌의 바탕(물결 스물넉 장, 날림, 표시 …)을 일감으로 나눈다 — 다 지은 것은 빠진다 */
export function baseSteps(atlas: Atlas): (() => void)[] {
  const st = BASE.get(atlas);
  if (!st) return [];
  const out: (() => void)[] = [];
  for (let k = st.waterDone; k < WATER_FRAMES; k++) out.push(() => waterStep(atlas, st));
  for (const key of Object.keys(baseMakers(atlas.pal, atlas.snap)) as BaseKey[]) if (!st.made.has(key)) out.push(() => void atlas[key]);
  return out;
}

/** 벌의 바탕을 지금 다 짓는다 */
export function ensureBase(atlas: Atlas): void {
  for (const step of baseSteps(atlas)) step();
}

/**
 * 계절(과 날씨)의 그림 벌. needs를 주면 그것만 미리 짓고(나머지는 처음 부를 때), 없으면 모든 갈래를 짓는다(그림 견본).
 * 벌의 바탕(물결·날림·표시)은 처음 쓸 때 짓는다 — 미리 지으려면 prepareSteps나 ensureBase.
 */
export function buildAtlas(season: Season, weather: Weather = 'clear', needs?: Needs): Atlas {
  const pal = paletteOf(season, weather);
  const snap = snapperOf(pal);
  const st: BaseState = { made: new Set(), waterCanvas: null, waterDone: 0 };
  const atlas = { season, weather: pal.rain ? 'rain' : 'clear', pal, things: new Map(), people: new Map(), critters: new Map(), snap, waterN: WATER_FRAMES } as Partial<Atlas> as Atlas;
  BASE.set(atlas, st);
  Object.defineProperty(atlas, 'water', {
    enumerable: true,
    get: (): HTMLCanvasElement => {
      while (st.waterDone < WATER_FRAMES) waterStep(atlas, st);
      return st.waterCanvas!;
    },
  });
  for (const [key, make] of Object.entries(baseMakers(pal, snap)) as [BaseKey, () => unknown][]) {
    let value: unknown;
    Object.defineProperty(atlas, key, {
      enumerable: true,
      get: () => {
        if (!st.made.has(key)) {
          value = make();
          st.made.add(key);
        }
        return value;
      },
    });
  }
  if (needs) ensureAll(atlas, needs);
  else {
    ensureBase(atlas);
    for (const k of allThingKeys()) thingImg(atlas, k);
    for (const n of allPeople()) personCanvas(atlas, n);
    for (const n of Object.keys(CRITTERS)) critterImg(atlas, n);
  }
  return atlas;
}

/** 구름 그림자(그림 점): 곱하기로 얹으므로 한 벌에 맞추지 않는다 */
function cloudImg(px: Px): Img {
  return { canvas: toCanvas(px), flipped: null, w: px.w, h: px.h, n: 1, ax: 0, ay: 0, seq: [0], rate: 1, sort: 0, shades: [], mask: new Uint8Array(0), mw: 0, mh: 0 };
}

/** 짐승의 발밑 그림자의 가운데가 발치에서 옮겨 앉은 만큼(그림 점, 아래가 +). 3.1차 시안은 맵 점 하나 오른쪽(그림 점 둘)이었다 — 조금 아래로 더 내려 몸에 덜 가리게 */
export const CRITTER_FOOT_SHIFT = { x: 2, y: 1 };

/**
 * 발밑 그림자를 놓을 네모(그림 점 — 발치에서의 왼쪽 위와 크기). 사람은 그림자 그대로(가운데가 FOOT_SHIFT),
 * 짐승은 몸 너비의 4/5(그림자 너비를 넘지 않게)·높이 4/5로 줄여 가운데가 CRITTER_FOOT_SHIFT에 온다. 빛은 왼쪽 위에서 오므로
 * 그림자는 언제나 발치의 오른쪽 아래로 진다(ㅂ). 그리기(draw.ts)와 시험이 같은 셈을 쓴다.
 */
export function footBox(foot: { w: number; h: number }, critterW?: number): { x: number; y: number; w: number; h: number } {
  if (critterW === undefined) return { x: FOOT_SHIFT.x - (foot.w >> 1), y: FOOT_SHIFT.y - (foot.h >> 1), w: foot.w, h: foot.h };
  const w = Math.min(foot.w, Math.round(critterW * 0.8));
  const h = Math.round(foot.h * 0.8);
  return { x: CRITTER_FOOT_SHIFT.x - (w >> 1), y: CRITTER_FOOT_SHIFT.y - (h >> 1), w, h };
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
