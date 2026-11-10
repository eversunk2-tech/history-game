// 결과 종이(에피소드의 끝)와 "지난 이야기"가 함께 쓰는 셈 — 3판 ui/year.ts에서 이 둘만 옮겼다(spec 11.1 가의 "버린다" — 한 해 셈은 지웠다).
// 화면도 브라우저도 모르는 순수 함수들이다(tests/deeds.test.ts가 불러 본다).
// "잘했다·못했다"를 셈하지 않는다 — 한 일과 달라진 것을 그대로 간추릴 뿐이다.

import { happeningOf } from '../engine/game';
import { SEASONS, type Deed, type Facts, type GameState, type Mission, type RoleId, type SituationPack } from '../engine/types';
import { spotLabel } from './where';
import { progressLine } from './words';

// ── 결과 종이: 이번 판에 한 일의 줄(3판 계절 닫기의 셈을 옮겼다) ─────────────────────────────

export interface DeedRow {
  key: string;
  head: string;
  /** 꼭 할 일 · 덤 미션 · 덤으로 한 일 */
  tag: string;
  texts: string[];
  /** 덤으로 한 일의 줄: 자리 이름마다 칩 하나 */
  chips?: string[];
  /** 미션의 줄이면: 풀렸는가(해냄) 아직인가(하는 중). 미션에 딸리지 않은 일이면 null. */
  solved: boolean | null;
}

/** 덤으로 한 일을 모은 줄의 열쇠 */
export const EXTRAS_ROW = 'extras';

/** 그 일이 벌어진 맵의 자리 이름("우물가"). 모르는 일이거나 이름이 없으면 null. */
export function placeOfDeed(p: SituationPack, role: RoleId, deed: Deed): string | null {
  try {
    return spotLabel(p, role, happeningOf(p, deed.happeningId).spot);
  } catch {
    return null;
  }
}

/**
 * 이번 판(에피소드)에 한 일을 줄로 묶는다 — 3판의 계절 닫기에서 옮겼다(Review 1-라 21번 — 짧게: 미션 종이에서 읽은 것을 다시 길게 적지 않는다).
 *   꼭 할 일   — 미션마다 한 줄. 내가 고른 것을 적고, 고른 것이 없으면 "해낸 일" 한 줄을 적는다.
 *   덤으로 한 일 — 한 줄에 모아 자리 이름마다 칩 하나(덤 미션에 딸린 덤도 — 우물가에 간 것은 우물가에 간 것이다).
 *   덤 미션    — 이 계절에 한 걸음이라도 나아갔으면 맨 끝에 한 줄. 풀렸으면 "해낸 일", 아직이면 어디까지 했는지.
 * 하지 않은 일을 한 것처럼 적지 않는다: "해냄"은 풀린 미션에만 붙는다. 앞 계절(앞 에피소드)에 이미 풀린 덤 미션은 다시 적지 않는다.
 * moreSeasons: 뒤에 이어지는 때(에피소드)가 있는가 — 한 해에 걸친 덤 미션의 "나머지는 …에 해요"를 붙일지
 */
export function deedRows(p: SituationPack, g: GameState, deeds: readonly Deed[], moreSeasons: boolean): DeedRow[] {
  const rows: DeedRow[] = [];
  const missionOf = (id: string | undefined): Mission | undefined => (id ? p.missions.find((m) => m.id === id) : undefined);
  const side: Mission[] = [];
  const noteSide = (mission: Mission | undefined): void => {
    if (mission && !mission.must && !side.includes(mission)) side.push(mission);
  };
  const places: string[] = [];
  let unnamed = 0;
  for (const deed of deeds) {
    const mission = missionOf(deed.missionId);
    for (const id of deed.solved) noteSide(missionOf(id));
    if (mission?.must) {
      let row = rows.find((r) => r.key === mission.id);
      if (!row) {
        row = { key: mission.id, head: `「${mission.title}」`, tag: '꼭 할 일', texts: [], solved: false };
        rows.push(row);
      }
      if (deed.label && !row.texts.includes(deed.label)) row.texts.push(deed.label);
      continue;
    }
    noteSide(mission);
    const where = placeOfDeed(p, g.role, deed);
    if (!where) unnamed += 1;
    else if (!places.includes(where)) places.push(where);
  }
  // 꼭 할 일: 풀렸는지는 판이 안다
  for (const row of rows) {
    const mission = p.missions.find((m) => m.id === row.key);
    if (!mission) continue;
    row.solved = g.solved.includes(mission.id);
    if (row.solved) {
      if (row.texts.length === 0) row.texts.push(mission.doneLine);
      continue;
    }
    const progress = progressLine(mission, g, moreSeasons);
    if (progress) row.texts.push(progress);
    else if (row.texts.length === 0) {
      const note = deeds.filter((deed) => deed.missionId === mission.id && deed.note.trim() !== '').pop()?.note;
      row.texts.push(note ?? '아직 하는 중이에요.');
    }
  }
  if (places.length + unnamed > 0) {
    rows.push({
      key: EXTRAS_ROW,
      head: '덤으로 한 일',
      tag: '',
      texts: unnamed > 0 && places.length === 0 ? [`${unnamed}가지를 했어요.`] : [],
      chips: unnamed > 0 && places.length > 0 ? [...places, `그 밖에 ${unnamed}가지`] : places,
      solved: null,
    });
  }
  // 카드를 모으는 덤 미션은 이 계절에 카드를 얻었으면 나아간 것이다(어느 일에서 얻었든)
  if (deeds.some((deed) => deed.newCards.length > 0)) {
    for (const m of p.missions) if (m.done.cardCount !== undefined && (!m.roles || m.roles.includes(g.role))) noteSide(m);
  }
  for (const mission of side) {
    const solvedNow = deeds.some((deed) => deed.solved.includes(mission.id));
    if (solvedNow) {
      rows.push({ key: mission.id, head: `「${mission.title}」`, tag: '덤 미션', texts: [mission.doneLine], solved: true });
      continue;
    }
    if (g.solved.includes(mission.id)) continue; // 앞 계절에 이미 풀렸다
    const progress = progressLine(mission, g, moreSeasons);
    if (progress) rows.push({ key: mission.id, head: `「${mission.title}」`, tag: '덤 미션', texts: [progress], solved: false });
  }
  return rows;
}

// ── 지난 이야기: 그 일을 열던 때의 형편 ──────────────────────────

/**
 * 한 일(history의 index번째)을 하기 바로 앞의 형편. "지난 이야기"가 그때 본 여는 대화(날씨·앞선 선택에 따라 갈린 것)를
 * 다시 보여 주려고 쓴다. 표시와 물건은 그 앞의 기록들이 남긴 것을 모아 되살린다.
 */
export function factsBefore(p: SituationPack, g: GameState, index: number): Facts {
  const deed = g.history[index];
  const earlier = g.history.slice(0, Math.max(0, index));
  // 뽑기는 뽑는 계절에 들어설 때 정해진다. 그 앞 계절의 일은 뽑기를 모르는 채로 열렸다.
  const drawnAt = SEASONS.indexOf(p.situation.draw.season ?? SEASONS[0]);
  const knew = deed ? SEASONS.indexOf(deed.season) >= drawnAt : true;
  return {
    role: g.role,
    look: g.look,
    stats: deed?.before ?? g.stats,
    flags: [...new Set(earlier.flatMap((d) => d.newFlags))],
    draw: knew ? g.draw : null,
    items: [...new Set(earlier.flatMap((d) => d.newItems))],
    cards: [...new Set(earlier.flatMap((d) => d.newCards))],
  };
}
