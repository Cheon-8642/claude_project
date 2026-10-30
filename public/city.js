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
    showMessage("도시 정보가 없어요. 첫 화면에서 도시를 다시 골라 주세요.", true);
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

loadCity();
