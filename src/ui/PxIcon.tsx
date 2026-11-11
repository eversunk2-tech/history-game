// 도트 그림 한 장(화소 버퍼)을 글 사이에 보이는 부품 — UI의 도트 아이콘(src/pixel/icons.ts)과 일 놀이의 그림이 함께 쓴다.
// 점 하나는 언제나 기기 화소의 정수배다(아이패드·갤럭시탭에서 도트가 고르게 또렷하게). 뜻은 곁의 글이 전한다(그림은 꾸밈 — aria-hidden).
// (일 놀이의 src/plays/bits.tsx에 있던 것을 옮겼다. 놀이 쪽은 bits.tsx가 이것을 다시 내보낸다.)

import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { uiIcon, type UiIconName } from '../pixel/icons';
import type { Px } from '../pixel/px';

/** 점 하나의 크기(CSS px): 글자 크기(rem)에 맞추되 기기 화소의 정수배가 되게 한다 */
function dotSize(scale: number): number {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const dpr = window.devicePixelRatio || 1;
  return Math.max(1, Math.round((scale * rem * dpr) / 16)) / dpr;
}

/**
 * 도트 그림 한 장을 글 사이에 보인다.
 * scale은 1rem = 16px일 때 점 하나의 크기(px)다. 화면이 커지면 함께 커지되 점은 언제나 기기 화소의 정수배다.
 */
export function PxIcon({ px, scale = 3, cls = 'play-icon' }: { px: Px; scale?: number; cls?: string }): JSX.Element {
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
  return <canvas class={cls} ref={ref} aria-hidden="true" style={{ width: `${px.w * dot}px`, height: `${px.h * dot}px` }} />;
}

/**
 * UI의 도트 아이콘(16×16). size는 점 하나의 크기 — 2(1024 너비에서 32px)·2.5(40px)·1.5(24px).
 * 손가락처럼 둘레에 꾸밈을 더 얹을 때는 cls로 이름을 더한다.
 */
export function Icon({ name, size = 2, cls = '' }: { name: UiIconName; size?: number; cls?: string }): JSX.Element {
  return <PxIcon px={uiIcon(name)} scale={size} cls={`icon px-icon${cls ? ` ${cls}` : ''}`} />;
}
