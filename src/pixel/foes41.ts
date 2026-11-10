// 4-1의 고비 둘의 도트: 도깨비(옛이야기의 큰 고비 — spec 8.4·F71)와 굳은 논흙(삶의 고비의 상징 — spec 4.5).
// 대화 장면·겨루기 무대에 크게 세우는 대역이다(캔바 그림 char/s1395/dokkaebi-plain·glad가 없을 때). 그림 점(ART)으로 그리고 봄 벌에 맞춘다(ㅇ).
//
// 도깨비 — 키 크고 털 많은 사람 꼴과 나무 방망이. 어수룩하고 친근하게: 동그란 눈, 처진 눈썹 끝, 뭉툭한 코, 큰 앞니 두 개가 보이는 웃음,
//   덥수룩한 머리털과 턱수염, 털 많은 팔다리, 해진 삼베 저고리와 잿빛 바지, 맨발.
//   그리지 않는 것(spec 8.4, F71 — 일본 요괴 "오니"의 모습): 뿔(머리 위는 둥근 머리털뿐 — 뾰족이 솟은 점이 없다), 호랑이(범) 가죽 옷
//   (옷은 물들이지 않은 삼베와 잿빛 — 주황·검정이 엇갈리는 빛이 없다), 쇠못 박힌 방망이(방망이는 나무 빛 단계 WOOD뿐 — 쇠 빛이 없다).
//   부품의 이름표(DOKKAEBI_PARTS)에도 그런 것이 없다(시험이 본다).
//   크기: 72×104 그림 점(발치 (36, 100)) — 사람 한 장(48×64)의 1.6배 키에 다리가 길어 키가 커 보인다. 숨쉬기 두 장(plain), 웃는 모습 두 장(glad — 방망이를 번쩍 든다).
//   테두리는 사람과 같은 (나) 제 빛깔을 짙게 한 부드러운 테두리(wash.ts의 softOutline).
//
// 굳은 논흙 — 사람 꼴로 그리지 않는다(눈·입이 없다). 논바닥 위에 볕에 단단히 굳은 흙덩이 하나(갈라진 금). 96×64 그림 점(발치 (48, 60)).
//   기운이 깎일수록 금이 는다(SOIL_STAGES 다섯 단계 + 다 풀린 흙). 맞을 때는 흙 조각이 튀었다가 떨어지는 석 장(soilBreak) —
//   세게 번쩍이거나 흔들지 않는다(spec 8.6). 테두리는 제 빛깔(ㄴ — 땅·소품처럼 그림 안쪽 가장자리를 제 단계로 가른다).

import { CLOTH, SKIN, paletteOf, type Ramp } from './palette';
import { Px, clamp, hash2, hex, mix, vnoise } from './px';
import type { Snapper } from './quant';
import { WARM_DARK, calmSprite, selfRim, softOutline, watercolor, type RampIndex } from './wash';

const R = (...list: string[]): Ramp => list.map((s) => hex(s));
const SPRING = paletteOf('spring');

const indexOf = (ramps: readonly Ramp[]): RampIndex => {
  const out: RampIndex = new Map();
  for (const ramp of ramps) ramp.forEach((c, i) => void (out.has(c) || out.set(c, [ramp, i])));
  return out;
};

/** 타원 안의 점에서 빛(왼쪽 위)을 받는 정도로 단계를 고른다(wash.ts의 ball과 같은 셈 — 꼴은 mask가 정한다) */
export function lit(x: number, y: number, cx: number, cy: number, rx: number, ry: number, lo: number, hi: number, bias = 0): number {
  const dx = clamp((x + 0.5 - cx) / rx, -1, 1);
  const dy = clamp((y + 0.5 - cy) / ry, -1, 1);
  const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, dx * dx + dy * dy)));
  const light = -0.5 * dx - 0.62 * dy + 0.6 * nz;
  const t = clamp(0.42 + 0.62 * light + bias, 0, 0.999);
  return lo + Math.floor(t * (hi - lo + 1));
}

/** 굵기가 바뀌는 막대(방망이·팔): (x0,y0) 굵기 r0 → (x1,y1) 굵기 r1. 빛은 왼쪽 위에서 — 막대의 왼쪽 위 가장자리가 밝다 */
export function rod(px: Px, x0: number, y0: number, r0: number, x1: number, y1: number, r1: number, ramp: Ramp, lo = 1, hi = ramp.length - 1, keep?: (x: number, y: number) => boolean): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  const len = Math.sqrt(len2);
  // 막대에 수직인 쪽(왼쪽 위를 향하는 쪽이 +)
  let nx = -dy / len;
  let ny = dx / len;
  if (-0.5 * nx - 0.62 * ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  const rMax = Math.max(r0, r1) + 1;
  for (let y = Math.floor(Math.min(y0, y1) - rMax); y <= Math.ceil(Math.max(y0, y1) + rMax); y++) {
    for (let x = Math.floor(Math.min(x0, x1) - rMax); x <= Math.ceil(Math.max(x0, x1) + rMax); x++) {
      const px0 = x + 0.5 - x0;
      const py0 = y + 0.5 - y0;
      const t = clamp((px0 * dx + py0 * dy) / len2, 0, 1);
      const qx = px0 - t * dx;
      const qy = py0 - t * dy;
      const r = r0 + (r1 - r0) * t;
      const d = Math.hypot(qx, qy);
      if (d > r) continue;
      if (keep && !keep(x, y)) continue;
      const s = (qx * nx + qy * ny) / Math.max(0.5, r); // −1 그늘 쪽 ~ 1 볕 쪽
      const v = clamp(0.5 + s * 0.55, 0, 0.999);
      px.set(x, y, ramp[lo + Math.floor(v * (hi - lo + 1))]);
    }
  }
}

// ══ 도깨비 ══════════════════════════════════════════════════════════

export const DOKKAEBI_W = 72;
export const DOKKAEBI_H = 104;
export const DOKKAEBI_AX = 36;
export const DOKKAEBI_AY = 100;
/** 바지의 길이(그림 점) — 사람보다 다리가 길어 키가 커 보인다 */
const LEG = 25;

/** 덥수룩한 털(머리털·턱수염·눈썹·팔다리의 털): 따뜻한 밤빛 */
const FUR = R('#292321', '#45342a', '#5e4a3a', '#775038', '#9d6e4e');
/** 살빛: 볕에 그을린 따뜻한 빛 */
const DSKIN = SKIN.tan;
/** 해진 삼베 저고리 · 잿빛 바지 · 새끼줄 허리띠 */
const JACKET = CLOTH.hemp;
const PANTS = CLOTH.ash;
const ROPE = CLOTH.straw;
/** 방망이: 나무 빛 단계뿐(쇠 빛이 없다) */
export const CLUB_WOOD: Ramp = SPRING.wood;
const EYE_WHITE = hex('#f6f0df');
const PUPIL = hex('#2a2422');
const SHINE = hex('#faf6ec');
const MOUTH = R('#4a3224', '#6a3a26');
const LIP = hex('#b5564d');
const TONGUE = hex('#d59a97');
const TOOTH = R('#dedad2', '#f6f0df');
const CHEEK = mix(DSKIN[2], hex('#e58f7f'), 0.45);

/** 도깨비의 부품(그림 정의 — 시험이 이름을 본다). 뿔·범 가죽·쇠못 같은 부품이 없다 */
export const DOKKAEBI_PARTS = ['mane', 'face', 'eyes', 'brows', 'nose', 'mouth', 'beard', 'jacket', 'belt', 'pants', 'arms', 'hands', 'shins', 'feet', 'club'] as const;

const DOK_RAMPS = indexOf([FUR, DSKIN, JACKET, PANTS, ROPE, CLUB_WOOD, MOUTH, TOOTH]);

export type DokkaebiPose = 'plain' | 'glad';

/** 털의 들쭉날쭉한 끝(아래로 늘어진 가닥 — 0~3 그림 점) */
const tuft = (x: number, seed: number): number => {
  const k = Math.floor(x / 2.5);
  return Math.round(hash2(k, seed, 71) * 2.2 + (k % 2 === 0 ? 1 : 0));
};

interface DokLayers {
  px: Px;
  /** 털로 칠한 점(결을 입힐 자리) */
  fur: Uint8Array;
  /** 방망이만 그린 판(시험이 빛을 본다) */
  club: Px;
}

function drawDokkaebi(pose: DokkaebiPose, frame: number): DokLayers {
  const W = DOKKAEBI_W;
  const H = DOKKAEBI_H;
  const C = 36;
  const px = new Px(W, H);
  const fur = new Uint8Array(W * H);
  const club = new Px(W, H);
  // 숨쉬기: 둘째 장은 윗몸이 한 점 내려앉는다
  const b = frame % 2 === 1 ? 1 : 0;
  const setFur = (x: number, y: number, v: number): void => {
    if (!px.inb(x, y)) return;
    px.set(x, y, FUR[clamp(v, 0, FUR.length - 1)]);
    fur[y * W + x] = 1;
  };
  const glad = pose === 'glad';

  // ── 방망이(나무): 쉬는 모습은 오른손에 늘어뜨려 끝을 땅에 대고, 웃는 모습은 번쩍 치켜든다 ──
  const drawClub = (target: Px): void => {
    if (glad) {
      rod(target, 62, 27 + b, 1.6, 66, 4 + b, 4.2, CLUB_WOOD, 1, 5);
      // 방망이 머리의 둥근 끝과 옹이
      target.set(65, 6 + b, CLUB_WOOD[2]);
      target.set(66, 6 + b, CLUB_WOOD[2]);
    } else {
      rod(target, 60, 67 + b, 1.6, 64, DOKKAEBI_AY - 5.4, 4.4, CLUB_WOOD, 1, 5);
      target.set(63, DOKKAEBI_AY - 9, CLUB_WOOD[2]);
      target.set(64, DOKKAEBI_AY - 9, CLUB_WOOD[2]);
    }
  };
  drawClub(club);
  drawClub(px);

  // ── 바지와 정강이의 털, 맨발(다리가 길어 키가 커 보인다) ──
  const hem = 66 + LEG;
  for (let y = 66; y <= hem; y++) {
    const k = (y - 66) / LEG;
    const bulge = Math.round(Math.sin(Math.PI * Math.min(1, k * 1.15)) * 2);
    for (const side of [-1, 1]) {
      const inner = side < 0 ? C - 1 : C + 1;
      const outer = side < 0 ? C - 14 - bulge : C + 14 + bulge;
      const cuff = y >= hem - 2;
      const a = Math.min(inner, outer) + (cuff ? (side < 0 ? 2 : 0) : 0);
      const e = Math.max(inner, outer) - (cuff ? (side > 0 ? 2 : 0) : 0);
      // 두 다리 사이는 가랑이 아래로 갈라진다
      for (let x = a; x <= e; x++) {
        if (y >= 72 && Math.abs(x - C + 0.5) < 1.5) continue;
        let v = lit(x, y, side < 0 ? C - 7 : C + 7, 66 + LEG * 0.4, 9, LEG * 0.7, 0, 3);
        if (cuff) v = y === hem - 2 ? 3 : 2; // 걷어 올린 바짓단
        if (y < 72 && Math.abs(x - C + 0.5) < 1.5) v = 0; // 가랑이의 그늘
        px.set(x, y, PANTS[v]);
      }
    }
  }
  const foot = DOKKAEBI_AY - 5;
  for (let y = hem + 1; y < foot; y++) {
    for (const [a, e] of [
      [C - 12, C - 5],
      [C + 5, C + 12],
    ] as const) {
      for (let x = a; x <= e; x++) setFur(x, y, lit(x, y, (a + e) / 2, hem + 2, 5, 4, 1, 3));
    }
  }
  for (let y = foot; y < DOKKAEBI_AY; y++) {
    const r = y - foot;
    for (const side of [-1, 1]) {
      const a = side < 0 ? C - 17 + (r === 0 ? 3 : r === 4 ? 1 : 0) : C + 4;
      const e = side < 0 ? C - 4 : C + 16 - (r === 0 ? 3 : r === 4 ? 1 : 0);
      for (let x = a; x <= e; x++) {
        let v = lit(x, y, side < 0 ? C - 11 : C + 10, foot + 1, 8, 4, 0, 3);
        // 발가락의 틈
        if (r === 1 && (x - a) % 3 === 2 && (side < 0 ? x < a + 7 : x > e - 7)) v = 0;
        px.set(x, y, DSKIN[v]);
      }
    }
  }

  // ── 저고리(해진 삼베)와 새끼줄 허리띠 ──
  for (let y = 42 + b; y <= 69; y++) {
    const r = y - (42 + b);
    const hw = r === 0 ? 12 : r === 1 ? 16 : r === 2 ? 18 : y >= 62 ? 20 - Math.round((y - 62) * 0.4) : 20;
    for (let x = C - hw; x <= C - 1 + hw; x++) {
      let v = lit(x, y, C - 3, 50, 24, 20, 0, 3);
      // 해진 아랫단: 들쭉날쭉
      if (y >= 67 && hash2(x >> 1, 3, 41) < (y - 66) * 0.28) continue;
      px.set(x, y, JACKET[v]);
    }
  }
  // 깃: 왼쪽 깃이 오른쪽 아래로 덮인다(사람 틀과 같은 여밈). 깃 사이로 가슴털이 보인다
  for (let k = 0; k <= 13; k++) {
    for (let w = 0; w < 3; w++) px.set(C - 6 + k + w, 42 + b + k, w === 2 ? JACKET[1] : JACKET[3]);
  }
  for (let k = 0; k <= 5; k++) px.set(C + 6 - k, 42 + b + k, JACKET[1]);
  for (let y = 42 + b; y <= 46 + b; y++) for (let x = C - 3 + (y - 42 - b); x <= C + 4 - (y - 42 - b); x++) setFur(x, y, 2);
  // 허리띠(새끼줄): 꼰 결이 비스듬히 보인다
  for (let x = C - 20; x <= C + 19; x++) {
    for (let j = 0; j < 3; j++) {
      const y = 62 + j;
      if (px.get(x, y) === 0) continue;
      px.set(x, y, ROPE[(x + j) % 3 === 0 ? 1 : j === 0 ? 3 : 2]);
    }
  }
  // 매듭과 늘어진 끝
  for (const [x, y, v] of [
    [C - 9, 65, 2],
    [C - 9, 66, 1],
    [C - 8, 66, 2],
    [C - 9, 67, 1],
    [C - 10, 68, 1],
    [C - 8, 68, 2],
  ] as const) px.set(x, y, ROPE[v]);

  // ── 팔: 소매(삼베) → 털 많은 팔뚝 → 큰 손 ──
  const sleeve = (x0: number, y0: number, x1: number, y1: number): void => rod(px, x0, y0, 4.6, x1, y1, 4.2, JACKET, 0, 3);
  const forearm = (x0: number, y0: number, x1: number, y1: number): void => {
    const tmp = new Px(W, H);
    rod(tmp, x0, y0, 3.6, x1, y1, 3.4, FUR, 1, 4);
    for (let i = 0; i < tmp.d.length; i++) {
      if (tmp.d[i] === 0) continue;
      px.d[i] = tmp.d[i];
      fur[i] = 1;
    }
  };
  const handAt = (cx: number, cy: number): void => {
    for (let y = Math.floor(cy - 4.5); y <= Math.ceil(cy + 4.5); y++) {
      for (let x = Math.floor(cx - 5); x <= Math.ceil(cx + 5); x++) {
        const dx = (x + 0.5 - cx) / 4.6;
        const dy = (y + 0.5 - cy) / 4.2;
        if (dx * dx + dy * dy > 1) continue;
        px.set(x, y, DSKIN[lit(x, y, cx, cy, 4.6, 4.2, 0, 3)]);
      }
    }
    // 쥔 손가락의 마디
    for (let k = -2; k <= 2; k += 2) px.set(Math.round(cx + k), Math.round(cy + 1), DSKIN[0]);
  };
  // 왼팔(보는 쪽에서 왼쪽): 늘어뜨린다
  sleeve(C - 18, 46 + b, C - 23, 59 + b);
  forearm(C - 23, 60 + b, C - 24, 70 + b);
  handAt(C - 24, 74 + b);
  if (glad) {
    // 오른팔을 번쩍 들어 방망이를 치켜든다
    sleeve(C + 17, 47 + b, C + 24, 37 + b);
    forearm(C + 25, 36 + b, C + 26, 27 + b);
    handAt(62, 24 + b);
    // 손에 쥔 방망이의 자루가 손 위로 보인다
    rod(px, 62, 20 + b, 1.6, 63, 14 + b, 2.2, CLUB_WOOD, 1, 5);
  } else {
    sleeve(C + 17, 46 + b, C + 22, 59 + b);
    forearm(C + 22, 60 + b, C + 23, 69 + b);
    handAt(C + 24, 72 + b);
  }

  // ── 머리: 덥수룩한 머리털(정수리는 둥글다 — 뾰족이 솟은 데가 없다) → 얼굴 → 앞머리 → 턱수염 ──
  const hy = b;
  const inManeTop = (x: number, y: number): boolean => {
    const dx = (x + 0.5 - C) / 19;
    const dy = (y + 0.5 - (25 + hy)) / 17;
    return dx * dx + dy * dy <= 1;
  };
  for (let y = 6 + hy; y <= 52; y++) {
    for (let x = C - 21; x <= C + 20; x++) {
      const ax = Math.abs(x + 0.5 - C);
      const top = inManeTop(x, y);
      // 어깨까지 늘어진 옆머리(아래 끝은 가닥이 들쭉날쭉)
      const side = y >= 25 + hy && ax >= 10 && ax <= 19.5 - (y - 25 - hy) * 0.12 && y <= 46 + hy + tuft(x, 1);
      if (!top && !side) continue;
      setFur(x, y, lit(x, y, C - 2, 22 + hy, 22, 20, 0, 4, -0.24));
    }
  }
  // 얼굴
  const fcy = 28 + hy;
  for (let y = 15 + hy; y <= 41 + hy; y++) {
    for (let x = C - 13; x <= C + 12; x++) {
      const dx = (x + 0.5 - C) / 12;
      const dy = (y + 0.5 - fcy) / 12.5;
      if (dx * dx + dy * dy > 1) continue;
      px.set(x, y, DSKIN[lit(x, y, C - 2, fcy - 2, 13, 13, 0, 3)]);
      fur[y * W + x] = 0;
    }
  }
  // 앞머리: 이마를 덮고 가닥 끝이 물결진다
  for (let x = C - 13; x <= C + 12; x++) {
    const edge = 19 + hy + Math.round(Math.sin((x - C) * 0.9) * 0.8) + (Math.abs(x + 0.5 - C) > 9 ? 3 : 0) + (Math.abs(x + 0.5 - C) > 11 ? 3 : 0);
    for (let y = 12 + hy; y <= edge; y++) if (px.get(x, y) !== 0 || inManeTop(x, y)) setFur(x, y, lit(x, y, C - 2, 14 + hy, 18, 10, 0, 4, -0.2));
  }
  // 눈(동그란 흰자와 위를 보는 눈동자) 또는 웃어 감은 눈(∩)
  const eyes = [C - 6, C + 4];
  for (const ex of eyes) {
    const ey = 23 + hy;
    if (glad) {
      for (const [dx, dy] of [
        [0, 2],
        [1, 1],
        [2, 0],
        [3, 0],
        [4, 1],
        [5, 2],
      ] as const) {
        px.set(ex - 1 + dx, ey + dy, FUR[0]);
      }
    } else {
      for (let j = 0; j < 5; j++) {
        for (let i = 0; i < 4; i++) {
          if ((j === 0 || j === 4) && (i === 0 || i === 3)) continue;
          px.set(ex + i, ey + j, EYE_WHITE);
        }
      }
      for (let j = 1; j <= 3; j++) for (let i = 1; i <= 2; i++) px.set(ex + i, ey + j, PUPIL);
      px.set(ex + 1, ey + 1, SHINE);
      // 눈 아래 흰자의 그늘(오른쪽 아래)
      px.set(ex + 3, ey + 3, TOOTH[0]);
    }
  }
  // 눈썹: 짙고 숱이 많으며 바깥 끝이 처진다(사나워 보이지 않게)
  for (const [ex, dir] of [
    [C - 6, -1],
    [C + 4, 1],
  ] as const) {
    for (let k = -1; k <= 5; k++) {
      const x = ex + k;
      const outer = dir < 0 ? k <= 0 : k >= 4;
      const y = 19 + hy + (outer ? 1 : 0);
      setFur(x, y, 3);
      setFur(x, y + 1, outer ? 2 : 1);
    }
  }
  // 뭉툭한 코
  for (let y = 26 + hy; y <= 32 + hy; y++) {
    for (let x = C - 5; x <= C + 4; x++) {
      const dx = (x + 0.5 - C) / 4;
      const dy = (y + 0.5 - (29.5 + hy)) / 3.2;
      if (dx * dx + dy * dy > 1) continue;
      px.set(x, y, DSKIN[lit(x, y, C, 29.5 + hy, 4, 3.2, 0, 3, 0.05)]);
    }
  }
  px.set(C - 2, 31 + hy, DSKIN[0]);
  px.set(C + 1, 31 + hy, DSKIN[0]);
  // 볼의 불그레한 기
  for (const x of [C - 10, C - 9, C + 8, C + 9]) px.set(x, 31 + hy, CHEEK);
  // 턱수염: 턱과 뺨 아래를 덮고 가닥 끝이 늘어진다(입은 가리지 않는다)
  for (let y = 33 + hy; y <= 50; y++) {
    for (let x = C - 14; x <= C + 13; x++) {
      const dx = (x + 0.5 - C) / 14;
      const dy = (y + 0.5 - (38 + hy)) / 9;
      if (dx * dx + dy * dy > 1 && !(y >= 38 + hy && Math.abs(dx) <= 0.95 && y <= 45 + hy + tuft(x, 2))) continue;
      if (y > 45 + hy + tuft(x, 2)) continue;
      // 입 둘레는 비운다
      if (y <= 39 + hy && Math.abs(x + 0.5 - C) < 8 - Math.max(0, y - 36 - hy)) continue;
      setFur(x, y, lit(x, y, C - 2, 36 + hy, 16, 12, 0, 4, -0.26));
    }
  }
  // 입: 쉬는 모습은 큰 앞니 두 개가 보이는 웃음, 웃는 모습은 크게 벌려 껄껄 웃는다
  const my = 34 + hy;
  if (glad) {
    const rows = [
      [-6, 5],
      [-6, 5],
      [-5, 4],
      [-5, 4],
      [-4, 3],
      [-3, 2],
    ] as const;
    rows.forEach(([a, e], j) => {
      for (let x = C + a; x <= C + e; x++) px.set(x, my - 1 + j, MOUTH[j < 2 ? 0 : 1]);
    });
    for (let x = C - 3; x <= C + 2; x++) px.set(x, my + 3, TONGUE);
    for (let x = C - 2; x <= C + 1; x++) px.set(x, my + 4, TONGUE);
    for (const x of [C - 2, C - 1, C + 1, C + 2]) {
      px.set(x, my - 1, TOOTH[1]);
      px.set(x, my, TOOTH[x === C - 1 || x === C + 2 ? 0 : 1]);
    }
  } else {
    for (let x = C - 5; x <= C + 4; x++) px.set(x, my, MOUTH[0]);
    px.set(C - 6, my - 1, MOUTH[0]);
    px.set(C + 5, my - 1, MOUTH[0]);
    for (let x = C - 4; x <= C + 3; x++) px.set(x, my + 1, MOUTH[1]);
    for (let x = C - 3; x <= C + 2; x++) px.set(x, my + 2, LIP);
    for (const x of [C - 2, C - 1, C + 1, C + 2]) {
      px.set(x, my, TOOTH[1]);
      px.set(x, my + 1, TOOTH[x === C - 1 || x === C + 2 ? 0 : 1]);
    }
  }
  return { px, fur, club };
}

/**
 * 도깨비 한 장(72×96 그림 점, 발치 (36, 92)). pose 'plain'(숨쉬기 두 장) · 'glad'(웃으며 방망이를 치켜든 두 장). frame은 숨쉬기의 0·1.
 * snap을 주면 그 벌에 맞춘다(주지 않으면 봄 벌에 맞추지 않은 그림 — 시험이 방망이의 빛을 볼 때).
 */
export function dokkaebiFrame(pose: DokkaebiPose, frame: number, snap?: Snapper): Px {
  const { px, fur } = drawDokkaebi(pose, frame);
  // 털의 결: 결 방향(아래로)으로 길게 늘인 결이 이웃 단계로만 오르내린다
  watercolor(px, DOK_RAMPS, 141, { big: 6, bigY: 9, amp: 1.2, fine: 0.5, streak: [1.3, 5, 2.4], up: 0.3, down: 0.34, keep: (x, y) => fur[y * DOKKAEBI_W + x] === 1 });
  // 삼베의 결(때 없이 — 어둡게 옮기는 문턱이 높다)
  watercolor(px, DOK_RAMPS, 142, { big: 7, bigY: 5, amp: 1.1, fine: 0.6, up: 0.3, down: 0.5, keep: (x, y) => fur[y * DOKKAEBI_W + x] === 0 && y > 40 });
  softOutline(px, DOK_RAMPS, 0.68);
  calmSprite(px);
  return snap ? snap.apply(px) : px;
}

/** 도깨비의 방망이만(시험: 나무 빛 단계뿐인가 — 벌에 맞추기 전) */
export function dokkaebiClub(pose: DokkaebiPose, frame = 0): Px {
  return drawDokkaebi(pose, frame).club;
}

// ══ 굳은 논흙 ═══════════════════════════════════════════════════════

export const SOIL_W = 96;
export const SOIL_H = 64;
export const SOIL_AX = 48;
export const SOIL_AY = 60;
/** 금이 느는 단계의 수(기운 1 → 0). 기운이 0이면 다 풀린 흙(SOIL_STAGES번째) */
export const SOIL_STAGES = 5;
/** 맞을 때 흙이 부서지는 장 수 */
export const SOIL_BREAK_FRAMES = 3;

/** 흙덩이: 짙은 갈아엎은 흙(SOIL) → 볕에 마른 흙길 빛(PATH) — 위쪽이 볕에 바래 밝다 */
const CLOD: Ramp = [...SPRING.soil, SPRING.path[2], SPRING.path[3], SPRING.path[4]];
/** 논바닥의 젖은 흙(흙덩이 밑의 그늘진 자리) */
const MUD: Ramp = SPRING.mud;
const SOIL_RAMPS = indexOf([CLOD, MUD]);

/** 굳은 논흙의 부품(시험이 본다 — 눈·입이 없다) */
export const SOIL_PARTS = ['mud', 'clod', 'cracks', 'crumbs', 'chips'] as const;

/** 흙덩이의 꼴(그림 점의 다각형 — 왼쪽 아래에서 시계 방향): 위가 넓적하게 굳은 흙판이고 옆은 비탈져 논바닥에 앉는다 */
const CLOD_SHAPE: readonly (readonly [number, number])[] = [
  [6, 56],
  [9, 50],
  [12, 44],
  [16, 37.5],
  [20, 32],
  [26, 27.5],
  [34, 24],
  [44, 22.5],
  [55, 22.5],
  [64, 24],
  [72, 27],
  [78, 31],
  [82.5, 36.5],
  [86, 43],
  [88.5, 50],
  [91, 56],
  [86, 58.5],
  [48, 59.5],
  [10, 58.5],
];
/** 볕에 굳은 윗면(흙판)의 둘레: 가운데와 반지름 */
const CRUST = { cx: 49, cy: 30.5, rx: 30, ry: 7.5 } as const;

export function inPoly(pts: readonly (readonly [number, number])[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** 금 하나: 이어진 점들(그림 점). 앞의 것부터 단계마다 늘어난다 — 윗면의 흙판을 조각내고 옆 비탈로 흘러내린다 */
const CRACKS: readonly (readonly (readonly [number, number])[])[] = [
  [
    [36, 25],
    [40, 29],
    [38, 33],
    [41, 37],
    [40, 43],
  ],
  [
    [60, 24],
    [57, 28],
    [61, 32],
    [60, 37],
  ],
  [
    [40, 29],
    [47, 30],
    [52, 28],
    [57, 28],
  ],
  [
    [22, 32],
    [27, 34],
    [31, 38],
    [29, 44],
    [31, 50],
  ],
  [
    [61, 32],
    [68, 33],
    [74, 32],
  ],
  [
    [74, 32],
    [77, 38],
    [76, 45],
    [79, 51],
  ],
  [
    [47, 30],
    [48, 35],
    [52, 37],
    [53, 44],
  ],
  [
    [27, 34],
    [33, 31],
    [38, 33],
  ],
  [
    [60, 37],
    [64, 42],
    [63, 49],
  ],
  [
    [41, 37],
    [46, 41],
    [53, 44],
    [57, 49],
  ],
  [
    [16, 42],
    [21, 45],
    [20, 51],
  ],
  [
    [68, 33],
    [69, 25],
  ],
];

/** 단계마다 금의 수와 넓게 벌어진 금(두 점 굵기)의 수 */
const CRACKS_AT = [3, 5, 7, 9, 12];
const WIDE_AT = [0, 1, 2, 4, 6];

/** 밑의 젖은 흙(논바닥에 앉은 자리) */
function mudBase(px: Px): void {
  for (let y = 50; y <= 62; y++) {
    for (let x = 2; x <= 94; x++) {
      const dx = (x + 0.5 - 48) / 46;
      const dy = (y + 0.5 - 57) / 5.5;
      if (dx * dx + dy * dy > 1) continue;
      px.set(x, y, MUD[lit(x, y, 44, 54, 46, 7, 0, 2)]);
    }
  }
}

function clodMask(stage: number): Px {
  const px = new Px(SOIL_W, SOIL_H);
  mudBase(px);
  for (let y = 18; y <= 60; y++) {
    for (let x = 2; x <= 94; x++) {
      // 둘레가 자로 잰 듯하지 않게(굳은 흙의 울퉁불퉁함)
      const jx = x + 0.5 + (vnoise(x / 2.6, y / 2.6, 17) - 0.5) * 2.2;
      const jy = y + 0.5 + (vnoise(x / 2.6, y / 2.6, 18) - 0.5) * 1.6;
      if (!inPoly(CLOD_SHAPE, jx, jy)) continue;
      // 금이 많이 간 단계: 귀퉁이가 떨어져 나간 자리
      if (stage >= 3 && (x - 84) ** 2 / 30 + (y - 40) ** 2 / 40 < 1) continue;
      if (stage >= 4 && (x - 13) ** 2 / 26 + (y - 44) ** 2 / 30 < 1) continue;
      const cx = (x + 0.5 - CRUST.cx) / CRUST.rx;
      const cy = (y + 0.5 - CRUST.cy) / CRUST.ry;
      const top = cx * cx + cy * cy;
      let v: number;
      if (top <= 1) {
        // 볕에 바랜 윗면: 왼쪽 위가 가장 밝다
        v = top > 0.78 && cy > 0 ? 6 : lit(x, y, CRUST.cx - 6, CRUST.cy - 3, CRUST.rx, CRUST.ry * 2.2, 5, 7);
      } else {
        // 옆 비탈: 왼쪽이 볕, 오른쪽은 그늘이고 아래로 갈수록 짙다. 흙이 쌓인 결이 가로로 지나간다
        const t = 0.62 - (x + 0.5 - 46) / 70 - (y + 0.5 - 36) / 46 + (vnoise(x / 9, y / 1.8, 29) - 0.5) * 0.12;
        v = 1 + Math.floor(clamp(t, 0, 0.999) * 5);
      }
      px.set(x, y, CLOD[v]);
    }
  }
  return px;
}

/** 금 하나를 긋는다: 금 안은 짙고(그늘), 금의 아래쪽 가장자리는 볕을 받아 밝다. wide면 두 점 굵기 */
function crack(px: Px, pts: readonly (readonly [number, number])[], wide: boolean, seed: number): void {
  for (let k = 0; k + 1 < pts.length; k++) {
    const [x0, y0] = pts[k];
    const [x1, y1] = pts[k + 1];
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) {
      const t = n === 0 ? 0 : i / n;
      const x = Math.round(x0 + (x1 - x0) * t + (hash2(k * 31 + i, seed, 5) - 0.5) * 0.9);
      const y = Math.round(y0 + (y1 - y0) * t);
      if (px.get(x, y) === 0) continue;
      px.set(x, y, CLOD[0]);
      if (wide) px.set(x + 1, y, CLOD[1]);
      // 금의 아래 가장자리(볕 쪽)
      const below = px.get(x, y + 1);
      if (below !== 0 && below !== CLOD[0] && below !== CLOD[1]) px.set(x, y + 1, CLOD[Math.min(CLOD.length - 1, CLOD.indexOf(below) + 1)] ?? below);
    }
  }
}

/** 흙 부스러기 하나(둥근 작은 덩이 — 두 점 이상) */
function crumb(px: Px, cx: number, cy: number, rx: number, ry: number): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      px.set(x, y, CLOD[lit(x, y, cx, cy, rx, ry, 1, CLOD.length - 2)]);
    }
  }
}

/**
 * 굳은 흙의 결(이웃 단계로만 — 때 없이). 가장 짙은 단계(CLOD[0])는 금에만 쓴다: 결이 거기까지 내려가면 한 칸 올린다
 * (흙덩이 위의 짙은 얼룩이 눈·입처럼 보이지 않게). 그래서 결은 금을 긋기 전에 입힌다.
 */
function soilTexture(px: Px, seed: number): void {
  watercolor(px, SOIL_RAMPS, seed, { big: 6, bigY: 4.5, amp: 1.4, fine: 0.7, up: 0.3, down: 0.46 });
  for (let i = 0; i < px.d.length; i++) if (px.d[i] === CLOD[0]) px.d[i] = CLOD[1];
}

function finishSoil(px: Px): Px {
  selfRim(px, SOIL_RAMPS);
  calmSprite(px);
  return px;
}

const soilCache = new Map<string, Px>();

/** 금이 stage(0~SOIL_STAGES−1)만큼 간 흙덩이. stage가 SOIL_STAGES면 다 풀려 낮게 흩어진 흙 */
function soilBase(stage: number): Px {
  if (stage >= SOIL_STAGES) {
    const px = new Px(SOIL_W, SOIL_H);
    // 논바닥에 고르게 풀린 흙: 낮은 흙더미와 부스러기들
    mudBase(px);
    for (let y = 44; y <= 58; y++) {
      for (let x = 14; x <= 82; x++) {
        const dx = (x + 0.5 - 48) / 34;
        const dy = (y + 0.5 - 54) / 6;
        if (dx * dx + dy * dy > 1 + (vnoise(x / 2.5, y / 2.5, 23) - 0.5) * 0.5) continue;
        px.set(x, y, CLOD[lit(x, y, 44, 50, 34, 8, 1, 5)]);
      }
    }
    const rnd = (k: number): number => hash2(k, 7, 99);
    for (let k = 0; k < 16; k++) crumb(px, 16 + rnd(k) * 64, 47 + rnd(k + 40) * 9, 2 + rnd(k + 80) * 1.6, 1.6 + rnd(k + 120) * 1.1);
    soilTexture(px, 230);
    return finishSoil(px);
  }
  const px = clodMask(stage);
  soilTexture(px, 210 + stage);
  const n = CRACKS_AT[stage];
  const wide = WIDE_AT[stage];
  for (let i = 0; i < n; i++) crack(px, CRACKS[i], i < wide, i);
  // 금이 많이 간 단계: 갈라진 금 곁에 떨어져 나온 작은 덩이
  if (stage >= 3) {
    crumb(px, 20, 53, 3, 2.2);
    crumb(px, 78, 54, 2.6, 2);
  }
  if (stage >= 4) {
    crumb(px, 12, 55, 2.4, 1.8);
    crumb(px, 85, 52, 2.2, 1.7);
    crumb(px, 64, 56, 2.4, 1.8);
  }
  return finishSoil(px);
}

/** 기운의 몫(1 → 0)에 맞는 단계: 0(금이 적다) ~ SOIL_STAGES−1(금이 가장 많다), 0 이하면 SOIL_STAGES(다 풀림) */
export function soilStage(left: number): number {
  if (!(left > 0)) return SOIL_STAGES;
  return clamp(Math.floor((1 - Math.min(1, left)) * SOIL_STAGES), 0, SOIL_STAGES - 1);
}

/** 굳은 논흙 한 장(96×64 그림 점, 발치 (48, 60)) — 그 단계의 흙덩이. snap을 주면 그 벌에 맞춘다 */
export function soilFrame(stage: number, snap?: Snapper): Px {
  const key = `s${stage}`;
  let px = soilCache.get(key);
  if (!px) {
    px = soilBase(clamp(Math.round(stage), 0, SOIL_STAGES));
    soilCache.set(key, px);
  }
  const out = px.clone();
  return snap ? snap.apply(out) : out;
}

/**
 * 맞을 때 흙이 부서지는 장(f = 0·1·2): 흙덩이 위에서 조각 셋과 부스러기가 튀어 올랐다가(0) 퍼지며(1) 떨어진다(2).
 * 흙덩이 자체는 흔들지 않고 번쩍이지 않는다(spec 8.6) — 조각이 튀어 나간 자리만 갓 부서진 흙빛으로 밝다.
 */
export function soilBreak(stage: number, f: number, snap?: Snapper): Px {
  const s = clamp(Math.round(stage), 0, SOIL_STAGES);
  const key = `b${s}:${f}`;
  let px = soilCache.get(key);
  if (!px) {
    px = soilFrame(s).clone();
    const k = clamp(Math.round(f), 0, SOIL_BREAK_FRAMES - 1);
    // 갓 부서진 자리(볕에 바래지 않은 속흙 — 한 단계 짙다)
    if (s < SOIL_STAGES) {
      for (let y = 25; y <= 29; y++) {
        for (let x = 60; x <= 66; x++) {
          const c = px.get(x, y);
          if (c === 0) continue;
          const i = CLOD.indexOf(c);
          if (i > 1 && (x - 63) ** 2 / 9 + (y - 27) ** 2 / 4 <= 1) px.set(x, y, CLOD[i - 1]);
        }
      }
    }
    // 튀는 조각: 오른쪽 위로 튀어 올랐다가 떨어지는 길(그림 점)
    const chips: readonly (readonly [number, number, number, number][])[] = [
      [
        [64, 20, 2.6, 2],
        [70, 23, 2.2, 1.7],
        [57, 21, 2, 1.6],
      ],
      [
        [70, 12, 2.4, 1.9],
        [79, 18, 2, 1.6],
        [55, 13, 1.8, 1.5],
      ],
      [
        [75, 20, 2.2, 1.7],
        [86, 30, 1.8, 1.5],
        [51, 18, 1.7, 1.4],
      ],
    ];
    for (const [cx, cy, rx, ry] of chips[k]) crumb(px, cx, cy, rx, ry);
    // 흙먼지(엷은 흙빛의 두 점 무리) — 첫 장에 많고 차츰 준다
    const dust: readonly (readonly [number, number][])[] = [
      [
        [60, 18],
        [67, 17],
        [72, 21],
        [54, 19],
      ],
      [
        [63, 10],
        [74, 14],
        [83, 22],
      ],
      [
        [80, 26],
        [58, 14],
      ],
    ];
    for (const [x, y] of dust[k]) {
      px.set(x, y, CLOD[6]);
      px.set(x + 1, y, CLOD[6]);
    }
    calmSprite(px);
    soilCache.set(key, px);
  }
  const out = px.clone();
  return snap ? snap.apply(out) : out;
}

/** 시험이 쓰는 것: 흙덩이·도깨비가 쓰는 빛의 단계 */
export const SOIL_RAMP_LIST: readonly Ramp[] = [CLOD, MUD];
export const DOKKAEBI_RAMP_LIST: readonly Ramp[] = [FUR, DSKIN, JACKET, PANTS, ROPE, CLUB_WOOD, MOUTH, TOOTH];
export { WARM_DARK };
