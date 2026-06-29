// Naver Maps Script Loader & Geocoding Helpers
const CLIENT_ID = import.meta.env.VITE_NAVER_CLIENT_ID || '';

export const loadNaverMapScript = () => {
  return new Promise((resolve, reject) => {
    if (window.naver && window.naver.maps) {
      resolve(window.naver.maps);
      return;
    }
    
    if (!CLIENT_ID || CLIENT_ID === 'YOUR_NAVER_CLIENT_ID') {
      reject(new Error('Naver Maps Client ID가 설정되지 않았습니다. .env 파일에 VITE_NAVER_CLIENT_ID를 등록해주세요.'));
      return;
    }

    const scriptId = 'naver-map-script';
    let script = document.getElementById(scriptId);
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://openapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${CLIENT_ID}&submodules=geocoder`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    
    script.onload = () => {
      // Wait a tiny bit to ensure maps object is ready
      const checkInterval = setInterval(() => {
        if (window.naver && window.naver.maps && window.naver.maps.Service) {
          clearInterval(checkInterval);
          resolve(window.naver.maps);
        }
      }, 50);
      
      setTimeout(() => {
        clearInterval(checkInterval);
        if (window.naver && window.naver.maps) {
          resolve(window.naver.maps);
        } else {
          reject(new Error('Naver Maps 서비스 객체 로드 시간 초과'));
        }
      }, 2000);
    };
    
    script.onerror = () => reject(new Error('Naver Maps 스크립트 로드 실패'));
  });
};

// Geocoding: 주소 -> 위경도 변환
export const geocodeAddress = (address) => {
  return new Promise((resolve, reject) => {
    if (!window.naver || !window.naver.maps || !window.naver.maps.Service) {
      reject(new Error('Naver Maps API가 준비되지 않았습니다.'));
      return;
    }

    window.naver.maps.Service.geocode(
      { query: address },
      (status, response) => {
        if (status !== window.naver.maps.Service.Status.OK) {
          reject(new Error('주소 검색 실패: ' + status));
          return;
        }

        const result = response.v2;
        if (result.addresses.length === 0) {
          reject(new Error('검색된 주소 결과가 없습니다.'));
          return;
        }

        const addr = result.addresses[0];
        
        // 시, 군/구 파싱
        // 예: "경기도 성남시 분당구 불정로 6" -> 시: "경기도", 군/구: "성남시 분당구"
        // 예: "서울특별시 서초구 서초대로" -> 시: "서울특별시", 군/구: "서초구"
        let city = '';
        let district = '';
        const addressElements = addr.addressElements;
        
        const sido = addressElements.find(e => e.types.includes('SIDO'));
        const sigugun = addressElements.find(e => e.types.includes('SIGUGUN'));
        
        if (sido) city = sido.longName;
        if (sigugun) district = sigugun.longName;

        resolve({
          address: addr.roadAddress || addr.jibunAddress,
          latitude: parseFloat(addr.y),
          longitude: parseFloat(addr.x),
          city,
          district
        });
      }
    );
  });
};
