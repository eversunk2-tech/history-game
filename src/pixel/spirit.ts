// 느티나무 정령 「느티」의 도트(spec 6.2, 11.1 마의 "정령 도트", 4.7.5의 ㄱ~ㅎ).
//
// 한 장은 사람과 같은 48×64 그림 점(맵 점 24×32), 발치도 같은 (24, 60)이다. 네 방향 × 떠 있기 두 장.
// 사람 틀(people.ts의 personFrame)을 매개변수로 그린다: 아이 키(child), 느티나무 잎빛 머리, 한지 빛 긴 옷(robe), 맨 꼭대기의 잎사귀 장식 하나.
//   - 성별을 드러내지 않는다: 댕기·수염·콧수염이 없고, 치마도 바지도 아닌 긴 옷이다. 얼굴 둘레는 앞머리가 이마를 덮는 단발(옆머리가 뺨까지)이고,
//     사람 틀이 여자 얼굴에만 찍는 속눈썹 한 점은 지운다(SPIRIT_PERSON의 sex는 얼굴 둘레의 꼴을 고르는 값일 뿐이다).
//   - 테두리는 사람과 같은 (나) 제 빛깔을 짙게 한 부드러운 테두리(personFrame이 두른다). 새로 얹은 잎사귀에도 같은 셈으로 두른다(wash.ts의 softOutline).
//   - 발은 땅에 닿지 않는다: 몸 전체를 LIFT 그림 점 띄우고, 두 장이 위아래로 BOB 그림 점 오르내린다(ㅊ — 1~2 그림 점).
//   - 둘레의 빛: 반딧불 같은 작은 빛 셋(두 점 이상의 무리 — ㄹ). 장마다, 방향마다 자리가 조금 다르다.
//   - 그림자: 맵에서는 사람보다 작고 엷은 발밑 그림자를 바닥에 곱해 얹는다(draw.ts — SPIRIT_SHADOW). 아주 없으면 바닥에서 뜬 거리가 보이지 않고
//     (붙여 놓은 그림처럼 보인다), 사람만큼 짙으면 땅을 딛고 선 것처럼 보인다. 작고 엷은 그림자와 발 사이의 틈이 "떠 있다"를 보여 준다.
// 빛깔은 봄 벌의 빛으로 골랐다(ㅇ — 그림 벌이 계절마다 그 벌에 맞춘다. 대화 장면의 대역은 봄 벌에 맞춘다).

import type { Dir } from '../map/types';
import { SKIN, type Ramp } from './palette';
import { PERSON_AX, PERSON_AY, PERSON_H, PERSON_W, personFrame, type Person } from './people';
import { Px, hex, mix, type Color } from './px';
import type { Snapper } from './quant';
import { WARM_DARK, softOutline, type RampIndex } from './wash';

const R = (...list: string[]): Ramp => list.map((s) => hex(s));

/** 정령의 이름(맵의 동료 companion, 대화 장면의 sprite) */
export const SPIRIT = 'neuti';

/** 느티나무 잎빛 머리(봄의 새잎 — 어두움 → 밝음) */
export const LEAF_HAIR: Ramp = R('#315a38', '#4f7a3a', '#679b4d', '#8fb352');
/** 한지 빛 옷(무명보다 조금 누런 따뜻한 흰빛) */
export const HANJI: Ramp = R('#816449', '#c0a981', '#e0d0b9', '#f4eedd');
/** 버선(한지 빛 — 가운데 두 단계가 가까워 엮은 결이 외톨이 점으로 튀지 않는다) */
export const SOCKS: Ramp = R('#816449', '#d6c7a2', '#e0d0b9', '#f4eedd');
/** 잎사귀 장식(느티나무 잎 — 봄의 새잎보다 한 단계 짙고 맑다) */
export const LEAF_PIN: Ramp = R('#446a38', '#72a64c', '#a3c25c', '#d0e48e');
/** 반딧불 같은 빛: 가운데와 둘레 */
const GLOW_CORE = hex('#f9f6ef');
const GLOW = hex('#e5eb92');

/**
 * 정령의 몸(사람 틀의 매개변수). 성별을 가르는 부품이 없다(댕기 ribbon·수염 beard·콧수염 mustache·치마 skirt·바지 pants가 없다).
 * sex 'f'는 얼굴 둘레(앞머리와 옆머리가 덮는 단발)를 고르는 값이고, 그 틀이 찍는 속눈썹은 spiritFrame이 지운다.
 */
export const SPIRIT_PERSON: Person = {
  build: 'child',
  sex: 'f',
  bottom: 'robe',
  hair: 'tuft',
  hairColor: LEAF_HAIR,
  skin: SKIN.fair,
  top: HANJI,
  lower: HANJI,
  shoes: SOCKS,
  collar: HANJI[3],
  // 잎빛 허리띠: 흰 긴 옷만으로 떠 있으면 소복 입은 귀신처럼 읽힐 수 있어, 허리에 잎빛을 한 줄 둘렀다
  sash: LEAF_PIN,
};

/** 땅에서 뜬 높이(그림 점)와 두 장의 오르내림(그림 점) */
export const LIFT = 6;
export const BOB = 2;
/** 장 수(떠 있기) */
export const SPIRIT_FRAMES = 2;

/** 맵의 발밑 그림자: 사람 그림자(footShadow)의 크기와 짙기를 이만큼으로(작고 엷게) */
export const SPIRIT_SHADOW = { size: 0.55, alpha: 0.5 } as const;

const index = (ramps: readonly Ramp[]): RampIndex => {
  const out: RampIndex = new Map();
  for (const ramp of ramps) ramp.forEach((c, i) => void (out.has(c) || out.set(c, [ramp, i])));
  return out;
};
const RAMPS = index([LEAF_PIN, LEAF_HAIR, HANJI, SOCKS, SKIN.fair]);

// 사람 틀의 아이(child) 머리: 맨 윗줄 headTop = 24(서 있기 첫 장), 가운데 줄 C = 24
const HEAD_TOP = 24;
const C = 24;

/** 잎사귀 하나(느티나무 잎: 끝이 뾰족한 길둥근 잎, 가장자리에 잔 톱니, 가운데 잎맥). (bx, by)는 잎자루 끝, lean은 기울기(−1 왼쪽 ~ 1 오른쪽) */
function leaf(px: Px, bx: number, by: number, lean: number): void {
  const len = 9;
  const half = 2.6;
  // 잎의 축: 잎자루 끝에서 위로, lean만큼 옆으로 기운다
  const ax = lean * 0.55;
  const ay = -1;
  const norm = Math.hypot(ax, ay);
  const ux = ax / norm;
  const uy = ay / norm;
  const vx = -uy;
  const vy = ux;
  // 잎자루(두 점)
  px.set(bx, by, LEAF_PIN[0]);
  px.set(Math.round(bx + ux), Math.round(by + uy), LEAF_PIN[1]);
  for (let y = by - len - 3; y <= by + 1; y++) {
    for (let x = bx - len; x <= bx + len; x++) {
      const dx = x + 0.5 - (bx + 0.5 + ux * 1.5);
      const dy = y + 0.5 - (by + 0.5 + uy * 1.5);
      const t = (dx * ux + dy * uy) / len; // 0 잎밑 → 1 잎끝
      const s = dx * vx + dy * vy; // 잎맥에서 옆으로
      if (t < 0 || t > 1) continue;
      // 잎의 너비: 잎밑은 둥글고 끝은 뾰족하다. 가장자리의 잔 톱니
      const w = half * Math.sin(Math.PI * Math.pow(t, 0.8)) * (t < 0.15 ? 0.8 : 1);
      const tooth = (Math.floor(t * len * 1.4) % 2 === 0 ? 0.35 : 0) * (t > 0.2 && t < 0.9 ? 1 : 0);
      if (Math.abs(s) > w + tooth) continue;
      // 빛은 왼쪽 위: 잎맥의 왼쪽(볕)과 오른쪽(그늘)
      let v = s < 0 ? 3 : 2;
      if (Math.abs(s) < 0.6) v = 1; // 잎맥
      if (s > w - 0.6) v = 1;
      if (t > 0.85) v = Math.min(v, 2);
      px.set(x, y, LEAF_PIN[v]);
    }
  }
}

/** 반딧불 같은 빛 하나: 큰 것(2×2 — 왼쪽 위가 가장 밝다)과 작은 것(두 점) */
function glow(px: Px, x: number, y: number, big: boolean): void {
  px.set(x, y, big ? GLOW_CORE : GLOW);
  px.set(x + 1, y, GLOW);
  if (big) {
    px.set(x, y + 1, GLOW);
    px.set(x + 1, y + 1, GLOW);
  }
}

/** 빛 셋의 자리(그림 점, 띄우기 전 — 몸 둘레). 장마다 조금씩 옮겨 가며 반짝인다 */
const GLOWS: Record<Dir, readonly (readonly [number, number, boolean])[][]> = {
  down: [
    [
      [8, 30, true],
      [39, 22, false],
      [41, 41, false],
    ],
    [
      [9, 27, false],
      [40, 20, true],
      [38, 44, false],
    ],
  ],
  up: [
    [
      [39, 30, true],
      [8, 22, false],
      [7, 41, false],
    ],
    [
      [38, 27, false],
      [7, 20, true],
      [9, 44, false],
    ],
  ],
  left: [
    [
      [40, 28, true],
      [10, 20, false],
      [37, 44, false],
    ],
    [
      [41, 25, false],
      [9, 23, true],
      [39, 41, false],
    ],
  ],
  right: [
    [
      [7, 28, true],
      [36, 20, false],
      [9, 44, false],
    ],
    [
      [6, 25, false],
      [37, 23, true],
      [7, 41, false],
    ],
  ],
};

/** 새로 얹은 그림(added)의 둘레에만 (나) 테두리를 두른다 — 이미 두른 테두리 밖에 한 겹 더 두르지 않게 */
function outlineAdded(px: Px, added: Px): void {
  const ring = added.clone();
  softOutline(ring, RAMPS);
  for (let i = 0; i < ring.d.length; i++) {
    if (added.d[i] !== 0) px.d[i] = added.d[i];
    else if (ring.d[i] !== 0 && px.d[i] === 0) px.d[i] = ring.d[i];
  }
}

/**
 * 사람 틀이 두른 (나) 테두리를 정령의 단계로 다시 칠한다: 사람 틀의 표(RAMP_OF)는 사람의 옷감·살빛·머리 단계만 알아,
 * 잎빛 머리·한지 빛 옷 곁의 테두리는 곁의 빛을 조금만 짙게 한 엷은 빛이 된다(풀밭에서 묻힌다). 같은 셈(곁의 빛깔이 든 단계의
 * 가장 어두운 빛에 따뜻한 밤빛을 0.68 섞는다)을 정령의 단계 표로 다시 한다. 테두리의 자리(꼴)는 그대로다.
 */
function reRim(px: Px): void {
  const src = px.d.slice();
  const { w, h } = px;
  const at = (x: number, y: number): Color => (x >= 0 && y >= 0 && x < w && y < h ? src[y * w + x] : 0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = src[y * w + x];
      if (c === 0 || RAMPS.has(c)) continue;
      if (at(x, y - 1) !== 0 && at(x - 1, y) !== 0 && at(x + 1, y) !== 0 && at(x, y + 1) !== 0) continue;
      const near = [at(x, y - 1), at(x - 1, y), at(x + 1, y), at(x, y + 1)].find((q) => RAMPS.has(q));
      if (near === undefined) continue;
      px.d[y * w + x] = mix(RAMPS.get(near)![0][0], WARM_DARK, 0.68);
    }
  }
}

/** 그림을 위로 n 그림 점 옮긴다 */
function lifted(src: Px, n: number): Px {
  const out = new Px(src.w, src.h);
  out.blitRaw(src, 0, -n);
  return out;
}

/**
 * 정령 한 장(48×64 그림 점, 발치 (24, 60) — 사람과 같다). frame은 떠 있기의 0·1.
 * snap을 주면 그 벌에 맞춘다(그림 벌은 따로 맞추므로 주지 않는다).
 */
export function spiritFrame(dir: Dir, frame: number, snap?: Snapper): Px {
  const f = ((frame % SPIRIT_FRAMES) + SPIRIT_FRAMES) % SPIRIT_FRAMES;
  // 사람 틀의 서 있기 첫 장(숨쉬기는 떠 있기의 오르내림이 맡는다)
  const body = personFrame(SPIRIT_PERSON, dir, 'idle', 0);
  reRim(body);
  if (dir === 'down') {
    // 속눈썹 한 점씩을 얼굴의 살빛으로(아이 얼굴: 눈 윗줄 = 맨 윗줄 + 8, 눈의 바깥 곁)
    const ey = HEAD_TOP + 8;
    body.set(C - 10 + 6 - 1, ey, SPIRIT_PERSON.skin[2]);
    body.set(C - 1 + 10 - 7 + 2, ey, SPIRIT_PERSON.skin[2]);
  }
  // 정수리의 묶은 머리에 꽂은 잎사귀 하나(보는 쪽에 따라 기울기가 바뀐다 — 오른쪽을 볼 때는 그림이 뒤집혀 있다)
  const top = new Px(PERSON_W, PERSON_H);
  const lean = dir === 'down' ? -0.8 : dir === 'up' ? 0.8 : dir === 'left' ? 0.9 : -0.9;
  const bx = dir === 'left' ? C + 3 : dir === 'right' ? C - 4 : C + (dir === 'down' ? -1 : 0);
  leaf(top, bx, HEAD_TOP - 3, lean);
  outlineAdded(body, top);
  // 둘레의 빛
  const lights = new Px(PERSON_W, PERSON_H);
  for (const [x, y, big] of GLOWS[dir][f]) glow(lights, x, y, big);
  for (let i = 0; i < lights.d.length; i++) if (lights.d[i] !== 0 && body.d[i] === 0) body.d[i] = lights.d[i];
  const out = lifted(body, LIFT + (f === 1 ? BOB : 0));
  return snap ? snap.apply(out) : out;
}

/** 정령의 시트: 줄은 방향(아래·위·왼쪽·오른쪽), 칸은 떠 있기 두 장. 한 장은 PERSON_W×PERSON_H 그림 점 */
export const SPIRIT_DIRS: Dir[] = ['down', 'up', 'left', 'right'];
export function spiritSheet(snap?: Snapper): Px {
  const out = new Px(PERSON_W * SPIRIT_FRAMES, PERSON_H * SPIRIT_DIRS.length);
  SPIRIT_DIRS.forEach((dir, row) => {
    for (let f = 0; f < SPIRIT_FRAMES; f++) out.blit(spiritFrame(dir, f), f * PERSON_W, row * PERSON_H);
  });
  return snap ? snap.apply(out) : out;
}

/** 그 이름이 정령인가(사람 시트 대신 정령 시트를 짓는다) */
export function isSpirit(name: string): boolean {
  return name === SPIRIT;
}

export { PERSON_AX as SPIRIT_AX, PERSON_AY as SPIRIT_AY, PERSON_H as SPIRIT_H, PERSON_W as SPIRIT_W };

/** 시험이 쓰는 것: 그림이 쓰는 빛의 단계 */
export const SPIRIT_RAMPS: readonly Ramp[] = [LEAF_PIN, LEAF_HAIR, HANJI, SOCKS, SKIN.fair];
/** 시험이 쓰는 것: 반딧불의 빛 */
export const SPIRIT_GLOW: readonly Color[] = [GLOW_CORE, GLOW];
