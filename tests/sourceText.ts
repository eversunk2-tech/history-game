// 소스 글자 검사가 쓰는 것(4-1 ㉡, ㉠ 고침 바퀴 Review 권고 ㄷ): 주석을 지운 소스.
// 소스 글자로 "이 줄을 부른다"를 볼 때 주석에 속지 않게 한다 — 부르는 줄을 주석으로 남기고 다른 줄로 바꿔도 앞에는 통과했다.
//
// 지우는 것: // 한 줄 주석, /* */ 묶음 주석(JSX의 {/* */} 안도). 글자열('…', "…", `…`)과 정규식 글자(/…/) 안은 그대로 둔다.
// 줄바꿈은 남겨 줄의 차례가 그대로다(묶음 주석 안의 줄바꿈도 남긴다).
// 템플릿 글자의 ${…} 안에 또 템플릿 글자를 넣은 꼴은 따로 셈하지 않는다. 그래도 2026-11-10에 oxc 파서(rolldown/utils의 parseSync)가 찾은
// 주석 자리와 견주어 src·tests의 .ts·.tsx 148파일, 주석 5,991개에서 지운 결과가 한 글자도 다르지 않았다(Build의 스크래치 검사 — 패키지를 더하지 않으려고
// 시험에는 넣지 않았다). 까다로운 꼴은 device.test.ts의 "주석을 지운 소스" 시험이 본다.

/** 정규식 글자가 올 수 있는 자리인가: 앞의 의미 있는 글자가 이것이거나, 줄 처음이거나, 이 낱말 뒤 */
const BEFORE_REGEX = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '~', '^']);
const REGEX_WORDS = ['return', 'typeof', 'case', 'in', 'of', 'yield', 'await', 'void', 'delete', 'new', 'else', 'do'];

export function stripComments(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  /** 지금까지 내보낸 것 가운데 빈칸이 아닌 마지막 글자와 그 앞의 낱말 */
  const lastSignificant = (): { ch: string; word: string } => {
    let k = out.length - 1;
    while (k >= 0 && /\s/.test(out[k])) k--;
    if (k < 0) return { ch: '', word: '' };
    let j = k;
    while (j >= 0 && /[A-Za-z_$]/.test(out[j])) j--;
    return { ch: out[k], word: out.slice(j + 1, k + 1) };
  };
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    // 한 줄 주석
    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    // 묶음 주석(줄바꿈은 남긴다)
    if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') out += '\n';
        i++;
      }
      i += 2;
      continue;
    }
    // 글자열
    if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      out += c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\') {
          out += src[i] + (src[i + 1] ?? '');
          i += 2;
          continue;
        }
        // 홑·겹 따옴표 글자열은 줄을 넘지 않는다(JSX 글 속의 따옴표 하나가 뒤를 다 삼키지 않게)
        if (quote !== '`' && src[i] === '\n') break;
        out += src[i];
        i++;
      }
      if (i < n && src[i] === quote) {
        out += quote;
        i++;
      }
      continue;
    }
    // 정규식 글자
    if (c === '/') {
      const { ch, word } = lastSignificant();
      if (ch === '' || BEFORE_REGEX.has(ch) || REGEX_WORDS.includes(word)) {
        let k = i + 1;
        let inClass = false;
        let closed = false;
        while (k < n && src[k] !== '\n') {
          if (src[k] === '\\') {
            k += 2;
            continue;
          }
          if (src[k] === '[') inClass = true;
          else if (src[k] === ']') inClass = false;
          else if (src[k] === '/' && !inClass) {
            closed = true;
            break;
          }
          k++;
        }
        if (closed) {
          k++;
          while (k < n && /[a-z]/.test(src[k])) k++;
          out += src.slice(i, k);
          i = k;
          continue;
        }
      }
    }
    out += c;
    i++;
  }
  return out;
}
