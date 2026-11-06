// public/data/countries.json을 만드는 스크립트입니다. (화면에서 쓰는 코드가 아니라, 데이터를 다시 받고 싶을 때만 실행)
// 실행: node scripts/build-countries.mjs
//
// Wikidata(CC0)에서 나라마다 아래 정보를 받아 파일로 저장해요.
//   wikidata  : 나라의 Wikidata 번호 (예: 이라크 → Q796). 역사 찾기에서 이 번호로 바로 조회해요.
//   code      : 나라 두 글자 코드 (예: KR)
//   numeric   : 나라 숫자 코드 (예: 410). 세계지도 모양 파일의 나라 번호와 같아요.
//   name, nameEn            : 나라 이름 (한국어, 영어)
//   capital, capitalEn      : 지금 수도 이름 (한국어, 영어)
//   capitalId               : 날씨 화면 주소에 쓰는 수도 id (예: seoul)
//   latitude, longitude     : 수도 좌표
import fs from "node:fs";

const OUT = new URL("../public/data/countries.json", import.meta.url);
const UA = "weather-dashboard-study/0.1 (https://github.com/Cheon-8642/claude_project)";

const query = `
SELECT ?country ?numeric ?alpha2 ?nameKo ?nameEn ?cap ?capKo ?capEn ?coord ?rank WHERE {
  ?country wdt:P299 ?numeric .
  FILTER NOT EXISTS { ?country wdt:P576 [] }                 # 없어진 나라 제외
  OPTIONAL { ?country wdt:P297 ?alpha2 . }
  ?country p:P36 ?st . ?st ps:P36 ?cap ; wikibase:rank ?rank .
  FILTER NOT EXISTS { ?st pq:P582 [] }                       # 예전 수도 제외
  FILTER(?rank != wikibase:DeprecatedRank)
  ?cap wdt:P625 ?coord .
  OPTIONAL { ?country rdfs:label ?nameKo . FILTER(LANG(?nameKo) = "ko") }
  OPTIONAL { ?country rdfs:label ?nameEn . FILTER(LANG(?nameEn) = "en") }
  OPTIONAL { ?cap rdfs:label ?capKo . FILTER(LANG(?capKo) = "ko") }
  OPTIONAL { ?cap rdfs:label ?capEn . FILTER(LANG(?capEn) = "en") }
}`;
const res = await fetch("https://query.wikidata.org/sparql", {
  method: "POST",
  headers: { "User-Agent": UA, Accept: "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ query }),
});
if (!res.ok) throw new Error(`Wikidata 응답 오류 ${res.status}`);
const rows = (await res.json()).results.bindings;

// 수도 이름을 주소에 쓸 수 있는 영어 소문자로 바꾸기 (예: "Washington, D.C." → "washington-d-c")
const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const rankScore = (r) => (r.rank.value.endsWith("PreferredRank") ? 1 : 0);

// 나라 숫자 코드 하나에 한 줄만. 수도가 여러 개면 "우선(preferred)" 표시가 있는 수도, 없으면 처음 것.
const byNumeric = new Map();
for (const r of rows) {
  const numeric = r.numeric.value;
  const prev = byNumeric.get(numeric);
  if (prev && rankScore(prev) >= rankScore(r)) continue;
  byNumeric.set(numeric, r);
}

const countries = [];
for (const [numeric, r] of byNumeric) {
  const [lon, lat] = r.coord.value.replace(/^.*Point\(|\).*$/g, "").split(" ").map(Number);
  if (Number.isNaN(lat) || Number.isNaN(lon)) continue;
  const capEn = r.capEn?.value ?? r.capKo?.value;
  countries.push({
    wikidata: r.country.value.split("/").pop(),
    code: r.alpha2?.value ?? null,
    numeric,
    name: r.nameKo?.value ?? r.nameEn?.value,
    nameEn: r.nameEn?.value ?? r.nameKo?.value,
    capital: r.capKo?.value ?? capEn,
    capitalEn: capEn,
    capitalId: slug(capEn) || `capital-${numeric}`,
    latitude: Number(lat.toFixed(4)),
    longitude: Number(lon.toFixed(4)),
  });
}
countries.sort((a, b) => a.name.localeCompare(b.name, "ko"));
fs.writeFileSync(OUT, JSON.stringify(countries, null, 1) + "\n");
console.log(`나라 ${countries.length}곳을 public/data/countries.json에 저장했어요.`);
