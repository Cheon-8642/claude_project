// Wikidata에서 한 나라의 "역사 속 그날" 사건을 찾는 코드입니다. (api/history.js에서 사용)
//
// 찾는 사건
//   - 나라(P17)가 그 나라이거나, 위치(P276)가 그 나라 안에 있는 곳
//   - 한국어 위키백과에 문서가 있음 (이름은 그 문서 제목)
//   - 날짜(시점 P585 또는 시작 시점 P580)가 '일'까지 정확하고, 오늘보다 과거
//   - 월·일이 찾는 날짜들 중 하나

const SPARQL_URL = "https://query.wikidata.org/sparql";
// Wikidata는 요청마다 누가 보내는지 알려 달라고 해요. (브라우저는 이 값을 못 바꿔서 서버에서 보내요)
const USER_AGENT = "weather-dashboard-study/0.1 (https://github.com/Cheon-8642/claude_project)";

async function sparql(query) {
  const response = await fetch(SPARQL_URL, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/sparql-results+json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ query }),
  });
  if (!response.ok) throw new Error(`Wikidata 응답 오류 ${response.status}`);
  // 가끔 문서 제목에 제어 문자가 섞여 JSON이 깨져서, 공백으로 바꾼 뒤 읽어요.
  const text = (await response.text()).replace(/[\u0000-\u001f]/g, " ");
  return JSON.parse(text).results.bindings;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// 후보 찾기 (빠른 방법): 4가지로 나눠 동시에 물어봐요. 작은 나라는 몇 초면 끝나지만,
// 큰 나라는 일부 조각이 Wikidata 60초 제한에 걸려 결과가 빠질 수 있어요. (화면에서 바로 찾을 때 사용)
async function candidatesFast(countryId, dayFilter) {
  const patterns = [
    `?event wdt:P17 wd:${countryId} ; wdt:P585 ?date .`,
    `?event wdt:P17 wd:${countryId} ; wdt:P580 ?date .`,
    `?event wdt:P276 ?place ; wdt:P585 ?date . ?place wdt:P17 wd:${countryId} .`,
    `?event wdt:P276 ?place ; wdt:P580 ?date . ?place wdt:P17 wd:${countryId} .`,
  ];
  const results = await Promise.allSettled(patterns.map((pattern) => sparql(`
SELECT DISTINCT ?event ?title WHERE {
  ${pattern}
  FILTER(?date <= NOW() && (${dayFilter}))
  ?article schema:about ?event ; schema:isPartOf <https://ko.wikipedia.org/> ; schema:name ?title .
}`)));
  if (results.every((r) => r.status === "rejected")) throw results[0].reason;
  return results.filter((r) => r.status === "fulfilled").flatMap((r) => r.value);
}

// 후보 찾기 (빠짐없는 방법): 한국어 위키백과 문서부터 하나씩 훑어요. 어느 나라든 50초 정도 걸리지만
// 결과가 빠지지 않아요. (scripts/build-country-history.mjs로 강대국 결과를 미리 저장할 때 사용)
async function candidatesThorough(countryId, dayFilter, retries = 3) {
  const query = `
SELECT DISTINCT ?event ?title WHERE {
  hint:Query hint:optimizer "None" .
  ?article schema:isPartOf <https://ko.wikipedia.org/> ; schema:about ?event ; schema:name ?title .
  ?event wdt:P585|wdt:P580 ?date .
  FILTER(?date <= NOW() && (${dayFilter}))
  { ?event wdt:P17 wd:${countryId} . } UNION { ?event wdt:P276 ?place . ?place wdt:P17 wd:${countryId} . }
}`;
  for (let attempt = 1; ; attempt++) {
    try {
      return await sparql(query);
    } catch (error) {
      if (attempt >= retries) throw error;
      await sleep(10000 * attempt); // 잠깐 쉬었다가 다시
    }
  }
}

// days: [{ m: 11, d: 13 }, …]  →  찾은 사건 [{ y, m, d, title, id }] (최신순)
// thorough: true면 느리지만 빠짐없는 방법으로 찾아요.
export async function findEvents(countryId, days, { thorough = false } = {}) {
  const dayFilter = days.map(({ m, d }) => `(MONTH(?date) = ${m} && DAY(?date) = ${d})`).join(" || ");

  // 1) 후보 찾기
  const candidates = thorough
    ? await candidatesThorough(countryId, dayFilter)
    : await candidatesFast(countryId, dayFilter);
  const titles = new Map(); // 사건 번호 → 한국어 위키백과 제목
  for (const row of candidates) titles.set(row.event.value.split("/").pop(), row.title.value);
  if (titles.size === 0) return [];

  // 2) 날짜가 '일'까지 정확한지 확인 ("1914년"처럼 연도만 아는 사건은 빼기)
  const rows = await sparql(`
SELECT ?event ?time WHERE {
  VALUES ?event { ${[...titles.keys()].map((id) => `wd:${id}`).join(" ")} }
  ?event p:P585|p:P580 ?st . ?st psv:P585|psv:P580 ?v .
  ?v wikibase:timeValue ?time ; wikibase:timePrecision ?precision .
  FILTER(?precision >= 11 && ?time <= NOW())
}`);

  const seen = new Set();
  const events = [];
  for (const row of rows) {
    const match = row.time.value.match(/^([+-]?\d+)-(\d{2})-(\d{2})/);
    if (!match) continue;
    const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (!days.some((day) => day.m === m && day.d === d)) continue;
    const id = row.event.value.split("/").pop();
    const key = `${id}|${y}-${m}-${d}`;
    if (seen.has(key)) continue; // 같은 사건이 시점·시작 시점을 둘 다 가진 경우
    seen.add(key);
    events.push({ y, m, d, title: titles.get(id), id });
  }
  return events.sort((a, b) => b.y - a.y || b.m - a.m || b.d - a.d);
}
