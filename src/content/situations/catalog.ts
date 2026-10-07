// 일곱 상황의 이름·대표 해·한 줄 소개 (spec 6.1 표).
// 여기에는 일곱 줄이 다 있고, 장면 폴더(s1395 같은)가 있는 상황만 고를 수 있다.
// 폴더가 없는 상황은 고르기 화면에 "준비 중"으로 보인다.
// 한 줄 소개는 6.1 표의 "이 상황을 고르면 겪는 것"을 카드에 들어가게 줄인 것이다(새 사실을 더하지 않았다).

import type { CatalogEntry } from '../../engine/types';

export const catalog: CatalogEntry[] = [
  {
    id: 's1395',
    group: 'early',
    year: 1395,
    title: '새 나라, 새 도읍 한양',
    blurb: '새 나라가 유교를 내세워 도읍과 궁궐을 짓는다. 마을은 아직 고려 때 그대로다.',
    lessons: '2~3',
  },
  {
    id: 's1446',
    group: 'early',
    year: 1446,
    title: '세종 때, 가르치는 나라',
    blurb: '나라가 농사와 예절과 글을 가르친다. 신분에 따라 할 수 있는 일이 갈린다.',
    lessons: '4~5·6',
  },
  {
    id: 's1592',
    group: 'middle',
    year: 1592,
    title: '임진왜란',
    blurb: '유교가 마을에 자리 잡던 때 전쟁이 닥친다. 피란과 의병, 그리고 서로 돕기.',
    lessons: '7',
  },
  {
    id: 's1636',
    group: 'middle',
    year: 1636,
    title: '병자호란과 남한산성',
    blurb: '되살아나던 마을에 겨울 전쟁이 온다. 싸울지 화해할지 내 생각을 정한다.',
    lessons: '7',
  },
  {
    id: 's1795',
    group: 'late',
    year: 1795,
    title: '달라지는 살림과 서민 문화',
    blurb: '모내기와 장터와 엽전이 살림을 바꾼다. 서민도 이야기와 놀이와 그림을 즐긴다.',
    lessons: '8·10',
  },
  {
    id: 's1863',
    group: 'late',
    year: 1863,
    title: '흔들리는 신분, 새로운 생각',
    blurb: '돈으로 양반이 되는 사람이 늘어난다. 사람은 평등하다는 생각이 들려온다.',
    lessons: '9',
  },
  {
    id: 's1899',
    group: 'opening',
    year: 1899,
    title: '전차가 달리는 한성',
    blurb: '법으로 신분이 없어진 뒤, 한성을 오가며 전차와 신문과 새 학교를 만난다.',
    lessons: '11~12',
  },
];
