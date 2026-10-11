# AGENTS.md

- CLAUDE.md는 `@AGENTS.md` 한줄만 유지한다.
- 저장소 루트가 배포 패키지 `lastframe`이고, `demo/`는 별도 package.json 없이 루트 의존성으로 도는 데모다. Vite가 자기 참조로 `dist/`를 읽는다.
- pnpm workspace(`packages`)를 다시 두지 않는다. workspace가 있으면 Changesets가 루트 패키지를 찾지 못해 릴리스가 실패한다.
- 데모와 `check:package`는 `dist/`를 읽으므로 `pnpm build` 뒤에 실행한다. `pnpm demo`와 `pnpm demo:build`는 빌드를 포함한다.
- 부트 스크립트 변형 파일 이름은 `tsdown.config.ts`와 `src/build/boot-script.ts`가 함께 소유한다.
- npm trusted publisher는 `npm stage publish`만 허용한다. `release.yml`은 stage까지만 하고, npm 승인 뒤 `github-release.yml`을 수동 실행해 태그와 릴리스를 만든다.
- `.github/workflows/pr.yml`의 워크플로 이름 "Pull Request"는 `release.yml`의 `workflow_run` 트리거가 참조하므로 바꾸지 않는다.
