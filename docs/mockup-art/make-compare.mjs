// 4차의 견주기: 장면은 지금 · 3차 시안(v3) · 3.1차 시안(v3.1), 사람은 지금 · v3.1(나). 수치는 지금 · v3 · v3.1을 한 표로.
//
//   node docs/mockup-art/make-compare.mjs
//     (먼저: make-before.mjs, v3/make-v3.mjs, make-v31.mjs)
//     → compare-scene.png(기기 화소 그대로), compare-scene-small.png(셋 모두 3분의 1 — 지금은 맵 점 하나 = 2화소,
//       시안은 그림 점 하나 = 1화소라 점 크기가 고르다), compare-people.png(위 지금 · 아래 v3.1(나)), compare-metrics.md
// (1~3차 때의 견주기는 v2/·v3/ 안에 그대로 있다)

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Img, decodePng, encodePng, rgb } from './lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => decodePng(readFileSync(join(here, p)));
const json = (p) => JSON.parse(readFileSync(join(here, p), 'utf8'));
const PAPER = rgb(244, 236, 217);

function side(list, pad) {
  const out = new Img(list.reduce((w, i) => w + i.w, 0) + pad * (list.length - 1), Math.max(...list.map((i) => i.h)));
  out.rect(0, 0, out.w, out.h, PAPER);
  let x = 0;
  for (const i of list) {
    out.blit(i, x, 0);
    x += i.w + pad;
  }
  return out;
}
function stack(list, pad) {
  const out = new Img(Math.max(...list.map((i) => i.w)), list.reduce((h, i) => h + i.h, 0) + pad * (list.length - 1));
  out.rect(0, 0, out.w, out.h, PAPER);
  let y = 0;
  for (const i of list) {
    out.blit(i, 0, y);
    y += i.h + pad;
  }
  return out;
}
/** 3분의 1로(3×3의 가운데 점) */
function third(img) {
  const out = new Img(Math.floor(img.w / 3), Math.floor(img.h / 3));
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) out.d[y * out.w + x] = img.d[(y * 3 + 1) * img.w + x * 3 + 1];
  return out;
}

const scenes = [read('before-scene.png'), read('v3/v3-scene.png'), read('v31-scene.png')];
writeFileSync(join(here, 'compare-scene.png'), encodePng(side(scenes, 36)));
writeFileSync(join(here, 'compare-scene-small.png'), encodePng(side(scenes.map(third), 12)));
writeFileSync(join(here, 'compare-people.png'), encodePng(stack([read('before-people.png'), read('v31-people.png')], 24)));

// ── 수치 표(지금 · v3 · v3.1) ──
const b = json('before-metrics.json');
const v3 = json('v3/v3-metrics.json');
const v31 = json('v31-metrics.json');
const cols = [b, v3, v31];
const ppl = (m) => ['hero', 'elder', 'woman'].map((p) => m[p].edgeContrast).join(' · ');
const tri = (t, f) => ['gate', 'choga', 'wall'].map((k) => f(t[k])).join(' · ');
const row = (label, vals, rule) => `| ${label} | ${vals.join(' | ')} | ${rule} |`;
const lines = [
  '| 수치(대문 앞 한 화면, `lib.mjs`의 셈) | 지금 | v3 | v3.1 | 4차 기준(4.7.5) |',
  '|---|---|---|---|---|',
  row('ㅎ 수채화 얼룩이 한 칸 어둡게 만든 점의 몫(대문 · 초가 · 담, %)', ['—', tri(v3.washDarkPct, (v) => v), tri(v31.washDarkPct, (v) => v)], '5 이하, 초가 8 이하(v3의 절반 아래)'),
  row('ㅎ 둘레(맵 점 4)보다 0.08 넘게 짙은 점의 몫(대문 · 초가 · 담, %)', cols.map((m) => tri(m.thingGrime, (g) => g.grimePct)), '참고(기둥·문살처럼 꼴이 짙은 곳도 센다)'),
  row('ㅎ 흙의 얼룩덜룩함(맵 점 8×8 조각과 이웃 조각의 밝기 차 평균 ×100)', cols.map((m) => m.blotch.dirt), '3.8 이하(지금 수준)'),
  row('ㅎ 풀의 얼룩덜룩함', cols.map((m) => m.blotch.grass), '4.0 이하'),
  row('ㅍ 풀빛의 평균 색상각(°)', cols.map((m) => m.warmth.greenHue), '95~105'),
  row('ㅍ 화면 전체의 따뜻함(R−B 평균)', cols.map((m) => m.warmth.warmth), '49 이상'),
  row('ㅍ 어두운 점의 따뜻함', cols.map((m) => m.warmth.darkWarmth), '0 이상'),
  row('ㅍ 어두운 점의 몫(%)', cols.map((m) => m.warmth.darkShare), '7 이하'),
  row('ㄹ 땅의 대비 큰 외톨이 점(천 개당)', cols.map((m) => m.groundHarsh), '1 이하'),
  row('ㄷ 땅의 대비 큰 체크무늬(천 개당)', cols.map((m) => m.groundHarshChecker), '0.5 이하'),
  row('ㅌ 풀밭의 큰 결 — 밝기 · 색조', cols.map((m) => `${m.monotony.grass.lumaStd} · ${m.monotony.grass.warmStd}`), '지금 이상(5.6 · 3.7)'),
  row('ㅌ 풀밭의 빛깔 갈래 · 평탄 조각(%)', cols.map((m) => `${m.monotony.grass.tones} · ${m.monotony.grass.flatPct}`), '7 이상 · 18.5 이하'),
  row('ㅌ 흙의 큰 결 — 밝기 · 색조', cols.map((m) => `${m.monotony.dirt.lumaStd} · ${m.monotony.dirt.warmStd}`), '밝기 지금 이상(5.4) · 색조 3.3 이상(4차에서 낮춤)'),
  row('ㅌ 흙의 빛깔 갈래 · 평탄 조각(%)', cols.map((m) => `${m.monotony.dirt.tones} · ${m.monotony.dirt.flatPct}`), '8 이상 · 36 이하'),
  row('ㅁ 사람 바깥 점과 바로 밖 바닥의 밝기 차(주인공 · 어른 · 아주머니)', [ppl(b.people), `(나) ${ppl(v3.peopleB)}`, ppl(v31.people)], '0.3 이상'),
  row('ㅇ 화면의 빛깔 수', cols.map((m) => m.sceneColors), '96 이하'),
];
const note = [
  '',
  '- ㅎ의 첫 줄은 시안 스크립트가 얼룩을 입히기 전과 견주어 센다(지금 그림에는 견줄 "얼룩 전"이 없어 —). 둘째 줄은 셋 모두 같은 셈이지만 기둥·문살·처마 그늘처럼 꼴이 짙은 곳도 함께 세므로, 같은 꼴인 v3과 v3.1을 견줄 때 뜻이 있다.',
  '- 얼룩덜룩함(ㅎ)은 이웃 조각끼리의 차이고, 큰 결(ㅌ)은 화면 전체의 퍼짐이다. v3.1은 큰 결을 지금 이상으로 두고 이웃 조각의 차만 지금 수준으로 낮췄다 — 얼룩이 크고 부드럽게 번진다.',
  '- 흙의 큰 결 색조는 지금(4.43)에 못 미친다(3.5). 지금 그림과 3차 시안의 흙 색조 퍼짐에는 잿빛 얼룩의 몫이 있는데, 4차에서 사용자가 잿빛 얼룩을 따뜻한 흙빛 쪽으로 옮기자고 했으므로 그만큼 내려갔다. 기준을 3.3으로 낮춘 까닭이다(4.7.5).',
  '- v3의 사람은 (나) 안의 값이다.',
  '',
].join('\n');
writeFileSync(join(here, 'compare-metrics.md'), '# 지금 · 3차 시안 · 3.1차 시안의 수치\n\n' + lines.join('\n') + '\n' + note);
console.log(lines.join('\n'));
