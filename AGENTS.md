# AGENTS.md

- CLAUDE.md는 `@AGENTS.md` 한줄만 유지한다.
- 저장소 루트가 배포 패키지 `lastframe`이고, `demo/`는 그 패키지를 `workspace:*`로 쓰는 비공개 데모 앱이다.
- 데모와 `check:package`는 `dist/`를 읽으므로 `pnpm build` 뒤에 실행한다. `pnpm demo`와 `pnpm demo:build`는 빌드를 포함한다.
- 부트 스크립트 변형 파일 이름은 `tsdown.config.ts`와 `src/build/boot-script.ts`가 함께 소유한다.
- `.github/workflows/pr.yml`의 워크플로 이름 "Pull Request"는 `release.yml`의 `workflow_run` 트리거가 참조하므로 바꾸지 않는다.
