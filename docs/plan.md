# 첫 버전 계획: 핵심 시나리오를 배포 주소에서 끝까지

**목표:** 배포 주소에서 "도시 이름 일부 입력 → 자동완성에서 선택 → 현재 날씨와 5일 예보 보기"가 실제 데이터로 동작하게 한다. ([PRD.md](../PRD.md) v2 기준)

## 1. 화면 (2개 모두 필요)

| 화면 | 사용자가 하는 일 | 핵심에 필요한 요소 |
|---|---|---|
| `public/index.html` | 글자 입력 → 목록에서 도시 선택 (또는 **검색**) | 검색칸, 자동완성 목록, 검색 버튼, 안내 메시지 |
| `public/city.html` | 현재 날씨와 5일 예보 확인 → "← 다른 도시 찾기" | 도시 이름, 기온·날씨·습도·바람, 예보 카드 5개, 돌아가기 링크 |

## 2. 데이터 흐름

```
Open-Meteo 도시 검색 ─┐                      ┌─ /api/cities?q=          → index.html 자동완성
lib/city-list.js(36곳)┘→ 서버 함수(api/) ──┤
Open-Meteo 예보 ────────────────────────────┘─ /api/weather?id&lat&lon  → city.html
```

**Supabase는 필요 없다.** 저장할 데이터가 없기 때문이다. 날씨는 매번 Open-Meteo에서 받고, 로그인이 없고, "최근에 본 도시"는 브라우저 저장소(localStorage)에 둔다.

## 3. 완료 기준별 상태

| 완료 기준 | 상태 | 근거 |
|---|---|---|
| 1. `s` 입력 → s가 들어간 도시 목록 | 이미 됨 | 2026-10-30 Playwright 확인 (로컬) |
| 2. 서울 클릭 → 날씨 4가지 + 예보 5개 | 이미 됨 | 같음 |
| 3. `zzqx` + 검색 → 안내, 이동 없음 | 이미 됨 | 같음 |
| 4. 빈 칸 + 검색 → 안내 | 이미 됨 | 같음 |
| 5. "← 다른 도시 찾기" → 첫 화면 | 이미 됨 | 같음 |

고칠 코드는 없다. 단, 위 확인은 모두 내 컴퓨터의 확인용 서버에서 한 것이라 **배포 주소에서 5개를 다시 확인**해야 한다.

## 4. 예시 데이터와 실제 데이터 전환

- 코드는 `WEATHER_DATA_SOURCE` 값이 **없으면 `sample`(가짜 데이터)**을 쓴다.
- `.env`는 GitHub에 올라가지 않으므로 Vercel에도 없다. **아무것도 설정하지 않고 배포하면 가짜 데이터가 나온다.**
- 해결: Vercel 프로젝트 **Environment Variables**에 `WEATHER_DATA_SOURCE = open-meteo`를 넣는다. 코드는 고치지 않는다.
- 확인: 배포 화면에 노란색 "예시 데이터" 표시가 **없어야** 한다.

## 5. Vercel 배포 설정

| 항목 | 값 | 이유 |
|---|---|---|
| Framework Preset | Other | 프레임워크를 쓰지 않음 |
| Build Command | 비움 (빌드 없음) | HTML/CSS/JS를 그대로 씀 |
| Output Directory | `public` (자동) | "Other"를 고르면 `public` 폴더가 있으면 그 폴더를 화면으로 씀. `weather/`, `PRD.md` 등은 웹에 공개되지 않음 |
| 서버 함수 | `api/cities.js`, `api/weather.js` | `api/` 폴더는 자동으로 함수가 됨 |
| 환경 변수 | `WEATHER_DATA_SOURCE=open-meteo` | 4번 |
| `vercel.json` | 필요 없음 | |

배포 방법: vercel.com에서 GitHub 저장소 `Cheon-8642/claude_project`를 가져오기(Import). 이후 GitHub에 올릴 때마다 자동으로 다시 배포된다.

## 6. 진행 순서

1. `docs/plan.md` 저장 (이 문서)
2. vercel.com 로그인 → `claude_project` 가져오기 → 위 설정 입력 → Deploy (로그인·연결은 직접)
3. 배포 주소에서 Playwright로 완료 기준 5개 확인 + 스크린샷
4. 문제가 있으면 고치기 전에 먼저 알리기
5. 배포 주소를 `README.md`와 `PRD.md`에 적고 GitHub에 올리기

**진행 결과 (2026-10-30)**
- 1~3번 완료. 배포 주소 https://claudeproject-jet.vercel.app 에서 완료 기준 5개 모두 통과.
- 환경 변수 없이 배포되어 지금은 **예시 데이터 모드**다. 실제 날씨로 바꾸려면 Vercel Settings → Environment Variables에 `WEATHER_DATA_SOURCE=open-meteo`를 넣고 다시 배포한다.

## 7. 나중에 (첫 버전 확인 대상 아님, 코드는 이미 있으니 지우지 않음)

- 날씨별 연출(더위·비·눈·안개), 최근에 본 도시, 추천 도시, 키보드 ↑↓ 선택, 휴대폰 화면 맞춤
- 해외 검색 결과 다듬기 (글자 미포함 결과, 같은 이름 중복, 악센트 강조)
- 탭 아이콘(`favicon.ico`) 추가
- 옛 `weather/` 폴더 정리

## 8. 처음 볼 가능성이 큰 기술: 서버리스 함수 (Vercel Functions)

`api/weather.js` 같은 파일 하나를 올리면, Vercel이 서버를 따로 켜 두지 않고 **요청이 올 때만 잠깐 실행**해서 답을 돌려준다. 서버 관리 없이 서버 코드를 쓸 수 있는 방식이다. 화면이 `/api/weather`를 부르면 이 함수가 Open-Meteo에 물어보고 답을 정리해 돌려준다.
