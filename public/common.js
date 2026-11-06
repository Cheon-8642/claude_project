// 두 화면(첫 화면 세계지도, 수도 날씨 화면)이 함께 쓰는 코드입니다.

// 날씨 코드(숫자)를 아이콘과 설명으로 바꾸는 표
// 코드 의미: https://open-meteo.com/en/docs 의 "WMO Weather interpretation codes"
const WEATHER_CODES = {
  0: ["☀️", "맑음"],
  1: ["🌤️", "대체로 맑음"],
  2: ["⛅", "구름 조금"],
  3: ["☁️", "흐림"],
  45: ["🌫️", "안개"],
  48: ["🌫️", "짙은 안개"],
  51: ["🌦️", "약한 이슬비"],
  53: ["🌦️", "이슬비"],
  55: ["🌧️", "강한 이슬비"],
  56: ["🌧️", "어는 이슬비"],
  57: ["🌧️", "강한 어는 이슬비"],
  61: ["🌧️", "약한 비"],
  63: ["🌧️", "비"],
  65: ["🌧️", "강한 비"],
  66: ["🌧️", "어는 비"],
  67: ["🌧️", "강한 어는 비"],
  71: ["🌨️", "약한 눈"],
  73: ["🌨️", "눈"],
  75: ["❄️", "강한 눈"],
  77: ["🌨️", "싸락눈"],
  80: ["🌦️", "약한 소나기"],
  81: ["🌧️", "소나기"],
  82: ["⛈️", "강한 소나기"],
  85: ["🌨️", "약한 눈 소나기"],
  86: ["❄️", "강한 눈 소나기"],
  95: ["⛈️", "뇌우"],
  96: ["⛈️", "우박을 동반한 뇌우"],
  99: ["⛈️", "강한 우박을 동반한 뇌우"],
};

function describeWeather(code) {
  return WEATHER_CODES[code] || ["❔", "알 수 없음"];
}

// 데이터 출처 표시 (예시 데이터일 때만 노란 표시)
function renderSourceBadge(badge, source) {
  if (source === "sample") {
    badge.textContent = "예시 데이터로 보여주는 중이에요 (실제 날씨 아님)";
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

// 수도 날씨 화면 주소 만들기. 예: city.html?id=seoul&name=서울특별시&country=대한민국&lat=37.56&lon=126.99&qid=Q884
// qid는 나라의 Wikidata 번호로, 역사 데이터 파일을 찾을 때 써요.
function cityPageUrl(city) {
  const params = new URLSearchParams({
    id: city.id,
    name: city.name,
    country: city.country || "",
    lat: city.latitude,
    lon: city.longitude,
  });
  if (city.wikidata) params.set("qid", city.wikidata);
  return `city.html?${params}`;
}

// ---------- CSV 읽기 ----------

// CSV 글자를 줄·칸으로 나누기 (따옴표 안의 쉼표·줄바꿈도 처리)
// 결과: 첫 줄을 열 이름으로 써서 줄마다 { month: "11", day: "13", … } 모양
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== "")) rows.push(row);
  const [header = [], ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((name, i) => [name.trim(), (r[i] ?? "").trim()])));
}

// public 폴더의 CSV 파일 불러오기 (파일이 없으면 빈 목록). 엑셀용 BOM은 떼고 읽어요.
async function loadCsv(path) {
  const response = await fetch(path);
  if (!response.ok) return [];
  return parseCsv((await response.text()).replace(/^﻿/, ""));
}

// ---------- 역사 ----------

// 발표용으로 "오늘의 역사"·"이번 주의 역사"를 항상 이 날짜 기준으로 보여줘요. (월은 1~12)
// 실제 오늘 날짜로 되돌리려면 null로 바꾸세요: const HISTORY_FIXED_DATE = null;
const HISTORY_FIXED_DATE = { month: 11, day: 13 };

// 역사에 쓸 "오늘" 날짜 (고정 날짜가 있으면 그 날짜, 없으면 실제 오늘)
function historyToday() {
  const now = new Date();
  if (!HISTORY_FIXED_DATE) return now;
  return new Date(now.getFullYear(), HISTORY_FIXED_DATE.month - 1, HISTORY_FIXED_DATE.day);
}

// 사건 날짜를 글자로. Wikidata는 기원전을 0, -1, -2…로 세서(0 = 기원전 1년) 1을 빼서 바꿔요.
function formatHistoryDate(y, m, d) {
  const year = y <= 0 ? `기원전 ${1 - y}년` : `${y}년`;
  return m ? `${year} ${m}월 ${d}일` : year;
}

// 이번 주 월요일~일요일 7일. 예: [{ m: 11, d: 9 }, …, { m: 11, d: 15 }]
function thisWeekDays(today = new Date()) {
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7)); // getDay(): 일요일 0, 월요일 1
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return { m: day.getMonth() + 1, d: day.getDate() };
  });
}

// 사건 하나를 목록 줄로 만들기: "1914년 11월 6일 · 파오 상륙작전" (제목을 누르면 한국어 위키백과 문서)
function createHistoryItem(event, { showDay = true, extra = "" } = {}) {
  const item = document.createElement("li");
  item.className = "history-item";
  const when = document.createElement("span");
  when.className = "history-date";
  when.textContent = showDay ? formatHistoryDate(event.y, event.m, event.d) : formatHistoryDate(event.y);
  // 링크가 따로 있으면 그 주소, 없으면 제목과 같은 이름의 한국어 위키백과 문서
  const href = event.link ?? `https://ko.wikipedia.org/wiki/${encodeURIComponent(event.title.replaceAll(" ", "_"))}`;
  const title = document.createElement(href ? "a" : "span");
  if (href) {
    title.href = href;
    title.target = "_blank";
    title.rel = "noopener";
  }
  title.textContent = event.title;
  item.append(when, title);
  if (extra) {
    const more = document.createElement("span");
    more.className = "history-extra";
    more.textContent = extra;
    item.append(more);
  }
  return item;
}

// 최근에 본 나라 (브라우저 저장소에 최대 5개). 나라의 수도 정보를 저장해요.
const RECENT_KEY = "weather-recent-countries";
const RECENT_MAX = 5;

function loadRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecent(city) {
  const { id, name, country, latitude, longitude, wikidata } = city;
  const list = loadRecent().filter((item) => item.id !== id);
  list.unshift({ id, name, country, latitude, longitude, wikidata });
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
  } catch {
    // 저장이 막혀 있어도 다른 기능은 계속 쓸 수 있게 그냥 넘어갑니다.
  }
}
