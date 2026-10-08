// 그림 견본(개발용) — 땅, 세운 것, 인물, 짐승과 표시를 한 장에 늘어놓고 배율과 계절을 바꿔 본다.
// 그림을 고칠 때 이 화면을 실제 크기로 찍어 보며 가장 어설픈 것부터 고친다(spec 11절).

import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { seasonLabels } from '../content/labels';
import { SEASONS, type Season } from '../engine/types';
import { MapBuilder } from '../map/build';
import { THINGS } from '../map/things';
import { T, TILE } from '../map/types';
import { buildAtlas, paintedGround, type Atlas, type Img } from '../pixel/atlas';
import { shadesAt, thingKey } from '../pixel/catalog';
import type { Shade } from '../pixel/ground';
import { COL, HEROES, PERSON_AX, PERSON_AY, PERSON_H, PERSON_W, SHEET_COLS, VILLAGERS } from '../pixel/people';
import { artSeason, backToTitle } from '../state/store';

/** 땅의 갈래를 모두 이웃하게 놓은 작은 견본 맵 */
function demoMap(): MapBuilder {
  const b = new MapBuilder(46, 22, 7);
  b.fill(0, 0, 45, 1, T.thicket);
  b.blob(6, 5, 5, 3, T.forest, 0.25);
  b.blob(38, 5, 6, 3, T.meadow, 0.25);
  b.blob(40, 15, 5, 4, T.rock, 0.3);
  b.river(
    [
      [22, 0],
      [20, 7],
      [24, 13],
      [30, 17],
      [46, 19],
    ],
    () => 2.1,
    () => 0.8,
  );
  b.band(
    [
      [0, 10],
      [12, 10],
      [18, 8],
      [30, 9],
      [46, 9],
    ],
    1.0,
    T.path,
    undefined,
    T.bridge,
  );
  b.blob(11, 6, 3.5, 2, T.yard, 0.2, [T.grass, T.forest]);
  b.fill(2, 13, 7, 16, T.paddy);
  b.fill(9, 13, 14, 16, T.soil);
  b.fill(2, 18, 7, 20, T.field);
  b.fill(1, 12, 15, 12, T.ridge);
  b.fill(1, 17, 15, 17, T.ridge);
  b.fill(1, 12, 1, 17, T.ridge);
  b.fill(8, 12, 8, 21, T.ridge);
  b.fill(15, 12, 15, 17, T.ridge);
  b.fill(27, 12, 36, 12, T.bank, [T.grass]);
  b.set(31, 12, T.steps);
  b.band(
    [
      [31.5, 10],
      [31.5, 21],
    ],
    0.5,
    T.path,
    undefined,
    T.ford,
  );
  b.set(31, 12, T.steps);
  return b;
}

interface Laid {
  img: Img;
  x: number;
  y: number;
}

/** 세운 것을 줄줄이 늘어놓는다 */
function layThings(atlas: Atlas, width: number): { items: Laid[]; height: number; shades: Shade[] } {
  const items: Laid[] = [];
  const shades: Shade[] = [];
  let x = 10;
  let y = 14;
  let rowH = 0;
  const order = Object.keys(THINGS).sort((a, b) => {
    const ia = atlas.things.get(thingKey(a, 0));
    const ib = atlas.things.get(thingKey(b, 0));
    return (ib?.h ?? 0) - (ia?.h ?? 0);
  });
  for (const kind of order) {
    for (let v = 0; v < THINGS[kind].variants; v++) {
      const img = atlas.things.get(thingKey(kind, v));
      if (!img) continue;
      if (x + img.w + 10 > width) {
        x = 10;
        y += rowH + 12;
        rowH = 0;
      }
      items.push({ img, x, y });
      rowH = Math.max(rowH, img.h);
      x += img.w + 10;
    }
  }
  const height = y + rowH + 16;
  // 같은 줄의 것은 발치를 맞춘다
  const rows = new Map<number, Laid[]>();
  for (const it of items) rows.set(it.y, [...(rows.get(it.y) ?? []), it]);
  for (const list of rows.values()) {
    const base = Math.max(...list.map((it) => it.img.ay));
    for (const it of list) {
      it.y += base - it.img.ay;
      shades.push(...shadesAt(it.img.shades, it.x + it.img.ax, it.y + it.img.ay));
    }
  }
  return { items, height, shades };
}

function useAtlas(season: Season): Atlas | null {
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  useEffect(() => {
    setAtlas(null);
    const timer = window.setTimeout(() => setAtlas(buildAtlas(season)), 20);
    return () => window.clearTimeout(timer);
  }, [season]);
  return atlas;
}

/** 시간에 따른 빛(견본에서만 바꿔 본다. 맵에는 다음 바퀴에 넣는다) */
type Light = 'morning' | 'noon' | 'dusk';
const LIGHTS: { id: Light; label: string }[] = [
  { id: 'morning', label: '아침' },
  { id: 'noon', label: '한낮' },
  { id: 'dusk', label: '해거름' },
];

interface SectionProps {
  title: string;
  width: number;
  height: number;
  zoom: number;
  moving: boolean;
  light: Light;
  /** t는 흐른 시간(초) */
  paint: (ctx: CanvasRenderingContext2D, t: number) => void;
}

function Section({ title, width, height, zoom, moving, light, paint }: SectionProps): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const began = performance.now();
    const draw = (): void => paint(ctx, moving ? (performance.now() - began) / 1000 : 0);
    draw();
    if (!moving) return;
    const timer = window.setInterval(draw, 110);
    return () => window.clearInterval(timer);
  }, [paint, moving, width, height]);
  return (
    <section class="sheet-section">
      <h2>{title}</h2>
      <div class={`sheet-light ${light}`} style={{ width: `${width * zoom}px`, height: `${height * zoom}px` }}>
        <canvas ref={ref} width={width} height={height} style={{ width: `${width * zoom}px`, height: `${height * zoom}px` }} />
      </div>
    </section>
  );
}

const frameOf = (img: Img, t: number, rate = 1.7): number => (img.n > 1 ? img.seq[Math.floor(t * rate) % img.seq.length] : 0);

export function Sheet(): JSX.Element {
  const season = artSeason.value;
  const initialZoom = Number(new URLSearchParams(window.location.search).get('zoom')) || 3;
  const [zoom, setZoom] = useState(Math.min(6, Math.max(1, Math.round(initialZoom))));
  const [moving, setMoving] = useState(true);
  const [light, setLight] = useState<Light>('noon');
  // ?only=ground|things|people|etc 로 한 갈래만 볼 수 있다(화면을 찍어 볼 때)
  const only = new URLSearchParams(window.location.search).get('only');
  const show = (name: string): boolean => !only || only === name;
  const atlas = useAtlas(season);
  const [parts, setParts] = useState<{
    ground: HTMLCanvasElement;
    wet: Uint8Array;
    gw: number;
    gh: number;
    things: { items: Laid[]; height: number; base: HTMLCanvasElement };
  } | null>(null);

  useEffect(() => {
    if (!atlas) {
      setParts(null);
      return;
    }
    const demo = demoMap();
    const g = paintedGround(atlas, demo, []);
    const laid = layThings(atlas, 660);
    const plain = new MapBuilder(Math.ceil(660 / TILE), Math.ceil(laid.height / TILE), 3);
    const base = paintedGround(atlas, plain, laid.shades);
    setParts({
      ground: g.canvas,
      wet: g.ground.wet,
      gw: demo.w,
      gh: demo.h,
      things: { items: laid.items, height: plain.h * TILE, base: base.canvas },
    });
  }, [atlas]);

  const people = Object.keys({ ...HEROES, ...VILLAGERS });
  const perRow = 2;
  const cellW = PERSON_W * SHEET_COLS + 12;
  const peopleH = Math.ceil(people.length / perRow) * (PERSON_H * 4 + 10) + 64;

  return (
    <main class={`screen sheet season-${season}`}>
      <header class="sheet-bar">
        <h1>그림 견본 (개발용)</h1>
        <div class="sheet-group" role="group" aria-label="배율">
          배율
          {[1, 2, 3, 4, 5, 6].map((z) => (
            <button key={z} type="button" class={`btn small${zoom === z ? ' on' : ''}`} aria-pressed={zoom === z} onClick={() => setZoom(z)}>
              {z}
            </button>
          ))}
        </div>
        <div class="sheet-group" role="group" aria-label="계절">
          계절
          {SEASONS.map((s) => (
            <button key={s} type="button" class={`btn small${season === s ? ' on' : ''}`} aria-pressed={season === s} onClick={() => (artSeason.value = s)}>
              {seasonLabels[s].label}
            </button>
          ))}
        </div>
        <div class="sheet-group" role="group" aria-label="빛">
          빛
          {LIGHTS.map((l) => (
            <button key={l.id} type="button" class={`btn small${light === l.id ? ' on' : ''}`} aria-pressed={light === l.id} onClick={() => setLight(l.id)}>
              {l.label}
            </button>
          ))}
        </div>
        <div class="sheet-group">
          <button type="button" class={`btn small${moving ? ' on' : ''}`} aria-pressed={moving} onClick={() => setMoving(!moving)}>
            움직임 {moving ? '켬' : '끔'}
          </button>
        </div>
        <button type="button" class="btn small" onClick={backToTitle}>
          처음으로
        </button>
      </header>
      <div class="sheet-scroll">
        {(!atlas || !parts) && <p class="map-loading">그림을 찍는 중이에요…</p>}
        {atlas && parts && (
          <>
            {show('ground') && (
              <Section
                title="땅 — 풀, 들꽃, 숲 바닥, 흙길, 마당, 논둑, 갈아엎은 논, 물 댄 논, 밭이랑, 냇물(얕은 곳·깊은 곳), 징검다리, 나무다리, 돌밭, 둔덕과 돌층계"
                width={parts.gw * TILE}
                height={parts.gh * TILE}
                zoom={zoom}
                moving={moving}
                light={light}
                paint={(ctx, t) => {
                  const wf = Math.floor(t * 7) % atlas.waterN;
                  for (let ty = 0; ty < parts.gh; ty++) {
                    for (let tx = 0; tx < parts.gw; tx++) {
                      if (parts.wet[ty * parts.gw + tx] === 0) continue;
                      ctx.drawImage(atlas.water, wf * 64 + ((tx * TILE) & 63), (ty * TILE) & 63, TILE, TILE, tx * TILE, ty * TILE, TILE, TILE);
                    }
                  }
                  ctx.drawImage(parts.ground, 0, 0);
                }}
              />
            )}
            {show('things') && (
              <Section
                title="세운 것 — 집과 담, 마당의 것, 돌, 나무와 덤불과 풀"
                width={660}
                height={parts.things.height}
                zoom={zoom}
                moving={moving}
                light={light}
                paint={(ctx, t) => {
                  ctx.drawImage(parts.things.base, 0, 0);
                  parts.things.items.forEach((it, i) => {
                    const f = frameOf(it.img, t + i * 0.37);
                    ctx.drawImage(it.img.canvas, f * it.img.w, 0, it.img.w, it.img.h, it.x, it.y, it.img.w, it.img.h);
                  });
                }}
              />
            )}
            {show('people') && (
              <Section
                title="인물 — 줄: 아래·위·왼쪽·오른쪽 / 칸: 걷기 4 · 숨쉬기 2 · 일 4 · 앉기 2. 맨 아래 줄은 움직이는 모습(걷기, 서 있기, 일, 앉기)"
                width={cellW * perRow + 8}
                height={peopleH}
                zoom={zoom}
                moving={moving}
                light={light}
                paint={(ctx, t) => {
                  ctx.fillStyle = '#c9a97e';
                  ctx.fillRect(0, 0, cellW * perRow + 8, peopleH);
                  people.forEach((name, i) => {
                    const sheet = atlas.people.get(name);
                    if (!sheet) return;
                    ctx.drawImage(sheet, 6 + (i % perRow) * cellW, 6 + Math.floor(i / perRow) * (PERSON_H * 4 + 10));
                  });
                  // 움직이는 줄
                  const y = peopleH - 44;
                  ctx.fillStyle = '#85b853';
                  ctx.fillRect(0, y - 14, cellW * perRow + 8, 58);
                  people.forEach((name, i) => {
                    const sheet = atlas.people.get(name);
                    if (!sheet) return;
                    const mode = Math.floor(t / 3 + i * 0.5) % 4;
                    const dir = Math.floor(t / 1.5 + i) % 4;
                    const col =
                      mode === 0
                        ? COL.walk + (Math.floor(t * 7.6) % 4)
                        : mode === 1
                          ? COL.idle + ((t + i) % 2.6 > 1.6 ? 1 : 0)
                          : mode === 2
                            ? COL.work + (Math.floor(t * 3.6) % 4)
                            : COL.sit + ((t + i) % 3.4 > 2.3 ? 1 : 0);
                    const x = 14 + i * 22;
                    ctx.drawImage(atlas.foot.canvas, x - 8, y + PERSON_AY - 4);
                    ctx.drawImage(sheet, col * PERSON_W, (mode === 3 ? 0 : dir) * PERSON_H, PERSON_W, PERSON_H, x - PERSON_AX, y, PERSON_W, PERSON_H);
                  });
                }}
              />
            )}
            {show('etc') && (
              <Section
                title="짐승과 표시와 날리는 것 — 닭, 병아리, 개, 소, 논 가는 소, 까치, 나비 / 깃발, 말풍선, 자물쇠, 화살표 / 꽃잎, 연기, 물빛 반짝임, 구름 그림자"
                width={560}
                height={200}
                zoom={zoom}
                moving={moving}
                light={light}
                paint={(ctx, t) => {
                  ctx.fillStyle = '#85b853';
                  ctx.fillRect(0, 0, 560, 200);
                  let x = 8;
                  for (const name of ['hen', 'rooster', 'chick', 'dog', 'ox', 'plowTeam', 'magpie', 'egret']) {
                    const img = atlas.critters.get(name);
                    if (!img) continue;
                    for (let f = 0; f < img.n; f++) {
                      ctx.drawImage(img.canvas, f * img.w, 0, img.w, img.h, x, 44 - img.h, img.w, img.h);
                      x += img.w + 3;
                    }
                    x += 6;
                  }
                  x = 8;
                  for (const name of ['hen', 'rooster', 'chick', 'dog', 'ox', 'plowTeam', 'magpie', 'egret']) {
                    const img = atlas.critters.get(name);
                    if (!img) continue;
                    const f = Math.floor(t * 5) % img.n;
                    ctx.drawImage(img.flipped, (img.n - 1 - f) * img.w, 0, img.w, img.h, x, 96 - img.h, img.w, img.h);
                    x += img.w + 10;
                  }
                  x = 8;
                  const bob = Math.round(Math.sin(t * 3) * 1.5);
                  for (const img of [atlas.flag, atlas.bubble, atlas.lock]) {
                    ctx.drawImage(img.canvas, x, 110 + bob);
                    x += img.w + 8;
                  }
                  ctx.drawImage(atlas.rings.canvas, (Math.floor(t * 5) % 2) * atlas.rings.w, 0, atlas.rings.w, atlas.rings.h, x, 116, atlas.rings.w, atlas.rings.h);
                  x += 28;
                  for (const a of atlas.arrows) {
                    ctx.drawImage(a.canvas, x, 108);
                    x += a.w + 4;
                  }
                  x = 8;
                  for (const d of atlas.drift) {
                    ctx.drawImage(d.canvas, x, 142);
                    x += 8;
                  }
                  x += 6;
                  for (const sm of atlas.smoke) {
                    ctx.drawImage(sm.canvas, x, 138);
                    x += sm.w + 4;
                  }
                  x += 6;
                  for (let f = 0; f < 3; f++) {
                    ctx.fillStyle = '#97b8c4';
                    ctx.fillRect(x - 1, 139, 7, 7);
                    ctx.drawImage(atlas.glint.canvas, f * 5, 0, 5, 5, x, 140, 5, 5);
                    x += 10;
                  }
                  for (const bf of atlas.butterflies) {
                    ctx.drawImage(bf.canvas, (Math.floor(t * 9) % 2) * bf.w, 0, bf.w, bf.h, x + 4, 140, bf.w, bf.h);
                    x += 12;
                  }
                  ctx.drawImage(atlas.cloud.canvas, 330, 100);
                }}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}
