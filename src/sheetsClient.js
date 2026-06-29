// Google Sheets API Web App Client
// VITE_GOOGLE_SHEETS_API_URL이 설정되어 있으면 구글 시트와 통신하고,
// 없으면 로컬 스토리지(localStorage)를 DB처럼 사용하여 즉시 작동하도록 구현합니다.

const GAS_URL = import.meta.env.VITE_GOOGLE_SHEETS_API_URL || '';

const isGasConfigured = () => {
  return GAS_URL && GAS_URL !== 'YOUR_GOOGLE_SHEETS_API_URL' && GAS_URL.startsWith('http');
};

// 천안 요양원 실제 데이터 데이터베이스 탑재
const INITIAL_MOCKS = {
  clients: [
    {
      id: "c1",
      company: "색종이 재활 요양원",
      address: "충청남도 천안시 서북구 직산읍 성진로 21",
      name: "선승현",
      title: "담당자",
      phone: "010-9846-6249",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.8687",
      longitude: "127.1512",
      created_at: new Date().toISOString()
    },
    {
      id: "c2",
      company: "엘림 요양원",
      address: "충청남도 천안시 서북구 직산읍 삼은안길 10",
      name: "류정연",
      title: "담당자",
      phone: "010-7357-2209",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.8654",
      longitude: "127.1554",
      created_at: new Date().toISOString()
    },
    {
      id: "c3",
      company: "행복드림 요양원",
      address: "충청남도 천안시 서북구 직산읍 삼은4길 15",
      name: "이은미",
      title: "담당자",
      phone: "010-2774-9564",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.8642",
      longitude: "127.1521",
      created_at: new Date().toISOString()
    },
    {
      id: "c4",
      company: "직산제일좋은 요양원",
      address: "충청남도 천안시 서북구 직산읍 봉주로 410-4",
      name: "한윤희",
      title: "담당자",
      phone: "010-6759-7080",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.8712",
      longitude: "127.1485",
      created_at: new Date().toISOString()
    },
    {
      id: "c5",
      company: "천안힐링 요양원",
      address: "충청남도 천안시 서북구 직산읍 봉주로 282",
      name: "권혁준",
      title: "담당자",
      phone: "010-4017-4187",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.8691",
      longitude: "127.1492",
      created_at: new Date().toISOString()
    },
    {
      id: "c6",
      company: "효마을 365요양원",
      address: "충청남도 천안시 서북구 직산읍 봉주로 137-29",
      name: "이천희",
      title: "담당자",
      phone: "010-8991-7630",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.8624",
      longitude: "127.1501",
      created_at: new Date().toISOString()
    },
    {
      id: "c7",
      company: "천안원광은혜마을",
      address: "충청남도 천안시 서북구 직산읍 남산3길 102-87",
      name: "김영숙",
      title: "담당자",
      phone: "010-5553-9219",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.8581",
      longitude: "127.1384",
      created_at: new Date().toISOString()
    },
    {
      id: "c8",
      company: "해바라기 요양원",
      address: "충청남도 천안시 서북구 입장면 입장시장1길 19",
      name: "한근정",
      title: "담당자",
      phone: "010-8566-1605",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.9032",
      longitude: "127.2214",
      created_at: new Date().toISOString()
    },
    {
      id: "c9",
      company: "더엘림 요양원",
      address: "충청남도 천안시 서북구 입장면 망향로 1153-32",
      name: "김숙희",
      title: "담당자",
      phone: "010-3202-6136",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.8951",
      longitude: "127.2152",
      created_at: new Date().toISOString()
    },
    {
      id: "c10",
      company: "효누리 요양원",
      address: "충청남도 천안시 서북구 오성로 107 (두정동)",
      name: "서대곤",
      title: "담당자",
      phone: "010-8800-7245",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.8321",
      longitude: "127.1424",
      created_at: new Date().toISOString()
    },
    {
      id: "c11",
      company: "쌍용노인전문 요양원",
      address: "충청남도 천안시 서북구 쌍용예가길 31 (쌍용동)",
      name: "김도현",
      title: "담당자",
      phone: "010-7541-1234",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.7952",
      longitude: "127.1121",
      created_at: new Date().toISOString()
    },
    {
      id: "c12",
      company: "천안한마음 요양원",
      address: "충청남도 천안시 서북구 성환읍 신방로 356",
      name: "구옥자",
      title: "담당자",
      phone: "010-3272-8719",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.9152",
      longitude: "127.1354",
      created_at: new Date().toISOString()
    },
    {
      id: "c13",
      company: "김태희치매전문 요양원",
      address: "충청남도 천안시 서북구 성환읍 성환공단길 5",
      name: "김태희",
      title: "원장",
      phone: "010-2701-8307",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.9201",
      longitude: "127.1284",
      created_at: new Date().toISOString()
    },
    {
      id: "c14",
      company: "비타민 요양원1,2호",
      address: "충청남도 천안시 서북구 성환읍 성환9길 9",
      name: "조성옥",
      title: "담당자",
      phone: "010-4816-1639",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.9124",
      longitude: "127.1301",
      created_at: new Date().toISOString()
    },
    {
      id: "c15",
      company: "가람요양원",
      address: "충청남도 천안시 서북구 성환읍 성환11길 21",
      name: "정이랑",
      title: "담당자",
      phone: "010-8809-0735",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.9112",
      longitude: "127.1324",
      created_at: new Date().toISOString()
    },
    {
      id: "c16",
      company: "북천안 요양원",
      address: "충청남도 천안시 서북구 성환읍 성월수향길 30",
      name: "조정순",
      title: "담당자",
      phone: "010-4305-0591",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.9184",
      longitude: "127.1381",
      created_at: new Date().toISOString()
    },
    {
      id: "c17",
      company: "우리사랑 요양원",
      address: "충청남도 천안시 서북구 성정공원5로 31 (성정동)",
      name: "장윤진",
      title: "담당자",
      phone: "010-8452-3729",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.8224",
      longitude: "127.1412",
      created_at: new Date().toISOString()
    },
    {
      id: "c18",
      company: "좋은아침 요양원",
      address: "충청남도 천안시 서북구 성성10길 32 (성성동)",
      name: "임춘완",
      title: "담당자",
      phone: "010-3661-1868",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.8451",
      longitude: "127.1432",
      created_at: new Date().toISOString()
    },
    {
      id: "c19",
      company: "드림 요양원",
      address: "충청남도 천안시 서북구 성거읍 송남길 34-11",
      name: "이명자",
      title: "담당자",
      phone: "010-6781-1802",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.8724",
      longitude: "127.2021",
      created_at: new Date().toISOString()
    },
    {
      id: "c20",
      company: "부모사랑 요양원",
      address: "충청남도 천안시 서북구 성거읍 성거길 157-32",
      name: "박종성",
      title: "담당자",
      phone: "010-5435-0432",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.8751",
      longitude: "127.2084",
      created_at: new Date().toISOString()
    },
    {
      id: "c21",
      company: "굿모닝천안 요양원",
      address: "충청남도 천안시 서북구 성거읍 석문길 46",
      name: "전용옥",
      title: "담당자",
      phone: "010-2585-4400",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.8682",
      longitude: "127.1981",
      created_at: new Date().toISOString()
    },
    {
      id: "c22",
      company: "은혜노인복지센터",
      address: "충청남도 천안시 서북구 성거읍 봉주로 93",
      name: "임덕순",
      title: "담당자",
      phone: "010-7221-0258",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.8702",
      longitude: "127.1954",
      created_at: new Date().toISOString()
    },
    {
      id: "c23",
      company: "행복나눔 노인요양원",
      address: "충청남도 천안시 서북구 성거읍 봉주로 234-11",
      name: "최세환",
      title: "담당자",
      phone: "010-7237-2460",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.8784",
      longitude: "127.2051",
      created_at: new Date().toISOString()
    },
    {
      id: "c24",
      company: "아름다운 요양원 (문여진)",
      address: "충청남도 천안시 서북구 성거읍 망향로 903-5",
      name: "문여진",
      title: "담당자",
      phone: "010-5448-4483",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.8812",
      longitude: "127.2124",
      created_at: new Date().toISOString()
    },
    {
      id: "c25",
      company: "아름다운 요양원 (문태기)",
      address: "충청남도 천안시 서북구 성거읍 망향로 903-5",
      name: "문태기",
      title: "대표",
      phone: "010-5218-3250",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.8815",
      longitude: "127.2128",
      created_at: new Date().toISOString()
    },
    {
      id: "c26",
      company: "동산 요양원",
      address: "충청남도 천안시 서북구 성거읍 망향로 740",
      name: "김진자",
      title: "담당자",
      phone: "010-3894-1915",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.8651",
      longitude: "127.1924",
      created_at: new Date().toISOString()
    },
    {
      id: "c27",
      company: "더편한 요양원 (윤점순원장)",
      address: "충청남도 천안시 서북구 성거읍 망향로 380",
      name: "윤점순",
      title: "원장",
      phone: "010-9937-4683",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.8612",
      longitude: "127.1884",
      created_at: new Date().toISOString()
    },
    {
      id: "c28",
      company: "더편한 요양원 (백동철대표)",
      address: "충청남도 천안시 서북구 성거읍 망향로 380",
      name: "백동철",
      title: "대표",
      phone: "010-5423-4683",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.8615",
      longitude: "127.1887",
      created_at: new Date().toISOString()
    },
    {
      id: "c29",
      company: "너싱홈천안간호천사",
      address: "충청남도 천안시 서북구 불당21로 40 (불당동)",
      name: "장중현",
      title: "담당자",
      phone: "010-2301-1394",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.8124",
      longitude: "127.1051",
      created_at: new Date().toISOString()
    },
    {
      id: "c30",
      company: "백석 요양원",
      address: "충청남도 천안시 서북구 백석3로 130 (백석동)",
      name: "김화심",
      title: "담당자",
      phone: "010-8814-2385",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.8251",
      longitude: "127.1224",
      created_at: new Date().toISOString()
    },
    {
      id: "c31",
      company: "가강 요양원",
      address: "충청남도 천안시 서북구 두정중11길 14 (두정동)",
      name: "송향자",
      title: "담당자",
      phone: "010-2956-9136",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.8352",
      longitude: "127.1351",
      created_at: new Date().toISOString()
    },
    {
      id: "c32",
      company: "큰사랑요양원",
      address: "충청남도 천안시 서북구 두정역서4길 23 (두정동)",
      name: "미지정",
      title: "담당자",
      phone: "",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.8384",
      longitude: "127.1382",
      created_at: new Date().toISOString()
    },
    {
      id: "c33",
      company: "천안플래티늄 요양원",
      address: "충청남도 천안시 서북구 동서대로 135 (두정동)",
      name: "권용안",
      title: "담당자",
      phone: "010-2232-0114",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.8302",
      longitude: "127.1304",
      created_at: new Date().toISOString()
    },
    {
      id: "c34",
      company: "늘푸른 요양원",
      address: "충청남도 천안시 서북구 늘푸른3길 7-1 (두정동)",
      name: "박제용",
      title: "담당자",
      phone: "010-9735-7939",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.8361",
      longitude: "127.1464",
      created_at: new Date().toISOString()
    },
    {
      id: "c35",
      company: "천안메디케어 요양원",
      address: "충청남도 천안시 서북구 검은들1길 20 (불당동)",
      name: "박혜선",
      title: "담당자",
      phone: "010-4785-1614",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.8091",
      longitude: "127.1084",
      created_at: new Date().toISOString()
    },
    {
      id: "c36",
      company: "행복나무요양원",
      address: "충청남도 천안시 서북구 1공단2길 23 (성정동)",
      name: "미지정",
      title: "담당자",
      phone: "",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.8192",
      longitude: "127.1394",
      created_at: new Date().toISOString()
    },
    {
      id: "c37",
      company: "성모효드림 요양원",
      address: "충청남도 천안시 동남구 풍세면 풍세로 349",
      name: "고은희",
      title: "담당자",
      phone: "010-4502-8157",
      city: "충청남도",
      district: "천안시 동남구",
      latitude: "36.7321",
      longitude: "127.1214",
      created_at: new Date().toISOString()
    },
    {
      id: "c38",
      company: "영성실버센터 (김태인사모)",
      address: "충청남도 천안시 동남구 큰시장길 37 (영성동)",
      name: "김태인",
      title: "사모",
      phone: "010-5633-5091",
      city: "충청남도",
      district: "천안시 동남구",
      latitude: "36.8012",
      longitude: "127.1524",
      created_at: new Date().toISOString()
    },
    {
      id: "c39",
      company: "영성실버센터 (주덕식대표)",
      address: "충청남도 천안시 동남구 큰시장길 37 (영성동)",
      name: "주덕식",
      title: "대표",
      phone: "010-4952-8004",
      city: "충청남도",
      district: "천안시 동남구",
      latitude: "36.8015",
      longitude: "127.1528",
      created_at: new Date().toISOString()
    },
    {
      id: "c40",
      company: "플래티늄 동남점",
      address: "충청남도 천안시 동남구 충절로 151 (원성동)",
      name: "이준",
      title: "담당자",
      phone: "010-3477-1675",
      city: "충청남도",
      district: "천안시 동남구",
      latitude: "36.8041",
      longitude: "127.1624",
      created_at: new Date().toISOString()
    },
    {
      id: "c41",
      company: "이화엔젤스 요양원",
      address: "충청남도 천안시 동남구 유량로 108 (유량동)",
      name: "이미경",
      title: "담당자",
      phone: "010-9552-7318",
      city: "충청남도",
      district: "천안시 동남구",
      latitude: "36.8124",
      longitude: "127.1912",
      created_at: new Date().toISOString()
    },
    {
      id: "c42",
      company: "플래티늄 소망 요양원",
      address: "충청남도 천안시 동남구 원성천1길 18 (원성동)",
      name: "주금순",
      title: "담당자",
      phone: "010-8932-3267",
      city: "충청남도",
      district: "천안시 동남구",
      latitude: "36.7984",
      longitude: "127.1654",
      created_at: new Date().toISOString()
    },
    {
      id: "c43",
      company: "새롬요양원",
      address: "충청남도 천안시 동남구 원성동 중앙로 112",
      name: "미지정",
      title: "담당자",
      phone: "",
      city: "충청남도",
      district: "천안시 동남구",
      latitude: "36.8021",
      longitude: "127.1604",
      created_at: new Date().toISOString()
    },
    {
      id: "c44",
      company: "성환사랑마을",
      address: "충청남도 천안시 동남구 성남면 대정리길 155-24",
      name: "원유미",
      title: "담당자",
      phone: "010-2762-8747",
      city: "충청남도",
      district: "천안시 동남구",
      latitude: "36.7421",
      longitude: "127.2314",
      created_at: new Date().toISOString()
    },
    {
      id: "c45",
      company: "천안삼거리 요양원 (전용수대표)",
      address: "충청남도 천안시 동남구 삼룡동 충절로 445",
      name: "전용수",
      title: "대표",
      phone: "010-5454-0987",
      city: "충청남도",
      district: "천안시 동남구",
      latitude: "36.7824",
      longitude: "127.1724",
      created_at: new Date().toISOString()
    },
    {
      id: "c46",
      company: "천안삼거리 요양원 (이동원원장)",
      address: "충청남도 천안시 동남구 삼룡동 충절로 445",
      name: "이동원",
      title: "원장",
      phone: "010-3841-0997",
      city: "충청남도",
      district: "천안시 동남구",
      latitude: "36.7828",
      longitude: "127.1728",
      created_at: new Date().toISOString()
    },
    {
      id: "c47",
      company: "목천 요양원",
      address: "충청남도 천안시 동남구 목천읍 충절로 1156",
      name: "김미래",
      title: "담당자",
      phone: "010-2710-3137",
      city: "충청남도",
      district: "천안시 동남구",
      latitude: "36.7812",
      longitude: "127.2214",
      created_at: new Date().toISOString()
    },
    {
      id: "c48",
      company: "주소망 요양원",
      address: "충청남도 천안시 동남구 목천읍 성남로 36-32",
      name: "최만재",
      title: "담당자",
      phone: "010-2705-1180",
      city: "충청남도",
      district: "천안시 동남구",
      latitude: "36.7751",
      longitude: "127.2184",
      created_at: new Date().toISOString()
    },
    {
      id: "c49",
      company: "우리노인 요양원",
      address: "충청남도 천안시 동남구 목천읍 서리골길 93",
      name: "남주희",
      title: "담당자",
      phone: "010-2509-0040",
      city: "충청남도",
      district: "천안시 동남구",
      latitude: "36.7842",
      longitude: "127.2254",
      created_at: new Date().toISOString()
    },
    {
      id: "c50",
      company: "양지 요양원",
      address: "충청남도 천안시 동남구 목천읍 서리골길 56",
      name: "박은주",
      title: "담당자",
      phone: "010-2447-0157",
      city: "충청남도",
      district: "천안시 동남구",
      latitude: "36.7821",
      longitude: "127.2241",
      created_at: new Date().toISOString()
    },
    {
      id: "c51",
      company: "늘봄 요양원",
      address: "충청남도 천안시 동남구 목천읍 삼방로 502-14",
      name: "임창근",
      title: "담당자",
      phone: "010-7404-1300",
      city: "충청남도",
      district: "천안시 동남구",
      latitude: "36.7692",
      longitude: "127.2124",
      created_at: new Date().toISOString()
    },
    {
      id: "c52",
      company: "고래 요양원",
      address: "충청남도 천안시 동남구 목천읍 동리2길 40-10",
      name: "윤서영",
      title: "담당자",
      phone: "010-4924-7688",
      city: "충청남도",
      district: "천안시 동남구",
      latitude: "36.7884",
      longitude: "127.2312",
      created_at: new Date().toISOString()
    },
    {
      id: "c53",
      company: "천안황금빛 요양원",
      address: "충청남도 천안시 동남구 목천읍 교천지산길 167-33",
      name: "박현준",
      title: "담당자",
      phone: "010-2527-3114",
      city: "충청남도",
      district: "천안시 동남구",
      latitude: "36.7901",
      longitude: "127.2284",
      created_at: new Date().toISOString()
    },
    {
      id: "c54",
      company: "청담하늘채 요양원",
      address: "충청남도 천안시 동남구 동면 충절로 2354-20",
      name: "김진수",
      title: "담당자",
      phone: "010-7292-0173",
      city: "충청남도",
      district: "천안시 동남구",
      latitude: "36.7721",
      longitude: "127.3524",
      created_at: new Date().toISOString()
    },
    {
      id: "c55",
      company: "명품노인전문 요양원",
      address: "충청남도 천안시 동남구 구성동 고재15길 12",
      name: "김재석",
      title: "대표",
      phone: "010-9245-7701",
      city: "충청남도",
      district: "천안시 동남구",
      latitude: "36.7924",
      longitude: "127.1612",
      created_at: new Date().toISOString()
    },
    {
      id: "c56",
      company: "사랑하는노인전문 요양원",
      address: "충청남도 천안시 동남구 개목2길 1 (봉명동)",
      name: "강미숙",
      title: "담당자",
      phone: "010-3549-6406",
      city: "충청남도",
      district: "천안시 동남구",
      latitude: "36.8024",
      longitude: "127.1312",
      created_at: new Date().toISOString()
    },
    {
      id: "c57",
      company: "감나무 요양원",
      address: "충청남도 천안시 동남구 각원사길 187-22 (안서동)",
      name: "황보경",
      title: "담당자",
      phone: "010-7205-1006",
      city: "충청남도",
      district: "천안시 동남구",
      latitude: "36.8324",
      longitude: "127.1812",
      created_at: new Date().toISOString()
    },
    {
      id: "c58",
      company: "입장실버 요양원",
      address: "충청남도 천안시 서북구 입장면",
      name: "미지정",
      title: "담당자",
      phone: "",
      city: "충청남도",
      district: "천안시 서북구",
      latitude: "36.9012",
      longitude: "127.2184",
      created_at: new Date().toISOString()
    }
  ],
  interactions: [],
  meetings: [],
  chat_messages: []
};

// 로컬스토리지 헬퍼 (v3로 키를 갱신하여 기존 캐시 자동 삭제)
const getLocalStorageData = (sheet) => {
  const data = localStorage.getItem(`sheet_v3_${sheet}`);
  if (!data) {
    localStorage.setItem(`sheet_v3_${sheet}`, JSON.stringify(INITIAL_MOCKS[sheet] || []));
    return INITIAL_MOCKS[sheet] || [];
  }
  return JSON.parse(data);
};

const setLocalStorageData = (sheet, data) => {
  localStorage.setItem(`sheet_v3_${sheet}`, JSON.stringify(data));
};

export const sheetsClient = {
  // 데이터 조회
  read: async (sheetName) => {
    if (isGasConfigured()) {
      try {
        const response = await fetch(`${GAS_URL}?sheet=${sheetName}`, {
          method: 'GET',
          mode: 'cors',
        });
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
      } catch (err) {
        console.warn(`구글 시트(${sheetName}) 데이터 조회 실패, 로컬 저장소 전환:`, err);
        return getLocalStorageData(sheetName);
      }
    } else {
      return getLocalStorageData(sheetName);
    }
  },

  // 데이터 추가
  insert: async (sheetName, data) => {
    const newData = {
      ...data,
      id: data.id || Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString()
    };

    if (isGasConfigured()) {
      try {
        const response = await fetch(GAS_URL, {
          method: 'POST',
          mode: 'cors',
          headers: {
            'Content-Type': 'text/plain',
          },
          body: JSON.stringify({
            sheet: sheetName,
            action: 'insert',
            data: newData
          })
        });
        const result = await response.json();
        if (result.success) {
          // 로컬 데이터도 캐시용으로 동기화
          const localData = getLocalStorageData(sheetName);
          setLocalStorageData(sheetName, [newData, ...localData]);
          return newData;
        }
        throw new Error(result.error || 'Insert failed');
      } catch (err) {
        console.warn(`구글 시트(${sheetName}) 추가 실패, 로컬 저장소에 저장:`, err);
        const localData = getLocalStorageData(sheetName);
        setLocalStorageData(sheetName, [newData, ...localData]);
        return newData;
      }
    } else {
      const localData = getLocalStorageData(sheetName);
      setLocalStorageData(sheetName, [newData, ...localData]);
      return newData;
    }
  },

  // 데이터 업데이트
  update: async (sheetName, data) => {
    if (isGasConfigured()) {
      try {
        const response = await fetch(GAS_URL, {
          method: 'POST',
          mode: 'cors',
          headers: {
            'Content-Type': 'text/plain',
          },
          body: JSON.stringify({
            sheet: sheetName,
            action: 'update',
            data: data
          })
        });
        const result = await response.json();
        if (result.success) {
          const localData = getLocalStorageData(sheetName);
          const updated = localData.map(item => item.id === data.id ? { ...item, ...data } : item);
          setLocalStorageData(sheetName, updated);
          return true;
        }
        throw new Error(result.error || 'Update failed');
      } catch (err) {
        console.warn(`구글 시트(${sheetName}) 업데이트 실패, 로컬 저장소에 반영:`, err);
        const localData = getLocalStorageData(sheetName);
        const updated = localData.map(item => item.id === data.id ? { ...item, ...data } : item);
        setLocalStorageData(sheetName, updated);
        return true;
      }
    } else {
      const localData = getLocalStorageData(sheetName);
      const updated = localData.map(item => item.id === data.id ? { ...item, ...data } : item);
      setLocalStorageData(sheetName, updated);
      return true;
    }
  }
};
