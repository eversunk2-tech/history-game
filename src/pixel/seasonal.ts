// 계절의 자리에 놓는 것들. 그 계절의 맵에만 놓인다(src/content/maps/neutigol.ts의 seasonalOf).
//   여름(단오의 냇가): 큰 나무에 맨 그네, 모래를 깐 씨름판과 씨름하는 두 사람, 창포 삶은 물을 담은 함지
//   가을: 벤 논에 세워 말리는 볏단, 타작 마당의 볏단 더미와 개상과 멍석, 길 떠나는 사람의 짐
//   겨울: 쓸어 모은 눈
// 꾸밈없이 그린다. 그네·씨름·창포물은 단오의 놀이로 기록에 있으나(F60) 생김새는 꾸민 것이다.

import { CLOTH, HAIR, SKIN, type Palette, type Ramp } from './palette';
import { personFrame, type Person } from './people';
import { Px, clamp, hash2, mix, vnoise, type Color } from './px';
import { rim, type SpriteDef } from './shapes';

type Maker = (pal: Palette, variant: number) => SpriteDef;

/** 벼 이삭의 빛: 가을에는 누렇고, 다른 계절의 그림 벌에서도 볏단은 누런 짚빛으로 보인다 */
function earsOf(pal: Palette): Ramp {
  return pal.paddyState === 'gold' ? pal.crop : [pal.thatch[2], pal.thatch[4], pal.thatch[5], pal.thatch[6]];
}

// ── 그네 ─────────────────────────────────────────────────────
// 큰 나무의 가지에 두 줄을 매고 발판을 달았다. 아이가 서서 구르면 앞뒤로 오간다.
const SWING_RIDER: Person = {
  build: 'teen',
  sex: 'f',
  bottom: 'skirt',
  hair: 'braid',
  hairColor: HAIR.black,
  skin: SKIN.fair,
  top: CLOTH.cotton,
  lower: CLOTH.rose,
  shoes: CLOTH.straw,
  ribbon: CLOTH.madder[2],
  blush: true,
};

export const swing: Maker = (pal, variant) => {
  const W = 46;
  const H = 50;
  const cx = 23;
  const topY = 5;
  const seatY = 40;
  const rope = [pal.thatch[1], pal.thatch[4]];
  const frameAt = (d: number, rider: boolean, walkFrame: number): Px => {
    const px = new Px(W, H);
    const rise = Math.round((d * d) / 60);
    const sx = cx + d;
    const sy = seatY - rise;
    // 줄을 맨 굵은 곁가지: 나무의 줄기 쪽(왼쪽)에서 뻗어 나온다
    const bark = pal.bark;
    for (let x = 0; x <= cx + 9; x++) {
      const y = 8 - Math.round((x / (cx + 9)) * 3);
      const thick = x < 12 ? 4 : x < 24 ? 3 : 2;
      for (let k = 0; k < thick; k++) px.set(x, y + k, bark[k === 0 ? 3 : k === thick - 1 ? 1 : 2]);
      if (hash2(x, 7, 983) < 0.2) px.set(x, y, bark[4]);
    }
    // 줄 두 가닥(뒤쪽 줄이 조금 어둡다)
    px.line(cx + 5, topY, sx + 5, sy, rope[0]);
    if (rider) {
      const who = personFrame(SWING_RIDER, 'left', d === 0 ? 'idle' : 'walk', walkFrame);
      px.blit(who, sx - 12, sy - 30);
    }
    px.line(cx - 5, topY, sx - 5, sy, rope[1]);
    // 발판
    for (let i = -6; i <= 6; i++) {
      px.set(sx + i, sy, pal.wood[i < -2 ? 5 : 4]);
      px.set(sx + i, sy + 1, pal.wood[i > 3 ? 1 : 2]);
    }
    px.set(sx - 5, sy - 1, rope[1]);
    px.set(sx + 5, sy - 1, rope[0]);
    px.outline(pal.ink);
    // 가지 끝의 잎 뭉치(나무갓 아래쪽으로 이어진다)
    const leaf = pal.leafWarm;
    for (const [lx, ly, rx, ry] of [
      [cx + 8, 3, 6.5, 3.6],
      [cx - 8, 2, 7.5, 3.2],
      [5, 3, 6, 3.4],
    ]) {
      for (let y = 0; y <= 8; y++) {
        for (let x = 0; x < W; x++) {
          const dx = (x + 0.5 - lx) / rx;
          const dy = (y + 0.5 - ly) / ry;
          if (dx * dx + dy * dy > 1 + (hash2(x, y, 981) - 0.5) * 0.5) continue;
          const v = 3.2 - dx * 1.4 - dy * 1.6 + (hash2(x >> 1, y, 982) - 0.5) * 1.6;
          px.set(x, y, leaf[clamp(Math.round(v), 1, leaf.length - 1)]);
        }
      }
    }
    return px;
  };
  if (variant === 0) return { frames: [frameAt(0, false, 0)], ax: cx, ay: 46, sort: 2 };
  // 가운데 → 앞 → 앞 끝 → 뒤 → 뒤 끝. 구를 때 무릎을 굽혔다 편다(걷는 장을 빌려 쓴다).
  const frames = [frameAt(0, true, 0), frameAt(-6, true, 1), frameAt(-10, true, 0), frameAt(6, true, 3), frameAt(10, true, 2)];
  return { frames, ax: cx, ay: 46, sort: 2, seq: [0, 1, 2, 2, 1, 0, 3, 4, 4, 3], rate: 4.6, shades: [{ dx: 2, dy: 1, rx: 9, ry: 3, strength: 0.24 }] };
};

// ── 씨름판 ───────────────────────────────────────────────────
// 풀밭에 모래를 둥글게 깔았다. 땅바닥에 깔린 그림이라 테두리가 없다.
export const sandring: Maker = (pal) => {
  const W = 72;
  const H = 42;
  const px = new Px(W, H);
  const sand: Color[] = [mix(pal.path[2], pal.yard[1], 0.5), pal.yard[2], pal.yard[3], pal.yard[4], mix(pal.yard[4], pal.plaster[3], 0.5)];
  const cx = W / 2;
  const cy = H / 2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - cx) / (W / 2 - 1);
      const dy = (y + 0.5 - cy) / (H / 2 - 1);
      const wob = (vnoise(x / 5.1, y / 4.3, 931) - 0.5) * 0.16;
      const d = dx * dx + dy * dy + wob;
      if (d > 1) continue;
      // 가장자리는 풀밭으로 풀린다
      if (d > 0.9 && ((x + y) & 1) === 0) continue;
      let v = 2.6 + (vnoise(x / 9, y / 6, 932) - 0.5) * 2.2 + (hash2(x, y, 933) - 0.5) * 0.8;
      // 둘레에 모래가 도톰하게 쌓였다(위쪽은 밝고 아래쪽은 그늘)
      if (d > 0.72) v += dy < 0 ? 0.9 : -1.2;
      // 발에 패인 자국
      if (d < 0.5 && vnoise(x / 3.1, y / 2.3, 934) > 0.74) v -= 1.1;
      px.set(x, y, sand[clamp(Math.round(v), 0, 4)]);
    }
  }
  return { frames: [px], ax: Math.round(cx), ay: Math.round(cy) };
};

// ── 씨름하는 두 사람 ──────────────────────────────────────────
// 허리의 띠를 맞잡고 밀고 당긴다. 옷은 입은 채로 수수하게 그린다.
const WRESTLER_A: Person = {
  build: 'adult',
  sex: 'm',
  bottom: 'pants',
  hair: 'braid',
  hairColor: HAIR.brown,
  skin: SKIN.tan,
  top: CLOTH.hemp,
  lower: CLOTH.cotton,
  shoes: CLOTH.straw,
  sash: CLOTH.earth,
};
const WRESTLER_B: Person = {
  build: 'adult',
  sex: 'm',
  bottom: 'pants',
  hair: 'topknot',
  hairColor: HAIR.black,
  skin: SKIN.fair,
  top: CLOTH.cotton,
  lower: CLOTH.ash,
  shoes: CLOTH.straw,
  sash: CLOTH.hemp,
};

export const wrestlers: Maker = () => {
  const W = 40;
  const H = 36;
  // 넉 장: 맞잡음 → 왼쪽이 밀어붙임 → 맞잡음 → 오른쪽이 밀어붙임
  const frames = [
    [1, 1, 0],
    [0, 2, 1],
    [3, 3, 0],
    [2, 0, -1],
  ].map(([fa, fb, push]) => {
    const px = new Px(W, H);
    px.blit(personFrame(WRESTLER_B, 'left', 'work', fb), 14 + push, 3);
    px.blit(personFrame(WRESTLER_A, 'right', 'work', fa), 2 + push, 3);
    return px;
  });
  return { frames, ax: 20, ay: 33, seq: [0, 1, 0, 2, 3, 2], rate: 2.6, shades: [{ dx: 2, dy: 0, rx: 13, ry: 3.5, strength: 0.26 }] };
};

// ── 창포 삶은 물을 담은 함지 ─────────────────────────────────────
export const basin: Maker = (pal) => {
  const W = 24;
  const H = 16;
  const px = new Px(W, H);
  const { wood } = pal;
  const cx = 12;
  // 옆면
  for (let y = 6; y < H - 2; y++) {
    for (let x = cx - 10; x <= cx + 10; x++) {
      const dx = (x - cx) / 10;
      const bottom = 8 + Math.round(Math.sqrt(Math.max(0, 1 - dx * dx)) * 5);
      if (y > bottom) continue;
      let v = 3 - dx * 1.6;
      if ((x + 100) % 4 === 0) v -= 1; // 널의 이음
      if (y === bottom) v = 1;
      px.set(x, y, wood[clamp(Math.round(v), 0, 5)]);
    }
  }
  // 윗면: 나무 테와 물
  for (let y = 1; y <= 11; y++) {
    for (let x = cx - 11; x <= cx + 11; x++) {
      const dx = (x + 0.5 - cx) / 11;
      const dy = (y + 0.5 - 6) / 5;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      const inner = (dx * dx) / 0.72 + (dy * dy) / 0.6;
      if (inner < 1) {
        // 창포를 삶아 우린 물: 풀빛이 돈다. 긴 잎이 몇 가닥 떠 있다
        let c: Color = mix(pal.water[1], pal.leafDeep[2], 0.55);
        if (dy > 0.1 && dx < 0.2 && hash2(x >> 1, y, 941) < 0.4) c = mix(pal.water[3], pal.leafWarm[3], 0.5);
        if ((x + y * 2) % 7 === 0 && inner < 0.8) c = pal.leafWarm[4];
        if (inner > 0.8) c = wood[0];
        px.set(x, y, c);
      } else {
        px.set(x, y, wood[clamp(Math.round(4.4 - dx * 1.2 - dy * 1.2), 2, 5)]);
      }
    }
  }
  rim(px, pal.ink, pal.inkSoft);
  return { frames: [px], ax: 12, ay: 13, shades: [{ dx: 3, dy: 0, rx: 12, ry: 3.5, strength: 0.28 }] };
};

// ── 볏단 ─────────────────────────────────────────────────────
/** 세운 볏단 하나: 허리를 묶고 이삭 쪽이 위로 퍼진다. (cx, yBot)이 밑동의 가운데. */
function stook(px: Px, pal: Palette, cx: number, yBot: number, h: number, wide: number, seed: number, lean = 0): void {
  const straw = pal.thatch;
  const ears = earsOf(pal);
  const n = straw.length - 1;
  const waist = 0.36;
  for (let k = 0; k <= h; k++) {
    const t = k / h; // 0 위 → 1 아래
    const y = yBot - h + k;
    const half = t < waist ? 1.6 + (wide * 0.72 - 1.6) * (1 - t / waist) : 1.6 + (wide - 1.6) * ((t - waist) / (1 - waist));
    const mid = cx + lean * (1 - t);
    for (let x = Math.round(mid - half); x <= Math.round(mid + half); x++) {
      const u = (x - mid) / Math.max(1, half);
      const strand = hash2(x, Math.floor((k + hash2(x, 3, seed) * 4) / 4), seed + 1);
      if (t < waist - 0.06) {
        // 이삭: 누런 낟알이 다닥다닥
        let v = 2.2 - u * 0.9 + (strand - 0.5) * 1.8 - (t > waist - 0.16 ? 0.8 : 0);
        if (k === 0 && hash2(x, k, seed + 2) < 0.45) continue; // 끝은 삐죽삐죽
        px.set(x, y, ears[clamp(Math.round(v), 0, ears.length - 1)]);
      } else if (Math.abs(t - waist) < 0.07) {
        px.set(x, y, straw[u > 0.2 ? 0 : 1]); // 묶은 새끼줄
      } else {
        let v = 4.3 - u * 1.5 + (strand - 0.5) * 2 - (t > 0.9 ? 1 : 0);
        if (hash2(x, k, seed + 3) < 0.06) v += 1;
        px.set(x, y, straw[clamp(Math.round(v), 1, n)]);
      }
    }
  }
}

// 벤 논에 볏단 셋을 맞대어 세워 말린다
export const sheaf: Maker = (pal, variant) => {
  const W = 26;
  const H = 26;
  const px = new Px(W, H);
  if (variant === 0) {
    stook(px, pal, 8, 22, 17, 4.5, 951, 3);
    stook(px, pal, 18, 22, 17, 4.5, 952, -3);
    stook(px, pal, 13, 23, 19, 5, 953, 0);
  } else if (variant === 1) {
    stook(px, pal, 9, 22, 16, 4.5, 954, 2.5);
    stook(px, pal, 17, 23, 18, 5, 955, -2.5);
  } else {
    stook(px, pal, 13, 23, 20, 6, 956, 0);
    stook(px, pal, 6, 23, 13, 3.6, 957, 2);
    stook(px, pal, 20, 23, 14, 3.8, 958, -2);
  }
  rim(px, pal.ink, pal.inkSoft);
  return { frames: [px], ax: 13, ay: 23, shades: [{ dx: 3, dy: 0, rx: 11, ry: 3, strength: 0.26 }] };
};

// 타작 마당에 쌓아 둔 볏단 더미: 이삭을 한쪽으로 가지런히 눕혀 쌓았다
export const sheafpile: Maker = (pal) => {
  const W = 38;
  const H = 28;
  const px = new Px(W, H);
  const straw = pal.thatch;
  const ears = earsOf(pal);
  const n = straw.length - 1;
  // 세 켜: 아래가 넓다
  [
    [2, 34, 24],
    [5, 32, 17],
    [9, 28, 10],
  ].forEach(([x0, x1, yBot], layer) => {
    for (let y = yBot - 7; y <= yBot; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = (y - (yBot - 7)) / 7;
        const bundle = Math.floor((x - x0) / 8);
        const inB = (x - x0) % 8;
        const round = Math.abs(inB - 3.5) / 4;
        if (t < 0.25 && round > 0.75) continue;
        let v = 4.6 - t * 2.2 - round * 1.1 + (hash2(x, y >> 1, 961 + layer) - 0.5) * 1.6;
        if (inB === 7) v = 1;
        let c: Color = straw[clamp(Math.round(v), 1, n)];
        // 이삭 쪽(오른쪽 끝의 볏단은 이삭이 보인다)
        if (x > x1 - 7) c = ears[clamp(Math.round(2.4 - t * 1.4 + (hash2(x, y, 962) - 0.5) * 2), 0, ears.length - 1)];
        // 볏단을 묶은 줄
        if ((bundle + layer) % 2 === 0 && inB === 3 && x <= x1 - 7) c = straw[1];
        px.set(x, y, c);
      }
    }
  });
  rim(px, pal.ink, pal.inkSoft);
  return { frames: [px], ax: 19, ay: 24, shades: [{ dx: 5, dy: 0, rx: 19, ry: 4.5, strength: 0.3 }] };
};

// ── 개상 ─────────────────────────────────────────────────────
// 굵은 통나무를 낮은 다리에 얹었다. 볏단을 들어 여기에 내리치면 낟알이 떨어진다.
export const gaesang: Maker = (pal) => {
  const W = 40;
  const H = 22;
  const px = new Px(W, H);
  const { wood, bark, thatch } = pal;
  const ears = earsOf(pal);
  // 다리 둘(엇걸어 세운 나무)
  for (const lx of [9, 29]) {
    px.line(lx - 3, 17, lx + 2, 9, wood[2]);
    px.line(lx - 2, 17, lx + 3, 9, wood[1]);
    px.line(lx + 3, 17, lx - 2, 9, wood[3]);
    px.line(lx + 4, 17, lx - 1, 9, wood[1]);
  }
  // 통나무
  for (let y = 4; y <= 11; y++) {
    for (let x = 3; x <= 36; x++) {
      const t = (y - 4) / 7;
      let v = 3.6 - t * 3 + (hash2(x >> 2, y, 971) - 0.5) * 1.1;
      if (hash2(x, y, 972) < 0.05) v -= 1;
      // 볏단에 맞아 닳은 윗면은 밝다
      if (t < 0.3 && x > 10 && x < 30) v += 0.8;
      px.set(x, y, bark[clamp(Math.round(v), 0, 4)]);
    }
  }
  // 나무의 자른 끝
  for (let y = 4; y <= 11; y++) {
    px.set(3, y, thatch[y < 7 ? 5 : 4]);
    px.set(4, y, thatch[y % 3 === 0 ? 3 : 4]);
  }
  rim(px, pal.ink, pal.inkSoft);
  // 떨어진 낟알과 지푸라기(테두리 없이 땅에 흩어진다)
  for (let k = 0; k < 46; k++) {
    const x = 2 + Math.floor(hash2(k, 1, 973) * 36);
    const y = 15 + Math.floor(hash2(k, 2, 974) * 6);
    if (px.get(x, y) !== 0) continue;
    px.set(x, y, hash2(k, 3, 975) < 0.7 ? ears[ears.length - 1 - (k % 2)] : thatch[3]);
  }
  return { frames: [px], ax: 20, ay: 18, shades: [{ dx: 4, dy: 0, rx: 19, ry: 3.5, strength: 0.28 }] };
};

// ── 멍석에 널어 말리는 낟알 ─────────────────────────────────────
// 짚으로 엮은 네모난 자리. 땅바닥에 깔린 그림이라 테두리는 짚의 어두운 빛으로만 두른다.
export const grainmat: Maker = (pal) => {
  const W = 46;
  const H = 28;
  const px = new Px(W, H);
  const straw = pal.thatchOld;
  const ears = earsOf(pal);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const corner = (x < 3 || x > W - 4) && (y < 3 || y > H - 4) && Math.abs(x - (x < 3 ? 3 : W - 4)) + Math.abs(y - (y < 3 ? 3 : H - 4)) > 2;
      if (corner) continue;
      // 엮은 결: 가로 줄과 세로 날이 엇갈린다
      let v = 3.4 + ((x >> 1) + y) % 2 * 0.9 + (hash2(x, y, 985) - 0.5) * 0.9;
      if (y % 4 === 0) v -= 1;
      if (x === 1 || y === H - 2 || x === W - 2) v = 1;
      else if (y === 1) v = 2;
      px.set(x, y, straw[clamp(Math.round(v), 1, straw.length - 1)]);
    }
  }
  // 널어 놓은 낟알: 가운데가 도톰하다
  for (let y = 4; y < H - 4; y++) {
    for (let x = 5; x < W - 5; x++) {
      const dx = (x + 0.5 - W / 2) / (W / 2 - 6);
      const dy = (y + 0.5 - H / 2) / (H / 2 - 5);
      const d = dx * dx + dy * dy + (vnoise(x / 3.3, y / 2.7, 986) - 0.5) * 0.5;
      if (d > 1) continue;
      if (d > 0.82 && hash2(x, y, 987) < 0.5) continue;
      const v = 2.2 - dx * 0.5 - dy * 1.0 + (hash2(x, y, 988) - 0.5) * 2.2;
      px.set(x, y, ears[clamp(Math.round(v), 0, ears.length - 1)]);
    }
  }
  return { frames: [px], ax: 23, ay: 14 };
};

// ── 길 떠나는 사람의 짐 꾸러미 ───────────────────────────────────
export const bundle: Maker = (pal, variant) => {
  const W = 18;
  const H = 14;
  const px = new Px(W, H);
  const cloth = variant === 0 ? CLOTH.hemp : CLOTH.cotton;
  const blob = (cx: number, cy: number, rx: number, ry: number, seed: number): void => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy > 1) continue;
        let v = 2.4 - dx * 1.1 - dy * 1.2;
        if (hash2(x, y, seed) < 0.12) v -= 1;
        px.set(x, y, cloth[clamp(Math.round(v), 0, 3)]);
      }
    }
  };
  blob(8, 8, 6, 4.4, 991);
  // 매듭
  px.set(8, 3, cloth[3]);
  px.set(7, 2, cloth[2]);
  px.set(9, 2, cloth[1]);
  px.set(8, 4, cloth[0]);
  if (variant === 1) {
    blob(14, 10, 3.4, 2.6, 992);
    // 새로 삼은 짚신 한 켤레
    px.set(2, 11, pal.thatch[5]);
    px.set(3, 11, pal.thatch[4]);
    px.set(2, 12, pal.thatch[3]);
    px.set(3, 12, pal.thatch[2]);
  }
  rim(px, pal.ink, pal.inkSoft);
  return { frames: [px], ax: 9, ay: 12, shades: [{ dx: 2, dy: 0, rx: 8, ry: 2.4, strength: 0.24 }] };
};

// ── 쓸어 모은 눈 ──────────────────────────────────────────────
export const snowpile: Maker = (pal, variant) => {
  const W = variant === 0 ? 20 : 28;
  const H = variant === 0 ? 11 : 14;
  const px = new Px(W, H);
  const snow = pal.snow;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const dx = (x + 0.5 - W / 2) / (W / 2 - 1);
      const top = H - 2 - (H - 4) * Math.sqrt(Math.max(0, 1 - dx * dx)) * (0.8 + vnoise(x / 4.1, variant, 995) * 0.3);
      if (y < top) continue;
      const t = (y - top) / Math.max(1, H - 2 - top);
      let v = 4 - dx * 1.3 - t * 1.6 + (hash2(x, y, 996) - 0.5) * 0.6;
      if (y === H - 2) v = Math.min(v, 1);
      px.set(x, y, snow[clamp(Math.round(v), 0, snow.length - 1)]);
    }
  }
  rim(px, snow[0], snow[1]);
  return { frames: [px], ax: Math.round(W / 2), ay: H - 2, shades: [{ dx: 2, dy: 0, rx: W / 2, ry: 2.4, strength: 0.16 }] };
};
