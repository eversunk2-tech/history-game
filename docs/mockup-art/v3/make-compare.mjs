// 3차의 견주기: 장면은 지금 · 2차 시안(v2) · 3차 시안(v3), 사람은 지금 · v3(가) · v3(나). 수치는 지금·v1·v2·v3을 한 표로.
//
//   node docs/mockup-art/v3/make-compare.mjs   (3차 때의 견주기 — 결과는 v3/ 안에)
//     (먼저: make-before.mjs, v1/make-after.mjs, v2/make-v2.mjs, v3/make-v3.mjs)
//     → compare-scene.png(기기 화소 그대로), compare-scene-small.png(셋 모두 3분의 1 — 지금은 맵 점 하나 = 2화소,
//       시안은 그림 점 하나 = 1화소라 점 크기가 고르다), compare-people.png(위부터 지금 · v3(가) · v3(나)), compare-metrics.md

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Img, decodePng, encodePng, rgb } from '../lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => decodePng(readFileSync(join(here, '..', p)));
const json = (p) => JSON.parse(readFileSync(join(here, '..', p), 'utf8'));
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

const scenes = [read('before-scene.png'), read('v2/v2-scene.png'), read('v3/v3-scene.png')];
writeFileSync(join(here, 'compare-scene.png'), encodePng(side(scenes, 36)));
writeFileSync(join(here, 'compare-scene-small.png'), encodePng(side(scenes.map(third), 12)));
writeFileSync(join(here, 'compare-people.png'), encodePng(stack([read('before-people.png'), read('v3/v3-people-a.png'), read('v3/v3-people-b.png')], 24)));

// ── 수치 표(지금 · v1 · v2 · v3) ──
const b = json('before-metrics.json');
const v1 = json('v1/after-metrics.json');
const v2 = json('v2/v2-metrics.json');
const v3 = json('v3/v3-metrics.json');
const W = (m) => m.warmth; // v1·v2는 장면 그림에서 잰다(아래)
import('../lib.mjs').then(({ warmth }) => {
  const w1 = warmth(read('v1/after-scene.png'));
  const w2 = warmth(read('v2/v2-scene.png'));
  const cols = [W(b), w1, w2, W(v3)];
  const ppl = (m, k) => ['hero', 'elder', 'woman'].map((p) => m[p][k]).join(' · ');
  const row = (label, vals, rule) => `| ${label} | ${vals.join(' | ')} | ${rule} |`;
  const lines = [
    '| 수치(대문 앞 한 화면, `lib.mjs`의 셈) | 지금 | v1 | v2 | v3 | 3차 기준(4.7.5) |',
    '|---|---|---|---|---|---|',
    row('ㅍ 풀빛의 평균 색상각(°)', cols.map((c) => c.greenHue), '95~105'),
    row('ㅍ 화면 전체의 따뜻함(R−B 평균)', cols.map((c) => c.warmth), '49 이상'),
    row('ㅍ 어두운 점(밝기 0.3 아래)의 따뜻함', cols.map((c) => c.darkWarmth), '0 이상'),
    row('ㅍ 어두운 점의 몫(%)', cols.map((c) => c.darkShare), '7 이하'),
    row('ㅍ 평균 밝기(참고)', cols.map((c) => c.lum), '—'),
    row('ㄹ 땅의 대비 큰 외톨이 점(천 개당)', [b.groundHarsh, v1.groundHarsh, v2.groundHarsh, v3.groundHarsh], '1 이하'),
    row('ㄷ 땅의 대비 큰 체크무늬(천 개당)', [b.groundHarshChecker, v1.groundHarshChecker, v2.groundHarshChecker, v3.groundHarshChecker], '0.5 이하'),
    row('(참고) 땅의 외톨이 점 · 체크무늬 — 1·2차의 셈', [`${b.groundOrphans.per1000} · ${b.groundChecker}`, `${v1.groundOrphans.per1000} · ${v1.groundChecker}`, `${v2.groundOrphans.per1000} · ${v2.groundChecker}`, `${v3.groundOrphans.per1000} · ${v3.groundChecker}`], '— (고운 결은 세지 않는다)'),
    row('ㄹ 세운 것 한 장의 대비 큰 외톨이 점(천 개당, 대문·꽃나무·참나무·장독대·초가·우물)', [b.thingHarshPer1000, v1.thingHarshPer1000, v2.thingHarshPer1000, v3.thingHarshPer1000].map((t) => (t ? ['gate', 'blossom', 'oak', 'jars', 'choga', 'well'].map((k) => t[k] ?? '—').join(' · ') : '—')), '25 이하'),
    row('ㅁ 사람 바깥 점과 바로 밖 바닥의 밝기 차(주인공·어른·아주머니)', [ppl(b.people, 'edgeContrast'), ppl(v1.people, 'edgeContrast'), ppl(v2.people, 'edgeContrast'), `(가) ${ppl(v3.peopleA, 'edgeContrast')} / (나) ${ppl(v3.peopleB, 'edgeContrast')}`], '(나) 0.3 이상 · (가) 0.18 이상'),
    row('ㅇ 화면의 빛깔 수', [b.sceneColors, v1.sceneColors, v2.sceneColors, v3.sceneColors], '96 이하'),
    row('ㅌ 풀밭의 큰 결 — 밝기 · 색조', [b, v1, v2, v3].map((m) => `${m.monotony.grass.lumaStd} · ${m.monotony.grass.warmStd}`), '지금 이상(5.6 · 3.7)'),
    row('ㅌ 풀밭의 빛깔 갈래 · 평탄 조각(%)', [b, v1, v2, v3].map((m) => `${m.monotony.grass.tones} · ${m.monotony.grass.flatPct}`), '7 이상 · 18.5 이하'),
    row('ㅌ 흙의 큰 결 — 밝기 · 색조', [b, v1, v2, v3].map((m) => `${m.monotony.dirt.lumaStd} · ${m.monotony.dirt.warmStd}`), '지금 이상(5.4 · 4.4)'),
    row('ㅌ 흙의 빛깔 갈래 · 평탄 조각(%)', [b, v1, v2, v3].map((m) => `${m.monotony.dirt.tones} · ${m.monotony.dirt.flatPct}`), '8 이상 · 36 이하'),
  ];
  const note = [
    '',
    '- ㅍ의 다섯은 장면 그림 전체를 점 세 개마다 하나씩 잰다(조정자가 2차 시안을 판단할 때 쓴 셈과 같다 — `lib.mjs`의 `warmth`). 밝기는 HSL 밝기.',
    '- "대비 큰" 외톨이 점·체크무늬: 이웃과 밝기 차가 0.12(체크무늬는 0.1)를 넘는 것만 센다. 이웃 단계로만 옮겨 가는 고운 결(수채화 같은 알갱이)은 세지 않는다. 1·2차의 셈(밝기 차를 보지 않음)은 참고로 남겼다.',
    '- ㅁ은 먹빛 테두리가 없어도 잴 수 있게 바꿨다. 지금 그림은 먹빛을 섞은 테두리가 있어 이 값이 높다. 3차는 먹빛을 빼서 값이 내려가는 대신 발밑 그림자와 옷의 그늘로 가른다(13.2의 37번).',
    '- v1·v2의 장면은 그때의 시안이고, 3차의 장면은 (나) 안이다. (가) 안의 따뜻함은 `v3-metrics.json`의 `warmthA`.',
    '',
  ].join('\n');
  writeFileSync(join(here, 'compare-metrics.md'), '# 지금 · 첫 시안 · 2차 시안 · 3차 시안의 수치\n\n' + lines.join('\n') + '\n' + note);
  console.log(lines.join('\n'));
});
