// query.wikidata.org에서 직접 받은 결과 CSV를 public/data/country-history.csv에 넣는 스크립트입니다.
// (스크립트로 찾다가 실패한 나라를 직접 검색해서 넣을 때 사용)
//
// 실행: node scripts/import-query-csv.mjs <받은 파일…> <나라 두 글자 코드> [기준 날짜]
//   예: node scripts/import-query-csv.mjs C:\Users\knuser\Downloads\germanquery.csv DE 2026-11-13
//       node scripts/import-query-csv.mjs uk1.csv uk2.csv GB 2026-11-13   (파일 여러 개를 합쳐서)
//
// 받은 파일은 event,title,date 열이 있어야 해요. (query.wikidata.org → 다운로드 → CSV 파일)
// precision 열이 있으면 11(일) 이상인 줄만 써요. 없어도 괜찮아요: 연도만·월만 아는 날짜는
// 1월 1일·그 달 1일로 저장돼 있어서, 그 주(월~일)에 해당하는 날짜만 고르면 저절로 빠지기 때문이에요.
// (단, 그 주에 1일이 들어 있으면 연·월만 아는 사건이 섞일 수 있으니 precision 열이 있는 쿼리를 쓰세요.)
// 같은 사건·날짜가 두 번이면 한 번만 넣고, 같은 주·같은 나라의 기존 줄은 지우고 새로 넣어요.
import fs from "node:fs";

// 인자: 파일들, 그다음 나라 코드(대문자 두 글자), 마지막에 날짜(선택)
const args = process.argv.slice(2);
const codeIndex = args.findIndex((a) => /^[A-Z]{2}$/.test(a));
if (codeIndex < 1) {
  console.log("사용법: node scripts/import-query-csv.mjs <받은 파일…> <나라 코드(예: DE)> [기준 날짜]");
  process.exit(1);
}
const inputs = args.slice(0, codeIndex);
const code = args[codeIndex];
const dateArg = args[codeIndex + 1] ?? "2026-11-13";

const DATA = new URL("../public/data/", import.meta.url);
const OUT = new URL("country-history.csv", DATA);
const HEADER = "week_start,qid,country,year,month,day,title,link";
const BOM = "\uFEFF"; // 엑셀에서 한글이 깨지지 않게 파일 맨 앞에 붙이는 글자
const stripBom = (text) => (text.startsWith(BOM) ? text.slice(1) : text);

const country = JSON.parse(fs.readFileSync(new URL("countries.json", DATA), "utf8")).find((c) => c.code === code);
if (!country) {
  console.log(`나라 코드 ${code}를 countries.json에서 찾지 못했어요.`);
  process.exit(1);
}

// 그 주의 월요일~일요일
const [y, m, d] = dateArg.split("-").map(Number);
const base = new Date(Date.UTC(y, m - 1, d));
const monday = new Date(base);
monday.setUTCDate(base.getUTCDate() - ((base.getUTCDay() + 6) % 7));
const week = Array.from({ length: 7 }, (_, i) => {
  const day = new Date(monday);
  day.setUTCDate(monday.getUTCDate() + i);
  return `${day.getUTCMonth() + 1}-${day.getUTCDate()}`;
});
const weekStart = monday.toISOString().slice(0, 10);

// 간단한 CSV 한 줄 읽기 (따옴표 안의 쉼표 처리)
function parseLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { cells.push(cell); cell = ""; }
    else cell += ch;
  }
  cells.push(cell);
  return cells;
}
const csvCell = (value) => {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};
const wikiLink = (title) => `https://ko.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`;

const seen = new Set();
const events = [];
let skipped = 0;
for (const input of inputs) {
  const lines = stripBom(fs.readFileSync(input, "utf8")).split(/\r?\n/).filter(Boolean);
  const header = parseLine(lines[0]).map((h) => h.trim());
  const col = (name) => header.indexOf(name);
  if (["event", "title", "date"].some((name) => col(name) === -1)) {
    console.log(`${input}: 열에 event,title,date가 없어요 (${header.join(",")})`);
    process.exit(1);
  }
  for (const line of lines.slice(1)) {
    const cells = parseLine(line);
    const match = cells[col("date")].match(/^([+-]?\d+)-(\d{2})-(\d{2})/);
    const precision = col("precision") === -1 ? 11 : Number(cells[col("precision")]);
    if (!match || precision < 11) { skipped++; continue; }
    const [ey, em, ed] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (!week.includes(`${em}-${ed}`)) { skipped++; continue; }
    const id = cells[col("event")].split("/").pop();
    const key = `${id}|${ey}-${em}-${ed}`;
    if (seen.has(key)) { skipped++; continue; }
    seen.add(key);
    events.push({ y: ey, m: em, d: ed, title: cells[col("title")] });
  }
}
events.sort((a, b) => b.y - a.y || b.m - a.m || b.d - a.d);

const rows = events.length
  ? events.map((e) => [weekStart, country.wikidata, country.name, e.y, e.m, e.d, e.title, wikiLink(e.title)].map(csvCell).join(","))
  : [[weekStart, country.wikidata, country.name, "", "", "", "", ""].map(csvCell).join(",")];

const prefix = `${weekStart},${country.wikidata},`;
const keep = fs.existsSync(OUT)
  ? stripBom(fs.readFileSync(OUT, "utf8")).split("\n").slice(1).filter((line) => line && !line.startsWith(prefix))
  : [];
fs.writeFileSync(OUT, BOM + [HEADER, ...keep, ...rows].join("\n") + "\n");
console.log(`${country.name}(${country.wikidata}): ${events.length}건 넣음, ${skipped}줄 건너뜀 → public/data/country-history.csv (전체 ${keep.length + rows.length}줄)`);
