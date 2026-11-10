// 대화 장면(미연시 구도) — 맵의 무대 위에 얹힌다. 위쪽 띠는 맵 화면의 것이 그대로 보인다.
// 승인된 시안(docs/mockup-vn/)의 구도: 화면 가득 배경, 만난 사람이 서고(두 명까지), 아래 너비 가득 어두운 반투명 대화창.
//
// 차례(spec 9.3):
//   여는 대화(한 창씩) → 선택지 → (일 놀이) → 일을 마친다(commitTalk) → 결과 대화 → 수치 변화 → 배움 쪽지와 새 카드 → 맵으로.
// 일을 마치기 전에는(여는 대화, 선택지) "나중에 할게요"로 맵으로 돌아갈 수 있다 — 아무 일도 일어나지 않은 것이다.
// 창 어디를 눌러도, Enter·Space로도 넘어간다. 글이 한 자씩 찍히는 효과는 없다.
//
// 선택지가 뜨면 선 사람이 비켜선다(시안의 둘째 화면): 한 사람이면 왼쪽으로 물러나고 선택지가 오른쪽에,
// 두 사람이면 양옆으로 물러나고 선택지가 가운데에 놓인다. 선택지가 몇 줄이 되든 얼굴을 가리지 않는다(자리는 talk.css).
// 이 일로 미션이 풀리면 배움 쪽지 다음에 "미션이 풀림" 종이가 뜬다 — 쪽지의 글은 여기서 한 번만 읽고, 종이는 되풀이하지 않는다.
//
// 잠긴 선택지(형편이나 제도가 막은 일)는 점선 테·자물쇠·흐린 글에 흐리지 않은 까닭 한 줄로 보인다. 고를 수 없다.
// 선택지가 모두 잠겨 있으면 막다른 길이 아니라는 것을 알린다: 엔진이 그 미션의 도움의 일을 맵에 열어 두었으므로,
// "나중에 할게요"로 돌아가 그 자리로 가라고 대화창이 말해 준다(그 자리의 이름과 함께).

import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Figure } from '../art/Figure';
import type { Pose } from '../art/pictures';
import { Scenery } from '../art/Scenery';
import { standInSprite } from '../art/standIn';
import { cardById } from '../content/cards';
import { itemById } from '../content/items';
import { statLabels } from '../content/labels';
import {
  choiceViews,
  currentSeason,
  factsOf,
  happeningOf,
  missionOfHappening,
  openHappenings,
  openingLines,
  type ChoiceView,
  type HappeningView,
} from '../engine/game';
import { STATS, type Deed, type GameState, type Happening, type Line, type Mission, type Person, type Season, type SituationPack } from '../engine/types';
import { PLAYS } from '../plays';
import { s1395_1Lines } from '../content/episodes/s1395-lines';
import { battleKit, closeTalk, commitTalk, episode, finishMinor, game, minorPending, pack, save } from '../state/store';
import { BattleView } from './Battle';
import { focusInto, useModalKeys } from '../ui/focus';
import { READ_GAP_MS, TapGate, nowMs, tapTime } from '../ui/taps';
import { LockIcon, SunIcon } from '../ui/icons';
import { spotLabel } from '../ui/where';
import { changeWords, josa, ro, type ChangeWords } from '../ui/words';

interface Snap {
  story: string;
  season: Season;
  happening: Happening;
  opening: Line[];
  choices: ChoiceView[];
  mission?: Mission;
  people: Record<string, Person>;
  /** 지금은 이 일을 할 수 없는 까닭(해 ☀가 없음). 있으면 그 말만 보여 주고 닫는다. */
  blocked: string | null;
  /** 선택지가 모두 잠겼을 때 보여 줄 말(도움의 길이 열린 자리를 알려 준다). 고를 것이 하나라도 있으면 null. */
  stuck: string | null;
}

/** 선택지가 모두 잠겼을 때의 말: 도움의 일이 맵에 열려 있으면 그 자리를 알려 준다 */
function stuckLine(p: SituationPack, g: GameState, choices: readonly ChoiceView[], mission: Mission | undefined, open: readonly HappeningView[]): string | null {
  if (choices.length === 0 || choices.some((view) => !view.locked)) return null;
  const rescue = mission?.rescue ? open.find((v) => v.happening.id === mission.rescue) : undefined;
  if (!rescue) return '지금 형편으로는 고를 수 있는 것이 없어요. 돌아가서 다른 일부터 해 보아요.';
  const where = spotLabel(p, g.role, rescue.happening.spot);
  return where
    ? `지금 형편으로는 고를 수 있는 것이 없어요. 그래도 길이 있어요. 돌아가서 ${ro(where)} 가 보아요.`
    : '지금 형편으로는 고를 수 있는 것이 없어요. 그래도 길이 있어요. 돌아가서 맵의 깃발을 찾아가 보아요.';
}

/** 대화 장면이 열릴 때의 모습을 적어 둔다(일을 마치면 판이 바뀌므로 그 전의 것을 쥐고 있는다) */
function snapOf(p: SituationPack, g: GameState, id: string): Snap | null {
  try {
    const happening = happeningOf(p, id);
    const open = openHappenings(p, g);
    const view = open.find((v) => v.happening.id === id);
    const choices = choiceViews(p, g, id);
    const mission = view?.mission ?? missionOfHappening(p, g.role, id);
    const blocked = !view
      ? '이 일은 지금 할 수 없어요.'
      : view.noSun
        ? '해 ☀가 남아 있지 않아요. 덤으로 하는 일은 해가 있어야 할 수 있어요.'
        : null;
    return {
      story: p.situation.id,
      season: currentSeason(g),
      happening,
      opening: openingLines(p, g, id),
      choices,
      mission,
      people: p.situation.people ?? {},
      blocked,
      stuck: stuckLine(p, g, choices, mission, open),
    };
  } catch (error) {
    console.error('[조선에서 한 해 살기] 대화 장면을 열 수 없다:', error);
    return null;
  }
}

export type Step =
  | { kind: 'blocked' }
  | { kind: 'open'; i: number }
  | { kind: 'choose' }
  /** 4판: 그 일의 놀이 앞에서 먼저 넘길 짧은 겨루기(작은 고비 — 「굳은 논흙」) */
  | { kind: 'minor'; choiceId?: string }
  | { kind: 'play'; choiceId?: string }
  | { kind: 'result'; i: number }
  | { kind: 'change' }
  | { kind: 'note' };

type Side = 'left' | 'center' | 'right';

/**
 * 선 사람들의 자리. 한 사람이면 가운데(자료에 적힌 자리가 있으면 그 자리), 두 사람이면 왼쪽과 오른쪽에 하나씩 선다
 * (자료가 둘을 같은 쪽에 적었어도 겹쳐 세우지 않는다).
 */
function sidesOf(cast: readonly { who: string; at?: Side }[]): Side[] {
  if (cast.length < 2) return cast.map((member) => member.at ?? 'center');
  const flipped = cast[0].at === 'right' || (cast[0].at !== 'left' && cast[1].at === 'left');
  return flipped ? ['right', 'left'] : ['left', 'right'];
}

/**
 * 지금 단계에서 대화창에 보이는 줄 묶음과 그 안의 자리.
 * 결과 대화의 창이면 결과의 줄, 그 밖에는 여는 대화의 줄이다. 선택지를 고르는 동안에는 여는 대화의 마지막 줄이 남는다.
 * 줄이 보이지 않는 단계("달라진 것", 일 놀이, 쪽지)는 -1이다.
 */
export function windowOf(step: Step, opening: Line[], result: Line[] | null): { lines: Line[]; at: number } {
  const lines = step.kind === 'result' && result ? result : opening;
  const at = step.kind === 'open' || step.kind === 'result' ? step.i : step.kind === 'choose' ? opening.length - 1 : -1;
  return { lines, at };
}

/**
 * 무대에 선 사람의 표정: 그 줄 묶음에서 그 사람이 가장 최근에 지은 표정(말한 창에 적힌 것).
 * 아직 지은 표정이 없으면(그 사람이 말하기 전의 창, 결과 대화의 첫머리, "달라진 것" 창) 무대에 적힌 기본 표정을, 그것도 없으면 plain을 쓴다.
 * (Review 1-라 11.8 ①: 굶는 동무가 첫 창과 "달라진 것" 창에서 plain — 웃는 얼굴 — 으로 섰다.)
 */
export function poseOf(member: { who: string; pose?: Pose }, lines: readonly Line[], upto: number): Pose {
  for (let i = Math.min(upto, lines.length - 1); i >= 0; i--) {
    const line = lines[i];
    if (line.who === member.who && line.pose) return line.pose;
  }
  return member.pose ?? 'plain';
}

/**
 * 대화 장면이 이 누름을 받지 않는가: 잇달아 누른 것과 새 창이 뜬 바로 뒤의 누름. 처리한 때가 아니라 누른 때(사건의 timeStamp)로 잰다
 * — 느린 기기에서 늦게 처리된 누름도 창이 뜨기 전에 누른 것이면 받지 않는다(ui/taps.ts, 1-라 11.8 ②). 받으면 그 때를 문에 적는다.
 */
export function tooSoonFor(gate: TapGate, ev?: { timeStamp?: number } | null): boolean {
  return !gate.passTap(ev);
}

/**
 * 대화 장면의 꼴(class): 계절, 단계, 무대에 선 사람의 수(일 놀이와 쪽지에서는 0). 무대가 비켜 설 쪽(clear-left/right)은
 * 자료에 stage.clear를 적은 장면(겨울 제삿날 첫 창 — 쌀독이 보이게, 1-라 11.8 ⑤)에만 붙는다.
 */
export function talkClass(happening: Happening, season: Season, step: Step['kind'], figures: boolean): string {
  const cast = (happening.stage.cast ?? []).slice(0, 2).length;
  return `talk season-${season} step-${step} cast-${figures ? cast : 0}${happening.stage.clear ? ` clear-${happening.stage.clear}` : ''}`;
}

function changeRows(deed: Deed): ChangeWords[] {
  return STATS.map((stat) => changeWords(stat, deed.requested[stat], deed.delta[stat], deed.before[stat], deed.after[stat])).filter(
    (row): row is ChangeWords => row !== null,
  );
}

export function Talk({ happeningId }: { happeningId: string }): JSX.Element | null {
  const rootRef = useRef<HTMLDivElement>(null);
  const [snap] = useState<Snap | null>(() => {
    const p = pack.value;
    const g = game.value;
    return p && g ? snapOf(p, g, happeningId) : null;
  });
  const [step, setStep] = useState<Step>(() => {
    if (!snap) return { kind: 'blocked' };
    if (snap.blocked) return { kind: 'blocked' };
    if (snap.opening.length > 0) return { kind: 'open', i: 0 };
    return snap.choices.length > 0 ? { kind: 'choose' } : { kind: 'open', i: 0 };
  });
  const [deed, setDeed] = useState<Deed | null>(null);
  // 잇달아 누른 것을 한 번으로 친다(두 번 두드려 한 창을 읽지 못하고 넘기는 일을 막는다). 뜬 바로 뒤에는 조금 더 기다린다.
  // 누름은 누른 때(사건의 timeStamp)로 잰다 — ui/taps.ts
  const gate = useRef<TapGate | null>(null);
  if (!gate.current) gate.current = new TapGate(nowMs());
  const committed = useRef(false);

  const tooSoon = (ev?: Event | null): boolean => tooSoonFor(gate.current as TapGate, ev);

  /** 일을 마치고 나온 결과에서 다음에 보여 줄 것 */
  const afterResult = (d: Deed): Step | null => {
    if (changeRows(d).length > 0 || d.sun > 0) return { kind: 'change' };
    return afterChange(d);
  };
  const afterChange = (d: Deed): Step | null => (d.note.trim() !== '' || d.newCards.length > 0 || d.newItems.length > 0 ? { kind: 'note' } : null);

  const noteShownAt = useRef(0);
  const go = (next: Step | null): void => {
    if (next?.kind === 'note') noteShownAt.current = nowMs();
    if (next) setStep(next);
    else closeTalk();
  };
  /** 배움 쪽지는 뜬 바로 뒤에 닫히지 않는다(잇달아 누르다 읽지 못하고 넘기는 일을 막는다) */
  const closeNote = (ev?: Event | null): void => {
    if (tapTime(ev) - noteShownAt.current < READ_GAP_MS) return;
    closeTalk();
  };

  /** 고른 선택지와 놀이의 끝난 모습을 넘겨 일을 마친다(afterPlay: 일 놀이를 끝내고 왔다) */
  const commit = (choiceId?: string, played?: string, afterPlay = false): void => {
    if (committed.current) return;
    committed.current = true;
    const done = commitTalk({ id: happeningId, choiceId, play: played });
    if (!done) return; // 가게가 '이어 갈 수 없어요'로 보낸다
    // 결과의 첫 창이 새로 뜬다: 놀이를 끝낸 그 누름(자판 Enter, 잇달아 두 번·세 번 누른 끝내기 단추)이 그 창을 넘기지 않게.
    // 놀이 뒤의 첫 창은 읽을 틈(READ_GAP_MS)만큼, 그 밖에는 새 창의 틈만큼 막고, 놀이 뒤면 그 창이 뜬 때 한 번 더 막는다(문이 맡는다 — ui/taps.ts)
    gate.current?.done(nowMs(), afterPlay);
    setDeed(done);
    go(done.lines.length > 0 ? { kind: 'result', i: 0 } : afterResult(done));
  };

  // 놀이 뒤의 첫 창이 화면에 뜬 때부터 다시 읽을 틈을 막는다(느린 기기에서 창이 늦게 뜨면 그만큼 늦게 받는다 — 문의 shown)
  useEffect(() => {
    if (step.kind !== 'play') gate.current?.shown(nowMs());
  }, [step]);

  /** 선택이 끝난 뒤: 그 일에 짧은 겨루기(작은 고비)가 남았으면 먼저, 그다음 일 놀이가 있으면 놀이로, 없으면 바로 마친다 */
  const afterChoice = (choiceId?: string, minorDone = false): void => {
    if (!minorDone && minorPending(happeningId)) {
      setStep({ kind: 'minor', choiceId });
      return;
    }
    const play = snap?.happening.play;
    if (play && PLAYS[play.game]) {
      setStep({ kind: 'play', choiceId });
      return;
    }
    // 모르는 놀이면 첫 결과로 넘어간다
    commit(choiceId, play ? Object.keys(play.flags)[0] : undefined);
  };

  const advance = (ev?: Event | null): void => {
    if (!snap) return;
    // 선택지가 모두 잠겨 있으면 대화창이 "돌아가기"가 된다(아무 일도 일어나지 않은 채 맵으로)
    const stuckNow = step.kind === 'choose' && snap.stuck !== null && !committed.current;
    if (step.kind !== 'blocked' && step.kind !== 'open' && step.kind !== 'result' && step.kind !== 'change' && !stuckNow) return;
    if (tooSoon(ev)) return;
    if (step.kind === 'blocked' || stuckNow) {
      closeTalk();
    } else if (step.kind === 'open') {
      if (step.i < snap.opening.length - 1) setStep({ kind: 'open', i: step.i + 1 });
      else if (snap.choices.length > 0) setStep({ kind: 'choose' });
      else afterChoice(undefined);
    } else if (step.kind === 'result') {
      if (!deed) return;
      if (step.i < deed.lines.length - 1) setStep({ kind: 'result', i: step.i + 1 });
      else go(afterResult(deed));
    } else if (deed) {
      go(afterChange(deed));
    }
  };

  const choose = (view: ChoiceView, ev?: Event | null): void => {
    if (view.locked || step.kind !== 'choose' || tooSoon(ev)) return;
    afterChoice(view.id);
  };

  /** "나중에 할게요": 일을 마치기 전이면 아무 일도 일어나지 않은 채 맵으로 돌아간다 */
  const canLeave = !committed.current && (step.kind === 'open' || step.kind === 'choose');
  const later = (ev?: Event | null): void => {
    if (!canLeave || tooSoon(ev)) return;
    closeTalk();
  };

  useModalKeys(rootRef, (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      // 선택지 묶음에 초점이 있을 때(선택지가 뜬 바로 뒤): 첫 선택지로 초점을 옮길 뿐 고르지는 않는다
      // (Enter를 잇달아 누르다 저절로 골라지지 않게 — 고르는 것은 그다음 Enter다)
      const list = rootRef.current?.querySelector<HTMLElement>('.talk-choices');
      if (step.kind === 'choose' && list && document.activeElement === list) {
        rootRef.current?.querySelector<HTMLElement>('button.talk-choice')?.focus();
        return;
      }
      advance(ev);
    } else if (step.kind === 'choose' && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) {
      // 화살표로 선택지를 오간다(PC와 TV). 고르는 것은 Enter·Space다.
      ev.preventDefault();
      const items = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('button.talk-choice') ?? []);
      if (items.length === 0) return;
      const at = items.indexOf(document.activeElement as HTMLElement);
      const next = ev.key === 'ArrowDown' ? (at + 1) % items.length : (at <= 0 ? items.length : at) - 1;
      items[next].focus();
    } else if (ev.key === 'Escape') {
      if (canLeave) later(ev);
      else if (step.kind === 'blocked') closeTalk();
      else if (step.kind === 'note') closeNote(ev);
    }
  });

  // 단계가 바뀌면 초점을 그 단계의 것(대화창, 첫 선택지, 쪽지의 단추)으로 옮긴다
  useEffect(() => {
    if (rootRef.current) focusInto(rootRef.current);
  }, [step.kind]);

  // 열 수 없는 일이면 조용히 닫는다
  useEffect(() => {
    if (!snap) closeTalk();
  }, [snap]);

  if (!snap) return null;
  const { happening, people } = snap;
  const cast = (happening.stage.cast ?? []).slice(0, 2);
  const sides = sidesOf(cast);
  const g = game.value;

  // 지금 대화창에 보일 한 창
  const { lines, at } = windowOf(step, snap.opening, deed?.lines ?? null);
  const line: Line | null = at >= 0 && at < lines.length ? lines[at] : null;
  const speaker = line?.who;
  const nameOf = (who: string): string => people[who]?.label ?? who;
  // 일 놀이와 쪽지가 뜰 때는 사람을 세우지 않는다(쪽지가 얼굴을 가린다)
  const showsFigures = step.kind !== 'play' && step.kind !== 'note' && step.kind !== 'minor';

  const rows = deed && step.kind === 'change' ? changeRows(deed) : [];
  const play = happening.play;
  const playDef = play ? PLAYS[play.game] : undefined;
  // 고른 일을 마치러 갈 자리(있으면 쪽지에 알려 준다. 맵에서는 화살표가 그리로 옮겨 간다)
  const nextSpot = deed?.goTo && pack.value && g ? spotLabel(pack.value, g.role, deed.goTo) : null;
  const firstOpen = snap.choices.find((view) => !view.locked)?.id;
  const tag = snap.mission ? `${snap.mission.must ? '꼭 할 일' : '덤 미션'} · ${snap.mission.title}` : happening.cost > 0 ? '덤으로 하는 일' : '';

  return (
    <div
      class={talkClass(happening, snap.season, step.kind, showsFigures)}
      role="dialog"
      aria-modal="true"
      aria-label="대화 장면"
      ref={rootRef}
      onClick={(ev) => {
        // 창 어디를 눌러도 넘어간다(단추와 놀이, 쪽지는 저마다 받는다)
        if (ev.target instanceof Element && ev.target.closest('[data-own]')) return;
        advance(ev);
      }}
    >
      <Scenery story={snap.story} place={happening.stage.place} season={snap.season} />
      <div class="talk-shade" />

      {showsFigures && (
        <div class="talk-cast">
          {cast.map((member, index) => {
            const person = people[member.who];
            const where = sides[index];
            const quiet = speaker !== undefined && speaker !== member.who && cast.some((c) => c.who === speaker);
            return (
              <div key={member.who} class={`talk-slot at-${where} age-${person?.age ?? 'adult'}${quiet ? ' quiet' : ''}`}>
                <Figure
                  story={snap.story}
                  pic={person?.pic ?? member.who}
                  sprite={standInSprite(member.who, person)}
                  pose={poseOf(member, lines, at)}
                  fill={0.6}
                  label={nameOf(member.who)}
                />
              </div>
            );
          })}
        </div>
      )}

      {(step.kind === 'choose' || step.kind === 'note') && <div class="talk-dim" />}

      {(step.kind === 'open' || step.kind === 'choose') && (
        <div class="talk-top" data-own>
          {canLeave && (
            <button type="button" class="talk-later" onClick={later}>
              <span aria-hidden="true">← </span>나중에 할게요
            </button>
          )}
          <div class="talk-tags">
            {tag && <span class="talk-tag">{tag}</span>}
            {happening.cost > 0 && (
              <span class="talk-tag sun">
                <SunIcon />해 하나가 져요
              </span>
            )}
          </div>
        </div>
      )}

      {step.kind === 'choose' && snap.stuck === null && (
        // 자판으로 왔을 때만 보이는 한 줄(선택지 묶음에 초점이 있을 때 — talk.css). 손가락·마우스로는 보이지 않는다.
        <p class="talk-keys" aria-hidden="true">
          ↑↓로 고르고 Enter로 정해요
        </p>
      )}
      {step.kind === 'choose' && (
        // 초점은 선택지 묶음에 둔다(첫 선택지에 두면 Enter를 잇달아 누르다 저절로 골라진다). 화살표·Tab·Enter로 첫 선택지에 들어간다.
        <ul
          class={`talk-choices${snap.choices.length >= 4 ? ' many' : ''}`}
          data-own
          data-autofocus={snap.stuck === null ? true : undefined}
          tabIndex={-1}
          aria-label={snap.stuck === null ? '어떻게 할까요? 화살표로 고르고 Enter로 정해요.' : '지금은 고를 수 있는 것이 없어요.'}
        >
          {snap.choices.map((view) => (
            <li key={view.id}>
              {view.locked ? (
                <div class="talk-choice locked" role="group" aria-label={`잠긴 선택지: ${view.label}. ${view.reason ?? ''}`}>
                  <span class="talk-choice-label">
                    <LockIcon />
                    <span>{view.label}</span>
                  </span>
                  <span class="talk-choice-reason">{view.reason}</span>
                </div>
              ) : (
                // Tab의 첫 자리는 첫 선택지다("나중에 할게요"가 아니라 — focus.ts의 data-first-tab)
                <button type="button" class="talk-choice" data-first-tab={view.id === firstOpen ? true : undefined} onClick={(ev) => choose(view, ev)}>
                  <span class="talk-choice-label">{view.label}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {step.kind === 'minor' && <MinorStep happeningId={happeningId} onDone={() => afterChoice(step.choiceId, true)} />}

      {step.kind === 'play' && play && playDef && (
        <div class="talk-play" data-own>
          {g && <playDef.View rules={play.rules} facts={factsOf(g)} choice={step.choiceId} onDone={(result) => commit(step.choiceId, result, true)} />}
        </div>
      )}

      {/* 대화창: 말과 이야기 줄, 선택지를 고르는 동안에는 마지막 줄이 남아 있다 */}
      {(step.kind === 'open' || step.kind === 'result') && line && (
        <button type="button" class={`talk-box${speaker ? ' says' : ''}`} data-autofocus>
          {speaker && <span class="talk-name">{nameOf(speaker)}</span>}
          <span class="talk-text" aria-live="polite">
            {line.text}
          </span>
          <span class="talk-next" aria-hidden="true">
            다음 ▼
          </span>
        </button>
      )}
      {step.kind === 'open' && !line && (
        <button type="button" class="talk-box" data-autofocus>
          <span class="talk-text">…</span>
          <span class="talk-next" aria-hidden="true">
            다음 ▼
          </span>
        </button>
      )}
      {step.kind === 'choose' && snap.stuck === null && (
        <div class={`talk-box still${speaker ? ' says' : ''}`}>
          {speaker && <span class="talk-name">{nameOf(speaker)}</span>}
          <span class="talk-text">{line ? line.text : '어떻게 할까?'}</span>
        </div>
      )}
      {step.kind === 'choose' && snap.stuck !== null && (
        // 선택지가 모두 잠겼다: 막다른 길이 아니라는 것과 갈 곳을 알리고, 누르면 맵으로 돌아간다
        <button type="button" class="talk-box" data-autofocus>
          <span class="talk-text" aria-live="polite">
            {snap.stuck}
          </span>
          <span class="talk-next" aria-hidden="true">
            돌아가기 ▼
          </span>
        </button>
      )}
      {step.kind === 'blocked' && (
        <button type="button" class="talk-box" data-autofocus>
          <span class="talk-text" aria-live="polite">
            {snap.blocked}
          </span>
          <span class="talk-next" aria-hidden="true">
            돌아가기 ▼
          </span>
        </button>
      )}
      {step.kind === 'change' && deed && (
        <button type="button" class="talk-box says" data-autofocus>
          <span class="talk-name">달라진 것</span>
          <span class="talk-changes" aria-live="polite">
            {rows.map((row) => (
              <span key={row.stat} class="talk-change">
                <span class="talk-change-arrow" aria-hidden="true">
                  {row.arrow}
                </span>
                <span class="talk-change-text">{row.text}</span>
                <span class="talk-change-nums">
                  {row.from} → {row.to}
                </span>
              </span>
            ))}
            {rows.length === 0 && deed.sun > 0 && (
              // 해만 지고 수치는 그대로인 덤: 잃기만 한 것처럼 보이지 않게 "그대로"를 글과 기호로 알린다
              <span class="talk-change">
                <span class="talk-change-arrow" aria-hidden="true">
                  ■
                </span>
                <span class="talk-change-text">{josa(STATS.map((stat) => statLabels[stat].label).join('·'), '은', '는')} 그대로예요</span>
              </span>
            )}
            {deed.sun > 0 && g && (
              <span class="talk-change">
                <span class="talk-change-arrow" aria-hidden="true">
                  ▼
                </span>
                <span class="talk-change-text">해 ☀ 하나가 졌어요</span>
                <span class="talk-change-nums">
                  {g.sunsLeft + deed.sun} → {g.sunsLeft}
                </span>
              </span>
            )}
          </span>
          <span class="talk-next" aria-hidden="true">
            다음 ▼
          </span>
        </button>
      )}

      {step.kind === 'note' && deed && (
        <div class="talk-note" data-own>
          <div class="paper note-paper">
            {deed.note.trim() !== '' && (
              <section class="note-main">
                <h2 class="paper-kicker">배움 쪽지</h2>
                <p class="note-text">{deed.note}</p>
              </section>
            )}
            {deed.newCards.map((id) => {
              const card = cardById(id);
              return (
                <section key={id} class="note-card">
                  <h2 class="paper-kicker">새 생활 카드</h2>
                  <p class="note-card-title">{card?.title ?? id}</p>
                  {card && <p class="note-card-text">{card.text}</p>}
                </section>
              );
            })}
            {deed.newItems.map((id) => {
              const item = itemById(id);
              return (
                <section key={id} class="note-card item">
                  <h2 class="paper-kicker">봇짐에 넣었어요</h2>
                  <p class="note-card-title">{item?.label ?? id}</p>
                  {item && <p class="note-card-text">{item.text}</p>}
                </section>
              );
            })}
            {nextSpot && (
              <p class="note-go">
                <span aria-hidden="true">➤ </span>이제 {ro(nextSpot)} 가요.
              </p>
            )}
            <button type="button" class="btn primary" data-autofocus onClick={closeNote}>
              {deed.solved.length > 0 ? '다음' : '돌아가기'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 대화 장면 안의 짧은 겨루기(작은 고비 — spec 11.1 가 9): 「굳은 논흙」은 우리 논에서 볍씨 뿌릴 논을 고른 뒤, 놀이 앞에 열린다.
 * 정령의 말풍선(soilBefore)이 먼저, 겨루기를 처음 배우는 판이면 여는 말 다음에 세 걸음 안내. 끝나면(넘김·구해 줌·마무리 모두 넘긴 것) 놀이로.
 * 겨루기 도중에 끄면 그 일의 처음부터다(저장에는 작은 고비를 마쳤는지만 적힌다 — 5.8).
 */
function MinorStep({ happeningId, onDone }: { happeningId: string; onDone: () => void }): JSX.Element | null {
  const [minor] = useState(() => minorPending(happeningId));
  const [kit] = useState(() => (minor ? battleKit(minor) : null));
  const ep = episode.value;
  // 처음 하는 겨루기(그 이야기에서 아직 깬 에피소드가 없다)면 정령이 세 걸음으로 알린다
  const first = !ep || !Object.values(save.value.stories[ep.story]?.episodes ?? {}).some((one) => one.cleared);
  useEffect(() => {
    if (!minor || !kit) onDone();
  }, [minor, kit]);
  if (!minor || !kit) return null;
  const bubbles = ep?.id === 's1395-1' ? s1395_1Lines.bubbles : null;
  return (
    <div class="talk-battle" data-own>
      <BattleView
        target={minor}
        kit={kit}
        guide={first}
        intro={bubbles ? [{ who: 'neuti', text: bubbles.soilBefore }] : []}
        outro={bubbles ? [{ who: 'neuti', text: bubbles.soilAfter }] : []}
        onEnd={(b) => {
          finishMinor(minor, b);
          onDone();
        }}
      />
    </div>
  );
}
