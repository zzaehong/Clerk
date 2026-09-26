# Clerk

로컬 Codex CLI에 GUI를 덧붙이는 Tauri 2 + React + TypeScript 기술 PoC입니다. 사용자가 폴더를 열고 하고 싶은 일을 입력하면, 해당 폴더를 작업 위치로 지정한 로컬 Codex가 처리합니다.

**현재 상태: 최소 작업 UI와 Windows 배포 코드 구현, Windows 실행 파일·NSIS 설치 파일 및 초기 연결 화면 자료 확인. GUI에서 파일 생성·승인까지 수행하는 전체 시나리오는 검증이 남아 있으며, 전체 PoC는 미완료입니다.**

2026-09-26 정리 기준 `npm test` 10개와 `npm run build`가 통과했습니다. 기존 통신 검증, 현재 산출물, 남은 검증은 [검증 기록](doc/verification.md)에 구분해 기록했습니다.

`doc/prompt.md`를 작업 기준으로 사용했습니다. 별도 제품 기획서는 저장소에 없었습니다. 요청된 단계 순서에 따라 데스크톱에서 핵심 시나리오를 확인하기 전에는 파일 목록·사용량 표시·채팅 재개·문서 형식 검증으로 확장하지 않습니다.

## 실행 준비

소스 빌드에는 Node.js 22.18 이상, 최신 stable Rust/Cargo 및 Tauri 2의 플랫폼별 빌드 의존성이 필요합니다. 기존 통신 검증에 사용한 Codex는 **0.157.0**, Node는 **24.19.0**입니다. Linux/macOS에서는 GUI 프로세스의 PATH에서 `codex`를 찾을 수 있어야 합니다. Windows 패키지는 Codex 런타임을 포함하며, 앱에 ChatGPT 로그인 UI가 구현되어 있습니다.

### Windows 패키지

```bash
npm ci
npm run build:windows
```

Windows 빌드 환경에서 실행합니다. 준비 스크립트는 Codex 0.157.0 배포 압축 파일의 고정 SHA-256을 확인한 뒤 런타임을 배치합니다. NSIS 설치 프로그램은 현재 사용자용이며, WebView2가 없으면 설치 부트스트래퍼를 사용하도록 설정되어 있습니다.

현재 작업 폴더에는 `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/Clerk_0.1.0_x64-setup.exe`가 있습니다. 실행 파일·설치 파일·다운로드한 런타임은 Git에서 제외합니다. `scripts/cross-build.sh`는 로컬 cargo-xwin/LLVM/NSIS 환경을 사용하는 WSL 교차 빌드 보조 스크립트이며, 해당 도구 환경은 저장소에 포함하지 않습니다.

### Linux 개발 실행

Ubuntu 24.04에서 필요한 시스템 패키지:

```bash
sudo apt-get update
sudo apt-get install -y pkg-config build-essential libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

초기 설치 당시 호스트에서 Cargo/Rust 1.75.0과 WebKitGTK 2.52.6을 확인했습니다. 이번 정리 시점의 Rust/Cargo는 1.98.1입니다. Ubuntu의 `cargo rustc` 패키지로 설치된 1.75는 현재 의존성의 Rust 2024 형식을 지원하지 않아 빌드에 실패합니다. 아래와 같이 [Rust 공식 설치 방법](https://rust-lang.org/tools/install/)인 rustup으로 stable 도구 체인을 설치하세요. 이미 위 시스템 패키지를 설치했다면 apt 명령은 반복할 필요가 없습니다.

WSL Ubuntu 터미널에서 실행합니다. Rust 설치 명령에는 `sudo`를 붙이지 않습니다.

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain stable
source "$HOME/.cargo/env"
rustup update stable
rustup default stable
cargo --version
rustc --version
```

`cargo --version`이 계속 1.75라면 같은 터미널에서 `source "$HOME/.cargo/env"`를 다시 실행하세요. 아래 빌드·실행도 그 터미널에서 진행합니다.

```bash
cd /home/zzaehong/projects/Clerk
codex login status
npm ci
npm run build
npm test
npm run tauri build -- --debug --no-bundle
./src-tauri/target/debug/clerk
```

`codex login status`가 미로그인 상태라면 먼저 `codex login`으로 로그인합니다. 빌드가 성공한 뒤 마지막 명령이 Clerk 창을 엽니다. Linux 네이티브 빌드와 실제 창 실행은 이번 정리에서 재검증하지 않았습니다. 빌드 오류가 나면 실행 파일이 준비된 것으로 간주하지 마세요.

한 번 빌드가 성공한 후에는 다음 명령만으로 다시 실행합니다.

```bash
cd /home/zzaehong/projects/Clerk
./src-tauri/target/debug/clerk
```

빌드한 앱은 정적 UI를 내장하며 별도 웹서버가 필요하지 않습니다. 개발 시에만 `npm run tauri dev`로 Vite 개발 서버를 사용합니다. Windows는 기존 빌드 산출물과 초기 연결 화면 자료가 있으며, macOS는 미검증입니다. WSL에서 빌드하면 Linux 앱이며, Windows 네이티브 앱을 검증한 것이 아닙니다.

## 현재 사용 흐름

1. **폴더 열기**로 테스트 폴더를 선택합니다.
2. “이 폴더에 test.md를 만들고 오늘 할 일을 3개 적어줘.”라고 입력합니다.
3. Codex 응답을 확인하고 필요한 파일 변경 또는 명령 실행을 **거부 / 이번만 허용**합니다.
4. 질문이 도착하면 답변을 입력합니다. 실행 중에는 **작업 중지**를 사용할 수 있습니다.
5. 파일은 선택한 폴더에서 직접 확인합니다.

기존 Codex 로그인을 사용하거나 앱의 ChatGPT 로그인 버튼으로 브라우저 인증을 시작할 수 있습니다. 로그인 취소·로그인 페이지 다시 열기, Windows 작업 보호 환경 준비, 오류 상세·재연결 UI도 구현했습니다. 이 흐름의 실제 완료 여부는 별도 검증이 필요합니다. 채팅 재개 UI, 파일 목록, 사용량 표시는 아직 구현하지 않았습니다. 채팅 내용·파일 사본·파일 인덱스를 앱이 별도로 저장하지 않습니다. Codex 자체의 로컬 기록과 기존 설정은 Codex가 관리합니다. 로컬 GUI라는 의미는 모델 추론까지 오프라인이라는 뜻은 아닙니다. Codex는 기존 계정의 모델 서비스에 연결합니다.

## 구조와 경계

```text
React UI → TypeScript Bridge → Tauri IPC → Rust 자식 프로세스 → 로컬 Codex app-server
                                                                       ↓
                                                                  로컬 파일
```

- `src/main.tsx`, `src/Requests.tsx`: 입력·응답·작업 상태·승인·질문 UI
- `src/bridge.ts`: 공식 프로토콜 요청/응답 연결, 초기화, 스트리밍, 오류·연결 종료 처리
- `src/desktop.ts`: Tauri Channel과 Bridge 연결
- `src-tauri/src/main.rs`: 폴더 선택, stdio 프로세스 시작·쓰기·종료
- `src/protocol/`: 설치된 Codex가 생성한 사용 타입 및 의존 타입
- `tests/bridge.test.ts`: 외부 API를 호출하지 않는 전송 계층 테스트
- `scripts/smoke.mjs`: 명시적으로 실행하는 실제 계정 기반 파일 생성 검증

자체 AI Agent, 문서 편집기, Git/Diff/Undo 구현, 문서 라이브러리, 별도 애플리케이션 서버는 없습니다. 승인 화면의 변경 내용은 Codex가 보내온 정보를 그대로 표시합니다. 승인 정책은 `untrusted`, 승인 처리자는 `user`, 작업 환경은 `workspace-write`로 요청합니다. 앱은 권한을 자동 확대하거나 세션 전체 승인을 선택하지 않습니다. 지원하지 않는 요청은 오류 응답으로 거부할 수 있습니다.

기존 Codex 규칙·조직 정책이 승인 발생 여부에 영향을 줄 수 있으므로, 모든 패키지 설치가 항상 GUI 승인을 거친다고 아직 보장하지 않습니다. 이를 검증하기 전 문서 처리 설치 시나리오를 완료로 표시하지 않습니다.

## 검증

```bash
npm test
npm run build
```

자동 테스트는 가짜 전송 계층만 사용합니다. 실제 계정의 사용량을 소비하지 않습니다.

다음은 **실제 Codex 계정과 네트워크를 사용**하는 수동 통합 검증입니다. `.local/smoke-*`에 새 테스트 폴더를 만듭니다.

```bash
# 승인 거부 시 파일이 생성되지 않는지 확인
node --experimental-strip-types scripts/smoke.mjs

# 전용 폴더의 test.md 한 파일 변경만 허용
node --experimental-strip-types scripts/smoke.mjs --allow-test-file
```

두 번째 명령은 사용자가 명시한 테스트 파일 승인만 허용하며, 명령 실행·도구 설치·다른 파일 변경은 모두 거부합니다. GUI 클릭 검증을 대체하지 않습니다.

프로토콜을 갱신할 때는 `node scripts/generate-protocol.mjs`를 실행하고 변경점을 검토한 뒤 테스트합니다. 공식 참고: [Codex app-server](https://learn.chatgpt.com/docs/app-server). 실제 사용 API·제약과 검증 결과는 [검증 기록](doc/verification.md)에 정리했습니다.
