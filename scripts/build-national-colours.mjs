// 세계지도에 칠할 나라 색을 만드는 스크립트입니다. (데이터를 다시 받고 싶을 때만 실행)
// 실행: node scripts/build-national-colours.mjs
//
// 출처: 영어 위키백과 "National colours" 문서의 표 (CC BY-SA, 화면에 출처 표시 필요)
//   표의 "Primary" 칸에 있는 색 견본 중 첫 번째 색(견본의 CSS background-color)을 그 나라 색으로 써요.
//   "#CD2E3A" 같은 코드뿐 아니라 "white", "black" 같은 색 이름으로 적힌 견본도 그대로 첫 번째로 쳐요.
//   나라 이름은 영어라서, 위키백과 문서의 Wikidata 번호로 public/data/countries.json의 나라와 맞춰요.
//
// 결과: public/data/national-colours.json  { "410": { "color": "#CD2E3A", "name": "대한민국" }, … }  (키 = 나라 숫자 코드)
import fs from "node:fs";

const DATA = new URL("../public/data/", import.meta.url);
const OUT = new URL("national-colours.json", DATA);
const UA = "weather-dashboard-study/0.1 (https://github.com/Cheon-8642/claude_project)";
const API = "https://en.wikipedia.org/w/api.php";

async function wiki(params) {
  const res = await fetch(`${API}?${new URLSearchParams({ ...params, format: "json", formatversion: "2" })}`, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`위키백과 응답 오류 ${res.status}`);
  return res.json();
}

// 표에 이름으로 적힌 CSS 색 → 색 코드 (transparent는 "색 없음"이라 다음 견본으로 넘어가요)
const NAMED_COLORS = {
  white: "#FFFFFF",
  black: "#000000",
  red: "#FF0000",
  yellow: "#FFFF00",
  green: "#008000",
  gold: "#FFD700",
  skyblue: "#87CEEB",
  blue: "#0000FF",
  orange: "#FFA500",
};

function toHex(value) {
  const v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${[...v.slice(1)].map((c) => c + c).join("")}`.toUpperCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v.toUpperCase();
  return NAMED_COLORS[v] ?? null; // transparent 이나 모르는 이름은 null
}

// 1) 문서 HTML에서 표의 줄마다 [나라 문서 제목, 첫 번째 Primary 색] 뽑기
const html = (await wiki({ action: "parse", page: "National_colours", prop: "text" })).parse.text;
const picks = []; // { title, color }
for (const table of html.match(/<table[\s\S]*?<\/table>/g) ?? []) {
  // 나라 색 표만 (제목 칸에 링크가 섞여 있을 수 있어서 태그를 지운 글자로 확인)
  if (!/Primary colou?rs/.test(table.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "))) continue;
  for (const row of table.match(/<tr[\s\S]*?<\/tr>/g) ?? []) {
    const cells = row.match(/<td[\s\S]*?<\/td>/g);
    if (!cells || cells.length < 5) continue;
    const link = cells[0].match(/<a href="\/wiki\/([^"#]+)"/);
    // 5번째 칸 = Primary 색 견본들. 순서대로 보면서 색이 있는 첫 번째 견본을 고르기
    const color = [...cells[4].matchAll(/background-color:\s*([^;"]+)/g)].map((m) => toHex(m[1])).find(Boolean);
    if (link && color) picks.push({ title: decodeURIComponent(link[1]), color });
  }
}

// 2) 위키백과 문서 제목 → Wikidata 번호 (50개씩 물어봐요)
const titleToQid = new Map();
for (let i = 0; i < picks.length; i += 50) {
  const titles = picks.slice(i, i + 50).map((p) => p.title.replaceAll("_", " "));
  const data = await wiki({ action: "query", titles: titles.join("|"), prop: "pageprops", ppprop: "wikibase_item", redirects: "1" });
  const redirects = new Map((data.query.redirects ?? []).map((r) => [r.from, r.to]));
  const normalized = new Map((data.query.normalized ?? []).map((n) => [n.from, n.to]));
  const pageQid = new Map(data.query.pages.map((p) => [p.title, p.pageprops?.wikibase_item]));
  for (const t of titles) {
    let title = normalized.get(t) ?? t;
    title = redirects.get(title) ?? title;
    if (pageQid.get(title)) titleToQid.set(t, pageQid.get(title));
  }
}

// 3) countries.json의 나라와 맞추기
const countries = JSON.parse(fs.readFileSync(new URL("countries.json", DATA), "utf8"));
const byQid = new Map(countries.map((c) => [c.wikidata, c]));
// Wikidata 번호가 서로 달라서 따로 맞춰 주는 나라 (위키백과 문서 제목 → 나라 숫자 코드)
// 예: 위키백과 "Netherlands"(Q55)와 countries.json의 "네덜란드 왕국"(Q29999)
const ALIASES = { Netherlands: "528" };
const byNumeric = new Map(countries.map((c) => [c.numeric, c]));
const result = {};
const unmatched = [];
for (const { title, color } of picks) {
  const country = byQid.get(titleToQid.get(title.replaceAll("_", " "))) ?? byNumeric.get(ALIASES[title]);
  if (!country) { unmatched.push(title); continue; }
  if (!result[country.numeric]) result[country.numeric] = { color, name: country.name };
}
fs.writeFileSync(OUT, JSON.stringify(result, null, 1) + "\n");

const missing = countries.filter((c) => !result[c.numeric]).map((c) => c.name);
console.log(`표에서 찾은 나라 ${picks.length}곳 → 색을 정한 나라 ${Object.keys(result).length}곳`);
console.log(`countries.json에 없어서 뺀 표 항목 ${unmatched.length}개: ${unmatched.join(", ")}`);
console.log(`색이 없는 나라 ${missing.length}곳 (지도에서 기본 색): ${missing.join(", ")}`);
for (const n of ["410", "392", "156", "840", "276", "250", "826", "368", "076", "643"]) {
  console.log(`  ${n} ${result[n]?.name ?? "?"}: ${result[n]?.color ?? "없음"}`);
}
