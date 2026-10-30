// 첫 화면 동작: 검색어를 입력하면 그 글자가 들어간 도시를 아래에 보여주고,
// 도시를 누르면 그 도시의 날씨 화면(city.html)으로 이동합니다.

const form = document.getElementById("search-form");
const input = document.getElementById("city-input");
const suggestionList = document.getElementById("suggestions");
const message = document.getElementById("message");
const badge = document.getElementById("source-badge");
const recentSection = document.getElementById("recent-section");
const recentBox = document.getElementById("recent");
const popularBox = document.getElementById("popular");

let suggestions = []; // 지금 목록에 보이는 도시들
let activeIndex = -1; // 키보드(↑↓)로 고른 위치
let typingTimer = null;
let latestQuery = ""; // 늦게 도착한 옛날 응답을 무시하기 위해 기억해 둡니다

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("error", isError);
  message.classList.remove("hidden");
}

// 서버 함수에 도시 목록 요청하기
async function fetchCities(query) {
  const response = await fetch(`/api/cities?q=${encodeURIComponent(query)}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "도시 목록을 불러오지 못했어요.");
  renderSourceBadge(badge, data.source);
  return data.cities;
}

// 이름에서 검색어 부분만 굵게 표시하기. 예: "s" → <mark>S</mark>eoul
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
    empty.textContent = `"${query}"이(가) 들어간 도시가 없어요.`;
    suggestionList.appendChild(empty);
  }

  suggestions.forEach((city, index) => {
    const item = document.createElement("li");
    item.className = "suggestion";
    item.id = `suggestion-${index}`;
    item.setAttribute("role", "option");
    item.classList.toggle("active", index === activeIndex);

    const name = document.createElement("span");
    name.className = "suggestion-name";
    name.appendChild(highlight(city.name, query));
    if (city.nameEn && city.nameEn !== city.name) {
      const english = document.createElement("span");
      english.className = "suggestion-en";
      english.appendChild(highlight(city.nameEn, query));
      name.append(" ", english);
    }

    const where = document.createElement("span");
    where.className = "suggestion-where";
    where.textContent = [city.region, city.country].filter(Boolean).join(", ");

    item.append(name, where);
    // mousedown을 쓰는 이유: click보다 먼저 일어나서, 입력칸이 포커스를 잃기 전에 처리할 수 있어요.
    item.addEventListener("mousedown", (event) => {
      event.preventDefault();
      openCity(city);
    });
    suggestionList.appendChild(item);
  });

  suggestionList.classList.remove("hidden");
  input.setAttribute("aria-expanded", "true");
}

async function updateSuggestions() {
  const query = input.value.trim();
  latestQuery = query;
  if (!query) {
    closeSuggestions();
    return;
  }
  try {
    const cities = await fetchCities(query);
    if (query !== latestQuery) return; // 그사이 검색어가 바뀌었으면 무시
    suggestions = cities;
    activeIndex = -1;
    message.classList.add("hidden");
    renderSuggestions(query);
  } catch (error) {
    closeSuggestions();
    showMessage(`${error.message} npm run dev로 실행 중인지 확인해 주세요.`, true);
  }
}

// 도시 날씨 화면으로 이동
function openCity(city) {
  saveRecent(city);
  window.location.href = cityPageUrl(city);
}

// 글자를 칠 때마다 바로 요청하지 않고, 잠깐(0.2초) 멈췄을 때 요청합니다.
input.addEventListener("input", () => {
  clearTimeout(typingTimer);
  typingTimer = setTimeout(updateSuggestions, 200);
});

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
input.addEventListener("focus", () => {
  if (input.value.trim()) updateSuggestions();
});

// 검색 버튼(또는 Enter): 고른 도시가 있으면 그 도시, 없으면 목록의 첫 번째 도시로 이동
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = input.value.trim();
  if (!query) {
    showMessage("도시 이름을 입력해 주세요.", true);
    return;
  }
  clearTimeout(typingTimer);
  if (query !== latestQuery || suggestions.length === 0) await updateSuggestions();
  const city = suggestions[activeIndex] || suggestions[0];
  if (city) {
    openCity(city);
  } else {
    closeSuggestions();
    showMessage(`"${query}"이(가) 들어간 도시를 찾지 못했어요. 다른 이름으로 검색해 보세요.`, true);
  }
});

// 도시 버튼 묶음 그리기 (최근에 본 도시, 추천 도시)
function renderChips(box, cities) {
  box.innerHTML = "";
  cities.forEach((city) => {
    const chip = document.createElement("a");
    chip.className = "chip";
    chip.href = cityPageUrl(city);
    chip.textContent = city.name;
    chip.addEventListener("click", () => saveRecent(city));
    box.appendChild(chip);
  });
}

function renderRecent() {
  const recent = loadRecent();
  recentSection.classList.toggle("hidden", recent.length === 0);
  renderChips(recentBox, recent);
}

async function renderPopular() {
  try {
    renderChips(popularBox, await fetchCities(""));
  } catch (error) {
    showMessage(`${error.message} npm run dev로 실행 중인지 확인해 주세요.`, true);
  }
}

renderRecent();
renderPopular();
