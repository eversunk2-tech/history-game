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

import { signal, type Signal } from '@preact/signals';
import { getPack } from '../content';
import { SEASONS, type Season } from '../engine/types';
import { game } from '../state/store';
import { backgroundNameIn, buildIndex, figureNameIn, picturePlan, preloadOrder, type Pose, type SeasonPictures } from './pictureNames';

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

// ── 받기와 미리 받기 ─────────────────────────────────────────────
// 미리 받기: 차례대로, 한 번에 둘씩. 한꺼번에 서른 장을 받으면 느린 망에서 첫 대화의 사람이 한참 도트 대역으로 서 있다(Review 1-라 36번).
// 화면이 지금 쓰려는 그림은 차례를 기다리지 않는다(pictureSrc가 바로 받는다).
//
// 인터넷이 끊길 때(Review 1-라 11.8 ⑥)
//   - 한 장을 놓치면(서버에 닿지 못하면) 남은 줄을 두드리지 않고 쉰다. 브라우저가 끊겼다고 알면(navigator.onLine) 받으러 가지도 않는다.
//     그래서 끊기는 순간 콘솔의 받기 실패는 그때 받던 몇 장뿐이다(전에는 남은 줄을 다 두드려 72건).
//   - 'online' 사건이 오면 놓친 그림을 줄 맨 앞에 다시 넣어 둘씩 받는다. 위쪽 띠는 "그림을 다시 받는 중"이 되고, 놓친 것을 다 받으면 사라진다.
//   - 브라우저가 끊김을 모르는 때('online' 사건이 오지 않는다)를 위해, 쉬는 동안 가끔(10초 → 20초 → … 1분) 한 장만 받아 본다.
//   - 서버가 답했는데 못 받은 것(파일이 없음 따위)은 끊김이 아니다. 그 자리만 코드 그림으로 두고 줄은 그대로 간다.
//   - Image로 받는 길은 fetch를 쓸 수 없는 곳(파일을 폴더에서 바로 연 file:, fetch가 없는 브라우저)에서만 쓴다.
//     전에는 fetch가 실패하면 Image로 한 번 더 받아 한 장에 실패가 둘씩 찍혔다.

/** 한 번에 받는 수 */
export const PRELOAD_AT_ONCE = 2;
/** 쉬는 동안 한 장만 받아 보는 사이(처음, 가장 길게) */
export const RETRY_FIRST_MS = 10_000;
export const RETRY_MAX_MS = 60_000;

/** 위쪽 띠의 그림 알림: 끊긴 듯 놓친 그림이 있다('lost') · 다시 이어져 놓친 그림을 다시 받는 중('again') · 없음(null) */
export type PictureNotice = 'lost' | 'again' | null;

/** 받는 길(브라우저의 것을 넣는다. 시험은 가짜를 넣는다) */
export interface PictureNet {
  /** 서버에 받으러 간다. 서버에 닿지 못하면 거절된다. */
  fetch?: (url: string) => Promise<{ ok: boolean; blob(): Promise<Blob> }>;
  /** 받은 파일을 화면에 쓸 주소로 */
  objectUrl?: (blob: Blob) => string;
  /** 주소로 바로 그려 본다(Image). 그려지면 true */
  image: (url: string) => Promise<boolean>;
  /** 파일을 폴더에서 바로 열었는가(file: — fetch가 안 되고, 인터넷과 상관이 없다) */
  local: boolean;
  /** 브라우저가 인터넷이 끊겼다고 아는가(navigator.onLine === false) */
  offline: () => boolean;
  /** 잠시 뒤에 한다. 돌려주는 것을 부르면 그만둔다. */
  later: (run: () => void, ms: number) => () => void;
  /** 'online'·'offline' 사건이 오는 곳(window) */
  events?: Pick<EventTarget, 'addEventListener'>;
}

/** 받기 한 번의 끝: 받음 · 서버가 답했지만 못 받음(끊김이 아니다) · 서버에 닿지 못함(끊긴 것으로 본다) */
type Outcome = { url: string } | 'broken' | 'lost';

export interface PictureLoader {
  /** 그림을 받거나 놓칠 때마다 하나씩 는다(화면이 읽어 다시 그린다) */
  tick: Signal<number>;
  notice: Signal<PictureNotice>;
  /** 화면에 쓸 주소(없으면 null — 아직 받지 않았으면 받기 시작한다) */
  src(name: string | null): string | null;
  /** 받은 그림이 화면에서 깨졌다 */
  broke(name: string): void;
  /** 미리 받는 줄을 새 차례로 세운다 */
  preload(order: readonly string[]): void;
  /** 미리 받는 줄에 남은 이름 */
  queued(): string[];
  /** 지금 줄에서 받는 수와 줄을 쉬는가(시험용) */
  status(): { active: number; paused: boolean; probing: boolean; missed: string[] };
  /** 인터넷이 다시 이어졌다 / 끊겼다(events를 주면 저절로 부른다) */
  online(): void;
  offline(): void;
}

/** 그림 받기(받은 것은 줄여 둔 파일 그대로 메모리에 쥐고 있는다). net이 없으면(브라우저 밖) 받지 않는다. */
export function createPictureLoader(urlOf: (name: string) => string | undefined, net: PictureNet | null): PictureLoader {
  /** 받은 그림(자리 이름 → 화면에 쓸 주소) */
  const got = new Map<string, string>();
  const pending = new Set<string>();
  /** 받지 못한 것(다시 받으러 가지 않는다 — 놓친 것은 다시 이어질 때 지운다) */
  const failed = new Set<string>();
  /** 끊겨서 놓친 그림(다시 이어지면 다시 받는다) */
  const missed = new Set<string>();
  /** 받는 중인 그림이 끝나면(받았든 놓쳤든) 알릴 곳 */
  const waiting = new Map<string, (() => void)[]>();
  const tick = signal(0);
  const notice = signal<PictureNotice>(null);

  const queue: string[] = [];
  /** 마지막으로 세운 차례(놓친 것을 다시 넣을 때 이 차례를 따른다) */
  let order: readonly string[] = [];
  let active = 0;
  /** 끊긴 것으로 보여 줄을 쉬는가 */
  let paused = false;
  /** 쉬다가 한 장만 받아 보는 중인가(받으면 둘씩으로 돌아간다) */
  let probing = false;
  /** 쉴 때마다 는다. 쉬기 전에 떠난 받기가 늦게 받아져도 "다시 이어졌다"로 보지 않는다. */
  let era = 0;
  let retryDelay = RETRY_FIRST_MS;
  let cancelRetry: (() => void) | null = null;

  const notify = (): void => {
    notice.value = missed.size === 0 ? null : paused || probing ? 'lost' : 'again';
  };

  function settle(name: string, outcome: Outcome, started: number): void {
    pending.delete(name);
    if (typeof outcome === 'object') {
      got.set(name, outcome.url);
      failed.delete(name);
      missed.delete(name);
      retryDelay = RETRY_FIRST_MS;
      // 쉬는 동안 새로 떠난 받기가 받아졌다 = 다시 이어졌다
      if (paused && started === era) resume(false);
      else probing = false;
    } else {
      failed.add(name);
      if (outcome === 'lost') {
        missed.add(name);
        pause();
      }
    }
    notify();
    tick.value++;
  }

  /** 그림 하나를 받는다. 약속은 받기가 끝나면(받았든 놓쳤든) 풀린다. 이미 받았거나 받을 수 없는 이름이면 바로 풀린다. */
  function get(name: string): Promise<void> {
    const url = urlOf(name);
    if (!url || got.has(name) || !net) return Promise.resolve();
    const done = new Promise<void>((resolve) => waiting.set(name, [...(waiting.get(name) ?? []), resolve]));
    if (pending.has(name)) return done;
    pending.add(name);
    const started = era;
    const finish = (outcome: Outcome): void => {
      settle(name, outcome, started);
      for (const resolve of waiting.get(name) ?? []) resolve();
      waiting.delete(name);
    };
    if (!net.local && net.offline()) {
      // 끊긴 것을 브라우저가 안다: 받으러 가지 않는다(콘솔에 실패를 찍지 않는다). 화면이 그리는 도중일 수 있어 한 박자 뒤에.
      void Promise.resolve().then(() => finish('lost'));
    } else if (net.local || !net.fetch || !net.objectUrl) {
      // fetch를 쓸 수 없는 곳: 주소로 바로 그려 본다. 폴더에서 연 파일이 안 그려지는 것은 끊김이 아니다.
      void net.image(url).then((ok) => finish(ok ? { url } : net.local ? 'broken' : 'lost'));
    } else {
      const objectUrl = net.objectUrl;
      net
        .fetch(url)
        .then((res) => (res.ok ? res.blob().then((blob): Outcome => ({ url: objectUrl(blob) })) : ('broken' as const)))
        .then(finish, () => finish('lost'));
    }
    return done;
  }

  function pump(): void {
    if (paused) return;
    if (net && !net.local && net.offline()) {
      pause();
      return;
    }
    const limit = probing ? 1 : PRELOAD_AT_ONCE;
    while (!paused && active < limit && queue.length > 0) {
      const name = queue.shift() as string;
      if (got.has(name) || failed.has(name)) continue;
      active += 1;
      void get(name).finally(() => {
        active -= 1;
        pump();
      });
    }
  }

  /** 줄을 쉰다. 브라우저가 끊김을 모르면 잠시 뒤 한 장만 받아 본다. */
  function pause(): void {
    if (!paused) {
      paused = true;
      era += 1;
    }
    probing = false;
    if (net && !net.offline() && !cancelRetry) {
      cancelRetry = net.later(() => {
        cancelRetry = null;
        if (paused && !net.offline()) resume(true);
      }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
    }
    notify();
  }

  /** 다시 받는다: 놓친 그림을 줄 맨 앞에(차례대로) 다시 넣고 둘씩(probe면 한 장만) */
  function resume(probe: boolean): void {
    paused = false;
    probing = probe;
    if (cancelRetry) {
      cancelRetry();
      cancelRetry = null;
    }
    const back = [...missed].filter((name) => !pending.has(name));
    for (const name of back) failed.delete(name);
    const rank = (name: string): number => {
      const at = order.indexOf(name);
      return at < 0 ? order.length : at;
    };
    back.sort((a, b) => rank(a) - rank(b));
    const rest = queue.filter((name) => !back.includes(name));
    queue.splice(0, queue.length, ...back, ...rest);
    notify();
    pump();
  }

  if (net?.events) {
    net.events.addEventListener('online', () => resume(false));
    net.events.addEventListener('offline', () => pause());
  }

  return {
    tick,
    notice,
    src(name) {
      void tick.value; // 그림이 도착하면 다시 그리게 한다
      if (!name) return null;
      const ready = got.get(name);
      if (ready) return ready;
      if (!failed.has(name)) void get(name);
      return null;
    },
    broke(name) {
      got.delete(name);
      settle(name, 'broken', era);
    },
    preload(next) {
      order = [...next];
      queue.length = 0;
      queue.push(...next.filter((name) => !got.has(name) && !pending.has(name)));
      pump();
    },
    queued: () => [...queue],
    status: () => ({ active, paused, probing, missed: [...missed] }),
    online: () => resume(false),
    offline: () => pause(),
  };
}

/** 브라우저의 받는 길 */
function browserNet(): PictureNet | null {
  if (typeof window === 'undefined') return null;
  return {
    fetch: typeof fetch === 'function' ? (url) => fetch(url) : undefined,
    objectUrl: typeof URL.createObjectURL === 'function' ? (blob) => URL.createObjectURL(blob) : undefined,
    image: (url) =>
      new Promise<boolean>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
      }),
    local: window.location.protocol === 'file:',
    offline: () => typeof navigator !== 'undefined' && navigator.onLine === false,
    later: (run, ms) => {
      const timer = window.setTimeout(run, ms);
      return () => window.clearTimeout(timer);
    },
    events: window,
  };
}

const loader = createPictureLoader((name) => index.get(name), browserNet());

/** 위쪽 띠의 그림 알림(끊겨서 놓친 그림 · 다시 받는 중) */
export const pictureNotice = loader.notice;

/** 그 이야기의 계절마다 대화 장면이 쓰는 배경과 사람(일을 할 차례로 — 콘텐츠에서 읽는다). role을 주면 그 역할의 일만. */
function planOf(storyId: string, role?: string, past?: { done: readonly string[]; solved: readonly string[] }): SeasonPictures[] {
  const p = getPack(storyId);
  if (!p) return [];
  return picturePlan(p.happenings, p.missions, (who) => p.situation.people[who]?.pic ?? who, role, past);
}

/**
 * 그 이야기의 그림을 뒤에서 모두 미리 받아 둔다(이야기를 열 때 부른다). 기다리게 하지 않는다.
 * 차례는 지금 판의 계절부터(판이 없으면 봄부터 — 새로 시작하는 이야기다), 계절 안에서는 일을 할 차례로(이어 하기면 한 일은 뒤로).
 * 이미 받는 줄이 있으면 새 차례로 다시 세운다.
 */
export function preloadStory(storyId: string): void {
  const g = game.value;
  const mine = g && g.situationId === storyId ? g : null;
  const from = mine ? SEASONS[Math.min(mine.seasonIndex, SEASONS.length - 1)] : SEASONS[0];
  loader.preload(preloadOrder([...index.keys()], storyId, planOf(storyId, mine?.role, mine ?? undefined), from));
}

/** 미리 받는 줄에 남은 이름(개발용·시험용) */
export function preloadQueue(): string[] {
  return loader.queued();
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
  return loader.src(name);
}

/** 받은 그림이 화면에서 깨졌을 때(드문 일): 그 자리를 코드 그림으로 돌린다 */
export function pictureBroke(name: string): void {
  loader.broke(name);
}

/** 자리 이름이 있는가(개발용 견본과 시험에서 쓴다) */
export function hasPicture(name: string): boolean {
  return index.has(name);
}

/** 파일이 있는 모든 자리 이름 */
export function pictureNames(): string[] {
  return [...index.keys()].sort();
}
