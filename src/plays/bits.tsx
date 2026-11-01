// 일 놀이들이 함께 쓰는 작은 조각: 도트 그림 한 장을 글 사이에 보이는 것, 열 칸 눈금, 아래 줄의 한마디.

import type { ComponentChildren, JSX } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { Px } from '../pixel/px';

/** 점 하나의 크기(CSS px): 글자 크기(rem)에 맞추되 기기 화소의 정수배가 되게 한다 */
function dotSize(scale: number): number {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const dpr = window.devicePixelRatio || 1;
  return Math.max(1, Math.round((scale * rem * dpr) / 16)) / dpr;
}

/**
 * 도트 그림 한 장(화소 버퍼)을 글 사이에 보인다. 뜻은 곁의 글이 전한다(그림은 꾸밈이다).
 * scale은 1rem = 16px일 때 점 하나의 크기(px)다. 화면이 커지면 함께 커지되 점은 언제나 기기 화소의 정수배다.
 */
export function PxIcon({ px, scale = 3 }: { px: Px; scale?: number }): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null);
  const [dot, setDot] = useState(scale);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.width = px.w;
    canvas.height = px.h;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(px.d.buffer.slice(0) as ArrayBuffer), px.w, px.h), 0, 0);
  }, [px]);
  useEffect(() => {
    const fit = (): void => setDot(dotSize(scale));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [scale]);
  return <canvas class="play-icon" ref={ref} aria-hidden="true" style={{ width: `${px.w * dot}px`, height: `${px.h * dot}px` }} />;
}

/** 열 칸 눈금(남은 풀, 짠 베 …). 칸의 수와 이름으로 알린다(색만으로 알리지 않는다). */
export function Gauge({ name, on, say }: { name: string; on: number; say: string }): JSX.Element {
  return (
    <span class="play-gauge" role="img" aria-label={say}>
      <span class="play-gauge-name">{name}</span>
      <span class="play-gauge-cells">
        {Array.from({ length: 10 }, (_, index) => (
          <span key={index} class={index < on ? 'cell on' : 'cell'} />
        ))}
      </span>
    </span>
  );
}

/** 아래 줄의 한마디(지금 무엇을 하면 되는지, 무엇이 일어났는지). strong이면 먹빛으로 또렷하게. */
export function Say({ strong = false, children }: { strong?: boolean; children: ComponentChildren }): JSX.Element {
  return (
    <span class={`play-say${strong ? ' strong' : ''}`} role="status">
      {children}
    </span>
  );
}

/**
 * 놀이를 끝내는 것을 한 번만 하게 한다: 끝내기 단추를 잇달아 누르거나, 단추와 자판 Enter를 함께 눌러도
 * onDone은 한 번만 불린다. 돌려주는 함수가 true면 이번에 끝낸 것이다.
 */
export function useEndOnce(onDone: (result: string) => void): { end: (result: string) => boolean; ended: () => boolean } {
  const done = useRef(false);
  const latest = useRef(onDone);
  latest.current = onDone;
  const end = useCallback((result: string): boolean => {
    if (done.current) return false;
    done.current = true;
    latest.current(result);
    return true;
  }, []);
  const ended = useCallback((): boolean => done.current, []);
  return { end, ended };
}
