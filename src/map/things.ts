// 세운 것의 갈래와 차지하는 칸. 그림은 src/pixel이 같은 이름으로 만든다.
// (tx, ty)가 왼쪽 아래 칸이고, 오른쪽으로 fw칸·위로 fh칸을 막는다. 0이면 막지 않는다.

export interface ThingDef {
  fw: number;
  fh: number;
  /** 같은 갈래 안의 생김새 수 */
  variants: number;
  /** 주인공이 뒤로 가면 비쳐 보이게 할 만큼 큰가 */
  tall?: boolean;
  /** 바람에 흔들리는가 */
  sways?: boolean;
  /** 숲을 이루는 나무인가(빽빽한 숲에 심는다) */
  tree?: boolean;
}

export const THINGS: Record<string, ThingDef> = {
  // 집과 건물
  choga: { fw: 6, fh: 3, variants: 6, tall: true }, // 초가(세 칸 집). 0~2 새 짚, 3~5 묵은 짚
  hut: { fw: 4, fh: 2, variants: 4, tall: true }, // 작은 초가. 0·1 새 짚, 2·3 묵은 짚
  shed: { fw: 3, fh: 2, variants: 1, tall: true }, // 헛간
  manor: { fw: 9, fh: 3, variants: 1, tall: true }, // 양반 집 안채(기와)
  wing: { fw: 5, fh: 3, variants: 1, tall: true }, // 사랑채
  temple: { fw: 8, fh: 3, variants: 1, tall: true }, // 작은 절의 법당
  wallH: { fw: 1, fh: 1, variants: 3 }, // 담(가로)
  wallV: { fw: 1, fh: 1, variants: 2 }, // 담(세로)
  gate: { fw: 0, fh: 0, variants: 2, tall: true }, // 대문(0 열림, 1 닫힘). 지나가는 칸은 문 판정이 막는다
  hall: { fw: 4, fh: 2, variants: 1, tall: true }, // 절의 작은 살림채
  // 마당의 것
  well: { fw: 2, fh: 2, variants: 1 },
  jars: { fw: 2, fh: 1, variants: 2 }, // 장독
  woodpile: { fw: 2, fh: 1, variants: 1 }, // 나뭇더미
  strawstack: { fw: 2, fh: 2, variants: 2, tall: true }, // 짚가리
  fenceH: { fw: 1, fh: 1, variants: 3 }, // 싸리 울타리
  fenceV: { fw: 1, fh: 1, variants: 2 },
  stonewallH: { fw: 1, fh: 1, variants: 3 }, // 돌담
  stonewallV: { fw: 1, fh: 1, variants: 2 },
  pagoda: { fw: 1, fh: 1, variants: 1, tall: true }, // 돌탑
  lantern: { fw: 1, fh: 1, variants: 1 }, // 돌등
  // 돌과 나무토막
  rockS: { fw: 0, fh: 0, variants: 4 },
  rockM: { fw: 1, fh: 1, variants: 3 },
  rockL: { fw: 2, fh: 1, variants: 2 },
  flatstone: { fw: 1, fh: 1, variants: 2 }, // 앉는 너럭돌
  stump: { fw: 1, fh: 1, variants: 2 },
  log: { fw: 2, fh: 1, variants: 1 },
  fallen: { fw: 2, fh: 1, variants: 1 }, // 쓰러져 이끼 낀 나무
  cairn: { fw: 1, fh: 1, variants: 1 }, // 길가의 돌무더기
  // 나무
  zelkova: { fw: 3, fh: 1, variants: 1, tall: true, sways: true }, // 마을 어귀의 큰 느티나무
  oak: { fw: 1, fh: 1, variants: 6, tall: true, sways: true, tree: true }, // 넓은 잎 나무(꼴 여섯, 잎 빛 세 벌)
  oldpine: { fw: 1, fh: 1, variants: 2, tall: true, sways: true }, // 길목과 고갯마루의 늙은 소나무
  young: { fw: 1, fh: 1, variants: 3, tall: true, sways: true, tree: true }, // 작은 나무
  pine: { fw: 1, fh: 1, variants: 3, tall: true, sways: true, tree: true }, // 소나무
  pineS: { fw: 1, fh: 1, variants: 2, tall: true, sways: true, tree: true },
  blossom: { fw: 1, fh: 1, variants: 3, tall: true, sways: true }, // 봄꽃 핀 나무
  willow: { fw: 1, fh: 1, variants: 2, tall: true, sways: true }, // 버드나무
  bigtree: { fw: 2, fh: 1, variants: 1, tall: true, sways: true }, // 냇가의 큰 나무
  // 덤불과 풀
  bush: { fw: 1, fh: 1, variants: 3, sways: true },
  azalea: { fw: 1, fh: 1, variants: 2, sways: true }, // 진달래
  forsythia: { fw: 1, fh: 1, variants: 2, sways: true }, // 개나리
  reed: { fw: 0, fh: 0, variants: 3, sways: true }, // 물가의 풀
  tuft: { fw: 0, fh: 0, variants: 4, sways: true }, // 풀포기
  flower: { fw: 0, fh: 0, variants: 5, sways: true }, // 들꽃
};

export function thing(kind: string): ThingDef {
  const def = THINGS[kind];
  if (!def) throw new Error(`모르는 갈래의 세운 것: ${kind}`);
  return def;
}
