// 4. 나를 소개합니다 — 내가 누구이고 어디에 사는지, 식구, 시작 수치, 올해의 바람.
// 모습(3판 다듬기 ㉠): 왼쪽은 마당 그림과 뽑힌 아이(그대로), 오른쪽은 떠 있는 종이 — 머리는 주아, 소개 글·식구·바람은 고운바탕,
// 수치는 도트 아이콘 + 이름 + 숫자 + 젤리 막대 + 풀이(ui/Meter.tsx), 올해의 바람은 파인 쟁반에 황 붓줄, "한 해 시작하기"는 쪽빛.
// 이 화면이 떠 있는 동안 그 이야기의 그림을 뒤에서 미리 받는다(가게가 이야기를 열 때 시킨다).
// 첫 맵의 도트 그림(그 맵에 놓인 것과 사람, 땅의 조각)도 쉬는 틈마다 조금씩 미리 짓는다(spec 4.7.5의 ㅋ).

import type { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { prewarmGame } from './prewarm';
import { Figure } from '../art/Figure';
import { Scenery } from '../art/Scenery';
import { roleOf } from '../engine/game';
import { STATS } from '../engine/types';
import { beginYear, game, heroName, pack } from '../state/store';
import { Meter } from '../ui/Meter';
import { yearAndPlace } from '../ui/where';

export function Intro(): JSX.Element | null {
  const p = pack.value;
  const g = game.value;
  // 첫 맵을 미리 짓는다(쉬는 틈마다 조금씩 — 화면은 막히지 않는다). 다 짓기 전에 시작해도 맵이 남은 것을 이어 짓는다.
  const mapId = p && g ? roleOf(p, g.role).map : '';
  const heroNow = g ? heroName(g.role, g.look) : '';
  useEffect(() => prewarmGame(pack.peek(), game.peek()), [mapId, heroNow]);
  if (!p || !g) return null;
  const role = roleOf(p, g.role);
  const hero = heroName(g.role, g.look);
  return (
    <main class="screen intro hanji season-spring">
      <div class="intro-art">
        <Scenery story={p.situation.id} place="yard" season="spring" label={`${role.label}의 집 마당`} />
        <div class="intro-hero">
          <Figure story={p.situation.id} pic={hero} sprite={hero} fill={0.5} label={role.label} />
        </div>
      </div>
      <section class="intro-panel sheet-paper">
        <p class="kicker">
          {yearAndPlace(p, g.role)} · {role.label}
        </p>
        <h1 class="screen-title">나를 소개합니다</h1>
        <p class="story">{role.intro}</p>
        {role.family && (
          <p class="intro-family">
            <span class="box-head">식구</span>
            {role.family}
          </p>
        )}
        <div class="intro-start">
          <span class="box-head">한 해를 시작할 때의 형편</span>
          <div class="intro-meters">
            {STATS.map((stat) => (
              <Meter key={stat} stat={stat} value={g.stats[stat]} about />
            ))}
          </div>
        </div>
        <div class="wish-box">
          <span class="box-head">올해의 바람</span>
          <p class="wish-text">{role.wish}</p>
        </div>
        <button type="button" class="btn primary push-down" onClick={beginYear}>
          한 해 시작하기
        </button>
      </section>
    </main>
  );
}
