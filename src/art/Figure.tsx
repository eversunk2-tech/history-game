// 서 있는 사람 하나. 그림 자리(char/<이야기>/<누구>-<표정>)에 파일이 있고 다 받았으면 그 그림을,
// 없으면 맵의 도트 인물을 정수배로 크게 키워 세운다. 빈칸이나 깨진 그림이 보이는 일은 없다.
// 놓인 칸(position이 잡힌 부모)의 높이에 맞춰 크기를 정한다. 어디에 세울지는 부모의 모양(CSS)이 정한다.

import type { JSX } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { PERSON_H, PERSON_W, personFrame, personOf, type Person } from '../pixel/people';
import { toCanvas } from '../pixel/px';
import { figureName, pictureBroke, pictureSrc, type Pose } from './pictures';

type Act = 'idle' | 'walk';

const frameCache = new WeakMap<Person, Partial<Record<Act, HTMLCanvasElement[]>>>();

/** 앞을 보고 선 모습(숨쉬기 두 장) 또는 제자리걸음(넉 장) */
function framesOf(person: Person, act: Act): HTMLCanvasElement[] {
  let byAct = frameCache.get(person);
  if (!byAct) {
    byAct = {};
    frameCache.set(person, byAct);
  }
  let frames = byAct[act];
  if (!frames) {
    const count = act === 'walk' ? 4 : 2;
    frames = Array.from({ length: count }, (_, f) => toCanvas(personFrame(person, 'down', act, f)));
    byAct[act] = frames;
  }
  return frames;
}

/**
 * 도트 인물을 크게 세운다. fill은 칸 높이에서 인물 한 장(64 그림 점 — 맵 점 32)이 차지할 몫이다.
 * 그림 점 하나가 기기 화소의 정수배가 되게 맞춘다(그림이 2배로 촘촘해져 가장 작은 배율은 1이다 — spec 4.7.5).
 */
export function SpriteStand({
  person,
  fill = 0.6,
  act = 'idle',
  label,
}: {
  person: Person;
  fill?: number;
  act?: Act;
  label?: string;
}): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = ref.current;
    const box = canvas?.parentElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !box || !ctx) return;
    const frames = framesOf(person, act);
    let frame = 0;
    const paint = (): void => {
      ctx.clearRect(0, 0, PERSON_W, PERSON_H);
      ctx.drawImage(frames[frame % frames.length], 0, 0);
    };
    const fit = (): void => {
      const dpr = window.devicePixelRatio || 1;
      const rect = box.getBoundingClientRect();
      if (rect.height < 2) return;
      // 칸의 높이에 맞추되 너비를 넘지 않게
      const byHeight = Math.floor((rect.height * dpr * fill) / PERSON_H);
      const byWidth = Math.floor((rect.width * dpr) / PERSON_W);
      const k = Math.max(1, Math.min(byHeight, byWidth > 0 ? byWidth : byHeight));
      canvas.style.width = `${(PERSON_W * k) / dpr}px`;
      canvas.style.height = `${(PERSON_H * k) / dpr}px`;
    };
    fit();
    paint();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    const timer = window.setInterval(
      () => {
        frame++;
        paint();
      },
      act === 'walk' ? 170 : 720,
    );
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [person, fill, act]);
  return (
    <canvas
      class="figure-sprite"
      ref={ref}
      width={PERSON_W}
      height={PERSON_H}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
    />
  );
}

export function Figure({
  story,
  pic,
  sprite,
  pose = 'plain',
  fill,
  act,
  label,
}: {
  story: string;
  /** 그림 자리의 이름(char/<이야기>/<pic>-<표정>) */
  pic: string;
  /** 그림 파일이 없을 때 세울 도트 인물의 이름(src/pixel/people.ts) */
  sprite?: string;
  pose?: Pose;
  fill?: number;
  act?: Act;
  label?: string;
}): JSX.Element | null {
  const name = figureName(story, pic, pose);
  const src = pictureSrc(name);
  if (src && name) {
    return <img class="figure-img" src={src} alt={label ?? ''} draggable={false} onError={() => pictureBroke(name)} />;
  }
  const person = sprite ? personOf(sprite) : undefined;
  return person ? <SpriteStand person={person} fill={fill} act={act} label={label} /> : null;
}
