// 장면 그림. 계절·장소·인물을 이름으로 받아 코드(SVG)로 그린다. 외부 그림 파일을 쓰지 않는다.
//   <Picture season="spring" place="field" people={['farmer']} />
// 지금은 임시 도형이다. 1-나에서 places.tsx·people.tsx의 그림만 갈아 끼우면 된다.

import type { JSX } from 'preact';
import type { Season } from '../engine/types';
import { Figure } from './people';
import { drawPlace } from './places';
import { INK, SEASON_TONES, type Tone } from './tones';

export interface PictureProps {
  season: Season;
  place: string;
  people?: string[];
  /** 화면 읽기 프로그램에 알려 줄 말 */
  label?: string;
}

export function Picture({ season, place, people = [], label }: PictureProps): JSX.Element {
  const tone = SEASON_TONES[season];
  const gap = 150;
  const startX = 400 - ((people.length - 1) * gap) / 2;
  return (
    <svg
      class="picture"
      viewBox="0 0 800 800"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={label ?? '장면 그림'}
    >
      <rect x="-400" y="-400" width="1600" height="1600" fill={tone.sky} />
      <path d="M-400 520 Q-100 380 200 500 Q420 400 640 490 Q900 400 1200 520 V540 H-400 Z" fill={tone.far} />
      <rect x="-400" y="520" width="1600" height="700" fill={tone.ground} />
      <path d="M-400 520 H1200" stroke={INK} stroke-width="3" fill="none" />
      <SeasonMark season={season} tone={tone} />
      {drawPlace(place, tone)}
      {people.map((name, index) => (
        <Figure key={`${name}-${index}`} name={name} x={startX + index * gap + 150} y={735} scale={0.95} />
      ))}
    </svg>
  );
}

/** 계절을 알려 주는 표시: 꽃잎, 해, 낙엽, 눈 */
function SeasonMark({ season, tone }: { season: Season; tone: Tone }): JSX.Element {
  switch (season) {
    case 'spring':
      return (
        <g fill="#e7a3ad" stroke={INK} stroke-width="2">
          {[
            [150, 150],
            [215, 215],
            [120, 250],
            [650, 170],
            [700, 250],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="15" />
          ))}
        </g>
      );
    case 'summer':
      return (
        <g stroke={INK} stroke-width="4" stroke-linecap="round">
          <circle cx="640" cy="160" r="50" fill="#f3c44e" />
          <path d="M640 80 V56 M640 264 V240 M560 160 H536 M744 160 H720 M584 104 L567 87 M713 233 L696 216 M696 104 L713 87 M567 233 L584 216" fill="none" />
        </g>
      );
    case 'autumn':
      return (
        <g fill={tone.accent} stroke={INK} stroke-width="2">
          {[
            [150, 170, -20],
            [230, 250, 25],
            [640, 150, 15],
            [700, 260, -30],
            [560, 240, 40],
          ].map(([x, y, turn]) => (
            <ellipse key={`${x}-${y}`} cx={x} cy={y} rx="20" ry="10" transform={`rotate(${turn} ${x} ${y})`} />
          ))}
        </g>
      );
    case 'winter':
      return (
        <g fill="#ffffff" stroke={INK} stroke-width="2">
          {[
            [130, 140],
            [240, 220],
            [330, 120],
            [520, 180],
            [640, 110],
            [700, 250],
            [450, 260],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="9" />
          ))}
        </g>
      );
  }
}
