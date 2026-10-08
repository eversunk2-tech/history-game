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

import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Figure } from '../art/Figure';
import type { Pose } from '../art/pictures';
import { Scenery } from '../art/Scenery';
import { cardById } from '../content/cards';
import { itemById } from '../content/items';
import { statLabels } from '../content/labels';
import { choiceViews, currentSeason, happeningOf, missionOfHappening, openHappenings, openingLines, type ChoiceView } from '../engine/game';
import { STATS, type Deed, type GameState, type Happening, type Line, type Mission, type Person, type Season, type SituationPack } from '../engine/types';
import { PLAYS } from '../plays';
import { closeTalk, commitTalk, game, pack } from '../state/store';
import { focusInto, useModalKeys } from '../ui/focus';
import { LockIcon, SunIcon } from '../ui/icons';
import { spotLabel } from '../ui/where';
import { changeWords, josa, ro, type ChangeWords } from '../ui/words';

/** 잇달아 누른 것을 한 번으로 친다(두 번 두드려 한 창을 읽지 못하고 넘기는 일을 막는다) */
const TAP_GAP_MS = 260;
/** 맵에서 자리를 누른 손가락이 떼어지며 첫 창을 넘기지 않게, 뜬 바로 뒤에는 조금 더 기다린다 */
const OPEN_GAP_MS = 380;
/** 배움 쪽지는 뜬 바로 뒤에 닫히지 않는다(잇달아 누르다 읽지 못하고 넘기는 일을 막는다) */
const NOTE_GAP_MS = 700;

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
}

/** 대화 장면이 열릴 때의 모습을 적어 둔다(일을 마치면 판이 바뀌므로 그 전의 것을 쥐고 있는다) */
function snapOf(p: SituationPack, g: GameState, id: string): Snap | null {
  try {
    const happening = happeningOf(p, id);
    const view = openHappenings(p, g).find((v) => v.happening.id === id);
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
      choices: choiceViews(p, g, id),
      mission: view?.mission ?? missionOfHappening(p, g.role, id),
      people: p.situation.people ?? {},
      blocked,
    };
  } catch (error) {
    console.error('[조선에서 한 해 살기] 대화 장면을 열 수 없다:', error);
    return null;
  }
}

type Step =
  | { kind: 'blocked' }
  | { kind: 'open'; i: number }
  | { kind: 'choose' }
  | { kind: 'play'; choiceId?: string }
  | { kind: 'result'; i: number }
  | { kind: 'change' }
  | { kind: 'note' };

/** 그림 파일이 없을 때 세울 도트 인물: 자료에 적힌 것이 없으면 성별과 나이대로 고른다 */
function spriteFor(who: string, person: Person | undefined): string {
  if (person?.sprite) return person.sprite;
  if (!person) return who;
  if (person.age === 'old') return person.sex === 'f' ? 'granny' : 'elderMan';
  if (person.age === 'child') return person.sex === 'f' ? 'girlKid' : 'boyKid';
  if (person.age === 'young') return person.sex === 'f' ? 'sister' : 'brother';
  return person.sex === 'f' ? 'wellWoman' : 'neighborMan';
}

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

/** 그 사람이 가장 최근에 지은 표정(말한 창에 적힌 것) */
function poseOf(who: string, lines: readonly Line[], upto: number): Pose {
  for (let i = Math.min(upto, lines.length - 1); i >= 0; i--) {
    const line = lines[i];
    if (line.who === who && line.pose) return line.pose;
  }
  return 'plain';
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
  const lastTap = useRef(Date.now() + (OPEN_GAP_MS - TAP_GAP_MS));
  const committed = useRef(false);

  const tooSoon = (): boolean => {
    const now = Date.now();
    if (now - lastTap.current < TAP_GAP_MS) return true;
    lastTap.current = now;
    return false;
  };

  /** 일을 마치고 나온 결과에서 다음에 보여 줄 것 */
  const afterResult = (d: Deed): Step | null => {
    if (changeRows(d).length > 0 || d.sun > 0) return { kind: 'change' };
    return afterChange(d);
  };
  const afterChange = (d: Deed): Step | null => (d.note.trim() !== '' || d.newCards.length > 0 || d.newItems.length > 0 ? { kind: 'note' } : null);

  const noteShownAt = useRef(0);
  const go = (next: Step | null): void => {
    if (next?.kind === 'note') noteShownAt.current = Date.now();
    if (next) setStep(next);
    else closeTalk();
  };
  const closeNote = (): void => {
    if (Date.now() - noteShownAt.current < NOTE_GAP_MS) return;
    closeTalk();
  };

  /** 고른 선택지와 놀이의 끝난 모습을 넘겨 일을 마친다 */
  const commit = (choiceId?: string, played?: string): void => {
    if (committed.current) return;
    committed.current = true;
    const done = commitTalk({ id: happeningId, choiceId, play: played });
    if (!done) return; // 가게가 '이어 갈 수 없어요'로 보낸다
    setDeed(done);
    go(done.lines.length > 0 ? { kind: 'result', i: 0 } : afterResult(done));
  };

  /** 선택이 끝난 뒤: 일 놀이가 있으면 놀이로, 없으면 바로 마친다 */
  const afterChoice = (choiceId?: string): void => {
    const play = snap?.happening.play;
    if (play && PLAYS[play.game]) {
      setStep({ kind: 'play', choiceId });
      return;
    }
    // 모르는 놀이면 첫 결과로 넘어간다
    commit(choiceId, play ? Object.keys(play.flags)[0] : undefined);
  };

  const advance = (): void => {
    if (!snap) return;
    if (step.kind !== 'blocked' && step.kind !== 'open' && step.kind !== 'result' && step.kind !== 'change') return;
    if (tooSoon()) return;
    if (step.kind === 'blocked') {
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

  const choose = (view: ChoiceView): void => {
    if (view.locked || step.kind !== 'choose' || tooSoon()) return;
    afterChoice(view.id);
  };

  /** "나중에 할게요": 일을 마치기 전이면 아무 일도 일어나지 않은 채 맵으로 돌아간다 */
  const canLeave = !committed.current && (step.kind === 'open' || step.kind === 'choose');
  const later = (): void => {
    if (!canLeave || tooSoon()) return;
    closeTalk();
  };

  useModalKeys(rootRef, (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      advance();
    } else if (step.kind === 'choose' && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) {
      // 화살표로 선택지를 오간다(PC와 TV). 고르는 것은 Enter·Space다.
      ev.preventDefault();
      const items = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('button.talk-choice') ?? []);
      if (items.length === 0) return;
      const at = items.indexOf(document.activeElement as HTMLElement);
      const next = ev.key === 'ArrowDown' ? (at + 1) % items.length : (at <= 0 ? items.length : at) - 1;
      items[next].focus();
    } else if (ev.key === 'Escape') {
      if (canLeave) later();
      else if (step.kind === 'blocked') closeTalk();
      else if (step.kind === 'note') closeNote();
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
  const lines = step.kind === 'result' && deed ? deed.lines : snap.opening;
  const at = step.kind === 'open' || step.kind === 'result' ? step.i : step.kind === 'choose' ? snap.opening.length - 1 : -1;
  const line: Line | null = at >= 0 && at < lines.length ? lines[at] : null;
  const speaker = line?.who;
  const nameOf = (who: string): string => people[who]?.label ?? who;
  // 일 놀이와 쪽지가 뜰 때는 사람을 세우지 않는다(쪽지가 얼굴을 가린다)
  const showsFigures = step.kind !== 'play' && step.kind !== 'note';

  const rows = deed && step.kind === 'change' ? changeRows(deed) : [];
  const play = happening.play;
  const playDef = play ? PLAYS[play.game] : undefined;
  // 고른 일을 마치러 갈 자리(있으면 쪽지에 알려 준다. 맵에서는 화살표가 그리로 옮겨 간다)
  const nextSpot = deed?.goTo && pack.value && g ? spotLabel(pack.value, g.role, deed.goTo) : null;
  const tag = snap.mission ? `${snap.mission.must ? '꼭 할 일' : '덤 미션'} · ${snap.mission.title}` : happening.cost > 0 ? '덤으로 하는 일' : '';

  return (
    <div
      class={`talk season-${snap.season} step-${step.kind} cast-${showsFigures ? cast.length : 0}`}
      role="dialog"
      aria-modal="true"
      aria-label="대화 장면"
      ref={rootRef}
      onClick={(ev) => {
        // 창 어디를 눌러도 넘어간다(단추와 놀이, 쪽지는 저마다 받는다)
        if (ev.target instanceof Element && ev.target.closest('[data-own]')) return;
        advance();
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
                  sprite={spriteFor(member.who, person)}
                  pose={poseOf(member.who, lines, at)}
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

      {step.kind === 'choose' && (
        // 초점은 선택지 묶음에 둔다(첫 선택지에 두면 Enter를 잇달아 누르다 저절로 골라진다). 화살표나 Tab으로 들어간다.
        <ul class="talk-choices" data-own data-autofocus tabIndex={-1} aria-label="어떻게 할까요? 화살표로 고르고 Enter로 정해요.">
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
                <button type="button" class="talk-choice" onClick={() => choose(view)}>
                  <span class="talk-choice-label">{view.label}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {step.kind === 'play' && play && playDef && (
        <div class="talk-play" data-own>
          <playDef.View rules={play.rules} onDone={(result) => commit(step.choiceId, result)} />
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
      {step.kind === 'choose' && (
        <div class={`talk-box still${speaker ? ' says' : ''}`}>
          {speaker && <span class="talk-name">{nameOf(speaker)}</span>}
          <span class="talk-text">{line ? line.text : '어떻게 할까?'}</span>
        </div>
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
