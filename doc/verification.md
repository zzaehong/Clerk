# PoC 진행 및 검증 기록

검증일: 2026-09-26. 기준 문서: `doc/prompt.md` 전체. 저장소에 별도 제품 기획서 및 기존 구현은 없었음.

> 1~10절은 초기 작업 당시의 기록입니다. 현재 상태는 아래 최신 정리 및 11절을 우선합니다.

## 최신 정리 (2026-09-26)

- 구현: 최소 작업 UI, 승인·질문·중지, 로그인 시작/취소, Windows 작업 환경 준비, 오류 상세·재연결, 내장 Windows Codex 런타임 실행, Job Object 기반 프로세스 트리 정리, NSIS 패키징.
- 이번 검증: `npm test` **10/10 통과**, `npm run build` **통과**. 실제 계정/모델 호출은 이번 정리에서 수행하지 않음.
- 기존 산출물 확인: Windows 실행 파일 및 NSIS 설치 파일 존재. `.local/windows-ui.png`에서 Clerk 화면, “Codex 연결됨”, 활성화된 폴더 열기 버튼 확인. 기존 파일을 조사한 결과이며 설치·실행을 이번에 재현한 것은 아님.
- 미완료: GUI 폴더 선택부터 승인·파일 생성까지의 전체 흐름, 로그인 완료, 질문/중지, Windows 보호 환경 준비, 종료 시 하위 프로세스 정리의 실동작 검증. 파일 트리·사용량·재개 UI 및 문서 형식 검증도 남음.

## 1. 구현된 범위

최소 파일 생성 시나리오를 위한 Tauri 2 데스크톱 소스, React UI, 로컬 폴더 선택, Codex stdio 실행·초기화, 새 채팅과 자연어 작업 시작, 실시간 응답, 작업 종료/중지, 명령·파일 변경 승인, 사용자 질문 답변, 원문 오류 표시를 구현했다.

UI는 채팅/작업 용어를 사용한다. 내부 공식 API 명칭은 유지한다. 네이티브 빌드가 막혀 있어 위 GUI 기능은 코드 구현 상태이며 실제 동작 확인 상태와 구분한다.

## 2. 실제 확인한 시나리오

같은 `src/bridge.ts`에 Node stdio 전송기를 연결하여 **실제 설치된 Codex**로 확인했다. 자동 단위 테스트에서는 모델 서비스 호출이 없다.

- app-server 초기화, 계정 읽기: ChatGPT 로그인 확인(계정 식별정보는 기록하지 않음).
- 지정한 테스트 폴더에서 새 채팅 생성 및 작업 시작 성공.
- 첫 실행: 파일 변경 승인 이벤트를 거부. 작업은 종료되었지만 파일은 생성되지 않음. 초기 검증 스크립트는 이를 `ENOENT`로 표시했으며, 이후 거부 실행은 파일 부재를 기대하는 검사로 정리함.
- 두 번째 실행: `.local/smoke/test.md` 한 파일의 추가 변경만 허용. 실제 Markdown에 할 일 3개 생성. 응답 delta 수신 및 `completed` 종료 확인.
- 서버의 실제 변경 이벤트에 파일 경로·추가 유형·diff가 있고, 승인 이벤트는 이 항목의 ID를 참조한다는 점 확인. UI에서도 항목 이벤트를 보관하여 승인 요청과 연결함.
- TypeScript 검사 및 Vite 프로덕션 빌드 통과.
- Bridge 단위 테스트: 초기화 순서, 작업 위치/정책, ID 0, 승인 자동 허용 방지, 응답 순서 역전, 스트리밍, 종료, 오류/타임아웃, 미지원 요청 거부, 질문 답변, 취소된 요청, 이전 연결 이벤트 무시 확인.

이는 **GUI에서 승인을 클릭하여 파일을 생성한 검증은 아님**. 실제 테스트 파일은 Git에서 제외된 `.local/`에 있으며, 사용자 원본 문서는 변경하지 않았다.

## 3. 환경

- Ubuntu 24.04.4 LTS / WSL2 Linux x86_64
- 커널 6.18.33.2-microsoft-standard-WSL2
- Codex CLI 0.157.0 / Node.js 24.19.0
- DISPLAY 및 Wayland 환경 변수 존재. 이것만으로 데스크톱 실행 성공으로 판단하지 않음.
- Rust/Cargo, pkg-config, WebKitGTK 개발 패키지가 없음.

## 4. 현재 차단 지점 및 미검증 범위

`npm run tauri build -- --debug --no-bundle`은 `cargo metadata` 실행 파일을 찾을 수 없어 실패했다. 승인받아 apt 설치를 시도했지만 `sudo: a password is required`로 진행하지 못했다. 사용자에게 별도 터미널에서 시스템 패키지를 설치하도록 요청한 상태다. 암호를 수집하거나 권한을 우회하지 않았다.

네이티브 컴파일, 창 실행, 폴더 선택 대화상자, GUI에서 승인/질문/작업 중지, 앱 종료 시 자식 프로세스 정리 모두 실제 GUI 검증이 남아 있다.

`prompt.md` Step 5의 데스크톱 핵심 시나리오 검증 전 부가 기능 확장 금지를 따른다. 따라서 Step 6의 파일 트리, 사용량 UI, 재실행 후 채팅 재개, 새 채팅 버튼, 상세 Error UX와 Step 7의 문서 검증은 보류했다. Bridge의 사용량 조회/재개 함수는 공식 API 매핑만 있으며 UI 연결 및 실사용 검증은 아직 없다.

## 5. 확인한 공식 인터페이스와 제약

참고: https://learn.chatgpt.com/docs/app-server 및 설치된 CLI의 `app-server generate-ts` 출력. 사용 타입은 `src/protocol/`에 보관하며 버전은 `VERSION`에 기록한다.

| 목적 | 공식 인터페이스 |
| --- | --- |
| 로컬 실행 | `codex app-server --listen stdio://` |
| 초기화 | `initialize` → `initialized` |
| 계정/사용량 | `account/read`, `account/rateLimits/read` |
| 채팅 시작/재개 | `thread/start`, `thread/resume` |
| 작업/중지 | `turn/start`, `turn/interrupt` |
| 스트리밍/종료 | `item/agentMessage/delta`, `turn/completed` |
| 명령/파일 승인 | `item/commandExecution/requestApproval`, `item/fileChange/requestApproval` |
| 질문 | `item/tool/requestUserInput` |
| 요청 만료/해결 | `serverRequest/resolved` |

- CLI 도움말은 app-server 및 타입 생성기를 experimental로 표시한다. 버전 변화에 따른 프로토콜 회귀 검증이 필요하다.
- 질문 요청도 생성 타입에서 experimental이다. 현재 모델/설정에서 실제 질문 도구가 호출되는지 아직 확인하지 못했다.
- app-server의 서버 요청은 응답 대기 중이다. 요청 ID를 그대로 사용하며 승인·질문을 자동 처리하지 않는다.
- 명령·파일 승인 이외의 MCP elicitation, 추가 권한, legacy 승인 등의 요청은 이 작은 구현에서 지원하지 않는다. 미지원 요청은 명시적으로 거부하며 기능이 실패할 수 있다.
- Codex 설정/기존 규칙/조직 정책이 유효 권한 및 승인에 영향을 줄 수 있다. 설치 명령의 승인 강제 여부는 별도 실제 검증이 필요하다.
- 사용량 응답에는 여러 버킷과 기간 정보가 존재한다. 아직 조회하지 않았으며 5시간/주간 수치를 추정하거나 0으로 표시하지 않는다.
- 재개 응답에 pagination cursor가 존재한다. 향후 기존 대화 표시 시 전체 이력이 항상 한 응답에 있다고 가정하면 안 된다.

## 6. 문서 형식별 결과

| 형식 | 결과 |
| --- | --- |
| Markdown | 새 파일 생성, 할 일 3개, 승인 허용/거부 검증 |
| TXT / JSON / CSV | 미검증 |
| PDF | 미검증: 읽기·비교·참조 문서 생성 모두 남음 |
| DOCX | 미검증: 읽기·생성·수정·서식 보존 모두 남음 |
| XLSX | 미검증: 읽기·셀 수정·추가·수식/서식 보존 모두 남음 |
| PPTX | 미검증: 읽기·생성·수정·레이아웃 보존 모두 남음 |

데스크톱 핵심 시나리오 및 P0가 안정화된 뒤, 원본을 보존한 테스트 복사본으로 진행한다. 문서 처리 도구는 앱에 미리 내장하지 않는다.

## 7. 설치 및 의존성

Codex가 문서 처리를 위해 추가 설치한 의존성: **없음**. 해당 단계에 도달하지 않았으며 테스트는 모든 명령 실행 승인을 거부했다.

프로젝트 의존성:

| 의존성 | 필요성 |
| --- | --- |
| React, React DOM | 입력·이벤트·승인·질문 화면 |
| @tauri-apps/api | 데스크톱 IPC 및 실시간 Channel |
| @tauri-apps/cli | 네이티브 개발/빌드 명령 |
| TypeScript, React 타입 | 정적 타입 검사 |
| Vite | React/TS 정적 자산 빌드, 개발 중 UI 제공 |
| Rust tauri, tauri-build | 데스크톱 창, IPC, 빌드 설정 |
| Rust tauri-plugin-dialog | 운영체제 폴더 선택기 |
| Rust serde, serde_json | 공식 JSON 프로토콜 직렬화 |

npm 설치 완료 및 lockfile 생성, 당시 audit 취약점 0건. Rust 의존성은 Cargo가 없어 설치/해석/lockfile 생성 미완료. 시스템 패키지 설치도 미완료. 테스트 프레임워크는 Node 내장 기능을 사용한다.

## 8. 남은 기술적 위험

- 네이티브 코드가 아직 컴파일되지 않아 Rust/Tauri API 호환성은 확인되지 않았다.
- 시작 메뉴에서 실행할 때 Codex PATH 및 플랫폼별 설치 방식이 달라질 수 있다. Windows/macOS는 미검증이다.
- 앱 종료 시 Codex 직계 자식은 종료하도록 구현했지만 진행 중인 외부 명령의 모든 하위 프로세스 정리는 검증하지 못했다.
- 연결 유실/타임아웃 직전에 시작된 작업은 실행 여부가 불확실할 수 있다. 현재 자동 재시도하지 않으며 재연결과 실제 파일 확인이 필요하다.
- 원문 stderr는 개발 실행의 stderr에 전달하고 UI 전달 이벤트를 제공한다. 별도 영구 진단 로그 저장·회전은 구현하지 않았다.
- 작업 중 UI 수신 데이터는 메모리에만 있다. 장시간 대화의 메모리 사용 및 큰 프로토콜 메시지는 아직 검증하지 않았다.

## 9. 다음 순서

1. 사용자가 Tauri 시스템 의존성 설치 후 Rust 버전을 확인한다.
2. 네이티브 빌드 오류를 해결하고 실제 창을 실행한다.
3. GUI 폴더 선택 → 자연어 입력 → 파일 변경 승인/거부 → 결과 파일 확인을 검증한다.
4. 질문, 작업 중지, 연결 유실을 GUI에서 검증한다.
5. 성공 후에만 파일 트리 → 사용량 → 재개 → 새 채팅 → Error UX 순서로 확장한다.
6. 앱 재실행과 대화 이어하기를 확인한 다음 실제 문서 형식과 설치 승인 시나리오를 수행한다.

**완료 판정: 전체 PoC 미완료. 실제 Codex 파일 생성 통신 검증과 최소 GUI 소스까지 완료.**


## 10. 시스템 패키지 설치 후 추가 확인

사용자가 apt 명령 실행을 알린 뒤 호스트 환경에서 재확인했다. 제한된 실행 환경에는 설치 결과가 보이지 않았으나, 호스트에는 Cargo 1.75.0, rustc 1.75.0, WebKitGTK 2.52.6이 설치되어 있었다.

`npm run tauri build -- --debug --no-bundle`을 다시 실행했다. 프런트엔드 빌드는 통과했고 Cargo 의존성 다운로드 단계로 진행했으나, `dlopen2 0.8.2`의 `edition2024`를 Cargo 1.75가 지원하지 않아 실패했다. Cargo.lock은 생성되었지만 네이티브 컴파일은 미완료다. 이전 절의 시스템 패키지 미설치 상태는 과거 기록이며, 현재 차단 원인은 Rust 도구 체인의 구버전이다.

README에 rustup stable 설치, 동일 터미널에서 환경 적용, 로그인 확인, 빌드 및 실행 절차를 추가했다. Rust 업데이트 이후 빌드와 GUI 실행은 아직 검증하지 않았다.


## 11. 커밋 시점의 구현·산출물 정리

현재 소스에는 초기 기록 이후 다음 작업이 추가되어 있다.

- `src/main.tsx`, `src/bridge.ts`: 로그인 시작/취소, 브라우저 다시 열기, Windows 작업 환경 준비, 사용자용 오류 설명과 원문 상세, 재연결.
- `src-tauri/src/main.rs`: Windows 내장 app-server 실행, 로그인 URL의 HTTPS 및 호스트 제한, 브라우저 열기. 다른 운영체제는 PATH의 Codex를 사용한다.
- `src-tauri/src/process_tree.rs`: Windows Job Object를 이용한 하위 프로세스 종료 구현. 실제 종료 동작 검증은 남아 있다.
- `scripts/prepare-windows.mjs`: Codex 0.157.0 Windows 패키지 다운로드 및 고정 SHA-256 검사. 원본 라이선스·NOTICE·출처 메타데이터를 보관한다.
- `src-tauri/tauri.conf.json`: 사용자 단위 NSIS 설치, 한국어/영어 선택, 런타임 리소스 및 WebView2 설치 설정.
- `scripts/windows-*.ps1`: 설치·런타임 연결·WebView 검사 보조 스크립트. 스크립트 존재 자체를 실행 성공으로 간주하지 않는다.
- 아이콘 소스와 플랫폼별 아이콘, npm/Cargo lockfile 포함. 추가 Rust 의존성은 브라우저 열기용 `tauri-plugin-opener`와 Windows Job Object용 `windows-sys`다.

이번에 확인한 기존 산출물:

| 파일 | 크기 | 확인 범위 |
| --- | ---: | --- |
| `src-tauri/target/x86_64-pc-windows-msvc/release/clerk.exe` | 9,315,328 bytes | 파일 존재 |
| `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/Clerk_0.1.0_x64-setup.exe` | 85,500,761 bytes | 파일 존재 |
| `.local/windows-ui.png` | 기존 화면 자료 | 초기 화면과 Codex 연결 표시 |

현재 Rust/Cargo는 1.98.1이다. 초기의 Cargo 부재/1.75 차단 기록은 현 상태를 나타내지 않는다. 기존 바이너리가 이번 소스와 정확히 일치하는지, 새 환경에서도 빌드·설치가 재현되는지는 이번 정리에서 확인하지 않았다.

Git에는 소스·문서·아이콘·잠금 파일·런타임 출처 및 라이선스를 포함한다. `node_modules`, `dist`, `.local`, Cargo 산출물, 다운로드한 Codex 실행 파일은 제외한다.

다음 작업은 Windows GUI에서 테스트 폴더 선택 → 요청 → 승인 거부/허용 → 실제 파일 확인을 기록하는 것이다. 이어 로그인, 질문, 중지, 재연결 및 프로세스 정리를 확인하고, 핵심 시나리오가 확인된 뒤 P0와 문서 형식 검증을 진행한다. 전체 PoC 완료로 판정하지 않는다.
