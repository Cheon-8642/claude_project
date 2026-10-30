// 예시 날씨 데이터 8건입니다. 진짜 날씨가 아니라 화면과 연출을 확인하기 위한 가짜 값이에요.
// 연출을 모두 볼 수 있도록 일부러 대구는 덥게, 광주·제주는 비, 인천은 눈, 대전은 안개로 넣었습니다.
//
// code는 날씨 종류 번호(WMO 코드)입니다. 0=맑음, 2=구름 조금, 3=흐림, 63=비, 73=눈, 80=소나기 ...
// daily는 오늘부터 5일간 [날씨 코드, 최고 기온, 최저 기온] 입니다.
export const SAMPLE_WEATHER = {
  seoul: {
    current: { temperature: 18, humidity: 53, wind: 9.4, code: 0 },
    daily: [[0, 21, 9], [2, 19, 10], [3, 17, 11], [61, 15, 10], [1, 18, 8]],
  },
  busan: {
    current: { temperature: 21, humidity: 61, wind: 14.2, code: 2 },
    daily: [[2, 23, 15], [1, 24, 16], [3, 22, 16], [63, 19, 15], [0, 22, 14]],
  },
  incheon: {
    current: { temperature: -1, humidity: 82, wind: 18.0, code: 73 },
    daily: [[73, 1, -4], [71, 2, -3], [3, 3, -2], [0, 5, -1], [2, 4, -2]],
  },
  daegu: {
    current: { temperature: 33, humidity: 45, wind: 6.1, code: 0 },
    daily: [[0, 35, 24], [0, 34, 23], [1, 33, 23], [2, 31, 22], [3, 30, 21]],
  },
  daejeon: {
    current: { temperature: 12, humidity: 96, wind: 2.1, code: 45 },
    daily: [[45, 16, 8], [3, 18, 9], [0, 20, 9], [1, 19, 10], [61, 14, 9]],
  },
  gwangju: {
    current: { temperature: 19, humidity: 88, wind: 7.9, code: 63 },
    daily: [[63, 20, 15], [61, 19, 14], [3, 21, 14], [2, 22, 13], [0, 23, 13]],
  },
  jeju: {
    current: { temperature: 22, humidity: 84, wind: 21.6, code: 80 },
    daily: [[80, 23, 18], [81, 22, 18], [3, 23, 17], [2, 24, 18], [1, 24, 17]],
  },
  tokyo: {
    current: { temperature: 20, humidity: 64, wind: 4.3, code: 2 },
    daily: [[2, 22, 14], [3, 21, 15], [61, 18, 14], [1, 21, 13], [0, 23, 13]],
  },
};
