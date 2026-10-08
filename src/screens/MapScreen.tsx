// 맵 화면 — 느티골을 걸어 다닌다(바퀴 1-나).
// 가려는 곳을 누르면 걸어간다. PC에서는 화살표 자판과 Enter·Space도 된다. 화면에 방향 단추는 두지 않는다.
// 깃발(꼭 푸는 미션)이나 말풍선(덤으로 할 일)에 닿으면 임시 창이 뜬다. 대화 장면은 다음 바퀴에 만든다.

import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { neutigol } from '../content/maps/neutigol';
import { seasonLabels } from '../content/labels';
import { scaleFor } from '../map/camera';
import { buildScene, miniColors, render, stepScene, type Scene, type View } from '../map/draw';
import { tileOf } from '../map/path';
import { TILE, zoneAt, type Spot } from '../map/types';
import { createWorld, interact, setKeys, snapCamera, stepWorld, tapWorld, type World, type WorldEvent } from '../map/world';
import { buildAtlas } from '../pixel/atlas';
import { hex } from '../pixel/px';
import { artSeason, askHome, askingHome, type Walker } from '../state/store';

interface Panel {
  tag: string;
  name: string;
  text: string;
  note: string;
}

interface Toast {
  head: string;
  text: string;
  locked: boolean;
}

const KEY_DIRS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  a: [-1, 0],
  d: [1, 0],
  w: [0, -1],
  s: [0, 1],
};

/** 만드는 사람이 재고 찍어 볼 때 쓰는 값들. 개발 때만 창에 걸어 둔다(빌드에는 들어가지 않는다). */
interface DevHooks {
  __world?: World;
  __scene?: Scene;
  __fps?: number;
  __ms?: number;
  __overview?: () => string;
}

export function MapScreen({ walker }: { walker: Walker }): JSX.Element {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const todoRef = useRef<HTMLElement>(null);
  const miniBoxRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World | null>(null);
  const [ready, setReady] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [guide, setGuide] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(true);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [zone, setZone] = useState('');
  const [spots, setSpots] = useState<Spot[]>([]);
  const [miniScale, setMiniScale] = useState(2);
  const [fps, setFps] = useState<number | null>(null);
  const panelRef = useRef<Panel | null>(null);
  panelRef.current = panel;
  const season = artSeason.value;

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    const mini = miniRef.current;
    if (!canvas || !stage || !mini) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    const mctx = mini.getContext('2d');
    if (!ctx || !mctx) return;

    let stopped = false;
    let raf = 0;
    let scene: Scene | null = null;
    let world: World | null = null;
    const view: View = { ctx, w: 0, h: 0, scale: 3 };
    let toastUntil = 0;
    let toastGate = false;
    // 주소의 매개변수(?fps, ?awake, ?at=칸,칸)는 개발 때만 먹는다
    const query = new URLSearchParams(import.meta.env.DEV ? window.location.search : '');
    const showFps = query.has('fps');
    // 만드는 사람이 가려진 창에서 돌려 볼 때 쓴다(?awake). 보통은 화면이 가려지면 멈춘다.
    const stayAwake = query.has('awake');
    const dev = window as unknown as DevHooks;

    const resize = (): void => {
      const dpr = window.devicePixelRatio || 1;
      const rect = stage.getBoundingClientRect();
      const w = Math.max(64, Math.round(rect.width * dpr));
      const h = Math.max(64, Math.round(rect.height * dpr));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      // 캔버스의 화소와 화면의 화소를 하나씩 맞춘다(흐려지지 않게).
      // 위쪽 띠의 높이가 소수로 떨어지는 화면에서는 캔버스를 화소 금에 맞게 조금 당겨 놓는다.
      canvas.style.width = `${w / dpr}px`;
      canvas.style.height = `${h / dpr}px`;
      const offX = (rect.left * dpr) % 1;
      const offY = (rect.top * dpr) % 1;
      canvas.style.left = `${-offX / dpr}px`;
      canvas.style.top = `${-offY / dpr}px`;
      view.w = w;
      view.h = h;
      view.scale = scaleFor(w, h, dpr);
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      setMiniScale(Math.max(2, Math.round(rem / 8)));
      if (world) {
        world.view = { w: w / view.scale, h: h / view.scale };
        snapCamera(world);
      }
    };

    /** 화살표가 피해 갈 자리: 할 일 쪽지와 작은 지도가 화면에서 차지한 네모(캔버스의 화소) */
    const measureAvoid = (): void => {
      if (!world) return;
      const base = canvas.getBoundingClientRect();
      const k = canvas.width / base.width;
      const out: World['avoid'] = [];
      for (const el of [todoRef.current, miniBoxRef.current]) {
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        out.push({ x0: (r.left - base.left) * k, y0: (r.top - base.top) * k, x1: (r.right - base.left) * k, y1: (r.bottom - base.top) * k });
      }
      world.avoid = out;
    };

    const onEvents = (events: WorldEvent[]): void => {
      for (const e of events) {
        if (e.type === 'gate') {
          setToast({ head: e.label, text: e.reason, locked: true });
          toastUntil = performance.now() + 9000;
          toastGate = true;
        } else if (e.type === 'note') {
          setToast({ head: '', text: e.text, locked: false });
          toastUntil = performance.now() + 5000;
          toastGate = false;
        } else if (e.type === 'spot') {
          setPanel({
            tag: e.spot.kind === 'must' ? '꼭 할 일' : '덤으로 할 일',
            name: `${e.spot.label} — 「${e.spot.title}」`,
            text: e.spot.about,
            note: '이 일은 다음에 만들어요. 지금은 자리만 볼 수 있어요.',
          });
        } else if (e.type === 'dweller') {
          // 이름은 누가 보느냐에 따라 다르다(제 식구면 "어머니", 남의 식구면 "농민 집 아주머니")
          setPanel({ tag: '만난 사람', name: e.name, text: e.dweller.about, note: '이야기는 다음에 나눌 수 있어요.' });
        }
      }
    };

    // 작은 지도
    let miniBase: Uint32Array | null = null;
    const miniImage = mctx.createImageData(mini.width, mini.height);
    const miniData = new Uint32Array(miniImage.data.buffer);
    const fog = hex('#d9cdb3');
    const drawMini = (): void => {
      if (!world || !miniBase) return;
      const { map, visited } = world;
      for (let i = 0; i < miniData.length; i++) {
        const c = miniBase[i];
        if (visited[i]) miniData[i] = c;
        else {
          // 아직 가 보지 않은 곳은 한지 빛에 엷게
          const r = ((c & 255) * 0.22 + (fog & 255) * 0.78) | 0;
          const g = (((c >> 8) & 255) * 0.22 + ((fog >> 8) & 255) * 0.78) | 0;
          const b = (((c >> 16) & 255) * 0.22 + ((fog >> 16) & 255) * 0.78) | 0;
          miniData[i] = (255 << 24) | (b << 16) | (g << 8) | r;
        }
      }
      mctx.putImageData(miniImage, 0, 0);
      // 자리 표시
      for (const spot of world.spots) {
        const [x, y] = spot.at;
        const on = world.guide === spot.id;
        mctx.fillStyle = '#2a2422';
        mctx.fillRect(x - 2, y - 2, 4, 4);
        mctx.fillStyle = spot.kind === 'must' ? '#d9482f' : '#fbf6e9';
        mctx.fillRect(x - 1, y - 1, 2, 2);
        if (on && Math.floor(world.time * 3) % 2 === 0) {
          mctx.strokeStyle = '#f6c843';
          mctx.lineWidth = 1;
          mctx.strokeRect(x - 3.5, y - 3.5, 7, 7);
        }
      }
      // 지금 있는 곳
      const [px, py] = tileOf(world.player);
      mctx.fillStyle = '#2a2422';
      mctx.fillRect(px - 2, py - 2, 5, 5);
      mctx.fillStyle = Math.floor(world.time * 2.5) % 2 === 0 ? '#ffe98a' : '#f6c843';
      mctx.fillRect(px - 1, py - 1, 3, 3);
      setZone(zoneAt(map, px, py)?.label ?? '');
    };

    let last = 0;
    let workMs = 0;
    let frames = 0;
    let fpsAt = 0;
    let tick = 0;
    const loop = (now: number): void => {
      if (stopped) return;
      raf = requestAnimationFrame(loop);
      if (!world || !scene) return;
      // 화면이 가려지면 멈춘다. 돌아왔을 때 한꺼번에 건너뛰지 않게 한 번에 0.05초까지만 흘린다.
      if (document.hidden && !stayAwake) {
        last = now;
        return;
      }
      const dt = last === 0 ? 0 : Math.min(0.05, (now - last) / 1000);
      last = now;
      world.paused = panelRef.current !== null || askingHome.value;
      const began = performance.now();
      const events = stepWorld(world, dt);
      if (events.length > 0) onEvents(events);
      stepScene(scene, world, dt);
      render(view, world, scene);
      if (tick % 8 === 0) drawMini();
      if (tick % 12 === 0) measureAvoid();
      tick++;
      // 한 장을 셈하고 그리는 데 든 시간(밀리초)의 흐름 평균
      workMs = workMs * 0.9 + (performance.now() - began) * 0.1;
      // 까닭 한 줄은 문에서 멀어지면 바로, 가만히 있어도 얼마 뒤에는 사라진다
      if (toastUntil !== 0 && (now > toastUntil || (toastGate && world.shownGate === null && !world.paused))) {
        toastUntil = 0;
        setToast(null);
      }
      frames++;
      if (now - fpsAt >= 1000) {
        const value = Math.round((frames * 1000) / (now - fpsAt));
        if (import.meta.env.DEV) {
          dev.__fps = value;
          dev.__ms = workMs;
        }
        if (showFps) setFps(value);
        frames = 0;
        fpsAt = now;
      }
    };

    // 그림을 찍는 데 잠깐 걸린다. "그리는 중"을 먼저 보여 주고 시작한다.
    const start = window.setTimeout(() => {
      if (stopped) return;
      const map = neutigol();
      const atlas = buildAtlas(season);
      world = createWorld(map, { role: walker.role, look: walker.look }, walker.hero);
      // 화면을 찍어 볼 때(개발 때만): ?at=칸,칸 으로 서 있는 곳을 옮긴다
      const at = query.get('at');
      if (at) {
        const [ax, ay] = at.split(',').map(Number);
        if (Number.isFinite(ax) && Number.isFinite(ay) && world.grid.blocked[ay * map.w + ax] === 0) {
          world.player.x = ax * TILE + 8;
          world.player.y = ay * TILE + 10;
        }
      }
      resize();
      scene = buildScene(map, atlas, world);
      miniBase = miniColors(map, atlas);
      worldRef.current = world;
      setSpots(world.spots);
      if (import.meta.env.DEV) {
        dev.__world = world;
        dev.__scene = scene;
        // 맵 전체를 한 장으로 떠 본다(배율 1)
        dev.__overview = () => {
          if (!world || !scene) return '';
          const whole = document.createElement('canvas');
          whole.width = map.w * TILE;
          whole.height = map.h * TILE;
          const wctx = whole.getContext('2d');
          if (!wctx) return '';
          const keep = world.cam;
          const hold = { x: world.player.x, y: world.player.y };
          world.cam = { x: 0, y: 0 };
          render({ ctx: wctx, w: whole.width, h: whole.height, scale: 1 }, world, scene);
          world.cam = keep;
          world.player.x = hold.x;
          world.player.y = hold.y;
          return whole.toDataURL('image/png');
        };
      }
      setReady(true);
      raf = requestAnimationFrame(loop);
    }, 30);

    const observer = new ResizeObserver(resize);
    observer.observe(stage);

    const onPointer = (ev: PointerEvent): void => {
      if (!world || panelRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = canvas.width / rect.width;
      // 그리기와 같은 셈으로 화면의 점을 맵의 점으로 옮긴다
      const s = view.scale;
      const camX = Math.round(world.player.x * s) - Math.round((world.player.x - world.cam.x) * s);
      const camY = Math.round(world.player.y * s) - Math.round((world.player.y - world.cam.y) * s);
      const wx = ((ev.clientX - rect.left) * dpr + camX) / s;
      const wy = ((ev.clientY - rect.top) * dpr + camY) / s;
      tapWorld(world, wx, wy);
      // 걷기 시작하면 쪽지는 접힌다(길을 가리지 않게)
      setNoteOpen(false);
    };
    canvas.addEventListener('pointerdown', onPointer);

    const held = new Set<string>();
    const applyKeys = (): void => {
      if (!world) return;
      let x = 0;
      let y = 0;
      for (const k of held) {
        const d = KEY_DIRS[k];
        if (d) {
          x += d[0];
          y += d[1];
        }
      }
      setKeys(world, Math.sign(x), Math.sign(y));
    };
    const onKeyDown = (ev: KeyboardEvent): void => {
      if (ev.target instanceof HTMLButtonElement && (ev.key === 'Enter' || ev.key === ' ')) return;
      const key = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
      if (KEY_DIRS[key]) {
        held.add(key);
        applyKeys();
        setNoteOpen(false);
        ev.preventDefault();
        return;
      }
      if (key === 'Enter' || key === ' ') {
        ev.preventDefault();
        if (panelRef.current) {
          setPanel(null);
          return;
        }
        if (!world) return;
        const e = interact(world);
        if (e) onEvents([e]);
      } else if (key === 'Escape' && panelRef.current) {
        setPanel(null);
      }
    };
    const onKeyUp = (ev: KeyboardEvent): void => {
      const key = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
      held.delete(key);
      applyKeys();
    };
    const onBlur = (): void => {
      held.clear();
      applyKeys();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(start);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      worldRef.current = null;
      if (import.meta.env.DEV) {
        dev.__world = undefined;
        dev.__scene = undefined;
        dev.__overview = undefined;
      }
    };
  }, [walker.hero, season]);

  /** 줄을 누르면 그 자리로 화살표가 뜨고, 화살표가 가려지지 않게 쪽지는 접힌다 */
  const pickGuide = (spot: Spot): void => {
    const next = guide === spot.id ? null : spot.id;
    setGuide(next);
    if (worldRef.current) worldRef.current.guide = next;
    if (next) setNoteOpen(false);
  };

  const must = spots.filter((s) => s.kind === 'must');
  const extras = spots.filter((s) => s.kind === 'extra');
  const guided = spots.find((s) => s.id === guide);
  const row = (spot: Spot): JSX.Element => (
    <li key={spot.id}>
      <button type="button" class={`todo-row${guide === spot.id ? ' on' : ''}`} aria-pressed={guide === spot.id} onClick={() => pickGuide(spot)}>
        <span class={`todo-mark ${spot.kind}`} aria-hidden="true" />
        <span class="todo-text">
          <span class="todo-title">{spot.title}</span>
          <span class="todo-where">
            {spot.label}
            {guide === spot.id && <span aria-hidden="true"> ➤</span>}
          </span>
        </span>
      </button>
    </li>
  );

  return (
    <main class={`screen mapscreen season-${season}`}>
      <header class="map-band">
        <span class={`season-chip season-${season} now`}>
          <span class="season-mark" aria-hidden="true">
            ●
          </span>
          {seasonLabels[season].label}
        </span>
        <div class="map-where">
          <span class="hud-year">1395년 느티골</span>
          <span class="hud-role">
            {walker.label} · {walker.lookLabel}
          </span>
        </div>
        <p class="map-help">가려는 곳을 누르면 걸어가요</p>
        {fps !== null && <span class="map-fps">초당 {fps}장</span>}
        <button type="button" class="hud-home" onClick={askHome}>
          처음으로
        </button>
      </header>
      <div class="map-stage" ref={stageRef}>
        <canvas class="map-canvas" ref={canvasRef} aria-label="느티골 맵. 가려는 곳을 누르면 걸어가요." />
        {!ready && <p class="map-loading">느티골을 그리는 중이에요…</p>}

        {ready && !panel && (
          <aside class={`todo${noteOpen ? '' : ' shut'}`} aria-label="할 일 쪽지" ref={todoRef}>
            <button type="button" class="todo-head" aria-expanded={noteOpen} onClick={() => setNoteOpen(!noteOpen)}>
              <span class="todo-head-text">
                <span>봄에 할 일</span>
                {!noteOpen && guided && (
                  <span class="todo-going">
                    <span aria-hidden="true">➤ </span>
                    {guided.title}
                  </span>
                )}
              </span>
              <span class="todo-fold">{noteOpen ? '접기 ▲' : '펴기 ▼'}</span>
            </button>
            {noteOpen && (
              <div class="todo-body">
                <p class="todo-kind">
                  <span class="todo-mark must" aria-hidden="true" /> 꼭 할 일
                </p>
                <ul>{must.map(row)}</ul>
                <button type="button" class="todo-more" aria-expanded={extrasOpen} onClick={() => setExtrasOpen(!extrasOpen)}>
                  <span class="todo-mark extra" aria-hidden="true" /> 덤으로 할 일 {extras.length}가지 {extrasOpen ? '▲' : '▼'}
                </button>
                {extrasOpen && <ul>{extras.map(row)}</ul>}
                {!extrasOpen && <p class="todo-tip">줄을 누르면 화살표가 길을 알려 줘요.</p>}
              </div>
            )}
          </aside>
        )}

        {/* 작은 지도는 누르기를 삼킨다(지도를 눌렀는데 그 밑의 맵으로 걸어가지 않게) */}
        <div class={`minimap${ready && !panel ? '' : ' hidden'}`} ref={miniBoxRef} onPointerDown={(ev) => ev.stopPropagation()}>
          <p class="minimap-zone" style={{ width: `${96 * miniScale}px` }}>
            {zone || '느티골'}
          </p>
          <canvas
            ref={miniRef}
            width={96}
            height={72}
            style={{ width: `${96 * miniScale}px`, height: `${72 * miniScale}px` }}
            aria-label="작은 지도. 가 본 곳이 채워져요."
          />
        </div>

        {toast && !panel && (
          <p class={`map-toast${toast.locked ? ' locked' : ''}`} role="status">
            {toast.locked && (
              <span class="toast-head">
                <span class="toast-lock" aria-hidden="true" />
                {toast.head} · 지나갈 수 없어요
              </span>
            )}
            <span class="toast-text">{toast.text}</span>
          </p>
        )}

        {panel && (
          <div class="map-panel" role="dialog" aria-modal="true" aria-label={panel.name}>
            <p class="panel-tag">{panel.tag}</p>
            <p class="panel-name">{panel.name}</p>
            <p class="panel-text">{panel.text}</p>
            <p class="panel-note">{panel.note}</p>
            <button type="button" class="btn primary panel-close" onClick={() => setPanel(null)}>
              닫기
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
