// 그림 자리(spec 9.4). 대화 장면의 그림을 "이름"으로 찾는다.
//   배경  bg/<이야기>/<자리>-<계절>      예: bg/s1395/entrance-spring
//   인물  char/<이야기>/<누구>-<표정>    예: char/s1395/monk-plain
// 파일은 src/assets/pictures/ 아래에 둔다(.webp · .jpg · .jpeg · .png). 넣기만 하면 코드를 고치지 않고 바뀐다.
// 폴더가 없거나 비어 있어도 된다 — 그때는 코드로 그린 그림이 나온다(backdrop.ts, Figure.tsx).
//
// 찾는 차례: 그 이름의 파일 → (배경) 같은 자리의 다른 계절 → 코드 그림.
//            (인물) 표정 glad·worried의 파일이 없으면 plain → 코드 그림(맵의 도트 인물을 크게).
//
// 그림은 코드와 한 덩어리로 묶이지 않는다. 여기에는 주소만 들어오고, 이야기를 열 때 그 이야기의 그림을
// 뒤에서 모두 미리 받아 메모리에 쥐고 있는다(줄여 둔 파일 그대로). 그래서 대화 장면이 열릴 때 늦게 뜨지 않고,
// 도중에 인터넷이 끊겨도 받은 그림은 나온다. 아직 못 받았거나 받다가 실패한 자리에는 코드 그림이 나온다.

import { signal } from '@preact/signals';
import { getPack } from '../content';
import { SEASONS, type Season } from '../engine/types';
import { game } from '../state/store';
import { backgroundNameIn, buildIndex, figureNameIn, preloadOrder, type Pose, type SeasonPictures } from './pictureNames';

export type { Pose };

const found = import.meta.glob<string>('../assets/pictures/**/*.{webp,jpg,jpeg,png}', {
  eager: true,
  query: '?url',
  import: 'default',
});

// 자리 이름 → 파일 주소. 이름을 찾는 차례(확장자, 계절, 표정)는 pictureNames.ts에 있다.
const index = buildIndex(found);

// 만드는 사람이 "그림 파일이 없을 때"의 모습(코드 그림)을 볼 때 쓴다: 주소에 ?pics=off (개발 서버에서만 먹는다)
if (import.meta.env.DEV && typeof window !== 'undefined') {
  try {
    if (new URLSearchParams(window.location.search).get('pics') === 'off') index.clear();
  } catch {
    // 주소를 읽지 못해도 그림은 그대로 쓴다
  }
}

/** 받은 그림(자리 이름 → 화면에 쓸 주소) */
const got = new Map<string, string>();
const pending = new Set<string>();
const failed = new Set<string>();
/** 그림을 받거나 놓칠 때마다 하나씩 는다. 그림을 쓰는 화면이 이것을 읽어 다시 그린다. */
const tick = signal(0);
/** 그림 받기에 실패한 적이 있는가(인터넷이 끊긴 것으로 본다 — 위쪽 띠의 알림) */
export const picturesMissed = signal(false);

/** 받다가 놓친 그림(인터넷이 돌아오면 다시 받는다) */
const missed = new Set<string>();

function settle(name: string, url: string | null, broken = false): void {
  pending.delete(name);
  if (url) {
    got.set(name, url);
    failed.delete(name);
    missed.delete(name);
  } else {
    failed.add(name);
    // 받은 그림이 화면에서 깨진 것은 끊김이 아니다. 받다가 놓친 것만 끊김으로 본다.
    if (!broken) missed.add(name);
  }
  picturesMissed.value = missed.size > 0;
  tick.value++;
}

/** 받는 중인 그림이 다 받아지면(또는 놓치면) 알릴 곳 */
const waiting = new Map<string, (() => void)[]>();

/**
 * 그림 하나를 뒤에서 받는다. 받은 것은 줄여 둔 파일 그대로 메모리에 쥐고 있는다.
 * 돌려주는 약속은 받기가 끝나면(받았든 놓쳤든) 풀린다. 이미 받았거나 받을 수 없는 이름이면 바로 풀린다.
 */
function fetchPicture(name: string): Promise<void> {
  const url = index.get(name);
  if (!url || got.has(name) || typeof window === 'undefined') return Promise.resolve();
  const done = new Promise<void>((resolve) => waiting.set(name, [...(waiting.get(name) ?? []), resolve]));
  if (pending.has(name)) return done;
  pending.add(name);
  const finish = (result: string | null): void => {
    settle(name, result);
    for (const resolve of waiting.get(name) ?? []) resolve();
    waiting.delete(name);
  };
  // 주소로 바로 그려 보는 길(파일을 폴더에서 바로 열었을 때처럼 fetch가 안 되는 곳)
  const direct = (): void => {
    const img = new Image();
    img.onload = () => finish(url);
    img.onerror = () => finish(null);
    img.src = url;
  };
  if (typeof fetch !== 'function' || typeof URL.createObjectURL !== 'function') {
    direct();
    return done;
  }
  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(String(res.status));
      return res.blob();
    })
    .then((blob) => finish(URL.createObjectURL(blob)))
    .catch(direct);
  return done;
}

// ── 미리 받기: 차례대로, 한 번에 둘씩 ─────────────────────────────
// 한꺼번에 서른 장을 받으면 느린 망에서 첫 대화의 사람이 한참 도트 대역으로 서 있다(Review 1-라 36번).
// 지금 계절의 배경과 사람부터 한 번에 둘씩 받는다. 화면이 지금 쓰려는 그림은 차례를 기다리지 않는다(pictureSrc가 바로 받는다).

/** 한 번에 받는 수 */
export const PRELOAD_AT_ONCE = 2;
const queue: string[] = [];
let active = 0;

function pump(): void {
  while (active < PRELOAD_AT_ONCE && queue.length > 0) {
    const name = queue.shift() as string;
    if (got.has(name) || failed.has(name)) continue;
    active += 1;
    void fetchPicture(name).finally(() => {
      active -= 1;
      pump();
    });
  }
}

/** 그 이야기의 계절마다 대화 장면이 쓰는 배경 자리와 서는 사람(콘텐츠에서 읽는다). role을 주면 그 역할의 일만. */
function planOf(storyId: string, role?: string): SeasonPictures[] {
  const p = getPack(storyId);
  if (!p) return [];
  return SEASONS.map((season) => {
    const places: string[] = [];
    const people: string[] = [];
    for (const h of p.happenings) {
      if (h.season !== season || (role && h.roles && !h.roles.includes(role))) continue;
      if (!places.includes(h.stage.place)) places.push(h.stage.place);
      for (const member of h.stage.cast ?? []) {
        const pic = p.situation.people[member.who]?.pic ?? member.who;
        if (!people.includes(pic)) people.push(pic);
      }
    }
    return { season, places, people };
  });
}

// 인터넷이 돌아오면 못 받은 그림을 다시 받는다
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    for (const name of [...missed]) {
      failed.delete(name);
      fetchPicture(name);
    }
  });
}

/**
 * 그 이야기의 그림을 뒤에서 모두 미리 받아 둔다(이야기를 열 때 부른다). 기다리게 하지 않는다.
 * 차례는 지금 판의 계절부터(판이 없으면 봄부터 — 새로 시작하는 이야기다). 이미 받는 줄이 있으면 새 차례로 다시 세운다.
 */
export function preloadStory(storyId: string): void {
  const g = game.value;
  const mine = g && g.situationId === storyId ? g : null;
  const from = mine ? SEASONS[Math.min(mine.seasonIndex, SEASONS.length - 1)] : SEASONS[0];
  const order = preloadOrder([...index.keys()], storyId, planOf(storyId, mine?.role), from);
  queue.length = 0;
  queue.push(...order.filter((name) => !got.has(name) && !pending.has(name)));
  pump();
}

/** 미리 받는 줄에 남은 이름(개발용·시험용) */
export function preloadQueue(): string[] {
  return [...queue];
}

const hasName = (name: string): boolean => index.has(name);

/** 배경의 자리 이름: 그 계절의 파일 → 같은 자리의 다른 계절 → 없음(null이면 코드 그림) */
export function backgroundName(story: string, place: string, season: Season): string | null {
  return backgroundNameIn(hasName, story, place, season);
}

/** 인물의 자리 이름: 그 표정의 파일 → plain → 없음(null이면 코드 그림) */
export function figureName(story: string, pic: string, pose: Pose = 'plain'): string | null {
  return figureNameIn(hasName, story, pic, pose);
}

/**
 * 화면에 쓸 주소. 다 받은 그림이면 주소를, 아직 못 받았거나 실패했으면 null을 돌려준다(그 자리는 코드 그림).
 * 화면(컴포넌트)에서 부르면 그림이 도착했을 때 저절로 다시 그려진다. 아직 받기 시작하지 않은 그림이면 받기 시작한다.
 */
export function pictureSrc(name: string | null): string | null {
  void tick.value; // 그림이 도착하면 다시 그리게 한다
  if (!name) return null;
  const ready = got.get(name);
  if (ready) return ready;
  if (!failed.has(name)) fetchPicture(name);
  return null;
}

/** 받은 그림이 화면에서 깨졌을 때(드문 일): 그 자리를 코드 그림으로 돌린다 */
export function pictureBroke(name: string): void {
  got.delete(name);
  settle(name, null, true);
}

/** 자리 이름이 있는가(개발용 견본과 시험에서 쓴다) */
export function hasPicture(name: string): boolean {
  return index.has(name);
}

/** 파일이 있는 모든 자리 이름 */
export function pictureNames(): string[] {
  return [...index.keys()].sort();
}
