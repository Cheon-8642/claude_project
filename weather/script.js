// 날씨 정보는 Open-Meteo(https://open-meteo.com)에서 받아옵니다.
// Open-Meteo는 API 키가 필요 없는 무료 서비스라서 비밀 값을 따로 둘 필요가 없습니다.

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const RECENT_KEY = "weather-recent-cities";
const RECENT_MAX = 5;

// 화면 요소 찾아두기
const form = document.getElementById("search-form");
const input = document.getElementById("city-input");
const recentBox = document.getElementById("recent");
const message = document.getElementById("message");
const currentSection = document.getElementById("current");
const forecastSection = document.getElementById("forecast-section");

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

// 날씨 서비스는 한국어 도시 이름을 잘 못 찾아서(예: "서울"은 결과 없음),
// 자주 찾는 한국 도시는 영어 이름으로 바꿔서 검색합니다.
const KOREAN_CITY_NAMES = {
  서울: "Seoul",
  부산: "Busan",
  인천: "Incheon",
  대구: "Daegu",
  대전: "Daejeon",
  광주: "Gwangju",
  울산: "Ulsan",
  세종: "Sejong",
  수원: "Suwon",
  창원: "Changwon",
  청주: "Cheongju",
  전주: "Jeonju",
  포항: "Pohang",
  제주: "Jeju City",
  춘천: "Chuncheon",
  강릉: "Gangneung",
  경주: "Gyeongju",
  여수: "Yeosu",
};

function describeWeather(code) {
  return WEATHER_CODES[code] || ["❔", "알 수 없음"];
}

// 안내 문구 보여주기 (isError가 true면 빨간 글씨)
function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("error", isError);
  message.classList.remove("hidden");
}

// 1단계: 도시 이름으로 위치(위도·경도) 찾기
async function findCity(name) {
  const searchName = KOREAN_CITY_NAMES[name] || name;
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(searchName)}&count=10&language=ko`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("도시 정보를 불러오지 못했어요.");
  }
  const data = await response.json();
  if (!data.results || data.results.length === 0) {
    return null;
  }
  // 같은 이름의 작은 마을이 먼저 나올 수 있어서, 인구가 가장 많은 곳을 고릅니다.
  return data.results.reduce((best, place) =>
    (place.population || 0) > (best.population || 0) ? place : best
  );
}

// 2단계: 위도·경도로 현재 날씨와 5일 예보 받아오기
async function getWeather(latitude, longitude) {
  const params = new URLSearchParams({
    latitude,
    longitude,
    current: "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    forecast_days: 5,
  });
  const response = await fetch(`${FORECAST_URL}?${params}`);
  if (!response.ok) {
    throw new Error("날씨 정보를 불러오지 못했어요.");
  }
  return response.json();
}

// 현재 날씨를 화면에 그리기
function renderCurrent(city, weather) {
  const current = weather.current;
  const [icon, desc] = describeWeather(current.weather_code);
  const placeName = [city.name, city.admin1, city.country]
    .filter(Boolean)
    .filter((part, index, list) => list.indexOf(part) === index)
    .join(", ");

  document.getElementById("place").textContent = placeName;
  document.getElementById("current-icon").textContent = icon;
  document.getElementById("current-temp").textContent = `${Math.round(current.temperature_2m)}°C`;
  document.getElementById("current-desc").textContent = desc;
  document.getElementById("humidity").textContent = `${current.relative_humidity_2m}%`;
  document.getElementById("wind").textContent = `${current.wind_speed_10m} km/h`;

  currentSection.classList.remove("hidden");
}

// 5일 예보 카드 그리기
function renderForecast(weather) {
  const daily = weather.daily;
  const box = document.getElementById("forecast");
  box.innerHTML = "";

  daily.time.forEach((dateText, i) => {
    const [icon, desc] = describeWeather(daily.weather_code[i]);
    // "2026-10-30" 같은 날짜를 "10/30 (금)" 형태로 바꾸기
    const date = new Date(`${dateText}T00:00:00`);
    const dayLabel = i === 0
      ? "오늘"
      : `${date.getMonth() + 1}/${date.getDate()} (${"일월화수목금토"[date.getDay()]})`;

    const card = document.createElement("div");
    card.className = "day-card";
    card.title = desc;
    card.innerHTML = `
      <div class="day">${dayLabel}</div>
      <div class="icon">${icon}</div>
      <div class="temps">
        <span class="max">${Math.round(daily.temperature_2m_max[i])}°</span> /
        <span class="min">${Math.round(daily.temperature_2m_min[i])}°</span>
      </div>
    `;
    box.appendChild(card);
  });

  forecastSection.classList.remove("hidden");
}

// 최근 검색한 도시 불러오기 / 저장하기 (브라우저 저장소 사용)
function loadRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecent(name) {
  const list = loadRecent().filter((item) => item !== name);
  list.unshift(name);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
  } catch {
    // 저장이 막혀 있어도 검색 기능은 계속 쓸 수 있게 그냥 넘어갑니다.
  }
}

function renderRecent() {
  recentBox.innerHTML = "";
  loadRecent().forEach((name) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = name;
    button.addEventListener("click", () => search(name));
    recentBox.appendChild(button);
  });
}

// 검색 전체 흐름: 도시 찾기 → 날씨 받기 → 화면 그리기
async function search(name) {
  const cityName = name.trim();
  if (!cityName) {
    showMessage("도시 이름을 입력해 주세요.", true);
    return;
  }

  showMessage("불러오는 중...");
  currentSection.classList.add("hidden");
  forecastSection.classList.add("hidden");

  try {
    const city = await findCity(cityName);
    if (!city) {
      showMessage(`"${cityName}"을(를) 찾을 수 없어요. 다른 이름으로 검색해 보세요.`, true);
      return;
    }

    const weather = await getWeather(city.latitude, city.longitude);
    renderCurrent(city, weather);
    renderForecast(weather);
    message.classList.add("hidden");

    saveRecent(cityName); // 내가 입력한 이름 그대로 저장해야 다시 눌렀을 때도 잘 찾아집니다.
    renderRecent();
  } catch (error) {
    showMessage(`${error.message} 인터넷 연결을 확인해 주세요.`, true);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault(); // 페이지가 새로고침되지 않게 막기
  search(input.value);
  input.value = "";
});

// 처음 열었을 때 최근 검색 목록 보여주기
renderRecent();
