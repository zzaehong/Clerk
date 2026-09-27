현재 Clerk의 기능은 유지하되, 전체 UI 레이아웃을 재구성해줘.

첨부된 현재 화면을 기준으로 보면 사용량, 작업 폴더, 작업 상태, 채팅, 입력창이 모두 화면 중앙에 세로로 배치되어 있어 화면이 가운데에 지나치게 몰려 있고, 각 정보의 역할 구분도 약한 상태다.

이번 작업의 목표는 **기능을 추가하는 것이 아니라 기존 정보를 적절한 위치로 재배치하여 Clerk를 실제 Desktop Workspace처럼 만드는 것**이다.

핵심 원칙은 다음과 같다.

> **화면 중앙에는 Codex와의 채팅 및 현재 작업만 존재한다.**
>
> Workspace 정보와 상태 정보는 Sidebar로 이동한다.

기존 Codex 동작, app-server 연동, 채팅 로직, 사용량 조회, 폴더 선택 등의 로직은 가능한 한 변경하지 말고 UI 구조를 중심으로 수정해줘.

## 목표 레이아웃

전체 화면을 다음의 3개 영역으로 구성한다.

```text
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│  Left Sidebar        Main Workspace        Right Sidebar      │
│                                                               │
│  Workspace           Codex Chat            Codex Status       │
│  Files               Conversation          Usage              │
│  Folder              Input                 Settings           │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### 1. Left Sidebar — Workspace

화면 왼쪽에는 현재 작업 환경과 파일을 배치한다.

포함할 정보:

- Clerk 로고 / 이름
- 현재 작업 폴더 이름
- 현재 작업 폴더 경로
- 폴더 변경 버튼
- 현재 폴더의 File Tree

기존에 중앙 상단에 있던 `작업 폴더` 카드는 제거하고 이 정보를 왼쪽 Sidebar로 이동한다.

예:

```text
Clerk
나의 로컬 작업 공간

WORKSPACE

📁 Brick_by_Brick
C:\Users\...\Brick_by_Brick

[폴더 변경]

FILES

▾ docs
   plan.md
   notes.md

README.md
```

File Tree의 기능은 현재 구현 수준을 유지한다.

새로운 파일 관리 시스템이나 편집기를 만들지 않는다.

왼쪽 Sidebar는 약 `240~280px` 정도를 기준으로 하고 화면 높이 전체를 사용한다.

---

### 2. Main Workspace — Chat Only

가운데 영역은 Clerk의 핵심 영역이다.

이 영역에는 **Codex와의 대화와 작업에 직접 관계된 내용만 표시한다.**

다음 요소만 남긴다.

- 사용자 메시지
- Codex 메시지
- Codex 작업 진행 상태
- Approval
- Codex 질문 / 사용자 선택
- 메시지 입력창

다음 정보는 Main Workspace에서 제거한다.

- 사용량
- 작업 폴더
- 설정
- Codex 연결 여부
- 사용량 새로고침 버튼

이 정보들은 Sidebar로 이동한다.

가운데 영역은 가능한 한 세로 공간 전체를 사용한다.

```text
┌───────────────────────────────┐

        Conversation

User
이 폴더의 내용을 정리해줘.

Codex
파일을 확인하고 있습니다.

✓ notes.md
✓ plan.md

...





───────────────────────────────

무엇을 작업할까요?           ↑

└───────────────────────────────┘
```

메시지 입력창은 화면 하단에 고정하거나 sticky 처리하여 채팅을 스크롤해도 항상 접근할 수 있도록 한다.

대화 영역만 독립적으로 스크롤한다.

현재처럼 화면 전체가 스크롤되는 구조는 피한다.

Main Workspace는 좌우 Sidebar를 제외한 남은 공간을 모두 사용한다.

다만 채팅 메시지 자체의 최대 폭은 읽기 편하도록 약 `760~900px` 수준으로 제한하고 가운데 정렬할 수 있다.

즉:

```text
Main Workspace 전체 폭
        ↓
    넓게 사용

실제 메시지 폭
        ↓
읽기 좋은 수준으로 제한
```

한다.

---

### 3. Right Sidebar — Status

오른쪽에는 작업 자체보다 **상태 확인에 필요한 정보**를 모은다.

현재 화면 상단에 있는 Codex 연결 상태와 사용량 카드를 이곳으로 이동한다.

포함할 정보:

```text
CODEX

● 연결됨


USAGE

5h limit
████████░░
3% 남음

2026. 9. 27.
오전 2:14 초기화


Weekly limit
████░░░░░░
69% 남음

2026. 10. 3.
오전 8:53 초기화

[사용량 새로고침]


STATUS

● 작업 완료


[설정]
```

현재 사용량을 표시하는 큰 카드 2개는 제거하고 Sidebar용 작은 정보 블록으로 변경한다.

Progress Bar는 그대로 사용할 수 있지만 시각적으로 더 얇고 간결하게 만든다.

Right Sidebar는 약 `220~260px` 수준이면 충분하다.

---

## Header

현재 상단 전체 너비를 차지하는 Header는 최대한 축소한다.

Clerk 로고와 이름은 Left Sidebar로 이동하고,

Codex 연결 상태와 설정은 Right Sidebar로 이동한다.

따라서 별도의 큰 Header가 반드시 필요하지 않다면 제거해도 된다.

Desktop Application답게 화면 공간을 Workspace에 더 많이 사용한다.

---

## 전체적인 시각적 방향

현재의 밝고 미니멀한 스타일은 유지한다.

다음 방향을 따른다.

- 흰색 / 매우 밝은 회색 배경
- Deep Blue를 Accent Color로 사용
- Border는 얇고 연하게
- 과도한 Card UI 사용 금지
- Sidebar와 Main 영역의 구분은 미세한 Border 정도로 처리
- 큰 그림자 사용 금지
- 지나치게 둥근 Dashboard Card를 반복하지 않기
- 충분한 여백 유지

특히 현재 UI는 각각의 정보를 Card로 감싸는 경향이 있는데 이를 줄여줘.

Clerk는 Dashboard가 아니라 **Desktop Tool**처럼 보여야 한다.

Visual hierarchy는 다음 순서가 되어야 한다.

```text
1. Chat / 현재 작업
2. Files
3. Codex 질문 / Approval
4. 사용량 / 상태
5. 설정
```

---

## Responsive 동작

이 프로그램은 우선 Desktop 환경을 대상으로 한다.

일반적인 Desktop 너비에서는:

```text
Left Sidebar
+
Main
+
Right Sidebar
```

3-column 구조를 유지한다.

화면이 좁아지는 경우 Sidebar가 Main 영역을 지나치게 압축하지 않도록 한다.

가능하다면:

- Left Sidebar collapse
- Right Sidebar collapse

정도만 지원한다.

복잡한 Mobile UI는 만들지 않는다.

---

## 중요한 제한사항

이번 작업에서 다음 기능은 추가하지 않는다.

- 문서 편집기
- 새로운 파일 관리 기능
- 새로운 Codex 기능
- Git UI
- Diff UI
- Chat 검색
- 복잡한 Sidebar navigation
- 새로운 Backend
- 새로운 DB
- 새로운 AI 기능

현재 존재하는 정보를 **재배치하고 시각적 계층을 개선하는 작업**에 집중한다.

Codex 관련 기존 로직은 가능한 한 그대로 유지한다.

---

## 작업 순서

먼저 현재 UI 컴포넌트와 CSS 구조를 확인해줘.

그 다음 기존 기능을 기준으로:

1. 어떤 컴포넌트를 Left Sidebar로 이동할지
2. 어떤 컴포넌트를 Right Sidebar로 이동할지
3. Main Chat 영역에 무엇을 남길지
4. 현재 전체 페이지 Scroll 구조를 어떻게 Chat 영역 Scroll로 변경할지

를 짧게 설명해줘.

그 후 실제 수정 작업을 진행해줘.

가능한 한 기존 컴포넌트를 재사용하고, UI 개편을 위해 불필요하게 전체 코드를 다시 작성하지 말아줘.

## 완료 기준

다음 조건을 만족하면 완료다.

- [ ] 화면 왼쪽에 Workspace Sidebar가 있다.
- [ ] 작업 폴더 정보가 Left Sidebar에 있다.
- [ ] File Tree가 Left Sidebar에 있다.
- [ ] 화면 가운데에는 Chat 중심의 내용만 있다.
- [ ] 입력창이 Main 영역 하단에서 항상 접근 가능하다.
- [ ] Chat 영역만 독립적으로 스크롤된다.
- [ ] 사용량이 Right Sidebar로 이동했다.
- [ ] Codex 연결 상태가 Right Sidebar에 있다.
- [ ] 작업 상태가 Right Sidebar에 있다.
- [ ] 설정이 Right Sidebar에 있다.
- [ ] 기존 Codex 기능은 그대로 작동한다.
- [ ] 기존 Folder 선택 기능은 그대로 작동한다.
- [ ] 기존 Usage 조회 기능은 그대로 작동한다.
- [ ] 기존 Chat 기능은 그대로 작동한다.
- [ ] 불필요한 새 기능이나 Dependency가 추가되지 않았다.