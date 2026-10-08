// "미션이 풀림" 종이 — 맵의 무대 위에 얹힌다.
// 미션 이름, "해낸 일" 한 줄, 얻은 것의 이름, 다시 볼 곳.
// "맞았어요"라고 하지 않는다. 미션은 답을 맞혀 푸는 것이 아니라 가서, 듣고, 고르고, 해내면 풀린다.
//
// 배움 쪽지와 카드의 글은 여기에 다시 적지 않는다 — 바로 앞의 대화 장면에서 이미 읽었다(같은 말은 한 번만 읽는다).
// 다시 읽고 싶으면 봇짐(카드)과 "지난 이야기"(대화와 쪽지)에 있다.
// 이 종이는 미션의 id만으로 그린다: 방금 한 일에 기대지 않는다(이어 하기로 들어와 대화 장면 없이 바로 뜰 수도 있다).

import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { cardById } from '../content/cards';
import { itemById } from '../content/items';
import { closeMissionDone, game, pack } from '../state/store';
import { Paper } from '../ui/Paper';

const unique = (list: readonly string[]): string[] => [...new Set(list)];

export function MissionDone({ missionId }: { missionId: string }): JSX.Element | null {
  const p = pack.value;
  const g = game.value;
  const mission = p?.missions.find((m) => m.id === missionId);

  // 모르는 미션이면 종이를 그냥 넘긴다(빈 종이에서 멈추지 않게)
  useEffect(() => {
    if (!mission) closeMissionDone();
  }, [mission]);

  if (!p || !g || !mission) return null;
  // 이 미션을 이룬 일들에서 얻은 카드와 물건의 이름을 모은다(기록이 없어도 종이는 뜬다)
  const deeds = g.history.filter((deed) => deed.missionId === mission.id || deed.solved.includes(mission.id));
  const cardIds = unique(deeds.flatMap((deed) => deed.newCards));
  const itemIds = unique(deeds.flatMap((deed) => deed.newItems));
  const got = cardIds.length + itemIds.length > 0;

  return (
    <Paper key={mission.id} label={`미션이 풀렸어요. ${mission.title}`} kind="mission" onClose={closeMissionDone}>
      <p class="paper-kicker">{mission.must ? '꼭 할 일을 해냈어요' : '덤 미션을 해냈어요'}</p>
      <h2 class="paper-title">「{mission.title}」</h2>
      <section class="paper-part">
        <h3 class="paper-head">해낸 일</h3>
        <p class="paper-line">{mission.doneLine}</p>
      </section>
      {got && (
        <section class="paper-part">
          <h3 class="paper-head">얻은 것</h3>
          <ul class="paper-chips">
            {cardIds.map((id) => (
              <li key={id} class="paper-chip">
                <span class="paper-chip-kind">생활 카드</span>
                {cardById(id)?.title ?? id}
              </li>
            ))}
            {itemIds.map((id) => (
              <li key={id} class="paper-chip">
                <span class="paper-chip-kind">물건</span>
                {itemById(id)?.label ?? id}
              </li>
            ))}
          </ul>
        </section>
      )}
      <div class="paper-foot">
        <p class="paper-saved">
          {got ? '얻은 것은 봇짐에서, 나눈 이야기는 “지난 이야기”에서 다시 볼 수 있어요.' : '나눈 이야기는 “지난 이야기”에서 다시 볼 수 있어요.'}
        </p>
        <button type="button" class="btn primary" data-autofocus onClick={closeMissionDone}>
          닫기
        </button>
      </div>
    </Paper>
  );
}
