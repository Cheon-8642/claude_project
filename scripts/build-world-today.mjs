// 첫 화면 "오늘의 역사(전 세계)"에 쓸 CSV를 만드는 스크립트입니다. (데이터를 다시 만들고 싶을 때만 실행)
// 실행: node scripts/build-world-today.mjs 11-13          (특정 날짜, 여러 개 가능: 11-13 11-14)
//       node scripts/build-world-today.mjs                (1월 1일 ~ 12월 31일 전체, 오래 걸려요)
//
// 출처: 한국어 위키백과의 날짜 문서(예: "11월 13일")의 "사건" 목록 (CC BY-SA, 화면에 출처 표시 필요)
// 결과: public/data/world-today.csv  (같은 날짜 줄은 새로 바꾸고, 다른 날짜 줄은 그대로 둬요)
//
// CSV 열
//   month, day, year : 날짜 (기원전은 year가 음수, 예: -490 = 기원전 490년)
//   text             : 화면에 보여줄 한 줄
//   link             : 누르면 열릴 한국어 위키백과 문서 (문장 안의 첫 번째 링크)
//   korea            : 한국 관련이면 Y
//   pick             : 화면에 보여줄 사건이면 Y. 엑셀에서 Y/N만 바꾸면 보여줄 사건을 직접 바꿀 수 있어요
import fs from "node:fs";

const OUT = new URL("../public/data/world-today.csv", import.meta.url);
const UA = "weather-dashboard-study/0.1 (https://github.com/Cheon-8642/claude_project)";
const API = "https://ko.wikipedia.org/w/api.php";
const PICK_COUNT = 5; // 하루에 보여줄 사건 수
const MAX_TEXT_LENGTH = 60; // 이보다 긴 문장은 한 줄로 이해하기 어려워서 자동 선택에서 빼요
const KOREA_WORDS = ["대한민국", "한국", "조선", "고려", "신라", "백제", "고구려", "발해", "대한제국", "서울", "부산", "평양", "북한", "남한", "이승만", "박정희", "세종", "이순신"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wiki(params) {
  const url = `${API}?${new URLSearchParams({ ...params, format: "json" })}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`위키백과 응답 오류 ${res.status}`);
  return res.json();
}

// 위키 문법을 읽기 쉬운 글자로: [[문서|보이는 글]] → 보이는 글, '''굵게''' → 굵게, 각주·틀 제거
function plain(text) {
  return text
    .replace(/<ref[^>]*\/>|<ref[^>]*>[\s\S]*?<\/ref>/g, "")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// 문장 안의 첫 번째 링크 문서 (연도·날짜 문서는 건너뛰어요)
function firstLink(text) {
  for (const match of text.matchAll(/\[\[([^\]|#]+)/g)) {
    const target = match[1].trim();
    if (/^(기원전 )?\d+년$|^\d+월 \d+일$|^\d+세기$/.test(target)) continue;
    return `https://ko.wikipedia.org/wiki/${encodeURIComponent(target.replaceAll(" ", "_"))}`;
  }
  return "";
}

function parseYear(text) {
  const match = plain(text).match(/^(기원전\s*)?(\d+)년/);
  if (!match) return null;
  return match[1] ? -Number(match[2]) : Number(match[2]);
}

// 날짜 문서의 "사건" 목록 읽기
async function readDay(month, day) {
  const page = `${month}월 ${day}일`;
  const sections = (await wiki({ action: "parse", page, prop: "sections" })).parse.sections;
  const section = sections.find((s) => s.line.trim() === "사건");
  if (!section) return [];
  const wikitext = (await wiki({ action: "parse", page, prop: "wikitext", section: section.index })).parse.wikitext["*"];

  const events = [];
  let year = null;
  for (const line of wikitext.split("\n")) {
    if (/^\*[^*]/.test(line)) {
      // "* 1860년 - 링컨, …" 또는 "* 1962년" (아래 ** 줄들이 이 해의 사건)
      const body = line.replace(/^\*\s*/, "");
      year = parseYear(body);
      const text = plain(body).replace(/^(기원전\s*)?\d+년\s*[-–—:]?\s*/, "");
      if (year !== null && text) events.push({ year, text, link: firstLink(body.replace(/^.*?년\]?\]?\s*[-–—:]?/, "")) });
    } else if (/^\*\*/.test(line) && year !== null) {
      const body = line.replace(/^\*+\s*/, "");
      const text = plain(body);
      if (text) events.push({ year, text, link: firstLink(body) });
    }
  }
  return events.map((e) => ({ month, day, ...e, korea: KOREA_WORDS.some((w) => e.text.includes(w)) }));
}

// 하루 5개 자동 선택: 한국 관련 1개 → 시대별(1900년 전 / 1900년대 / 2000년 이후)로 고르게 → 나머지는 짧은 문장 순
function autoPick(events) {
  const ok = events.filter((e) => e.text.length <= MAX_TEXT_LENGTH && !e.text.includes(";"));
  const picked = new Set();
  const korea = ok.find((e) => e.korea);
  if (korea) picked.add(korea);
  const eras = [(e) => e.year < 1900, (e) => e.year >= 1900 && e.year < 2000, (e) => e.year >= 2000];
  for (let round = 0; picked.size < PICK_COUNT && round < 3; round++) {
    for (const inEra of eras) {
      if (picked.size >= PICK_COUNT) break;
      const next = ok.filter((e) => inEra(e) && !picked.has(e)).sort((a, b) => a.text.length - b.text.length)[round] ?? ok.find((e) => inEra(e) && !picked.has(e));
      if (next) picked.add(next);
    }
  }
  for (const e of ok) if (picked.size < PICK_COUNT) picked.add(e);
  return picked;
}

const csvCell = (value) => {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};
const HEADER = "month,day,year,text,link,korea,pick";

// 만들 날짜 목록
const args = process.argv.slice(2);
const dates = args.length
  ? args.map((a) => a.split("-").map(Number))
  : Array.from({ length: 366 }, (_, i) => { const d = new Date(2024, 0, 1 + i); return [d.getMonth() + 1, d.getDate()]; });

// 기존 파일의 다른 날짜 줄은 그대로 두기
const keep = [];
if (fs.existsSync(OUT)) {
  const lines = fs.readFileSync(OUT, "utf8").replace(/^﻿/, "").split("\n").slice(1).filter(Boolean);
  const targets = new Set(dates.map(([m, d]) => `${m},${d},`));
  for (const line of lines) if (![...targets].some((t) => line.startsWith(t))) keep.push(line);
}

const rows = [];
for (const [month, day] of dates) {
  const events = await readDay(month, day);
  const picked = autoPick(events);
  for (const e of events) {
    rows.push([e.month, e.day, e.year, e.text, e.link, e.korea ? "Y" : "N", picked.has(e) ? "Y" : "N"].map(csvCell).join(","));
  }
  console.log(`${month}월 ${day}일: 사건 ${events.length}개, 자동 선택 ${picked.size}개`);
  await sleep(300);
}

// 엑셀에서 한글이 깨지지 않도록 맨 앞에 BOM(﻿)을 붙여요.
const all = [...keep, ...rows].sort((a, b) => {
  const [am, ad, ay] = a.split(",").map(Number);
  const [bm, bd, by] = b.split(",").map(Number);
  return am - bm || ad - bd || ay - by;
});
fs.writeFileSync(OUT, "﻿" + [HEADER, ...all].join("\n") + "\n");
console.log(`public/data/world-today.csv 저장 (전체 ${all.length}줄)`);
