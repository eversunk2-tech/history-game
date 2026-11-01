// 화면에 보이는 이름들: 수치, 계절, 뽑기, 장소.
// 그림(src/art)은 여기의 id를 이름으로 받아 그린다.

import type { DrawKind, Place, Season, Stat } from '../engine/types';

export const statLabels: Record<Stat, { label: string; about: string }> = {
  living: { label: '살림', about: '곡식과 재물' },
  body: { label: '기력', about: '몸과 마음' },
  trust: { label: '인심', about: '집안과 이웃의 믿음' },
};

/** 계절 이름과 계절을 여는 한 줄(어느 상황에나 쓰는 것) */
export const seasonLabels: Record<Season, { label: string; line: string }> = {
  spring: { label: '봄', line: '얼었던 땅이 풀리고 논에 물이 든다.' },
  summer: { label: '여름', line: '볕이 뜨겁고 풀이 하루가 다르게 자란다.' },
  autumn: { label: '가을', line: '들판이 누렇게 익어 간다.' },
  winter: { label: '겨울', line: '들이 비고 찬 바람이 분다.' },
};

/**
 * 뽑기 결과의 이름과 한 줄. 표(확률)는 engine/rng.ts에 있다.
 * 날씨 이름은 "어떤 해였나"로 적는다. 안쪽 열쇠 bumper를 "풍년"이라고 부르지 않는다:
 * 풍년은 날씨가 아니라 거둔 결과이고, 날씨가 고른 해에도 살림이 줄 수 있다.
 */
export const drawLabels: Partial<
  Record<DrawKind, { title: string; values: Record<string, { label: string; line: string }> }>
> = {
  weather: {
    title: '올해 날씨',
    values: {
      drought: { label: '가뭄 든 해', line: '비가 오지 않아 논과 밭이 말라 간다.' },
      normal: { label: '여느 해', line: '비와 볕이 알맞게 든다.' },
      bumper: { label: '비와 볕이 고른 해', line: '비와 볕이 고루 좋아 곡식이 잘 자란다.' },
    },
  },
};

/**
 * 대화 장면의 배경(Happening.stage.place)의 이름. 그림 자리 `bg/<이야기>/<place>-<계절>`의 <place>가 이 id다.
 * 위 여섯은 봄부터 쓰던 것, 아래 여덟은 ① 1395년의 여름·가을·겨울에 더한 것이다.
 */
export const places: Place[] = [
  { id: 'entrance', label: '마을 어귀' },
  { id: 'paddy', label: '논' },
  { id: 'well', label: '우물가' },
  { id: 'temple', label: '뒷산 절' },
  { id: 'hill', label: '뒷산' },
  { id: 'yard', label: '집 마당' },
  { id: 'stream', label: '냇가' },
  { id: 'road', label: '마을 밖 큰길' },
  { id: 'threshing', label: '타작 마당' },
  { id: 'pass', label: '고갯마루' },
  { id: 'hyanggyo', label: '향교 가는 길' },
  { id: 'manor', label: '양반 댁 대문 앞' },
  { id: 'room', label: '집 안' },
  // 겨울 덤 「곡식이 떨어진 옆집」. 우리 집 마당(yard)과 다른 집이라는 것이 보이게 따로 둔다(review 7번).
  { id: 'neighbor', label: '옆집 앞' },
];

export function placeLabel(id: string): string {
  return places.find((place) => place.id === id)?.label ?? id;
}
