// 도시 목록에서 검색어가 "들어간" 도시를 찾습니다.
// 예: "s" → Seoul, Busan, Suwon ...  /  "서" → 서울
// 한국어 이름(name)과 영어 이름(nameEn) 둘 다에서 찾고, 대소문자는 구분하지 않아요.
export function searchCities(query, list, limit = 8) {
  const q = query.trim().toLowerCase();
  if (!q) return list.slice(0, limit);

  const scored = [];
  for (const city of list) {
    const names = [city.name, city.nameEn].filter(Boolean).map((n) => n.toLowerCase());
    if (names.some((n) => n.startsWith(q))) {
      scored.push({ city, score: 0 }); // 검색어로 "시작"하면 위쪽에
    } else if (names.some((n) => n.includes(q))) {
      scored.push({ city, score: 1 }); // 중간에 "들어가" 있으면 그다음
    }
  }
  // 정렬해도 같은 점수끼리는 원래 목록 순서가 유지됩니다.
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, limit).map((item) => item.city);
}

// 두 장소가 사실상 같은 곳인지(좌표가 아주 가까운지) 확인합니다. 검색 결과 중복을 없앨 때 써요.
export function isSamePlace(a, b) {
  return Math.abs(a.latitude - b.latitude) < 0.1 && Math.abs(a.longitude - b.longitude) < 0.1;
}
