// 서버 함수: /api/cities  (검색창 자동완성)
//
// 사용법
//   GET /api/cities          → 추천 도시 목록
//   GET /api/cities?q=s      → 이름에 "s"가 들어간 도시들 (Seoul, Busan, Suwon ...)
//
// .env의 WEATHER_DATA_SOURCE 값에 따라
//   sample     → 예시 데이터가 있는 8개 도시 안에서만 찾아요.
//   open-meteo → 주요 도시 목록 + Open-Meteo 도시 검색(2글자 이상일 때)에서 찾아요.

import { CITY_LIST } from "../lib/city-list.js";
import { SAMPLE_WEATHER } from "../lib/sample-data.js";
import { searchCities, isSamePlace } from "../lib/cities.js";
import { searchPlaces } from "../lib/open-meteo.js";

const LIMIT = 8;

export default {
  async fetch(request) {
    if (request.method !== "GET") {
      return Response.json({ error: "GET 요청만 받아요." }, { status: 405 });
    }

    const source = process.env.WEATHER_DATA_SOURCE || "sample";
    const query = (new URL(request.url).searchParams.get("q") || "").trim();

    if (source === "sample") {
      const sampleCities = CITY_LIST.filter((city) => SAMPLE_WEATHER[city.id]);
      return Response.json({ source, cities: searchCities(query, sampleCities, LIMIT) });
    }

    if (source === "open-meteo") {
      const results = searchCities(query, CITY_LIST, LIMIT);

      // 2글자 이상이면 전 세계 도시 검색 결과도 덧붙입니다. (이미 있는 도시는 빼고)
      if (query.length >= 2 && results.length < LIMIT) {
        try {
          for (const place of await searchPlaces(query)) {
            if (results.length >= LIMIT) break;
            if (!results.some((city) => isSamePlace(city, place))) results.push(place);
          }
        } catch {
          // 바깥 검색이 실패해도 주요 도시 결과는 그대로 보여줍니다.
        }
      }
      return Response.json({ source, cities: results });
    }

    return Response.json(
      { error: `WEATHER_DATA_SOURCE 값 "${source}"을(를) 알 수 없어요. sample 또는 open-meteo로 바꿔 주세요.` },
      { status: 500 }
    );
  },
};
