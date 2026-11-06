// 그림 자리의 이름 찾기 — 화면도 파일도 브라우저도 모르는 순수 함수들이다(pictures.ts가 쓰고, 시험이 불러 본다).
//   배경  bg/<이야기>/<자리>-<계절>      예: bg/s1395/entrance-spring
//   인물  char/<이야기>/<누구>-<표정>    예: char/s1395/monk-plain
//
// 찾는 차례
//   배경: 그 계절의 파일 → 같은 자리의 다른 계절(봄·여름·가을·겨울 차례로 처음 있는 것) → 없음(코드 그림)
//   인물: 그 표정의 파일 → plain → 없음(코드 그림 — 맵의 도트 인물을 크게)
//   확장자: 같은 이름에 파일이 여럿이면 webp · jpg · jpeg · png 차례로 하나를 고른다
//
// 미리 받는 차례(preloadOrder): 지금 계절의 일을 사람이 할 차례로(picturePlan) — 일마다 그 일의 배경 → 그 일에 서는 사람
//   → 다음 계절 … → 그 밖의 것.

import { SEASONS, type Season } from '../engine/types';

export type Pose = 'plain' | 'glad' | 'worried';

export const EXT_ORDER: readonly string[] = ['webp', 'jpg', 'jpeg', 'png'];

/**
 * 파일 길(…/pictures/bg/s1395/entrance-spring.jpg) → 주소의 묶음을, 자리 이름(bg/s1395/entrance-spring) → 주소로 바꾼다.
 * '/pictures/' 아래가 아니거나 확장자가 없는 길, 모르는 확장자는 버린다.
 */
export function buildIndex(files: Record<string, unknown>): Map<string, string> {
  const best = new Map<string, { url: string; rank: number }>();
  for (const [path, url] of Object.entries(files)) {
    const cut = path.indexOf('/pictures/');
    const dot = path.lastIndexOf('.');
    if (cut < 0 || dot < cut || typeof url !== 'string') continue;
    const name = path.slice(cut + '/pictures/'.length, dot);
    const rank = EXT_ORDER.indexOf(path.slice(dot + 1).toLowerCase());
    if (rank < 0 || name === '') continue;
    const had = best.get(name);
    if (!had || rank < had.rank) best.set(name, { url, rank });
  }
  return new Map([...best].map(([name, v]) => [name, v.url]));
}

/** 배경의 자리 이름: 그 계절의 파일 → 같은 자리의 다른 계절 → 없음(null이면 코드 그림) */
export function backgroundNameIn(has: (name: string) => boolean, story: string, place: string, season: Season): string | null {
  const exact = `bg/${story}/${place}-${season}`;
  if (has(exact)) return exact;
  for (const other of SEASONS) {
    const name = `bg/${story}/${place}-${other}`;
    if (other !== season && has(name)) return name;
  }
  return null;
}

/** 인물의 자리 이름: 그 표정의 파일 → plain → 없음(null이면 코드 그림) */
export function figureNameIn(has: (name: string) => boolean, story: string, pic: string, pose: Pose = 'plain'): string | null {
  const exact = `char/${story}/${pic}-${pose}`;
  if (has(exact)) return exact;
  const plain = `char/${story}/${pic}-plain`;
  return has(plain) ? plain : null;
}

/** 일 하나(대화 장면 하나)가 쓰는 것: 배경의 자리와 서는 사람의 그림 이름(나오는 차례대로) */
export interface JobPictures {
  place: string;
  people: readonly string[];
}

/** 계절 하나에 대화 장면이 쓰는 것: 그 계절의 일을 사람이 할 차례로 늘어놓은 것 */
export interface SeasonPictures {
  season: Season;
  jobs: readonly JobPictures[];
}

/** 차례를 짤 때 보는 일(콘텐츠의 Happening에서 쓰는 것만) */
export interface PlanHappening {
  id: string;
  season: Season;
  roles?: readonly string[];
  stage: { place: string; cast?: readonly { who: string }[] };
}

/** 차례를 짤 때 보는 미션(콘텐츠의 Mission에서 쓰는 것만) */
export interface PlanMission {
  id: string;
  season: Season | 'year';
  roles?: readonly string[];
  must: boolean;
  parts: readonly string[];
  rescue?: string;
}

/**
 * 계절마다 일을 사람이 할 차례로 늘어놓는다(미리 받는 차례의 바탕 — Review 1-라 11.8 ⑦).
 *   1. 꼭 푸는 미션의 일: 미션의 차례대로(첫 꼭 할 일부터), 미션 안에서는 parts의 차례
 *   2. 그 밖의 일(덤): 콘텐츠에 적힌 차례
 *   3. 도움의 일(rescue — 막혔을 때만 나타난다)
 *   4. 이어 하기라면 이미 한 일과 푼 미션의 일은 그 계절의 맨 뒤로
 * role을 주면 그 역할의 일과 미션만(역할이 적히지 않은 것은 모두의 것). picOf는 사람(who) → 그림 이름.
 * 4-1의 ㉢에서 에피소드 단위로 다시 짠다. 지금은 계절 안의 차례만 고친다.
 */
export function picturePlan(
  happenings: readonly PlanHappening[],
  missions: readonly PlanMission[],
  picOf: (who: string) => string,
  role?: string,
  past: { done?: readonly string[]; solved?: readonly string[] } = {},
): SeasonPictures[] {
  const mine = (roles?: readonly string[]): boolean => !role || !roles || roles.includes(role);
  const rescues = new Set(missions.flatMap((m) => (m.rescue ? [m.rescue] : [])));
  const solved = new Set(past.solved ?? []);
  const finished = new Set([
    ...(past.done ?? []),
    ...missions.filter((m) => solved.has(m.id)).flatMap((m) => (m.rescue ? [...m.parts, m.rescue] : m.parts)),
  ]);
  return SEASONS.map((season) => {
    const here = happenings.filter((h) => h.season === season && mine(h.roles));
    const byId = new Map(here.map((h) => [h.id, h]));
    const ids: string[] = [];
    const put = (id: string): void => {
      if (byId.has(id) && !ids.includes(id)) ids.push(id);
    };
    for (const m of missions) {
      if (m.must && m.season === season && mine(m.roles)) for (const id of m.parts) put(id);
    }
    for (const h of here) if (!rescues.has(h.id)) put(h.id);
    for (const h of here) put(h.id);
    const ordered = [...ids.filter((id) => !finished.has(id)), ...ids.filter((id) => finished.has(id))];
    const jobs = ordered.map((id) => {
      const h = byId.get(id) as PlanHappening;
      const people: string[] = [];
      for (const member of h.stage.cast ?? []) {
        const pic = picOf(member.who);
        if (!people.includes(pic)) people.push(pic);
      }
      return { place: h.stage.place, people };
    });
    return { season, jobs };
  });
}

const POSES: readonly Pose[] = ['plain', 'glad', 'worried'];

/**
 * 미리 받는 차례. 느린 망에서도 지금 할 대화 장면의 그림이 먼저 도착하게 한다(Review 1-라 36번, 11.8 ⑦).
 *   1. 지금 계절(from)부터 계절마다, 그 계절의 일 차례로(picturePlan): 그 일의 배경(그 계절의 파일, 없으면 대신 나올 다른 계절의 파일)
 *      → 그 일에 서는 사람(plain → glad → worried) → 다음 일 …
 *   2. 남은 계절은 from 다음부터 돌아서(봄 → 여름 → 가을 → 겨울 → 다시 봄)
 *   3. 그 밖에 이 이야기의 그림(쓰이지 않는 것까지 — 이름 차례로)
 * names에 없는 이름은 넣지 않는다. 다른 이야기의 그림은 넣지 않는다. 같은 이름은 한 번만(앞의 일에서 넣은 것은 건너뛴다).
 */
export function preloadOrder(names: readonly string[], story: string, plan: readonly SeasonPictures[], from: Season = SEASONS[0]): string[] {
  const have = new Set(names);
  const has = (name: string): boolean => have.has(name);
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (name: string | null): void => {
    if (name && has(name) && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  };
  const start = Math.max(0, SEASONS.indexOf(from));
  for (let k = 0; k < SEASONS.length; k++) {
    const season = SEASONS[(start + k) % SEASONS.length];
    for (const one of plan.filter((p) => p.season === season)) {
      for (const job of one.jobs) {
        add(backgroundNameIn(has, story, job.place, season));
        for (const pic of job.people) for (const pose of POSES) add(`char/${story}/${pic}-${pose}`);
      }
    }
  }
  for (const name of [...names].sort()) {
    if (name.startsWith(`bg/${story}/`) || name.startsWith(`char/${story}/`)) add(name);
  }
  return out;
}
