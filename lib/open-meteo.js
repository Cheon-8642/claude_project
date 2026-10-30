// Open-Meteo(https://open-meteo.com)에서 실제 데이터를 받아오는 코드입니다.
// Open-Meteo는 API 키가 필요 없는 무료 서비스예요.

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

// 도시 이름으로 장소 찾기 (Open-Meteo는 2글자 이상부터 결과를 줍니다)
export async function searchPlaces(query) {
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(query)}&count=10&language=ko`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("도시 검색 서비스에 연결하지 못했어요.");
  const data = await response.json();

  return (data.results || []).map((place) => ({
    id: `geo-${place.id}`,
    name: place.name,
    country: place.country || "",
    region: place.admin1 || "",
    latitude: place.latitude,
    longitude: place.longitude,
  }));
}

// 좌표로 현재 날씨와 5일 예보 받아오기
export async function getForecast(latitude, longitude) {
  const params = new URLSearchParams({
    latitude,
    longitude,
    current: "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    forecast_days: 5,
  });
  const response = await fetch(`${FORECAST_URL}?${params}`);
  if (!response.ok) throw new Error("날씨 서비스에 연결하지 못했어요.");
  const data = await response.json();

  // 화면이 쓰기 편한 모양으로 바꿔서 돌려줍니다. (예시 데이터와 같은 모양)
  return {
    current: {
      temperature: data.current.temperature_2m,
      humidity: data.current.relative_humidity_2m,
      wind: data.current.wind_speed_10m,
      code: data.current.weather_code,
    },
    daily: data.daily.time.map((date, i) => ({
      date,
      code: data.daily.weather_code[i],
      max: data.daily.temperature_2m_max[i],
      min: data.daily.temperature_2m_min[i],
    })),
  };
}
