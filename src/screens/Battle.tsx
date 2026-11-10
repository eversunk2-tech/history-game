// 겨루기 화면(spec 4.5, 8.1~8.3, 11.1 가 9·13): 대화 장면의 무대를 빌린다 — 화면 가득 배경, 가운데에 고비, 위에 고비의 기운 막대·방패 칸과
// "다음 차례에 고비가 할 일"(그림 표시 + 한 줄), 아래에 내 기운·기세 칸·"함께 하기"(합동 기술)·손패 넷(이번 판에 센 카드는 ★).
// 카드를 내면 무대가 어두워지고 문제 창이 뜬다(src/quiz/QuizWindow — 고르기·OX·순서·짝). 맞으면 힘이 두 배, 틀리면 기본 힘과 풀이 한 줄.
// 규칙은 모두 엔진(engine/battle.ts)이 한다. 이 화면은 엔진의 상태를 그리고 누름을 넘길 뿐이다. 겨루기는 저장하지 않는다(5.8 — 끄면 처음부터).
//
// 지킬 것: 시간 제한·초읽기 없음, 소리 없음, 번쩍임·흔들림 약하게(8.6), 맞음·틀림과 센 카드를 색만으로 보이지 않음(글·○·★·숫자),
// 고비는 사람이 아니다(7.8 — "넘긴다"·"내기에서 이긴다"), 옛이야기 고비에는 「옛이야기」 표시와 정령의 "옛이야기야"가 먼저,
// 정령의 말은 귀퉁이 말풍선(who: 'neuti')만 — 화면 글("~요")은 말풍선으로 띄우지 않는다.
// 큰 고비는 BattleScreen(위쪽 띠 + 무대), 작은 고비는 대화 장면 안에 Battle을 얹는다(Talk.tsx).

import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Figure } from '../art/Figure';
import { PixelIcon, SoilArt } from '../art/PixelArt';
import { Scenery } from '../art/Scenery';
import { getPack } from '../content';
import { speakers, spirit } from '../content/hub';
import {
  affinityOf,
  answer,
  canCombo,
  cardPower,
  chooseCard,
  comesAgain,
  hintSeed,
  previewOf,
  startBattle,
  useCombo,
  useHint,
  type Battle,
  type BattleEvent,
  type ComboKind,
} from '../engine/battle';
import { hintChoice } from '../engine/quiz';
import { subSeed } from '../engine/rng';
import type { Line } from '../engine/types';
import { CARD_KINDS, CARD_KIND_LABELS, type CardKind, type MinorDef, type Question, type SkillCard } from '../engine/types4';
import { QuizWindow } from '../quiz/QuizWindow';
import { askHome, battleKit, episode, finishBoss, saveFailed, situationId, type BattleKit } from '../state/store';
import { useModalKeys } from '../ui/focus';
import { SpiritSay } from '../ui/Spirit';
import { TapGate, nowMs } from '../ui/taps';
import { josa } from '../ui/words';

/** 맞혔을 때의 덧효과(화면 글) */
export const BONUS_WORDS: Record<SkillCard['bonus'], string> = {
  shield: '방패 한 칸 더 깎기',
  heal: '내 기운 채우기',
  weaken: '고비의 다음 일을 약하게',
  momentum: '기세 한 칸 더',
};

type Mode =
  | { kind: 'lines'; lines: Line[]; i: number; then: 'hand' | 'end' | 'wisdom' }
  | { kind: 'hand' }
  | { kind: 'combo' }
  | { kind: 'quiz' }
  | { kind: 'done' };

/** 한 움직임에서 일어난 일을 짧은 글로(위에서부터 차례로). 화면 글이다 */
export function eventWords(b: Battle, events: readonly BattleEvent[]): string[] {
  const out: string[] = [];
  const foe = b.ctx.foe;
  for (const e of events) {
    if (e.t === 'card') {
      const card = b.ctx.cards[e.card];
      const how = e.q === null ? '' : e.right ? '맞혀서 두 배 · ' : '';
      const aff = e.affinity === 'strong' ? ' · ★ 센 카드' : e.affinity === 'weak' ? ' · 약한 카드' : '';
      out.push(`「${card?.name ?? e.card}」 ${how}힘 ${e.dealt}${aff}`);
    } else if (e.t === 'combo') {
      const joint = spirit.joint.find((j) => j.id === e.kind);
      if (e.kind === 'lift') out.push(`「${joint?.name ?? '함께 들기'}」 힘 ${e.dealt}`);
      else {
        // 「느티나무 그늘」: 채운 기운을 같은 줄에. 걷어 낼 방패가 없을 때(1단계 등)도 무엇이 되었는지 한 줄로 알린다
        const heal = events.find((x): x is Extract<BattleEvent, { t: 'heal' }> => x.t === 'heal' && x.who === 'me');
        const lifted = events.some((x) => x.t === 'shield' && x.why === 'shade');
        out.push(`「${joint?.name ?? '느티나무 그늘'}」 ${heal ? `내 기운 +${heal.amount}` : '내 기운은 이미 가득해요'}${lifted ? '' : ' · 걷어 낼 방패가 없어요'}`);
      }
    } else if (e.t === 'foe') {
      const move = foe.moves.find((m) => m.id === e.move);
      const effect =
        e.effect === 'steal-momentum' ? ' · 기세 한 칸을 가져갔어요' : e.effect === 'weaken-next' ? ' · 다음 카드의 힘이 줄어요' : e.effect === 'heal' ? ' · 고비가 기운을 조금 채웠어요' : '';
      // 예고의 말("다음은 씨름이다!")이 아니라 그 차례에 한 일로 적는다(FoeMove.did — 대본 26.3·26.5의 기록 줄)
      out.push(`${move?.did ?? foe.name} — 내 기운 −${e.hit}${e.weakened ? '(약하게 해서 줄었어요)' : ''}${effect}`);
    } else if (e.t === 'shield') {
      if (e.why === 'fade' && foe.fade) out.push(foe.fade);
      else if (e.to < e.from && e.why !== 'phase') out.push(`방패 ${e.from - e.to}칸이 깎였어요(남은 방패 ${e.to})`);
    } else if (e.t === 'heal' && e.who === 'me' && !events.some((x) => x.t === 'combo' && x.kind === 'shade')) out.push(`내 기운 +${e.amount}`);
  }
  return out;
}

/**
 * 귀띔을 쓸 수 있는가: 남은 귀띔이 있고 지울 고를 것이 있을 때(hintChoice !== null — 고를 것이 셋 이상인 고르기 문제).
 * 귀띔 단추와 정령의 권함 줄("귀띔이 필요하면 나를 눌러…")이 이 하나를 같이 쓴다(㉡ Review 권고 ㅇ, ㉢ Review 고쳐야 함 나)
 */
export function hintOpen(b: Battle, q: Question, gone: readonly number[]): boolean {
  return b.hints > 0 && hintChoice(q, hintSeed(b), gone) !== null;
}

/** 다시 나올 차례가 남았을 때만 붙이는 한 줄(작은 고비는 3차례라 둘째 차례부터는 다시 나오지 않는다 — engine comesAgain) */
export const AGAIN_WORDS = '이 문제는 두 차례 뒤에 다시 나와요';

/** 문제 창에서 틀렸을 때의 한 줄: 카드면 나가는 힘, 다시 나올 차례가 남았으면 그 말(늘 참인 말만) */
export function wrongNote(b: Battle): string | undefined {
  const p = b.pending;
  if (!p) return undefined;
  const again = comesAgain(b) ? AGAIN_WORDS : '';
  if (p.kind === 'wisdom') return again || undefined;
  return [`나가는 힘 ${cardPower(b, p.card, false)}`, again].filter(Boolean).join(' · ');
}

function Bar({ now, max, label, kind }: { now: number; max: number; label: string; kind: 'foe' | 'me' }): JSX.Element {
  const ratio = max > 0 ? Math.max(0, Math.min(1, now / max)) : 0;
  return (
    <div class={`hp hp-${kind}`} role="img" aria-label={`${label} ${now} / ${max}`}>
      <span class="hp-label">
        {label} <b>{now}</b>/{max}
      </span>
      <span class="hp-bar" aria-hidden="true">
        <span class="hp-fill" style={{ width: `${ratio * 100}%` }} />
      </span>
    </div>
  );
}

/** 말 한 창: 정령이면 귀퉁이 말풍선, 그 밖에는 아래의 대화창(이름표). 누르면 넘어간다 */
function LineBox({ line, onNext, names }: { line: Line; onNext: (ev: Event) => void; names: (who: string) => string }): JSX.Element {
  if (line.who === 'neuti') return <SpiritSay text={line.text} pose={line.pose ?? 'plain'} next="다음 ▼" onNext={onNext} where="left" />;
  return (
    <button type="button" class={`talk-box battle-box${line.who ? ' says' : ''}`} data-autofocus onClick={(ev) => onNext(ev)}>
      {line.who && <span class="talk-name">{names(line.who)}</span>}
      <span class="talk-text" aria-live="polite">
        {line.text}
      </span>
      <span class="talk-next" aria-hidden="true">
        다음 ▼
      </span>
    </button>
  );
}

export interface BattleProps {
  target: 'boss' | MinorDef;
  kit: BattleKit;
  /** 처음 하는 겨루기면 여는 말 다음에 정령이 세 걸음으로 알린다(예고를 본다 → 카드를 낸다 → 문제를 푼다) */
  guide?: boolean;
  /** 여는 말 앞에 얹는 정령의 말(현장의 말풍선 — 「굳은 논흙」 앞의 soilBefore) */
  intro?: Line[];
  /** 구해 줌·마무리로 끝났을 때 끝의 말 뒤에 얹는 말(넘긴 뒤의 말에는 이미 정령의 말이 있다 — soilAfter) */
  outro?: Line[];
  /** 끝의 말(넘긴 뒤·구해 준 뒤·해거름)을 다 보인 뒤 */
  onEnd: (b: Battle) => void;
}

export function BattleView({ target, kit, guide = false, intro = [], outro = [], onEnd }: BattleProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const [b, setB] = useState<Battle>(() => startBattle(kit.setup));
  // 이 겨루기에 귀띔이 있었는가(없던 겨루기에서 "다 썼어"라고 하지 않게 — 작은 고비는 지혜 몫만)
  const [hintsAtStart] = useState(() => b.hints);
  const foe = b.ctx.foe;
  const story = situationId.value ?? 's1395';
  const people = getPack(story)?.situation.people ?? {};
  const names = (who: string): string => speakers[who] ?? people[who]?.label ?? who;
  const [mode, setMode] = useState<Mode>(() => ({ kind: 'lines', lines: [...intro, ...foe.opening, ...(guide ? spirit.guide : [])], i: 0, then: 'hand' }));
  const [gone, setGone] = useState<number[]>([]);
  const [hintLine, setHintLine] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [hits, setHits] = useState(0);
  const [bump, setBump] = useState(0);
  const gate = useRef<TapGate | null>(null);
  if (!gate.current) gate.current = new TapGate(nowMs());
  const pass = (ev?: Event | null): boolean => Boolean(gate.current?.passTap(ev));
  const questionOf = useMemo(() => new Map<string, Question>(kit.questions.map((q) => [q.id, q])), [kit]);
  const boss = target === 'boss';
  const preview = previewOf(b);
  // 예고 칸의 "★ 이번 판에 센 카드": 그 차례의 센 갈래(도깨비의 판), 없으면 그 고비에 늘 센 갈래(굳은 논흙의 솜씨·힘 — 큰 고비와 같은 꼴, 권고 ㅌ)
  const strongKinds: CardKind[] = preview?.move.strong ? [preview.move.strong] : foe.strong.filter((one): one is CardKind => (CARD_KINDS as readonly string[]).includes(one));
  const pendingQ = b.pending?.q ? questionOf.get(b.pending.q) : undefined;

  /** 엔진의 움직임 하나를 마친 뒤: 일어난 일을 적고 다음에 보일 것을 정한다 */
  const after = (next: Battle): void => {
    setB(next);
    setGone([]);
    setHintLine(null);
    setLog(eventWords(next, next.events));
    if (next.events.some((e) => e.t === 'card' && e.dealt > 0) || next.events.some((e) => e.t === 'combo' && e.dealt > 0)) setHits((n) => n + 1);
    setBump((n) => n + 1);
    gate.current?.hold(nowMs());
    if (next.end) {
      const lines = next.end === 'win' ? foe.win : [...(next.end === 'rescue' ? foe.rescue : foe.dusk), ...outro];
      setMode({ kind: 'lines', lines, i: 0, then: 'end' });
      return;
    }
    const opened = next.events.find((e) => e.t === 'phase');
    const momentumFull = canCombo(next) && !canCombo(b);
    if (opened && opened.t === 'phase') {
      const lines = [...foe.phaseOpen, ...(opened.wisdom > 0 ? foe.wisdom : [])];
      setMode({ kind: 'lines', lines, i: 0, then: next.pending ? 'wisdom' : 'hand' });
      return;
    }
    if (next.pending) {
      setMode({ kind: 'quiz' });
      return;
    }
    if (momentumFull) setHintLine(spirit.momentum);
    setMode({ kind: 'hand' });
  };

  const advanceLines = (ev?: Event | null): void => {
    if (mode.kind !== 'lines' || !pass(ev)) return;
    if (mode.i < mode.lines.length - 1) {
      setMode({ ...mode, i: mode.i + 1 });
      return;
    }
    if (mode.then === 'end') {
      setMode({ kind: 'done' });
      onEnd(b);
    } else if (mode.then === 'wisdom' && b.pending) setMode({ kind: 'quiz' });
    else setMode({ kind: 'hand' });
  };

  const play = (cardId: string, ev?: Event | null): void => {
    if (mode.kind !== 'hand' || !pass(ev)) return;
    const chosen = chooseCard(b, cardId, kit.ask);
    setLog([]);
    const asked = chosen.pending?.q ? questionOf.get(chosen.pending.q) : undefined;
    if (asked) {
      setB(chosen);
      setGone([]);
      // 귀띔을 권하는 말은 귀띔 단추와 같은 조건일 때만(지울 고를 것이 있을 때 — OX·순서·짝·고를 것 둘에는 띄우지 않는다)
      setHintLine(hintOpen(chosen, asked, []) ? spirit.hint.offer : null);
      setMode({ kind: 'quiz' });
    } else {
      // 낼 문제가 없으면(은행이 빈 때) 문제 없이 기본 힘으로 나간다(엔진의 약속 — q가 null)
      after(answer(chosen, false, kit.ask));
    }
  };

  const combo = (kind: ComboKind, ev?: Event | null): void => {
    if (mode.kind !== 'combo' || !pass(ev)) return;
    const joint = spirit.joint.find((j) => j.id === kind);
    const next = useCombo(b, kind, kit.ask);
    after(next);
    if (joint && !next.end) setHintLine(joint.say.who === 'neuti' ? joint.say.text : null);
    if (joint && joint.say.who !== 'neuti') setLog((rows) => [joint.say.text, ...rows]);
  };

  const onAnswered = (right: boolean): void => {
    if (!b.pending) return;
    after(answer(b, right, kit.ask));
  };

  const hint = (): void => {
    if (!pendingQ || b.hints <= 0) return;
    const at = hintChoice(pendingQ, hintSeed(b), gone);
    if (at === null) return;
    setB(useHint(b));
    setGone([...gone, at]);
    setHintLine(spirit.hint.used);
  };

  useModalKeys(rootRef, (ev) => {
    if (mode.kind === 'lines' && (ev.key === 'Enter' || ev.key === ' ')) {
      ev.preventDefault();
      advanceLines(ev);
    } else if (mode.kind === 'hand' && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight')) {
      ev.preventDefault();
      const items = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('button.hand-card:not([disabled])') ?? []);
      if (items.length === 0) return;
      const at = items.indexOf(document.activeElement as HTMLElement);
      const nextAt = ev.key === 'ArrowRight' ? (at + 1) % items.length : (at <= 0 ? items.length : at) - 1;
      items[nextAt].focus();
    } else if (ev.key === 'Escape' && mode.kind === 'combo') setMode({ kind: 'hand' });
  });

  // 모습이 바뀌면 초점을 그 모습의 첫 것으로(손패면 센 카드부터)
  useEffect(() => {
    const root = rootRef.current;
    if (!root || mode.kind === 'quiz') return;
    const first =
      mode.kind === 'hand'
        ? (root.querySelector<HTMLElement>('button.hand-card.strong:not([disabled])') ?? root.querySelector<HTMLElement>('button.hand-card:not([disabled])'))
        : root.querySelector<HTMLElement>('[data-autofocus]');
    first?.focus({ preventScroll: true });
  }, [mode.kind, mode.kind === 'lines' ? mode.i : 0, bump]);

  const line = mode.kind === 'lines' ? mode.lines[Math.min(mode.i, mode.lines.length - 1)] : null;
  const won = b.end === 'win' || (mode.kind === 'lines' && mode.then === 'end');
  const shieldMax = foe.shield;
  const wisdomTotal = b.asked.filter((a) => !a.card).length + b.wisdomLeft.length;
  const wisdomAt = b.asked.filter((a) => !a.card).length + 1;
  const cardOf = (id: string): SkillCard | undefined => b.ctx.cards[id];
  const fullCombo = canCombo(b);
  // 정령의 말풍선이 왼쪽에 떠 있는가(귀띔·기세·그늘의 한 줄, 또는 여는 말·끝의 말 가운데 정령의 창) — 떠 있으면 기록 줄이 비켜 선다
  const spiritOn = (Boolean(hintLine) && mode.kind !== 'lines' && mode.kind !== 'quiz') || (mode.kind === 'lines' && line?.who === 'neuti');

  return (
    <div class={`battle${boss ? ' boss dusk' : ' minor'} mode-${mode.kind}${spiritOn ? ' spirit-on' : ''}`} ref={rootRef} role="region" aria-label={`겨루기: ${foe.name}`}>
      <div class="battle-art" aria-hidden="true">
        <Scenery story={story} place={boss ? 'entrance' : 'paddy'} season="spring" />
        {boss && <div class="battle-dusk" />}
      </div>

      {/* 위: 고비의 이름·옛이야기 표시·단계·방패·기운 */}
      <header class="foe-band">
        <div class="foe-name-row">
          <span class="foe-name">{foe.name}</span>
          {foe.tale && (
            <span class="tale-mark" role="note">
              <span aria-hidden="true">❖ </span>옛이야기
            </span>
          )}
          {foe.phases > 1 && <span class="foe-phase">{b.phase}단계</span>}
          {shieldMax > 0 && b.phase > 1 && (
            <span class="shield-row" role="img" aria-label={`방패(도깨비불) ${b.shield}칸`}>
              방패
              {Array.from({ length: shieldMax }, (_, k) => (
                <PixelIcon key={k} name={k < b.shield ? 'wisp-on' : 'wisp-off'} size={30} />
              ))}
              <b>{b.shield}칸</b>
            </span>
          )}
        </div>
        <Bar now={b.foeHp} max={b.foeMax} label="기운" kind="foe" />
      </header>

      {/* 예고: 다음 차례에 고비가 할 일 */}
      {preview && mode.kind !== 'done' && (
        <aside class="intent" aria-label="다음 차례에 고비가 할 일">
          <p class="intent-head">다음 차례에 {josa(foe.name.replace(/의 내기$/, ''), '이', '가')} 할 일</p>
          <p class="intent-line">
            <PixelIcon name={preview.move.icon} size={36} />
            <span>
              「{preview.move.line}」 — 기운 {preview.hit}
            </span>
          </p>
          {strongKinds.length > 0 && (
            <p class="intent-strong">
              ★ 이번 판에 센 카드:
              {strongKinds.map((kind, k) => (
                <span key={kind} class="intent-kind">
                  {k > 0 && '·'}
                  <PixelIcon name={`kind-${kind}`} size={20} />
                  {CARD_KIND_LABELS[kind]}
                </span>
              ))}
            </p>
          )}
        </aside>
      )}

      {/* 가운데: 고비 */}
      <div class={`foe-figure${won && b.end === 'win' ? ' leaving' : ''}`} key={`foe-${bump}`}>
        {boss ? (
          <Figure story={story} pic="dokkaebi" sprite="dokkaebi" pose={mode.kind === 'lines' && line?.who === 'dokkaebi' && line.pose === 'glad' ? 'glad' : b.end ? 'glad' : 'plain'} fill={0.86} label="도깨비" />
        ) : (
          <SoilArt left={b.foeHp / b.foeMax} hits={hits} label="굳은 논흙" />
        )}
      </div>

      {/* 방금 일어난 일 */}
      {log.length > 0 && mode.kind !== 'quiz' && (
        <ul class="battle-log" role="status" key={`log-${bump}`}>
          {log.map((row, k) => (
            <li key={k}>{row}</li>
          ))}
        </ul>
      )}

      {/* 정령의 한 줄(귀띔·기세·그늘). 떠 있으면 기록 줄이 오른쪽으로 비켜 선다(spirit-on — 말풍선이 기록 줄을 덮지 않게) */}
      {hintLine && mode.kind !== 'lines' && mode.kind !== 'quiz' && <SpiritSay text={hintLine} where="left" />}

      {/* 아래: 내 기운·기세·함께 하기·손패 */}
      {mode.kind !== 'lines' && mode.kind !== 'done' && (
        <section class="me-band" aria-label="내 차례">
          <div class="me-row">
            <Bar now={b.me} max={b.meMax} label="내 기운" kind="me" />
            <span class="momentum" role="img" aria-label={`기세 ${b.momentum} / ${b.ctx.full}`}>
              기세
              {Array.from({ length: b.ctx.full }, (_, k) => (
                <span key={k} class={`pip${k < b.momentum ? ' on' : ''}`} aria-hidden="true">
                  {k < b.momentum ? '●' : '○'}
                </span>
              ))}
            </span>
            <span class="deck-left">
              {b.turn + 1}차례 · 남은 덱 {b.pile.length}장
            </span>
            <button type="button" class={`btn together${fullCombo ? ' ready' : ''}`} disabled={!fullCombo || mode.kind !== 'hand'} onClick={(ev) => pass(ev) && setMode({ kind: 'combo' })}>
              함께 하기{fullCombo ? ' ▶' : ''}
            </button>
          </div>
          {mode.kind === 'combo' ? (
            <div class="combo-pick" role="group" aria-label="함께 하기 — 문제 없이 쓰는 기술">
              {spirit.joint.map((j) => (
                <button key={j.id} type="button" class="combo-card" data-autofocus={j.id === 'shade' ? true : undefined} onClick={(ev) => combo(j.id, ev)}>
                  <span class="combo-name">「{j.name}」</span>
                  <span class="combo-text">{j.text}</span>
                </button>
              ))}
              <button type="button" class="btn small" onClick={(ev) => pass(ev) && setMode({ kind: 'hand' })}>
                손패로 돌아가기
              </button>
            </div>
          ) : (
            <ul class="hand" aria-label="손패 — 카드를 하나 골라 내요">
              {b.hand.map((id) => {
                const card = cardOf(id);
                if (!card) return null;
                const aff = affinityOf(b, id);
                const frozen = b.frozen === id;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      class={`hand-card kind-${card.kind}${aff === 'strong' ? ' strong' : aff === 'weak' ? ' weak' : ''}`}
                      disabled={frozen || mode.kind !== 'hand'}
                      onClick={(ev) => play(id, ev)}
                    >
                      <span class="hand-top">
                        <span class="card-kind">
                          <PixelIcon name={`kind-${card.kind}`} size={22} />
                          {CARD_KIND_LABELS[card.kind]}
                        </span>
                        {aff === 'strong' && <span class="card-strong">★ 이번 판에 세다</span>}
                        {aff === 'weak' && <span class="card-weak">약함</span>}
                      </span>
                      <span class="hand-name">
                        <PixelIcon name={card.id} size={40} />
                        <span>{card.name}</span>
                      </span>
                      <span class="hand-power">
                        힘 {cardPower(b, id, false)} · 맞히면 {cardPower(b, id, true)}
                      </span>
                      <span class="hand-bonus">맞히면: {BONUS_WORDS[card.bonus]}</span>
                      {frozen && <span class="card-weak">얼어서 이번 차례에는 못 내요</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* 여는 말·단계의 말·끝의 말 */}
      {mode.kind === 'lines' && line && <LineBox line={line} onNext={advanceLines} names={names} />}

      {/* 문제 창 */}
      {mode.kind === 'quiz' && pendingQ && b.pending && (
        <QuizWindow
          key={`${pendingQ.id}:${b.asked.length}:${b.turn}`}
          q={pendingQ}
          seed={subSeed(b.seed, `q:${pendingQ.id}:${b.asked.length}`)}
          head={
            b.pending.kind === 'wisdom' ? (
              <span class="quiz-tag">
                지혜 겨루기 {wisdomAt}/{wisdomTotal} · 맞히면 방패 한 칸이 깎여요
              </span>
            ) : (
              <span class="quiz-tag">
                <PixelIcon name={b.pending.card} size={28} />「{cardOf(b.pending.card)?.name}」{b.pending.again ? ' · 다시 나온 문제' : ''} · 맞히면 힘 {cardPower(b, b.pending.card, true)} · 틀려도 힘 {cardPower(b, b.pending.card, false)}
              </span>
            )
          }
          gone={gone}
          hint={hintOpen(b, pendingQ, gone) ? { label: `정령의 귀띔(${b.hints}번 남음)`, onUse: hint } : null}
          spirit={hintLine ?? (hintsAtStart > 0 && b.hints <= 0 && pendingQ.form === 'pick' ? spirit.hint.none : null)}
          rightNote={b.pending.kind === 'wisdom' ? (b.shield > 0 ? '방패 한 칸이 깎여요' : undefined) : `맞혀서 나가는 힘 ${cardPower(b, b.pending.card, true)}${b.shield > 0 ? ' · 방패 한 칸도 깎여요' : ''}`}
          wrongNote={wrongNote(b)}
          onDone={onAnswered}
        />
      )}
      {saveFailed.value && boss && <p class="battle-note">기록을 남기지 못했어요.</p>}
    </div>
  );
}

/** 큰 고비의 화면: 위쪽 띠(에피소드 · 큰 고비 · 처음으로) + 무대 */
export function BattleScreen(): JSX.Element | null {
  const ep = episode.value;
  const kit = useMemo(() => battleKit('boss'), []);
  if (!ep || !kit) return null;
  return (
    <main class="screen battle-screen season-spring">
      <header class="band battle-band">
        <div class="band-row">
          <span class="battle-title">
            「{ep.title}」 · 큰 고비
          </span>
          <button type="button" class="band-btn quiet" onClick={askHome}>
            처음으로
          </button>
        </div>
      </header>
      <div class="battle-stage">
        <BattleView target="boss" kit={kit} onEnd={finishBoss} />
      </div>
    </main>
  );
}
