// 3. 누가 될까 — 신분 역할만 있는 이야기는 처음에 뒤집힌 패에서 뽑는다("태어날 집은 고를 수 없었어요").
// 그 밖의 이야기와 다시 하는 판은 고른다. 아직 만들어지지 않은 집은 뽑히지 않고 "준비 중"으로 보인다.
// 남녀 어느 쪽이든 될 수 있는 역할이면 이어서 남자아이·여자아이 모습을 고른다(도트 인물을 크게 보여 준다).

import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { Figure } from '../art/Figure';
import { playableRoles } from '../engine/game';
import type { Look, RoleDef, RoleId } from '../engine/types';
import { goBook, heroName, pack, save, seed, settleRole } from '../state/store';
import { ro } from '../ui/words';

const LOOK_LABELS: Record<Look, string> = { boy: '남자아이 모습', girl: '여자아이 모습' };

/** 뒤집은 패에는 반드시 할 수 있는 집이 온다(씨앗으로 정한다). 나머지 패에는 다른 집들이 차례로 놓인다. */
function deal(roles: readonly RoleDef[], playable: readonly RoleId[], seedValue: number, picked: number): RoleId[] {
  const mine = playable[seedValue % playable.length];
  const rest = roles.map((r) => r.id).filter((id) => id !== mine);
  return roles.map((_, index) => (index === picked ? mine : (rest.shift() as RoleId)));
}

function RoleFace({ story, role }: { story: string; role: RoleDef }): JSX.Element {
  return (
    <span class="role-face">
      <span class="role-figures" aria-hidden="true">
        {role.looks.map((look) => (
          <span key={look} class="role-figure">
            <Figure story={story} pic={heroName(role.id, look)} sprite={heroName(role.id, look)} fill={0.92} />
          </span>
        ))}
      </span>
      <span class="role-label">{role.label}</span>
    </span>
  );
}

function CardBack({ index }: { index: number }): JSX.Element {
  return (
    <span class="role-back">
      <svg class="role-back-art" viewBox="0 0 200 220" aria-hidden="true">
        <rect x="14" y="14" width="172" height="192" rx="10" fill="none" stroke="currentColor" stroke-width="4" />
        <path d="M14 78 H186 M14 142 H186 M72 14 V206 M128 14 V206" fill="none" stroke="currentColor" stroke-width="2" opacity="0.5" />
        <text x="100" y="132" text-anchor="middle" font-size="64" font-weight="700" fill="currentColor">
          ?
        </text>
      </svg>
      <span class="role-label">{index + 1}번 패</span>
    </span>
  );
}

export function RolePick(): JSX.Element | null {
  const p = pack.value;
  const [picked, setPicked] = useState<number | null>(null);
  const [chosen, setChosen] = useState<RoleId | null>(null);
  const [pickingLook, setPickingLook] = useState(false);
  /** 모습 고르기가 뜬 때(바로 뒤의 누름은 받지 않는다 — 두 번 두드려 모습이 저절로 골라지지 않게) */
  const lookShownAt = useRef(0);
  if (!p) return null;
  const { situation } = p;
  const roles = situation.roles;
  const playable = playableRoles(p);
  if (playable.length === 0) return null;
  // 처음에는 뽑고, 그 이야기를 깬 뒤나 고르는 이야기에서는 고른다
  const choosing = situation.pickBy === 'choose' || (save.value.cleared[situation.id]?.length ?? 0) > 0;
  const dealt = !choosing && picked !== null ? deal(roles, playable, seed.value, picked) : null;
  const roleId: RoleId | null = choosing ? chosen : dealt && picked !== null ? dealt[picked] : null;
  const role = roleId ? (roles.find((r) => r.id === roleId) ?? null) : null;
  const someSoon = playable.length < roles.length;

  // ── 모습 고르기 ──
  if (role && pickingLook) {
    return (
      <main class="screen rolepick season-spring">
        <header class="role-head">
          <div>
            <p class="kicker">
              {situation.year}년 · {role.label}
            </p>
            <h1 class="screen-title">어떤 모습으로 살아 볼까요?</h1>
            <p class="role-guide">이 집의 아이는 남자아이일 수도, 여자아이일 수도 있어요. 모습에 따라 갈 수 있는 길이 조금 달라요.</p>
          </div>
          <button type="button" class="btn small" onClick={() => setPickingLook(false)}>
            <span aria-hidden="true">← </span>앞으로
          </button>
        </header>
        <div class="look-cards">
          {role.looks.map((look) => (
            <button key={look} type="button" class="look-card" onClick={() => Date.now() - lookShownAt.current > 400 && settleRole(role.id, look)}>
              <span class="look-figure" aria-hidden="true">
                <Figure story={situation.id} pic={heroName(role.id, look)} sprite={heroName(role.id, look)} fill={0.92} act="walk" />
              </span>
              <span class="look-label">{LOOK_LABELS[look]}</span>
              <span class="look-go">{ro(LOOK_LABELS[look])} 살기 ▶</span>
            </button>
          ))}
        </div>
      </main>
    );
  }

  // ── 집 뽑기 · 고르기 ──
  const next = (): void => {
    if (!role) return;
    if (role.looks.length > 1) {
      lookShownAt.current = Date.now();
      setPickingLook(true);
    } else settleRole(role.id, role.looks[0]);
  };

  return (
    <main class="screen rolepick season-spring">
      <header class="role-head">
        <div>
          <p class="kicker">
            {situation.year}년 · {situation.title}
          </p>
          <h1 class="screen-title">누가 될까</h1>
          <p class="role-guide">
            {choosing ? '이번에는 살아 볼 집을 골라요.' : '태어날 집은 고를 수 없었어요. 패를 한 장 뒤집어 보세요.'}
            {someSoon && ' 준비 중인 집은 아직 살아 볼 수 없어요.'}
          </p>
        </div>
        <button type="button" class="btn small" onClick={goBook}>
          <span aria-hidden="true">← </span>이야기책
        </button>
      </header>

      <div class="role-cards" style={{ '--role-count': String(roles.length) }}>
        {!choosing &&
          roles.map((_, index) => {
            if (!dealt) {
              return (
                <button key={index} type="button" class="role-card back" onClick={() => setPicked(index)}>
                  <CardBack index={index} />
                </button>
              );
            }
            const shown = roles.find((r) => r.id === dealt[index]) as RoleDef;
            const mine = index === picked;
            const soon = !playable.includes(shown.id);
            return (
              <div key={index} class={`role-card face${mine ? ' mine' : ''}${soon ? ' soon-card' : ''}`}>
                <RoleFace story={situation.id} role={shown} />
                {mine ? <span class="role-tag">내가 태어난 집</span> : soon ? <span class="soon">준비 중</span> : <span class="role-tag-none" />}
              </div>
            );
          })}

        {choosing &&
          roles.map((r) => {
            if (!playable.includes(r.id)) {
              return (
                <div key={r.id} class="role-card face soon-card" role="group" aria-label={`${r.label}, 준비 중`}>
                  <RoleFace story={situation.id} role={r} />
                  <span class="soon">준비 중</span>
                </div>
              );
            }
            const mine = chosen === r.id;
            return (
              <button key={r.id} type="button" class={`role-card face${mine ? ' mine' : ''}`} aria-pressed={mine} onClick={() => setChosen(r.id)}>
                <RoleFace story={situation.id} role={r} />
                {mine ? <span class="role-tag">이 집으로</span> : <span class="role-tag-none" />}
              </button>
            );
          })}
      </div>

      <footer class="role-foot">
        {role ? (
          <>
            <p class="role-say">{choosing ? `${role.label}의 한 해를 살아 보아요.` : `${ro(role.label)} 태어났어요.`}</p>
            <button type="button" class="btn primary" onClick={next}>
              {role.looks.length > 1 ? '모습 고르러 가기' : `${ro(role.label)} 한 해 살기`}
            </button>
          </>
        ) : (
          <p class="role-say wait">{choosing ? '집을 골라 주세요.' : '패를 골라 주세요.'}</p>
        )}
      </footer>
    </main>
  );
}
