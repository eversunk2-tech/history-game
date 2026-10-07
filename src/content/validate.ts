// 콘텐츠 검사기 (spec 11절 "콘텐츠 검사기").
//
// level 'error' = 고쳐야 하는 잘못. 하나라도 있으면 통과하지 못한다.
// level 'gap'   = 알림. 통과를 막지 않는다. 두 갈래가 있다.
//   - 아직 비어 있는 곳: 준비 중인 상황, 장면이 없는 집, 견본 장면, 장면이 없는 견주기 물음
//   - 사람이 한 번 봐야 하는 곳: 읽히지 않는 표시(flag-unread), 근거 글에 없는 숫자(number-unsourced),
//     갈린 결과가 빠뜨린 카드·표시(variant-drops)
//
// 다 채우지 않은 상황은 "장면이 있는 집에 대해서만" 빠짐없는지 보고, 비어 있는 것은 gap으로 알린다.

import { meets } from '../engine/conditions';
import { drawValues } from '../engine/rng';
import {
  EFFECT_MAX,
  EFFECT_MIN,
  GROUP_IDS,
  ROLE_IDS,
  SEASONS,
  STATS,
  STAT_MAX,
  STAT_MIN,
  THEME_IDS,
  type Card,
  type CatalogEntry,
  type Condition,
  type Facts,
  type Group,
  type Outcome,
  type Place,
  type RoleId,
  type Scene,
  type Season,
  type SituationPack,
  type Source,
  type Stat,
  type Stats,
  type Theme,
} from '../engine/types';

export interface Issue {
  level: 'error' | 'gap';
  rule: string;
  where: string;
  message: string;
}

export interface ContentBundle {
  packs: SituationPack[];
  catalog: CatalogEntry[];
  groups: Group[];
  themes: Theme[];
  cards: Card[];
  sources: Source[];
  places: Place[];
}

/** 글자 수 예산 (5절 10번). lockReason부터 아래는 화면에 맞추려고 이 검사기가 더한 것이다. */
export const BUDGET = {
  text: 100,
  label: 26,
  result: 90,
  note: 50,
  lockReason: 30,
  intro: 100,
  wish: 30,
  wishReason: 70,
  endingTitle: 20,
  endingLine: 60,
  epilogue: 90,
  blurb: 44,
  cardTitle: 12,
  cardText: 60,
} as const;

/** 빈칸과 문장 부호까지 센다. */
export function countChars(text: string): number {
  return [...text].length;
}

/**
 * 쓰지 않기로 한 낱말 (7절 "무거운 내용을 다루는 원칙", 2절 "게임이 하지 않는 것", 5절 7번).
 * except: 그 낱말을 설명으로 다룰 수 있는 칸. 지금은 배움 쪽지(note)뿐이다.
 */
export const BANNED_WORDS: { word: string; why: string; except?: 'note'[] }[] = [
  // 7절 노비 — 낮춰 부르는 말을 쓰지 않는다
  { word: '종놈', why: '노비를 낮춰 부르는 말' },
  { word: '종년', why: '노비를 낮춰 부르는 말' },
  { word: '계집종', why: '노비를 낮춰 부르는 말' },
  { word: '머슴놈', why: '사람을 낮춰 부르는 말' },
  { word: '천것', why: '신분을 낮춰 부르는 말' },
  { word: '아랫것', why: '신분을 낮춰 부르는 말' },
  { word: '상놈', why: '신분을 낮춰 부르는 말' },
  { word: '쌍놈', why: '신분을 낮춰 부르는 말' },
  { word: '상것', why: '신분을 낮춰 부르는 말' },
  // 7절 여성 — 놀리거나 꾸짖지 않는다
  { word: '계집', why: '여성을 낮춰 부르는 말' },
  { word: '여편네', why: '여성을 낮춰 부르는 말' },
  // 7절 전쟁 — "왜군" "청군"이라고만 쓴다. 청을 낮추어 본 것은 배움 쪽지에서 설명으로만 다룬다
  { word: '왜놈', why: '그 나라 사람 전체를 낮추는 말' },
  { word: '왜적', why: '"왜군"이라고만 쓴다' },
  { word: '쪽발이', why: '그 나라 사람 전체를 낮추는 말' },
  { word: '되놈', why: '그 나라 사람 전체를 낮추는 말' },
  { word: '떼놈', why: '그 나라 사람 전체를 낮추는 말' },
  { word: '오랑캐', why: '그 나라 사람 전체를 낮추는 말(배움 쪽지의 설명은 됨)', except: ['note'] },
  // 7절 노비·전쟁·믿음 — 때리거나 벌주는 묘사, 죽음과 싸움 장면을 그리지 않는다
  { word: '매질', why: '때리거나 벌주는 묘사' },
  { word: '곤장', why: '때리거나 벌주는 묘사' },
  { word: '채찍', why: '때리거나 벌주는 묘사' },
  { word: '시체', why: '죽음을 그리는 묘사' },
  { word: '주검', why: '죽음을 그리는 묘사' },
  { word: '피투성이', why: '싸움을 그리는 묘사' },
  { word: '목을 베', why: '싸움을 그리는 묘사' },
  // 7절 믿음 — 어느 쪽도 옳다 그르다 하지 않는다
  { word: '미신', why: '믿음을 그르다고 하는 말' },
  { word: '사이비', why: '믿음을 그르다고 하는 말' },
  { word: '이단', why: '믿음을 그르다고 하는 말' },
  { word: '우상', why: '믿음을 그르다고 하는 말' },
  // 퀴즈가 아니다 — 맞음·틀림, 점수, 등수가 없다. 바람을 이루지 못해도 실패라고 하지 않는다
  { word: '정답', why: '맞고 틀림을 가리는 말' },
  { word: '오답', why: '맞고 틀림을 가리는 말' },
  { word: '틀렸', why: '맞고 틀림을 가리는 말' },
  { word: '맞혔', why: '맞고 틀림을 가리는 말' },
  { word: '점수', why: '점수를 매기는 말' },
  { word: '등수', why: '등수를 매기는 말' },
  { word: '실패', why: '실패라고 하지 않는다' },
  { word: '탈락', why: '실패라고 하지 않는다' },
];

/** 잠긴 까닭은 사람 탓이 아니라 제도·형편을 주어로 쓴다(5절 3번). 사람을 탓하는 말투를 잡는다. */
export const BLAME_WORDS = ['네가', '너는', '네 탓', '게을러', '못나서', '모자란 아이'];

// ── 검사 ────────────────────────────────────────────────────

/** 묶음 전체를 검사한다. */
export function validateContent(bundle: ContentBundle): Issue[] {
  const issues: Issue[] = [];
  checkShared(bundle, issues);
  for (const pack of bundle.packs) issues.push(...validatePack(pack, bundle));
  return issues;
}

export function errorsOf(issues: Issue[]): Issue[] {
  return issues.filter((issue) => issue.level === 'error');
}

export function gapsOf(issues: Issue[]): Issue[] {
  return issues.filter((issue) => issue.level === 'gap');
}

/** 사람이 읽을 한 줄 */
export function formatIssue(issue: Issue): string {
  return `[${issue.level === 'error' ? '잘못' : '알림'}] ${issue.where} — ${issue.message} (${issue.rule})`;
}

type Refs = Pick<ContentBundle, 'cards' | 'sources' | 'places' | 'groups' | 'themes' | 'catalog'>;

/** 상황 하나를 검사한다. */
export function validatePack(pack: SituationPack, refs: Refs): Issue[] {
  const issues: Issue[] = [];
  const { situation, scenes } = pack;
  const sid = situation.id || '(이름 없는 상황)';
  const err = (rule: string, where: string, message: string) =>
    issues.push({ level: 'error', rule, where, message });
  const gap = (rule: string, where: string, message: string) =>
    issues.push({ level: 'gap', rule, where, message });

  const sourceIds = new Set(refs.sources.map((source) => source.id));
  const cardIds = new Set(refs.cards.map((card) => card.id));
  const placeIds = new Set(refs.places.map((place) => place.id));
  const draws = drawValues(situation.draw.kind);

  // ── 상황 정의 ──
  if (!situation.id) err('situation', sid, '상황 id가 없다');
  if (!GROUP_IDS.includes(situation.group)) err('situation', sid, `없는 시기 묶음 "${situation.group}"`);
  if (!situation.title) err('situation', sid, '이름이 없다');
  if (!Number.isInteger(situation.year)) err('situation', sid, '대표 해가 없다');
  if (!situation.epilogue) err('situation', sid, '뒷이야기가 없다');
  if (!situation.openQuestion) err('situation', sid, '끝 물음이 없다');
  checkBudget(err, `${sid} 뒷이야기`, 'budget-epilogue', situation.epilogue, BUDGET.epilogue);

  const entry = refs.catalog.find((row) => row.id === situation.id);
  if (!entry) {
    err('catalog', sid, '상황 목록(catalog.ts)에 이 상황이 없다');
  } else {
    if (entry.group !== situation.group) err('catalog', sid, '시기 묶음이 상황 목록과 다르다');
    if (entry.year !== situation.year) err('catalog', sid, '대표 해가 상황 목록과 다르다');
    if (entry.title !== situation.title) err('catalog', sid, '이름이 상황 목록과 다르다');
    if (entry.lessons !== situation.lessons) err('catalog', sid, '지도서 차시가 상황 목록과 다르다');
  }

  // 일곱 물음이 빠짐없는가
  for (const theme of THEME_IDS) {
    if (!situation.themes[theme]?.trim()) err('themes', sid, `견주기 물음 "${theme}"의 답이 비었다`);
  }

  // 뽑기
  if (situation.draw.kind !== 'none') {
    if (!situation.draw.season) err('draw', sid, '뽑기를 하는 계절(draw.season)이 없다');
    if (draws.length === 0) err('draw', sid, `엔진에 아직 없는 뽑기 "${situation.draw.kind}"`);
  }

  // 역할
  for (const role of ROLE_IDS) {
    const def = situation.roles[role];
    const where = `${sid} 역할 ${role}`;
    if (!def) {
      err('roles', where, '역할 정의가 없다');
      continue;
    }
    if (!def.label) err('roles', where, '이름이 없다');
    if (!def.intro) err('roles', where, '소개 글이 없다');
    if (!def.wish) err('roles', where, '올해의 바람이 없다');
    checkBudget(err, `${where} 소개`, 'budget-intro', def.intro, BUDGET.intro);
    checkBudget(err, `${where} 바람`, 'budget-wish', def.wish, BUDGET.wish);
    for (const stat of STATS) {
      const value = def.start?.[stat];
      if (!Number.isInteger(value) || value < STAT_MIN || value > STAT_MAX) {
        err('start-range', where, `시작 수치 ${stat}=${String(value)} (0~10이어야 한다)`);
      }
    }
  }

  // 한 해 이름
  if (situation.endings.length === 0) {
    err('endings', sid, '한 해 이름이 하나도 없다');
  } else {
    const last = situation.endings[situation.endings.length - 1];
    if (last.when && Object.keys(last.when).length > 0) {
      err('endings', sid, '마지막 한 해 이름에는 조건이 없어야 한다(언제나 하나는 뽑혀야 한다)');
    }
    const seen = new Set<string>();
    for (const ending of situation.endings) {
      const where = `${sid} 한 해 이름 ${ending.id}`;
      if (!ending.id || seen.has(ending.id)) err('endings', where, 'id가 없거나 겹친다');
      seen.add(ending.id);
      if (!ending.title) err('endings', where, '이름이 없다');
      checkBudget(err, where, 'budget-ending', ending.title, BUDGET.endingTitle);
      checkBudget(err, where, 'budget-ending', ending.line, BUDGET.endingLine);
    }
  }

  // ── 장면 하나하나 ──
  const sceneIds = new Set<string>();
  const flagsSet = new Set<string>();
  /** 표시 → 그 표시를 남기는 곳(장면/선택지) */
  const flagSetters = new Map<string, string[]>();
  for (const scene of scenes) {
    for (const choice of scene.choices ?? []) {
      for (const outcome of outcomesOf(choice)) {
        for (const flag of outcome.setFlags ?? []) {
          flagsSet.add(flag);
          const at = `${scene.id}/${choice.id}`;
          const list = flagSetters.get(flag) ?? [];
          if (!list.includes(at)) list.push(at);
          flagSetters.set(flag, list);
        }
      }
    }
  }

  const checkCondition = (cond: Condition | undefined, where: string) => {
    if (!cond) return;
    for (const role of cond.roles ?? []) {
      if (!ROLE_IDS.includes(role)) err('condition', where, `없는 역할 "${String(role)}"`);
    }
    for (const bound of [cond.min, cond.max]) {
      for (const [stat, value] of Object.entries(bound ?? {})) {
        if (!STATS.includes(stat as Stat)) err('condition', where, `없는 수치 "${stat}"`);
        if (!Number.isInteger(value) || value < STAT_MIN || value > STAT_MAX) {
          err('condition', where, `수치 조건 ${stat}=${String(value)} (0~10이어야 한다)`);
        }
      }
    }
    for (const flag of [...(cond.flags ?? []), ...(cond.notFlags ?? [])]) {
      if (!flagsSet.has(flag)) err('flag-unknown', where, `어느 선택도 남기지 않는 표시 "${flag}"`);
    }
    if (cond.draw !== undefined && !draws.includes(cond.draw)) {
      err('draw-unknown', where, `이 상황의 뽑기에 없는 값 "${cond.draw}"`);
    }
  };

  const checkOutcome = (outcome: Outcome, where: string) => {
    if (!outcome.result?.trim()) err('result', where, '결과 글이 없다');
    checkBudget(err, where, 'budget-result', outcome.result ?? '', BUDGET.result);
    for (const [stat, value] of Object.entries(outcome.effects ?? {})) {
      if (!STATS.includes(stat as Stat)) err('effect-range', where, `없는 수치 "${stat}"`);
      if (!Number.isInteger(value) || value < EFFECT_MIN || value > EFFECT_MAX) {
        err('effect-range', where, `수치 변화 ${stat} ${String(value)} (-3~+3이어야 한다)`);
      }
    }
    for (const card of outcome.cards ?? []) {
      if (!cardIds.has(card)) err('card-unknown', where, `cards.ts에 없는 카드 "${card}"`);
    }
  };

  for (const scene of scenes) {
    const where = scene.id || '(id 없는 장면)';
    if (!scene.id) err('scene', where, '장면 id가 없다');
    if (sceneIds.has(scene.id)) err('scene', where, '장면 id가 겹친다');
    sceneIds.add(scene.id);
    if (scene.situation !== situation.id) err('scene', where, `다른 상황의 장면이다("${scene.situation}")`);
    if (!SEASONS.includes(scene.season)) err('scene', where, `없는 계절 "${String(scene.season)}"`);
    if (scene.kind !== 'mine' && scene.kind !== 'world') err('scene', where, `없는 갈래 "${String(scene.kind)}"`);
    if (scene.kind === 'mine' && (!scene.role || !ROLE_IDS.includes(scene.role))) {
      err('scene', where, '내 장면인데 어느 집의 장면인지(role) 없다');
    }
    if (scene.kind === 'world' && scene.role) err('scene', where, '세상 장면에는 role을 적지 않는다');
    if (scene.order !== 1 && scene.order !== 2) err('scene', where, 'order는 1 또는 2여야 한다');
    if (!THEME_IDS.includes(scene.theme)) err('scene', where, `없는 견주기 물음 "${String(scene.theme)}"`);
    if (!placeIds.has(scene.place)) err('place-unknown', where, `장소 목록에 없는 곳 "${scene.place}"`);
    if (scene.sample) gap('sample', where, '견본 장면이다. 대본을 쓸 때 다시 다듬는다');

    // 글
    if (!scene.text?.trim()) err('text', where, '지문이 없다');
    checkBudget(err, `${where} 지문`, 'budget-text', scene.text ?? '', BUDGET.text);
    (scene.textVariants ?? []).forEach((variant, index) => {
      checkBudget(err, `${where} 지문 갈림 ${index + 1}`, 'budget-text', variant.text, BUDGET.text);
      if (!variant.text?.trim()) err('text', `${where} 지문 갈림 ${index + 1}`, '지문이 없다');
      checkCondition(variant.when, `${where} 지문 갈림 ${index + 1}`);
    });
    if (!scene.note?.trim()) err('note', where, '배움 쪽지가 없다');
    checkBudget(err, `${where} 배움 쪽지`, 'budget-note', scene.note ?? '', BUDGET.note);

    // 근거
    if (!scene.facts || scene.facts.length === 0) {
      err('facts', where, '근거 번호가 없다');
    } else {
      for (const fact of scene.facts) {
        if (!sourceIds.has(fact)) err('facts', where, `sources.ts에 없는 근거 번호 "${fact}"`);
      }
    }

    // 지문·결과·쪽지에 나온 숫자(연도 포함)가 이 장면이 가리키는 근거의 글에 있는가
    const sourced = new Set(
      refs.sources.filter((source) => (scene.facts ?? []).includes(source.id)).flatMap((source) => numbersIn(source.fact)),
    );
    const numbered: [string, string][] = [
      ['지문', scene.text ?? ''],
      ...(scene.textVariants ?? []).map((v, index): [string, string] => [`지문 갈림 ${index + 1}`, v.text ?? '']),
      ['배움 쪽지', scene.note ?? ''],
      ...(scene.choices ?? []).flatMap((choice) =>
        outcomesOf(choice).map((outcome, index): [string, string] => [`${choice.id} 결과 ${index + 1}`, outcome.result ?? '']),
      ),
    ];
    for (const [part, text] of numbered) {
      for (const number of new Set(numbersIn(text))) {
        if (!sourced.has(number)) {
          gap(
            'number-unsourced',
            `${where} ${part}`,
            `숫자 "${number}"가 이 장면의 근거(${(scene.facts ?? []).join(', ') || '없음'}) 글에 없다. 근거를 더하거나 숫자를 뺀다`,
          );
        }
      }
    }

    // 선택지
    const choices = scene.choices ?? [];
    if (choices.length < 2 || choices.length > 3) {
      err('choices-count', where, `선택지가 ${choices.length}개다(2~3개여야 한다)`);
    }
    const choiceIds = new Set<string>();
    for (const choice of choices) {
      const cw = `${where}/${choice.id || '(id 없음)'}`;
      if (!choice.id || choiceIds.has(choice.id)) err('choice', cw, '선택지 id가 없거나 겹친다');
      choiceIds.add(choice.id);
      if (!choice.label?.trim()) err('choice', cw, '선택지 글이 없다');
      checkBudget(err, `${cw} 선택지`, 'budget-label', choice.label ?? '', BUDGET.label);
      checkOutcome(choice, cw);
      (choice.variants ?? []).forEach((variant, index) => {
        checkOutcome(variant, `${cw} 결과 갈림 ${index + 1}`);
        checkCondition(variant.when, `${cw} 결과 갈림 ${index + 1}`);
        // 갈린 결과는 바탕 결과를 통째로 갈음한다. 바탕의 카드·표시를 다시 적지 않으면 그 갈림에서는 사라진다.
        const dropped = [
          ...(choice.cards ?? []).filter((card) => !(variant.cards ?? []).includes(card)).map((card) => `카드 "${card}"`),
          ...(choice.setFlags ?? []).filter((flag) => !(variant.setFlags ?? []).includes(flag)).map((flag) => `표시 "${flag}"`),
        ];
        if (dropped.length > 0) {
          gap(
            'variant-drops',
            `${cw} 결과 갈림 ${index + 1}`,
            `바탕 결과에 있는 ${dropped.join(', ')}이(가) 이 갈린 결과에는 없다. 뜻한 것이 아니면 다시 적는다`,
          );
        }
      });
      if (choice.lock) {
        if (!choice.lock.reason?.trim()) err('lock-reason', cw, '잠긴 까닭이 없다');
        checkBudget(err, `${cw} 잠긴 까닭`, 'budget-lock', choice.lock.reason ?? '', BUDGET.lockReason);
        for (const blame of BLAME_WORDS) {
          if (choice.lock.reason?.includes(blame)) {
            err('lock-blame', cw, `잠긴 까닭이 사람을 탓한다("${blame}"). 제도나 형편을 주어로 쓴다`);
          }
        }
        checkCondition(choice.lock.unless, `${cw} 잠김`);
        if (!situation.statusLocks && choice.lock.unless.roles) {
          err('status-lock', cw, '이 상황은 신분으로 잠그지 않는다(statusLocks: false)');
        }
      }
    }
  }

  // ── 빠짐없는가: 계절마다 세상 장면 1개, (장면이 있는 집·계절)마다 내 장면 1개 ──
  const worldOf = (season: Season) => scenes.filter((s) => s.kind === 'world' && s.season === season);
  const mineOf = (role: RoleId, season?: Season) =>
    scenes.filter((s) => s.kind === 'mine' && s.role === role && (!season || s.season === season));

  if (scenes.length === 0) {
    gap('empty', sid, '장면이 아직 하나도 없다');
  } else {
    for (const season of SEASONS) {
      const count = worldOf(season).length;
      if (count !== 1) err('scene-count', `${sid} ${season}`, `세상 장면이 ${count}개다(1개여야 한다)`);
    }
  }

  const rolesWithScenes: RoleId[] = [];
  for (const role of ROLE_IDS) {
    const where = `${sid} ${role}`;
    if (mineOf(role).length === 0) {
      if (scenes.length > 0) gap('role-empty', where, '이 집의 장면이 아직 없다(뽑기에서 빠진다)');
      continue;
    }
    rolesWithScenes.push(role);
    for (const season of SEASONS) {
      const mine = mineOf(role, season);
      if (mine.length !== 1) {
        err('scene-count', `${where} ${season}`, `내 장면이 ${mine.length}개다(1개여야 한다)`);
        continue;
      }
      const world = worldOf(season);
      if (world.length === 1 && world[0].order === mine[0].order) {
        err('scene-order', `${where} ${season}`, '세상 장면과 내 장면의 차례(order)가 같다');
      }
    }
    // 올해의 바람을 가릴 줄
    const rows = situation.roles[role]?.wishOutcomes ?? [];
    if (rows.length === 0) {
      err('wish', where, '올해의 바람을 가릴 줄(wishOutcomes)이 없다');
    } else {
      const last = rows[rows.length - 1];
      if (last.when && Object.keys(last.when).length > 0) {
        err('wish', where, '바람을 가리는 마지막 줄에는 조건이 없어야 한다');
      }
      rows.forEach((row, index) => {
        if (!row.reason?.trim()) err('wish', `${where} 바람 ${index + 1}`, '까닭이 없다');
        checkBudget(err, `${where} 바람 ${index + 1}`, 'budget-wish', row.reason ?? '', BUDGET.wishReason);
        checkCondition(row.when, `${where} 바람 ${index + 1}`);
      });
    }
  }
  for (const ending of situation.endings) checkCondition(ending.when, `${sid} 한 해 이름 ${ending.id}`);

  // 남기기만 하고 아무 조건도 읽지 않는 표시. 잘못은 아니다(뒤에 쓸 수도 있다). 잊힌 것이 없는지 보라는 알림이다.
  const flagsRead = flagsReadBy(pack);
  for (const [flag, setters] of flagSetters) {
    if (!flagsRead.has(flag)) {
      gap('flag-unread', `${sid} 표시 ${flag}`, `남기기만 하고 아무 조건도 읽지 않는 표시다(남기는 곳: ${setters.join(', ')})`);
    }
  }

  // 일곱 물음마다 장면이 하나 이상 있는가(6.2). 다 채운 상황에서만 잘못으로 본다.
  const complete = rolesWithScenes.length === ROLE_IDS.length;
  for (const theme of THEME_IDS) {
    if (scenes.length > 0 && !scenes.some((scene) => scene.theme === theme)) {
      const message = `견주기 물음 "${theme}"을 다루는 장면이 없다`;
      if (complete) err('theme-coverage', sid, message);
      else gap('theme-coverage', sid, `${message}(상황을 다 채울 때까지는 알림만)`);
    }
  }

  // ── 어느 집·수치에서도 고를 수 있는 것이 하나 이상인가 ──
  for (const scene of scenes) {
    if (!SEASONS.includes(scene.season) || !scene.choices) continue;
    const roles = scene.kind === 'world' ? ROLE_IDS : scene.role ? [scene.role] : [];
    for (const role of roles) {
      const stuck = findAllLocked(scene, role, possibleDraws(pack, scene.season));
      if (stuck) {
        err(
          'always-one-open',
          `${scene.id} (${role})`,
          `고를 수 있는 선택지가 없는 때가 있다: 살림 ${stuck.stats.living}, 기력 ${stuck.stats.body}, 인심 ${stuck.stats.trust}, 표시 [${stuck.flags.join(', ')}], 뽑기 ${stuck.draw ?? '없음'}`,
        );
      }
    }
  }

  // ── 쓰지 않기로 한 낱말 ──
  for (const piece of textsOfPack(pack)) checkBanned(err, piece);

  return issues;
}

// ── 묶음에 함께 쓰는 자료 ──────────────────────────────────────

function checkShared(bundle: ContentBundle, issues: Issue[]): void {
  const err = (rule: string, where: string, message: string) =>
    issues.push({ level: 'error', rule, where, message });
  const gap = (rule: string, where: string, message: string) =>
    issues.push({ level: 'gap', rule, where, message });

  // 시기 묶음, 견주기 물음
  for (const id of GROUP_IDS) {
    if (bundle.groups.filter((group) => group.id === id).length !== 1) {
      err('groups', 'groups.ts', `시기 묶음 "${id}"가 없거나 겹친다`);
    }
  }
  for (const id of THEME_IDS) {
    const found = bundle.themes.filter((theme) => theme.id === id);
    if (found.length !== 1 || !found[0].question) err('themes', 'themes.ts', `견주기 물음 "${id}"가 없거나 겹친다`);
  }

  // 근거 목록
  const sourceIds = new Set<string>();
  for (const source of bundle.sources) {
    if (!/^F\d{2}$/.test(source.id)) err('sources', `sources.ts ${source.id}`, '근거 번호는 F와 숫자 두 자리다');
    if (sourceIds.has(source.id)) err('sources', `sources.ts ${source.id}`, '근거 번호가 겹친다');
    sourceIds.add(source.id);
    if (!source.fact || !source.source) err('sources', `sources.ts ${source.id}`, '사실이나 출처가 비었다');
  }

  // 장소
  const placeIds = new Set<string>();
  for (const place of bundle.places) {
    if (!place.id || placeIds.has(place.id) || !place.label) err('places', `장소 ${place.id}`, '장소 id·이름이 없거나 겹친다');
    placeIds.add(place.id);
  }

  // 상황 목록
  const catalogIds = new Set<string>();
  const packIds = new Set(bundle.packs.map((pack) => pack.situation.id));
  for (const entry of bundle.catalog) {
    const where = `catalog.ts ${entry.id}`;
    if (!entry.id || catalogIds.has(entry.id)) err('catalog', where, '상황 id가 없거나 겹친다');
    catalogIds.add(entry.id);
    if (!GROUP_IDS.includes(entry.group)) err('catalog', where, `없는 시기 묶음 "${entry.group}"`);
    if (!entry.title || !entry.blurb || !Number.isInteger(entry.year)) err('catalog', where, '이름·대표 해·한 줄 소개가 비었다');
    checkBudget(err, `${where} 한 줄 소개`, 'budget-blurb', entry.blurb ?? '', BUDGET.blurb);
    checkBanned(err, { where, field: 'blurb', text: `${entry.title} ${entry.blurb}` });
    if (!packIds.has(entry.id)) gap('situation-soon', where, '장면 폴더가 아직 없다(준비 중으로 보인다)');
  }
  if (packIds.size !== bundle.packs.length) err('catalog', 'situations', '상황 id가 겹치는 폴더가 있다');

  // 생활 카드
  const cardIds = new Set<string>();
  for (const card of bundle.cards) {
    const where = `cards.ts ${card.id}`;
    if (!card.id || cardIds.has(card.id)) err('cards', where, '카드 id가 없거나 겹친다');
    cardIds.add(card.id);
    if (!card.title || !card.text) err('cards', where, '카드 이름이나 글이 비었다');
    if (!catalogIds.has(card.situation)) err('cards', where, `없는 상황 "${card.situation}"`);
    checkBudget(err, `${where} 이름`, 'budget-card', card.title ?? '', BUDGET.cardTitle);
    checkBudget(err, `${where} 글`, 'budget-card', card.text ?? '', BUDGET.cardText);
    if (!card.facts || card.facts.length === 0) err('facts', where, '근거 번호가 없다');
    for (const fact of card.facts ?? []) {
      if (!sourceIds.has(fact)) err('facts', where, `sources.ts에 없는 근거 번호 "${fact}"`);
    }
    checkBanned(err, { where, field: 'card', text: `${card.title} ${card.text}` });
  }
}

// ── 도구 ────────────────────────────────────────────────────

type Report = (rule: string, where: string, message: string) => void;

function checkBudget(err: Report, where: string, rule: string, text: string, limit: number): void {
  const length = countChars(text);
  if (length > limit) err(rule, where, `${length}자다(${limit}자까지)`);
}

interface TextPiece {
  where: string;
  field: 'text' | 'label' | 'result' | 'note' | 'reason' | 'role' | 'ending' | 'situation' | 'blurb' | 'card';
  text: string;
}

function checkBanned(err: Report, piece: TextPiece): void {
  for (const banned of BANNED_WORDS) {
    if (!piece.text.includes(banned.word)) continue;
    if (piece.field === 'note' && banned.except?.includes('note')) continue;
    err('banned-word', piece.where, `쓰지 않기로 한 낱말 "${banned.word}" — ${banned.why}`);
  }
}

function outcomesOf(choice: { variants?: Outcome[] } & Outcome): Outcome[] {
  return [choice, ...(choice.variants ?? [])];
}

/**
 * 글에 나온 아라비아 숫자들. 천 단위 쉼표는 떼고 센다("66,067" → "66067").
 * "구월", "열다섯"처럼 한글로 쓴 수는 잡지 못한다(사람이 본다).
 */
export function numbersIn(text: string): string[] {
  return (text.match(/\d(?:[\d,]*\d)?/g) ?? []).map((token) => token.replace(/,/g, ''));
}

/** 이 상황의 조건들(잠김·결과 갈림·지문 갈림·바람·한 해 이름)이 읽는 표시 */
function flagsReadBy(pack: SituationPack): Set<string> {
  const read = new Set<string>();
  const take = (cond: Condition | undefined) => {
    for (const flag of [...(cond?.flags ?? []), ...(cond?.notFlags ?? [])]) read.add(flag);
  };
  for (const scene of pack.scenes) {
    for (const variant of scene.textVariants ?? []) take(variant.when);
    for (const choice of scene.choices ?? []) {
      take(choice.lock?.unless);
      for (const variant of choice.variants ?? []) take(variant.when);
    }
  }
  for (const ending of pack.situation.endings ?? []) take(ending.when);
  for (const role of ROLE_IDS) {
    for (const row of pack.situation.roles[role]?.wishOutcomes ?? []) take(row.when);
  }
  return read;
}

/** 상황 하나에서 화면에 보일 수 있는 모든 글 */
export function textsOfPack(pack: SituationPack): TextPiece[] {
  const out: TextPiece[] = [];
  const { situation, scenes } = pack;
  const sid = situation.id;
  out.push({ where: `${sid} 이름`, field: 'situation', text: situation.title ?? '' });
  out.push({ where: `${sid} 뒷이야기`, field: 'situation', text: situation.epilogue ?? '' });
  out.push({ where: `${sid} 끝 물음`, field: 'situation', text: situation.openQuestion ?? '' });
  for (const theme of THEME_IDS) {
    out.push({ where: `${sid} 견주기 ${theme}`, field: 'situation', text: situation.themes[theme] ?? '' });
  }
  for (const role of ROLE_IDS) {
    const def = situation.roles[role];
    if (!def) continue;
    out.push({ where: `${sid} 역할 ${role}`, field: 'role', text: `${def.label} ${def.intro} ${def.wish}` });
    (def.wishOutcomes ?? []).forEach((row, index) =>
      out.push({ where: `${sid} ${role} 바람 ${index + 1}`, field: 'role', text: row.reason ?? '' }),
    );
  }
  for (const ending of situation.endings) {
    out.push({ where: `${sid} 한 해 이름 ${ending.id}`, field: 'ending', text: `${ending.title} ${ending.line}` });
  }
  for (const scene of scenes) {
    out.push({ where: `${scene.id} 지문`, field: 'text', text: scene.text ?? '' });
    (scene.textVariants ?? []).forEach((variant, index) =>
      out.push({ where: `${scene.id} 지문 갈림 ${index + 1}`, field: 'text', text: variant.text ?? '' }),
    );
    out.push({ where: `${scene.id} 배움 쪽지`, field: 'note', text: scene.note ?? '' });
    for (const choice of scene.choices ?? []) {
      const cw = `${scene.id}/${choice.id}`;
      out.push({ where: `${cw} 선택지`, field: 'label', text: choice.label ?? '' });
      outcomesOf(choice).forEach((outcome, index) =>
        out.push({ where: `${cw} 결과 ${index + 1}`, field: 'result', text: outcome.result ?? '' }),
      );
      if (choice.lock) out.push({ where: `${cw} 잠긴 까닭`, field: 'reason', text: choice.lock.reason ?? '' });
    }
  }
  return out;
}

/** 그 계절의 장면에서 뽑기가 가질 수 있는 값. 뽑기 전 계절이면 null뿐이다. */
function possibleDraws(pack: SituationPack, season: Season): (string | null)[] {
  const { kind, season: drawSeason } = pack.situation.draw;
  const values = drawValues(kind);
  if (kind === 'none' || !drawSeason || values.length === 0) return [null];
  return SEASONS.indexOf(season) < SEASONS.indexOf(drawSeason) ? [null] : values;
}

/**
 * 그 집으로 이 장면에 왔을 때 모든 선택지가 잠기는 형편이 있는지 찾는다.
 * 잠김 조건에 나오는 수치의 경계값, 표시의 모든 조합, 뽑기의 모든 값을 다 넣어 본다.
 * 있으면 그 형편을, 없으면 null을 돌려준다.
 */
export function findAllLocked(scene: Scene, role: RoleId, draws: (string | null)[]): Facts | null {
  const choices = scene.choices ?? [];
  if (choices.length === 0) return { role, stats: { living: 0, body: 0, trust: 0 }, flags: [], draw: null };
  if (choices.some((choice) => !choice.lock)) return null;

  const conditions = choices.map((choice) => choice.lock!.unless);
  const candidates: Record<Stat, Set<number>> = {
    living: new Set([STAT_MIN, STAT_MAX]),
    body: new Set([STAT_MIN, STAT_MAX]),
    trust: new Set([STAT_MIN, STAT_MAX]),
  };
  const flagSet = new Set<string>();
  for (const cond of conditions) {
    for (const stat of STATS) {
      for (const bound of [cond.min?.[stat], cond.max?.[stat]]) {
        if (bound === undefined) continue;
        for (const value of [bound - 1, bound, bound + 1]) {
          if (value >= STAT_MIN && value <= STAT_MAX) candidates[stat].add(value);
        }
      }
    }
    for (const flag of [...(cond.flags ?? []), ...(cond.notFlags ?? [])]) flagSet.add(flag);
  }
  const flagList = [...flagSet].slice(0, 12); // 조합이 너무 늘지 않게
  const subsets = 1 << flagList.length;

  for (const draw of draws) {
    for (const living of candidates.living) {
      for (const body of candidates.body) {
        for (const trust of candidates.trust) {
          const stats: Stats = { living, body, trust };
          for (let mask = 0; mask < subsets; mask++) {
            const flags = flagList.filter((_, index) => (mask >> index) & 1);
            const facts: Facts = { role, stats, flags, draw };
            if (conditions.every((cond) => !meets(cond, facts))) return facts;
          }
        }
      }
    }
  }
  return null;
}
