// 두 화면(첫 화면, 도시 날씨 화면)이 함께 쓰는 코드입니다.

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

// 도시 날씨 화면 주소 만들기. 예: city.html?id=seoul&name=서울&country=대한민국&lat=37.566&lon=126.9784
function cityPageUrl(city) {
  const params = new URLSearchParams({
    id: city.id,
    name: city.name,
    country: city.country || "",
    lat: city.latitude,
    lon: city.longitude,
  });
  return `city.html?${params}`;
}

// 최근에 본 도시 (브라우저 저장소에 최대 5개)
const RECENT_KEY = "weather-recent-cities";
const RECENT_MAX = 5;

function loadRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecent(city) {
  const { id, name, country, latitude, longitude } = city;
  const list = loadRecent().filter((item) => item.id !== id);
  list.unshift({ id, name, country, latitude, longitude });
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
  } catch {
    // 저장이 막혀 있어도 다른 기능은 계속 쓸 수 있게 그냥 넘어갑니다.
  }
}
