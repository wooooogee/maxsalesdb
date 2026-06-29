// 한글 및 하이브리드 날짜 시간 파싱 유틸리티
// 예: "2026-06-29 오후 3시", "6/25 오후 3시" 등의 자연어 입력을
// DB에 저장하기 위한 표준 포맷 "YYYY-MM-DD HH:mm"으로 변환합니다.

export const parseKoreanDateTime = (inputStr) => {
  if (!inputStr) return '';
  const cleanStr = inputStr.trim();
  
  // 이미 표준 포맷(YYYY-MM-DD HH:mm)으로 정확하게 입력했다면 그대로 반환
  const stdRegex = /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/;
  if (stdRegex.test(cleanStr)) {
    return cleanStr;
  }

  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  let day = now.getDate();
  let hour = 10; // 기본 시간값 오전 10시
  let minute = 0;

  let dateParsed = false;
  let timeParsed = false;

  // 1. 전체 날짜 (YYYY-MM-DD 또는 YYYY.MM.DD 또는 YYYY/MM/DD) 패턴 분석
  const fullDateMatch = cleanStr.match(/(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (fullDateMatch) {
    year = parseInt(fullDateMatch[1], 10);
    month = parseInt(fullDateMatch[2], 10);
    day = parseInt(fullDateMatch[3], 10);
    dateParsed = true;
  }

  // 오늘, 내일, 모레 처리
  if (!dateParsed) {
    if (cleanStr.includes('오늘')) {
      dateParsed = true;
    } else if (cleanStr.includes('내일')) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      month = d.getMonth() + 1;
      day = d.getDate();
      dateParsed = true;
    } else if (cleanStr.includes('모레')) {
      const d = new Date();
      d.setDate(d.getDate() + 2);
      month = d.getMonth() + 1;
      day = d.getDate();
      dateParsed = true;
    }
  }

  // 월/일 구분: "6/25" 또는 "6.25" 또는 "6-25" (앞에 4자리 연도가 없을 때만 작동)
  if (!dateParsed) {
    const slashMatch = cleanStr.match(/(\d{1,2})[/\-.](\d{1,2})/);
    if (slashMatch) {
      month = parseInt(slashMatch[1], 10);
      day = parseInt(slashMatch[2], 10);
      dateParsed = true;
    }
  }

  // 한글 월/일 패턴: "6월 25일" 또는 "6월25일"
  if (!dateParsed) {
    const korDateMatch = cleanStr.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
    if (korDateMatch) {
      month = parseInt(korDateMatch[1], 10);
      day = parseInt(korDateMatch[2], 10);
      dateParsed = true;
    }
  }

  // 2. 시간 파싱
  // "오전/오후 X시 Y분" 또는 "오후 X시"
  const timeKorMatch = cleanStr.match(/(오전|오후)?\s*(\d{1,2})\s*시\s*(\d{1,2})?\s*분?/);
  if (timeKorMatch) {
    const meridiem = timeKorMatch[1];
    let h = parseInt(timeKorMatch[2], 10);
    const m = timeKorMatch[3] ? parseInt(timeKorMatch[3], 10) : 0;
    
    if (meridiem === '오후' && h < 12) {
      h += 12;
    } else if (meridiem === '오전' && h === 12) {
      h = 0;
    }
    
    hour = h;
    minute = m;
    timeParsed = true;
  }

  // "14:30" 또는 "09:15" 콜론 매칭
  if (!timeParsed) {
    const colonMatch = cleanStr.match(/(\d{1,2}):(\d{2})/);
    if (colonMatch) {
      hour = parseInt(colonMatch[1], 10);
      minute = parseInt(colonMatch[2], 10);
      timeParsed = true;
    }
  }

  // 시 단어 없이 "오후 3"이나 "오전 11" 같은 패턴
  if (!timeParsed) {
    const pmMatch = cleanStr.match(/오후\s*(\d{1,2})/);
    if (pmMatch) {
      let h = parseInt(pmMatch[1], 10);
      if (h < 12) h += 12;
      hour = h;
      timeParsed = true;
    }
    const amMatch = cleanStr.match(/오전\s*(\d{1,2})/);
    if (amMatch) {
      let h = parseInt(amMatch[1], 10);
      if (h === 12) h = 0;
      hour = h;
      timeParsed = true;
    }
  }

  // 날짜와 시간 둘 다 파싱에 실패했다면 빈 문자열로 처리하거나 그대로 보냄
  if (!dateParsed && !timeParsed) {
    return cleanStr;
  }

  // YYYY-MM-DD HH:mm 형식 조립
  const yStr = year.toString();
  const mStr = month.toString().padStart(2, '0');
  const dStr = day.toString().padStart(2, '0');
  const hStr = hour.toString().padStart(2, '0');
  const minStr = minute.toString().padStart(2, '0');

  return `${yStr}-${mStr}-${dStr} ${hStr}:${minStr}`;
};
