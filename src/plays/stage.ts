// 일 놀이의 도트 놀이판: 캔버스의 크기를 맞추고, 한 장씩 그리게 하고, 누른 자리를 점으로 옮겨 준다.
// 점 하나는 기기 화소의 정수배다(봄의 볍씨 놀이·맵과 같은 느낌). 놀이판의 높이가 rows점쯤 되게 배율을 잡는다.
// 놀이마다 되풀이되는 것(크기 맞추기, 그리기 고리, 가려졌을 때 쉬기)을 여기 모았다.

export interface StageHandlers {
  /** 놀이판의 높이가 이만큼의 점이 되게 배율을 잡는다(볍씨 뿌리기는 150) */
  rows: number;
  /** 놀이판의 너비가 적어도 이만큼의 점이 되게 한다(높이에 견주어 좁은 화면에서 그림이 놓일 자리가 모자라지 않게) */
  cols?: number;
  /** 크기가 정해졌다(처음에 한 번, 그 뒤로 바뀔 때마다). 바탕 그림을 여기서 다시 뜬다. */
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
    let scale = Math.max(2, Math.round(dh / handlers.rows));
    if (handlers.cols) scale = Math.max(2, Math.min(scale, Math.floor(dw / handlers.cols)));
    const nw = Math.max(64, Math.floor(dw / scale));
    const nh = Math.max(48, Math.floor(dh / scale));
    canvas.style.width = `${(nw * scale) / dpr}px`;
    canvas.style.height = `${(nh * scale) / dpr}px`;
    if (nw === w && nh === h) return;
    w = nw;
    h = nh;
    canvas.width = w;
    canvas.height = h;
    handlers.resized(w, h);
    // 크기를 바꾸면 캔버스가 비워진다. 다음 장을 기다리지 않고 바로 다시 그린다.
    paintNow();
  };

  const loop = (now: number): void => {
    if (stopped) return;
    raf = requestAnimationFrame(loop);
    ready = true;
    if (document.hidden || w === 0) return;
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
