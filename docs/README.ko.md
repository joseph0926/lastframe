<p align="center">
  <img src="../assets/banner.svg" alt="lastframe" width="720" />
</p>

<p align="center">
  <b>자바스크립트가 도착하기 전에, 사용자가 마지막으로 본 화면을 먼저 그립니다.</b><br />
  클라이언트 렌더링 앱의 재방문을 즉시 보여 줍니다. SSR도 프레임워크 이전도 필요 없습니다.
</p>

<p align="center">
  <a href="https://joseph0926.github.io/lastframe/"><b>라이브 데모</b></a> (페이지를 새로고침해 보세요)
  &nbsp;|&nbsp; <a href="../README.md">English</a>
</p>

---

클라이언트 렌더링 앱은 번들을 내려받고 실행해 첫 화면을 그리기 전까지 쓸 만한 것을 보여 주지 못합니다. 휴대폰이나 느린 네트워크에서는 하루에 스무 번 여는 앱이라도 매번 몇 초씩 빈 화면을 봅니다.

Lastframe은 사용자가 페이지를 떠날 때의 모습을 기억해 두었다가, 다음 방문에서 번들이 도착하기도 전에 그 화면을 다시 그립니다. 앱이 준비되면 저장된 화면이 실제 UI로 자연스럽게 바뀝니다.

<p align="center">
  <img src="../assets/revisit.svg" alt="Lastframe이 없으면 번들이 로드될 때까지 빈 화면이고, 있으면 마지막 화면이 거의 즉시 나타납니다." width="760" />
</p>

- **프레임워크 독립 코어**: React는 `createRoot` 교체 한 줄, Vue, Svelte, Solid, 순수 DOM은 `ready()` 한 줄
- **작은 부트 경로**: gzip 약 4 KB의 독립 스크립트가 IndexedDB 레코드 하나를 읽어 그립니다
- **구조적으로 안전**: 저장된 화면은 앱 컨테이너 밖의 비활성 오버레이로만 그려지고 정제(sanitize)됩니다. 앱은 손대지 않은 요소에 렌더링하고, 저장된 화면은 클릭되지 않습니다
- **개인정보 보호 수단**: 저장 전에 내용을 스켈레톤으로 가리기(mask), 요소 제외, 사용자별 scope, 로그아웃 시 삭제
- **Vite 7, 8 플러그인**과 번들러에 무관한 빌드 헬퍼

## 설치

```bash
npm install lastframe
```

## 빠른 시작 (Vite + React)

**1. 다시 보여 줄 경로를 적습니다.** 경로를 적기 전에는 아무것도 저장하지 않습니다.

```ts
// vite.config.ts
import react from '@vitejs/plugin-react';
import { lastframe } from 'lastframe/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), lastframe({ routes: ['/', '/inbox', '/projects/:id'] })],
});
```

**2. import 하나를 바꿉니다.**

```tsx
// main.tsx
import { createRoot } from 'lastframe/react'; // 'react-dom/client' 대신

createRoot(document.getElementById('root')!).render(<App />);
```

끝입니다. 첫 방문에서 화면을 저장하고, 이후 모든 재방문은 그 화면으로 시작합니다.

### 실제 내용이 그려질 때까지 기다리기

첫 렌더가 로딩 상태라면, 첫 commit에서 저장 화면을 걷을 때 사용자는 이미 본 내용 뒤에 스피너를 다시 보게 됩니다. 데이터가 화면에 나올 때까지 저장 화면을 유지하세요.

```tsx
import { createRoot, useFrameReady } from 'lastframe/react';

createRoot(container, { waitForReady: true }).render(<App />);

function Inbox() {
  const { data } = useQuery(inboxQuery);
  useFrameReady(data !== undefined);
  // ...
}
```

ready 조건은 "서버가 응답했다"가 아니라 "로컬이나 캐시 데이터가 그려졌다"여야 합니다. `ready`가 오지 않아도 정책의 `timeout`(기본 10초)이 지나면 저장 화면을 걷습니다.

### 다른 프레임워크

코어는 요소에 렌더링하는 어떤 앱에서도 동작합니다. UI가 화면에 나온 뒤 `ready()`를 호출하세요.

```ts
import { ready } from 'lastframe';

createApp(App).mount('#root'); // Vue
ready();
```

앱이 `#root`에 렌더링하지 않는다면 플러그인 옵션의 `root`를 바꾸거나 `ready({ root: element })`로 요소를 넘기세요.

### 다른 번들러

`lastframe/build`가 정책에 맞는 부트 스크립트를 돌려줍니다. 번들보다 앞, `<head>` 맨 위의 일반 `<script>`에 넣으세요.

```ts
import { renderBootScript } from 'lastframe/build';

const code = await renderBootScript({ routes: ['/', '/inbox'] });
html = html.replace('<head>', () => `<head><script>${code}</script>`);
```

## 동작 방식

1. **캡처.** `ready()` 이후 앱 root, 그 root를 꾸미는 CSS, `<html>`과 `<body>`의 모습을 직렬화합니다. 페이지가 한가할 때 한 번, 숨겨지거나 닫힐 때마다 다시 저장합니다. 저장 위치는 IndexedDB이고 키는 경로입니다.
2. **페인트.** 다음 방문에서 부트 스크립트가 번들보다 먼저 실행되어 현재 경로의 화면을 읽고, 정제한 뒤 shadow root 안의 고정 오버레이로 그립니다. 앱 컨테이너는 건드리지 않습니다.
3. **핸드오프.** 앱은 그 아래에서 렌더링합니다. `ready()`는 실제 UI가 나타나는 같은 프레임에 오버레이를 걷고, 지원되는 브라우저에서는 View Transition으로 교차 페이드합니다. `:root`, `html`, `body` 선택자는 대역 요소를 가리키도록 다시 써서, 캡처한 CSS가 shadow root 안에서도 동작합니다.

## 옵션

모든 옵션은 Vite 플러그인(또는 `renderBootScript`)에 넘깁니다. 빌드 시점에 검증하므로 오타가 있으면 조용히 꺼지는 대신 빌드가 실패합니다.

| 옵션        | 기본값      | 설명                                                                                                         |
| ----------- | ----------- | ------------------------------------------------------------------------------------------------------------ |
| `routes`    | 필수        | 저장하고 복원할 경로. `:param`은 한 세그먼트, 끝의 `*`는 나머지 전체와 일치합니다. 정확한 경로가 우선합니다. |
| `mask`      | `false`     | `true`면 페이지 전체를 스켈레톤으로 저장하고, 선택자 목록이면 일치하는 요소만 가립니다.                      |
| `exclude`   | `[]`        | 모든 화면에서 제거할 선택자. 토스트, 열린 모달, 채팅 위젯 등.                                                |
| `version`   | 없음        | 다른 버전에서 저장한 화면은 버립니다. 배포 식별자를 넣으면 배포 뒤 옛 UI를 보여 주지 않습니다.               |
| `ttl`       | 7일         | 저장 화면의 최대 수명(밀리초).                                                                               |
| `timeout`   | 10 000      | `ready()`가 없어도 그린 뒤 이 시간이 지나면 저장 화면을 걷습니다(밀리초).                                    |
| `maxBytes`  | 1 MiB       | 이보다 큰 화면은 저장하지 않습니다.                                                                          |
| `maxFrames` | 50          | 가장 최근 화면만 이 개수만큼 남깁니다.                                                                       |
| `styles`    | `true`      | CSS를 함께 저장합니다. 스타일시트에 사용자 데이터가 들어갈 수 있다면 끄세요.                                 |
| `root`      | `'#root'`   | 앱이 렌더링하는 요소.                                                                                        |
| `inline`    | `false`     | Vite 전용. 해시 파일 대신 HTML에 인라인합니다. CSP hash나 `nonce`가 필요합니다.                              |
| `nonce`     | 없음        | Vite 전용. script 태그의 CSP nonce.                                                                          |
| `debug`     | 개발 서버만 | Vite 전용. 콘솔에 `[lastframe]` 로그를 남깁니다.                                                             |

## 개인정보와 안전

저장 화면은 화면에 있던 내용의 사본입니다. 무엇을 복사해도 되는지 정하세요.

```tsx
<span data-lastframe-mask>{user.email}</span>      {/* 스켈레톤 블록으로 저장 */}
<Toast data-lastframe-exclude />                   {/* 저장하지 않음 */}
```

- **가리기**: `data-lastframe-mask`나 `mask` 옵션을 씁니다. 저장 전에 가리므로 실제 글자와 이미지는 IndexedDB에 닿지 않습니다. 비밀번호 입력값은 항상 저장하지 않습니다.
- **사용자 scope**: 공용 컴퓨터에서 이전 사용자의 화면이 보이지 않도록 합니다. 저장 화면은 그 화면을 캡처한 scope에서만 재생됩니다.

  ```ts
  import { clearFrames, setScope } from 'lastframe';

  setScope(hash(user.id)); // 로그인 뒤, 불투명한 값을 쓰세요
  // 로그아웃 시:
  setScope(null);
  await clearFrames();
  ```

- **버전**: `version`으로 배포 뒤 옛 UI를 재생하지 않게 합니다.
- 복원 시 스크립트, 프레임, 이벤트 핸들러, 링크, 폼 전송 대상, 실행 가능한 URL을 제거합니다. 오버레이는 `inert`, `aria-hidden`이고 포인터 이벤트를 막습니다.
- IndexedDB는 암호화되지 않습니다. 같은 출처 저장소의 다른 데이터와 똑같이 다루세요.
- 저장 화면은 캐시입니다. 여러 탭이 같은 경로를 보여 주면 마지막으로 캡처한 탭의 화면이 남고, 쓰기에 실패하면 다음 방문이 평소처럼 빈 화면에서 시작할 뿐입니다.

## API

전체 API는 [영문 README](../README.md#api)를 참고하세요. 핵심은 `ready()`, `capture()`, `onCapture()`, `setScope()`, `clearFrames()`, `getRestoredFrame()`(코어)와 `createRoot()`, `useFrameReady()`(React)입니다.

## 언제 쓰나

| 잘 맞는 경우                                   | 다른 선택지가 나은 경우                        |
| ---------------------------------------------- | ---------------------------------------------- |
| 하루에도 여러 번 여는 대시보드, 관리 도구, CRM | 첫 방문 성능과 SEO: 서버 렌더링이나 정적 생성  |
| SSR을 도입할 수 없는 클라이언트 렌더링 앱      | 잠깐이라도 오래된 데이터를 보이면 안 되는 화면 |
| 느린 기기와 네트워크                           | 재방문이 드문 페이지                           |

## FirstTx에서 옮겨 오기

Lastframe은 `@firsttx/prepaint`의 후속 프로젝트입니다. [마이그레이션 가이드](./migration.md)를 참고하세요.

## 라이선스

MIT © [joseph0926](https://github.com/joseph0926)
