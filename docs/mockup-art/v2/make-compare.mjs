// 견주기 그림: 지금 · 첫 시안(v1) · 2차 시안(v2)을 나란히 놓는다. 수치도 한 표로 모은다.
//
//   node docs/mockup-art/v2/make-compare.mjs   (2차 때의 견주기 — 결과는 v2/ 안에)
//     (먼저: make-before.mjs, v1/make-after.mjs, v2/make-v2.mjs)
//     → compare-scene.png(기기 화소 그대로, 왼쪽부터 지금·v1·v2), compare-scene-small.png(셋 모두 3분의 1 —
//       지금은 맵 점 하나 = 2화소, v1·v2는 그림 점 하나 = 1화소라 점 크기가 고르다), compare-people.png(위부터 지금·v1·v2),
//       compare-metrics.md(수치 표)

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Img, decodePng, encodePng, rgb } from '../lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => decodePng(readFileSync(join(here, '..', p)));
const PAPER = rgb(244, 236, 217);

const scenes = [read('before-scene.png'), read('v1/after-scene.png'), read('v2/v2-scene.png')];
const people = [read('before-people.png'), read('v1/after-people.png'), read('v2/v2-people.png')];

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
/** 3분의 1로(3×3의 가운데 점). 지금은 6화소 → 2화소, v1·v2는 3화소 → 1화소로 정수배가 지켜진다. */
function third(img) {
  const out = new Img(Math.floor(img.w / 3), Math.floor(img.h / 3));
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) out.d[y * out.w + x] = img.d[(y * 3 + 1) * img.w + x * 3 + 1];
  return out;
}

writeFileSync(join(here, 'compare-scene.png'), encodePng(side(scenes, 36)));
writeFileSync(join(here, 'compare-scene-small.png'), encodePng(side(scenes.map(third), 12)));
writeFileSync(join(here, 'compare-people.png'), encodePng(stack(people, 24)));

// ── 수치 표 ──
const m = [
  JSON.parse(readFileSync(join(here, '..', 'before-metrics.json'), 'utf8')),
  JSON.parse(readFileSync(join(here, '..', 'v1/after-metrics.json'), 'utf8')),
  JSON.parse(readFileSync(join(here, 'v2-metrics.json'), 'utf8')),
];
const row = (label, f, rule) => `| ${label} | ${m.map(f).join(' | ')} | ${rule} |`;
const ppl = (k, fmt = (v) => v) => (x) => ['hero', 'elder', 'woman'].map((p) => fmt(x.people[p][k])).join(' · ');
const pct = (v) => `${Math.round(v * 100)}%`;
const lines = [
  '| 수치(대문 앞 한 화면, `lib.mjs`의 셈) | 지금 | 첫 시안(v1) | 2차 시안(v2) | 4.7.5의 기준 |',
  '|---|---|---|---|---|',
  row('ㄹ 땅의 외톨이 점(그림 점 천 개당)', (x) => x.groundOrphans.per1000, '8 이하'),
  row('ㄷ 땅의 체크무늬(천 개당)', (x) => x.groundChecker, '1 이하'),
  row('ㄴ 사람 둘레 점 가운데 밝기 0.2 이하(주인공·어른·아주머니)', ppl('outlineShare', pct), '90% 이상'),
  row('ㅁ 사람 둘레 점의 평균 밝기', ppl('edge'), '0.15 이하'),
  row('ㅁ 둘레 점과 발치 바닥의 밝기 차(사람 자신의 그림자는 빼고)', ppl('groundMinusEdge'), '0.35 이상'),
  row('ㄹ 사람 한 장의 외톨이 점(천 개당)', ppl('orphansPer1000'), '20 이하'),
  row('ㅇ 화면의 빛깔 수', (x) => x.sceneColors, '96 이하'),
  row('ㅌ 풀밭의 큰 결 — 밝기(맵 점 8×8 조각 평균의 표준편차 ×100)', (x) => x.monotony.grass.lumaStd, '4.5 이상'),
  row('ㅌ 풀밭의 큰 결 — 색조((빨강−파랑)/255의 표준편차 ×100)', (x) => x.monotony.grass.warmStd, '3 이상'),
  row('ㅌ 풀밭의 빛깔 갈래(넓이 1% 이상)', (x) => x.monotony.grass.tones, '6 이상'),
  row('ㅌ 풀밭의 평탄 조각(맵 점 4×4에 한 빛이 90% 이상, %)', (x) => x.monotony.grass.flatPct, '25 이하'),
  row('ㅌ 흙의 큰 결 — 밝기', (x) => x.monotony.dirt.lumaStd, '4.5 이상'),
  row('ㅌ 흙의 큰 결 — 색조', (x) => x.monotony.dirt.warmStd, '3 이상'),
  row('ㅌ 흙의 빛깔 갈래', (x) => x.monotony.dirt.tones, '5 이상'),
  row('ㅌ 흙의 평탄 조각(%)', (x) => x.monotony.dirt.flatPct, '40 이하'),
];
const note = '\n- 지금 쪽의 빛깔 수가 64를 넘는 것은 닭·까치의 발밑 그림자(반투명)가 바닥과 섞인 빛 때문이다(게임에서도 그렇다 — 규칙 ㅂ이 막는 것).\n- v1의 "둘레 점과 바닥의 밝기 차"는 2차에서 잼을 고쳐(사람 자신의 그림자를 빼고) 다시 쟀다. 그림은 그대로다.\n';
writeFileSync(join(here, 'compare-metrics.md'), '# 지금 · 첫 시안 · 2차 시안의 수치\n\n' + lines.join('\n') + '\n' + note);
console.log(lines.join('\n'));
