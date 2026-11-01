// 계절을 닫는 화면과 한 해를 끝맺는 화면(한 해 돌아보기, 이야기책, 제목의 "이어 하기")이 함께 쓰는 셈.
// 화면도 브라우저도 모르는 순수 함수들이다(tests/year.test.ts가 불러 본다).
// "잘했다·못했다"를 셈하지 않는다 — 한 일과 달라진 것을 그대로 간추릴 뿐이다.

import { seasonLabels, statLabels } from '../content/labels';
import { happeningOf } from '../engine/game';
import type { SeasonSummary } from '../engine/review';
import {
  SEASONS,
  STATS,
  STAT_MAX,
  STAT_MIN,
  type Closing,
  type Deed,
  type Facts,
  type GameState,
  type Look,
  type Mission,
  type RoleId,
  type Season,
  type SituationPack,
  type Stat,
  type Stats,
} from '../engine/types';
import { spotLabel } from './where';
import { josa, progressLine } from './words';

// ── 계절 닫기: 이 계절에 한 일의 줄 ─────────────────────────────

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
 * 이 계절에 한 일을 줄로 묶는다(Review 1-라 21번 — 짧게: 미션 종이에서 읽은 것을 다시 길게 적지 않는다).
 *   꼭 할 일   — 미션마다 한 줄. 내가 고른 것을 적고, 고른 것이 없으면 "해낸 일" 한 줄을 적는다.
 *   덤으로 한 일 — 한 줄에 모아 자리 이름마다 칩 하나(덤 미션에 딸린 덤도 — 우물가에 간 것은 우물가에 간 것이다).
 *   덤 미션    — 이 계절에 한 걸음이라도 나아갔으면 맨 끝에 한 줄. 풀렸으면 "해낸 일", 아직이면 어디까지 했는지.
 * 하지 않은 일을 한 것처럼 적지 않는다: "해냄"은 풀린 미션에만 붙는다. 앞 계절에 이미 풀린 덤 미션은 다시 적지 않는다.
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

/**
 * 계절의 끝에 생긴 일 한 줄이 실제로 바꾼 값(Review 1-라 11번): "(살림 −3)", "(살림 +1, 기력 +1)".
 * 바뀐 것이 없으면 "(변화 없음)" — 볍씨의 한 줄처럼 값이 0인 줄도 있다(나눠 뿌려 큰비를 비껴간 해 등).
 * 값을 모르면(꼴 3까지의 옛 저장에 든 닫기) null — 값 없이 줄만 적는다.
 */
export function laterValue(effect: Stats | undefined): string | null {
  if (!effect) return null;
  const parts = STATS.filter((stat) => effect[stat] !== 0).map((stat) => `${statLabels[stat].label} ${effect[stat] > 0 ? '+' : '−'}${Math.abs(effect[stat])}`);
  return parts.length > 0 ? `(${parts.join(', ')})` : '(변화 없음)';
}

/** 계절의 끝에 생긴 일: 줄과 그 값(값을 모르면 null) */
export function laterRows(closing: Pick<Closing, 'lines' | 'effects'> | null | undefined): { text: string; value: string | null }[] {
  return (closing?.lines ?? []).map((text, index) => ({ text, value: laterValue(closing?.effects?.[index]) }));
}

// ── 그해의 날씨 ───────────────────────────────────────────────

/** 뽑힌 날씨의 이름과 한 줄(이야기가 정한 것). 아직 뽑지 않았거나 모르는 값이면 null. */
export function weatherOf(p: SituationPack, draw: string | null): { label: string; line: string } | null {
  if (!draw) return null;
  return p.situation.draw.labels?.[draw] ?? null;
}

/** 이 계절에 그해의 날씨가 처음 드러났는가(뽑는 계절이고, 뽑힌 값이 있다) */
export function weatherShownIn(p: SituationPack, g: GameState, season: Season): boolean {
  return p.situation.draw.season === season && weatherOf(p, g.draw) !== null;
}

// ── 한 해 돌아보기: 계절마다 내가 한 일 ──────────────────────────

export interface RecapMission {
  id: string;
  title: string;
  must: boolean;
  /** "해낸 일" 한 줄 */
  doneLine: string;
  /** 이 계절에 이 미션에서 내가 고른 것들 */
  picks: string[];
}

export interface SeasonRecap {
  season: Season;
  /** 이 계절에 풀린 미션(꼭 할 일 먼저) */
  missions: RecapMission[];
  /** 덤으로 한 일의 자리 이름(같은 자리는 한 번만. 이름을 모르는 일은 세기만 한다) */
  extras: string[];
  /** 덤으로 한 일의 수(자리 이름을 모르는 것까지) */
  extraCount: number;
  /** 아직 풀리지 않은 미션을 이 계절에 어디까지 했는지("셋 가운데 둘을 했어요.") — 마지막 계절에만 적는다 */
  underway: { id: string; title: string; line: string }[];
  /** 계절의 끝에 생긴 일(나중에 나타난 결과)과 그 값 */
  ending: { text: string; value: string | null }[];
  /** 이 계절에 드러난 그해의 날씨 */
  weather: { label: string; line: string } | null;
  before: Stats | null;
  after: Stats | null;
}

/**
 * 한 해 돌아보기의 계절 한 칸. 한 일을 그대로 간추린다.
 *   - 풀린 미션은 풀린 계절에 "해낸 일"과 함께 적는다(꼭 할 일은 그 계절에 고른 것들도).
 *   - 덤으로 한 일은 자리 이름으로 모은다(덤 미션에 딸린 덤도 — 베를 짠 것은 집 안에서 한 일이다).
 *   - 풀리지 않고 끝난 미션은 마지막 계절 칸에 어디까지 했는지를 적는다(다 한 것처럼 적지 않는다).
 */
export function seasonRecap(p: SituationPack, g: GameState, summary: SeasonSummary): SeasonRecap {
  const { season, deeds, closing } = summary;
  const missionOf = (id: string | undefined): Mission | undefined => (id ? p.missions.find((m) => m.id === id) : undefined);
  const solvedHere = [...new Set(deeds.flatMap((deed) => deed.solved))]
    .map((id) => missionOf(id))
    .filter((m): m is Mission => Boolean(m))
    .sort((a, b) => Number(b.must) - Number(a.must));
  const missions: RecapMission[] = solvedHere.map((m) => ({
    id: m.id,
    title: m.title,
    must: m.must,
    doneLine: m.doneLine,
    picks: m.must ? [...new Set(deeds.filter((deed) => deed.missionId === m.id && deed.label).map((deed) => deed.label as string))] : [],
  }));
  const extras: string[] = [];
  let extraCount = 0;
  for (const deed of deeds) {
    // 꼭 할 일의 한 걸음은 덤이 아니다(그 미션의 줄에 적힌다)
    if (missionOf(deed.missionId)?.must) continue;
    extraCount += 1;
    const where = placeOfDeed(p, g.role, deed);
    if (where && !extras.includes(where)) extras.push(where);
  }
  const last = season === SEASONS[SEASONS.length - 1];
  const underway = last
    ? p.missions
        .filter((m) => !m.roles || m.roles.includes(g.role))
        .map((m) => ({ id: m.id, title: m.title, line: progressLine(m, g, false) }))
        .filter((row): row is { id: string; title: string; line: string } => row.line !== null)
    : [];
  return {
    season,
    missions,
    extras,
    extraCount,
    underway,
    ending: laterRows(closing),
    weather: weatherShownIn(p, g, season) ? weatherOf(p, g.draw) : null,
    before: closing?.before ?? null,
    after: closing?.after ?? null,
  };
}

// ── 한 해 돌아보기: 수치의 흐름 ─────────────────────────────────

export interface FlowDot {
  /** 가로 자리 0~100(왼쪽 → 오른쪽) */
  x: number;
  /** 세로 자리 0~100(위 → 아래). 수치가 클수록 위에 놓인다. */
  y: number;
  value: number;
  /** 그 점의 이름: 처음 · 봄 · 여름 · 가을 · 겨울 */
  label: string;
  /** 앞 점에서 바뀐 만큼(첫 점은 0) */
  change: number;
}

/** 흐름의 점 이름: 처음 + 계절 넷 */
export function flowLabels(count: number): string[] {
  return Array.from({ length: count }, (_, index) => (index === 0 ? '처음' : (seasonLabels[SEASONS[index - 1]]?.label ?? `${index}`)));
}

/**
 * 수치 하나의 흐름을 그림의 점으로 바꾼다. 가로는 고르게 나누고(양 끝에 pad만큼 비운다), 세로는 0~10을 그대로 편다.
 * 점이 하나뿐이면 가운데에 놓인다. 0~10을 벗어난 값은 그림에서만 묶는다(적힌 숫자는 그대로다).
 */
export function flowDots(flow: readonly Stats[], stat: Stat, pad = 8): FlowDot[] {
  const labels = flowLabels(flow.length);
  const span = 100 - pad * 2;
  return flow.map((stats, index) => {
    const value = stats[stat];
    const bound = Math.max(STAT_MIN, Math.min(STAT_MAX, value));
    return {
      x: flow.length < 2 ? 50 : pad + (span * index) / (flow.length - 1),
      y: 100 - ((bound - STAT_MIN) / (STAT_MAX - STAT_MIN)) * 100,
      value,
      label: labels[index],
      change: index === 0 ? 0 : value - flow[index - 1][stat],
    };
  });
}

/** 한 해 동안 바뀐 것을 한마디로: "4에서 6으로 2 늘었어요" */
export function flowWords(flow: readonly Stats[], stat: Stat): { from: number; to: number; arrow: '▲' | '▼' | '■'; text: string } {
  const from = flow[0]?.[stat] ?? 0;
  const to = flow[flow.length - 1]?.[stat] ?? from;
  const d = to - from;
  return { from, to, arrow: d > 0 ? '▲' : d < 0 ? '▼' : '■', text: d > 0 ? `${d} 늘었어요` : d < 0 ? `${-d} 줄었어요` : '처음과 같아요' };
}

// ── 이야기책: 깬 이야기에 찍히는 한 해 이름 ───────────────────────

/** 깬 기록 한 줄(저장의 것과 같은 꼴 — 이 파일은 저장을 모른다) */
export interface ClearLike {
  role: RoleId;
  look: Look;
  ending: string;
  legacy: string;
}

/** 모르는 한 해 이름일 때 찍는 말 */
export const PLAIN_STAMP = '한 해를 살았어요';

export const LOOK_WORDS: Record<Look, string> = { boy: '남자아이 모습', girl: '여자아이 모습' };

/** 한 해 이름의 id → 제목. 그 이야기에 없는 id면(옛 판의 이름 등) "한 해를 살았어요". */
export function endingTitle(p: SituationPack | undefined, endingId: string): string {
  return p?.situation.endings.find((ending) => ending.id === endingId)?.title ?? PLAIN_STAMP;
}

export interface Lived {
  role: RoleId;
  look: Look;
  /** "농민 집 아이 · 여자아이 모습"(모습이 하나뿐인 역할이면 역할만) */
  who: string;
  /** 그 모습으로 가장 최근에 받은 한 해 이름 */
  title: string;
  /** 그 모습으로 산 횟수 */
  times: number;
}

export interface BookStamp {
  /** 가장 최근에 깬 해의 한 해 이름(이야기책에 찍힌다) */
  title: string;
  /** 깬 횟수 */
  times: number;
  /** 살아 본 모습들(처음 산 차례대로) */
  lived: Lived[];
  /** 가장 최근에 남긴 것의 이름(없거나 모르면 null) */
  legacy: string | null;
}

/** 깬 기록으로 이야기책의 도장을 만든다. 깬 적이 없으면 null. */
export function bookStamp(p: SituationPack | undefined, records: readonly ClearLike[] | undefined): BookStamp | null {
  if (!records || records.length === 0) return null;
  const last = records[records.length - 1];
  const lived: Lived[] = [];
  for (const record of records) {
    const role = p?.situation.roles.find((r) => r.id === record.role);
    const title = endingTitle(p, record.ending);
    const found = lived.find((one) => one.role === record.role && one.look === record.look);
    if (found) {
      found.title = title;
      found.times += 1;
      continue;
    }
    const roleName = role?.label ?? '';
    const lookName = !role || role.looks.length > 1 ? LOOK_WORDS[record.look] : '';
    lived.push({ role: record.role, look: record.look, who: [roleName, lookName].filter((s) => s !== '').join(' · '), title, times: 1 });
  }
  return {
    title: endingTitle(p, last.ending),
    times: records.length,
    lived,
    legacy: p?.situation.legacy.find((one) => one.id === last.legacy)?.label ?? null,
  };
}

/** 그 역할의 그 모습으로 살아 본 적이 있는가(있으면 그때의 한 해 이름과 횟수) */
export function livedAs(stamp: BookStamp | null, role: RoleId, look?: Look): Lived | null {
  if (!stamp) return null;
  return stamp.lived.find((one) => one.role === role && (look === undefined || one.look === look)) ?? null;
}

// ── 제목의 "이어 하기" 한 줄 ────────────────────────────────────

/**
 * 하던 이야기 한 줄.
 *   맵을 걷는 중          "1395년 여름 · 농민 집 아이"
 *   계절을 닫는 중        "1395년 여름을 보내는 중 · 농민 집 아이"(이어 하면 계절 닫기가 열린다)
 *   겨울까지 보낸 뒤      "1395년 한 해 돌아보기 · 농민 집 아이"(이어 하면 돌아보기가 열린다)
 *   다음 계절이 아직 없음  "1395년 봄까지 했어요 · 농민 집 아이"(눌러 보면 "다음에 만들어요"가 뜬다)
 * ready(season): 그 계절이 이 역할에게 만들어져 있는가.
 */
export function savedLineOf(p: SituationPack, cur: Pick<GameState, 'role' | 'seasonIndex' | 'phase'>, ready: (season: Season) => boolean): string {
  const index = Math.max(0, Math.min(cur.seasonIndex, SEASONS.length - 1));
  const role = p.situation.roles.find((r) => r.id === cur.role)?.label ?? '';
  const tail = role ? ` · ${role}` : '';
  const year = `${p.situation.year}년`;
  const name = seasonLabels[SEASONS[index]].label;
  if (cur.phase === 'done') return `${year} 한 해 돌아보기${tail}`;
  if (cur.phase === 'seasonClose') return `${year} ${josa(name, '을', '를')} 보내는 중${tail}`;
  if (index > 0 && !ready(SEASONS[index])) return `${year} ${seasonLabels[SEASONS[index - 1]].label}까지 했어요${tail}`;
  return `${year} ${name}${tail}`;
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
