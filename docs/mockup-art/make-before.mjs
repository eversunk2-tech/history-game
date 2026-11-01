// 시안의 "지금" 쪽: 게임의 그림 코드(src/pixel)를 그대로 불러 마을 안 대문 앞(봄)을 그린다.
// 화면(위 띠·할 일 상자·작은 지도)은 빼고 맵만 그린다. 놓는 것은 시안(make-after.mjs)과 같은 것만 골라 같은 자리에 둔다.
//
//   node docs/mockup-art/make-before.mjs
//     → before-scene.png(2046×1536 — 아이패드 1024×768의 기기 화소, 맵 점 하나 = 6화소)
//       before-people.png(사람 셋 둘레를 크게), region.json(시안이 읽는 자리·땅·놓은 것), before-metrics.json
//
// src/를 고치지 않는다(읽기만 한다). TypeScript는 Vite가 읽어 준다(scripts/make-icons.mjs와 같은 길).

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { Img, blotch, colorCount, checker, edgeContrast, encodePng, grime, harshChecker, harshOrphans, monotony, orphans, outlineShare, personVsGround, rgb, spriteOrphans, warmth } from './lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

// ── 자리(맵의 점. 칸 하나 = 16점) ──
// 대문(51,27) 앞. 화면 1024×768을 맵 점 하나 = CSS 3화소로 보면 341×256점이다.
const CAM = { x: 676, y: 392 };
const VIEW = { w: 341, h: 256 };
const OUT_SCALE = 6; // 아이패드(dpr 2)에서 맵 점 하나 = 기기 화소 6
// 시안에 넣는 것: 기와 담과 대문, 초가 한 채, 꽃나무, 우물, 너럭돌, 울타리·돌담, 풀포기·들꽃·잔돌,
// 그리고 2차 시안에서 되살린 그 자리의 것(맵 자료에 실제로 있다): 장독대 둘, 우물가의 참나무, 꽃나무 둘(담 안의 흰 꽃나무 포함).
// 뺀 것: 담 안의 사랑채(화면 위 끝에 아래쪽만 조금 걸린다 — 두 쪽 모두에서 뺐다).
const KEEP = new Set(['wallH', 'wallV', 'gate', 'well', 'flatstone', 'fenceH', 'stonewallH', 'tuft', 'flower', 'rockS']);
const KEEP_AT = new Set(['choga@57,32', 'blossom@55,31', 'jars@42,32', 'jars@63,32', 'oak@49,31', 'blossom@44,31', 'blossom@58,25']);
// 그 자리의 짐승(맵 자료의 hen4·magpie2가 서는 칸)
const CRITTERS = [
  { id: 'hen', sprite: 'hen', x: 968, y: 554, flip: false },
  { id: 'magpie', sprite: 'magpie', x: 920, y: 634, flip: true },
];
// 사람 셋(맵의 점 — 발끝): 주인공 남자아이, 마을 어른, 우물가의 아주머니
const PEOPLE = [
  { id: 'hero', sprite: 'farmer-boy', x: 840, y: 494, dir: 'down', act: 'idle', frame: 0, label: '주인공(농민 집 아이)' },
  { id: 'elder', sprite: 'elderMan', x: 918, y: 556, dir: 'down', act: 'idle', frame: 0, label: '마을 어른' },
  { id: 'woman', sprite: 'wellWoman', x: 784, y: 541, dir: 'down', act: 'work', frame: 1, label: '우물가 아주머니' },
];

const server = await createServer({ root, configFile: false, logLevel: 'error', appType: 'custom', server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] } });
let mods;
try {
  mods = {
    maps: await server.ssrLoadModule('/src/content/maps/neutigol.ts'),
    catalog: await server.ssrLoadModule('/src/pixel/catalog.ts'),
    palette: await server.ssrLoadModule('/src/pixel/palette.ts'),
    master: await server.ssrLoadModule('/src/pixel/master.ts'),
    quant: await server.ssrLoadModule('/src/pixel/quant.ts'),
    ground: await server.ssrLoadModule('/src/pixel/ground.ts'),
    people: await server.ssrLoadModule('/src/pixel/people.ts'),
    critters: await server.ssrLoadModule('/src/pixel/critters.ts'),
  };
} catch (e) {
  await server.close();
  throw e;
}
await server.close();

const { neutigol } = mods.maps;
const { thingDefs, anchorOf, shadesFor, thingKey } = mods.catalog;
const { paletteOf } = mods.palette;
const { MASTER } = mods.master;
const { Snapper } = mods.quant;
const { paintGround } = mods.ground;
const { personFrame, personOf, footShadow } = mods.people;

const map = neutigol('spring');
const pal = paletteOf('spring');
const snap = new Snapper(MASTER.spring);
const defs = thingDefs(pal);

const inView = (x, y, w, h) => x + w > CAM.x - 8 && x < CAM.x + VIEW.w + 8 && y + h > CAM.y - 8 && y < CAM.y + VIEW.h + 60;
const chosen = [];
for (const o of map.objects) {
  const key = `${o.kind}@${o.tx},${o.ty}`;
  if (!KEEP.has(o.kind) && !KEEP_AT.has(key)) continue;
  const def = defs.get(thingKey(o.kind, o.variant));
  if (!def) continue;
  const f = def.frames[0];
  const at = anchorOf(o.kind, o.tx, o.ty, o.dx, o.dy);
  if (!inView(at.x - def.ax, at.y - def.ay, f.w, f.h)) continue;
  chosen.push({ o, def, at });
}

// ── 땅(고른 것의 그림자만 드리운다) ──
const shades = shadesFor((key) => defs.get(key)?.shades, chosen.map((c) => c.o));
const painted = paintGround(map, pal, shades);
snap.apply(painted.px);
const toImg = (px) => {
  const img = new Img(px.w, px.h);
  img.d.set(px.d);
  return img;
};
const groundAll = toImg(painted.px);
const ground = groundAll.crop(CAM.x, CAM.y, VIEW.w, VIEW.h);
const scene = ground.crop(0, 0, VIEW.w, VIEW.h);

// ── 세운 것과 사람: 발치가 위인 것부터 ──
const items = [];
const thingOrphans = {};
const thingHarsh = {};
const thingGrime = {};
for (const c of chosen) {
  const f = toImg(snap.apply(c.def.frames[0].clone()));
  if (['choga', 'blossom', 'well', 'gate', 'oak', 'jars'].includes(c.o.kind)) {
    thingOrphans[c.o.kind] = spriteOrphans(f);
    thingHarsh[c.o.kind] = harshOrphans(f);
  }
  if (['choga', 'gate'].includes(c.o.kind)) thingGrime[c.o.kind] = grime(f, 1);
  items.push({ sortY: c.at.y + (c.def.sort ?? 0), draw: () => scene.blit(f, c.at.x - c.def.ax - CAM.x, c.at.y - c.def.ay - CAM.y) });
}
const shadow = toImg(footShadow());
const sprites = {};
for (const p of PEOPLE) {
  const f = toImg(snap.apply(personFrame(personOf(p.sprite), p.dir, p.act, p.frame)));
  sprites[p.id] = f;
  items.push({
    sortY: p.y,
    draw: () => {
      scene.blit(shadow, p.x - 8 - CAM.x, p.y - 4 - CAM.y);
      scene.blit(f, p.x - 12 - CAM.x, p.y - 30 - CAM.y);
    },
  });
}
for (const c of CRITTERS) {
  const made = mods.critters[c.sprite]();
  const f = toImg(snap.apply(made.frames[0].clone()));
  const fw = Math.min(16, Math.round(f.w * 0.8));
  items.push({
    sortY: c.y,
    draw: () => {
      // draw.ts처럼: 발밑 그림자를 그림 너비의 4/5로 눌러 깔고 그 위에 짐승
      const sh = new Img(fw, 4);
      for (let y = 0; y < 4; y++) for (let x = 0; x < fw; x++) sh.set(x, y, shadow.get(Math.floor((x * shadow.w) / fw), Math.min(shadow.h - 1, Math.floor((y * shadow.h) / 4))));
      scene.blit(sh, c.x - Math.round(fw / 2) - CAM.x, c.y - 3 - CAM.y);
      const ax = c.flip ? f.w - 1 - made.ax : made.ax;
      scene.blit(f, c.x - ax - CAM.x, c.y - made.ay - CAM.y, c.flip);
    },
  });
}
items.sort((a, b) => a.sortY - b.sortY);
for (const it of items) it.draw();

writeFileSync(join(here, 'before-scene.png'), encodePng(scene.scale(OUT_SCALE)));

// ── 사람 셋 둘레를 크게(맵 점 40×48 → 12배) ──
const CLOSE = { w: 40, h: 48, up: 40 };
const closeups = PEOPLE.map((p) => scene.crop(p.x - CAM.x - CLOSE.w / 2, p.y - CAM.y - CLOSE.up, CLOSE.w, CLOSE.h).scale(12));
const gap = 24;
const row = new Img(closeups.length * closeups[0].w + (closeups.length - 1) * gap, closeups[0].h);
row.rect(0, 0, row.w, row.h, rgb(244, 236, 217));
closeups.forEach((c, i) => row.blit(c, i * (c.w + gap), 0));
writeFileSync(join(here, 'before-people.png'), encodePng(row));

/** 담 한 줄(가로로 이어진 첫 줄)을 이어 붙여 때를 잰다 — 지금 그림은 담이 칸마다 따로다 */
function wallGrime() {
  const tilesH = chosen.filter((c) => c.o.kind === 'wallH').sort((a, b) => a.o.ty - b.o.ty || a.o.tx - b.o.tx);
  const run = [];
  for (const c of tilesH) if (run.length === 0 || (c.o.ty === run[0].o.ty && c.o.tx === run[run.length - 1].o.tx + 1)) run.push(c);
  const f0 = run[0].def.frames[0];
  const img = new Img(16 * run.length, f0.h);
  run.forEach((c, i) => img.blit(toImg(snap.apply(c.def.frames[0].clone())), i * 16 + 8 - c.def.ax, 0));
  return grime(img, 1);
}

// ── 시안이 읽는 자리(땅의 갈래는 칸마다 한 글자) ──
const CODES = 'gmFTpyrsPfwdbBkKS'; // src/map/types.ts의 T 순서
const tx0 = Math.floor(CAM.x / 16) - 1;
const ty0 = Math.floor(CAM.y / 16) - 1;
const tx1 = Math.ceil((CAM.x + VIEW.w) / 16) + 1;
const ty1 = Math.ceil((CAM.y + VIEW.h) / 16) + 2;
const terrain = [];
for (let ty = ty0; ty <= ty1; ty++) {
  let s = '';
  for (let tx = tx0; tx <= tx1; tx++) s += CODES[map.terrain[ty * map.w + tx]];
  terrain.push(s);
}
const region = {
  note: 'make-before.mjs가 쓴다. 느티골(봄)의 대문 앞. 좌표는 맵의 점(칸 = 16점).',
  cam: CAM,
  view: VIEW,
  tiles: { x0: tx0, y0: ty0, codes: CODES },
  terrain,
  things: chosen.map((c) => ({ kind: c.o.kind, variant: c.o.variant, tx: c.o.tx, ty: c.o.ty, ax: c.at.x, ay: c.at.y, w: c.def.frames[0].w, h: c.def.frames[0].h })),
  people: PEOPLE,
  critters: CRITTERS,
  close: CLOSE,
};
writeFileSync(join(here, 'region.json'), JSON.stringify(region, null, 1) + '\n');

// ── 수치 ──
const metrics = {
  note: '지금 그림(1배, 타일 16점). 그림 점 단위로 잰다.',
  groundOrphans: orphans(ground, 16),
  groundChecker: checker(ground),
  groundHarsh: harshOrphans(ground),
  groundHarshChecker: harshChecker(ground),
  warmth: warmth(scene.scale(OUT_SCALE)),
  monotony: monotony(ground, region, 1),
  sceneColors: colorCount(scene),
  thingOrphansPer1000: thingOrphans,
  thingHarshPer1000: thingHarsh,
  thingGrime: { ...thingGrime, wall: wallGrime() },
  blotch: blotch(ground, region, 1),
  people: Object.fromEntries(
    PEOPLE.map((p) => [
      p.id,
      { outlineShare: outlineShare(sprites[p.id]), orphansPer1000: spriteOrphans(sprites[p.id]), edgeContrast: edgeContrast(sprites[p.id], p.x - 12 - CAM.x, p.y - 30 - CAM.y, ground), ...personVsGround(sprites[p.id], p.x - 12 - CAM.x, p.y - 30 - CAM.y, ground, 4) },
    ]),
  ),
};
writeFileSync(join(here, 'before-metrics.json'), JSON.stringify(metrics, null, 2) + '\n');
console.log(JSON.stringify(metrics, null, 2));
console.log(`그림 ${chosen.length}개, 사람 ${PEOPLE.length} → before-scene.png, before-people.png, region.json`);
