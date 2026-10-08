// 배경 한 장. 그림 자리(bg/<이야기>/<자리>-<계절>)에 파일이 있고 다 받았으면 그 그림을,
// 없거나 아직 못 받았으면 코드로 그린 그림을 보여 준다. 빈칸이나 깨진 그림이 보이는 일은 없다.
// 놓인 칸을 가득 채운다(칸은 position이 잡혀 있어야 한다).

import type { JSX } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import type { Season } from '../engine/types';
import { toCanvas } from '../pixel/px';
import { paintBackdrop } from './backdrop';
import { backgroundName, pictureBroke, pictureSrc } from './pictures';

/** 코드 그림의 한 점이 화면에서 차지하는 크기를 정한다: 칸의 높이가 이만큼의 점이 되게(정수배) */
const LOGICAL_H = 236;

function CodeBackdrop({ place, season }: { place: string; season: Season }): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = ref.current;
    const box = canvas?.parentElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !box || !ctx) return;
    let drawn = '';
    const draw = (): void => {
      const dpr = window.devicePixelRatio || 1;
      const rect = box.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      // 점 하나가 기기 화소의 정수배가 되게 한다(점 크기가 고르게)
      const dw = Math.round(rect.width * dpr);
      const dh = Math.round(rect.height * dpr);
      const scale = Math.max(2, Math.round(dh / LOGICAL_H));
      const lw = Math.ceil(dw / scale);
      const lh = Math.ceil(dh / scale);
      canvas.style.width = `${(lw * scale) / dpr}px`;
      canvas.style.height = `${(lh * scale) / dpr}px`;
      // 가운데와 아래를 맞춘다(넘치는 쪽은 칸이 잘라 낸다)
      canvas.style.left = `${-Math.floor((lw * scale - dw) / 2) / dpr}px`;
      canvas.style.top = `${-(lh * scale - dh) / dpr}px`;
      const key = `${lw}x${lh}`;
      if (key === drawn) return;
      drawn = key;
      canvas.width = lw;
      canvas.height = lh;
      try {
        ctx.drawImage(toCanvas(paintBackdrop(place, season, lw, lh)), 0, 0);
      } catch (error) {
        // 그리다 멈춰도 화면은 이어진다(칸의 바탕 빛이 보인다)
        console.error('[조선에서 한 해 살기] 배경을 그리지 못했다:', error);
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(box);
    return () => observer.disconnect();
  }, [place, season]);
  return <canvas class="scenery-code" ref={ref} />;
}

export function Scenery({
  story,
  place,
  season,
  label,
}: {
  story: string;
  place: string;
  season: Season;
  /** 화면 읽기 프로그램에 알려 줄 말. 없으면 꾸밈으로 본다. */
  label?: string;
}): JSX.Element {
  const name = backgroundName(story, place, season);
  const src = pictureSrc(name);
  return (
    <div class={`scenery season-${season}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}>
      {src && name ? (
        <img class="scenery-img" src={src} alt="" draggable={false} onError={() => pictureBroke(name)} />
      ) : (
        <CodeBackdrop place={place} season={season} />
      )}
    </div>
  );
}
