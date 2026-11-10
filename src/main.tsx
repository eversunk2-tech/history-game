import { render } from 'preact';
import 'pretendard/dist/web/variable/pretendardvariable.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/screens.css';
import './styles/map.css';
import './styles/band.css';
import './styles/talk.css';
import './styles/device.css';
import './styles/plays.css';
import './styles/quiz.css';
import './styles/battle.css';
import './styles/hub.css';
import { App } from './app/App';
import { bundle4 } from './content';
import { errorsOf, formatIssue, validateContent } from './content/validate';
import { openFromUrl } from './state/store';
import { watchForNewBuild } from './state/update';

// 만드는 동안에는 콘텐츠 검사기의 잘못을 콘솔에 알린다(빈 곳 알림은 시험에서 본다).
if (import.meta.env.DEV) {
  const errors = errorsOf(validateContent(bundle4));
  if (errors.length > 0) console.error(['콘텐츠 검사기가 잘못을 찾았다:', ...errors.map(formatIssue)].join('\n'));
}

openFromUrl();
// 한참 가려졌다 돌아왔을 때 새 판이 올라와 있으면 저장하고 조용히 다시 연다(빌드본에서만 뜻이 있다)
watchForNewBuild();

const root = document.getElementById('app');
if (root) render(<App />, root);
