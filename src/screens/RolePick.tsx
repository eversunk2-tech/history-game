// 누가 될까 — 모습 고르기와 집 뽑기를 떼어 둔 조각(4-1 ㉢: 첫 화면의 모습 고르기와 출전 준비가 함께 쓴다 — spec 11.1 가 2·6).
//   LookCards — 남자아이·여자아이 모습을 크게 보이고 고른다(도트 인물을 크게).
//   RoleDeal  — 신분 역할만 있는 이야기는 처음에 뒤집힌 패에서 뽑는다("태어날 집은 고를 수 없었어요" — 3판 그대로).
//               아직 만들어지지 않은 집은 뽑히지 않고 "준비 중"으로 보인다.

import type { JSX } from 'preact';
import { useRef } from 'preact/hooks';
import { Figure } from '../art/Figure';
import type { Look, RoleDef, RoleId } from '../engine/types';
import { heroName } from '../state/store';

export const LOOK_LABELS: Record<Look, string> = { boy: '남자아이 모습', girl: '여자아이 모습' };

/** 뒤집은 패에는 반드시 할 수 있는 집이 온다(씨앗으로 정한다). 나머지 패에는 다른 집들이 차례로 놓인다. */
export function deal(roles: readonly RoleDef[], playable: readonly RoleId[], seedValue: number, picked: number): RoleId[] {
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

/**
 * 집 뽑기: 뒤집힌 패를 한 장 고르면 모두 뒤집힌다. picked가 있으면 이미 뽑은 것이다(내 집에 표시).
 * 뽑은 뒤에도 다시 뽑게 하지 않는다(태어날 집은 고를 수 없었다).
 */
export function RoleDeal({
  story,
  roles,
  playable,
  seedValue,
  picked,
  onPick,
}: {
  story: string;
  roles: readonly RoleDef[];
  playable: readonly RoleId[];
  seedValue: number;
  picked: number | null;
  onPick: (index: number) => void;
}): JSX.Element {
  const dealt = picked !== null ? deal(roles, playable, seedValue, picked) : null;
  return (
    <div class="role-cards" style={{ '--role-count': String(roles.length) }}>
      {roles.map((_, index) => {
        if (!dealt) {
          return (
            <button key={index} type="button" class="role-card back" onClick={() => onPick(index)}>
              <CardBack index={index} />
            </button>
          );
        }
        const shown = roles.find((r) => r.id === dealt[index]) as RoleDef;
        const mine = index === picked;
        const soon = !playable.includes(shown.id);
        return (
          <div key={index} class={`role-card face${mine ? ' mine' : ''}${soon ? ' soon-card' : ''}`}>
            <RoleFace story={story} role={shown} />
            {mine ? <span class="role-tag">내가 태어난 집</span> : soon ? <span class="soon">준비 중</span> : <span class="role-tag-none" />}
          </div>
        );
      })}
    </div>
  );
}

/**
 * 모습 고르기: 그 집 아이의 모습 둘(도트 인물을 크게, 제자리걸음). chosen이 있으면 그 모습에 표시를 한다.
 * 뜬 바로 뒤의 누름은 받지 않는다(두 번 두드려 모습이 저절로 골라지지 않게).
 */
export function LookCards({
  story,
  role,
  looks,
  chosen,
  onPick,
  go = '살기',
}: {
  story: string;
  role: RoleId;
  looks: readonly Look[];
  chosen?: Look | null;
  onPick: (look: Look) => void;
  /** 단추 끝의 말("살기", "고르기") */
  go?: string;
}): JSX.Element {
  const shownAt = useRef(Date.now());
  return (
    <div class="look-cards">
      {looks.map((look) => (
        <button
          key={look}
          type="button"
          class={`look-card${chosen === look ? ' chosen' : ''}`}
          aria-pressed={chosen === undefined ? undefined : chosen === look}
          onClick={() => Date.now() - shownAt.current > 400 && onPick(look)}
        >
          <span class="look-figure" aria-hidden="true">
            <Figure story={story} pic={heroName(role, look)} sprite={heroName(role, look)} fill={0.92} act="walk" />
          </span>
          <span class="look-label">{LOOK_LABELS[look]}</span>
          <span class="look-go">
            {chosen === look ? '고른 모습' : `${LOOK_LABELS[look]} ${go} ▶`}
          </span>
        </button>
      ))}
    </div>
  );
}
