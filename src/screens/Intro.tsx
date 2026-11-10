// 7. 의뢰 소개(spec 11.1 가 7 — 3판 "나를 소개합니다"를 고쳐 씀): 역할·식구·시작 수치 + 의뢰 한 줄과 때(「새 도읍의 봄」 · 1395년 이월~삼월),
// 그리고 귀퉁이에서 정령이 네 창을 말한다(s1395-lines.ts의 intro — 모든 아이가 한 창씩 넘겨 다 읽은 뒤에 현장으로 간다.
// 넷째 창 앞의 줄이 핵심 물음 007을 모든 아이가 듣게 한다 — 대본 26.1).
// 이 화면이 떠 있는 동안 그 에피소드의 그림을 뒤에서 미리 받고(App이 시킨다), 첫 맵의 도트 그림을 쉬는 틈마다 조금씩 미리 짓는다(4.7.5의 ㅋ).

import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Figure } from '../art/Figure';
import { Scenery } from '../art/Scenery';
import { s1395_1Lines } from '../content/episodes/s1395-lines';
import { roleOf } from '../engine/game';
import { STATS } from '../engine/types';
import { beginField, episode, game, heroName, pack } from '../state/store';
import { Meter } from '../ui/Meter';
import { SpiritSay } from '../ui/Spirit';
import { TapGate, nowMs } from '../ui/taps';
import { yearAndPlace } from '../ui/where';
import { prewarmGame } from './prewarm';

/** 에피소드마다의 의뢰 소개 정령 말(4-1은 ①-1 하나) */
const LINES: Record<string, { text: string }[]> = { 's1395-1': s1395_1Lines.intro };

export function Intro(): JSX.Element | null {
  const p = pack.value;
  const g = game.value;
  const ep = episode.value;
  const [i, setI] = useState(0);
  const gate = useRef<TapGate | null>(null);
  if (!gate.current) gate.current = new TapGate(nowMs());
  // 첫 맵을 미리 짓는다(쉬는 틈마다 조금씩 — 화면은 막히지 않는다). 다 짓기 전에 시작해도 맵이 남은 것을 이어 짓는다.
  const mapId = p && g ? roleOf(p, g.role).map : '';
  const heroNow = g ? heroName(g.role, g.look) : '';
  useEffect(() => prewarmGame(pack.peek(), game.peek()), [mapId, heroNow]);
  if (!p || !g || !ep) return null;
  const role = roleOf(p, g.role);
  const hero = heroName(g.role, g.look);
  const lines = LINES[ep.id] ?? [];
  const last = i >= lines.length - 1;
  const next = (ev?: Event | null): void => {
    if (!gate.current?.passTap(ev)) return;
    if (!last) setI(i + 1);
  };
  return (
    <main class="screen intro season-spring">
      <div class="intro-art">
        <Scenery story={p.situation.id} place="yard" season="spring" label={`${role.label}의 집 마당`} />
        <div class="intro-hero">
          <Figure story={p.situation.id} pic={hero} sprite={hero} fill={0.5} label={role.label} />
        </div>
      </div>
      <section class="intro-panel">
        <p class="kicker">
          {yearAndPlace(p, g.role)} · {role.label}
        </p>
        <h1 class="screen-title">나를 소개합니다</h1>
        <div class="intro-quest">
          <span class="box-head">의뢰 「{ep.title}」</span>
          <p class="quest-goal">{ep.goal}</p>
          <p class="quest-when">{ep.when}</p>
        </div>
        <p class="story">{role.intro}</p>
        {role.family && (
          <p class="intro-family">
            <span class="box-head">식구</span>
            {role.family}
          </p>
        )}
        <div class="intro-start">
          <span class="box-head">처음의 형편</span>
          <div class="intro-meters">
            {STATS.map((stat) => (
              <Meter key={stat} stat={stat} value={g.stats[stat]} about />
            ))}
          </div>
        </div>
        {lines.length > 0 && (
          <div class="intro-spirit">
            <SpiritSay text={lines[Math.min(i, lines.length - 1)].text} next={last ? undefined : `다음 ▼ (${i + 1}/${lines.length})`} onNext={last ? undefined : next} where="inline" />
          </div>
        )}
        <button type="button" class="btn primary push-down" disabled={!last} onClick={beginField}>
          {last ? '봄 일 시작하기 ▶' : '느티의 말을 끝까지 들어요'}
        </button>
      </section>
    </main>
  );
}
