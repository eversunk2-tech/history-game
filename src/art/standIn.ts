// 그림 파일이 없을 때 대화 장면에 세울 도트 인물의 이름을 고른다(맵의 도트 인물을 크게 키워 세운다 — Figure.tsx).
// 자료(Person.sprite)에 적힌 이름이 있으면 그것을, 없거나 아직 그려지지 않은 이름이면 성별과 나이대로 고른다.
// 어떤 사람이 와도 빈 무대가 되지 않는다. 화면을 모르는 순수 함수다(시험이 불러 본다).

import type { Person } from '../engine/types';
import { personOf } from '../pixel/people';

/** 성별과 나이대에 맞는 마을 사람(모두 src/pixel/people.ts에 있는 이름이다) */
export function standInByAge(person: Pick<Person, 'sex' | 'age'>): string {
  if (person.age === 'old') return person.sex === 'f' ? 'granny' : 'elderMan';
  if (person.age === 'child') return person.sex === 'f' ? 'girlKid' : 'boyKid';
  if (person.age === 'young') return person.sex === 'f' ? 'sister' : 'brother';
  return person.sex === 'f' ? 'wellWoman' : 'neighborMan';
}

/** 세울 도트 인물의 이름. who는 대화의 이름표 열쇠(자료에 없는 사람이면 그 이름의 도트가 있는지 본다). */
export function standInSprite(who: string, person: Person | undefined): string {
  if (person?.sprite && personOf(person.sprite)) return person.sprite;
  if (!person) return personOf(who) ? who : 'neighborMan';
  return standInByAge(person);
}
