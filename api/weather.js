// 서버 함수: /api/weather  (도시 하나의 현재 날씨 + 5일 예보)
//
// 사용법
//   GET /api/weather?id=seoul&lat=37.566&lon=126.9784
//
// .env의 WEATHER_DATA_SOURCE 값에 따라
//   sample     → lib/sample-data.js에서 id로 찾아요.
//   open-meteo → 좌표(lat, lon)로 Open-Meteo에서 실제 날씨를 받아와요.

import { SAMPLE_WEATHER } from "../lib/sample-data.js";
import { getForecast } from "../lib/open-meteo.js";

export default {
  async fetch(request) {
    if (request.method !== "GET") {
      return Response.json({ error: "GET 요청만 받아요." }, { status: 405 });
    }

    const source = process.env.WEATHER_DATA_SOURCE || "sample";
    const params = new URL(request.url).searchParams;

    if (source === "sample") {
      const sample = SAMPLE_WEATHER[params.get("id")];
      if (!sample) {
        return Response.json({ error: "이 도시는 예시 데이터에 없어요." }, { status: 404 });
      }
      return Response.json({ source, current: sample.current, daily: sampleDaily(sample.daily) });
    }

    if (source === "open-meteo") {
      const lat = Number(params.get("lat"));
      const lon = Number(params.get("lon"));
      if (!params.get("lat") || !params.get("lon") || Number.isNaN(lat) || Number.isNaN(lon)) {
        return Response.json({ error: "도시 위치(lat, lon)가 필요해요." }, { status: 400 });
      }
      try {
        return Response.json({ source, ...(await getForecast(lat, lon)) });
      } catch (error) {
        return Response.json({ error: error.message }, { status: 502 });
      }
    }

    return Response.json(
      { error: `WEATHER_DATA_SOURCE 값 "${source}"을(를) 알 수 없어요. sample 또는 open-meteo로 바꿔 주세요.` },
      { status: 500 }
    );
  },
};

// 예시 예보 [코드, 최고, 최저]에 오늘부터의 날짜를 붙여 실제 데이터와 같은 모양으로 만듭니다.
function sampleDaily(rows) {
  return rows.map(([code, max, min], i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return { date: `${yyyy}-${mm}-${dd}`, code, max, min };
  });
}
