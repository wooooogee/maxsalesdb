import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY';
const genAI = new GoogleGenerativeAI(apiKey);

export const summarizeMeeting = async (text) => {
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
    throw new Error('Gemini API 키가 설정되지 않았습니다. .env 파일에 VITE_GEMINI_API_KEY를 등록해주세요.');
  }
  
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  
  const prompt = `
  다음 미팅/상담 내용을 분석하여 보기 좋은 회의록 형태로 요약해 주세요.
  반드시 마크다운 형식을 사용하고, 다음 구조를 따라주세요:
  
  1. 핵심 요약 (1-2줄)
  2. 주요 논의 사항 (글머리 기호 사용)
  3. 다음 할 일 (Action Items)
  4. 추출된 일정 (만약 '다음 주 목요일 2시'와 같은 명시적인 다음 미팅 일정이 있다면 [YYYY-MM-DD HH:mm] 형식의 ISO 날짜 문자열과 함께 '일정:' 이라는 키워드로 명시해주세요. 없으면 '일정: 없음'으로 표시하세요.)
  
  미팅 내용:
  ${text}
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
};

export const analyzeMeetingWithAI = async (text) => {
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
    throw new Error('Gemini API 키가 설정되지 않았습니다.');
  }

  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: "application/json"
    }
  });

  const prompt = `
  다음 미팅 또는 통화 녹취록(텍스트)을 분석하여 영업 활동 기록에 필요한 데이터를 추출해주세요.
  반드시 아래 JSON 형식 스키마를 준수하여 응답해야 합니다.
  
  JSON 응답 형식:
  {
    "summary": "전체 대화/녹취록 내용에 대한 한 줄 요약",
    "has_next_meeting": true 또는 false (다음 미팅 일정이 잡혔는지 여부),
    "next_meeting_date": "다음 미팅이 있다면 YYYY-MM-DD HH:mm 형식으로 입력. 없거나 유추 불가능하면 빈 문자열 (기준 시간: 2026-06-29)",
    "meeting_type": "브리핑", "인사", "소개", "직접입력" 중 대화 성격에 가장 잘 어울리는 것 하나를 선택,
    "material_sent": "이메일이나 팩스로 자료(제안서, 계약서, 소개서 등)를 보냈다는 내용이 있으면 무엇을 보냈는지 요약 서술, 없으면 빈 문자열",
    "recommended_channel": "전화", "방문", "이메일", "팩스" 중 어떤 소통인지 유추 (기본값: "전화")
  }

  대화/녹취록 내용:
  ${text}
  `;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  try {
    return JSON.parse(response.text());
  } catch (err) {
    console.error("Failed to parse AI JSON response, fallback to text format.", err);
    throw new Error("AI 분석 데이터 파싱 실패");
  }
};

// 오디오 파일(Blob/File) 직접 분석 및 데이터 추출
export const analyzeAudioWithAI = async (base64Data, mimeType) => {
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
    throw new Error('Gemini API 키가 설정되지 않았습니다. .env 파일에 VITE_GEMINI_API_KEY를 등록해주세요.');
  }

  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: "application/json"
    }
  });

  const prompt = `
  첨부된 영업 통화 녹음 또는 음성 메모 오디오 파일의 내용을 듣고 텍스트 변환(STT)을 수행한 후, 영업 활동 기록에 필요한 데이터를 추출해주세요.
  반드시 아래 JSON 형식 스키마를 준수하여 응답해야 합니다.
  
  JSON 응답 형식:
  {
    "transcription": "오디오에서 직접 텍스트로 변환한 대화 전체 내용 (STT 결과물)",
    "summary": "전체 대화/오디오 내용에 대한 핵심 한 줄 요약",
    "has_next_meeting": true 또는 false (다음 미팅 일정이 잡혔는지 여부),
    "next_meeting_date": "다음 미팅이 있다면 YYYY-MM-DD HH:mm 형식으로 입력. 없거나 유추 불가능하면 빈 문자열 (기준 시간: 2026-06-29)",
    "meeting_type": "브리핑", "인사", "소개", "직접입력" 중 대화 성격에 가장 잘 어울리는 것 하나를 선택,
    "material_sent": "이메일이나 팩스로 자료(제안서, 계약서, 소개서 등)를 보냈다는 내용이 있으면 무엇을 보냈는지 요약 서술, 없으면 빈 문자열",
    "recommended_channel": "전화", "방문", "이메일", "팩스" 중 어떤 소통인지 유추 (기본값: "전화")
  }
  `;

  const result = await model.generateContent([
    {
      inlineData: {
        data: base64Data,
        mimeType: mimeType
      }
    },
    { text: prompt }
  ]);
  const response = await result.response;
  try {
    return JSON.parse(response.text());
  } catch (err) {
    console.error("Failed to parse AI JSON response from audio", err);
    throw new Error("오디오 분석 데이터 파싱 실패");
  }
};
