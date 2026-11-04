// 일 놀이의 도트 놀이판: 캔버스의 크기를 맞추고, 한 장씩 그리게 하고, 누른 자리를 점으로 옮겨 준다.
// 놀이의 셈은 "놀이 점"으로 한다(1-라와 같은 단위 — 놀이판의 높이가 rows점쯤). 캔버스는 그림 점(ART — 놀이 점의 반)으로
// 촘촘하다(spec 4.7.5): 캔버스의 크기는 놀이 점 × ART이고 그리기 전에 ART배로 늘여 두므로(setTransform) 놀이의 셈은 그대로다.
// 그림 점 하나는 기기 화소의 정수배다. 사람(48×64 그림 점)과 바탕은 그림 점으로 그려 1:1로 놓인다.
// 놀이마다 되풀이되는 것(크기 맞추기, 그리기 고리, 가려졌을 때 쉬기)을 여기 모았다.

import { ART } from '../pixel/px';

export interface StageHandlers {
  /** 놀이판의 높이가 이만큼의 놀이 점이 되게 배율을 잡는다(볍씨 뿌리기는 150) */
  rows: number;
  /** 놀이판의 너비가 적어도 이만큼의 점이 되게 한다(높이에 견주어 좁은 화면에서 그림이 놓일 자리가 모자라지 않게) */
  cols?: number;
  /** 크기가 정해졌다(놀이 점 — 처음에 한 번, 그 뒤로 바뀔 때마다). 바탕 그림을 여기서 다시 뜬다(그림 점 = 놀이 점 × ART). */
  resized(w: number, h: number): void;
  /** 한 장을 그린다 */
  paint(ctx: CanvasRenderingContext2D, now: number): void;
}

export interface Stage {
  /** 그리기를 멈추고 지켜보던 것을 푼다 */
  stop(): void;
  /** 화면의 자리 → 놀이판의 점 */
  at(ev: { clientX: number; clientY: number }): [number, number];
  /** 움직임을 줄여 달라고 한 기기인가 */
  calm: boolean;
}

/**
 * 놀이판의 배율(놀이 점 하나 = 기기 화소 몇 개). 그림 점(ART)이 기기 화소의 정수배가 되게 짝수로 고른다:
 * 1-라의 배율(놀이판의 높이가 rows점쯤, 너비가 적어도 cols점)이 홀수이면 그 위아래 짝수 가운데 1-라에 가까운 쪽 —
 * 늘 한 칸 차이로 같으므로 큰 쪽(맵의 13.1의 53번과 같은 뜻: 사람과 누를 것의 화면 크기를 1-라보다 작게 하지 않는다).
 * 큰 쪽은 놀이판의 너비를 cols보다 조금 좁힌다(놀이의 것들은 너비에 맞춰 놓인다). cols의 80%보다 좁아지면 작은 쪽으로 —
 * 놀이판의 것들이 너무 맞붙지 않게(1024×768·화소 비율 1의 김매기 247점 = 82%까지 찍어 보았다).
 */
export function playScale(dw: number, dh: number, rows: number, cols?: number): number {
  let old = Math.max(2, Math.round(dh / rows));
  if (cols) old = Math.max(2, Math.min(old, Math.floor(dw / cols)));
  if (old % ART === 0) return old;
  const up = old + (ART - (old % ART));
  const down = old - (old % ART);
  if (down < ART) return up;
  if (cols && Math.floor(dw / up) < cols * 0.8) return down;
  return up - old <= old - down ? up : down;
}

export function mountStage(box: HTMLElement, canvas: HTMLCanvasElement, handlers: StageHandlers): Stage | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  let w = 0;
  let h = 0;
  let raf = 0;
  let stopped = false;
  /** 놀이가 다 차려졌는가(처음 크기를 맞출 때는 그리지 않는다 — 놀이 쪽의 것들이 아직 다 놓이지 않았다. 첫 장은 그리기 고리가 그린다) */
  let ready = false;

  const paintNow = (): void => {
    if (w === 0 || !ready) return;
    ctx.setTransform(ART, 0, 0, ART, 0, 0);
    ctx.imageSmoothingEnabled = false;
    handlers.paint(ctx, performance.now());
  };

  const resize = (): void => {
    const dpr = window.devicePixelRatio || 1;
    // 테두리 안쪽의 크기(테두리에 그림이 깎이지 않게)
    const bw = box.clientWidth;
    const bh = box.clientHeight;
    if (bw < 8 || bh < 8) return;
    const dw = Math.floor(bw * dpr);
    const dh = Math.floor(bh * dpr);
    const scale = playScale(dw, dh, handlers.rows, handlers.cols);
    const nw = Math.max(64, Math.floor(dw / scale));
    const nh = Math.max(48, Math.floor(dh / scale));
    canvas.style.width = `${(nw * scale) / dpr}px`;
    canvas.style.height = `${(nh * scale) / dpr}px`;
    if (nw === w && nh === h) return;
    w = nw;
    h = nh;
    canvas.width = w * ART;
    canvas.height = h * ART;
    handlers.resized(w, h);
    // 크기를 바꾸면 캔버스가 비워진다. 다음 장을 기다리지 않고 바로 다시 그린다.
    paintNow();
  };

  const loop = (now: number): void => {
    if (stopped) return;
    raf = requestAnimationFrame(loop);
    ready = true;
    if (document.hidden || w === 0) return;
    ctx.setTransform(ART, 0, 0, ART, 0, 0);
    ctx.imageSmoothingEnabled = false;
    handlers.paint(ctx, now);
  };

  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(box);
  raf = requestAnimationFrame(loop);

  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
    },
    at(ev) {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return [0, 0];
      return [((ev.clientX - rect.left) / rect.width) * w, ((ev.clientY - rect.top) / rect.height) * h];
    },
    calm: prefersCalm(),
  };
}

/** 움직임을 줄여 달라고 한 기기인가(그런 기기에서는 날아가고 들썩이는 움직임을 건너뛴다) */
export function prefersCalm(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 0~1로 자른다 */
export const unit = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
