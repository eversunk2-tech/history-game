// 4판 자료의 검사(spec 11.1 다 "검사기가 더 볼 것", 10.2의 "(4판 더함)"). 검사기 validate.ts의 validateContent가 묶음에 4판 자료(four)가 있으면 부른다.
// 에피소드·고비·카드·장비·꾸미기·유물·거점·핵심 물음·겨루기 문제의 꼴·경험치와 돈. 문제 하나하나는 bankRules(공용 규칙)가 본다.
// "에피소드의 일만" 걷기(3판 미션 규칙)와 작은 고비가 모든 길에서 열리는지는 엔진으로 걸어야 해서 validate.ts의 walkEpisodes가 한다.
//
// level 'error' = 고쳐야 통과, 'gap' = 사람이 한 번 볼 것(아직 만들지 않은 곳 — 은행 주제가 빈 것 등).

import { battleResult, chooseCard, startBattle, answer, type BattleAsk, type Battle } from '../engine/battle';
import { worth, resale } from '../engine/economy';
import { IDLE_ACTIONS, newHero, xpOfAction } from '../engine/growth';
import { BALANCE } from '../engine/balance';
import type { Card, CatalogEntry, SituationPack, Source } from '../engine/types';
import {
  CARD_BONUSES,
  CARD_KINDS,
  FACILITY_IDS,
  FOE_EFFECTS,
  OFF_TURN,
  type BoardNote,
  type CardKind,
  type Facility,
  type Foe,
  type Gear,
  type Keeper,
  type Outfit,
  type Purse,
  type Question,
  type Relic,
  type SkillCard,
  type StoryPlan,
  type Topic,
} from '../engine/types4';
import { BANK_BANNED, TALE_BEINGS, checkBank, countChars, type BankIssue } from './bankRules';

/** 4판의 자료 묶음 */
export interface Content4 {
  plans: StoryPlan[];
  foes: Foe[];
  skills: SkillCard[];
  gear: Gear[];
  outfits: Outfit[];
  relics: Relic[];
  /** 서당 은행의 주제 + 에피소드의 이야기 문제 주제 */
  topics: Topic[];
  questions: Question[];
  facilities: Facility[];
  keepers: Keeper[];
  board: BoardNote[];
  /** 거점·겨루기의 다른 글(정령의 말·알림·시설지기의 말) — 글의 한도와 낱말만 본다 */
  texts?: unknown;
  /** 은행 파일을 읽으며 생긴 잘못(content/bank/index.ts의 readBankFile) */
  bankIssues?: BankIssue[];
}

/** validate.ts의 Issue와 같은 꼴(물리지 않게 여기서 따로 적는다) */
export interface Issue4 {
  level: 'error' | 'gap';
  rule: string;
  where: string;
  message: string;
}

/** 4판 검사가 보는 묶음(validate.ts의 ContentBundle 가운데 이것만) */
export interface Bundle4 {
  packs: SituationPack[];
  cards: Card[];
  catalog: CatalogEntry[];
  sources: Source[];
  four: Content4;
}

/** 4판 글의 한도(4.5·6.2·8.2·5.5): 예고 30 · 카드 이름 12 · 카드 글 60 · 잠긴 까닭 30 · 의뢰 40 · 정령 한 창 60 · 대화 한 창 90 */
export const BUDGET4 = {
  intent: 30,
  cardName: 12,
  cardText: 60,
  lock: 30,
  goal: 40,
  spiritLine: 60,
  line: 90,
  gearName: 12,
  gearText: 60,
  outfitLabel: 12,
  outfitNote: 60,
  relicName: 12,
  relicText: 60,
  facilityDoes: 30,
  keeperLabel: 6,
  boardTitle: 30,
  boardText: 40,
} as const;

/** 고비가 실제 나라·사람이 되지 않는다(7.8 — 금지 낱말 표를 넓힘): 나라·군대·실제 인물의 이름 */
export const REAL_NAMES: readonly string[] = [
  '왜군', '청군', '왜구', '일본', '중국', '명나라', '청나라', '몽골', '거란', '여진',
  '이성계', '태조', '정도전', '세종', '이순신', '곽재우', '고경명', '선조', '인조', '김상헌', '최명길', '정조', '고종',
];
/** 고비를 "쓰러뜨린다"고 하지 않는다 — "넘긴다"·"내기에서 이긴다"(7.8) */
export const FIGHT_WORDS: readonly string[] = ['쓰러뜨', '무찌르', '처치', '해치우', '죽이', '죽여', '때려눕'];
/**
 * 쓰지 않기로 한 각편과 그림(8.4): 혹부리 영감, 사람을 해치거나 혼인·납치의 각편, 일본 요괴의 그림(뿔·호랑이 가죽·쇠못 방망이 — 뿔은 아래에서 따로 본다).
 * 요괴의 이름 "오니"는 넣지 않는다 — 우리말의 "오니"("함께 오니")와 가를 수 없다.
 */
export const UNUSED_TALE_WORDS: readonly string[] = ['혹부리', '이무기', '구미호', '지하국', '두꺼비', '우렁각시', '구렁덩덩', '제물', '호랑이 가죽', '쇠못'];

const STORY_ORDER = ['s1395', 's1446', 's1592', 's1636', 's1795', 's1863', 's1899'];

/** 글 한 덩이(대화 창이면 who) */
interface Piece {
  where: string;
  text: string;
  who?: string;
}

/** 값 안의 글을 모두 모은다: 대화 창({ text, who })과 맨 글자 */
function piecesOf(where: string, value: unknown, out: Piece[] = []): Piece[] {
  if (typeof value === 'string') out.push({ where, text: value });
  else if (Array.isArray(value)) value.forEach((one, i) => piecesOf(`${where}[${i}]`, one, out));
  else if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.text === 'string' && (obj.who === undefined || typeof obj.who === 'string') && Object.keys(obj).every((k) => ['text', 'who', 'pose'].includes(k))) {
      out.push({ where, text: obj.text, who: obj.who as string | undefined });
    } else for (const [key, one] of Object.entries(obj)) piecesOf(`${where}.${key}`, one, out);
  }
  return out;
}

const isPurse = (p: unknown): p is Purse =>
  typeof p === 'object' && p !== null && (['rice', 'cloth', 'coin'] as const).every((k) => Number.isInteger((p as Purse)[k]) && (p as Purse)[k] >= 0);

/** 그 이야기의 그 에피소드까지 얻을 수 있는 솜씨 카드(정해 준 덱 + 그 에피소드와 앞 에피소드의 현장 카드·보상 카드) */
export function cardsWithin(plan: StoryPlan, episodeId: string): Set<string> {
  const out = new Set<string>();
  const sorted = [...plan.episodes].sort((a, b) => a.order - b.order);
  for (const ep of sorted) {
    for (const id of ep.starter ?? []) out.add(id);
    for (const one of ep.skills) out.add(one.card);
    if (ep.id === episodeId) break;
    for (const id of ep.rewards.cards) out.add(id);
  }
  return out;
}

/** 모든 문제를 틀리는 판을 엔진으로 걸어 본다(손패의 첫 장부터, 또는 가장 약한 것부터). 끝난 차례 수와 끝 */
export function allWrongRun(foe: Foe, cards: readonly SkillCard[], deck: readonly string[], body: number, seed: number, order: 'first' | 'last'): { turns: number; end?: string; stars?: boolean[] } {
  const hero = newHero('boy');
  let n = 0;
  const ask: BattleAsk = { card: () => `q-${++n}`, wisdom: (k) => Array.from({ length: k }, (_, i) => `w-${++n}-${i}`) };
  let b: Battle = startBattle({ foe, cards, deck, stats: hero.stats, level: hero.level, body, seed, kind: foe.phases > 1 ? 'boss' : 'minor' });
  for (let step = 0; step < 300 && !b.end; step++) {
    if (b.pending?.kind === 'wisdom') {
      b = answer(b, false, ask);
      continue;
    }
    const hand = b.hand.filter((id) => id !== b.frozen);
    const id = order === 'first' ? hand[0] : hand[hand.length - 1];
    if (!id) break;
    b = chooseCard(b, id, ask);
    b = answer(b, false, ask);
  }
  const result = b.end ? battleResult(b) : null;
  return { turns: b.turn, end: b.end, stars: result?.stars };
}

/** 4판 자료를 검사한다 */
export function validateFour(bundle: Bundle4): Issue4[] {
  const issues: Issue4[] = [];
  const err = (rule: string, where: string, message: string) => issues.push({ level: 'error', rule, where, message });
  const gap = (rule: string, where: string, message: string) => issues.push({ level: 'gap', rule, where, message });
  const four = bundle.four;
  const sourceIds = new Set(bundle.sources.map((s) => s.id));
  const storyIds = new Set(bundle.catalog.map((c) => c.id));
  const cardTitles = new Set(bundle.cards.map((c) => c.title));
  const lifeCardIds = new Set(bundle.cards.map((c) => c.id));
  const skillById = new Map(four.skills.map((s) => [s.id, s]));
  const foeById = new Map(four.foes.map((f) => [f.id, f]));
  const relicIds = new Set(four.relics.map((r) => r.id));
  const topicById = new Map(four.topics.map((t) => [t.id, t]));
  const episodeIds = new Set(four.plans.flatMap((p) => p.episodes.map((e) => e.id)));
  const budget = (where: string, rule: string, text: string, limit: number) => {
    if (countChars(text) > limit) err(rule, where, `${countChars(text)}자다(${limit}자 안): ${text}`);
  };
  const facts = (where: string, list: readonly string[] | undefined, need = true) => {
    if (need && (!list || list.length === 0)) err('facts', where, '근거 번호가 없다');
    for (const f of list ?? []) if (!sourceIds.has(f)) err('facts', where, `근거 목록에 없는 번호 "${f}"`);
  };
  const banned = (piece: Piece) => {
    for (const { word, why } of BANK_BANNED) if (piece.text.includes(word)) err('banned', piece.where, `"${word}" — ${why}`);
  };
  const eras = (where: string, list: readonly string[]) => {
    if (list.length === 0) err('eras', where, '가져갈 수 있는 이야기(eras)가 없다');
    for (const s of list) if (!storyIds.has(s)) err('eras', where, `없는 이야기 "${s}"`);
  };
  /** 문제 꼬리표 하나가 닿는 문제 수(카드의 꼬리표마다 20 이상 — 11.1 다) */
  const reach = (tag: string): { count: number; bankTopic?: string } => {
    const [kind, value] = tag.split(':');
    if (kind === 'ep') return { count: four.questions.filter((q) => q.topic === `ep-${value}`).length };
    if (kind === 'topic') return { count: four.questions.filter((q) => q.topic === value).length, bankTopic: value };
    if (kind === 'theme') return { count: four.questions.filter((q) => q.tags?.includes(tag)).length };
    return { count: 0 };
  };

  // ── 문제 전수(bankRules) ──
  const ctx = { sources: sourceIds, cards: new Set(skillById.keys()), episodes: episodeIds };
  for (const one of [...(four.bankIssues ?? []), ...checkBank(four.topics, four.questions, ctx)]) issues.push({ ...one });

  // ── 에피소드 ──
  for (const plan of four.plans) {
    const pack = bundle.packs.find((p) => p.situation.id === plan.story);
    const wherePlan = `에피소드 표 ${plan.story}`;
    if (!pack) {
      err('episode', wherePlan, `이야기 묶음이 없다 "${plan.story}"`);
      continue;
    }
    const happening = new Map(pack.happenings.map((h) => [h.id, h]));
    const mission = new Map(pack.missions.map((m) => [m.id, m]));
    // marks: 맵·놀이가 읽는 표시를 그 이야기의 일이 실제로 남긴다(1-라 43번)
    const left = new Set<string>();
    for (const h of pack.happenings) {
      for (const f of Object.values(h.play?.flags ?? {})) left.add(f);
      for (const c of h.choices ?? []) for (const o of [c, ...(c.variants ?? [])]) for (const f of o.setFlags ?? []) left.add(f);
      if (h.after) for (const o of [h.after, ...(h.after.variants ?? [])]) for (const f of o.setFlags ?? []) left.add(f);
    }
    for (const [name, flag] of Object.entries(plan.marks)) {
      if (!left.has(flag)) err('marks', `${wherePlan} marks.${name}`, `표시 "${flag}"를 남기는 일이 이야기에 없다`);
    }
    const orders = new Set<number>();
    for (const ep of plan.episodes) {
      const where = `에피소드 ${ep.id}`;
      if (ep.story !== plan.story) err('episode', where, `이야기가 표와 다르다(${ep.story})`);
      if (orders.has(ep.order)) err('episode', where, '차례(order)가 겹친다');
      orders.add(ep.order);
      if (!ep.title || !ep.when || !ep.goal) err('episode', where, '이름·때·의뢰가 비었다');
      budget(`${where} 의뢰`, 'budget-goal', ep.goal, BUDGET4.goal);
      if (!ep.ask) err('episode', where, '끝의 정령 물음(ask)이 비었다');
      else budget(`${where} 정령의 물음`, 'budget-spirit', ep.ask, BUDGET4.spiritLine);
      if (!/^\d단원 /.test(ep.lessons)) err('episode', where, `지도서 차시는 '2단원 2~3차시' 꼴이다: "${ep.lessons}"`);
      // 꼭 할 일: 1개 이상, 묶음의 꼭 푸는 미션, 그 에피소드의 계절
      if (ep.missions.length === 0) err('episode', where, '꼭 할 일(의뢰의 일)이 없다');
      for (const id of ep.missions) {
        const m = mission.get(id);
        if (!m) err('episode', where, `묶음에 없는 미션 "${id}"`);
        else {
          if (!m.must) err('episode', where, `"${id}"는 꼭 푸는 미션이 아니다`);
          if (m.season !== ep.season) err('episode', where, `"${id}"는 ${m.season}의 미션이다(에피소드는 ${ep.season})`);
        }
      }
      // 덤: 묶음의 덤(해 ☀ 하나), 그 계절, 해 ☀보다 많게
      for (const id of ep.extras) {
        const h = happening.get(id);
        if (!h) err('episode', where, `묶음에 없는 덤 "${id}"`);
        else {
          if (h.cost !== 1) err('episode', where, `"${id}"는 덤(해 ☀ 하나)이 아니다`);
          if (h.season !== ep.season) err('episode', where, `덤 "${id}"는 ${h.season}의 일이다`);
        }
      }
      if (!Number.isInteger(ep.suns) || ep.suns < 1) err('episode', where, '해 ☀는 1 이상이다');
      if (ep.extras.length <= ep.suns) err('episode', where, `덤(${ep.extras.length})이 해 ☀(${ep.suns})보다 많아야 고르는 맛이 있다`);
      // 작은 고비: 자리(일)가 묶음·그 계절에, 겨루기면 작은 고비(단계 하나·방패 없음)
      for (const minor of ep.minors) {
        const h = happening.get(minor.at);
        if (!h) err('episode', `${where} 작은 고비 ${minor.id}`, `묶음에 없는 일 "${minor.at}"`);
        else if (h.season !== ep.season) err('episode', `${where} 작은 고비 ${minor.id}`, `"${minor.at}"는 ${h.season}의 일이다`);
        if (minor.before === 'play' && h && !h.play) err('episode', `${where} 작은 고비 ${minor.id}`, `"${minor.at}"에 놀이가 없다(before: 'play')`);
        if (minor.kind === 'battle') {
          const foe = minor.foe ? foeById.get(minor.foe) : undefined;
          if (!foe) err('episode', `${where} 작은 고비 ${minor.id}`, `없는 고비 "${minor.foe ?? ''}"`);
          else if (foe.phases !== 1 || foe.shield !== 0) err('episode', `${where} 작은 고비 ${minor.id}`, '짧은 겨루기의 고비는 단계 하나·방패 없음이다');
        } else if (minor.kind === 'play' && h && !h.play) err('episode', `${where} 작은 고비 ${minor.id}`, `"${minor.at}"에 놀이가 없다`);
      }
      const boss = foeById.get(ep.boss);
      if (!boss) err('episode', where, `없는 큰 고비 "${ep.boss}"`);
      else if (boss.phases < 2) err('episode', where, '큰 고비는 두 단계 이상이다');
      // 카드: 정해 준 덱과 현장 카드가 있고, 그 이야기에 가져갈 수 있다(시대 밖의 것이 들어가지 않는다)
      const own = cardsWithin(plan, ep.id);
      for (const id of [...(ep.starter ?? []), ...ep.skills.map((s) => s.card), ...ep.rewards.cards]) {
        const card = skillById.get(id);
        if (!card) err('episode', where, `없는 솜씨 카드 "${id}"`);
        else if (!card.eras.includes(plan.story)) err('eras', where, `카드 "${id}"는 이 이야기(${plan.story})에 가져갈 수 없다`);
      }
      for (const one of ep.skills) if (!happening.has(one.at)) err('episode', where, `현장 카드를 주는 일 "${one.at}"이 묶음에 없다`);
      // 정해 준 덱은 갈래마다 하나 이상(11.1 다)
      if (ep.starter) for (const kind of CARD_KINDS) if (!ep.starter.some((id) => skillById.get(id)?.kind === kind)) err('episode', where, `정해 준 덱에 ${kind} 카드가 없다`);
      // 고비의 센 카드가 그 에피소드까지 얻을 수 있는 카드 안에 있다
      for (const foe of [boss, ...ep.minors.map((m) => (m.foe ? foeById.get(m.foe) : undefined))]) {
        if (!foe) continue;
        const kinds = new Set<string>([...foe.strong, ...foe.moves.map((m) => m.strong).filter((k): k is CardKind => Boolean(k))]);
        for (const strong of kinds) {
          const has = [...own].some((id) => id === strong || skillById.get(id)?.kind === strong);
          if (!has) err('foe-strong', `${where} 고비 ${foe.id}`, `센 카드 "${strong}"를 이 에피소드까지 얻을 수 없다`);
        }
      }
      // 유물
      for (const id of ep.rewards.relics) if (!relicIds.has(id)) err('episode', where, `없는 유물 "${id}"`);
      if (!isPurse(ep.rewards.purse)) err('episode', where, '보상의 돈 주머니가 꼴이 아니다');
      // 이야기 문제의 주제와 핵심 물음(6개 이상, 모두 그 주제에, 'core' 꼬리표)
      const story = topicById.get(ep.storyTopic);
      if (!story) err('episode', where, `이야기 문제의 주제 "${ep.storyTopic}"가 없다`);
      else if (story.kind !== 'story') err('episode', where, `"${ep.storyTopic}"는 이야기 문제 주제(kind 'story')가 아니다`);
      if (ep.storyTopic !== `ep-${ep.id}`) err('episode', where, `이야기 문제의 주제 id는 'ep-${ep.id}'다`);
      if (ep.core.length < 6 || ep.core.length > 9) err('core', where, `핵심 물음은 6~9개다(${ep.core.length}개)`);
      if (new Set(ep.core).size !== ep.core.length) err('core', where, '핵심 물음이 겹친다');
      for (const id of ep.core) {
        const q = four.questions.find((x) => x.id === id);
        if (!q) err('core', where, `없는 문제 "${id}"`);
        else {
          if (q.topic !== ep.storyTopic) err('core', where, `핵심 물음 "${id}"가 이야기 문제 주제에 없다`);
          if (!q.tags?.includes('core')) err('core', where, `핵심 물음 "${id}"에 'core' 꼬리표가 없다`);
        }
      }
      const tagged = four.questions.filter((q) => q.topic === ep.storyTopic && q.tags?.includes('core')).map((q) => q.id);
      for (const id of tagged) if (!ep.core.includes(id)) err('core', where, `'core' 꼬리표를 단 "${id}"가 에피소드의 핵심 물음에 없다`);
      for (const t of ep.topics) {
        if (!topicById.has(t)) gap('bank-empty', where, `이어진 서당 주제 "${t}"가 아직 은행에 없다(㉮가 넣는다)`);
      }
    }
  }

  // ── 고비 ──
  for (const foe of four.foes) {
    const where = `고비 ${foe.id}`;
    if (!foe.name) err('foe', where, '이름이 없다');
    if (!(foe.hp > 0) || !Number.isInteger(foe.hp)) err('foe', where, '기운은 양의 정수다');
    if (![1, 2, 3].includes(foe.phases)) err('foe', where, '단계는 1~3이다');
    if (foe.moves.length === 0) err('foe', where, '할 일(moves)이 없다');
    const moveIds = new Set<string>();
    for (const move of foe.moves) {
      const at = `${where} 할 일 ${move.id}`;
      if (moveIds.has(move.id)) err('foe', at, '할 일 id가 겹친다');
      moveIds.add(move.id);
      if (!move.line) err('foe', at, '예고 한 줄이 없다');
      budget(at, 'budget-intent', move.line, BUDGET4.intent);
      if (!move.icon) err('foe', at, '그림 표시가 없다');
      if (!(move.weight > 0)) err('foe', at, '무게는 0보다 크다');
      if (move.strong && !CARD_KINDS.includes(move.strong)) err('foe', at, `모르는 갈래 "${move.strong}"`);
      if (move.effect && !FOE_EFFECTS.includes(move.effect)) err('foe', at, `모르는 덧효과 "${move.effect}"`);
      if (move.hit && !(Number.isInteger(move.hit[0]) && Number.isInteger(move.hit[1]) && move.hit[0] >= 0 && move.hit[0] <= move.hit[1])) err('foe', at, '깎는 기운의 범위가 틀렸다');
      if (!move.hit && !move.effect) err('foe', at, '깎는 기운도 덧효과도 없다');
    }
    for (const one of [...foe.strong, ...foe.weak]) {
      if (one !== OFF_TURN && !CARD_KINDS.includes(one as CardKind) && !skillById.has(one)) err('foe', where, `센·약한 카드의 이름이 갈래도 카드 id도 아니다: "${one}"`);
    }
    if (foe.weak.includes(OFF_TURN) && !foe.moves.some((m) => m.strong)) err('foe', where, "'off-turn'은 차례마다 센 갈래(FoeMove.strong)가 있는 고비에만 뜻이 있다");
    if (foe.opening.length === 0 || foe.win.length === 0 || foe.rescue.length === 0 || foe.dusk.length === 0) err('foe', where, '여는 말·넘긴 뒤·구해 준 뒤·마무리의 말이 비었다');
    if (foe.phases > 1 && (foe.phaseOpen.length === 0 || foe.wisdom.length === 0 || !foe.fade)) err('foe', where, '큰 고비에 2단계의 말·지혜 겨루기 들머리·방패가 깎일 때의 한 줄이 없다');
    if (!foe.picture) err('foe', where, '그림 자리가 없다');
    facts(where, foe.facts);
    // 옛이야기: 표시와 근거(F70~F74), 정령이 "옛이야기야"를 먼저
    const tale = foe.kind === 'tale';
    if (tale !== Boolean(foe.tale)) err('tale', where, "옛이야기 고비(kind 'tale')에는 「옛이야기」 표시(tale: true)를 단다(그 밖에는 달지 않는다)");
    if (tale && !foe.facts.some((f) => /^F7[0-4]$/.test(f))) err('tale', where, '옛이야기 고비의 근거(F70~F74)가 없다');
    if (tale && !(foe.opening[0]?.who === 'neuti' && foe.opening[0].text.includes('옛이야기'))) err('tale', where, '여는 말의 첫 창은 정령이 "옛이야기야"라고 먼저 말한다(7.8)');
    // 낱말: 실제 나라·사람, "쓰러뜨린다", 쓰지 않는 각편·그림
    const pieces = piecesOf(where, { name: foe.name, moves: foe.moves.map((m) => m.line), opening: foe.opening, win: foe.win, rescue: foe.rescue, dusk: foe.dusk, phaseOpen: foe.phaseOpen, wisdom: foe.wisdom, fade: foe.fade });
    for (const piece of pieces) {
      banned(piece);
      for (const word of REAL_NAMES) if (piece.text.includes(word)) err('real-name', piece.where, `실제 나라·사람의 이름 "${word}" — 고비가 되지 않는다(7.8)`);
      for (const word of FIGHT_WORDS) if (piece.text.includes(word)) err('fight-word', piece.where, `"${word}" — 고비는 "넘긴다"·"내기에서 이긴다"(7.8)`);
      for (const word of UNUSED_TALE_WORDS) if (piece.text.includes(word)) err('tale-unused', piece.where, `쓰지 않기로 한 각편·그림의 낱말 "${word}"(8.4)`);
      if (piece.text.replace(/뿔뿔/g, '').includes('뿔')) err('tale-unused', piece.where, '도깨비에 뿔을 그리지 않는다(8.4 — 일본 요괴의 그림)');
      budget(piece.where, piece.who === 'neuti' ? 'budget-spirit' : 'budget-line', piece.text, piece.who === 'neuti' ? BUDGET4.spiritLine : BUDGET4.line);
    }
    // 모든 문제를 틀려도 끝난다: 어느 덱(정해 준 것, 현장 카드까지)·카드 차례·기력(0 — 가장 지친 때)에서도 차례 한도 안에, 별 ①을 받고
    const limit = foe.phases > 1 ? BALANCE.turnLimit : BALANCE.turnLimitMinor;
    const decks: string[][] = [];
    for (const plan of four.plans) {
      for (const ep of plan.episodes) {
        if (ep.boss !== foe.id && !ep.minors.some((m) => m.foe === foe.id)) continue;
        decks.push([...(ep.starter ?? [])], [...new Set([...(ep.starter ?? []), ...ep.skills.map((s) => s.card)])]);
      }
    }
    for (const deck of decks) {
      const cards = deck.map((id) => skillById.get(id)).filter((c): c is SkillCard => Boolean(c));
      if (cards.length === 0) continue;
      for (const body of [0, 6]) {
        for (const order of ['first', 'last'] as const) {
          for (const seed of [1, 2, 3]) {
            const run = allWrongRun(foe, cards, deck, body, seed, order);
            if (!run.end || run.turns > limit) err('battle-endless', where, `모두 틀린 판이 ${limit}차례 안에 끝나지 않는다(덱 ${deck.length}장, 기력 ${body}, ${order}, 씨앗 ${seed}: ${run.turns}차례 ${run.end ?? '끝나지 않음'})`);
            else if (!run.stars?.[0]) err('battle-endless', where, '모두 틀린 판에서 별 ①(넘김)을 받지 못한다');
          }
        }
      }
    }
  }

  // ── 솜씨 카드 ──
  for (const card of four.skills) {
    const where = `솜씨 카드 ${card.id}`;
    if (!/^skill-[a-z0-9-]+$/.test(card.id)) err('card', where, "솜씨 카드 id는 'skill-…'이다(3판 생활 카드와 가른다 — 8.2)");
    if (lifeCardIds.has(card.id)) err('card', where, '3판 생활 카드와 id가 겹친다');
    if (cardTitles.has(card.name)) err('card', where, `3판 생활 카드와 이름이 같다(「${card.name}」 — 8.2)`);
    budget(`${where} 이름`, 'budget-card', card.name, BUDGET4.cardName);
    budget(`${where} 글`, 'budget-card', card.text, BUDGET4.cardText);
    if (!card.branch) err('card', where, '가지(branch)가 없다');
    if (!CARD_KINDS.includes(card.kind)) err('card', where, `모르는 갈래 "${card.kind}"`);
    if (!CARD_BONUSES.includes(card.bonus)) err('card', where, `모르는 덧효과 "${card.bonus}"`);
    if (!Number.isInteger(card.base) || card.base < 6 || card.base > 12) err('card', where, `기본 힘은 6~12다(${card.base})`);
    eras(where, card.eras);
    facts(where, card.facts);
    if (card.tags.length === 0) err('card', where, '지식 꼬리표가 없다');
    for (const tag of card.tags) {
      if (!/^(ep|topic|theme):[a-z0-9-]+$/.test(tag)) {
        err('card', where, `꼬리표의 꼴이 아니다: "${tag}"('ep:…'·'topic:…'·'theme:…' — 이름이 아니라 id로)`);
        continue;
      }
      if (tag.startsWith('ep:') && !episodeIds.has(tag.slice(3))) err('card', where, `없는 에피소드 "${tag}"`);
      const { count, bankTopic } = reach(tag);
      if (bankTopic && !topicById.has(bankTopic)) gap('bank-empty', where, `꼬리표 "${tag}"의 서당 주제가 아직 은행에 없다(㉮가 넣으면 20개 이상인지 본다)`);
      else if (count < 20) err('card-tag', where, `꼬리표 "${tag}"에 닿는 문제가 ${count}개다(20개 이상 — 11.1 다)`);
    }
    for (const piece of piecesOf(where, [card.name, card.text])) {
      banned(piece);
      for (const being of TALE_BEINGS) if (piece.text.includes(being)) err('tale', piece.where, `옛이야기 속 존재 "${being}"를 사실 칸(카드)에 섞지 않는다(7.8)`);
    }
  }
  for (const card of bundle.cards) {
    for (const being of TALE_BEINGS) if (`${card.title} ${card.text}`.includes(being)) err('tale', `cards.ts ${card.id}`, `옛이야기 속 존재 "${being}"를 생활 카드에 섞지 않는다(7.8)`);
  }

  // ── 장비 ──
  for (const g of four.gear) {
    const where = `장비 ${g.id}`;
    budget(`${where} 이름`, 'budget-gear', g.name, BUDGET4.gearName);
    budget(`${where} 쪽지`, 'budget-gear', g.text, BUDGET4.gearText);
    if (g.slot !== 'hand' && g.slot !== 'pack') err('gear', where, '자리(slot)는 hand·pack이다');
    if (!(g.boost.add > 0)) err('gear', where, '덧힘(boost.add)은 0보다 크다');
    for (const id of g.boost.cards ?? []) if (!skillById.has(id)) err('gear', where, `없는 솜씨 카드 "${id}"`);
    for (const k of g.boost.kinds ?? []) if (!CARD_KINDS.includes(k)) err('gear', where, `모르는 갈래 "${k}"`);
    eras(where, g.eras);
    facts(where, g.facts);
    if (g.price !== undefined && !isPurse(g.price)) err('gear', where, '값(price)이 돈 주머니의 꼴이 아니다');
    // 시대 잠김: 가져갈 수 없는 이야기가 있으면 잠긴 까닭(30자)이 있다. 4-1에 열린 이야기(①)에 잠긴 것은 팔지 않는다(도리깨 — 6.3)
    const locked = STORY_ORDER.filter((s) => !g.eras.includes(s));
    if (locked.length > 0 && !g.lock) err('gear', where, '잠긴 이야기가 있는데 잠긴 까닭(lock)이 없다');
    budget(`${where} 잠긴 까닭`, 'budget-lock', g.lock, BUDGET4.lock);
    const openStories = four.plans.map((p) => p.story);
    if (g.price && openStories.some((s) => !g.eras.includes(s))) err('eras', where, '지금 열린 이야기에 가져갈 수 없는 장비를 판다(6.3 — 도리깨는 팔지 않는다)');
    if (g.price && g.boost.cards?.length === 0 && !g.boost.kinds?.length) gap('gear-idle', where, '지금 덧힘을 받는 카드가 없다(뒤 에피소드의 카드에 건다)');
    for (const piece of piecesOf(where, [g.name, g.text, g.lock])) banned(piece);
  }

  // ── 꾸미기 ──
  for (const o of four.outfits) {
    const where = `꾸미기 ${o.id}`;
    if (o.part !== 'ribbon' && o.part !== 'jacket') err('outfit', where, '갈래(part)는 ribbon·jacket이다');
    if (!/^#[0-9a-f]{6}$/i.test(o.color)) err('outfit', where, `빛깔은 '#rrggbb'다: "${o.color}"`);
    budget(`${where} 이름`, 'budget-outfit', o.label, BUDGET4.outfitLabel);
    budget(`${where} 쪽지`, 'budget-outfit', o.note, BUDGET4.outfitNote);
    if (!o.era || !o.who) err('outfit', where, '시대·신분이 비었다');
    if (!o.made && o.facts.length === 0) err('outfit', where, '"꾸민 차림"이 아니면 근거가 1개 이상 있다(6.4)');
    if (o.made && !o.note.includes('꾸민')) err('outfit', where, '꾸민 차림은 쪽지에 "꾸민 차림"이라고 밝힌다(6.4)');
    facts(where, o.facts, false);
    if (!isPurse(o.price)) err('outfit', where, '값(price)이 돈 주머니의 꼴이 아니다');
    for (const piece of piecesOf(where, [o.label, o.note])) banned(piece);
  }

  // ── 유물 ──
  for (const r of four.relics) {
    const where = `유물 ${r.id}`;
    budget(`${where} 이름`, 'budget-relic', r.name, BUDGET4.relicName);
    budget(`${where} 글`, 'budget-relic', r.text, BUDGET4.relicText);
    if (!storyIds.has(r.era)) err('relic', where, `없는 이야기 "${r.era}"`);
    facts(where, r.facts);
    for (const piece of piecesOf(where, [r.name, r.text])) banned(piece);
  }

  // ── 거점 ──
  const facIds = four.facilities.map((f) => f.id);
  for (const id of FACILITY_IDS) if (facIds.filter((x) => x === id).length !== 1) err('hub', `시설 ${id}`, '시설 열하나가 하나씩 있어야 한다');
  const keeperIds = new Set(four.keepers.map((k) => k.id));
  for (const f of four.facilities) {
    budget(`시설 ${f.id} 하는 일`, 'budget-hub', f.does, BUDGET4.facilityDoes);
    if (f.keeper && !keeperIds.has(f.keeper)) err('hub', `시설 ${f.id}`, `없는 시설지기 "${f.keeper}"`);
    if (f.open && f.keeper && (four.keepers.find((k) => k.id === f.keeper)?.greet.length ?? 0) === 0) err('hub', `시설 ${f.id}`, '열린 시설의 시설지기에게 처음 말이 없다');
  }
  for (const k of four.keepers) budget(`시설지기 ${k.id}`, 'budget-hub', k.label, BUDGET4.keeperLabel);
  const men = four.keepers.filter((k) => k.sex === 'm').length;
  const women = four.keepers.length - men;
  if (four.keepers.length > 0 && Math.min(men, women) * 3 < four.keepers.length) err('hub', '시설지기', `남녀가 한쪽으로 쏠렸다(남 ${men}, 여 ${women} — 6.3)`);
  for (const note of four.board) {
    const where = `알림판 ${note.id}`;
    budget(`${where} 이름`, 'budget-hub', note.title, BUDGET4.boardTitle);
    budget(`${where} 글`, 'budget-hub', note.text, BUDGET4.boardText);
    if (note.episode && !episodeIds.has(note.episode)) err('hub', where, `없는 에피소드 "${note.episode}"`);
    if (note.after && !episodeIds.has(note.after)) err('hub', where, `없는 에피소드 "${note.after}"`);
  }
  // 거점·겨루기의 다른 글: 정령의 말은 한 창 60자, 대화 한 창 90자, 쓰지 않는 낱말
  for (const piece of piecesOf('거점의 글', four.texts ?? {})) {
    banned(piece);
    const spirit = piece.who === 'neuti' || piece.where.startsWith('거점의 글.spirit');
    budget(piece.where, spirit ? 'budget-spirit' : 'budget-line', piece.text, spirit ? BUDGET4.spiritLine : BUDGET4.line);
    for (const being of TALE_BEINGS) if (piece.where.includes('shop') && piece.text.includes(being)) err('tale', piece.where, '옛이야기 존재가 가게의 쪽지(사실 칸)에 있다');
  }

  // ── 경험치와 돈은 배우는 행동에서만(5.6의 1번), 사고팔기로 불리지 못함 ──
  for (const action of IDLE_ACTIONS) if (xpOfAction(action) !== 0) err('xp-idle', `경험치 ${action}`, '꾸미기·가게·걷기·사진관의 경험치는 0이다');
  for (const item of [...four.gear.filter((g) => g.price), ...four.outfits]) {
    const price = (item as { price: Purse }).price;
    const bought = worth(price);
    if (resale(price, bought + 50) > bought) err('resale', `값 ${item.id}`, '산 값보다 비싸게 되팔 수 있다');
  }
  return issues;
}
