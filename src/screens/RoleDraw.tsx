// 3. 태어날 집 뽑기 — 뒤집힌 패 넉 장에서 하나. 두 번째 판부터는 골라도 된다.
// 아직 장면이 없는 집은 뽑히지 않고 "준비 중"으로 보인다.

import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { Figure } from '../art/people';
import { playableRoles } from '../engine/game';
import { dealRoles } from '../engine/rng';
import { ROLE_IDS, type RoleId, type SituationPack } from '../engine/types';
import { goPick, saved, seed, settleRole } from '../state/store';
import { ro } from '../ui/words';

function RoleFace({ role, label }: { role: RoleId; label: string }): JSX.Element {
  return (
    <span class="role-face">
      <svg class="role-figure" viewBox="0 0 200 220" aria-hidden="true">
        <Figure name={role} x={100} y={210} />
      </svg>
      <span class="role-label">{label}</span>
    </span>
  );
}

function CardBack({ index }: { index: number }): JSX.Element {
  return (
    <span class="role-back">
      <svg class="role-figure" viewBox="0 0 200 220" aria-hidden="true">
        <rect x="14" y="14" width="172" height="192" rx="10" fill="none" stroke="currentColor" stroke-width="4" />
        <path
          d="M14 78 H186 M14 142 H186 M72 14 V206 M128 14 V206"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          opacity="0.5"
        />
        <text x="100" y="132" text-anchor="middle" font-size="64" font-weight="700" fill="currentColor">
          ?
        </text>
      </svg>
      <span class="role-label">{index + 1}번 패</span>
    </span>
  );
}

export function RoleDraw({ pack }: { pack: SituationPack }): JSX.Element {
  const { situation } = pack;
  const playable = playableRoles(pack);
  const [mode, setMode] = useState<'draw' | 'choose'>(saved.value.firstDone ? 'choose' : 'draw');
  const [picked, setPicked] = useState<number | null>(null);
  const [chosen, setChosen] = useState<RoleId | null>(null);

  const dealt = picked !== null ? dealRoles(ROLE_IDS, playable, seed.value, picked) : null;
  const role: RoleId | null = mode === 'draw' ? (dealt && picked !== null ? dealt[picked] : null) : chosen;
  const someSoon = playable.length < ROLE_IDS.length;

  return (
    <main class="screen roledraw">
      <header class="roledraw-head">
        <div>
          <p class="kicker">
            {situation.year}년 · {situation.title}
          </p>
          <h1 class="screen-title">{mode === 'draw' ? '태어날 집 뽑기' : '태어날 집 고르기'}</h1>
          <p class="roledraw-guide">
            {mode === 'draw'
              ? '태어날 집은 고를 수 없었어요. 패를 한 장 뒤집어 보세요.'
              : '한 해를 살아 보았으니 이번에는 집을 골라도 돼요.'}
            {someSoon && ' 준비 중인 집은 아직 살아 볼 수 없어요.'}
          </p>
        </div>
        <button type="button" class="btn small" onClick={goPick}>
          다른 때 고르기
        </button>
      </header>

      <div class="role-cards">
        {mode === 'draw' &&
          ROLE_IDS.map((_, index) => {
            if (!dealt) {
              return (
                <button key={index} type="button" class="role-card back" onClick={() => setPicked(index)}>
                  <CardBack index={index} />
                </button>
              );
            }
            const shown = dealt[index];
            const mine = index === picked;
            const soon = !playable.includes(shown);
            return (
              <div key={index} class={`role-card face${mine ? ' mine' : ' other'}${soon ? ' soon-card' : ''}`}>
                <RoleFace role={shown} label={situation.roles[shown].label} />
                {mine ? <span class="role-tag mine-tag">내가 태어난 집</span> : soon ? <span class="soon">준비 중</span> : null}
              </div>
            );
          })}

        {mode === 'choose' &&
          ROLE_IDS.map((id) => {
            const label = situation.roles[id].label;
            if (!playable.includes(id)) {
              return (
                <div key={id} class="role-card face soon-card" role="group" aria-label={`${label}, 준비 중`}>
                  <RoleFace role={id} label={label} />
                  <span class="soon">준비 중</span>
                </div>
              );
            }
            const mine = chosen === id;
            return (
              <button
                key={id}
                type="button"
                class={`role-card face pickable${mine ? ' mine' : ''}`}
                aria-pressed={mine}
                onClick={() => setChosen(id)}
              >
                <RoleFace role={id} label={label} />
                {mine && <span class="role-tag mine-tag">이 집으로</span>}
              </button>
            );
          })}
      </div>

      <footer class="roledraw-foot">
        {role ? (
          <button type="button" class="btn primary" onClick={() => settleRole(role)}>
            {ro(situation.roles[role].label)} 한 해 살기
          </button>
        ) : (
          <span class="roledraw-wait">{mode === 'draw' ? '패를 골라 주세요.' : '집을 골라 주세요.'}</span>
        )}
        {mode === 'choose' && (
          <button
            type="button"
            class="btn small"
            onClick={() => {
              setMode('draw');
              setPicked(null);
              setChosen(null);
            }}
          >
            패를 뽑아 정하기
          </button>
        )}
      </footer>
    </main>
  );
}
