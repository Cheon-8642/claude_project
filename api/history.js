// 서버 함수: /api/history  (나라를 눌렀을 때 오늘의 역사 + 이번 주의 역사)
//
// 사용법
//   GET /api/history?qid=Q796&date=2026-11-13
//     qid  : 나라의 Wikidata 번호 (public/data/countries.json의 wikidata 값)
//     date : 기준 날짜. 이번 주는 이 날짜가 있는 주의 월요일~일요일이에요.
//
// 돌려주는 것
//   { today: [사건…], week: [사건…] }   사건 = { y, m, d, title, id }, 최신순
//   week에는 월~일 7일이 모두 들어가요(오늘 포함).

import { findEvents } from "../lib/history.js";

export default {
  async fetch(request) {
    if (request.method !== "GET") {
      return Response.json({ error: "GET 요청만 받아요." }, { status: 405 });
    }

    const params = new URL(request.url).searchParams;
    const qid = params.get("qid") ?? "";
    const date = params.get("date") ?? "";
    if (!/^Q\d+$/.test(qid)) {
      return Response.json({ error: "나라 번호(qid)가 올바르지 않아요." }, { status: 400 });
    }
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return Response.json({ error: "날짜(date)는 2026-11-13 모양이어야 해요." }, { status: 400 });
    }

    // 기준 날짜가 있는 주의 월요일~일요일
    const base = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    const monday = new Date(base);
    monday.setUTCDate(base.getUTCDate() - ((base.getUTCDay() + 6) % 7));
    const week = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(monday);
      day.setUTCDate(monday.getUTCDate() + i);
      return { m: day.getUTCMonth() + 1, d: day.getUTCDate() };
    });
    const today = { m: base.getUTCMonth() + 1, d: base.getUTCDate() };

    try {
      const events = await findEvents(qid, week);
      return Response.json(
        {
          today: events.filter((e) => e.m === today.m && e.d === today.d),
          week: events,
        },
        // 같은 나라·날짜는 하루 동안 저장해 두고 바로 돌려줘요. (Wikidata를 매번 부르지 않게)
        { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400" } }
      );
    } catch (error) {
      return Response.json({ error: "Wikidata에서 역사 정보를 가져오지 못했어요." }, { status: 502 });
    }
  },
};
