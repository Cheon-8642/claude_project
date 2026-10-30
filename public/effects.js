// 날씨별 화면 연출
//   더위(28°C 이상) → 화면이 주황색 계열, 3초 뒤 글자가 불타요.
//   비             → 화면이 회청색, 3초 뒤 글자가 젖고 물방울이 떨어져요.
//   눈             → 화면이 얼음색, 3초 뒤 글자 위에 눈이 쌓이고 눈송이가 내려요.
//   안개           → 화면이 회색, 3초 뒤 옅은 안개가 화면을 천천히 흘러가요.
// 날씨가 겹치면 눈 > 비 > 안개 > 더위 순서로 하나만 고릅니다.
//
// 연출만 미리 보고 싶으면 주소 끝에 &preview=hot (또는 rain, snow, fog)를 붙이세요.

const HOT_TEMPERATURE = 28; // 이 온도 이상이면 "더위"
const EFFECT_DELAY_MS = 3000; // 화면을 보고 있는 시간이 이만큼 지나면 연출 시작

const SNOW_CODES = [71, 73, 75, 77, 85, 86];
const RAIN_CODES = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99];
const FOG_CODES = [45, 48];
const THEME_NAMES = { hot: "더위", rain: "비", snow: "눈", fog: "안개" };

function pickTheme(current) {
  if (SNOW_CODES.includes(current.code)) return "snow";
  if (RAIN_CODES.includes(current.code)) return "rain";
  if (FOG_CODES.includes(current.code)) return "fog";
  if (current.temperature >= HOT_TEMPERATURE) return "hot";
  return null;
}

// 글자를 한 글자씩 <span>으로 나눠서, 글자마다 따로 움직일 수 있게 합니다.
function splitLetters(element) {
  const text = element.textContent;
  element.textContent = "";
  element.setAttribute("aria-label", text); // 화면 낭독기는 원래 글자를 그대로 읽도록
  for (const char of text) {
    const letter = document.createElement("span");
    letter.className = "fx-letter";
    letter.setAttribute("aria-hidden", "true");
    letter.textContent = char;
    if (char === " ") letter.classList.add("fx-space");
    // 글자마다 시작 시간과 흔들림을 조금씩 다르게 해서 자연스럽게 보이게 합니다.
    letter.style.setProperty("--d", `${(Math.random() * 1.5).toFixed(2)}s`);
    letter.style.setProperty("--drift", `${(Math.random() * 0.6 - 0.3).toFixed(2)}em`);
    // 절반 정도의 글자에만 불씨·물방울이 생기게 합니다.
    if (char !== " " && Math.random() < 0.5) letter.classList.add("fx-pick");
    element.appendChild(letter);
  }
}

// 화면 전체에 빗줄기, 눈송이, 안개를 깔아 둡니다. (3초 뒤에 보이기 시작해요)
function fillLayer(theme) {
  const layer = document.getElementById("fx-layer");
  const random = (min, max) => (min + Math.random() * (max - min)).toFixed(2);

  if (theme === "rain") {
    for (let i = 0; i < 70; i++) {
      const drop = document.createElement("span");
      drop.className = "raindrop";
      drop.style.left = `${random(0, 100)}%`;
      drop.style.animationDuration = `${random(0.5, 0.9)}s`;
      drop.style.animationDelay = `${random(0, 1)}s`;
      layer.appendChild(drop);
    }
  } else if (theme === "snow") {
    for (let i = 0; i < 50; i++) {
      const flake = document.createElement("span");
      flake.className = "flake";
      flake.style.left = `${random(0, 100)}%`;
      flake.style.setProperty("--size", `${random(3, 8)}px`);
      flake.style.setProperty("--drift", `${random(-40, 40)}px`);
      flake.style.setProperty("--y", random(5, 100)); // 움직임 줄이기 설정일 때 멈춰 있을 높이
      flake.style.animationDuration = `${random(6, 12)}s`;
      flake.style.animationDelay = `${random(-12, 0)}s`; // 처음부터 화면 곳곳에 흩어져 있게
      layer.appendChild(flake);
    }
  } else if (theme === "fog") {
    for (let i = 0; i < 4; i++) {
      const band = document.createElement("span");
      band.className = "fog-band";
      band.style.top = `${i * 25 - 15}%`;
      band.style.animationDuration = `${random(14, 24)}s`;
      band.style.animationDelay = `${random(-20, 0)}s`;
      layer.appendChild(band);
    }
  }
}

function startWeatherEffect(current, preview) {
  const isPreview = Object.hasOwn(THEME_NAMES, preview);
  const theme = isPreview ? preview : pickTheme(current);

  if (isPreview) {
    const badge = document.getElementById("preview-badge");
    badge.textContent = `연출 미리보기: ${THEME_NAMES[theme]} (실제 날씨와 다를 수 있어요)`;
    badge.classList.remove("hidden");
  }
  if (!theme) return;

  // 1) 화면 색은 바로 바꿉니다.
  document.body.dataset.theme = theme;
  document.querySelectorAll("[data-fx-text]").forEach(splitLetters);
  fillLayer(theme);

  // 2) 사용자가 이 화면을 "보고 있는" 시간이 3초가 되면 글자 연출을 켭니다.
  //    다른 탭으로 가 있는 동안은 시간을 세지 않아요.
  const TICK_MS = 200;
  let watchedMs = 0;
  const timer = setInterval(() => {
    if (document.visibilityState === "visible") watchedMs += TICK_MS;
    if (watchedMs >= EFFECT_DELAY_MS) {
      clearInterval(timer);
      document.body.classList.add("fx-on");
    }
  }, TICK_MS);
}
