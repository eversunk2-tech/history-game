// 맵의 한 판: 그림 벌(atlas), 맵 위의 상태(world), 그려 둔 것(scene)을 화면 밖에 들고 있는다.
// 화면 컴포넌트가 내려갔다 올라와도(계절 닫기, 처음으로 → 이어 하기) 다시 짓지 않고,
// 대화 장면은 맵을 내리지 않고 그 위에 얹히므로 돌아올 때 멈칫거리지 않는다(review 19번).

import type { Season } from '../engine/types';
import { buildAtlas, type Atlas } from '../pixel/atlas';
import { buildScene, miniColors, type Scene } from './draw';
import type { MapData, Weather, Who } from './types';
import { createWorld, type World } from './world';

export interface MapSession {
  key: string;
  map: MapData;
  atlas: Atlas;
  world: World;
  scene: Scene;
  /** 작은 지도의 칸 빛깔 */
  mini: Uint32Array;
}

const atlases = new Map<string, Atlas>();

/** 계절(과 날씨)의 그림 벌. 한 번 지으면 들고 있는다(짓는 데 0.3초쯤 걸린다). */
export function atlasFor(season: Season, weather: Weather = 'clear'): Atlas {
  const key = `${season}/${season === 'summer' ? weather : 'clear'}`;
  let atlas = atlases.get(key);
  if (!atlas) {
    atlas = buildAtlas(season, weather);
    atlases.set(key, atlas);
  }
  return atlas;
}

let held: MapSession | null = null;

export interface SessionSpec {
  /** 같은 판·같은 계절·같은 사람이면 같은 열쇠 */
  key: string;
  /** 그 계절(과 날씨)의 모습으로 지은 맵. 그림 벌도 이 맵의 계절을 따른다. */
  map: MapData;
  who: Who;
  hero: string;
  /** 이어 할 때: 마지막에 서 있던 칸 */
  at?: [number, number];
  /** 이어 할 때: 가 본 칸(칸마다 0/1) */
  walked?: Uint8Array;
}

/** 열쇠가 같으면 들고 있던 판을 그대로 돌려주고, 다르면 새로 짓는다. */
export function openSession(spec: SessionSpec): MapSession {
  if (held && held.key === spec.key) return held;
  const atlas = atlasFor(spec.map.season, spec.map.weather);
  const world = createWorld(spec.map, spec.who, spec.hero, spec.at);
  if (spec.walked && spec.walked.length === world.visited.length) {
    for (let i = 0; i < world.visited.length; i++) if (spec.walked[i]) world.visited[i] = 1;
  }
  held = { key: spec.key, map: spec.map, atlas, world, scene: buildScene(spec.map, atlas, world), mini: miniColors(spec.map, atlas) };
  return held;
}

/** 지금 들고 있는 판(없으면 null) */
export function heldSession(): MapSession | null {
  return held;
}

export function dropSession(): void {
  held = null;
}
