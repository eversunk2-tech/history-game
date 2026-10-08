// 느티골 — 1395년 봄. 가로 96 × 세로 72칸.
//
// 뒷산을 등지고 냇물을 앞에 둔 마을이다. 구역은 일곱(spec 6.3):
//   마을 안(집들, 우물가, 타작 마당, 어귀의 큰 느티나무) · 들판(높은 논, 낮은 논, 텃밭, 논둑길) · 냇가(징검다리, 나무다리)
//   한양 가는 길(북쪽) · 뒷산과 절 가는 길 · 향교 가는 길(서쪽) · 고갯길(동쪽)
//
// 마을과 집의 생김새는 꾸민 것이다. 그때 없던 것(장터, 서당, 엽전, 줄 맞춘 모, 간판과 글씨)은 놓지 않는다.
// 1395년에는 볍씨를 논에 바로 뿌렸으므로 봄의 논은 갈아엎은 흙과 물 댄 논이다.
// 같은 맵이 뒤 이야기에서 덧입혀진다(1795년에 장터가 서는 등). 그래서 한 칸씩 적지 않고 놓는 말로 짓는다.

import type { Condition, RoleId } from '../../engine/types';
import { MapBuilder } from '../../map/build';
import { T, type Dweller, type Gate, type MapData, type Note, type Spot, type Who, type Zone } from '../../map/types';
import { vnoise } from '../../pixel/px';

export const NEUTIGOL_W = 96;
export const NEUTIGOL_H = 72;
const SEED = 1395;

/** 여자아이의 모습인가(양반 집 딸, 또는 여자아이 모습을 고른 농민·노비 집 아이) */
export function isGirl(who: Who): boolean {
  if (who.role === 'daughter') return true;
  if (who.role === 'son') return false;
  return who.look === 'girl';
}

/** 꺾은선 위에서 x에 맞는 값을 잇는다 */
function along(points: readonly (readonly [number, number])[], x: number): number {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return points[points.length - 1][1];
}

// 뒷산의 숲이 내려오는 줄(이 줄보다 북쪽은 빽빽한 숲)
const NORTH_LINE: [number, number][] = [
  [0, 21],
  [19, 21],
  [22, 23],
  [33, 23],
  [36, 16],
  [44, 16],
  [46, 14],
  [61, 14],
  [63, 15],
  [76, 15],
  [79, 25],
  [95, 25],
];

function terrainOf(b: MapBuilder): void {
  const wob = (x: number, y: number): number => (vnoise(x / 4.3, y / 4.3, SEED + 3) - 0.5) * 3;

  // ── 1. 맵을 두른 숲 ──
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const n = wob(x, y);
      const north = y < along(NORTH_LINE, x) + n;
      const south = y > 68.4 - n * 0.6;
      const west = x < 4.2 + n * 0.5;
      const east = x > 92.5 - n * 0.5;
      const southEast = x > 81.5 - n * 0.6 && y > 42.5 + n * 0.6;
      if (north || south || west || east || southEast) b.set(x, y, T.thicket);
    }
  }
  // 고갯길의 터: 동쪽 산자락을 걷어 내고 세 단의 비탈을 만든다(아래 5번에서 길과 둔덕을 놓는다)
  b.fill(81, 21, 93, 41, T.grass, [T.thicket]);
  b.fill(94, 21, 95, 25, T.grass, [T.thicket]);

  // ── 2. 풀밭의 갈래 ──
  b.blob(12.5, 29, 8.5, 5.2, T.meadow, 0.25, [T.grass]); // 향교 가는 길 북쪽의 꽃밭
  b.fill(5, 65, 80, 68, T.meadow, [T.grass]); // 냇물 건너 풀밭
  b.blob(71, 42, 4.5, 2.6, T.meadow, 0.3, [T.grass]);
  b.blob(11.5, 49, 9.5, 7.2, T.forest, 0.22, [T.grass]); // 길 남쪽의 솔밭

  // ── 3. 숲 속의 빈터와 숲길 ──
  b.blob(38.5, 9, 6, 3.8, T.forest, 0.2); // 뒷산 나무하는 곳
  b.blob(68.5, 8.8, 7.2, 4.8, T.grass, 0.16); // 절터
  b.blob(68.5, 9.6, 5.2, 3, T.yard, 0.14);
  const hillTrail: [number, number][] = [
    [45.5, 30],
    [43.5, 27],
    [42.5, 20],
    [39.5, 14],
    [38.5, 11],
  ];
  const ridgeTrail: [number, number][] = [
    [43, 9],
    [50, 8.2],
    [56, 9.2],
    [62, 8.5],
  ];
  const templeTrail: [number, number][] = [
    [64.5, 28.5],
    [67.5, 25],
    [69.5, 19],
    [69.5, 13],
  ];
  for (const trail of [hillTrail, ridgeTrail, templeTrail]) b.band(trail, 1.8, T.forest, [T.thicket]);

  // ── 4. 냇물: 동북쪽 골짜기에서 내려와 마을 동쪽을 돌아 남쪽 들판 앞을 서쪽으로 흐른다 ──
  b.river(
    [
      [85, 0],
      [83.5, 8],
      [80.5, 16],
      [79.5, 26],
      [78.5, 37],
      [79, 46],
      [78, 53],
      [74.5, 58.5],
      [66, 61.6],
      [52, 62.3],
      [38, 62],
      [24, 63.4],
      [10, 64.6],
      [0, 65],
    ],
    (t) => 1.35 + Math.min(1, t * 1.9) * 0.95,
    (t) => -0.4 + Math.min(1, t * 1.9) * 1.15,
  );

  // ── 5. 큰길 ──
  // 서쪽 끝(향교 가는 길)에서 마을 어귀를 지나 나무다리를 건너 동쪽 고갯길로
  b.band(
    [
      [0, 38],
      [75, 38],
    ],
    2.2,
    T.grass,
    [T.thicket],
  );
  b.band(
    [
      [0, 38],
      [90, 38],
    ],
    1.0,
    T.path,
    undefined,
    T.bridge,
  );
  // 고갯길: 나무다리를 건너면 길이 좁아지고, 둔덕 세 단을 돌층계로 오르며 갈지자로 굽이친다.
  //   아랫단(큰길) → 돌층계 → 둘째 단을 서쪽으로 → 돌층계 → 셋째 단을 동쪽으로 → 돌층계 → 고갯마루 → 동쪽 끝
  const climb: [number, number][][] = [
    [
      [90.5, 38.5],
      [90.5, 34.5],
      [85.5, 34.5],
    ],
    [
      [85.5, 34.5],
      [85.5, 29.5],
      [91.5, 29.5],
    ],
    [
      [91.5, 29.5],
      [91.5, 23.5],
      [96, 23.5],
    ],
  ];
  b.blob(87, 39.6, 6, 1.8, T.rock, 0.3, [T.grass]);
  b.blob(88, 33.4, 5, 1.6, T.rock, 0.3, [T.grass]);
  b.blob(87.5, 28.6, 5.5, 1.5, T.rock, 0.3, [T.grass]);
  b.blob(89.5, 23.2, 5, 1.8, T.rock, 0.25, [T.grass]);
  for (const leg of climb) b.band(leg, 0.5, T.path);
  b.fill(81, 36, 93, 36, T.bank);
  b.fill(81, 31, 93, 31, T.bank);
  b.fill(81, 26, 95, 26, T.bank);
  b.set(90, 36, T.steps);
  b.set(85, 31, T.steps);
  b.set(91, 26, T.steps);
  b.fill(94, 27, 95, 41, T.thicket);
  // 마을 어귀에서 북쪽으로: 한양 가는 길
  const hanyang: [number, number][] = [
    [26, 38],
    [26, 23],
    [25, 12],
    [25, 0],
  ];
  b.band(hanyang, 2.1, T.grass, [T.thicket]);
  b.band(hanyang, 1.0, T.path);

  // ── 6. 마을 안의 길과 마당 ──
  b.blob(29.5, 35.8, 5, 2.2, T.yard, 0.2, [T.grass, T.meadow]); // 느티나무 아래
  b.band(
    [
      [53, 28],
      [53, 38],
    ],
    1.0,
    T.path,
  ); // 양반 댁 대문에서 큰길까지
  b.fill(46, 17, 59, 26, T.yard); // 양반 댁 안마당
  b.fill(45, 16, 60, 27, T.grass, [T.thicket]);
  b.fill(52, 27, 53, 27, T.path);
  b.blob(46.5, 32.6, 3.2, 2.4, T.yard, 0.18, [T.grass]); // 우물가
  b.band(
    [
      [49, 33.5],
      [52, 33.5],
    ],
    0.5,
    T.path,
  );
  b.band(
    [
      [46.5, 35],
      [46.5, 37],
    ],
    0.5,
    T.path,
  );
  b.blob(38.8, 34.2, 5, 2.2, T.yard, 0.16, [T.grass]); // 우리 집(농민 집) 마당
  b.band(
    [
      [39.5, 36],
      [39.5, 37.5],
    ],
    0.5,
    T.path,
  );
  b.blob(59.8, 34, 3.6, 1.6, T.yard, 0.16, [T.grass]); // 이웃집
  b.band(
    [
      [59.5, 35],
      [59.5, 37],
    ],
    0.5,
    T.path,
  );
  b.blob(64, 26.7, 2.6, 1.2, T.yard, 0.12, [T.grass]); // 노비 집
  b.band(
    [
      [54, 28.5],
      [66, 28.5],
    ],
    0.5,
    T.path,
  );
  b.blob(71.5, 34.8, 3.6, 1.4, T.yard, 0.14, [T.grass]); // 동쪽 이웃집
  b.band(
    [
      [71.5, 36],
      [71.5, 37],
    ],
    0.5,
    T.path,
  );
  b.blob(50, 41.6, 5.2, 2.6, T.yard, 0.14, [T.grass]); // 타작 마당
  b.blob(36.5, 45, 3.8, 1.3, T.yard, 0.12, [T.grass]);
  b.blob(60.5, 45, 3.6, 1.2, T.yard, 0.12, [T.grass]);
  b.band(
    [
      [45, 45.5],
      [57.5, 45.5],
    ],
    0.5,
    T.path,
  );
  b.band(
    [
      [40, 45.5],
      [44, 45.5],
    ],
    0.5,
    T.path,
  );

  // 숲길(뒷산, 산등성이, 절 가는 길)
  for (const trail of [hillTrail, ridgeTrail, templeTrail]) b.band(trail, 0.75, T.path);

  // ── 7. 들판: 비탈 쪽 높은 논과 텃밭, 둔덕 아래 냇가 쪽 낮은 논 ──
  b.fill(35, 47, 42, 49, T.field); // 텃밭
  b.fill(30, 26, 36, 28, T.field); // 우리 집 뒤의 보리밭
  b.fill(71, 21, 76, 24, T.field); // 비탈 아래 밭
  // 솔밭과 들판 사이의 작은 둠벙(논에 댈 물을 모아 두는 웅덩이)
  b.blob(26.5, 48.5, 2.6, 1.9, T.shallow, 0.2, [T.grass]);
  b.blob(26.5, 48.6, 1.3, 0.8, T.deep, 0.1, [T.shallow]);
  b.fill(46, 46, 55, 49, T.soil); // 높은 논(갈아엎은 흙)
  b.fill(57, 47, 68, 49, T.paddy); // 높은 논(물을 댄 논)
  b.fill(45, 46, 45, 50, T.ridge);
  b.fill(56, 46, 56, 50, T.ridge);
  b.fill(57, 46, 69, 46, T.ridge);
  b.fill(69, 46, 69, 50, T.ridge);
  b.fill(45, 50, 69, 50, T.ridge);
  b.fill(33, 51, 70, 51, T.bank); // 둔덕
  b.set(56, 51, T.steps);
  b.fill(33, 52, 70, 52, T.ridge);
  b.fill(33, 58, 70, 58, T.ridge);
  b.fill(33, 52, 33, 58, T.ridge);
  b.fill(70, 52, 70, 58, T.ridge);
  b.fill(34, 53, 43, 57, T.paddy); // 낮은 논: 우리 논
  b.fill(45, 53, 55, 57, T.soil); // 낮은 논: 이웃집 논(논갈이가 한창)
  b.fill(56, 52, 56, 58, T.ridge);
  b.fill(57, 53, 62, 57, T.paddy);
  b.fill(63, 52, 63, 58, T.ridge);
  b.fill(64, 53, 69, 57, T.paddy);

  // 큰길에서 들판을 지나 징검다리까지 내려가는 농사길
  b.band(
    [
      [44.5, 39],
      [44.5, 65.5],
    ],
    0.5,
    T.path,
    undefined,
    T.ford,
  );

  // 절 아래의 둔덕과 돌층계, 고갯길 뒤의 둔덕
  b.fill(61, 15, 77, 15, T.bank, [T.thicket, T.forest, T.grass]);
  b.set(69, 15, T.steps);
  b.set(69, 14, T.path);

  // 둠벙의 물을 낮은 논 곁으로 끌어 냇물로 흘려보내는 도랑. 널다리 둘로 건넌다.
  b.fill(30, 50, 32, 50, T.shallow, [T.grass]);
  b.fill(32, 51, 32, 60, T.shallow, [T.grass, T.meadow]);
  b.set(32, 52, T.bridge);
  b.set(32, 58, T.bridge);

  // 맵 끝의 길목은 길만 남긴다(막힌 줄을 돌아갈 수 없게)
  b.fill(0, 0, 3, 36, T.thicket, [T.grass, T.meadow, T.forest]);
  b.fill(0, 39, 3, 71, T.thicket, [T.grass, T.meadow, T.forest]);
  b.fill(0, 0, 23, 9, T.thicket, [T.grass, T.meadow, T.forest]);
  b.fill(26, 0, 33, 9, T.thicket, [T.grass, T.meadow, T.forest]);
}

function buildingsOf(b: MapBuilder): void {
  // ── 마을 어귀 ──
  b.put('zelkova', 28, 34);
  b.put('flatstone', 31, 34, { variant: 0 });
  b.put('flatstone', 33, 35, { variant: 1 });
  b.put('rockM', 23, 35, { variant: 1 });

  // ── 양반 댁: 담을 두른 큰 집 ──
  b.rowOf('wallH', 45, 60, 16);
  b.rowOf('wallH', 45, 60, 27, [52, 53]);
  b.colOf('wallV', 45, 17, 26);
  b.colOf('wallV', 60, 17, 26);
  b.put('gate', 51, 27, { variant: 0, gate: 'manor' });
  b.put('manor', 48, 20);
  b.put('wing', 46, 25);
  b.put('jars', 57, 22, { variant: 0 });
  b.put('blossom', 58, 25, { variant: 1 });
  b.put('flatstone', 57, 25, { variant: 0 });

  // ── 노비 집(양반 댁 곁의 작은 집) ──
  b.put('hut', 62, 25, { variant: 2 });
  b.put('jars', 66, 25, { variant: 1 });
  b.put('woodpile', 66, 27);

  // ── 우리 집(농민 집) ──
  b.put('choga', 36, 32, { variant: 0 });
  b.put('shed', 32, 33);
  b.put('jars', 42, 32, { variant: 1 });
  b.put('woodpile', 34, 30);
  b.rowOf('fenceH', 33, 37, 36);
  b.rowOf('fenceH', 41, 44, 36);
  b.put('blossom', 44, 31, { variant: 0 });

  // ── 우물가 ──
  b.put('well', 46, 33);
  b.put('oak', 49, 31, { variant: 0 });
  b.put('flatstone', 44, 34, { variant: 1 });

  // ── 이웃집들 ──
  b.put('choga', 57, 32, { variant: 4 });
  b.put('jars', 63, 32, { variant: 0 });
  b.put('blossom', 55, 31, { variant: 2 });
  b.rowOf('stonewallH', 56, 58, 36);
  b.rowOf('stonewallH', 61, 64, 36);
  b.put('choga', 34, 43, { variant: 5 });
  b.put('woodpile', 40, 43);
  b.put('choga', 58, 43, { variant: 1 });
  b.put('choga', 69, 33, { variant: 3 });
  b.put('jars', 75, 33, { variant: 0 });
  b.put('blossom', 67, 32, { variant: 1 });
  b.rowOf('fenceH', 70, 76, 20);
  b.rowOf('fenceH', 29, 36, 25, [33]);
  b.put('shed', 64, 44);
  b.put('blossom', 56, 42, { variant: 0 });

  // ── 타작 마당 ──
  b.put('strawstack', 46, 42, { variant: 0 });
  b.put('strawstack', 53, 43, { variant: 1 });
  b.put('oak', 55, 40, { variant: 1 });

  // ── 텃밭 울타리 ──
  b.rowOf('fenceH', 35, 42, 46, [38, 39]);
  b.colOf('fenceV', 34, 47, 49);

  // ── 뒷산: 나무하는 빈터 ──
  b.put('stump', 36, 9, { variant: 0 });
  b.put('stump', 41, 10, { variant: 1 });
  b.put('stump', 35, 11, { variant: 1 });
  b.put('log', 39, 7);
  b.put('woodpile', 41, 8);

  // ── 뒷산 절 ──
  b.put('temple', 65, 7);
  b.put('pagoda', 68, 10);
  b.put('lantern', 71, 10);
  b.put('hall', 61, 11);
  b.put('rockM', 74, 11, { variant: 0 });

  // ── 냇가 ──
  b.put('bigtree', 50, 66); // 그네를 맬 만한 큰 나무
  for (const [x, y, v] of [
    [14, 66, 0],
    [27, 66, 1],
    [36, 65, 0],
    [58, 65, 1],
    [67, 65, 0],
    [41, 59, 1],
    [72, 56, 0],
    [81, 41, 1],
  ] as const) {
    b.put('willow', x, y, { variant: v });
  }
  b.put('flatstone', 42, 59, { variant: 0 }); // 빨래터의 너럭돌

  // ── 향교 가는 길: 꽃밭의 꽃나무들 ──
  for (const [x, y, v] of [
    [8, 26, 0],
    [15, 25, 1],
    [19, 30, 2],
    [10, 33, 1],
    [6, 30, 2],
  ] as const) {
    b.put('blossom', x, y, { variant: v });
  }
  b.put('rockL', 13, 29, { variant: 0 });
  b.put('azalea', 16, 31, { variant: 0 });
  b.put('azalea', 9, 29, { variant: 1 });
  b.put('forsythia', 17, 27, { variant: 0 });
  b.put('forsythia', 20, 34, { variant: 1 });
  // 큰길가의 나무들(길 북쪽에, 사이를 고르지 않게 — 길을 덮지 않는다)
  b.put('pine', 11, 35, { variant: 0 });
  b.put('pineS', 17, 34, { variant: 1 });
  b.put('pine', 21, 35, { variant: 2 });
  // ── 둠벙 둘레 ──
  b.put('willow', 29, 47, { variant: 0 });
  b.put('rockM', 24, 50, { variant: 1 });
  b.put('azalea', 30, 51, { variant: 0 });
  b.put('oak', 23, 44, { variant: 2 });
  b.put('young', 31, 55, { variant: 0 });
  b.put('blossom', 27, 42, { variant: 1 });
  // ── 마을 뒤 비탈 ──
  b.put('azalea', 38, 20, { variant: 0 });
  b.put('azalea', 36, 22, { variant: 1 });
  b.put('forsythia', 40, 24, { variant: 0 });
  b.put('oak', 34, 21, { variant: 0 });
  b.put('rockM', 37, 24, { variant: 2 });
  b.put('blossom', 65, 19, { variant: 0 });
  b.put('azalea', 72, 27, { variant: 1 });
  b.put('oak', 75, 29, { variant: 1 });
  b.put('forsythia', 63, 21, { variant: 1 });

  // ── 고갯길: 바위와 소나무, 고갯마루의 늙은 소나무 ──
  b.put('rockL', 83, 40, { variant: 0 });
  b.put('rockM', 88, 40, { variant: 2 });
  b.put('pine', 92, 41, { variant: 1 });
  b.put('rockL', 87, 33, { variant: 1 });
  b.put('pine', 82, 33, { variant: 0 });
  b.put('pine', 93, 34, { variant: 2 });
  b.put('rockM', 92, 32, { variant: 0 });
  b.put('rockL', 88, 28, { variant: 0 });
  b.put('pine', 82, 28, { variant: 2 });
  b.put('pineS', 93, 29, { variant: 0 });
  b.put('rockM', 83, 30, { variant: 1 });
  b.put('oldpine', 88, 23, { variant: 0 }); // 고갯마루
  b.put('rockL', 85, 24, { variant: 1 });
  b.put('flatstone', 90, 22, { variant: 0 });
  b.put('rockM', 83, 22, { variant: 2 });

  // ── 길목의 알아볼 것 ──
  // 향교 가는 길(서쪽 끝): 길가의 늙은 소나무와 쉬어 가는 너럭돌
  b.put('oldpine', 6, 35, { variant: 1 });
  b.put('flatstone', 8, 36, { variant: 1 });
  b.put('rockL', 5, 40, { variant: 0 });
  // 한양 가는 길(북쪽 끝): 길가의 돌무더기와 큰 바위, 쓰러진 나무
  b.put('cairn', 27, 11);
  b.put('rockL', 22, 14, { variant: 1 });
  b.put('oldpine', 23, 9, { variant: 0 });
  b.put('fallen', 27, 17);
  b.put('stump', 23, 19, { variant: 1 });
  b.put('flatstone', 27, 21, { variant: 0 });
  b.put('azalea', 23, 16, { variant: 0 });

  // ── 냇물 건너 풀밭과 남서 풀밭: 눈 둘 곳 ──
  b.put('rockL', 20, 66, { variant: 0 });
  b.put('fallen', 30, 67);
  b.put('rockL', 61, 66, { variant: 1 });
  b.put('flatstone', 63, 65, { variant: 0 });
  b.put('fallen', 72, 66);
  b.put('azalea', 9, 67, { variant: 0 });
  b.put('forsythia', 44, 67, { variant: 1 });
  b.put('azalea', 55, 67, { variant: 1 });
  b.put('stump', 40, 66, { variant: 0 });
  b.put('fallen', 25, 56);
  b.put('oak', 27, 57, { variant: 3 });
  b.put('rockM', 30, 46, { variant: 0 });
}

function plantsOf(b: MapBuilder): void {
  const all: [number, number, number, number] = [0, 0, b.w - 1, b.h - 1];
  // 빽빽한 숲
  b.scatter({
    rect: all,
    on: [T.thicket],
    kinds: [
      ['oak', 5],
      ['pine', 2.6],
      ['young', 2],
      ['pineS', 1],
      ['bush', 0.5],
    ],
    chance: 0.6,
    keepLow: {
      south: 3,
      low: [
        ['bush', 3],
        ['azalea', 1],
        ['rockM', 0.4],
      ],
      chance: 0.34,
    },
    seed: 11,
  });
  // 길 남쪽 솔밭
  b.scatter({
    rect: [1, 40, 22, 58],
    on: [T.forest],
    kinds: [
      ['pine', 5],
      ['pineS', 2],
      ['rockM', 0.5],
    ],
    chance: 0.2,
    gap: 1,
    clear: 1,
    seed: 12,
  });
  // 걸을 수 있는 숲
  b.scatter({
    rect: all,
    on: [T.forest],
    kinds: [
      ['oak', 2],
      ['pine', 2],
      ['young', 2],
      ['bush', 1],
      ['azalea', 1.2],
      ['rockM', 0.4],
    ],
    chance: 0.13,
    gap: 1,
    clear: 1,
    keepLow: { south: 2, low: [['bush', 1], ['azalea', 1]], chance: 0.05 },
    seed: 13,
  });
  // 풀밭의 나무와 덤불
  b.scatter({
    rect: all,
    on: [T.grass],
    kinds: [
      ['oak', 0.7],
      ['young', 0.9],
      ['blossom', 1],
      ['bush', 1],
      ['azalea', 0.6],
      ['forsythia', 0.6],
      ['rockM', 0.4],
    ],
    chance: 0.05,
    gap: 2,
    clear: 2,
    keepLow: { south: 3, low: [['bush', 1], ['forsythia', 0.6], ['azalea', 0.6]], chance: 0.03 },
    seed: 14,
  });
  b.scatter({
    rect: all,
    on: [T.meadow],
    kinds: [
      ['blossom', 1],
      ['azalea', 1],
      ['forsythia', 1],
      ['bush', 0.3],
    ],
    chance: 0.045,
    gap: 2,
    clear: 1,
    seed: 15,
  });
  // 고갯길의 돌
  b.scatter({
    rect: all,
    on: [T.rock],
    kinds: [
      ['rockM', 3],
      ['pineS', 1],
      ['bush', 0.5],
    ],
    chance: 0.12,
    gap: 1,
    clear: 1,
    keepLow: { south: 3, low: [['rockM', 2], ['bush', 1]], chance: 0.08 },
    seed: 16,
  });
  // 숲 가장자리: 풀밭이 숲과 만나는 곳에 낮은 덤불과 어린 나무를 둔다
  const laneKinds = [T.path, T.yard, T.ridge, T.ford, T.bridge, T.steps];
  for (let y = 1; y < b.h - 1; y++) {
    for (let x = 1; x < b.w - 1; x++) {
      const t = b.get(x, y);
      if ((t !== T.grass && t !== T.meadow) || !b.free(x, y)) continue;
      if (!b.near(x, y, 1, [T.thicket]) || b.near(x, y, 2, laneKinds)) continue;
      const roll = vnoise(x * 5.1, y * 5.1, SEED + 71);
      if (roll < 0.3) b.put('bush', x, y, { variant: Math.floor(roll * 10) % 3, dx: Math.round((roll - 0.15) * 20) });
      else if (roll > 0.74 && b.get(x, y - 1) !== T.thicket) b.put('young', x, y, { variant: Math.floor(roll * 40) % 3 });
      else if (roll > 0.66) b.put('azalea', x, y, { variant: Math.floor(roll * 30) % 2 });
    }
  }
  // 물가의 풀과 돌
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const t = b.get(x, y);
      if ((t !== T.grass && t !== T.meadow) || !b.near(x, y, 1, [T.shallow, T.deep])) continue;
      const roll = vnoise(x * 7.7, y * 7.7, SEED + 61);
      if (roll < 0.42) b.put('reed', x, y, { dx: Math.round((roll - 0.2) * 20), dy: Math.round((roll - 0.2) * 12) });
      else if (roll > 0.82) b.put('rockS', x, y, { dx: Math.round((roll - 0.9) * 40) });
    }
  }
  // 풀포기와 들꽃(막지 않는다)
  b.scatter({
    rect: all,
    on: [T.grass, T.meadow, T.forest, T.ridge],
    kinds: [['tuft', 1]],
    chance: 0.13,
    patchy: 0.38,
    seed: 17,
  });
  b.scatter({ rect: all, on: [T.meadow], kinds: [['flower', 1]], chance: 0.2, seed: 18 });
  b.scatter({ rect: all, on: [T.grass], kinds: [['flower', 1]], chance: 0.035, patchy: 0.5, seed: 19 });
  b.scatter({
    rect: all,
    on: [T.grass, T.rock, T.forest],
    kinds: [['rockS', 1]],
    chance: 0.014,
    seed: 20,
  });
}

const DWELLERS: Dweller[] = [
  // 마을 어귀
  {
    id: 'granny',
    person: 'village-grandma',
    sprite: 'granny',
    label: '마을 할머니',
    about: '느티나무 그늘의 너럭돌에 앉아 쉬고 계세요.',
    at: [31, 34],
    facing: 'down',
    act: 'sit',
    solid: true,
  },
  {
    id: 'returned',
    person: 'neighbor-elder',
    sprite: 'neighborMan',
    label: '이웃 어른',
    about: '겨울 공사에서 돌아와 마을 사람들과 인사를 나누고 있어요.',
    at: [28, 36],
    facing: 'right',
    act: 'stand',
    solid: true,
    // "우리 논에서 기다리마"라고 한 뒤에는 논에 가 있다
    shows: { notFlags: ['return.help'] },
  },
  {
    id: 'returnedAtPaddy',
    person: 'neighbor-elder',
    sprite: 'neighborMan',
    label: '이웃 어른',
    about: '밀린 논갈이를 하러 논에 나와 있어요.',
    at: [45, 58],
    facing: 'up',
    act: 'stand',
    shows: { flags: ['return.help'] },
  },
  {
    id: 'monk',
    person: 'monk',
    sprite: 'monk',
    label: '뒷산 절의 스님',
    about: '먼 길을 떠날 채비를 하고 계세요.',
    at: [27, 35],
    facing: 'right',
    act: 'stand',
    solid: true,
    // "절 아래 길에서 짐을 꾸리고 있으마"라고 한 뒤에는 절 가는 길에 가 있다(그 길의 스님이 그분이다)
    shows: { notFlags: ['return.give'] },
  },
  // 우물가와 마을 안
  {
    id: 'wellWoman',
    person: 'well-neighbor',
    sprite: 'wellWoman',
    label: '이웃 아주머니',
    about: '우물에서 물을 긷고 있어요.',
    at: [48, 33],
    facing: 'left',
    act: 'work',
    solid: true,
  },
  {
    id: 'elder',
    sprite: 'elderMan',
    label: '마을 할아버지',
    about: '지팡이를 짚고 마을을 둘러보고 계세요.',
    at: [56, 39],
    facing: 'down',
    act: 'roam',
    range: 2,
  },
  // 이웃집 동무는 뒷산에서 나무를 한다(봄의 덤 "뒷산에서 나무하기"에서 만난다)
  {
    id: 'boyKid',
    person: 'friend-boy',
    sprite: 'boyKid',
    label: '이웃집 동무',
    about: '뒷산에서 마른 가지를 줍고 있어요.',
    at: [41, 9],
    facing: 'left',
    act: 'roam',
    range: 1,
  },
  {
    id: 'girlKid',
    sprite: 'girlKid',
    label: '이웃집 동무',
    about: '타작 마당에서 누렁이와 뛰어놀고 있어요.',
    at: [51, 42],
    facing: 'left',
    act: 'roam',
    range: 3,
  },
  // 뒷산 절의 스님들: 떠날 채비를 한다(절 마당에 한 분, 절 가는 길에 한 분, 마을 어귀에 한 분)
  {
    id: 'templeMonk',
    person: 'monk',
    sprite: 'monk',
    label: '뒷산 절의 스님',
    about: '절 마당에서 떠날 짐을 싸고 계세요.',
    at: [70, 11],
    facing: 'left',
    act: 'stand',
    solid: true,
  },
  {
    id: 'roadMonk',
    person: 'monk',
    sprite: 'monk',
    label: '뒷산 절의 스님',
    about: '절 가는 길에서 짐을 꾸리고 계세요.',
    at: [71, 18],
    facing: 'left',
    act: 'stand',
    solid: true,
  },
  // 우리 집(농민 집)과 논
  {
    id: 'farmerGranny',
    sprite: 'farmerGranny',
    label: '농민 집 할머니',
    house: 'farmer',
    kin: '할머니',
    about: '집 앞에 앉아 봄볕을 쬐고 계세요.',
    at: [36, 33],
    facing: 'down',
    act: 'sit',
    solid: true,
  },
  {
    id: 'mother',
    person: 'mother',
    sprite: 'mother',
    label: '농민 집 아주머니',
    house: 'farmer',
    kin: '어머니',
    about: '마당에서 닭에게 모이를 주고 계세요.',
    at: [41, 34],
    facing: 'down',
    act: 'stand',
    solid: true,
  },
  {
    id: 'father',
    person: 'father',
    sprite: 'father',
    label: '농민 집 아저씨',
    house: 'farmer',
    kin: '아버지',
    about: '논에 들어가 물길을 살피고 계세요.',
    at: [43, 55],
    facing: 'left',
    act: 'work',
  },
  {
    id: 'brother',
    sprite: 'brother',
    label: '농민 집 젊은이',
    house: 'farmer',
    kin: { boy: '형', girl: '오라버니' },
    about: '뒷산에서 땔나무를 하고 있어요.',
    at: [38, 10],
    facing: 'left',
    act: 'work',
    solid: true,
  },
  {
    id: 'plow',
    sprite: 'plowTeam',
    label: '논을 가는 이웃',
    about: '소를 몰아 논을 갈고 있어요.',
    at: [47, 55],
    facing: 'right',
    act: 'route',
    route: [
      [47, 55],
      [53, 55],
    ],
    animal: true,
  },
  // 냇가
  {
    id: 'washWoman',
    sprite: 'washWoman',
    label: '빨래하는 아주머니',
    about: '냇가 너럭돌에서 빨래를 하고 있어요.',
    at: [43, 59],
    facing: 'down',
    act: 'work',
    solid: true,
  },
  // 양반 댁
  {
    id: 'lady',
    sprite: 'lady',
    label: '양반 댁 아주머니',
    house: 'manor',
    kin: '어머니',
    seenBy: { nobi: '주인댁 어른' },
    about: '안마당에서 혼례 채비를 살피고 계세요.',
    at: [55, 22],
    facing: 'down',
    act: 'stand',
    solid: true,
  },
  {
    id: 'sister',
    sprite: 'sister',
    label: '양반 댁 아가씨',
    house: 'manor',
    kin: { boy: '누님', girl: '언니' },
    seenBy: { nobi: '주인댁 아가씨' },
    about: '곧 혼례를 올려요. 채비로 바빠요.',
    at: [51, 22],
    facing: 'down',
    act: 'stand',
    solid: true,
  },
  {
    id: 'youngLord',
    sprite: 'youngLord',
    label: '양반 댁 도령',
    house: 'manor',
    kin: '동생',
    seenBy: { nobi: '주인댁 도령' },
    about: '안마당을 돌아다니며 놀고 있어요.',
    at: [56, 24],
    facing: 'left',
    act: 'roam',
    range: 2,
  },
  // 노비 집
  {
    id: 'nobiMother',
    sprite: 'nobiMother',
    label: '노비 집 아주머니',
    house: 'nobi',
    kin: '어머니',
    about: '양반 댁 대문 앞을 쓸고 계세요.',
    at: [55, 29],
    facing: 'left',
    act: 'work',
    solid: true,
  },
  {
    id: 'nobiGranny',
    sprite: 'nobiGranny',
    label: '노비 집 할머니',
    house: 'nobi',
    kin: '할머니',
    about: '집 앞에 앉아 볕을 쬐고 계세요.',
    at: [61, 26],
    facing: 'down',
    act: 'sit',
    solid: true,
  },
  // 짐승
  { id: 'hen1', sprite: 'hen', label: '닭', about: '', at: [39, 35], facing: 'left', act: 'roam', range: 2, animal: true },
  { id: 'hen2', sprite: 'hen', label: '닭', about: '', at: [42, 35], facing: 'right', act: 'roam', range: 2, animal: true },
  { id: 'rooster', sprite: 'rooster', label: '닭', about: '', at: [37, 34], facing: 'right', act: 'roam', range: 2, animal: true },
  { id: 'chick1', sprite: 'chick', label: '병아리', about: '', at: [40, 35], facing: 'left', act: 'roam', range: 2, animal: true },
  { id: 'chick2', sprite: 'chick', label: '병아리', about: '', at: [41, 35], facing: 'right', act: 'roam', range: 2, animal: true },
  { id: 'hen3', sprite: 'hen', label: '닭', about: '', at: [48, 42], facing: 'right', act: 'roam', range: 3, animal: true },
  { id: 'hen4', sprite: 'hen', label: '닭', about: '', at: [60, 34], facing: 'left', act: 'roam', range: 2, animal: true },
  { id: 'dog1', sprite: 'dog', label: '누렁이', about: '', at: [52, 40], facing: 'left', act: 'roam', range: 4, animal: true },
  { id: 'dog2', sprite: 'dog', label: '누렁이', about: '', at: [58, 35], facing: 'right', act: 'roam', range: 2, animal: true },
  { id: 'hen5', sprite: 'hen', label: '닭', about: '', at: [72, 35], facing: 'left', act: 'roam', range: 2, animal: true },
  { id: 'magpie1', sprite: 'magpie', label: '까치', about: '', at: [34, 38], facing: 'left', act: 'stand', animal: true },
  { id: 'magpie2', sprite: 'magpie', label: '까치', about: '', at: [57, 39], facing: 'right', act: 'stand', animal: true },
  { id: 'magpie3', sprite: 'magpie', label: '까치', about: '', at: [20, 36], facing: 'left', act: 'stand', animal: true },
  { id: 'magpie4', sprite: 'magpie', label: '까치', about: '', at: [66, 12], facing: 'right', act: 'stand', animal: true },
  { id: 'egret1', sprite: 'egret', label: '물새', about: '', at: [58, 63], facing: 'left', act: 'stand', animal: true },
  { id: 'egret2', sprite: 'egret', label: '물새', about: '', at: [22, 64], facing: 'right', act: 'stand', animal: true },
  { id: 'egret3', sprite: 'egret', label: '물새', about: '', at: [27, 48], facing: 'left', act: 'stand', animal: true },
  { id: 'magpie5', sprite: 'magpie', label: '까치', about: '', at: [26, 15], facing: 'left', act: 'stand', animal: true },
  { id: 'magpie6', sprite: 'magpie', label: '까치', about: '', at: [87, 38], facing: 'right', act: 'stand', animal: true },
  { id: 'ox', sprite: 'ox', label: '소', about: '', at: [31, 31], facing: 'right', act: 'stand', animal: true, solid: true },
];

// 자리: 일이 벌어질 수 있는 곳의 이름과 칸. 거기서 무슨 일이 벌어지는지는 이야기의 자료(Mission, Happening)가 정한다.
const SPOTS: Spot[] = [
  { id: 'tree', at: [29, 35], stand: [29, 36], label: '마을 어귀 느티나무' },
  // 할머니가 앉은 너럭돌의 비스듬한 앞에 선다(바로 앞에 서면 할머니를 가린다)
  { id: 'treeShade', at: [31, 34], stand: [32, 35], label: '느티나무 그늘' },
  { id: 'home', at: [39, 33], stand: [39, 34], label: '우리 집 마당' },
  { id: 'well', at: [46, 32], stand: [46, 34], label: '우물가' },
  { id: 'ourPaddy', at: [43, 54], stand: [44, 54], label: '우리 논' },
  { id: 'neighborPaddy', at: [45, 57], stand: [44, 57], label: '이웃집 논' },
  { id: 'templeRoad', at: [70, 18], stand: [69, 18], label: '절 가는 길' },
  { id: 'temple', at: [69, 11], stand: [69, 12], label: '뒷산 절' },
  { id: 'woods', at: [39, 9], stand: [39, 10], label: '뒷산' },
  // 다른 역할의 봄에 쓸 자리(다음 바퀴)
  { id: 'clanPaddy', at: [57, 48], stand: [56, 48], label: '집안 논' },
  { id: 'innerYard', at: [53, 22], stand: [53, 23], label: '안마당' },
  { id: 'manorFront', at: [51, 29], stand: [52, 29], label: '주인댁 대문 앞' },
];

// 구역. 좁은 것부터 적는다(겹치면 먼저 적힌 구역이 이긴다). 걸을 수 있는 칸은 모두 어느 구역에 든다.
const ZONES: Zone[] = [
  { id: 'pass', label: '고갯길', rects: [[81, 20, 95, 42]] },
  { id: 'hanyang', label: '한양 가는 길', rects: [[21, 0, 30, 24]] },
  {
    id: 'hills',
    label: '뒷산과 절 가는 길',
    rects: [
      [31, 0, 80, 15],
      [33, 16, 44, 28],
      [61, 16, 80, 27],
    ],
  },
  { id: 'hyanggyo', label: '향교 가는 길', rects: [[0, 22, 23, 58]] },
  {
    id: 'stream',
    label: '냇가',
    rects: [
      [0, 59, 95, 71],
      [76, 26, 80, 58],
    ],
  },
  { id: 'fields', label: '들판', rects: [[22, 44, 72, 58]] },
  { id: 'village', label: '마을 안', rects: [[0, 0, 95, 71]] },
];

const NOTES: Note[] = [
  { id: 'toHyanggyo', rect: [0, 36, 1, 39], text: '이 길을 따라가면 고을의 향교가 나와요.' },
  { id: 'toNeighbor', rect: [94, 21, 95, 25], text: '이 고개를 넘으면 이웃 마을이에요.' },
];

const START: Record<RoleId, [number, number]> = {
  farmer: [39, 35],
  son: [52, 25],
  daughter: [53, 25],
  nobi: [64, 27],
};

// 여자아이의 모습: 양반 집 딸이거나, 여자아이 모습을 고른 농민·노비 집 아이
const GIRL: Condition = { anyOf: [{ roles: ['daughter'] }, { roles: ['farmer', 'nobi'], look: 'girl' }] };

// 막힌 문과 길. shut의 조건 가운데 처음 맞는 것의 까닭이 뜬다. 맞는 것이 없으면 열려 있다.
// 까닭은 사람 탓이 아니라 그때의 제도와 형편을 주어로 쓴다(spec 5.2의 2번).
function gatesOf(b: MapBuilder): Gate[] {
  return [
    {
      id: 'hyanggyo',
      label: '향교 가는 길',
      tiles: b.walkableIn(3, 34, 3, 41),
      shut: [
        { when: { roles: ['nobi'] }, reason: '노비는 향교에 다닐 수 없었어요' },
        { when: GIRL, reason: '여자는 향교에 다닐 수 없었어요' },
      ],
    },
    {
      id: 'hanyang',
      label: '한양 가는 길',
      tiles: b.walkableIn(20, 6, 31, 6),
      shut: [
        { when: GIRL, reason: '궁궐 공사에는 남자 어른들이 불려 갔어요' },
        { when: {}, reason: '열다섯 살은 궁궐 공사에 불려 가지 않았어요' },
      ],
    },
    {
      id: 'pass',
      label: '고갯길',
      tiles: b.walkableIn(93, 21, 93, 25),
      shut: [{ when: { roles: ['nobi'] }, reason: '노비는 주인댁 심부름이 있을 때만 고개를 넘었어요' }],
    },
    {
      id: 'manor',
      label: '양반 댁 안',
      tiles: [
        [52, 27],
        [53, 27],
      ],
      shut: [{ when: { roles: ['farmer', 'nobi'] }, reason: '양반 댁 안에는 부름이 있을 때만 들어갔어요' }],
    },
  ];
}

// 나무 아래 마당에 들어서면 화면이 쏠려 다 보이게 하는 큰 볼거리: 마을 어귀의 느티나무(나무갓의 한가운데).
// 마당 밖의 큰길을 지나가기만 할 때는 쏠리지 않는다.
const SIGHTS: MapData['sights'] = [{ x: 28 * 16 + 24, y: 35 * 16 - 2 - 92, yard: [27, 32, 32, 36] }];

let cached: MapData | null = null;

/** 느티골의 봄 맵. 언제 불러도 같은 맵이 나온다. */
function compose(thick: readonly number[]): MapBuilder {
  const b = new MapBuilder(NEUTIGOL_W, NEUTIGOL_H, SEED);
  terrainOf(b);
  for (const i of thick) b.terrain[i] = T.thicket;
  buildingsOf(b);
  // 제자리에 서 있는 사람은 그 칸을 막는다
  for (const d of DWELLERS) if (d.solid) b.solid[d.at[1] * b.w + d.at[0]] = 1;
  plantsOf(b);
  return b;
}

/** 풀밭처럼 보이는 땅(이런 땅이 닿지 못하는 빈터로 남으면 빽빽한 숲으로 채운다) */
const OPEN_GROUND: readonly number[] = [T.grass, T.meadow, T.forest, T.ridge];

export function buildNeutigol(): MapData {
  // 덤불과 바위를 흩어 놓다 보면 좁은 목이 막혀 그 너머가 닿지 못하는 빈터가 된다.
  // 그런 칸은 빽빽한 숲으로 바꾸어 다시 짓는다(풀밭처럼 보이는데 못 들어가는 땅을 남기지 않는다).
  let thick: number[] = [];
  let b = compose(thick);
  for (let round = 0; round < 4; round++) {
    const more = b.sealedFrom(START.farmer[0], START.farmer[1]).filter((i) => OPEN_GROUND.includes(b.terrain[i]));
    if (more.length === 0) break;
    thick = thick.concat(more);
    b = compose(thick);
  }
  return b.finish(
    'neutigol',
    START,
    { spots: SPOTS, gates: gatesOf(b), zones: ZONES, dwellers: DWELLERS, notes: NOTES, sights: SIGHTS },
    START.farmer,
  );
}

export function neutigol(): MapData {
  cached ??= buildNeutigol();
  return cached;
}
