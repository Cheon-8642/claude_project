# 세계 날씨 지도

세계지도에서 나라를 누르면(또는 나라 이름을 검색하면) 그 나라 수도의 날씨를 보여 주고, 날씨에 따라 화면이 바뀌는 웹사이트입니다. 자세한 기획은 [PRD.md](PRD.md)를 보세요.

**배포 주소:** https://claudeproject-jet.vercel.app (실제 날씨, Vercel 환경 변수 `WEATHER_DATA_SOURCE=open-meteo`)

## 처음 한 번만: 설치

[Node.js](https://nodejs.org/)가 설치되어 있어야 합니다.

```bash
npm install
```

`.env.example`을 복사해서 `.env` 파일을 만듭니다.

```bash
cp .env.example .env
```

## 실행

```bash
npm run dev
```

처음 실행하면 Vercel 로그인과 프로젝트 연결을 물어봅니다. 안내에 따라 진행한 뒤, 터미널에 나오는 주소(보통 http://localhost:3000)를 브라우저에서 엽니다.

## 예시 데이터 / 실제 날씨 바꾸기

`.env`의 `WEATHER_DATA_SOURCE` 값을 바꾸고 다시 실행합니다.

| 값 | 내용 |
|---|---|
| `sample` | 예시 날씨. 인터넷 없이 동작. 수도 중에서는 서울·도쿄만 예시 데이터가 있어요 |
| `open-meteo` | 실제 날씨. 모든 나라의 수도 |

## 날씨 연출 미리보기

수도 날씨 화면 주소 끝에 `&preview=hot` (또는 `rain`, `snow`, `fog`)를 붙이면 실제 날씨와 상관없이 그 연출을 볼 수 있습니다.

윈도우 "애니메이션 효과" 설정(설정 → 접근성 → 시각 효과)이 꺼져 있으면, 연출이 움직이지 않는 모습으로만 나옵니다.

## 폴더 구조

| 위치 | 역할 |
|---|---|
| `public/` | 화면 파일. `index.html`(첫 화면 세계지도), `city.html`(수도 날씨), `effects.*`(날씨 연출) |
| `public/data/` | 미리 저장해 둔 데이터. `countries.json`(나라·수도·Wikidata 번호, Wikidata), `countries-110m.json`(세계지도 모양, Natural Earth) |
| `scripts/` | 데이터를 다시 만드는 스크립트. `node scripts/build-countries.mjs`를 실행하면 `countries.json`을 새로 받아요 |
| `api/` | 서버 함수. 파일 하나가 주소 하나가 됩니다 (`api/weather.js` → `/api/weather`) |
| `lib/` | 서버 함수가 함께 쓰는 코드와 데이터. `api/` 안에 두면 각각 서버 함수가 되어 버려서 따로 둡니다 |

## 서버 함수

| 주소 | 돌려주는 것 |
|---|---|
| `GET /api/weather?id=seoul&lat=37.56&lon=126.99` | 현재 날씨 + 5일 예보 |

나라 목록과 지도 모양은 `public/data/`의 파일을 화면이 바로 읽어서, 서버 함수가 필요 없어요.

## 배포 (Vercel)

```bash
npm run deploy
```

배포한 사이트에서 쓸 환경 변수는 Vercel 웹사이트의 프로젝트 **Settings → Environment Variables**에 넣습니다.

## 비밀 값 규칙

API 키 같은 비밀 값은 `.env`(내 컴퓨터)와 Vercel 환경 변수(배포)에만 둡니다. 화면 코드(`public/`)나 GitHub에는 절대 넣지 않습니다.
