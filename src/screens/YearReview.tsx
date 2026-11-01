// 6. 한 해 돌아보기 — 겨울을 보낸 뒤에 뜬다(spec 4절 6번, 5.4). 종이 화면이고 "다음 ▶"으로 네 장을 넘긴다.
//   1. 네 계절에 고른 것  계절마다 꼭 할 일에서 내가 고른 것, 해낸 덤 미션, 계절의 끝에 생긴 일과 그 값("(살림 −3)")
//                         — 미션 종이와 계절 닫기에서 읽은 것을 되풀이하지 않게 "고른 것" 위주로 한 장에 모았다(Review 1-라 21번)
//   2. 한 해의 흐름       살림·기력·인심이 처음 → 봄 → 여름 → 가을 → 겨울로 어떻게 움직였는지, 그해의 날씨, 올해의 바람과 까닭
//   3. 올해의 이름        한 해 이름(도장처럼), 한 줄, 뒷이야기
//   4. 남길 것            나무·물건·이야기 가운데 하나 → finishYear → 이야기책(그 해에 한 해 이름이 찍힌다)
// 한 일과 달라진 것을 그대로 보여 준다. 점수·등수·맞음·틀림의 말이 없고, 바람을 이루지 못했어도 꾸짖지 않는다(까닭만 말한다).
// 뜻은 색만으로 전하지 않는다: 흐름은 이름·숫자·점과 선의 모양으로, 고른 것은 굵은 테와 글로 알린다.
// 견주어 보기, 생각 나눔, 수첩은 다음 바퀴(1-마)다.

import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Scenery } from '../art/Scenery';
import { seasonLabels, statLabels } from '../content/labels';
import { roleOf } from '../engine/game';
import { reviewYear, type YearReview as Year } from '../engine/review';
import { SEASONS, STATS, type GameState, type Season, type SituationPack, type Stat, type Stats } from '../engine/types';
import { finishYear, game, pack, saveFailed } from '../state/store';
import { LegacyIcon, StatIcon } from '../ui/icons';
import { MoreBox } from '../ui/More';
import { yearAndPlace } from '../ui/where';
import { josa } from '../ui/words';
import { LOOK_WORDS, flowDots, flowWords, seasonRecap, type SeasonRecap } from '../ui/year';

/** 쪽을 넘긴 바로 뒤에는 누름을 받지 않는다(두 번 두드려 한 장을 읽지 못하고 넘기는 일을 막는다) */
const TURN_GAP_MS = 320;

const PAGES = [
  { id: 'seasons', step: '네 계절', title: '네 계절에 고른 것' },
  { id: 'flow', step: '한 해의 흐름', title: '한 해의 흐름' },
  { id: 'name', step: '올해의 이름', title: '올해의 이름' },
  { id: 'legacy', step: '남길 것', title: '무엇을 남길까요?' },
] as const;

const LEGACY_KINDS: Record<'tree' | 'thing' | 'story', { label: string; about: string }> = {
  tree: { label: '나무', about: '오래오래 자라요' },
  thing: { label: '물건', about: '대대로 물려줘요' },
  story: { label: '이야기', about: '입에서 입으로 전해요' },
};

// ── 계절 한 칸 ────────────────────────────────────────────────

/** 덤 미션 이름들을 한 줄로: 「가」, 「나」 */
const titles = (list: readonly { title: string }[]): string => list.map((m) => `「${m.title}」`).join(', ');

function SeasonBox({ recap }: { recap: SeasonRecap }): JSX.Element {
  const name = seasonLabels[recap.season].label;
  const musts = recap.missions.filter((m) => m.must);
  const sides = recap.missions.filter((m) => !m.must);
  // 꼭 할 일마다 내가 고른 것. 고른 것이 없는 미션(듣고 해낸 것, 도움을 받은 것)은 "해낸 일" 한 줄로.
  const picks = musts.flatMap((m) => (m.picks.length > 0 ? m.picks : [m.doneLine]));
  const empty = picks.length === 0 && sides.length === 0 && recap.underway.length === 0 && recap.ending.length === 0;
  return (
    <section class={`year-season season-${recap.season}`} aria-label={`${name}에 고른 것`}>
      <h2 class="year-season-head">
        <span class={`season-chip season-${recap.season} now`}>{name}</span>
        {recap.weather && (
          <span class="year-season-weather">
            올해의 날씨 · <strong>{recap.weather.label}</strong>
          </span>
        )}
      </h2>
      {empty && <p class="closing-none">적어 둔 일이 없어요.</p>}
      {picks.length > 0 && (
        <ul class="year-picks">
          {picks.map((pick) => (
            <li key={pick}>{pick}</li>
          ))}
        </ul>
      )}
      {sides.length > 0 && <p class="year-side">덤 미션 {titles(sides)}도 해냈어요.</p>}
      {recap.underway.map((row) => (
        <p key={row.id} class="year-side">
          덤 미션 「{row.title}」 — {row.line}
        </p>
      ))}
      {recap.ending.length > 0 && (
        <ul class="year-results" aria-label={`${name}의 끝에 생긴 일`}>
          {recap.ending.map((line) => (
            <li key={line.text}>
              <span class="year-result-mark" aria-hidden="true">
                →{' '}
              </span>
              {line.text}
              {line.value && <strong class="year-result-value"> {line.value}</strong>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── 수치의 흐름 ───────────────────────────────────────────────

/** 수치마다 점과 선의 모양이 다르다(색만으로 가르지 않는다): 살림 ● 이은 선 · 기력 ■ 긴 점선 · 인심 ◆ 짧은 점선 */
const FLOW_DASH: Record<Stat, string | undefined> = { living: undefined, body: '7 5', trust: '2 5' };

function FlowRow({ flow, stat }: { flow: readonly Stats[]; stat: Stat }): JSX.Element {
  const dots = flowDots(flow, stat);
  const words = flowWords(flow, stat);
  const name = statLabels[stat].label;
  return (
    <div class={`flow-row flow-${stat}`}>
      <div class="flow-name">
        <span class="flow-name-top">
          <StatIcon stat={stat} />
          {name}
        </span>
        <span class="flow-name-nums">
          {words.from} → {words.to}
        </span>
        <span class="flow-name-say">
          <span aria-hidden="true">{words.arrow} </span>
          {words.text}
        </span>
      </div>
      <div class="flow-plot" aria-hidden="true">
        <div class="flow-area">
          <svg class="flow-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line class="flow-base" x1="0" y1="100" x2="100" y2="100" vector-effect="non-scaling-stroke" />
            <line class="flow-mid" x1="0" y1="50" x2="100" y2="50" vector-effect="non-scaling-stroke" />
            {dots.length > 1 && (
              <polyline class="flow-line" points={dots.map((d) => `${d.x},${d.y}`).join(' ')} stroke-dasharray={FLOW_DASH[stat]} vector-effect="non-scaling-stroke" />
            )}
          </svg>
          {dots.map((d, index) => (
            <span key={index} class="flow-dot" style={{ left: `${d.x}%`, top: `${d.y}%` }}>
              <span class="flow-mark" />
              <span class="flow-num">{d.value}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function FlowChart({ flow }: { flow: readonly Stats[] }): JSX.Element {
  const labels = flowDots(flow, 'living');
  // 화면 읽기 프로그램에는 그림 대신 글로 알린다
  const spoken = STATS.map((stat) => `${statLabels[stat].label}: ${flowDots(flow, stat).map((d) => `${d.label} ${d.value}`).join(', ')}`).join('. ');
  return (
    <div class="flow" role="img" aria-label={`수치의 흐름. ${spoken}`}>
      {STATS.map((stat) => (
        <FlowRow key={stat} flow={flow} stat={stat} />
      ))}
      <div class="flow-row flow-axis" aria-hidden="true">
        <div class="flow-name" />
        <div class="flow-plot">
          <div class="flow-area">
            {labels.map((d, index) => (
              <span key={index} class="flow-when" style={{ left: `${d.x}%` }}>
                {d.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 쪽 ───────────────────────────────────────────────────────

function SeasonsPage({ recaps }: { recaps: SeasonRecap[] }): JSX.Element {
  return (
    <MoreBox class="year-body year-seasons" hintClass="more-below closing-more">
      <p class="year-legend">
        <span>
          <span aria-hidden="true">· </span>내가 고른 것
        </span>
        <span>
          <span aria-hidden="true">→ </span>계절의 끝에 생긴 일
        </span>
      </p>
      {/* 두 칸에 봄·가을 / 여름·겨울. 칸마다 제 높이로 쌓는다(짧은 계절 옆에 빈 줄이 생기지 않게). 읽는 차례는 봄 → 여름 → 가을 → 겨울. */}
      <div class="year-four">
        {[0, 1].map((column) => (
          <div key={column} class="year-four-col">
            {recaps
              .filter((_, index) => index % 2 === column)
              .map((recap) => (
                <SeasonBox key={recap.season} recap={recap} />
              ))}
          </div>
        ))}
      </div>
    </MoreBox>
  );
}

function FlowPage({ p, g, year }: { p: SituationPack; g: GameState; year: Year }): JSX.Element {
  // 그해의 날씨는 첫 장(여름 칸)에 있다 — 여기서 되풀이하지 않는다
  const role = roleOf(p, g.role);
  return (
    <MoreBox class="year-body year-flow" hintClass="more-below closing-more">
      <section class="year-col">
        <FlowChart flow={year.flow} />
        <p class="year-small">계절을 보낸 뒤의 형편이에요. 숫자가 클수록 넉넉해요.</p>
      </section>
      <section class="year-col">
        <div class="year-box">
          <h2 class="paper-head">올해의 바람</h2>
          <p class="year-box-main">{role.wish}</p>
          <p class="year-wish-result">{year.wish.fulfilled ? '바람이 이루어졌어요.' : '바람대로 되지는 않았어요.'}</p>
          <p>{year.wish.reason}</p>
        </div>
      </section>
    </MoreBox>
  );
}

function NamePage({ p, g, year }: { p: SituationPack; g: GameState; year: Year }): JSX.Element {
  const role = roleOf(p, g.role);
  const who = role.looks.length > 1 ? `${role.label}(${LOOK_WORDS[g.look]})` : role.label;
  return (
    <MoreBox class="year-body year-name" hintClass="more-below closing-more">
      <p class="year-name-lead">
        {who}의 {p.situation.year}년은
      </p>
      <div class="stamp big" role="img" aria-label={`한 해 이름: ${year.yearName.title}`}>
        <span class="stamp-kicker" aria-hidden="true">
          한 해 이름
        </span>
        <span class="stamp-title" aria-hidden="true">
          {year.yearName.title}
        </span>
      </div>
      <p class="year-name-line">{year.yearName.line}</p>
      <div class="year-box year-after">
        <h2 class="paper-head">그 뒤의 이야기</h2>
        <p>{year.epilogue}</p>
      </div>
    </MoreBox>
  );
}

function LegacyPage({ p, picked, onPick }: { p: SituationPack; picked: string | null; onPick: (id: string) => void }): JSX.Element {
  const list = p.situation.legacy;
  return (
    <MoreBox class="year-body year-legacy" hintClass="more-below closing-more">
      <p class="year-legacy-lead">
        한 해를 살고 나서 뒷사람에게 하나를 남겨요. <strong>이 집안의 뒷사람이 나오는 이야기에서 다시 만나요.</strong>
      </p>
      <div class="legacy-cards" style={{ '--legacy-count': String(Math.max(1, list.length)) }}>
        {list.map((one) => {
          const kind = LEGACY_KINDS[one.kind] ?? LEGACY_KINDS.thing;
          const mine = picked === one.id;
          return (
            <button key={one.id} type="button" class={`legacy-card${mine ? ' mine' : ''}`} aria-pressed={mine} onClick={() => onPick(one.id)}>
              <span class="legacy-art" aria-hidden="true">
                <LegacyIcon kind={one.kind} />
              </span>
              <span class="legacy-kind">
                {kind.label}
                <span class="legacy-about">{kind.about}</span>
              </span>
              <span class="legacy-label">{one.label}</span>
              {mine ? <span class="role-tag">이것을 남겨요</span> : <span class="role-tag-none" />}
            </button>
          );
        })}
      </div>
    </MoreBox>
  );
}

export function YearReview(): JSX.Element | null {
  const p = pack.value;
  const g = game.value;
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const turnedAt = useRef(Date.now());
  const goRef = useRef<HTMLButtonElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  const year = useMemo<Year | null>(() => {
    if (!p || !g || g.phase !== 'done') return null;
    try {
      return reviewYear(p, g);
    } catch (error) {
      console.error('[조선에서 한 해 살기] 한 해를 돌아볼 수 없다:', error);
      return null;
    }
  }, [p, g]);
  const recaps = useMemo<SeasonRecap[]>(() => (p && g && year ? year.seasons.map((summary) => seasonRecap(p, g, summary)) : []), [p, g, year]);

  const here = PAGES[page];
  // 쪽을 넘기면 초점을 "다음" 단추로 옮긴다(자판으로 Enter만 눌러 넘길 수 있게). 남길 것은 고르는 것이 먼저라 첫 패로 간다.
  useEffect(() => {
    const target = here.id === 'legacy' ? paperRef.current?.querySelector<HTMLElement>('.legacy-card') : goRef.current;
    target?.focus({ preventScroll: true });
  }, [here.id]);

  if (!p || !g || !year) return null;
  const role = roleOf(p, g.role);
  const last = page === PAGES.length - 1;

  const turn = (to: number): void => {
    const now = Date.now();
    if (now - turnedAt.current < TURN_GAP_MS) return;
    turnedAt.current = now;
    setPage(Math.max(0, Math.min(PAGES.length - 1, to)));
  };
  const leave = (): void => {
    if (!picked || Date.now() - turnedAt.current < TURN_GAP_MS) return;
    finishYear(picked);
  };

  const seasonOf = (index: number): Season => SEASONS[Math.min(index, SEASONS.length - 1)];
  const tone = seasonOf(3);
  const nextLabel = here.id === 'name' ? '남길 것 고르기' : '다음';

  return (
    <main class={`screen closing year season-${tone}`}>
      <Scenery story={p.situation.id} place="entrance" season={seasonOf(3)} />
      <div class="closing-veil" />
      <div class={`closing-paper year-paper page-${here.id}`} ref={paperRef}>
        <header class="closing-head year-head">
          <div>
            <p class="kicker">
              {page === 0 ? `${yearAndPlace(p, g.role)} · ${role.label} · 한 해 돌아보기` : '한 해 돌아보기'}
            </p>
            <h1 class="screen-title">{here.title}</h1>
          </div>
          <ol class="year-steps" aria-label={`${PAGES.length}장 가운데 ${page + 1}장째: ${here.step}`}>
            {PAGES.map((one, index) => (
              <li key={one.id} class={`year-step${index === page ? ' now' : index < page ? ' seen' : ''}`} aria-hidden="true">
                <span class="year-step-num">{index + 1}</span>
                {index === page && <span class="year-step-name">{one.step}</span>}
              </li>
            ))}
          </ol>
        </header>

        {here.id === 'seasons' && <SeasonsPage recaps={recaps} />}
        {here.id === 'flow' && <FlowPage p={p} g={g} year={year} />}
        {here.id === 'name' && <NamePage p={p} g={g} year={year} />}
        {here.id === 'legacy' && <LegacyPage p={p} picked={picked} onPick={setPicked} />}

        <footer class="closing-foot year-foot">
          {page > 0 ? (
            <button type="button" class="btn" onClick={() => turn(page - 1)}>
              <span aria-hidden="true">◀ </span>앞 장
            </button>
          ) : (
            <p class="closing-saved" role="status">
              {saveFailed.value ? '기록을 남기지 못했어요.' : '저절로 저장되었어요.'}
            </p>
          )}
          {last && !picked && <p class="year-ask">남길 것을 하나 골라 주세요.</p>}
          {last && picked && (
            <p class="year-ask picked">
              {josa(p.situation.legacy.find((one) => one.id === picked)?.label ?? '이것', '을', '를')} 남겨요.
            </p>
          )}
          {last ? (
            <button type="button" class="btn primary" disabled={!picked} onClick={leave}>
              남기고 이야기책으로<span aria-hidden="true"> ▶</span>
            </button>
          ) : (
            <button type="button" class="btn primary" ref={goRef} onClick={() => turn(page + 1)}>
              {nextLabel}
              <span aria-hidden="true"> ▶</span>
            </button>
          )}
        </footer>
      </div>
    </main>
  );
}
