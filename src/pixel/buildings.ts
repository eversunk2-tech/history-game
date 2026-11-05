// 집과 건물. 초가(볏짚 지붕), 기와를 얹은 양반 댁과 절, 담과 대문.
// 생김새는 꾸민 것이다. 고증이 확인되지 않은 것이 많으므로 꾸밈없고 수수하게 그린다(글씨·현판·화려한 단청 없음).
// 빛은 왼쪽 위에서 온다: 지붕의 왼쪽 비탈이 밝고 오른쪽이 어둡다. 처마 아래 벽에는 그늘이 진다.
//
// 그림 올리기 ②(spec 4.7.5): 그림 점(ART)으로 다시 칠했다. 꼴(지붕선·문 자리·기둥 자리·처마 높이)은 1-라의 좌표를 K배 한 것이고
// (그리는 함수는 자리를 1-라의 점으로 받아 K배 한다), 칠은 그림 점마다 따로 셈한다.
//   ㄴ 먹빛 테두리를 쓰지 않는다 — 가장자리는 제 빛깔로 가른다(wash.ts의 selfRim).
//   ㄷ 빛은 왼쪽 위 하나. 명암은 이웃 단계로만 옮겨 간다(섞음 무늬 없음).
//   ㅌ 재질마다 수채화 같은 결(wash.ts의 watercolor — 짚·나뭇결은 세로로 길게).
//   ㅎ 때 없음: 결은 밝게 옮기는 쪽이 많다. 거뭇한 줄 대신 기둥·널의 금은 한 단계 위의 빛으로.
//   ㅍ 그늘은 따뜻한 밤빛 쪽(어두운 안은 나무의 가장 어두운 빛·나무껍질 빛 — 먹빛이 아니다).

import { CLOTH, type Palette, type Ramp } from './palette';
import { ART, Px, clamp, hash2, mix, shadeOf, tnoise, vnoise, type Color } from './px';
import type { SpriteDef } from './shapes';
import { calmSprite, finish, rampsOf, watercolor, type RampIndex, type WashOpts } from './wash';

type Maker = (pal: Palette, variant: number) => SpriteDef;

/** 1-라의 점 하나 = 그림 점 K */
const K = ART;

/** 그림 한 장. 결을 입히지 않을 점(창호지, 어두운 안, 불빛, 쇠고리)을 따로 적어 둔다. */
class Sheet extends Px {
  readonly still: Uint8Array;

  constructor(w: number, h: number) {
    super(w, h);
    this.still = new Uint8Array(w * h);
  }

  override set(x: number, y: number, c: Color): void {
    x |= 0;
    y |= 0;
    if (!this.inb(x, y)) return;
    this.d[y * this.w + x] = c;
    this.still[y * this.w + x] = 0;
  }

  /** 결을 입히지 않는 점 */
  calm(x: number, y: number, c: Color): void {
    x |= 0;
    y |= 0;
    if (!this.inb(x, y)) return;
    this.d[y * this.w + x] = c;
    this.still[y * this.w + x] = 1;
  }

  /** 다 그린 그림 */
  done(): Px {
    const out = new Px(this.w, this.h);
    out.d.set(this.d);
    return out;
  }
}

// ── 결(수채화 같은 얼룩) ──────────────────────────────────────
// 재질마다 결의 크기가 다르다. 3.1차 시안(docs/mockup-art/make-v31.mjs)의 초가·대문·담의 셈에서 왔다.
const THATCH_WASH: WashOpts = { big: 9, bigY: 7, amp: 1.5, streak: [1.4, 7, 1.6], down: 0.5 }; // 짚: 세로로 흐르는 결(어둡게 옮기는 문턱을 높여 거뭇한 얼룩을 덜었다)
const STRAW_WASH: WashOpts = { big: 5, bigY: 6, amp: 1.2, streak: [1.2, 5, 1.4] }; // 헛간의 짚단
const CLAY_WASH: WashOpts = { big: 9, bigY: 7, amp: 1.5 }; // 흙벽: 부드러운 큰 얼룩
const WOOD_WASH: WashOpts = { big: 6, bigY: 10, amp: 0.9, streak: [1.2, 9, 0.9], up: 0.36, down: 0.6 }; // 나뭇결: 세로, 잔잔하게(짙은 줄이 생기지 않게)
const STONE_WASH: WashOpts = { big: 6, bigY: 4, amp: 1.3 };
const TILE_WASH: WashOpts = { big: 9, bigY: 6, amp: 1.3, down: 0.5 };
const PLASTER_WASH: WashOpts = { big: 10, bigY: 5, amp: 1.3 };
const SNOW_WASH: WashOpts = { big: 7, bigY: 4.5, amp: 1.3, down: 0.6 }; // 눈: 부드러운 얼룩(눈의 그늘빛으로 옮기는 쪽도 조금)

/** [재질의 단계, 결, 이 자리 아래(포함)의 어두운 단계는 건드리지 않는다(골·틈이 더 짙어져 때처럼 보이지 않게)] */
type Part = readonly [Ramp, WashOpts, number?];

/**
 * 재질마다 결을 입히고(ㅌ) 제 빛깔 그늘·외톨이 점 고르기로 마무리한다(wash.ts의 finish — 결은 재질마다 따로 입히므로 여기서 부른다).
 * 돌려주는 값은 결이 어둡게 만든 점의 몫(%, 찍힌 점 가운데 — ㅎ).
 */
function* washJob(s: Sheet, pal: Palette, seed: number, parts: readonly Part[], extra: readonly Ramp[] = []): Generator<undefined, { px: Px; dark: number }, undefined> {
  const ramps = rampsOf(pal, extra);
  const { w, d, still } = s;
  let dark = 0;
  for (let i = 0; i < parts.length; i++) {
    const [ramp, o, lo = 0] = parts[i];
    const keep = (x: number, y: number): boolean => {
      if (still[y * w + x] !== 0) return false;
      const info = ramps.get(d[y * w + x]);
      return info !== undefined && info[0] === ramp && info[1] > lo;
    };
    dark += watercolor(s, ramps, seed + i * 31, { ...o, keep });
    // 재질 하나마다 쉬어 간다(큰 집 한 채가 낮은 사양에서 한 장의 시간을 넘지 않게 — 그림은 같다)
    yield;
  }
  finish(s, ramps, seed, null);
  return { px: s.done(), dark };
}

/** 쉬어 가며 짓는 그림을 한 번에 다 짓는다 */
function drainJob<T>(job: Generator<undefined, T, undefined>): T {
  let r = job.next();
  while (!r.done) r = job.next();
  return r.value;
}

/** 쉬어 가며 짓는 집 그림(그림 벌이 한 장의 시간 안에 나눠 짓는다 — spec 4.7.5의 ㅋ) */
export type Job = Generator<undefined, SpriteDef, undefined>;

/**
 * 칸마다 이어 놓는 담의 결: watercolor와 같은 셈(큰 결 ×0.6, 고운 결 ×0.55, 밝게 옮기는 문턱 0.32 — 어둡게 옮기는 문턱은 0.5로 높였다)이되 무늬가 칸의 너비(가로 담)나
 * 높이(세로 담)마다 되풀이되어 이웃 칸과 이음매 없이 이어진다 — 이 되풀이되는 무늬는 칸의 끝 예닐곱 점에만 잔잔하게 두고,
 * 안쪽은 생김새마다 다른 무늬로 바꿔 칸마다 같은 얼룩이 되풀이되지 않게 한다. 눈과 가장 어두운 두 단계(골·줄눈)는
 * 건드리지 않는다. 돌려주는 값은 어둡게 된 점의 몫(%).
 */
function tileWash(px: Sheet, ramps: RampIndex, pal: Palette, seed: number, variant: number, o: { big: number; bigY: number; amp: number }, period: { x?: number; y?: number }): number {
  const { w, h, d, still } = px;
  const len = period.x ?? period.y ?? 1;
  const cells = (span: number | undefined, size: number): [number, number] => {
    if (!span) return [size, 1 << 20];
    const n = Math.max(1, Math.round(span / size));
    return [span / n, n];
  };
  const [bx, nbx] = cells(period.x, o.big);
  const [by, nby] = cells(period.y, o.bigY);
  const [fx, nfx] = cells(period.x, 2.7);
  const [fy, nfy] = cells(period.y, 2.3);
  let on = 0;
  let darker = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = d[y * w + x];
      if (c >>> 24 !== 255) continue;
      on++;
      if (still[y * w + x]) continue;
      const info = ramps.get(c);
      if (!info || info[0] === pal.snow || info[1] <= 1) continue;
      const [ramp, i] = info;
      // 칸의 끝 예닐곱 점은 칸마다 같은 잔잔한 무늬(이음매가 이어진다), 안쪽은 생김새마다 다른 무늬
      const a = period.x ? x + 0.5 : y + 0.5;
      const e = clamp(Math.min(a, len - a) / 6, 0, 1);
      const win = e * e * (3 - 2 * e);
      const big = (tnoise(x / bx, y / by, nbx, nby, seed) - 0.5) * 0.5 * (1 - win) + (vnoise(x / o.big, y / o.bigY, seed + 50 + variant * 17) - 0.5) * win;
      const fine = (tnoise(x / fx, y / fy, nfx, nfy, seed + 1) - 0.5) * (1 - win) + (vnoise(x / 2.7, y / 2.3, seed + 51 + variant * 17) - 0.5) * win;
      const n = big * o.amp * 0.6 + fine * 0.8 * 0.55;
      const step = n > 0.32 ? 1 : n < -0.5 ? -1 : 0;
      if (step === 0) continue;
      const j = clamp(i + step, 0, ramp.length - 1);
      if (j < i) darker++;
      d[y * w + x] = ramp[j];
    }
  }
  return on ? (darker * 100) / on : 0;
}

/** 그 빛깔이 이 단계들 가운데 하나에 있으면 한 단계 어둡게(처마 그늘 — 제 단계 안에서만 옮긴다) */
function deepen(s: Sheet, x: number, y: number, ramps: readonly Ramp[]): void {
  const c = s.get(x, y);
  if (!c) return;
  for (const r of ramps) {
    const i = r.indexOf(c);
    if (i < 0) continue;
    if (i > 0) s.d[y * s.w + x] = r[i - 1];
    return;
  }
}

// ── 볏짚 지붕 ────────────────────────────────────────────────
// 모서리가 둥근 우진각 지붕을 앞에서 비스듬히 내려다본 모습: 둥글게 부푼 면을 빛 하나로 띠지게 칠하고(섞음 무늬 없이),
// 처마와 나란히 굽은 이엉의 켜(켜의 아랫단은 짚 끝이 볕을 받고, 그 아래 한 줄은 그늘 — 단은 들쭉날쭉 오르내린다),
// 짧은 세로 짚 결, 처마 끝의 두께(위는 볕, 짚 끝의 세로 결, 맨 아래 그늘), 엇갈려 엮은 용마름. 새끼줄 그물은 그리지 않는다.
// 자리는 1-라의 점. 열마다 처마의 아랫줄(그림 점)을 돌려준다 — 벽의 처마 그늘에 쓴다.
function thatchRoof(s: Sheet, x0: number, y0: number, w: number, h: number, pal: Palette, seed: number, old = false): Int16Array {
  // 새로 이은 지붕은 누런 볏짚 빛, 묵은 지붕은 비바람에 바랜 빛(잿빛으로 가라앉지 않게 — 묵은 짚 단계 그대로)
  const ramp = old ? pal.thatchOld : pal.thatch;
  const n = ramp.length - 1;
  const winter = pal.season === 'winter';
  const snow = pal.snow;
  const half = w / 2;
  const cx = x0 + half;
  const ridge = (y0 + Math.round(h * 0.2)) * K; // 용마루 줄(그림 점)
  const P = 7 * K; // 이엉 한 켜의 높이
  const eaves = new Int16Array(s.w).fill(-1);
  for (let X = x0 * K; X < (x0 + w) * K; X++) {
    const u = ((X + 0.5) / K - cx) / half;
    const au = Math.abs(u);
    const top = (y0 + h * 0.4 * Math.pow(au, 2.6)) * K;
    const lift = 4.2 * Math.pow(au, 3.4) * K; // 추녀 쪽으로 처마가 들린다
    // 처마 끝의 짚: 한두 점씩 들쭉날쭉 늘어진다
    const droop = (vnoise(X / 2.2, 0.5, seed + 1) - 0.5) * 2.4 + (hash2(X, 0, seed + 1) - 0.5) * 1.1;
    const eave = (y0 + h) * K - 1 - lift + droop; // 처마의 아랫줄(소수)
    const yTop = Math.round(top);
    const yBot = Math.round(eave);
    eaves[X] = yBot;
    // 켜의 단이 오르내린다: 느린 물결에 열두 점쯤마다 한 점씩 어긋나는 단(자로 그은 줄이 되지 않게, 그러나 출렁이지 않게)
    const wob = vnoise(X / 17, seed * 0.7, seed + 2) * 2.4 + (hash2(Math.floor((X + seed) / 12), 3, seed + 2) > 0.5 ? 1 : 0);
    // 처마 끝 짚의 세로 결과, 오른쪽 그늘의 경계(곧은 세로 금이 되지 않게 흔들린다)
    const tip = vnoise(X / 1.6, 2.5, seed + 12) > 0.5 ? 1 : 0;
    const rightShade = u > 0.62 + (vnoise(X / 9, 4.1, seed + 13) - 0.5) * 0.3 ? 1 : 0;
    for (let Y = yTop; Y <= yBot; Y++) {
      const v = clamp((Y - ridge) / Math.max(1, eave - ridge), -0.4, 1);
      const hip = au - (0.5 + 0.47 * Math.max(0, v));
      // 둥근 면의 큰 명암(단계): 위와 왼쪽이 밝다. 오른쪽은 그늘이되 한 단계쯤만(13.1의 58번 — 짙은 세로 줄이 생기지 않게)
      // 결(밝게 옮기는 쪽이 많다)과 켜의 볕 받는 단이 지붕을 반 단계쯤 밝히므로 바탕은 그만큼 낮춰 둔다. 묵은 짚은 따뜻한 가운데 단계가 넓게
      let b = (Y < ridge - K ? n * (0.6 - au * 0.1) - u * 0.4 : n * (0.73 - 0.17 * Math.max(0, v)) - u * 0.6) - (old ? 0.55 : 0.3);
      if (hip > 0) b += u < 0 ? 0.45 : -0.65;
      b += (vnoise(X / 19, Y / 13, seed + 8) - 0.5) * 0.55; // 짚이 뭉친 자리마다 조금씩 밝고 어둡다
      const fe = eave - Y; // 처마 끝에서 잰 높이
      if (winter) {
        // 겨울: 지붕에 눈이 덮였다. 처마 끝과, 눈이 흘러내린 자리에만 짚이 보인다.
        const slip = (2.4 + vnoise(X / 13, seed * 0.31, seed + 9) * 3.6) * K + (vnoise(X / 2.5, 3.3, seed + 10) > 0.74 ? 2 * K : 0);
        if (fe >= slip) {
          let sv = 3.4 + (b / n - 0.62) * 3.4 - u * 0.35 + (vnoise(X / 9, Y / 5, seed + 18) - 0.5) * 0.6; // 바람에 쌓인 눈의 부드러운 결
          if (hip > 0 && u > 0) sv -= 1.3; // 오른쪽 추녀면은 그늘
          if (Y < ridge - K) sv -= 0.6;
          if (fe < slip + 1.2 * K) sv = Math.min(sv, 2); // 눈의 끝이 짚 위에 도톰하다
          let si = clamp(Math.round(sv), 2, snow.length - 1);
          if (si === snow.length - 1 && vnoise(X / 2.4, Y / 2.1, seed + 19) > 0.7) si--; // 가장 흰 눈에도 고운 결(두세 점 무리)
          s.set(X, Y, snow[si]);
          continue;
        }
      }
      let i = Math.round(b);
      if (Y > ridge + 2 * K) {
        // 이엉의 켜: 처마 가까이는 처마와 나란히 굽는다
        const line = Y - ridge + wob + lift * Math.max(0, v);
        const k = Math.floor(line / P);
        const m = Math.floor(line - k * P);
        if (m === P - 1 || (m === P - 2 && vnoise(X / 2.3, k * 3.1, seed + 3) > 0.62)) i += 1; // 켜의 아랫단: 짚 끝이 볕을 받는다
        else if (m === 0 || (m === 1 && vnoise(X / 2.3, k * 3.1 + 1.7, seed + 3) < 0.3)) i -= 1; // 그 아래 한 줄은 그늘
        else if (hash2(X, k, seed + 4) > 0.8) {
          // 짚의 결: 짧은 세로 줄(서너 점, 띄엄띄엄)
          const s0 = 2 + Math.floor(hash2(X, k, seed + 5) * (P - 8));
          const len = 3 + Math.floor(hash2(X, k, seed + 6) * 3);
          if (m >= s0 && m < s0 + len) i += 1;
        }
      }
      // 처마 끝의 두께: 위는 볕(둥근 단), 가운데는 짚 끝의 세로 결, 맨 아래는 그늘
      if (fe < 1.5) i = 1;
      else if (fe < 5.5) i = 2 + tip - rightShade;
      else if (fe < 7.5) i = Math.round(b) + 1 - rightShade;
      s.set(X, Y, ramp[clamp(i, 1, n)]);
    }
  }
  // 용마름: 지붕 꼭대기를 덮은 엮은 짚(엇갈린 결). 오른쪽 끝은 한 단계 그늘
  const rh = half * 0.56;
  const rx0 = Math.round((cx - rh) * K);
  const rx1 = Math.round((cx + rh) * K) + K - 1;
  for (let X = rx0; X <= rx1; X++) {
    const q = clamp(((X + 0.5) / K - cx) / rh, -1, 1);
    const yc = ridge + Math.round(q * q * 1.5 * K);
    const t = (q + 1) / 2;
    const shade = t > 0.7 + (vnoise(X / 6, 7.7, seed + 14) - 0.5) * 0.08 ? 1 : 0;
    const phase = Math.round(vnoise(X / 9, 1.1, seed + 15) * 2);
    for (let k = 0; k < 4 * K; k++) {
      let i: number;
      if (k === 0) i = n;
      else if (k === 1) i = n - 1;
      else if (k < 6) i = (((X + k + phase) % 5) + 5) % 5 < 2 ? n - 1 : n - 2;
      else i = k === 6 ? 3 : 2;
      s.set(X, yc - 2 * K + k, ramp[clamp(i - shade, 1, n)]);
    }
    if (winter) {
      // 용마름 위에 얹힌 눈: 위는 볕, 앞은 그늘, 아랫단은 들쭉날쭉
      for (let k = 0; k < 5 * K; k++) {
        const Y = yc - 3 * K + k;
        if (k === 0 && Math.abs(q) > 0.9) continue;
        const sv = k < 2 ? 4 : k < 4 ? 4 - shade : k < 6 ? 3 : k < 8 ? 2 : vnoise(X / 2.6, 5.5, seed + 11) > 0.45 ? 3 : 2;
        s.set(X, Y, snow[sv]);
      }
    }
  }
  return eaves;
}

/** 처마 그늘: 지붕 바로 밑의 벽·기둥·문을 서너 점 한 단계 어둡게(따뜻한 그늘 — 제 단계 안에서). 아랫단은 흔들린다 */
function eaveShade(s: Sheet, eaves: Int16Array, ramps: readonly Ramp[], seed: number): void {
  for (let X = 0; X < s.w; X++) {
    const e = eaves[X];
    if (e < 0) continue;
    const depth = 3 + Math.round(vnoise(X / 7, 1.7, seed) * 3);
    for (let Y = e + 1; Y <= e + depth; Y++) deepen(s, X, Y, ramps);
  }
}

interface Bay {
  kind: 'door' | 'window' | 'kitchen' | 'blank' | 'open';
}

/**
 * 막돌 한 켜(그림 점): 크기가 들쭉날쭉한 돌을 줄지어 놓는다. 돌마다 위가 볕, 아래가 그늘, 오른쪽은 가는 줄눈.
 * 돌의 빛깔은 잿빛 단계의 가운데쯤에서 돌마다 조금씩 다르다.
 */
function rubbleCourse(s: Sheet, xa: number, xb: number, y: number, rows: number, stone: Ramp, seed: number, lo: number, hi: number, darkFrom = Infinity): void {
  let x = xa - Math.floor(hash2(seed, 0, 1) * lo);
  let k = 0;
  while (x <= xb) {
    const wd = lo + Math.floor(hash2(k, seed, 2) * (hi - lo + 1));
    const t = 3 + Math.round((hash2(k, seed, 3) - 0.5) * 1.4);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < wd; i++) {
        const X = x + i;
        if (X < xa || X > xb) continue;
        let v = t;
        if (i === wd - 1) v = 1; // 줄눈
        else if (j === 0) v = i === 0 ? t : t + 1; // 윗면이 볕을 받는다
        else if (j === rows - 1) v = t - 1;
        if (X >= darkFrom) v -= 1; // 오른쪽 끝(마구리)은 그늘
        s.set(X, y + j, stone[clamp(v, 1, stone.length - 1)]);
      }
    }
    x += wd;
    k++;
  }
}

// ── 흙벽 ─────────────────────────────────────────────────────
// 나무 기둥과 인방 사이를 흙으로 메운 벽. 아래는 막돌을 쌓은 기단. 자리는 1-라의 점.
function clayWall(s: Sheet, x0: number, y0: number, w: number, h: number, pal: Palette, bays: Bay[], seed: number): void {
  const { clay, wood, stone } = pal;
  const base = 5; // 기단 높이(1-라의 점)
  const wallBot = y0 + h - base - 1;
  const X0 = x0 * K;
  const X1 = (x0 + w) * K - 1;
  const Y0 = y0 * K;
  const WB = wallBot * K + K - 1; // 벽의 아랫줄(그림 점)
  // 벽: 부드러운 큰 얼룩(1-라의 얼룩을 K배 크기로 셈한다) + 흙 속의 짚 여물(두세 점짜리 짧은 조각)
  for (let Y = Y0; Y <= WB; Y++) {
    for (let X = X0; X <= X1; X++) {
      let v = 2.5 + (vnoise(X / (6.1 * K), Y / (4.7 * K), seed + 11) - 0.5) * 2.2;
      const cxI = Math.floor(X / 7);
      const cyI = Math.floor(Y / 5);
      const r = hash2(cxI, cyI, seed + 12);
      if (r < 0.09) {
        const sx = cxI * 7 + Math.floor(hash2(cxI, cyI, seed + 16) * 4);
        const sy = cyI * 5 + Math.floor(hash2(cxI, cyI, seed + 17) * 5);
        if (Y === sy && X >= sx && X < sx + 2 + (r < 0.03 ? 1 : 0)) v += r < 0.06 ? 1 : -1;
      }
      // 처마 그늘(지붕 밑에 덮이는 자리)
      const shadeEdge = Y0 + 5 * K + Math.round(vnoise(X / (4 * K), 0, seed + 13) * 1.6 * K);
      if (Y < Y0 + 2 * K) v = 0;
      else if (Y < shadeEdge) v -= 1.4;
      // 오른쪽 끝은 조금 어둡다
      if (X > X1 - 4 * K) v -= 0.6;
      s.set(X, Y, clay[clamp(Math.round(v), 0, 4)]);
    }
  }
  // 기단(막돌 두 켜 — 돌의 너비가 들쭉날쭉하다)
  rubbleCourse(s, X0 - 2 * K, X1 + 2 * K, WB + 1, 2 * K, stone, seed + 14, 9, 16, X1 + 1);
  rubbleCourse(s, X0 - 2 * K, X1 + 2 * K, WB + 1 + 2 * K, 3 * K, stone, seed + 15, 10, 18, X1 + 1);
  // 인방: 윗면이 볕, 아래로 그늘
  const rail = Math.round(y0 + (wallBot - y0) * 0.44) * K;
  for (let X = X0; X <= X1; X++) {
    s.set(X, Y0 + 2, wood[2]);
    s.set(X, Y0 + 3, wood[1]);
    s.set(X, rail, wood[4]);
    s.set(X, rail + 1, wood[3]);
    s.set(X, rail + 2, wood[3]);
    s.set(X, rail + 3, wood[2]);
    deepen(s, X, rail + 4, [clay]); // 인방이 벽에 드리운 그늘 한 줄
  }
  // 기둥: 네모난 나무 기둥 — 왼쪽 면이 볕, 오른쪽은 한 단계 그늘(가장 어두운 빛은 쓰지 않는다)
  const bayW = w / bays.length;
  const post = (x: number): void => {
    const X = x * K;
    const face = [4, 4, 3, 3, 2, 2];
    for (let Y = Y0 + 2; Y <= WB; Y++) {
      const dark = Y < Y0 + 5 * K ? 1 : 0;
      for (let i = 0; i < 3 * K; i++) s.set(X + i, Y, wood[clamp(face[i] - dark, 0, 5)]);
    }
  };
  for (let b = 0; b <= bays.length; b++) post(clamp(Math.round(x0 + b * bayW) - (b === bays.length ? 3 : 0), x0, x0 + w - 3));

  bays.forEach((bay, b) => {
    const bx = Math.round(x0 + b * bayW) + 3;
    const bw = Math.round(bayW) - 4;
    const mid = bx + Math.floor(bw / 2);
    if (bay.kind === 'door') {
      // 널문: 세로 널에 띠장 둘. 널의 금은 가는 한 점, 나뭇결은 세로
      const dw = Math.min(13, bw - 4);
      const dx = mid - Math.floor(dw / 2);
      const dy = y0 + 6;
      const DX = dx * K;
      const DW = dw * K;
      const DY = dy * K;
      for (let Y = DY; Y <= WB; Y++) {
        for (let X = DX; X < DX + DW; X++) {
          const i = X - DX;
          const j = Y - DY;
          let v: number;
          if (j < K) v = j === 0 ? 1 : 2; // 위 문얼굴: 인방 밑 그늘
          else if (i === 0 || i === DW - 1) v = 2; // 문얼굴
          else if (i === 1) v = 4; // 문얼굴의 볕 받는 안쪽
          else if (i === DW - 2) v = 2;
          else if ((i - 1) % (3 * K) === 0) v = 2; // 널의 금
          else v = 3 + (hash2(X, (Y + Math.floor(hash2(X, 9, seed + 22) * 8)) >> 3, seed + 21) > 0.84 ? 1 : 0);
          // 띠장: 위가 볕, 아래 그늘
          if (i > 0 && i < DW - 1) {
            const band = (r: number): number => (r === 0 ? 5 : r === 1 || r === 2 ? 4 : r === 3 ? 2 : -1);
            const ta = band(j - 5 * K);
            const tb = band(Y - (wallBot - 4) * K);
            if (ta >= 0) v = ta;
            else if (tb >= 0) v = tb;
          }
          s.set(X, Y, wood[clamp(v, 0, 5)]);
        }
      }
      // 문고리: 짙은 쇠빛 두 점과 그 밑의 볕 한 점 무리
      const kx = (dx + dw - 3) * K;
      const ky = Math.round((dy + wallBot) / 2) * K;
      s.calm(kx, ky, pal.tile[1]);
      s.calm(kx, ky + 1, pal.tile[1]);
      s.calm(kx + 1, ky + 1, pal.tile[2]);
      s.calm(kx, ky + 2, pal.wood[5]);
      s.calm(kx + 1, ky + 2, pal.wood[4]);
      // 댓돌: 윗면이 볕을 받는 납작한 돌(모서리는 둥글다)
      const sx0 = (dx - 1) * K;
      const sx1 = (dx + dw + 1) * K - 1;
      const slab = [5, 5, 4, 3, 3, 2];
      for (let k = 0; k < 3 * K; k++) {
        for (let X = sx0; X <= sx1; X++) {
          if (k === 0 && (X === sx0 || X === sx1)) continue;
          const v = slab[k] - (X >= sx1 - 1 ? 1 : 0);
          s.set(X, WB + 1 + k, stone[clamp(v, 1, 5)]);
        }
      }
    } else if (bay.kind === 'window') {
      // 살창: 나무 살을 세로로 박은 창. 살 사이는 따뜻한 어둠(먹빛이 아니다)
      const ww = Math.min(11, bw - 4);
      const wx = mid - Math.floor(ww / 2);
      const wy = y0 + 8;
      const WX = wx * K;
      const WW = ww * K;
      const WY = wy * K;
      for (let Y = WY; Y < WY + 8 * K; Y++) {
        for (let X = WX; X < WX + WW; X++) {
          const i = X - WX;
          const j = Y - WY;
          const edge = i < K || i >= WW - K || j < K || j >= 8 * K - K;
          let c: Color;
          if (edge) c = i === 1 && j >= K ? wood[3] : wood[2];
          else if (Math.floor(i / K) % 2 === 0) c = i % K === 0 ? wood[4] : wood[3]; // 둥근 살: 왼쪽이 볕
          else c = i % K === 0 ? wood[0] : wood[1];
          s.calm(X, Y, c);
        }
      }
      for (let X = WX; X < WX + WW; X++) {
        s.set(X, WY + 8 * K, wood[5]); // 창턱
        s.set(X, WY + 8 * K + 1, wood[3]);
      }
    } else if (bay.kind === 'kitchen') {
      // 부엌: 어두운 문간과 반쯤 열린 널문, 부뚜막의 불빛
      const dw = Math.min(14, bw - 3);
      const dx = mid - Math.floor(dw / 2);
      const dy = y0 + 5;
      const DX = dx * K;
      const DW = dw * K;
      const DY = dy * K;
      for (let Y = DY; Y <= WB; Y++) {
        for (let X = DX; X < DX + DW; X++) {
          const i = X - DX;
          const j = Y - DY;
          if (j < K || i < K || i >= DW - K) {
            s.set(X, Y, wood[j < K ? 1 : i === 1 ? 3 : 2]); // 문얼굴
            continue;
          }
          if (i < 5 * K) {
            // 열어 젖힌 문짝: 널마다 왼쪽이 볕, 오른쪽에 가는 금
            const p = (i - K) % (2 * K);
            s.set(X, Y, wood[p === 0 ? 4 : p === 2 * K - 1 ? 2 : 3]);
            continue;
          }
          // 안: 따뜻한 어둠. 바닥 쪽은 부뚜막과 그릇이 어렴풋하다
          let c: Color = wood[0];
          if (Y > WB - 5 * K && vnoise(X / 3, Y / 2.5, seed + 25) > 0.52) c = pal.bark[1];
          s.calm(X, Y, c);
        }
      }
      // 부뚜막의 불빛(두세 점 무리)과 그 둘레의 붉은 기운
      const fx = (dx + dw - 4) * K;
      const fy = (wallBot - 2) * K;
      s.calm(fx - 2, fy, pal.clay[1]);
      s.calm(fx - 1, fy, pal.clay[1]);
      s.calm(fx - 1, fy + 1, pal.clay[0]);
      s.calm(fx, fy, pal.thatch[5]);
      s.calm(fx + 1, fy, pal.thatch[4]);
      s.calm(fx, fy + 1, pal.thatch[4]);
      s.calm(fx + 1, fy + 1, pal.clay[1]);
    } else if (bay.kind === 'open') {
      // 헛간: 앞이 트인 칸. 안은 어둡고 짚단이 쌓여 있다
      const xa = (bx - 1) * K;
      const xb = (bx + bw + 1) * K - 1;
      for (let X = xa; X <= xb; X++) {
        const pileTop = WB - (7 * K + Math.round(vnoise(X / (3 * K), 0, seed + 31) * 5 * K));
        for (let Y = (y0 + 3) * K; Y <= WB; Y++) {
          if (Y <= pileTop) {
            s.calm(X, Y, Y > pileTop - 2 * K && vnoise(X / 4, 1.3, seed + 34) > 0.5 ? pal.bark[1] : wood[0]);
            continue;
          }
          // 짚단: 꼭대기는 볕, 짚의 세로 결, 바닥 쪽은 그늘
          const dTop = Y - pileTop;
          let v = 2;
          if (dTop <= 2) v = 3;
          else if (WB - Y < 3) v = 1;
          const strand = hash2(X, Math.floor((Y + hash2(X, 2, seed + 33) * 6) / 6), seed + 32);
          if (dTop > 2 && strand > 0.78) v += 1;
          else if (dTop > 2 && strand < 0.1) v -= 1;
          s.set(X, Y, pal.thatch[clamp(v, 1, 5)]);
        }
      }
    }
  });
}

/** 낮은 굴뚝(자리는 1-라의 점). 연기가 피어오르는 자리(그림 안의 점)를 돌려준다. */
function chimney(s: Sheet, x: number, yBot: number, pal: Palette): { x: number; y: number } {
  const { clay } = pal;
  const X = x * K;
  const top = (yBot - 12) * K;
  const bot = yBot * K + K - 1;
  for (let Y = top; Y <= bot; Y++) {
    for (let i = 0; i < 6 * K; i++) {
      const v = i < 2 * K ? 3 : i < 4 * K ? 2 : 1; // 왼쪽 면이 볕
      s.set(X + i, Y, clay[clamp(v - (Y >= (yBot - 2) * K ? 1 : 0), 0, 4)]);
    }
  }
  // 아가리: 흙빛 테두리 안에 그을린 어둠
  for (let i = K; i < 5 * K; i++) {
    s.calm(X + i, top, pal.wood[0]);
    s.calm(X + i, top + 1, i < 4 * K ? pal.wood[0] : pal.bark[1]);
  }
  s.set(X, top, clay[4]);
  s.set(X + 1, top, clay[4]);
  s.set(X + 6 * K - 2, top, clay[2]);
  s.set(X + 6 * K - 1, top, clay[2]);
  // 겨울: 굴뚝 둘레는 더운 김에 눈이 녹고 가장자리에만 조금 남는다
  if (pal.season === 'winter') {
    s.set(X, top, pal.snow[4]);
    s.set(X + 1, top, pal.snow[3]);
    s.set(X, top + 1, pal.snow[3]);
    s.set(X + 6 * K - 2, top, pal.snow[2]);
    s.set(X + 6 * K - 1, top, pal.snow[2]);
  }
  return { x: X + 3 * K, y: top - K };
}

const THATCH_PARTS = (pal: Palette, old: boolean): Part[] => [
  [old ? pal.thatchOld : pal.thatch, THATCH_WASH, 1],
  [old ? pal.thatch : pal.thatchOld, STRAW_WASH, 1],
  [pal.clay, CLAY_WASH],
  [pal.wood, WOOD_WASH, 1],
  [pal.stone, STONE_WASH],
  [pal.snow, SNOW_WASH],
];

// ── 초가 ─────────────────────────────────────────────────────
export function* chogaJob(pal: Palette, variant = 0): Job {
  const W = 108 * K;
  const H = 94 * K;
  const s = new Sheet(W, H);
  const layouts: Bay['kind'][][] = [
    ['kitchen', 'door', 'window'],
    ['window', 'door', 'kitchen'],
    ['door', 'window', 'door'],
  ];
  const bays = layouts[variant % 3].map((kind) => ({ kind }));
  const chimneyX = variant % 3 === 1 ? 3 : 108 - 9;
  const smoke = chimney(s, chimneyX, 84, pal);
  clayWall(s, 10, 50, 88, 40, pal, bays, 40 + variant * 5);
  yield;
  // 툇마루: 방문 앞의 좁은 마루. 윗면은 볕, 앞 끝은 그늘, 짧은 다리
  const doorBay = layouts[variant % 3].indexOf('door');
  const mx = (10 + Math.round((88 / 3) * doorBay) + 2) * K;
  const { wood } = pal;
  const deck = [5, 4, 4, 3, 3, 2, 2, 1];
  for (let X = mx; X < mx + 27 * K; X++) {
    deck.forEach((v, k) => s.set(X, 79 * K + k, wood[v]));
    const leg = (X - mx) % (9 * K);
    if (leg >= K && leg < 3 * K) {
      const lv = leg < 2 * K ? 2 : 1;
      for (let k = 0; k < 2 * K; k++) s.set(X, 83 * K + k, wood[clamp(lv - (k >= K ? 1 : 0) + (leg === K ? 1 : 0), 0, 5)]);
    }
  }
  const eaves = thatchRoof(s, 0, 3, 108, 56, pal, 60 + variant * 9, variant >= 3);
  yield;
  eaveShade(s, eaves, [pal.clay, pal.wood], 70 + variant);
  const { px, dark } = yield* washJob(s, pal, 300 + variant * 7, THATCH_PARTS(pal, variant >= 3));
  return {
    frames: [px],
    smoke,
    ax: 54 * K,
    ay: 91 * K,
    shades: [{ dx: 0, dy: -2, rx: 0, ry: 0, strength: 0.34, cast: { x0: -46, x1: 46, h: 40, side: 13, depth: 5, ragged: true } }],
    wash: dark,
  };
}
export const choga: Maker = (pal, variant) => drainJob(chogaJob(pal, variant));

// ── 작은 초가(노비 집, 절의 살림채) ─────────────────────────────
function* hutOf(pal: Palette, variant: number, seed: number, old = false): Job {
  const W = 76 * K;
  const H = 76 * K;
  const s = new Sheet(W, H);
  const bays: Bay[] = variant % 2 === 0 ? [{ kind: 'door' }, { kind: 'window' }] : [{ kind: 'window' }, { kind: 'door' }];
  const smoke = chimney(s, variant % 2 === 0 ? 76 - 8 : 2, 67, pal);
  clayWall(s, 9, 36, 58, 37, pal, bays, seed);
  yield;
  const eaves = thatchRoof(s, 0, 3, 76, 42, pal, seed + 3, old);
  yield;
  eaveShade(s, eaves, [pal.clay, pal.wood], seed + 4);
  const { px, dark } = yield* washJob(s, pal, seed + 200, THATCH_PARTS(pal, old));
  return {
    frames: [px],
    smoke,
    ax: 38 * K,
    ay: 73 * K,
    shades: [{ dx: 0, dy: -2, rx: 0, ry: 0, strength: 0.34, cast: { x0: -31, x1: 31, h: 36, side: 11, depth: 4, ragged: true } }],
    wash: dark,
  };
}

export const hutJob = (pal: Palette, variant = 0): Job => hutOf(pal, variant, 80 + variant * 7, variant >= 2);
export const hallJob = (pal: Palette, _variant = 0): Job => hutOf(pal, 1, 95, true);
export const hut: Maker = (pal, variant) => drainJob(hutJob(pal, variant));
export const hall: Maker = (pal, variant) => drainJob(hallJob(pal, variant));

// ── 헛간 ─────────────────────────────────────────────────────
export function* shedJob(pal: Palette, _variant = 0): Job {
  const W = 58 * K;
  const H = 52 * K;
  const s = new Sheet(W, H);
  clayWall(s, 7, 28, 44, 21, pal, [{ kind: 'open' }, { kind: 'open' }], 120);
  yield;
  const eaves = thatchRoof(s, 0, 3, 58, 32, pal, 123, true);
  eaveShade(s, eaves, [pal.clay, pal.wood], 124);
  const { px, dark } = yield* washJob(s, pal, 420, THATCH_PARTS(pal, true));
  return {
    frames: [px],
    ax: 29 * K,
    ay: 49 * K,
    shades: [{ dx: 0, dy: -2, rx: 0, ry: 0, strength: 0.34, cast: { x0: -23, x1: 23, h: 22, side: 9, depth: 4, ragged: true } }],
    wash: dark,
  };
}
export const shed: Maker = (pal, variant) => drainJob(shedJob(pal, variant));

// ── 기와지붕 ──────────────────────────────────────────────────
// 골이 진 기와(수키와의 줄 — 골마다 너비 대여섯 점, 왼쪽 끝이 볕), 수키와의 이음매(골마다 자리가 어긋난다), 용마루와 추녀마루,
// 처마 끝의 둥근 막새, 처마 밑의 서까래 끝, 살짝 들린 추녀. 자리는 1-라의 점.
function tileRoof(s: Sheet, x0: number, y0: number, w: number, h: number, pal: Palette, seed: number): void {
  const ramp = pal.tile;
  const n = ramp.length - 1;
  const winter = pal.season === 'winter';
  const snow = pal.snow;
  const half = w / 2;
  const cx = x0 + half;
  const ridgeHalf = half * 0.6;
  const ridgeY = y0 + 5;
  const XA = x0 * K;
  const XB = (x0 + w) * K - 1;
  // 기왓골: 너비 다섯이나 여섯 점(들쭉날쭉). 0은 암키와 골, 1은 수키와의 볕 받는 끝
  const ribOf = new Int16Array(XB - XA + 1);
  const posOf = new Int16Array(XB - XA + 1);
  const widOf = new Int16Array(XB - XA + 1);
  for (let x = XA, r = 0; x <= XB; r++) {
    const wd = hash2(r, 7, seed) < 0.34 ? 6 : 5;
    for (let p = 0; p < wd && x <= XB; p++, x++) {
      ribOf[x - XA] = r;
      posOf[x - XA] = p;
      widOf[x - XA] = wd;
    }
  }
  for (let X = XA; X <= XB; X++) {
    const u = ((X + 0.5) / K - cx) / half;
    const au = Math.abs(u);
    // 지붕의 윗선: 용마루에서 양쪽으로 내려간다
    const top = au < 0.6 ? ridgeY - 2 : ridgeY - 2 + ((au - 0.6) / 0.4) * (h * 0.52);
    // 처마선: 가운데가 낮고 추녀 끝이 들린다
    const eave = (y0 + h - 1 - 5 * Math.pow(au, 2.4)) * K + K - 1;
    const r = ribOf[X - XA];
    const p = posOf[X - XA];
    const wd = widOf[X - XA];
    const phase = Math.floor(hash2(r, 1, seed) * 12);
    const yBot = Math.round(eave);
    for (let Y = Math.round(top * K); Y <= yBot; Y++) {
      const v = clamp((Y / K - ridgeY) / Math.max(1, eave / K - ridgeY), 0, 1);
      const hip = au - (0.6 + 0.4 * v);
      const face = hip > -0.02; // 추녀면
      let b = n * (0.52 - 0.14 * v) - u * 0.4;
      if (face) b += u < 0 ? 0.7 : -0.6; // 오른쪽 추녀면은 한 단계 그늘
      else {
        b += p === 0 ? -0.9 : p === 1 ? 1.3 : p === 2 ? 0.8 : p === wd - 1 ? -0.5 : -0.1; // 골의 몸은 따뜻한 잿빛 단계 쪽으로
        // 수키와의 이음매: 열두 점쯤마다 한 줄, 골마다 자리가 어긋나고 조금씩 흔들린다(가로로 줄지어 서지 않게)
        if (p >= 1 && p <= wd - 2) {
          const q = Y + phase;
          const seg = Math.floor(q / 12);
          if (q - seg * 12 === (hash2(r, seg, seed + 2) < 0.3 ? 1 : 0)) b -= 0.8;
        }
      }
      const fe = eave - Y;
      if (fe < 2 * K) {
        // 막새: 수키와 끝의 둥근 얼굴(왼쪽 위가 볕), 사이의 골은 어둡다
        const d = Math.floor(fe); // 0 = 맨 아랫줄
        if (face) b = d === 0 ? 1 : u < 0 ? 3 : 2;
        else if (p === 0) b = 1;
        else {
          const corner = (p === 1 || p === wd - 1) && (d === 0 || d === 3);
          if (corner) b = 1;
          else if (d === 3) b = 3;
          else if (d === 0) b = 2;
          else b = p === 1 ? 4 : p === wd - 1 ? 2 : d === 2 && p === 2 ? 4 : 3;
        }
      } else if (winter) {
        // 겨울: 기왓골을 따라 눈이 쌓였다. 수키와의 등은 희고 골은 그늘지며, 처마 가까이는 눈이 녹아 기와가 비친다.
        const melt = fe < (3.2 + vnoise(X / 11, 1.3, seed + 6) * 3.4) * K;
        const low = p === 0 || p === wd - 1;
        if (!(melt && low)) {
          let sv = 3.6 - 0.5 * v + (p === 1 ? 0.5 : p === 2 ? 0.2 : p === 0 ? -1.5 : p === wd - 1 ? -0.6 : 0);
          if (face) sv = u < 0 ? 3.8 : 1.9; // 추녀면: 왼쪽은 볕, 오른쪽은 그늘
          if (melt) sv -= 0.6;
          s.set(X, Y, snow[clamp(Math.round(sv), 2, snow.length - 1)]);
          continue;
        }
      }
      s.set(X, Y, ramp[clamp(Math.round(b), 1, n)]);
    }
    // 처마 밑: 서까래 끝이 줄지어 보이고, 그 뒤는 따뜻한 그늘
    const raft = X % (3 * K);
    for (let k = 1; k <= 2 * K; k++) {
      let c: Color = pal.wood[0];
      if (raft < K && k <= K) c = pal.wood[k === 1 ? (raft === 0 ? 4 : 3) : raft === 0 ? 3 : 2];
      s.set(X, yBot + k, c);
    }
  }
  // 추녀마루: 용마루 끝에서 처마 귀퉁이로(둥근 마루 — 위가 볕, 밑에 그늘)
  for (const side of [-1, 1]) {
    const xs = (cx + side * ridgeHalf) * K;
    const xe = (cx + side * (half - 2)) * K;
    const ys = ridgeY * K;
    const ye = (y0 + h - 7) * K;
    const lo = Math.round(Math.min(xs, xe));
    const hi = Math.round(Math.max(xs, xe));
    const prof = side < 0 ? [n, n - 1, n - 1, n - 2, 2, 1] : [n - 1, n - 2, 2, 2, 1, 1];
    for (let X = lo; X <= hi; X++) {
      const t = (X + 0.5 - xs) / (xe - xs);
      const yc = Math.round(ys + (ye - ys) * t);
      for (let d = -2; d <= 3; d++) {
        let c = ramp[prof[d + 2]];
        if (winter && t < 0.9 && d < 2) c = snow[side < 0 ? (d < 0 ? 4 : 3) : d < 0 ? 3 : 2];
        s.set(X, yc + d, c);
      }
    }
  }
  // 용마루: 마루 기와의 이음매는 일고여덟 점마다(들쭉날쭉), 오른쪽 끝은 한 단계 그늘
  const R = ridgeY * K;
  const rx0 = (Math.round(cx - ridgeHalf) - 1) * K;
  const rx1 = (Math.round(cx + ridgeHalf) + 1) * K + K - 1;
  let joint = rx0 + 3 + Math.floor(hash2(0, 3, seed) * 4);
  for (let X = rx0; X <= rx1; X++) {
    const t = ((X + 0.5) / K - (cx - ridgeHalf)) / (2 * ridgeHalf);
    const dark = t > 0.75 + (vnoise(X / 7, 2.2, seed + 7) - 0.5) * 0.08 ? 1 : 0;
    const j = X === joint;
    if (j) joint += 7 + Math.floor(hash2(X, 3, seed) * 3);
    const rows = [n - 1, n, n - 1 - dark, n - 1 - dark, j ? 2 : 3, j ? 2 : 3, 2, 2, 1, 1];
    rows.forEach((i, k) => s.set(X, R - 3 * K + k, ramp[i]));
    if (winter) {
      // 용마루 위에 얹힌 눈
      const sn = [3, 4, 4, 4, 3 - dark, 3 - dark];
      sn.forEach((i, k) => s.set(X, R - 4 * K + k, snow[i]));
    }
  }
}

interface FrontOpts {
  x0: number;
  y0: number;
  w: number;
  h: number;
  /** 칸마다: 'lattice' 살문, 'hall' 트인 대청, 'wall' 벽 */
  bays: ('lattice' | 'hall' | 'wall' | 'door')[];
  /** 기둥의 빛깔 단계 */
  post: Ramp;
  /** 기단 높이 */
  base: number;
  seed: number;
  band?: Ramp; // 처마 밑의 띠(절)
}

/**
 * 다듬은 긴 돌을 줄줄이 쌓은 기단(그림 점): 줄마다 돌의 길이가 들쭉날쭉하고 이음매가 어긋난다.
 * 돌마다 윗면이 볕, 줄 사이와 돌 사이는 가는 금. 오른쪽 끝(마구리)은 그늘.
 */
function ashlar(s: Sheet, xa: number, xb: number, y0: number, y1: number, stone: Ramp, seed: number, darkFrom: number): void {
  const H = 4 * K;
  for (let row = 0; y0 + row * H <= y1; row++) {
    let x = xa - Math.floor(hash2(row, 0, seed) * 12) - (row % 2) * 6 * K;
    for (let k = 0; x <= xb; k++) {
      const len = 19 + Math.floor(hash2(k, row, seed + 1) * 10);
      const t = 3.4 + (hash2(k, row, seed + 3) - 0.5) * 1.2;
      for (let j = 0; j < H; j++) {
        const Y = y0 + row * H + j;
        if (Y > y1) break;
        for (let i = 0; i < len; i++) {
          const X = x + i;
          if (X < xa || X > xb) continue;
          let v = t;
          if (j === 0) v += 1;
          if (i === len - 1 || j === H - 1) v = 1.6; // 가는 금
          if (X > darkFrom) v -= 1;
          s.set(X, Y, stone[clamp(Math.round(v), 1, 5)]);
        }
      }
      x += len;
    }
  }
}

// 기와집의 앞면: 돌 기단, 나무 기둥, 회벽, 살문, 툇마루. 자리는 1-라의 점.
function timberFront(s: Sheet, pal: Palette, o: FrontOpts): void {
  const { plaster, stone, wood } = pal;
  const wallBot = o.y0 + o.h - o.base - 1;
  const X0 = o.x0 * K;
  const X1 = (o.x0 + o.w) * K - 1;
  const Y0 = o.y0 * K;
  const WB = wallBot * K + K - 1;
  const YB = (o.y0 + o.h) * K - 1;
  // 회벽: 부드러운 큰 얼룩, 처마 그늘(아랫단이 흔들린다)
  for (let Y = Y0; Y <= WB; Y++) {
    for (let X = X0; X <= X1; X++) {
      let v = 2.4 + (vnoise(X / (7 * K), Y / (5 * K), o.seed) - 0.5) * 1.4;
      const shadeEdge = Y0 + 6 * K + Math.round(vnoise(X / (5 * K), 0, o.seed + 1) * 1.5 * K);
      if (Y < Y0 + 2 * K) v = 0;
      else if (Y < shadeEdge) v -= 1.3;
      s.set(X, Y, plaster[clamp(Math.round(v), 0, 3)]);
    }
  }
  if (o.band) {
    // 처마 밑의 수수한 띠 하나(1-라 그대로)
    for (let X = X0; X <= X1; X++) {
      const dash = X % (4 * K) < 2 * K ? 2 : 1;
      [2, 1, dash, dash, 1, 0].forEach((i, k) => s.set(X, Y0 + K + k, o.band![i]));
    }
  }
  // 기단: 다듬은 긴 돌
  ashlar(s, X0 - 4 * K, X1 + 4 * K, WB + 1, YB, stone, o.seed + 3, X1 - 2);
  const bayW = o.w / o.bays.length;
  // 창방: 위가 볕(가장 어두운 빛은 쓰지 않는다)
  const rail = (o.y0 + 5) * K;
  for (let X = X0; X <= X1; X++) {
    s.set(X, rail, o.post[2]);
    s.set(X, rail + 1, o.post[1]);
    s.set(X, rail + 2, o.post[1]);
    s.set(X, rail + 3, o.post[1]);
  }
  o.bays.forEach((kind, b) => {
    const bx = Math.round(o.x0 + b * bayW) + 3;
    const bw = Math.round(bayW) - 3;
    const top = o.y0 + 8;
    const BX = bx * K;
    const BW = bw * K;
    const TOP = top * K;
    if (kind === 'lattice' || kind === 'door') {
      // 살문: 한지를 바른 문에 가는 나무 살(살의 간격은 1-라 그대로). 문얼굴은 바깥이 짙고 안쪽이 밝다
      const half = Math.floor(bw / 2) * K;
      const bot = (wallBot - (kind === 'lattice' ? 5 : 0)) * K + K - 1;
      for (let Y = TOP; Y <= bot; Y++) {
        for (let X = BX; X < BX + BW; X++) {
          const l = (X - BX) % half;
          const j = Y - TOP;
          let c: Color;
          if (l < K || X >= BX + BW - K || j < K || Y > bot - K) c = l === 0 || X === BX + BW - 1 || j === 0 || Y === bot ? wood[2] : wood[3];
          else if (l % (3 * K) === 1 || j % (4 * K) === 1) c = wood[4];
          else c = j < 3 * K ? plaster[2] : plaster[3];
          s.calm(X, Y, c);
        }
      }
      if (kind === 'lattice') {
        // 머름(문 아래의 낮은 널벽): 위는 볕, 널의 금은 가는 한 점
        const my = (wallBot - 4) * K;
        for (let Y = my; Y <= WB; Y++) {
          for (let X = BX; X < BX + BW; X++) {
            const j = Y - my;
            const v = (X - BX) % (6 * K) === 0 ? 2 : j === 0 ? 5 : j === 1 ? 4 : Y === WB ? 2 : 3;
            s.set(X, Y, wood[v]);
          }
        }
      }
    } else if (kind === 'hall') {
      // 대청: 앞이 트인 마루방. 안은 따뜻한 어둠(먹빛이 아니다), 앞에는 볕 받는 마룻바닥
      const fy = (wallBot - 5) * K;
      let seam = BX + 4 + Math.floor(hash2(b, 1, o.seed + 6) * 4);
      const seams = new Set<number>();
      while (seam < BX + BW) {
        seams.add(seam);
        seam += 9 + Math.floor(hash2(seam, 2, o.seed + 6) * 3);
      }
      for (let Y = (top - 1) * K; Y <= WB; Y++) {
        for (let X = BX; X < BX + BW; X++) {
          if (Y >= fy) {
            const j = Y - fy;
            s.set(X, Y, wood[j === 0 ? 5 : j === 1 ? 4 : seams.has(X) ? 3 : 4]);
            continue;
          }
          const deep = (Y - (top - 1) * K) / Math.max(1, fy - (top - 1) * K);
          let c: Color = wood[0];
          if (deep > 0.35 && vnoise(X / 5, Y / 4, o.seed + 5) > 0.62) c = pal.bark[1]; // 안쪽 세간이 어렴풋하다
          s.calm(X, Y, c);
        }
      }
    }
  });
  // 기둥: 왼쪽 면이 볕, 오른쪽은 한 단계 그늘. 아래 주춧돌
  for (let b = 0; b <= o.bays.length; b++) {
    const x = clamp(Math.round(o.x0 + b * bayW) - (b === o.bays.length ? 3 : 0), o.x0, o.x0 + o.w - 3);
    const X = x * K;
    const face = [3, 3, 2, 2, 1, 1];
    for (let Y = (o.y0 + 2) * K; Y <= WB; Y++) {
      const dark = Y < (o.y0 + 6) * K ? 1 : 0;
      for (let i = 0; i < 3 * K; i++) s.set(X + i, Y, o.post[clamp(face[i] - dark, 0, 3)]);
    }
    const foot = [
      [4, 5, 5, 5, 4, 4, 4, 3, 3, 2],
      [4, 4, 4, 4, 3, 3, 3, 2, 2, 2],
    ];
    foot.forEach((row, k) => row.forEach((v, i) => s.set(X - K + i, WB + 1 + k, stone[v])));
  }
  // 가운데 섬돌(층계): 디딤 면은 볕, 챌판은 그늘
  const sx = (Math.round(o.x0 + o.w / 2) - 9) * K;
  const step = [5, 5, 4, 4, 3, 2];
  for (let k = 0; k < (o.base + 2) * K; k++) {
    const inset = Math.floor(k / K) < o.base / 2 ? 2 * K : 0;
    const Y = WB + 1 + k;
    for (let X = sx + inset; X < sx + 18 * K - inset; X++) {
      const v = step[k % (3 * K)] - (X >= sx + 18 * K - inset - 2 ? 1 : 0);
      s.set(X, Y, stone[clamp(v, 1, 5)]);
    }
  }
}

const WOOD_POST = (pal: Palette): Ramp => [pal.wood[0], pal.wood[2], pal.wood[3], pal.wood[4]];

const TILE_PARTS = (pal: Palette): Part[] => [
  [pal.tile, TILE_WASH, 1],
  [pal.plaster, PLASTER_WASH],
  [pal.stone, STONE_WASH],
  [pal.wood, WOOD_WASH, 1],
  [pal.snow, SNOW_WASH],
];

// ── 양반 댁 안채 ──────────────────────────────────────────────
export function* manorJob(pal: Palette, _variant = 0): Job {
  const s = new Sheet(160 * K, 106 * K);
  timberFront(s, pal, {
    x0: 14,
    y0: 62,
    w: 132,
    h: 40,
    bays: ['lattice', 'lattice', 'hall', 'hall', 'lattice', 'wall'],
    post: WOOD_POST(pal),
    base: 7,
    seed: 150,
  });
  yield;
  tileRoof(s, 0, 4, 160, 62, pal, 160);
  yield;
  const { px, dark } = yield* washJob(s, pal, 510, TILE_PARTS(pal));
  return {
    frames: [px],
    ax: 80 * K,
    ay: 103 * K,
    shades: [{ dx: 0, dy: -2, rx: 0, ry: 0, strength: 0.34, cast: { x0: -70, x1: 70, h: 46, side: 16, depth: 5 } }],
    wash: dark,
  };
}
export const manor: Maker = (pal, variant) => drainJob(manorJob(pal, variant));

// ── 사랑채 ───────────────────────────────────────────────────
export function* wingJob(pal: Palette, _variant = 0): Job {
  const s = new Sheet(94 * K, 86 * K);
  timberFront(s, pal, {
    x0: 10,
    y0: 48,
    w: 74,
    h: 35,
    bays: ['lattice', 'hall', 'lattice'],
    post: WOOD_POST(pal),
    base: 6,
    seed: 170,
  });
  yield;
  tileRoof(s, 0, 4, 94, 48, pal, 175);
  yield;
  const { px, dark } = yield* washJob(s, pal, 530, TILE_PARTS(pal));
  return {
    frames: [px],
    ax: 47 * K,
    ay: 83 * K,
    shades: [{ dx: 0, dy: -2, rx: 0, ry: 0, strength: 0.34, cast: { x0: -41, x1: 41, h: 40, side: 13, depth: 5 } }],
    wash: dark,
  };
}
export const wing: Maker = (pal, variant) => drainJob(wingJob(pal, variant));

// ── 작은 절의 법당 ─────────────────────────────────────────────
// 높은 돌 기단 위의 기와집. 기둥은 붉은 기가 도는 나무 빛, 처마 밑에 수수한 푸른 띠 하나.
export function* templeJob(pal: Palette, _variant = 0): Job {
  const s = new Sheet(146 * K, 112 * K);
  const post: Ramp = [CLOTH.madder[0], shadeOf(CLOTH.madder[1], 0.9), CLOTH.madder[1], CLOTH.madder[2]];
  timberFront(s, pal, {
    x0: 16,
    y0: 64,
    w: 114,
    h: 44,
    bays: ['door', 'door', 'door'],
    post,
    base: 10,
    seed: 190,
    band: CLOTH.jade,
  });
  yield;
  tileRoof(s, 0, 4, 146, 64, pal, 195);
  yield;
  const { px, dark } = yield* washJob(s, pal, 550, [...TILE_PARTS(pal), [CLOTH.madder, WOOD_WASH, 0], [post, WOOD_WASH, 0]], [post]);
  return {
    frames: [px],
    ax: 73 * K,
    ay: 109 * K,
    shades: [{ dx: 0, dy: -2, rx: 0, ry: 0, strength: 0.34, cast: { x0: -61, x1: 61, h: 50, side: 16, depth: 5 } }],
    wash: dark,
  };
}
export const temple: Maker = (pal, variant) => drainJob(templeJob(pal, variant));

// ── 담 ───────────────────────────────────────────────────────
// 흙빛 토석담에 기와를 얹은 담(사용자 결정 — spec 13.1의 59번: 몸은 황토·흙빛 토담에 들쭉날쭉한 막돌을 박은 꼴. 3.1차 시안의 흰 회벽은
// 조선 후기·궁궐·오늘날 정비한 담에 가깝다는 고증에 따라 바꿨다). 높이와 지붕마루·몸·아래 끝의 자리는 1-라 그대로다.
// 담은 한 칸씩 따로 그리고 맵에는 여러 칸이 이어 놓인다(칸마다 생김새를 제비뽑기로 — 이웃 칸을 모른다). 그래서 칸의 이음매가
// 곧은 금으로 보이지 않게 ① 기왓골의 자리는 칸마다 같고 골의 사이에서 칸이 바뀐다 ② 돌의 켜마다 칸 경계에 걸친 돌을 두되
// 그 돌은 생김새와 상관없이 같은 꼴·같은 빛이다(왼쪽 칸은 오른쪽 끝에, 오른쪽 칸은 왼쪽 끝에 반쪽씩) ③ 결의 무늬는 칸마다
// 되풀이된다(tileWash) ④ 칸의 옆 끝은 제 빛깔 그늘을 두지 않는다. 세로 담도 위아래로 같은 셈이다.
// 돌은 켜마다 높이가 다르고(5~7점), 켜 안에서도 한 점씩 오르내리며(켜의 경계가 흔들린다) 둥근 돌이 섞인다(ㅌ — 자로 잰 듯 고르지 않게).

/** 담 지붕의 기왓골 너비(칸마다 같다 — 합이 칸의 너비 16K) */
const WALL_RIBS = [5, 6, 5, 5, 6, 5];

/** 칸 안의 자리 → [골의 번호, 골 안의 자리(0 = 골), 골의 너비] */
function wallRib(a: number): readonly [number, number, number] {
  let x = ((a % (16 * K)) + 16 * K) % (16 * K);
  for (let r = 0; r < WALL_RIBS.length; r++) {
    if (x < WALL_RIBS[r]) return [r, x, WALL_RIBS[r]];
    x -= WALL_RIBS[r];
  }
  return [0, 0, WALL_RIBS[0]];
}

/** 담 돌 하나: 위·왼쪽이 볕, 아래·오른쪽이 그늘, 모서리는 둥글고(round면 둥근 돌), 흙벽에 그늘 한 점을 드리운다 */
interface WallStone {
  sx: number; // 왼쪽 끝(칸 밖으로 나갈 수 있다 — 칸 경계에 걸친 돌)
  w: number;
  y: number;
  h: number;
  R: Ramp; // [그늘, 몸, 볕]
  round?: boolean;
}

function drawStone(s: Sheet, st: WallStone, shadow: Color, xa = 0, xb = s.w - 1): void {
  const ex = st.sx + st.w - 1;
  const put = (x: number, y: number, c: Color): void => {
    if (x >= xa && x <= xb) s.set(x, y, c);
  };
  // 막돌의 꼴: 네모와 타원 사이(초타원 — 지수 p가 클수록 네모에 가깝다)에 테두리를 조금 울퉁불퉁하게 흔든다. 둥근 돌은 p = 2
  const rx = st.w / 2;
  const ry = st.h / 2;
  const p = st.round ? 2 : 2.3 + hash2(st.sx & 1023, st.y, 611) * 1.5;
  // 돌마다 한쪽으로 조금 기운다(윗선·아랫선이 수평으로 곧지 않게)
  const tilt = st.round ? 0 : (hash2(st.sx & 1023, st.y, 613) - 0.5) * 0.5;
  const seed = 612 + ((st.sx * 7 + st.y * 13 + st.w * 3) & 1023);
  const inside = (i: number, j: number): boolean => {
    if (i < st.sx || i > ex || j < 0 || j >= st.h) return false;
    const u = (i + 0.5 - st.sx - rx) / rx;
    const v = (j + 0.5 - ry) / ry + u * tilt;
    const wob = (vnoise(Math.atan2(v, u) * 1.6 + 3, 0.5, seed) - 0.5) * 0.55;
    return Math.abs(u) ** p + Math.abs(v) ** p <= 1.08 + wob;
  };
  // 흙벽에 드리운 그늘(아래·오른쪽 한 점)
  for (let j = 0; j < st.h; j++) {
    for (let i = st.sx; i <= ex; i++) {
      if (!inside(i, j)) continue;
      if (!inside(i, j + 1)) put(i + 1, st.y + j + 1, shadow);
      if (!inside(i + 1, j)) put(i + 1, st.y + j + 1, shadow);
    }
  }
  for (let j = 0; j < st.h; j++) {
    for (let i = st.sx; i <= ex; i++) {
      if (!inside(i, j)) continue;
      let c = st.R[1];
      if (!inside(i, j - 1) || !inside(i - 1, j)) c = st.R[2];
      if (!inside(i, j + 1) || !inside(i + 1, j)) c = st.R[0];
      put(i, st.y + j, c);
    }
  }
}

/** 담 돌의 빛깔: 잿빛이 대부분, 여섯에 하나쯤 따뜻한 잿빛(흙빛을 반만 섞은 돌 — ㅎ) */
function wallStoneRamps(pal: Palette): { gray: Ramp; dim: Ramp; warm: Ramp } {
  const { stone, clay } = pal;
  return {
    gray: [stone[2], stone[3], stone[4]],
    dim: [stone[2], mix(stone[2], stone[3], 0.5), stone[3]],
    warm: [mix(stone[2], clay[1], 0.45), mix(stone[3], clay[2], 0.45), mix(stone[4], clay[3], 0.45)],
  };
}

/** 흙벽(토담)의 빛: [처마 밑 짙은 줄, 처마 그늘, 몸, 볕, 돌이 드리운 그늘] */
function earthOf(pal: Palette): { line: Color; shade: Color; body: Color; lit: Color; drop: Color } {
  const { clay } = pal;
  return { line: clay[1], shade: clay[2], body: clay[3], lit: clay[4], drop: clay[2] };
}

/** 담 몸의 돌 켜 하나(가로 담): y는 켜의 위 끝, h는 켜의 높이(5~7), 칸 경계에 걸친 돌은 왼쪽에 a점·오른쪽에 b점 */
interface Course {
  y: number;
  h: number;
  a: number;
  b: number;
  R: 'gray' | 'dim';
  /** 아래 틈이 두 점 넘게 남아 한 점 높은 돌을 놓을 수 있는가 */
  room?: boolean;
}

/**
 * 담 몸의 돌 켜들(가로 담). 켜마다 칸 경계에 걸친 돌(생김새와 상관없이 같다)과, 그 사이의 생김새마다 다른 돌:
 * 너비 6~16, 높이는 켜의 높이이거나 한 점 낮고(위나 아래로 붙어 켜의 경계가 한 점씩 흔들린다), 넷에 하나쯤은 둥근 돌.
 */
function wallStones(pal: Palette, variant: number, W: number, courses: readonly Course[]): WallStone[] {
  const R = wallStoneRamps(pal);
  const out: WallStone[] = [];
  courses.forEach((c, row) => {
    // 칸 경계에 걸친 돌: 왼쪽 칸 오른쪽 끝(가운데 W)과 오른쪽 칸 왼쪽 끝(가운데 0)이 한 돌이다
    for (const at of [0, W]) out.push({ sx: at - c.a, w: c.a + c.b, y: c.y, h: c.h, R: R[c.R] });
    let x = c.b + 2 + (hash2(variant, row, 607) < 0.4 ? 1 : 0);
    const xb = W - c.a - 3;
    const seed = 600 + variant * 41 + row * 7;
    for (let k = 0; x <= xb; k++) {
      const rem = xb - x + 1;
      if (rem < 5) break;
      const round = hash2(k, 6, seed) < 0.27;
      let w = round ? 6 + Math.floor(hash2(k, 1, seed) * 4) : 6 + Math.floor(hash2(k, 1, seed) * 11);
      if (rem - w < 8) w = Math.min(rem, round ? 9 : 16);
      // 높이: 켜의 높이에서 한 점 낮거나(위나 아래로 붙는다) 같거나, 아래 틈이 넉넉하면 한 점 높다(5~7)
      const r2 = hash2(k, 2, seed);
      const h = clamp(c.h + (r2 < 0.4 ? -1 : r2 > 0.86 && c.room ? 1 : 0) - (round && c.h > 5 ? 1 : 0), 5, 7);
      const dy = h < c.h ? (hash2(k, 3, seed) < 0.5 ? 0 : c.h - h) : 0;
      const pick = hash2(k, 4, seed);
      out.push({ sx: x, w, y: c.y + dy, h, R: pick > 0.84 ? R.warm : pick > 0.5 ? R.dim : R.gray, round });
      x += w + 2 + (hash2(k, 5, seed) < 0.4 ? 1 : 0);
    }
  });
  return out;
}

export const wallH: Maker = (pal, variant) => {
  const W = 16 * K;
  const H = 30 * K;
  const s = new Sheet(W, H);
  const { tile: t, stone } = pal;
  const earth = earthOf(pal);
  const winter = pal.season === 'winter';
  // 지붕마루와 기와(줄 0~15): 마루는 위가 볕, 기왓골은 골마다 왼쪽 끝이 볕, 처마 끝은 둥근 막새
  for (let x = 0; x < W; x++) {
    const [r, p, wd] = wallRib(x);
    [3, 5, 4, 4, 3, 1].forEach((i, y) => s.calm(x, y, t[i])); // 마루는 매끈한 기와 한 줄(결 없이)
    for (let j = 0; j < 5; j++) {
      const b = 2.9 - j * 0.2 + (p === 0 ? -1.6 : p === 1 ? 1.2 : p === 2 ? 0.5 : p === wd - 1 ? -0.6 : 0);
      s.set(x, 6 + j, t[clamp(Math.round(b), 1, 5)]);
    }
    // 막새
    for (let d = 0; d < 3; d++) {
      let i: number;
      if (p === 0) i = 1;
      else if ((p === 1 || p === wd - 1) && d !== 1) i = 1;
      else if (d === 0) i = 3;
      else if (d === 2) i = 2;
      else i = p === 1 || p === 2 ? 4 : p === wd - 1 ? 2 : 3;
      s.set(x, 11 + d, t[i]);
    }
    s.set(x, 14, t[1]);
    s.calm(x, 15, earth.line);
    if (winter) {
      // 담 위에 눈이 얹혔다(기왓골의 끝은 보인다). 눈의 아랫단은 골마다 조금씩 다르다
      const snow = pal.snow;
      [2, 4, 4, 4, 4, 3, 3, 3].forEach((i, y) => s.set(x, y, snow[p === 0 && y >= 6 ? 2 : i]));
      const more = Math.floor(hash2(r, variant, 59) * 3);
      for (let y = 8; y < 8 + more; y++) s.set(x, y, snow[p === 1 || p === 2 ? 3 : 2]);
    }
  }
  // 담 몸(줄 16~47): 황토빛 흙벽. 위는 처마 그늘(결을 입히지 않는다 — 그늘 속에 밝은 점이 흩어지지 않게)
  for (let y = 16; y < 48; y++) for (let x = 0; x < W; x++) (y < 18 ? s.calm : s.set).call(s, x, y, y < 18 ? earth.shade : earth.body);
  // 돌 켜: 높이가 켜마다 다르다(6·7·5·6) — 칸 경계에 걸친 돌의 자리는 생김새와 상관없이 같다
  const stones = wallStones(pal, variant, W, [
    { y: 18, h: 6, a: 5, b: 6, R: 'gray' },
    { y: 25, h: 7, a: 11, b: 2, R: 'dim' },
    { y: 34, h: 5, a: 3, b: 7, R: 'gray', room: true },
    { y: 41, h: 6, a: 8, b: 4, R: 'dim' },
  ]);
  for (const st of stones) drawStone(s, st, earth.drop);
  // 장대석 기단(줄 48~59): 칸 경계에 걸친 긴 돌 하나와 생김새마다 다른 이음매. 위가 볕, 아래는 그늘
  // 칸 경계에 걸친 돌은 왼쪽으로 8점, 오른쪽으로 6점(한가운데가 아니어서 이음매의 사이가 18·14점으로 엇갈린다)
  const slabs: [number, number][] = [[-8, 5]];
  const cut = [[6, 23], [6, 15, 16, 23], [6, 12, 13, 23]][variant % 3];
  for (let k = 0; k < cut.length; k += 2) slabs.push([cut[k], cut[k + 1]]);
  slabs.push([W - 8, W + 5]);
  for (const [a, b] of slabs) {
    for (let x = Math.max(0, a); x <= Math.min(W - 1, b); x++) {
      for (let y = 48; y < H; y++) {
        let i = 3;
        if (y === 48) i = 4;
        else if (y >= 58) i = y === 59 ? 1 : 2;
        else if (y >= 56) i = 2;
        if (x === b) i = 1; // 이음매
        else if (x === a && y > 48 && y < 58) i = 4;
        s.set(x, y, stone[i]);
      }
    }
  }
  const ramps = rampsOf(pal, Object.values(wallStoneRamps(pal)));
  const dark = tileWash(s, ramps, pal, 640, variant, { big: 10, bigY: 5, amp: 1.25 }, { x: W });
  calmSprite(s);
  return { frames: [s.done()], ax: 8 * K, ay: 26 * K, shades: [{ dx: 3, dy: 2, rx: 10, ry: 4, strength: 0.3 }], wash: dark };
};

export const wallV: Maker = (pal, variant) => {
  const W = 14 * K;
  const H = 38 * K;
  const s = new Sheet(W, H);
  const { tile: t, stone } = pal;
  const earth = earthOf(pal);
  const roofEnd = (38 - 15) * K; // 위에서 본 지붕의 아랫줄 다음(1-라 줄 23 — 남쪽 처마 끝)
  // 위에서 본 기와 지붕(세로로 뻗는다): 가운데 마루, 왼쪽 비탈은 볕, 오른쪽 비탈은 그늘. 기왓골은 가로로, 칸마다 같은 자리
  // 열의 큰 명암: 왼쪽 처마 끝 · 왼쪽 비탈 · 마루 · 오른쪽 비탈 · 오른쪽 처마 끝
  const colTone = (x: number): number =>
    x === 0 ? 2.6 : x < 4 ? 4 : x < 12 ? 3.4 : x < 14 ? 5 : x === 14 ? 4.4 : x === 15 ? 3.4 : x < 24 ? 2 : x < 26 ? 1.4 : x === 26 ? 2 : 1.2;
  for (let y = 0; y < roofEnd; y++) {
    const [r, p, wd] = wallRib(y);
    for (let x = 0; x < W; x++) {
      let v = colTone(x);
      const ridge = x >= 12 && x <= 15;
      if (!ridge) v += p === 0 ? -1.2 : p === 1 ? 0.8 : p === 2 ? 0.4 : p === wd - 1 ? -0.4 : 0;
      s.set(x, y, t[clamp(Math.round(v), 1, 5)]);
    }
    if (pal.season === 'winter') {
      // 담 위에 눈이 얹혔다(가장자리의 기와 끝은 보인다). 눈의 가장자리는 골마다 한 점쯤 들쭉날쭉
      const snow = pal.snow;
      const l = 6 - (hash2(r, variant, 61) < 0.5 ? 1 : 0);
      const rr = 21 + (hash2(r, variant, 62) < 0.5 ? 1 : 0);
      for (let x = l; x <= rr; x++) {
        let i = x >= 12 && x <= 15 ? 4 : x < 12 ? (p === 0 ? 3 : 4) : p === 0 ? 2 : 3;
        if (x === l || x === rr) i = Math.max(2, i - 1);
        s.set(x, y, snow[i]);
      }
    }
  }
  // 남쪽 처마 끝
  for (let x = 0; x < W; x++) {
    s.set(x, roofEnd, t[2]);
    s.set(x, roofEnd + 1, t[1]);
  }
  // 남쪽 끝의 마구리면(줄 48~75, 가로 4~23): 흙벽에 막돌, 아래는 장대석
  const fx0 = 2 * K;
  const fx1 = W - 2 * K - 1;
  const fy = roofEnd + 2;
  for (let y = fy; y < fy + 16; y++) for (let x = fx0; x <= fx1; x++) (y < fy + 3 ? s.calm : s.set).call(s, x, y, y === fy ? earth.line : y < fy + 3 ? earth.shade : earth.body);
  const R = wallStoneRamps(pal);
  // 두 켜(높이 6·5) — 켜 안에서 돌이 한 점씩 오르내리고 둥근 돌이 섞인다
  [
    [fy + 3, 6],
    [fy + 10, 5],
  ].forEach(([cy, ch], row) => {
    let x = fx0 + (row === 0 ? 1 : 0) + Math.floor(hash2(row, variant, 63) * 3);
    for (let k = 0; x <= fx1 - 3; k++) {
      const seed = 650 + variant * 13 + row;
      const round = hash2(k, 6, seed) < 0.3;
      const w = Math.min(fx1 - 1 - x, round ? 6 + Math.floor(hash2(k, 1, seed) * 3) : 6 + Math.floor(hash2(k, 1, seed) * 8));
      if (w < 4) break;
      const h = Math.max(5, ch - (hash2(k, 2, seed) < 0.45 ? 1 : 0));
      const dy = ch - h > 0 && hash2(k, 3, seed) < 0.5 ? ch - h : 0;
      const pick = hash2(k, 4, seed);
      drawStone(s, { sx: x, w, y: cy + dy, h, R: pick > 0.84 ? R.warm : pick > 0.5 ? R.dim : R.gray, round }, earth.drop, fx0, fx1);
      x += w + 2 + (hash2(k, 5, seed) < 0.35 ? 1 : 0);
    }
  });
  const by = fy + 16;
  const cut = variant % 2 === 0 ? -1 : fx0 + 8 + Math.floor(hash2(variant, 7, 64) * 5);
  for (let y = by; y < H; y++) {
    for (let x = fx0; x <= fx1; x++) {
      let i = 3;
      if (y === by) i = 4;
      else if (y >= H - 2) i = y === H - 1 ? 1 : 2;
      else if (y >= H - 4) i = 2;
      if (x === cut || x === fx1) i = Math.min(i, x === cut ? 1 : 2);
      else if ((x === fx0 || x === cut + 1) && y > by && y < H - 2) i = 4;
      s.set(x, y, stone[i]);
    }
  }
  const ramps = rampsOf(pal, Object.values(R));
  const dark = tileWash(s, ramps, pal, 660, variant, { big: 6, bigY: 10, amp: 1.5 }, { y: 16 * K });
  calmSprite(s);
  return { frames: [s.done()], ax: 7 * K, ay: 34 * K, shades: [{ dx: 5, dy: -6, rx: 7, ry: 10, strength: 0.3 }], wash: dark };
};

// ── 대문 ─────────────────────────────────────────────────────
// 기둥 둘에 작은 기와지붕을 얹은 문. 0은 열린 문, 1은 닫힌 문.
export function* gateJob(pal: Palette, variant = 0): Job {
  const W = 64 * K;
  const H = 62 * K;
  const s = new Sheet(W, H);
  const { wood, stone } = pal;
  const yBot = 62 - 4; // 1-라의 줄
  const YB = yBot * K + K - 1;
  const top = 30 * K;
  if (variant === 1) {
    // 닫힌 문짝 둘: 세로 널(가는 금), 띠장 둘, 나뭇결은 세로
    for (let Y = top; Y <= YB; Y++) {
      for (let X = 17 * K; X < 47 * K; X++) {
        const leaf = X < 32 * K ? X - 17 * K : X - 32 * K; // 0~29
        const j = Y - top;
        let v: number;
        if (j < K) v = j === 0 ? 1 : 2; // 위: 인방 밑 그늘
        else if (leaf === 0) v = 2;
        else if (leaf === 1) v = 4; // 문짝의 볕 받는 끝
        else if (leaf === 15 * K - 1) v = 1; // 두 문짝이 맞닿는 금
        else if (leaf === 15 * K - 2) v = 2;
        else if (leaf % (4 * K) === 0) v = 2; // 널의 금
        else v = 3 + (hash2(X, (Y + Math.floor(hash2(X, 9, 222) * 8)) >> 3, 221) > 0.84 ? 1 : 0);
        if (j >= K && leaf > 0 && leaf < 15 * K - 2) {
          const band = (r: number): number => (r === 0 ? 5 : r === 1 || r === 2 ? 4 : r === 3 ? 2 : -1);
          const ta = band(Y - 38 * K);
          const tb = band(Y - (yBot - 8) * K);
          if (ta >= 0) v = ta;
          else if (tb >= 0) v = tb;
        }
        s.set(X, Y, wood[clamp(v, 0, 5)]);
      }
    }
    // 문고리: 짙은 쇠빛 두 점과 볕 받는 두 점 무리
    for (const x of [29 * K, 34 * K]) {
      s.calm(x, 45 * K, pal.tile[1]);
      s.calm(x + 1, 45 * K, pal.tile[1]);
      s.calm(x, 45 * K + 1, pal.tile[2]);
      s.calm(x + 1, 45 * K + 1, pal.tile[3]);
      s.calm(x, 46 * K, pal.tile[4]);
      s.calm(x + 1, 46 * K, pal.tile[3]);
    }
  } else {
    // 안으로 열어 젖힌 문짝이 기둥 곁에 비스듬히 보인다(왼쪽은 볕, 오른쪽은 그늘 — 널마다 가는 금)
    const L = [4, 3, 3, 2, 3, 3, 2, 3, 2, 1];
    const Rr = [3, 2, 2, 1, 2, 2, 1, 2, 1, 1];
    for (let Y = top; Y <= YB; Y++) {
      for (let k = 0; k < 5 * K; k++) {
        const dy = Math.round(k * 0.6);
        const edge = Y === top ? 1 : Y === YB ? -1 : 0;
        s.set(17 * K + k, Y - dy, wood[clamp(L[k] + edge, 0, 5)]);
        s.set(47 * K - 1 - k, Y - dy, wood[clamp(Rr[k] + edge, 0, 5)]);
      }
    }
    // 문지방: 위가 볕
    for (let X = 17 * K; X < 47 * K; X++) [4, 3, 2, 1].forEach((v, k) => s.set(X, yBot * K + k, wood[v]));
  }
  // 기둥: 네모난 나무 기둥 — 왼쪽 면이 볕, 앞면, 오른쪽 끝은 한 단계 그늘. 아래 주춧돌(윗면이 볕)
  for (const x of [12, 47]) {
    const X = x * K;
    const face = [4, 4, 4, 4, 3, 3, 3, 3, 2, 2];
    for (let Y = 24 * K; Y < (yBot + 2) * K; Y++) face.forEach((v, i) => s.set(X + i, Y, wood[v]));
    for (let i = 0; i < 7 * K; i++) {
      const xx = X - K + i;
      const lit = i < 3 * K + 2;
      s.set(xx, (yBot + 2) * K, stone[i === 0 || i === 7 * K - 1 ? 4 : lit ? 5 : 4]);
      s.set(xx, (yBot + 2) * K + 1, stone[lit ? 4 : 3]);
      s.set(xx, (yBot + 3) * K, stone[lit ? 3 : 2]);
      s.set(xx, (yBot + 3) * K + 1, stone[2]);
    }
  }
  // 인방: 위가 볕, 아래로 그늘(가장 어두운 빛은 쓰지 않는다)
  const beam = [4, 4, 3, 3, 3, 2, 2, 1];
  for (let X = 10 * K; X < 54 * K; X++) beam.forEach((v, k) => s.set(X, 26 * K + k, wood[v]));
  yield;
  tileRoof(s, 2, 4, 60, 22, pal, 230);
  const { px, dark } = yield* washJob(s, pal, 700 + variant, [
    [pal.tile, TILE_WASH, 1],
    [pal.wood, WOOD_WASH, 1],
    [pal.stone, STONE_WASH],
    [pal.snow, SNOW_WASH],
  ]);
  return { frames: [px], ax: 8 * K, ay: (62 - 6) * K, sort: 3, shades: [{ dx: 30, dy: 2, rx: 30, ry: 4, strength: 0.28 }], wash: dark };
}
export const gate: Maker = (pal, variant) => drainJob(gateJob(pal, variant));
