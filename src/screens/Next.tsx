// "다음에 만들어요" — 다음 계절이 아직 만들어지지 않은 집에서, 만들어진 계절을 끝까지 한 뒤에 뜬다.
// (농민 집은 네 계절이 다 있어 이 화면을 만나지 않는다. 겨울까지 보내면 한 해 돌아보기로 간다.)
// 끝까지 했다는 것, 다음 계절이 아직 없다는 것, 푼 미션과 모은 카드를 보여 주고 처음으로 돌아간다.
// "해낸 미션"에는 풀린 미션만 적는다. 하다가 만 미션은 어디까지 했는지를 따로 적는다(다 한 것처럼 적지 않는다).

import type { JSX } from 'preact';
import { Scenery } from '../art/Scenery';
import { cardById } from '../content/cards';
import { seasonLabels } from '../content/labels';
import { roleOf } from '../engine/game';
import { SEASONS } from '../engine/types';
import { backToTitle, game, pack } from '../state/store';
import { yearAndPlace } from '../ui/where';
import { josa, progressLine } from '../ui/words';

export function Next(): JSX.Element | null {
  const p = pack.value;
  const g = game.value;
  if (!p || !g) return null;
  // 다음 계절로 넘어온 뒤에 뜨므로, 끝낸 계절은 그 앞의 것이다. 한 해가 다 끝났으면 겨울까지 한 것이다.
  const yearDone = g.phase === 'done';
  const doneIndex = yearDone ? SEASONS.length - 1 : Math.max(0, g.seasonIndex - (g.phase === 'season' ? 1 : 0));
  const doneName = seasonLabels[SEASONS[doneIndex]].label;
  const upcoming = yearDone ? null : SEASONS[doneIndex + 1];
  const solved = p.missions.filter((m) => g.solved.includes(m.id));
  // 풀리지는 않았지만 얼마쯤 한 미션(한 해 내내 푸는 덤 미션 등)
  const underway = p.missions
    .filter((m) => !m.roles || m.roles.includes(g.role))
    .map((m) => ({ mission: m, line: progressLine(m, g, !yearDone) }))
    .filter((row): row is { mission: (typeof p.missions)[number]; line: string } => row.line !== null);
  const role = roleOf(p, g.role);
  return (
    <main class={`screen closing nextup season-${SEASONS[doneIndex]}`}>
      <Scenery story={p.situation.id} place="entrance" season={SEASONS[doneIndex]} />
      <div class="closing-veil" />
      <div class="closing-paper narrow">
        <header class="closing-head">
          <p class="kicker">
            {yearAndPlace(p, g.role)} · {role.label}
          </p>
          <h1 class="screen-title">{yearDone ? '한 해를 끝까지 살았어요' : `${josa(doneName, '을', '를')} 끝까지 살았어요`}</h1>
          <p class="next-lead">
            {upcoming
              ? `${josa(seasonLabels[upcoming].label, '은', '는')} 다음에 만들어요. 여기까지 한 것은 기기에 남아 있어요.`
              : '처음 화면의 “이어 하기”를 누르면 한 해 돌아보기가 열려요. 여기까지 한 것은 기기에 남아 있어요.'}
          </p>
        </header>
        <div class="closing-body one">
          <section class="closing-col">
            <h2 class="paper-head">해낸 미션 {solved.length}가지</h2>
            {solved.length === 0 ? (
              <p class="closing-none">아직 없어요.</p>
            ) : (
              <ul class="closing-list deeds">
                {solved.map((m) => (
                  <li key={m.id}>
                    <span class="closing-deed-head">「{m.title}」</span>
                    <span class="closing-deed-text">{m.doneLine}</span>
                  </li>
                ))}
              </ul>
            )}
            {underway.length > 0 && (
              <>
                <h2 class="paper-head">하고 있는 미션</h2>
                <ul class="closing-list deeds">
                  {underway.map(({ mission, line }) => (
                    <li key={mission.id}>
                      <span class="closing-deed-head">「{mission.title}」</span>
                      <span class="closing-deed-text">{line}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <h2 class="paper-head">모은 생활 카드 {g.cards.length}장</h2>
            {g.cards.length === 0 ? (
              <p class="closing-none">아직 없어요.</p>
            ) : (
              <ul class="paper-chips">
                {g.cards.map((id) => (
                  <li key={id} class="paper-chip">
                    {cardById(id)?.title ?? id}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <footer class="closing-foot">
          <span />
          <button type="button" class="btn primary" onClick={backToTitle}>
            처음으로
          </button>
        </footer>
      </div>
    </main>
  );
}
