// 그림 자리의 이름 찾기 — 화면도 파일도 브라우저도 모르는 순수 함수들이다(pictures.ts가 쓰고, 시험이 불러 본다).
//   배경  bg/<이야기>/<자리>-<계절>      예: bg/s1395/entrance-spring
//   인물  char/<이야기>/<누구>-<표정>    예: char/s1395/monk-plain
//
// 찾는 차례
//   배경: 그 계절의 파일 → 같은 자리의 다른 계절(봄·여름·가을·겨울 차례로 처음 있는 것) → 없음(코드 그림)
//   인물: 그 표정의 파일 → plain → 없음(코드 그림 — 맵의 도트 인물을 크게)
//   확장자: 같은 이름에 파일이 여럿이면 webp · jpg · jpeg · png 차례로 하나를 고른다

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
