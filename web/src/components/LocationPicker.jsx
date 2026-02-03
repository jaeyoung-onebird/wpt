import { useEffect, useState } from 'react';

/**
 * Daum 우편번호 서비스 기반 주소 검색 컴포넌트
 *
 * @param {Object} props
 * @param {string} props.address - 초기 주소
 * @param {function} props.onLocationSelect - 위치 선택 시 콜백 (address, latitude, longitude)
 */
export default function LocationPicker({ address = '', onLocationSelect }) {
  const [currentAddress, setCurrentAddress] = useState(address);
  const [coordinates, setCoordinates] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Daum Postcode Service SDK 로드
  useEffect(() => {
    // 이미 로드되어 있으면 스킵
    if (window.daum && window.daum.Postcode) {
      console.log('Daum Postcode already loaded');
      return;
    }

    const script = document.createElement('script');
    script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    script.async = true;

    script.onload = () => {
      console.log('Daum Postcode Service loaded');
    };

    script.onerror = (error) => {
      console.error('Failed to load Daum Postcode Service:', error);
      alert('주소 검색 서비스를 불러오는데 실패했습니다. 페이지를 새로고침해주세요.');
    };

    document.head.appendChild(script);
  }, []);

  // Kakao Geocoder SDK 로드 (주소를 좌표로 변환하기 위해)
  useEffect(() => {
    const kakaoKey = import.meta.env.VITE_KAKAO_JS_KEY;

    if (!kakaoKey) {
      console.error('VITE_KAKAO_JS_KEY가 설정되지 않았습니다');
      return;
    }

    // 이미 로드되어 있으면 스킵
    if (window.kakao && window.kakao.maps) {
      console.log('Kakao Maps SDK already loaded');
      return;
    }

    const script = document.createElement('script');
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${kakaoKey}&libraries=services&autoload=false`;
    script.async = true;

    script.onload = () => {
      console.log('Kakao Maps SDK script loaded');
      window.kakao.maps.load(() => {
        console.log('Kakao Maps API ready');
      });
    };

    script.onerror = (error) => {
      console.error('Failed to load Kakao Maps SDK:', error);
    };

    document.head.appendChild(script);
  }, []);

  // 모달이 열리면 Daum Postcode 임베드
  useEffect(() => {
    if (!isModalOpen) return;

    if (!window.daum || !window.daum.Postcode) {
      alert('주소 검색 서비스가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.');
      setIsModalOpen(false);
      return;
    }

    const element = document.getElementById('daumPostcodeLayer');
    if (!element) {
      console.error('daumPostcodeLayer element not found');
      return;
    }

    new window.daum.Postcode({
      oncomplete: function(data) {
        // 도로명 주소 우선, 없으면 지번 주소
        const fullAddress = data.roadAddress || data.jibunAddress;

        setCurrentAddress(fullAddress);
        setIsModalOpen(false);

        // 주소를 좌표로 변환
        if (window.kakao && window.kakao.maps) {
          const geocoder = new window.kakao.maps.services.Geocoder();

          geocoder.addressSearch(fullAddress, function(result, status) {
            if (status === window.kakao.maps.services.Status.OK) {
              const lat = parseFloat(result[0].y);
              const lng = parseFloat(result[0].x);

              setCoordinates({ latitude: lat, longitude: lng });

              if (onLocationSelect) {
                onLocationSelect(fullAddress, lat, lng);
              }
            } else {
              // 좌표 변환 실패 시에도 주소는 저장
              if (onLocationSelect) {
                onLocationSelect(fullAddress, null, null);
              }
            }
          });
        } else {
          // Kakao Maps SDK가 로드되지 않은 경우에도 주소는 저장
          if (onLocationSelect) {
            onLocationSelect(fullAddress, null, null);
          }
        }
      },
      width: '100%',
      height: '100%',
    }).embed(element);
  }, [isModalOpen]);

  // 주소 검색 팝업 열기
  const openAddressSearch = () => {
    if (!window.daum || !window.daum.Postcode) {
      alert('주소 검색 서비스가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    setIsModalOpen(true);
  };

  return (
    <>
      <div className="space-y-3">
        {/* 현재 선택된 주소 표시 */}
        {currentAddress && (
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
            <p className="text-xs text-blue-600 font-medium mb-1">✓ 선택된 주소</p>
            <p className="text-sm font-semibold text-blue-900">{currentAddress}</p>
            {coordinates && (
              <p className="text-xs text-blue-600 mt-1">
                GPS: {coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}
              </p>
            )}
          </div>
        )}

        {/* 주소 검색 버튼 */}
        <button
          type="button"
          onClick={openAddressSearch}
          className="w-full py-2.5 px-4 rounded-xl text-sm font-medium"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'white'
          }}
        >
          {currentAddress ? '📍 주소 변경하기' : '📍 주소 검색'}
        </button>
      </div>

      {/* Daum Postcode 레이어 모달 */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl w-full max-w-2xl m-4 overflow-hidden flex flex-col"
            style={{ height: '600px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="p-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
              <h3 className="text-lg font-semibold">주소 검색</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Daum Postcode 임베드 영역 */}
            <div
              id="daumPostcodeLayer"
              className="flex-1 overflow-hidden"
            ></div>
          </div>
        </div>
      )}
    </>
  );
}
