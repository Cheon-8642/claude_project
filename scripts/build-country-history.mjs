// 강대국처럼 사건이 많아 실시간 검색이 느린 나라의 "이번 주의 역사"를 미리 찾아 CSV로 저장하는 스크립트입니다.
// 실행: node scripts/build-country-history.mjs                (기준 날짜 2026-11-13, 아래 COUNTRIES 전체)
//       node scripts/build-country-history.mjs 2026-11-20     (다른 기준 날짜)
//       node scripts/build-country-history.mjs 2026-11-13 US JP (특정 나라만, 두 글자 나라 코드)
//
// 결과: public/data/country-history.csv
//   week_start : 그 주의 월요일 (예: 2026-11-09). 화면은 지금 보여줄 주와 같을 때만 이 CSV를 써요.
//   qid, country : 나라 Wikidata 번호, 나라 이름
//   year, month, day, title, link : 사건 (연도가 비어 있는 줄 = 찾아봤지만 그 주에 사건이 없음)
//
// 같은 주·같은 나라 줄은 새로 바꾸고, 다른 줄은 그대로 둬요. 엑셀로 열어 직접 고쳐도 돼요.
import fs from "node:fs";
import { findEvents } from "../lib/history.js";

// 미리 저장할 나라 (두 글자 나라 코드): G7 + 중국, 러시아, 인도
const COUNTRIES = ["US", "CN", "RU", "GB", "FR", "DE", "JP", "IN", "IT", "CA"];

const DATA = new URL("../public/data/", import.meta.url);
const OUT = new URL("country-history.csv", DATA);
const HEADER = "week_start,qid,country,year,month,day,title,link";

const [dateArg = "2026-11-13", ...codeArgs] = process.argv.slice(2);
const codes = codeArgs.length ? codeArgs : COUNTRIES;

// 기준 날짜가 있는 주의 월요일~일요일
const [y, m, d] = dateArg.split("-").map(Number);
const base = new Date(Date.UTC(y, m - 1, d));
const monday = new Date(base);
monday.setUTCDate(base.getUTCDate() - ((base.getUTCDay() + 6) % 7));
const week = Array.from({ length: 7 }, (_, i) => {
  const day = new Date(monday);
  day.setUTCDate(monday.getUTCDate() + i);
  return { m: day.getUTCMonth() + 1, d: day.getUTCDate() };
});
const weekStart = monday.toISOString().slice(0, 10);

const countries = JSON.parse(fs.readFileSync(new URL("countries.json", DATA), "utf8"));
const csvCell = (value) => {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};
const wikiLink = (title) => `https://ko.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`;

// 기존 파일에서, 이번에 새로 만들 나라·주가 아닌 줄은 그대로 두기
const targets = codes.map((code) => countries.find((c) => c.code === code)).filter(Boolean);
const targetKeys = new Set(targets.map((c) => `${weekStart},${c.wikidata},`));
const keep = fs.existsSync(OUT)
  ? fs.readFileSync(OUT, "utf8").replace(/^﻿/, "").split("\n").slice(1).filter((line) => line && ![...targetKeys].some((k) => line.startsWith(k)))
  : [];

// 엑셀에서 한글이 깨지지 않도록 맨 앞에 BOM(﻿)을 붙여요.
const save = (rows) => fs.writeFileSync(OUT, "﻿" + [HEADER, ...keep, ...rows].join("\n") + "\n");

const rows = [];
for (const country of targets) {
  const started = Date.now();
  try {
    const events = await findEvents(country.wikidata, week, { thorough: true });
    if (events.length === 0) rows.push([weekStart, country.wikidata, country.name, "", "", "", "", ""].map(csvCell).join(","));
    for (const e of events) {
      rows.push([weekStart, country.wikidata, country.name, e.y, e.m, e.d, e.title, wikiLink(e.title)].map(csvCell).join(","));
    }
    save(rows); // 나라 하나가 끝날 때마다 저장 (중간에 멈춰도 끝난 나라는 남아요)
    console.log(`${country.name}: ${events.length}건 (${((Date.now() - started) / 1000).toFixed(1)}초) 저장`);
  } catch (error) {
    console.log(`${country.name}: 실패 (${error.message}) — 이 나라는 저장하지 않고 화면에서 실시간 검색해요`);
  }
}
save(rows);
console.log(`public/data/country-history.csv 저장 (${weekStart} 주, 새로 ${rows.length}줄, 전체 ${keep.length + rows.length}줄)`);
