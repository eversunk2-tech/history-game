// 서 있는 사람 하나. 그림 자리(char/<이야기>/<누구>-<표정>)에 파일이 있고 다 받았으면 그 그림을,
// 없으면 맵의 도트 인물을 정수배로 크게 키워 세운다. 빈칸이나 깨진 그림이 보이는 일은 없다.
// 놓인 칸(position이 잡힌 부모)의 높이에 맞춰 크기를 정한다. 어디에 세울지는 부모의 모양(CSS)이 정한다.
//
// 사람이 아닌 대역(4-1 ㉢): 정령 'neuti'(spirit.ts — 떠 있기 두 장을 번갈아)와 도깨비 'dokkaebi'(foes41.ts — 숨쉬기 두 장, glad면 웃는 두 장).
// 사람과 같은 틀로 세우되, 크기는 사람 한 장(64 그림 점)을 잣대로 셈한다 — 도깨비(104 그림 점)는 같은 칸에서 사람보다 크게 선다(칸을 넘지 않게).

import type { JSX } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { dokkaebiFrame, DOKKAEBI_H, DOKKAEBI_W } from '../pixel/foes41';
import { snapperOf } from '../pixel/ground';
import { paletteOf } from '../pixel/palette';
import { PERSON_H, PERSON_W, personFrame, personOf, type Person } from '../pixel/people';
import { toCanvas } from '../pixel/px';
import { SPIRIT, SPIRIT_FRAMES, spiritFrame } from '../pixel/spirit';
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

/** 사람이 아닌 대역 하나: 한 장의 크기(그림 점), 장들, 장을 넘기는 간격(밀리초) */
interface Stand {
  w: number;
  h: number;
  frames: HTMLCanvasElement[];
  ms: number;
}

const standCache = new Map<string, Stand>();

/** 사람이 아닌 대역(정령·도깨비)의 장들. 봄 벌에 맞춘다(맵과 같은 한 벌). 모르는 이름이면 undefined */
function standOf(sprite: string, pose: Pose): Stand | undefined {
  const glad = sprite === 'dokkaebi' && pose === 'glad';
  const key = `${sprite}:${glad ? 'glad' : 'plain'}`;
  let stand = standCache.get(key);
  if (stand) return stand;
  const snap = snapperOf(paletteOf('spring'));
  if (sprite === SPIRIT) {
    stand = { w: PERSON_W, h: PERSON_H, frames: Array.from({ length: SPIRIT_FRAMES }, (_, f) => toCanvas(spiritFrame('down', f, snap))), ms: 520 };
  } else if (sprite === 'dokkaebi') {
    stand = { w: DOKKAEBI_W, h: DOKKAEBI_H, frames: [0, 1].map((f) => toCanvas(dokkaebiFrame(glad ? 'glad' : 'plain', f, snap))), ms: 720 };
  } else return undefined;
  standCache.set(key, stand);
  return stand;
}

/**
 * 도트 그림을 크게 세운다. fill은 칸 높이에서 사람 한 장(64 그림 점 — 맵 점 32)이 차지할 몫이다.
 * 그림 점 하나가 기기 화소의 정수배가 되게 맞춘다(그림이 2배로 촘촘해져 가장 작은 배율은 1이다 — spec 4.7.5).
 * 사람보다 큰 그림(h > PERSON_H)도 같은 배율이라 사람보다 크게 서되, 칸의 높이를 넘지 않게 줄인다.
 */
function PixelStand({ w, h, frames, ms, fill = 0.6, label }: { w: number; h: number; frames: HTMLCanvasElement[]; ms: number; fill?: number; label?: string }): JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = ref.current;
    const box = canvas?.parentElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !box || !ctx) return;
    let frame = 0;
    const paint = (): void => {
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(frames[frame % frames.length], 0, 0);
    };
    const fit = (): void => {
      const dpr = window.devicePixelRatio || 1;
      const rect = box.getBoundingClientRect();
      if (rect.height < 2) return;
      // 칸의 높이에 맞추되 너비를 넘지 않게(사람 한 장이 fill만큼 — 큰 그림은 칸 높이를 넘지 않게)
      const byHeight = Math.floor((rect.height * dpr * fill) / PERSON_H);
      const byBox = h > PERSON_H ? Math.floor((rect.height * dpr) / h) : byHeight;
      const byWidth = Math.floor((rect.width * dpr) / w);
      const k = Math.max(1, Math.min(byHeight, byBox, byWidth > 0 ? byWidth : byHeight));
      canvas.style.width = `${(w * k) / dpr}px`;
      canvas.style.height = `${(h * k) / dpr}px`;
    };
    fit();
    paint();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    const timer = window.setInterval(() => {
      frame++;
      paint();
    }, ms);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [w, h, frames, ms, fill]);
  return (
    <canvas
      class="figure-sprite"
      ref={ref}
      width={w}
      height={h}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
    />
  );
}

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
  return <PixelStand w={PERSON_W} h={PERSON_H} frames={framesOf(person, act)} ms={act === 'walk' ? 170 : 720} fill={fill} label={label} />;
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
  /** 그림 파일이 없을 때 세울 도트 인물의 이름(src/pixel/people.ts) — 또는 정령 'neuti'·도깨비 'dokkaebi' */
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
  if (person) return <SpriteStand person={person} fill={fill} act={act} label={label} />;
  const stand = sprite ? standOf(sprite, pose) : undefined;
  return stand ? <PixelStand w={stand.w} h={stand.h} frames={stand.frames} ms={stand.ms} fill={fill} label={label} /> : null;
}
