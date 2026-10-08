// 일 놀이의 이름표: 놀이마다의 이름과, 끝난 모습으로 넘길 수 있는 값들.
// 화면을 모르는 파일이다(콘텐츠 검사기와 시험이 불러 써도 된다). 놀이의 화면은 index.ts가 잇는다.
//
// 일 놀이의 원칙(spec 5.2의 5번): 그 시대의 일을 손으로 해 보는 1~2분짜리 놀이.
// 틀림이 없고(어떻게 해도 일은 끝난다), 시간에 쫓기지 않고, "어른께 맡긴다"로 건너뛸 수 있다.

export interface PlayKind {
  title: string;
  /** 끝난 모습으로 넘기는 값(Happening.play.flags의 열쇠가 이 가운데 있어야 한다) */
  results: string[];
}

export const PLAY_KINDS: Record<string, PlayKind> = {
  /** 볍씨 뿌리기: even 고루 뿌림 · patchy 듬성듬성 · left 어른께 맡김 */
  sow: { title: '볍씨 뿌리기', results: ['even', 'patchy', 'left'] },
};
