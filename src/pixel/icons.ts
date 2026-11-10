// 4-1의 작은 그림(spec 4.7.3·4.7.4, 11.1 마의 "카드 열·장비 셋·유물 하나"). 글자가 없는 작은 도트다.
//
//   솜씨 카드 열(32×32): 논둑 쌓기 · 짐 나르기 · 쌀과 베로 셈하기 · 나라 몫 셈하기 · 흙덩이 깨기 · 이웃 부르기 · 서로 거들기 · 곡식 보태기 ·
//                       볍씨 고루 뿌리기 · 나무하기 (글은 src/content/skills.ts)
//   유물(32×32): 볍씨 자루 · 장비(32×32): 호미 · 낫 · 도리깨 · 맨손(빈손)
//   갈래 표시 넷(16×16) — 색만이 아니라 꼴로도 가른다: 힘 = 쥔 주먹, 지혜 = 끈으로 묶은 두루마리, 솜씨 = 나무 메(망치),
//                       어울림 = 나란히 선 두 사람. 넷의 바깥 꼴(윤곽)이 서로 달라 빛깔을 지운 밝기만으로도 가려진다(시험이 본다).
//   고비의 할 일 표시(24×24 — src/content/foes.ts의 FoeMove.icon): 볕에 굳는 흙(해와 갈라진 흙판) · 엉긴 흙덩이 · 수수께끼(말풍선 속 소용돌이) ·
//                       씨름(샅바 — 허리와 다리에 감는 천 고리) · 일 겨루기(엇걸린 호미와 낫)
//   도깨비의 방패 칸(16×16): 도깨비불(켜진 불 — 푸른빛 불꽃) · 꺼진 자리(속이 빈 잿빛 고리와 엷은 연기)
//
// 그 시대에 있던 것만 그린다(엽전·종이돈이 없다 — 값은 쌀 자루와 베 필로). 남의 게임·지도서·교과서의 그림을 흉내 내지 않는다.
// 칠(spec 4.7.5): 빛은 왼쪽 위 하나, 먹빛 테두리를 쓰지 않고 가장자리는 제 빛깔로 가른다(ㄴ — wash.ts의 selfRim), 대비 큰 외톨이 점을 고른다(ㄹ),
// 마지막에 봄 벌에 맞춘다(ㅇ).

import { CLOTH, HAIR, SKIN, paletteOf, type Ramp } from './palette';
import { Px, hex, type Color } from './px';
import { snapperOf } from './ground';
import { inPoly, lit, rod } from './foes41';
import { calmSprite, rampsOf, selfRim, type RampIndex } from './wash';

const R = (...list: string[]): Ramp => list.map((s) => hex(s));
const SPRING = paletteOf('spring');

const WOOD = SPRING.wood;
const STRAW = SPRING.thatch;
const SOIL: Ramp = [...SPRING.soil, SPRING.path[2], SPRING.path[3], SPRING.path[4]];
const MUD = SPRING.mud;
const WATER = SPRING.paddy;
const FLAME = SPRING.water;
const GRASS = SPRING.grass;
const STONE = SPRING.stone;
const IRON: Ramp = STONE.slice(0, 5);
const GOLD = SPRING.yellow;
const SKINR = SKIN.fair;
const HEMP = CLOTH.hemp;
const COTTON = CLOTH.cotton;
const INDIGO = CLOTH.indigo;
const MADDER = CLOTH.madder;
const JADE = CLOTH.jade;
const ROSE = CLOTH.rose;
/** 흰쌀(찧은 쌀) */
const RICE = R('#bcb8ae', '#dedad2', '#f4eedd', '#f9f6ef');
/** 볍씨(껍질 있는 벼 낟알 — 누런 금빛) */
const SEED = R('#8a6424', '#b0892a', '#d8b53d', '#f2dc74');
/** 박(바가지) */
const GOURD = R('#978568', '#c9a77c', '#e1ba8f', '#efcea4');

const RAMPS: RampIndex = rampsOf(SPRING, [RICE, SEED, GOURD, SOIL, IRON]);

type Draw = (px: Px) => void;

/** 타원(빛은 왼쪽 위 — 단계 lo~hi) */
function oval(px: Px, cx: number, cy: number, rx: number, ry: number, ramp: Ramp, lo = 0, hi = ramp.length - 1, bias = 0, keep?: (x: number, y: number) => boolean): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      if (keep && !keep(x, y)) continue;
      px.set(x, y, ramp[lit(x, y, cx, cy, rx, ry, lo, hi, bias)]);
    }
  }
}

/** 다각형(빛은 왼쪽 위 — 둘레 네모를 덩어리로 보고 단계를 고른다) */
function poly(px: Px, pts: readonly (readonly [number, number])[], ramp: Ramp, lo = 0, hi = ramp.length - 1, bias = 0): void {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.floor(Math.min(...xs));
  const x1 = Math.ceil(Math.max(...xs));
  const y0 = Math.floor(Math.min(...ys));
  const y1 = Math.ceil(Math.max(...ys));
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!inPoly(pts, x + 0.5, y + 0.5)) continue;
      px.set(x, y, ramp[lit(x, y, cx, cy, (x1 - x0) / 2 + 1, (y1 - y0) / 2 + 1, lo, hi, bias)]);
    }
  }
}

/** 낟알 하나(같은 빛 두 점 — 대비 큰 외톨이 점이 되지 않게) */
function grain(px: Px, x: number, y: number, ramp: Ramp, upright = false): void {
  const c = ramp[ramp.length - 1];
  px.set(x, y, c);
  if (upright) px.set(x, y + 1, c);
  else px.set(x + 1, y, c);
}

/**
 * 짚·싸리로 엮은 결(소쿠리·섬): along 'x'면 가로로 엮은 띠(소쿠리), 'y'면 세로로 선 짚 가닥(섬). 이웃 단계로만 한 칸 짙어진다(체크무늬가 아니다).
 */
function weave(px: Px, x0: number, y0: number, x1: number, y1: number, ramp: Ramp, along: 'x' | 'y'): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const c = px.get(x, y);
      const i = ramp.indexOf(c);
      if (i <= 0) continue;
      const line = along === 'x' ? (y - y0) % 3 === 2 : (x - x0) % 3 === 2;
      if (line) px.set(x, y, ramp[i - 1]);
    }
  }
}

// ── 솜씨 카드 ────────────────────────────────────────────────────

const bund: Draw = (px) => {
  // 논바닥
  for (let y = 27; y <= 30; y++) for (let x = 1; x <= 30; x++) px.set(x, y, MUD[y === 27 ? 2 : y === 30 ? 0 : 1]);
  // 둑 안쪽에 가둔 논물(하늘이 비친다)
  for (let y = 17; y <= 26; y++) {
    for (let x = 1; x <= 15; x++) {
      let v = y < 19 ? 4 : y > 24 ? 2 : 3;
      if ((y === 20 && x >= 3 && x <= 7) || (y === 23 && x >= 6 && x <= 11)) v = 5;
      px.set(x, y, WATER[v]);
    }
  }
  // 흙으로 쌓은 둑: 윗면은 볕을 받고 옆은 비탈진다
  poly(
    px,
    [
      [8, 28],
      [11, 16],
      [14, 12.5],
      [22, 11.5],
      [27, 13],
      [30, 18],
      [31, 28],
    ],
    SOIL,
    1,
    7,
    0.06,
  );
  // 둑 위의 풀
  for (const [x, y, h] of [
    [13, 12, 2],
    [16, 11, 3],
    [19, 11, 2],
    [22, 10, 3],
    [25, 12, 2],
  ] as const) {
    for (let k = 0; k < h; k++) {
      px.set(x, y - k, GRASS[k === h - 1 ? 5 : 3]);
      px.set(x + 1, y - k + 1, GRASS[2]);
    }
  }
  for (let x = 13; x <= 27; x++) if (px.get(x, 13) !== 0) px.set(x, 13, GRASS[x < 20 ? 4 : 3]);
};

const carry: Draw = (px) => {
  // 지게(옆에서): 등에 대는 긴 기둥, 뒤로 뻗은 가지 위에 얹은 짚단, 어깨에 메는 멜빵, 세워 두는 작대기
  oval(px, 19.5, 11.5, 8, 8.5, STRAW, 1, 6, 0.05);
  // 짚단의 결(세로 가닥)과 묶은 새끼줄
  weave(px, 11, 3, 28, 20, STRAW, 'y');
  for (let y = 3; y <= 20; y++) if (px.get(19, y) !== 0) px.set(19, y, WOOD[2]);
  for (let x = 11; x <= 28; x++) if (px.get(x, 12) !== 0) px.set(x, 12, WOOD[2]);
  // 기둥 둘(앞뒤로 겹쳐 보인다)과 가로대
  rod(px, 9, 30, 1.6, 8, 2, 1.4, WOOD, 1, 5);
  rod(px, 12, 30, 1.3, 11, 4, 1.2, WOOD, 1, 4);
  rod(px, 8, 9, 1, 12, 9, 1, WOOD, 1, 4);
  // 짚단을 받친 가지
  rod(px, 10, 21, 1.4, 26, 18.5, 1.3, WOOD, 1, 5);
  // 멜빵(짚으로 꼰 끈)
  for (const [x, y] of [
    [7, 6],
    [6, 8],
    [5, 11],
    [5, 14],
    [6, 17],
    [7, 20],
    [8, 22],
  ] as const) {
    px.set(x, y, STRAW[3]);
    px.set(x, y + 1, STRAW[2]);
  }
  // 세워 두는 작대기(끝이 두 갈래)
  rod(px, 28, 30, 1.1, 24, 19, 1, WOOD, 1, 4);
  rod(px, 24.5, 20.5, 0.9, 23, 17.5, 0.9, WOOD, 2, 4);
  rod(px, 24.5, 20.5, 0.9, 27, 18, 0.9, WOOD, 2, 4);
};

const reckon: Draw = (px) => {
  // 쌀 섬(짚으로 엮은 섬 — 새끼줄 세 줄)
  oval(px, 9.5, 18.5, 7, 10, STRAW, 1, 6, 0.04);
  weave(px, 3, 9, 16, 28, STRAW, 'y');
  for (const y of [12, 18, 24]) for (let x = 2; x <= 17; x++) if (px.get(x, y) !== 0) px.set(x, y, WOOD[x < 8 ? 3 : 2]);
  // 섬 꼭지의 묶음
  oval(px, 9.5, 7.5, 2.4, 2, STRAW, 2, 5);
  // 베 필: 접어 쌓은 삼베 세 겹
  for (const [y0, w] of [
    [24, 13],
    [20, 12],
    [16, 11],
  ] as const) {
    for (let y = y0; y <= y0 + 3; y++) {
      for (let x = 30 - w; x <= 30; x++) {
        let v = y === y0 ? 3 : y === y0 + 3 ? 0 : x <= 31 - w + 1 ? 3 : 2;
        if (x === 30 && y > y0) v = 1;
        px.set(x, y, HEMP[v]);
      }
    }
  }
  // 흘린 쌀 몇 알
  grain(px, 4, 29, RICE);
  grain(px, 8, 30, RICE);
};

const tithe: Draw = (px) => {
  // 나무 말(곡식을 되는 네모난 그릇): 앞면은 위가 조금 넓다
  poly(
    px,
    [
      [5, 15],
      [27, 15],
      [25, 29],
      [7, 29],
    ],
    WOOD,
    1,
    5,
  );
  // 널빤지의 이음매와 테
  for (let y = 16; y <= 28; y++) {
    for (const x of [12, 19]) if (px.get(x, y) !== 0) px.set(x, y, WOOD[2]);
  }
  for (let x = 6; x <= 26; x++) {
    if (px.get(x, 21) !== 0) px.set(x, 21, WOOD[1]);
    if (px.get(x, 22) !== 0) px.set(x, 22, WOOD[4]);
  }
  // 수북이 담은 쌀(나라에 낼 몫)
  oval(px, 16, 15, 11.5, 7, RICE, 0, 3, 0.1, (_x, y) => y <= 16);
  for (let y = 9; y <= 15; y++) for (let x = 6; x <= 26; x++) if (px.get(x, y) === RICE[2] && (x + y * 2) % 5 === 0) px.set(x, y, RICE[3]);
  // 그릇의 윗테(쌀 아래로 보이는 앞 테)
  for (let x = 5; x <= 27; x++) px.set(x, 16, WOOD[x < 16 ? 5 : 4]);
};

const soil: Draw = (px) => {
  // 굳은 흙덩이
  oval(px, 11, 24, 9.5, 6, SOIL, 1, 7, 0.04);
  for (const [x, y] of [
    [8, 21],
    [9, 22],
    [10, 23],
    [11, 23],
    [12, 24],
    [13, 26],
    [13, 25],
    [6, 25],
    [7, 24],
  ] as const) {
    px.set(x, y, SOIL[0]);
  }
  // 곰방메(흙덩이를 깨는 나무 메): 굵은 메통과 긴 자루
  rod(px, 18, 14, 1.3, 27, 2, 1.3, WOOD, 1, 5);
  rod(px, 13, 11, 3.6, 22, 17, 3.6, WOOD, 1, 5);
  // 메통의 마구리(나뭇결의 테)
  oval(px, 13.5, 11.5, 2.2, 2.6, WOOD, 3, 5);
  // 튀는 흙 조각
  oval(px, 4.5, 15.5, 1.6, 1.4, SOIL, 2, 6);
  oval(px, 8.5, 13.5, 1.4, 1.2, SOIL, 2, 6);
  oval(px, 23.5, 24.5, 1.6, 1.4, SOIL, 2, 6);
};

const call: Draw = (px) => {
  // 손을 입가에 모으고 부르는 사람(어깨 위까지)
  oval(px, 10, 26, 9, 6.5, HEMP, 0, 3, 0, (_x, y) => y <= 30);
  oval(px, 10, 12.5, 5.5, 6, SKINR, 0, 3);
  // 머리와 정수리의 상투
  oval(px, 10, 9.5, 6, 4.6, HAIR.black, 0, 3, 0.1, (_x, y) => y <= 10);
  for (let y = 8; y <= 13; y++) px.set(4, y, HAIR.black[1]);
  oval(px, 9.5, 4, 2.2, 2, HAIR.black, 0, 3);
  // 눈과 입
  px.set(12, 13, HAIR.black[0]);
  px.set(12, 14, HAIR.black[0]);
  // 입가에 모은 손
  oval(px, 16, 16, 2.6, 3.2, SKINR, 0, 3);
  // 퍼져 나가는 소리(세 겹의 둥근 줄)
  for (const r of [5, 8.5, 12]) {
    for (let a = -0.75; a <= 0.75; a += 0.05) {
      const x = Math.round(17 + Math.cos(a) * r);
      const y = Math.round(15 + Math.sin(a) * r);
      px.set(x, y, GOLD[2]);
      px.set(x + 1, y, GOLD[1]);
    }
  }
};

const help: Draw = (px) => {
  // 두 사람이 양쪽에서 함께 든 소쿠리
  oval(px, 16, 17, 11, 8, STRAW, 1, 4, -0.05, (_x, y) => y >= 15);
  weave(px, 5, 17, 27, 25, STRAW, 'x');
  // 소쿠리에 담은 곡식
  oval(px, 16, 15, 9.5, 3.2, SEED, 2, 3, 0.1, (_x, y) => y <= 16);
  for (let x = 5; x <= 27; x++) if (px.get(x, 16) !== 0) px.set(x, 16, STRAW[x < 16 ? 5 : 4]);
  // 왼쪽 사람의 손(쪽빛 소매)과 오른쪽 사람의 손(옥빛 소매)
  rod(px, 0, 23, 2.6, 3, 19, 2.4, INDIGO, 0, 3);
  oval(px, 5, 17.5, 2.8, 3, SKINR, 0, 3);
  rod(px, 31, 23, 2.6, 28, 19, 2.4, JADE, 0, 3);
  oval(px, 27, 17.5, 2.8, 3, SKINR, 0, 3);
};

const provision: Draw = (px) => {
  // 아래의 소쿠리(곡식을 모으는 그릇)
  oval(px, 14, 23, 12.5, 7, STRAW, 1, 4, -0.05, (_x, y) => y >= 21);
  weave(px, 2, 23, 27, 30, STRAW, 'x');
  oval(px, 14, 21, 11, 3, SEED, 2, 3, 0.1, (_x, y) => y <= 22);
  for (let x = 2; x <= 26; x++) if (px.get(x, 22) !== 0) px.set(x, 22, STRAW[x < 14 ? 5 : 4]);
  // 기울여 쏟는 바가지(박을 쪼갠 그릇)
  oval(px, 23, 8.5, 7.5, 5, GOURD, 0, 3, 0.05, (x, y) => y >= 7 - (x - 23) * 0.35);
  oval(px, 23, 7.5, 6.5, 2.4, GOURD, 0, 1, -0.2, (x, y) => y < 8 - (x - 23) * 0.35);
  // 쏟아지는 낟알
  for (const [x, y] of [
    [15, 11],
    [14, 13],
    [15, 15],
    [13, 16],
    [14, 18],
    [16, 17],
  ] as const) {
    grain(px, x, y, SEED, true);
  }
};

const sow: Draw = (px) => {
  // 논물
  for (let y = 26; y <= 30; y++) for (let x = 0; x <= 31; x++) px.set(x, y, WATER[y === 26 ? 4 : y === 27 && x % 7 < 3 ? 5 : y > 29 ? 2 : 3]);
  // 소매와 볍씨를 흩뿌리는 손(손등이 위)
  rod(px, 0, 3, 3, 6, 8, 2.8, HEMP, 0, 3);
  oval(px, 9.5, 10, 3.8, 3.2, SKINR, 0, 3);
  for (const [x1, y1] of [
    [14, 11],
    [13.5, 13.5],
    [12, 15],
  ] as const) {
    rod(px, 10, 11, 1, x1, y1, 0.9, SKINR, 1, 3);
  }
  // 부채꼴로 고루 퍼지는 볍씨
  for (const [x, y] of [
    [17, 13],
    [20, 15],
    [23, 17],
    [26, 20],
    [16, 17],
    [19, 19],
    [22, 22],
    [14, 21],
    [17, 23],
    [27, 14],
    [24, 11],
  ] as const) {
    grain(px, x, y, SEED);
  }
};

const wood: Draw = (px) => {
  // 나뭇단: 비스듬히 쌓은 장작 일곱 개비(오른쪽 끝은 자른 나이테)
  const sticks: readonly (readonly [number, number])[] = [
    [0, 0],
    [1.5, 3],
    [-1.5, 3],
    [3, 6],
    [0, 6],
    [-3, 6],
    [1.5, 9],
  ];
  for (const [dx, dy] of sticks) {
    rod(px, 3 + dx, 18 + dy, 1.6, 25 + dx, 7 + dy, 1.6, SPRING.bark, 1, 4);
  }
  for (const [dx, dy] of sticks) {
    oval(px, 25.5 + dx, 7.5 + dy, 1.7, 1.7, WOOD, 3, 5);
    px.set(Math.round(25 + dx), Math.round(7 + dy), WOOD[3]);
  }
  // 묶은 새끼줄 두 줄
  for (const t of [0.3, 0.62]) {
    const cx = 3 + 22 * t;
    const cy = 18 - 11 * t;
    for (let k = -6; k <= 9; k++) {
      const x = Math.round(cx + k * 0.45);
      const y = Math.round(cy + k * 0.9);
      if (px.get(x, y) !== 0) px.set(x, y, STRAW[k < 2 ? 4 : 3]);
    }
  }
};

// ── 유물·장비 ────────────────────────────────────────────────────

const seedSack: Draw = (px) => {
  // 볍씨를 담아 아가리를 묶은 삼베 자루
  oval(px, 16, 21, 10.5, 9, HEMP, 0, 3, 0.02);
  poly(
    px,
    [
      [12, 13],
      [20, 13],
      [19, 9],
      [13, 9],
    ],
    HEMP,
    1,
    3,
  );
  // 아가리의 주름과 묶은 새끼줄
  for (let x = 12; x <= 20; x++) px.set(x, 11, STRAW[x < 16 ? 4 : 3]);
  for (let x = 12; x <= 20; x++) px.set(x, 12, STRAW[x < 16 ? 3 : 2]);
  poly(
    px,
    [
      [11, 9],
      [21, 9],
      [23, 5],
      [9, 5],
    ],
    HEMP,
    1,
    3,
    0.1,
  );
  // 아가리에 비친 볍씨
  for (const [x, y] of [
    [13, 6],
    [16, 5],
    [19, 6],
  ] as const) {
    grain(px, x, y, SEED);
  }
  // 자루의 주름
  for (const [x, y] of [
    [13, 17],
    [14, 18],
    [19, 16],
    [20, 17],
  ] as const) {
    px.set(x, y, HEMP[1]);
  }
  // 흘린 볍씨
  grain(px, 25, 29, SEED);
  grain(px, 28, 30, SEED);
};

const hoe: Draw = (px) => {
  // 호미: 오른쪽 위의 짧고 굵은 나무 자루, 아래로 휘어 내려간 가는 쇠 목(ㄱ 꼴), 끝이 뾰족한 세모꼴 날이 왼쪽으로 눕는다
  rod(px, 30, 3, 2.6, 23, 9, 2.4, WOOD, 1, 5);
  oval(px, 22.5, 9.5, 2.3, 2.3, WOOD, 3, 5);
  rod(px, 21.5, 11, 1.1, 22, 15, 1.1, IRON, 1, 4);
  rod(px, 22, 15, 1.1, 20, 19, 1.1, IRON, 1, 4);
  poly(
    px,
    [
      [21.5, 18],
      [22, 22.5],
      [16, 26.5],
      [3, 28],
      [9, 22.5],
      [17, 18.5],
    ],
    IRON,
    0,
    4,
  );
  // 날의 볕 받은 윗가장자리와 가운데 등
  for (const [x, y] of [
    [16, 19],
    [15, 20],
    [13, 20],
    [12, 21],
    [10, 22],
    [9, 23],
  ] as const) {
    px.set(x, y, STONE[5]);
  }
  for (const [x, y] of [
    [18, 22],
    [15, 23],
    [12, 25],
  ] as const) {
    px.set(x, y, IRON[1]);
  }
};

const sickle: Draw = (px) => {
  // 낫: 곧은 나무 자루와 자루 끝에서 옆으로 휘어 나간 쇠 날
  rod(px, 11, 30, 2, 17, 13, 1.8, WOOD, 1, 5);
  poly(
    px,
    [
      [15, 14],
      [18.5, 9],
      [14, 4.5],
      [8, 3],
      [2.5, 4],
      [1, 8],
      [4.5, 7.5],
      [9.5, 8],
      [13.5, 10.5],
    ],
    IRON,
    0,
    4,
  );
  // 날의 등(볕) — 위 가장자리
  for (const [x, y] of [
    [4, 4],
    [5, 4],
    [6, 4],
    [7, 3],
    [8, 3],
    [9, 4],
    [10, 4],
    [11, 4],
    [12, 5],
    [13, 5],
  ] as const) {
    px.set(x, y, STONE[5]);
  }
  // 자루 끝의 쇠고리
  for (let x = 15; x <= 18; x++) px.set(x, 14, IRON[2]);
  for (let x = 15; x <= 18; x++) px.set(x, 15, IRON[1]);
};

const flail: Draw = (px) => {
  // 도리깨: 긴 장대, 장대 끝에서 돌아가는 꼭지, 나란히 묶은 회초리 셋(열)
  rod(px, 3, 30, 1.6, 17, 8, 1.4, WOOD, 1, 5);
  for (const k of [-1.6, 0, 1.6]) {
    rod(px, 18 + k * 0.8, 7 - k * 0.6, 0.9, 29 + k * 0.8, 15 - k * 0.6, 0.9, SPRING.bark, 1, 4);
  }
  // 꼭지(장대와 열을 잇는 나무못)
  oval(px, 17.5, 7.5, 2.3, 2.3, WOOD, 2, 4);
  // 열을 묶은 끈 두 줄
  for (const t of [0.35, 0.75]) {
    const cx = 18 + 11 * t;
    const cy = 7 + 8 * t;
    for (let k = -2; k <= 2; k++) px.set(Math.round(cx + k * 0.6), Math.round(cy - k * 0.8), STRAW[k < 0 ? 4 : 3]);
  }
};

const bareHand: Draw = (px) => {
  // 아무것도 쥐지 않은 손바닥(빈손)
  rod(px, 16, 31, 4.2, 16, 27, 4, HEMP, 0, 3);
  oval(px, 16, 19.5, 7, 7, SKINR, 0, 3, 0.05);
  for (const [x, top] of [
    [11, 7],
    [14.5, 4.5],
    [18, 4],
    [21.5, 6.5],
  ] as const) {
    rod(px, x, 15, 1.6, x, top, 1.5, SKINR, 0, 3);
  }
  rod(px, 10, 20, 1.8, 4.5, 13, 1.6, SKINR, 0, 3);
  // 손바닥의 금
  for (const [x, y] of [
    [13, 20],
    [14, 21],
    [15, 21],
    [16, 21],
    [17, 20],
  ] as const) {
    px.set(x, y, SKINR[1]);
  }
};

// ── 갈래 표시(16×16) ──────────────────────────────────────────────

const kindPower: Draw = (px) => {
  // 쥔 주먹(앞에서): 손가락 마디 넷과 앞으로 감싼 엄지, 꼭두서니 소맷부리
  oval(px, 8, 7.5, 5.5, 5, SKINR, 0, 3, 0.05);
  for (const x of [5, 8, 11]) for (let y = 4; y <= 8; y++) if (px.get(x, y) !== 0) px.set(x, y, SKINR[1]);
  rod(px, 4, 10, 1.3, 9, 9.5, 1.3, SKINR, 1, 3);
  for (let y = 12; y <= 15; y++) for (let x = 5; x <= 11; x++) px.set(x, y, MADDER[y === 12 ? 3 : x >= 10 ? 1 : 2]);
};

const kindWisdom: Draw = (px) => {
  // 끈으로 묶어 만 두루마리(한지)와 양 끝의 나무 축
  rod(px, 3, 8, 3.4, 12, 8, 3.4, RICE, 0, 3);
  oval(px, 2, 8, 1.7, 2.6, WOOD, 2, 5);
  oval(px, 13.5, 8, 1.7, 2.6, WOOD, 2, 5);
  // 쪽빛 끈과 늘어진 끝
  for (let y = 4; y <= 12; y++) {
    px.set(7, y, INDIGO[y < 8 ? 3 : 2]);
    px.set(8, y, INDIGO[y < 8 ? 2 : 1]);
  }
  for (const [x, y] of [
    [8, 13],
    [9, 13],
    [9, 14],
    [10, 14],
  ] as const) {
    px.set(x, y, INDIGO[2]);
  }
};

const kindCraft: Draw = (px) => {
  // 나무 메(망치): 옆으로 누운 메통과 곧은 자루
  rod(px, 8, 7, 1.2, 9, 15, 1.2, WOOD, 1, 5);
  rod(px, 2.5, 4.5, 2.6, 13.5, 4.5, 2.6, WOOD, 1, 5);
  oval(px, 2.5, 4.5, 1.3, 2.4, WOOD, 3, 5);
};

const kindHeart: Draw = (px) => {
  // 나란히 서서 어깨를 맞댄 두 사람(옥빛과 연한 다홍 옷)
  oval(px, 4.5, 13, 4.2, 4, JADE, 0, 3, 0, (_x, y) => y <= 15);
  oval(px, 11.5, 13, 4.2, 4, ROSE, 0, 3, 0, (_x, y) => y <= 15);
  oval(px, 4.5, 5.5, 2.8, 3, SKINR, 0, 3);
  oval(px, 11.5, 5.5, 2.8, 3, SKINR, 0, 3);
  oval(px, 4.5, 3.8, 2.9, 1.8, HAIR.black, 0, 3, 0.1, (_x, y) => y <= 4);
  oval(px, 11.5, 3.8, 2.9, 1.8, HAIR.black, 0, 3, 0.1, (_x, y) => y <= 4);
  // 맞잡은 손
  oval(px, 8, 12, 1.6, 1.4, SKINR, 1, 3);
};

// ── 고비의 할 일 표시(24×24) ──────────────────────────────────────

const moveCrust: Draw = (px) => {
  // 해와 햇살
  oval(px, 17, 6, 4.3, 4.3, GOLD, 1, 3, 0.1);
  for (const [x, y, upright] of [
    [17, 0, true],
    [23, 5, false],
    [11, 5, false],
    [21, 1, false],
    [12, 1, false],
    [21, 10, false],
  ] as const) {
    grain(px, x, y, GOLD, upright);
  }
  // 볕에 굳어 갈라진 흙판
  poly(
    px,
    [
      [1, 15],
      [4, 13],
      [20, 13],
      [23, 15],
      [23, 22],
      [1, 22],
    ],
    SOIL,
    2,
    7,
    0.05,
  );
  for (const [x, y] of [
    [5, 14],
    [6, 15],
    [6, 16],
    [7, 17],
    [12, 14],
    [11, 15],
    [12, 16],
    [12, 17],
    [7, 17],
    [8, 17],
    [9, 17],
    [10, 17],
    [11, 17],
    [17, 15],
    [18, 16],
    [18, 17],
    [17, 18],
    [12, 18],
    [12, 19],
    [13, 20],
    [6, 18],
    [5, 19],
    [18, 19],
    [19, 20],
  ] as const) {
    px.set(x, y, SOIL[0]);
  }
};

const moveClod: Draw = (px) => {
  // 엉겨 붙은 흙덩이 셋
  oval(px, 7.5, 16.5, 6.5, 5.5, SOIL, 1, 7);
  oval(px, 16.5, 16, 6.5, 6, SOIL, 1, 7);
  oval(px, 12, 9.5, 5.5, 5, SOIL, 1, 7, 0.05);
  // 엉긴 자리의 짙은 골
  for (const [x, y] of [
    [11, 14],
    [12, 15],
    [12, 16],
    [12, 17],
    [8, 12],
    [9, 13],
    [15, 12],
    [16, 13],
  ] as const) {
    px.set(x, y, SOIL[1]);
  }
  // 묻은 진흙
  oval(px, 12, 21, 9, 2, MUD, 0, 2, 0, (_x, y) => y >= 21);
};

const moveRiddle: Draw = (px) => {
  // 말풍선과 그 안의 소용돌이(무엇일까?)
  oval(px, 12, 10, 10.5, 8, RICE, 1, 3, 0.1);
  poly(
    px,
    [
      [5, 15],
      [3, 22],
      [11, 16.5],
    ],
    RICE,
    1,
    2,
  );
  for (let a = 0; a < Math.PI * 4.2; a += 0.08) {
    const r = 0.6 + a * 0.4;
    const x = Math.round(12 + Math.cos(a) * r);
    const y = Math.round(10 + Math.sin(a) * r * 0.85);
    px.set(x, y, INDIGO[a < 6 ? 1 : 2]);
  }
};

const moveSsireum: Draw = (px) => {
  // 샅바: 허리에 두른 띠와 다리에 감는 고리(무명 천), 그 띠를 움켜쥔 두 손(쪽빛·꼭두서니 소매 — 두 사람)
  for (let y = 10; y <= 23; y++) {
    for (let x = 9; x <= 22; x++) {
      const dx = (x + 0.5 - 15.5) / 5.2;
      const dy = (y + 0.5 - 16.5) / 5.4;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1 || d < 0.52) continue;
      px.set(x, y, COTTON[lit(x, y, 15.5, 16.5, 5.2, 5.4, 0, 3)]);
    }
  }
  rod(px, 1, 11, 2.6, 23, 10, 2.6, COTTON, 0, 3);
  // 천의 주름
  for (const x of [5, 12, 19]) {
    px.set(x, 10, COTTON[1]);
    px.set(x + 1, 11, COTTON[1]);
  }
  rod(px, 4, 0, 2, 6, 6, 2, INDIGO, 0, 3);
  oval(px, 6.5, 9, 3, 2.8, SKINR, 0, 3);
  rod(px, 19, 0, 2, 17, 6, 2, MADDER, 0, 3);
  oval(px, 16.5, 9, 3, 2.8, SKINR, 0, 3);
  for (const x of [5, 7, 15, 17]) px.set(x, 10, SKINR[1]);
};

const moveWork: Draw = (px) => {
  // 엇걸린 호미와 낫(누가 더 빨리 하나)
  rod(px, 3, 21, 1.6, 12, 12, 1.5, WOOD, 1, 5);
  rod(px, 12, 12, 0.9, 14, 8, 0.9, IRON, 1, 4);
  poly(
    px,
    [
      [13, 8],
      [17, 4],
      [21, 2],
      [22, 5],
      [18, 9],
      [14, 10],
    ],
    IRON,
    0,
    4,
  );
  rod(px, 21, 22, 1.5, 15, 10, 1.4, WOOD, 1, 5);
  poly(
    px,
    [
      [14, 10],
      [15, 7],
      [11, 4],
      [6, 3],
      [2, 4.5],
      [6, 5.5],
      [10, 6.5],
      [13, 9],
    ],
    IRON,
    0,
    4,
  );
};

// ── 도깨비의 방패 칸(16×16) ─────────────────────────────────────

/** 도깨비불의 꼴(16×16): a b c d = 불빛의 바깥 → 속(밝다). 혀가 셋으로 갈라져 너울거린다(물방울과 꼴이 다르다) */
const WISP = [
  '.......a........',
  '.......ab.......',
  '......abb.......',
  '..a...abbb......',
  '..ab..abcb...a..',
  '..abb.abcbb.ab..',
  '...abbabccb.abb.',
  '...abbbcccbbabb.',
  '..abbbccdccbbbb.',
  '..abbccdddccbbb.',
  '.abbccdddddcbb..',
  '.abbcddddddcbb..',
  '.abbccdddddcbb..',
  '..abbccdddccbb..',
  '...abbbcccbbb...',
  '.....abbbbb.....',
] as const;

const wispOn: Draw = (px) => {
  // 도깨비불: 아래가 둥글고 위로 너울거리며 혀가 셋으로 갈라진 푸른빛 불꽃, 속은 밝다
  const key: Record<string, Color> = { a: FLAME[3], b: FLAME[4], c: FLAME[5], d: FLAME[6] };
  WISP.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (key[row[x]] !== undefined) px.set(x, y, key[row[x]]);
  });
};

const wispOff: Draw = (px) => {
  // 꺼진 자리: 속이 빈 잿빛 고리와 엷게 오르는 연기 한 가닥
  for (let y = 4; y <= 15; y++) {
    for (let x = 1; x <= 14; x++) {
      const dx = (x + 0.5 - 8) / 5.6;
      const dy = (y + 0.5 - 10.5) / 4.6;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1 || d < 0.58) continue;
      px.set(x, y, STONE[lit(x, y, 8, 10.5, 5.6, 4.6, 2, 4)]);
    }
  }
  for (const [x, y] of [
    [8, 4],
    [8, 3],
    [9, 2],
    [9, 1],
    [8, 0],
  ] as const) {
    px.set(x, y, STONE[4]);
  }
};

// ── 이름표 ───────────────────────────────────────────────────────

interface IconDef {
  size: number;
  draw: Draw;
  /** 갈래(시험과 화면이 쓴다) */
  group: 'card' | 'relic' | 'gear' | 'kind' | 'move' | 'wisp';
}

const DEFS: Record<string, IconDef> = {
  'skill-bund': { size: 32, draw: bund, group: 'card' },
  'skill-carry': { size: 32, draw: carry, group: 'card' },
  'skill-reckon': { size: 32, draw: reckon, group: 'card' },
  'skill-tithe': { size: 32, draw: tithe, group: 'card' },
  'skill-soil': { size: 32, draw: soil, group: 'card' },
  'skill-call': { size: 32, draw: call, group: 'card' },
  'skill-help': { size: 32, draw: help, group: 'card' },
  'skill-provision': { size: 32, draw: provision, group: 'card' },
  'skill-sow': { size: 32, draw: sow, group: 'card' },
  'skill-wood': { size: 32, draw: wood, group: 'card' },
  'relic-seed-sack': { size: 32, draw: seedSack, group: 'relic' },
  'gear-hoe': { size: 32, draw: hoe, group: 'gear' },
  'gear-sickle': { size: 32, draw: sickle, group: 'gear' },
  'gear-flail': { size: 32, draw: flail, group: 'gear' },
  'bare-hand': { size: 32, draw: bareHand, group: 'gear' },
  'kind-power': { size: 16, draw: kindPower, group: 'kind' },
  'kind-wisdom': { size: 16, draw: kindWisdom, group: 'kind' },
  'kind-craft': { size: 16, draw: kindCraft, group: 'kind' },
  'kind-heart': { size: 16, draw: kindHeart, group: 'kind' },
  crust: { size: 24, draw: moveCrust, group: 'move' },
  clod: { size: 24, draw: moveClod, group: 'move' },
  riddle: { size: 24, draw: moveRiddle, group: 'move' },
  ssireum: { size: 24, draw: moveSsireum, group: 'move' },
  work: { size: 24, draw: moveWork, group: 'move' },
  'wisp-on': { size: 16, draw: wispOn, group: 'wisp' },
  'wisp-off': { size: 16, draw: wispOff, group: 'wisp' },
};

/** 그릴 수 있는 작은 그림의 이름 모두 */
export function iconNames(): string[] {
  return Object.keys(DEFS);
}

/** 그 이름의 갈래(없으면 undefined) */
export function iconGroup(name: string): IconDef['group'] | undefined {
  return DEFS[name]?.group;
}

const luma = (c: Color): number => (0.2126 * (c & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * ((c >> 16) & 255)) / 255;

/**
 * 작은 그림의 대비 큰 외톨이 점 고르기(ㄹ): 이웃 여덟 점이 모두 자기와 다른 빛이고(빈 점도 다른 빛으로 친다) 가장 가까운 이웃과도
 * 밝기 차가 0.12를 넘는 점을 이웃의 찍힌 점 가운데 가장 많은 빛으로 바꾼다. 가는 선(자루·날)의 가장자리에서 생기는 외톨이 점까지
 * 고른다(wash.ts의 calmSprite는 찍힌 이웃이 셋 이상인 점만 본다). 두 번 돈다.
 */
function calmIcon(px: Px): void {
  const { w, h } = px;
  for (let pass = 0; pass < 2; pass++) {
    const src = px.d.slice();
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const c = src[y * w + x];
        if (c === 0) continue;
        let alone = true;
        let nearest = 1;
        const counts = new Map<Color, number>();
        for (let j = -1; j <= 1 && alone; j++) {
          for (let i = -1; i <= 1; i++) {
            if (!i && !j) continue;
            const q = src[(y + j) * w + x + i];
            if (q === c) {
              alone = false;
              break;
            }
            nearest = Math.min(nearest, Math.abs(luma(q) - luma(c)));
            if (q !== 0) counts.set(q, (counts.get(q) ?? 0) + 1);
          }
        }
        if (!alone || nearest <= 0.12 || counts.size === 0) continue;
        let best = 0;
        let bestN = 0;
        for (const [q, n] of counts) {
          if (n > bestN) {
            best = q;
            bestN = n;
          }
        }
        px.d[y * w + x] = best;
      }
    }
  }
}

const cache = new Map<string, Px>();

/**
 * 작은 그림 하나(봄 벌에 맞춘 그림 점 — 정사각형). 모르는 이름이면 null.
 * 마무리: 제 빛깔 가장자리(ㄴ) → 대비 큰 외톨이 점 고르기(ㄹ) → 봄 벌(ㅇ).
 */
export function iconPx(name: string): Px | null {
  const def = DEFS[name];
  if (!def) return null;
  let px = cache.get(name);
  if (!px) {
    px = new Px(def.size, def.size);
    def.draw(px);
    selfRim(px, RAMPS);
    calmSprite(px);
    snapperOf(SPRING).apply(px);
    calmIcon(px);
    cache.set(name, px);
  }
  return px;
}

/** 시험이 쓰는 것: 작은 그림의 빛 단계 */
export const ICON_COLORS: readonly Color[] = [...new Set([WOOD, STRAW, SOIL, MUD, WATER, FLAME, GRASS, STONE, GOLD, SKINR, HEMP, COTTON, INDIGO, MADDER, JADE, ROSE, RICE, SEED, GOURD].flat())];
