// 첫 화면 동작: 세계지도에서 나라를 누르거나, 검색칸에서 나라를 고르면
// 그 나라 수도의 날씨 화면(city.html)으로 이동합니다.
//
// 데이터 파일 (public/data/)
//   countries.json      : 나라 이름(한/영), 수도 이름, 수도 좌표 (Wikidata에서 미리 만들어 둠)
//   countries-110m.json : 세계지도 나라 경계선 (Natural Earth, world-atlas)
//   national-colours.json : 나라 색 (영어 위키백과 "National colours"의 첫 번째 색)

const form = document.getElementById("search-form");
const input = document.getElementById("country-input");
const suggestionList = document.getElementById("suggestions");
const message = document.getElementById("message");
const recentSection = document.getElementById("recent-section");
const recentBox = document.getElementById("recent");
const mapBox = document.getElementById("map");
const tooltip = document.getElementById("map-tooltip");

const SUGGESTION_LIMIT = 8;
const MAP_WIDTH = 960;
const MAP_HEIGHT = 500;

let countries = []; // countries.json 내용
let suggestions = []; // 지금 목록에 보이는 나라들
let activeIndex = -1; // 키보드(↑↓)로 고른 위치

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("error", isError);
  message.classList.remove("hidden");
}

// 나라를 고르면: 최근에 본 나라에 저장하고, 수도의 날씨 화면으로 이동
function openCountry(country) {
  const capital = {
    id: country.capitalId,
    name: country.capital,
    country: country.name,
    latitude: country.latitude,
    longitude: country.longitude,
    wikidata: country.wikidata,
  };
  saveRecent(capital);
  window.location.href = cityPageUrl(capital);
}

// ---------- 나라 검색 ----------

// 한국어·영어 이름에 검색어가 들어간 나라 찾기 (검색어로 시작하는 나라가 위쪽에)
function searchCountries(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts = [];
  const contains = [];
  for (const country of countries) {
    const names = [country.name, country.nameEn].map((n) => n.toLowerCase());
    if (names.some((n) => n.startsWith(q))) starts.push(country);
    else if (names.some((n) => n.includes(q))) contains.push(country);
  }
  return [...starts, ...contains].slice(0, SUGGESTION_LIMIT);
}

// 이름에서 검색어 부분만 강조하기. 예: "독" → <mark>독</mark>일
function highlight(text, query) {
  const fragment = document.createDocumentFragment();
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (!query || index === -1) {
    fragment.append(text);
    return fragment;
  }
  const mark = document.createElement("mark");
  mark.textContent = text.slice(index, index + query.length);
  fragment.append(text.slice(0, index), mark, text.slice(index + query.length));
  return fragment;
}

function closeSuggestions() {
  suggestionList.classList.add("hidden");
  input.setAttribute("aria-expanded", "false");
  activeIndex = -1;
}

function renderSuggestions(query) {
  suggestionList.innerHTML = "";

  if (suggestions.length === 0) {
    const empty = document.createElement("li");
    empty.className = "suggestion-empty";
    empty.textContent = `"${query}"이(가) 들어간 나라가 없어요.`;
    suggestionList.appendChild(empty);
  }

  suggestions.forEach((country, index) => {
    const item = document.createElement("li");
    item.className = "suggestion";
    item.id = `suggestion-${index}`;
    item.setAttribute("role", "option");
    item.classList.toggle("active", index === activeIndex);

    const name = document.createElement("span");
    name.className = "suggestion-name";
    name.appendChild(highlight(country.name, query));
    if (country.nameEn !== country.name) {
      const english = document.createElement("span");
      english.className = "suggestion-en";
      english.appendChild(highlight(country.nameEn, query));
      name.append(" ", english);
    }

    const where = document.createElement("span");
    where.className = "suggestion-where";
    where.textContent = `수도 ${country.capital}`;

    item.append(name, where);
    // mousedown을 쓰는 이유: click보다 먼저 일어나서, 입력칸이 포커스를 잃기 전에 처리할 수 있어요.
    item.addEventListener("mousedown", (event) => {
      event.preventDefault();
      openCountry(country);
    });
    suggestionList.appendChild(item);
  });

  suggestionList.classList.remove("hidden");
  input.setAttribute("aria-expanded", "true");
}

function updateSuggestions() {
  const query = input.value.trim();
  if (!query) {
    closeSuggestions();
    return;
  }
  suggestions = searchCountries(query);
  activeIndex = -1;
  message.classList.add("hidden");
  renderSuggestions(query);
}

// 나라 목록이 파일에 있어서 서버를 부르지 않고 바로 찾을 수 있어요.
input.addEventListener("input", updateSuggestions);

// ↑ ↓ 로 고르고, Enter로 이동, Esc로 닫기
input.addEventListener("keydown", (event) => {
  if (suggestionList.classList.contains("hidden") || suggestions.length === 0) return;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const step = event.key === "ArrowDown" ? 1 : -1;
    activeIndex = (activeIndex + step + suggestions.length) % suggestions.length;
    renderSuggestions(input.value.trim());
    input.setAttribute("aria-activedescendant", `suggestion-${activeIndex}`);
  } else if (event.key === "Escape") {
    closeSuggestions();
  }
});

input.addEventListener("blur", closeSuggestions);
input.addEventListener("focus", updateSuggestions);

// 검색 버튼(또는 Enter): 고른 나라가 있으면 그 나라, 없으면 목록의 첫 번째 나라로 이동
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = input.value.trim();
  if (!query) {
    showMessage("나라 이름을 입력해 주세요.", true);
    return;
  }
  suggestions = searchCountries(query);
  const country = suggestions[activeIndex] || suggestions[0];
  if (country) {
    openCountry(country);
  } else {
    closeSuggestions();
    showMessage(`"${query}"이(가) 들어간 나라를 찾지 못했어요. 다른 이름으로 검색해 보세요.`, true);
  }
});

// ---------- 최근에 본 나라 ----------

function renderRecent() {
  const recent = loadRecent();
  recentSection.classList.toggle("hidden", recent.length === 0);
  recentBox.innerHTML = "";
  recent.forEach((capital) => {
    const chip = document.createElement("a");
    chip.className = "chip";
    chip.href = cityPageUrl(capital);
    chip.textContent = capital.country;
    chip.title = `수도 ${capital.name}`;
    chip.addEventListener("click", () => saveRecent(capital));
    recentBox.appendChild(chip);
  });
}

// ---------- 세계지도 ----------

function showTooltip(text, event) {
  const box = mapBox.getBoundingClientRect();
  tooltip.textContent = text;
  tooltip.classList.remove("hidden");
  // 지도 오른쪽 끝에서는 말풍선이 잘리지 않도록 마우스 왼쪽에 보여줘요.
  let left = event.clientX - box.left + 12;
  if (left + tooltip.offsetWidth > box.width) left = event.clientX - box.left - tooltip.offsetWidth - 12;
  tooltip.style.left = `${Math.max(0, left)}px`;
  tooltip.style.top = `${event.clientY - box.top + 12}px`;
}

// 나라 색 칠하기: 위키백과 "National colours" 표의 Primary 첫 번째 색(public/data/national-colours.json)을
// 그대로 쓰되, 왼쪽 위는 조금 밝게 → 오른쪽 아래는 원래 색인 그라데이션으로 칠해요. (색깔 자체는 바뀌지 않아요)
const LIGHT_SIDE = 0.75; // 왼쪽 위에 나라 색을 얼마나 남길지 (나머지는 흰색과 섞여 밝아져요)
const DARK_SIDE = 1; // 오른쪽 아래 (1 = 나라 색 그대로)
const NO_COLOR = ["#f1f5f9", "#cbd5e1"]; // 표에 색이 없는 나라: 연한 회색 그라데이션

// 두 색을 섞기. 예: mixColor("#ff0000", "#ffffff", 0.5) → 분홍
function mixColor(color, base, amount) {
  const rgb = (hex) => {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  };
  const a = rgb(color);
  const b = rgb(base);
  return `rgb(${a.map((v, i) => Math.round(v * amount + b[i] * (1 - amount))).join(",")})`;
}

// 나라마다 그라데이션 하나씩 만들어 두고, 그 id를 돌려줘요.
function addCountryGradient(defs, numeric, color) {
  const id = `fill-${numeric}`;
  const gradient = defs.append("linearGradient")
    .attr("id", id)
    .attr("x1", "0%").attr("y1", "0%")
    .attr("x2", "100%").attr("y2", "100%");
  gradient.append("stop").attr("offset", "0%")
    .attr("stop-color", color ? mixColor(color, "#ffffff", LIGHT_SIDE) : NO_COLOR[0]);
  gradient.append("stop").attr("offset", "100%")
    .attr("stop-color", color ? mixColor(color, "#ffffff", DARK_SIDE) : NO_COLOR[1]);
  return id;
}

function drawMap(world, nationalColours) {
  const byNumeric = new Map(countries.map((c) => [c.numeric, c]));
  const shapes = topojson.feature(world, world.objects.countries).features;

  // 둥근 세계지도 모양(Natural Earth 도법)으로 화면 크기에 맞추기
  const projection = d3.geoNaturalEarth1().fitSize([MAP_WIDTH, MAP_HEIGHT], { type: "Sphere" });
  const path = d3.geoPath(projection);

  const svg = d3.select(mapBox)
    .insert("svg", ":first-child") // 확대 버튼보다 앞에 두기 (휴대폰에서 버튼이 지도 아래로 가도록)
    .attr("viewBox", `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`)
    .attr("role", "img")
    .attr("aria-label", "세계지도. 나라를 누르면 수도의 날씨를 볼 수 있어요.");
  const defs = svg.append("defs"); // 나라별 그라데이션을 넣어 두는 곳
  const layer = svg.append("g");

  layer.append("path").attr("class", "sphere").attr("d", path({ type: "Sphere" }));

  layer.selectAll("path.country")
    .data(shapes)
    .join("path")
    .attr("d", path)
    .each(function (shape) {
      const country = byNumeric.get(shape.id);
      const el = d3.select(this);
      if (!country) {
        // 수도 정보가 없는 곳(예: 남극)은 회색으로 두고 누를 수 없게
        el.attr("class", "country disabled");
        return;
      }
      const gradientId = addCountryGradient(defs, shape.id, nationalColours[shape.id]?.color);
      el.attr("class", "country clickable")
        .style("fill", `url(#${gradientId})`)
        .attr("tabindex", 0)
        .attr("role", "button")
        .attr("aria-label", `${country.name}, 수도 ${country.capital}`)
        .on("mousemove", (event) => showTooltip(`${country.name} · ${country.capital}`, event))
        .on("mouseleave", () => tooltip.classList.add("hidden"))
        .on("click", () => openCountry(country))
        .on("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openCountry(country);
          }
        });
    });

  // 확대/축소: 마우스 휠, 두 손가락, + − 버튼
  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .translateExtent([[0, 0], [MAP_WIDTH, MAP_HEIGHT]])
    .on("zoom", (event) => layer.attr("transform", event.transform));
  svg.call(zoom);
  document.getElementById("zoom-in").addEventListener("click", () => svg.transition().call(zoom.scaleBy, 1.6));
  document.getElementById("zoom-out").addEventListener("click", () => svg.transition().call(zoom.scaleBy, 1 / 1.6));
  document.getElementById("zoom-reset").addEventListener("click", () => svg.transition().call(zoom.transform, d3.zoomIdentity));
}

// ---------- 지도 왼쪽 아래: 오늘의 역사 (나라 상관없이) ----------
// public/data/world-today.csv(한국어 위키백과 날짜 문서에서 뽑은 사건)에서
// 오늘 날짜이고 pick이 Y인 줄만 보여줘요. 이 CSV는 엑셀로 직접 고칠 수 있어요.

async function loadWorldToday() {
  const today = historyToday();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const message = document.getElementById("world-today-message");
  const list = document.getElementById("world-today-list");
  document.getElementById("world-today-label").textContent = `${month}월 ${day}일`;

  try {
    const rows = await loadCsv("data/world-today.csv");
    const events = rows
      .filter((r) => Number(r.month) === month && Number(r.day) === day && r.pick.toUpperCase() === "Y")
      .sort((a, b) => Number(b.year) - Number(a.year)); // 최신순
    if (events.length === 0) {
      message.textContent = "기록된 사건이 없습니다.";
      return;
    }
    message.classList.add("hidden");
    events.forEach((r) => {
      list.appendChild(createHistoryItem({ y: Number(r.year), title: r.text, link: r.link }, { showDay: false }));
    });
  } catch {
    message.textContent = "오늘의 역사를 불러오지 못했어요.";
  }
}

// 오늘의 역사 상자 크기 조절: 작게 / 크게 / 최소화 / 원래대로 (새로고침해도 기억해요)
const WORLD_TODAY_VIEW_KEY = "world-today-view";
const WORLD_TODAY_SIZES = ["small", "normal", "large"];

function setupWorldTodayControls() {
  const box = document.getElementById("world-today");
  let view = { size: "normal", minimized: false };
  try {
    view = { ...view, ...JSON.parse(localStorage.getItem(WORLD_TODAY_VIEW_KEY)) };
  } catch {
    // 저장된 값이 없거나 읽을 수 없으면 처음 크기로
  }

  const buttons = Object.fromEntries(
    [...box.querySelectorAll("[data-action]")].map((button) => [button.dataset.action, button])
  );

  function apply() {
    box.dataset.size = view.size;
    box.classList.toggle("minimized", view.minimized);
    const index = WORLD_TODAY_SIZES.indexOf(view.size);
    buttons.shrink.disabled = view.minimized || index === 0;
    buttons.expand.disabled = view.minimized || index === WORLD_TODAY_SIZES.length - 1;
    buttons.minimize.disabled = view.minimized;
    buttons.restore.disabled = !view.minimized && view.size === "normal";
    try {
      localStorage.setItem(WORLD_TODAY_VIEW_KEY, JSON.stringify(view));
    } catch {
      // 저장이 막혀 있어도 버튼은 동작해요
    }
  }

  const step = (direction) => {
    const index = WORLD_TODAY_SIZES.indexOf(view.size) + direction;
    view.size = WORLD_TODAY_SIZES[Math.min(Math.max(index, 0), WORLD_TODAY_SIZES.length - 1)];
  };
  buttons.shrink.addEventListener("click", () => { step(-1); apply(); });
  buttons.expand.addEventListener("click", () => { step(1); apply(); });
  buttons.minimize.addEventListener("click", () => { view.minimized = true; apply(); });
  buttons.restore.addEventListener("click", () => { view = { size: "normal", minimized: false }; apply(); });
  apply();
}

// 휴대폰: 오늘의 역사를 아래 시트로
//   접힘 → 손잡이·제목 줄을 위로 밀거나 손잡이를 누르면 펼침(화면 전체)
//   펼침 → 손잡이를 아래로 밀거나 누르면 접힘
const PHONE = window.matchMedia("(max-width: 480px)");
const SWIPE_DISTANCE = 50; // 이만큼(px) 이상 밀면 펼치기/접기

function setupWorldTodaySheet() {
  const sheet = document.getElementById("world-today");
  const handle = document.getElementById("sheet-handle");
  const head = sheet.querySelector(".world-today-head");
  let open = false;
  let startY = null;
  let moved = 0;

  function setOpen(value) {
    open = value;
    sheet.classList.toggle("sheet-open", open);
    sheet.style.transform = "";
    handle.setAttribute("aria-expanded", String(open));
    handle.setAttribute("aria-label", open ? "오늘의 역사 접기" : "오늘의 역사 펼치기");
  }

  // 접혀 있을 때는 손잡이와 제목 줄 어디를 밀어도 되고, 펼쳐져 있을 때는 맨 위 손잡이를 밀어서 접어요.
  const canDragFrom = (target) => handle.contains(target) || (!open && head.contains(target));

  sheet.addEventListener("pointerdown", (event) => {
    if (!PHONE.matches || !canDragFrom(event.target)) return;
    startY = event.clientY;
    moved = 0;
    sheet.classList.add("dragging");
    sheet.setPointerCapture(event.pointerId);
  });

  sheet.addEventListener("pointermove", (event) => {
    if (startY === null) return;
    moved = event.clientY - startY; // 위로 밀면 음수, 아래로 밀면 양수
    const peek = sheet.offsetHeight - parseFloat(getComputedStyle(sheet).getPropertyValue("--peek"));
    const base = open ? 0 : peek;
    const y = Math.min(Math.max(base + moved, 0), peek);
    sheet.style.transform = `translateY(${y}px)`; // 손가락을 따라 움직이기
  });

  function endDrag() {
    if (startY === null) return;
    sheet.classList.remove("dragging");
    startY = null;
    if (Math.abs(moved) < 5) setOpen(!open); // 거의 안 움직였으면 누른 것으로 보고 열고 닫기
    else if (!open && moved < -SWIPE_DISTANCE) setOpen(true);
    else if (open && moved > SWIPE_DISTANCE) setOpen(false);
    else setOpen(open); // 조금만 밀었으면 원래 자리로
  }
  sheet.addEventListener("pointerup", endDrag);
  sheet.addEventListener("pointercancel", endDrag);

  // 키보드로 손잡이를 눌렀을 때 (마우스·터치 누르기는 위에서 처리)
  handle.addEventListener("click", (event) => {
    if (event.detail === 0) setOpen(!open);
  });

  // 화면 크기가 바뀌어 데스크톱이 되면 시트 상태를 지워요
  PHONE.addEventListener("change", () => setOpen(false));
}

// 데이터 불러오기: 나라 정보와 지도 모양을 동시에 받아요.
async function start() {
  renderRecent();
  setupWorldTodayControls();
  setupWorldTodaySheet();
  loadWorldToday();
  try {
    const [countryData, world, nationalColours] = await Promise.all([
      fetch("data/countries.json").then((r) => r.json()),
      fetch("data/countries-110m.json").then((r) => r.json()),
      // 나라 색은 없어도 지도는 그려지게 (없으면 모든 나라를 연한 회색으로)
      fetch("data/national-colours.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    ]);
    countries = countryData;
    document.getElementById("map-loading").remove();
    drawMap(world, nationalColours);
  } catch {
    document.getElementById("map-loading").textContent = "지도를 불러오지 못했어요. 새로고침해 보세요.";
  }
}

start();
