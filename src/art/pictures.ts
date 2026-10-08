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
import type { Season } from '../engine/types';
import { backgroundNameIn, buildIndex, figureNameIn, type Pose } from './pictureNames';

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

/** 그림 하나를 뒤에서 받는다. 받은 것은 줄여 둔 파일 그대로 메모리에 쥐고 있는다. */
function fetchPicture(name: string): void {
  const url = index.get(name);
  if (!url || got.has(name) || pending.has(name)) return;
  if (typeof window === 'undefined') return;
  pending.add(name);
  // 주소로 바로 그려 보는 길(파일을 폴더에서 바로 열었을 때처럼 fetch가 안 되는 곳)
  const direct = (): void => {
    const img = new Image();
    img.onload = () => settle(name, url);
    img.onerror = () => settle(name, null);
    img.src = url;
  };
  if (typeof fetch !== 'function' || typeof URL.createObjectURL !== 'function') {
    direct();
    return;
  }
  fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(String(res.status));
      return res.blob();
    })
    .then((blob) => settle(name, URL.createObjectURL(blob)))
    .catch(direct);
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

/** 그 이야기의 그림을 뒤에서 모두 미리 받아 둔다(이야기를 열 때 부른다). 기다리게 하지 않는다. */
export function preloadStory(storyId: string): void {
  for (const name of index.keys()) {
    if (name.startsWith(`bg/${storyId}/`) || name.startsWith(`char/${storyId}/`)) fetchPicture(name);
  }
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
