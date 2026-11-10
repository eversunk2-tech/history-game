// 화면이 쓰는 작은 도트 컴포넌트(4-1 ㉢): 작은 그림(카드·장비·유물·갈래·할 일·도깨비불)과 굳은 논흙.
// 그림 점 하나 = 기기 화소의 정수배로 그린다(흐리지 않게 — image-rendering: pixelated). 그림은 봄 벌에 맞춘 것이다(src/pixel/icons.ts·foes41.ts).

import type { JSX } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { SOIL_BREAK_FRAMES, SOIL_H, SOIL_W, soilBreak, soilFrame, soilStage } from '../pixel/foes41';
import { snapperOf } from '../pixel/ground';
import { iconNames, iconPx } from '../pixel/icons';
import { paletteOf } from '../pixel/palette';
import type { Px } from '../pixel/px';

export { iconNames };

const PIXELATED = { imageRendering: 'pixelated' } as const;

/** 버퍼를 캔버스에 그대로 놓는다 */
function put(canvas: HTMLCanvasElement, px: Px): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(px.d.buffer.slice(0) as ArrayBuffer), px.w, px.h), 0, 0);
}

const dprNow = (): number => (typeof window !== 'undefined' && window.devicePixelRatio) || 1;

/** 그림 점 w개가 CSS size px 안팎이 되는 정수배(기기 화소) — 적어도 1 */
export function iconScale(w: number, size: number, dpr: number): number {
  return Math.max(1, Math.round((size * dpr) / w));
}

/**
 * 작은 그림 하나(iconNames()의 이름). size는 CSS px의 어림 — 그림 점 하나가 기기 화소의 정수배가 되게 그 가까이로 맞춘다.
 * label이 있으면 그림으로 읽히고(role="img"), 없으면 꾸밈으로 숨긴다(aria-hidden). 모르는 이름이면 아무것도 그리지 않는다.
 */
export function PixelIcon({ name, size, label }: { name: string; size: number; label?: string }): JSX.Element | null {
  const ref = useRef<HTMLCanvasElement>(null);
  const px = iconPx(name);
  useLayoutEffect(() => {
    if (ref.current && px) put(ref.current, px);
  }, [px]);
  if (!px) return null;
  const k = iconScale(px.w, size, dprNow());
  const css = (px.w * k) / dprNow();
  return (
    <canvas
      class="pixel-icon"
      ref={ref}
      width={px.w}
      height={px.h}
      style={{ ...PIXELATED, width: `${css}px`, height: `${(px.h * k) / dprNow()}px` }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
    />
  );
}

/** 부서지는 장 하나가 머무는 시간(밀리초) — 석 장에 0.4초 안팎 */
export const SOIL_BREAK_MS = 130;

const reduceMotion = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * 굳은 논흙(삶의 고비의 상징 — 사람 꼴이 아니다, spec 4.5). left는 남은 기운의 몫(1 → 0): 깎일수록 금이 늘고 0이면 흙이 고르게 풀린다.
 * hits(맞은 횟수)가 늘 때마다 흙 조각이 튀는 석 장을 한 번 보인다(0.4초 안팎 — 번쩍이거나 흔들지 않는다, spec 8.6). 움직임 줄이기를 켠 기기에서는 건너뛴다.
 * 크기는 놓인 칸(부모)의 높이에서 fill만큼, 그림 점 하나 = 기기 화소의 정수배.
 */
export function SoilArt({ left, hits, fill = 0.8, label }: { left: number; hits: number; fill?: number; label?: string }): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null);
  const seen = useRef(hits);
  const stage = soilStage(left);
  // 크기: 칸에 맞춘다
  useLayoutEffect(() => {
    const canvas = ref.current;
    const box = canvas?.parentElement;
    if (!canvas || !box) return;
    const fit = (): void => {
      const dpr = dprNow();
      const rect = box.getBoundingClientRect();
      if (rect.height < 2) return;
      const byHeight = Math.floor((rect.height * dpr * fill) / SOIL_H);
      const byWidth = Math.floor((rect.width * dpr) / SOIL_W);
      const k = Math.max(1, Math.min(byHeight, byWidth > 0 ? byWidth : byHeight));
      canvas.style.width = `${(SOIL_W * k) / dpr}px`;
      canvas.style.height = `${(SOIL_H * k) / dpr}px`;
    };
    fit();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    observer?.observe(box);
    return () => observer?.disconnect();
  }, [fill]);
  // 그림: 지금 단계, 맞았으면 부서지는 석 장을 거쳐 지금 단계로
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const snap = snapperOf(paletteOf('spring'));
    const rest = (): void => put(canvas, soilFrame(stage, snap));
    const struck = hits > seen.current;
    seen.current = hits;
    if (!struck || reduceMotion()) {
      rest();
      return;
    }
    let f = 0;
    put(canvas, soilBreak(stage, f, snap));
    const timer = window.setInterval(() => {
      f++;
      if (f >= SOIL_BREAK_FRAMES) {
        window.clearInterval(timer);
        rest();
      } else put(canvas, soilBreak(stage, f, snap));
    }, SOIL_BREAK_MS);
    return () => {
      window.clearInterval(timer);
      rest();
    };
  }, [stage, hits]);
  return (
    <canvas
      class="pixel-soil"
      ref={ref}
      width={SOIL_W}
      height={SOIL_H}
      style={PIXELATED}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
    />
  );
}
