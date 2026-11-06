// 도시 날씨 화면 동작: 주소(?id=...&lat=...&lon=...)에 담긴 도시의 날씨를 서버 함수에서 받아와 그립니다.

const params = new URLSearchParams(window.location.search);
const city = {
  id: params.get("id"),
  name: params.get("name") || "알 수 없는 도시",
  country: params.get("country") || "",
  latitude: params.get("lat"),
  longitude: params.get("lon"),
};

const message = document.getElementById("message");

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("error", isError);
  message.classList.remove("hidden");
}

function renderCurrent(current) {
  const [icon, desc] = describeWeather(current.code);
  document.title = `${city.name} 날씨`;
  document.getElementById("place").textContent = city.name;
  document.getElementById("country").textContent = city.country;
  document.getElementById("current-icon").textContent = icon;
  document.getElementById("current-temp").textContent = `${Math.round(current.temperature)}°C`;
  document.getElementById("current-desc").textContent = desc;
  document.getElementById("humidity").textContent = `${current.humidity}%`;
  document.getElementById("wind").textContent = `${current.wind} km/h`;
  document.getElementById("current").classList.remove("hidden");
}

function renderForecast(daily) {
  const box = document.getElementById("forecast");
  box.innerHTML = "";

  // 예보 날짜는 그 도시의 날짜라서, 시차가 있는 도시는 내 "오늘"과 다를 수 있어요.
  // 그래서 내 컴퓨터의 오늘 날짜와 같을 때만 "오늘"이라고 씁니다.
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  daily.forEach((day) => {
    const [icon, desc] = describeWeather(day.code);
    // "2026-10-30" 같은 날짜를 "10/30 (금)" 형태로 바꾸기
    const date = new Date(`${day.date}T00:00:00`);
    const label = day.date === today
      ? "오늘"
      : `${date.getMonth() + 1}/${date.getDate()} (${"일월화수목금토"[date.getDay()]})`;

    const card = document.createElement("div");
    card.className = "day-card";
    card.title = desc;
    card.innerHTML = `
      <div class="day">${label}</div>
      <div class="icon">${icon}</div>
      <div class="temps">
        <span class="max">${Math.round(day.max)}°</span> /
        <span class="min">${Math.round(day.min)}°</span>
      </div>
    `;
    box.appendChild(card);
  });

  document.getElementById("forecast-section").classList.remove("hidden");
}

async function loadCity() {
  if (!city.id) {
    showMessage("나라 정보가 없어요. 첫 화면에서 나라를 다시 골라 주세요.", true);
    return;
  }

  const query = new URLSearchParams({ id: city.id, lat: city.latitude, lon: city.longitude });
  try {
    const response = await fetch(`/api/weather?${query}`);
    const data = await response.json();
    if (!response.ok) {
      showMessage(data.error || "날씨 정보를 불러오지 못했어요.", true);
      return;
    }

    renderSourceBadge(document.getElementById("source-badge"), data.source);
    renderCurrent(data.current);
    renderForecast(data.daily);
    message.classList.add("hidden");

    // 날씨에 맞는 화면 연출 시작 (effects.js)
    startWeatherEffect(data.current, params.get("preview"));
  } catch {
    showMessage("서버에 연결하지 못했어요. npm run dev로 실행 중인지 확인해 주세요.", true);
  }
}

// ---------- 이 나라의 역사 ----------
// 1) 강대국처럼 실시간 검색이 느린 나라는 미리 찾아 둔 public/data/country-history.csv에서 바로 보여줘요.
//    (scripts/build-country-history.mjs로 만들어요. 보여줄 주와 같은 주의 줄만 써요.)
// 2) CSV에 없는 나라는 서버 함수(/api/history)가 Wikidata에서 한국어 위키백과 문서가 있는 사건을 찾아요.
// 날씨와 따로 불러와서, 역사 쪽이 늦거나 실패해도 날씨는 그대로 보여요.

const HISTORY_TEXT = {
  todayLoading: "데이터를 찾는 중입니다.",
  todayEmpty: "과거의 오늘은 평화로운 나날이었습니다.",
  weekLoading: "찾는 중입니다.",
  weekEmpty: "과거의 이번 주는 평화로운 나날이었습니다.",
  failed: "역사 정보를 가져오지 못했어요. 잠시 후 새로고침해 주세요.",
};

function showHistoryMessage(id, text) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.classList.toggle("hidden", !text);
}

function renderHistoryList(listId, messageId, events, emptyText, showDay) {
  const list = document.getElementById(listId);
  list.innerHTML = "";
  if (events.length === 0) {
    showHistoryMessage(messageId, emptyText);
    return;
  }
  showHistoryMessage(messageId, "");
  events.forEach((event) => list.appendChild(createHistoryItem(event, { showDay })));
}

// 날짜를 "2026-11-13" 모양으로
const isoDate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// 미리 저장해 둔 CSV에서 찾기. 이 나라·이 주의 줄이 없으면 null (→ 실시간 검색)
async function savedHistory(qid, today) {
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const rows = (await loadCsv("data/country-history.csv"))
    .filter((r) => r.qid === qid && r.week_start === isoDate(monday));
  if (rows.length === 0) return null;
  const week = rows
    .filter((r) => r.year !== "") // 연도가 빈 줄 = 찾아봤지만 사건이 없음
    .map((r) => ({ y: Number(r.year), m: Number(r.month), d: Number(r.day), title: r.title, link: r.link || undefined }))
    .sort((a, b) => b.y - a.y || b.m - a.m || b.d - a.d);
  return {
    today: week.filter((e) => e.m === today.getMonth() + 1 && e.d === today.getDate()),
    week,
  };
}

// 서버 함수로 Wikidata 실시간 검색
async function searchHistory(qid, today) {
  const response = await fetch(`/api/history?qid=${encodeURIComponent(qid)}&date=${isoDate(today)}`);
  if (!response.ok) throw new Error("역사 검색 실패");
  return response.json();
}

async function loadHistory() {
  const today = historyToday(); // 발표용 고정 날짜(common.js의 HISTORY_FIXED_DATE)가 있으면 그 날짜
  const week = thisWeekDays(today);
  document.getElementById("today-label").textContent = `${today.getMonth() + 1}월 ${today.getDate()}일`;
  document.getElementById("week-label").textContent =
    `${week[0].m}월 ${week[0].d}일(월) ~ ${week[6].m}월 ${week[6].d}일(일)`;
  showHistoryMessage("today-message", HISTORY_TEXT.todayLoading);
  showHistoryMessage("week-message", HISTORY_TEXT.weekLoading);

  const qid = params.get("qid");
  if (!qid) {
    showHistoryMessage("today-message", HISTORY_TEXT.failed);
    showHistoryMessage("week-message", "");
    return;
  }

  try {
    const data = (await savedHistory(qid, today)) ?? (await searchHistory(qid, today));
    renderHistoryList("today-list", "today-message", data.today, HISTORY_TEXT.todayEmpty, false);
    renderHistoryList("week-list", "week-message", data.week, HISTORY_TEXT.weekEmpty, true);
  } catch {
    showHistoryMessage("today-message", HISTORY_TEXT.failed);
    showHistoryMessage("week-message", "");
  }
}

loadCity();
loadHistory();
