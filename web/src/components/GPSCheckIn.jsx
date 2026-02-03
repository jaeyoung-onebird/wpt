import { useState, useEffect } from 'react';
import { attendanceAPI, eventsAPI } from '../api/client';

export default function GPSCheckIn({ eventId, eventTitle }) {
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [isInRange, setIsInRange] = useState(false);
  const [distance, setDistance] = useState(null);
  const [eventLocation, setEventLocation] = useState(null);

  // 행사 위치 정보 가져오기
  useEffect(() => {
    const loadEventLocation = async () => {
      try {
        const { data } = await eventsAPI.get(eventId);
        setEventLocation({
          lat: data.location_lat,
          lng: data.location_lng,
          radius: data.location_radius || 100
        });
      } catch (error) {
        console.error('Failed to load event location:', error);
      }
    };
    loadEventLocation();
  }, [eventId]);

  // GPS 위치 주기적으로 업데이트 (30초마다)
  useEffect(() => {
    updateLocation();
    const interval = setInterval(updateLocation, 30000); // 30초마다
    return () => clearInterval(interval);
  }, [eventId, eventLocation]);

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000; // 지구 반경 (미터)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // 미터 단위
  };

  const updateLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('GPS를 지원하지 않는 브라우저입니다');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ latitude, longitude });
        setLocationError(null);

        try {
          // 서버에 위치 정보 전송
          await attendanceAPI.updateLocation(eventId, latitude, longitude);

          // 거리 계산 (클라이언트에서 직접)
          if (eventLocation && eventLocation.lat && eventLocation.lng) {
            const dist = calculateDistance(
              latitude, longitude,
              eventLocation.lat, eventLocation.lng
            );
            const distMeters = Math.round(dist);
            setDistance(distMeters);
            setIsInRange(distMeters <= eventLocation.radius);
          }
        } catch (error) {
          console.error('Failed to update location:', error);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        setLocationError('위치 정보를 가져올 수 없습니다. GPS를 켜주세요.');
        setLocation(null);
        setIsInRange(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  };

  return (
    <div className="card p-3">
      {/* GPS 상태 */}
      <div
        className="p-4 rounded-lg transition-colors"
        style={{
          backgroundColor: location && isInRange ? '#065F46' : '#F3F4F6',
          opacity: location && isInRange ? 1 : 0.6
        }}
      >
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${location && isInRange ? 'bg-emerald-300' : 'bg-gray-400'}`}></span>
          <div className="flex-1">
            <span className="text-sm font-medium" style={{ color: location && isInRange ? '#D1FAE5' : '#6B7280' }}>
              {location && isInRange ? '📍 범위 내' : location ? '📍 범위 밖' : '📍 GPS 대기중'}
            </span>
            {distance !== null && (
              <span className="text-xs ml-2" style={{ color: location && isInRange ? '#A7F3D0' : '#9CA3AF' }}>
                ({distance}m)
              </span>
            )}
          </div>
        </div>
        {locationError && (
          <p className="text-xs mt-2" style={{ color: '#DC2626' }}>{locationError}</p>
        )}
      </div>

      <p className="text-xs text-center mt-3" style={{ color: 'var(--color-text-sub)' }}>
        GPS는 30초마다 자동 업데이트됩니다
      </p>
      <p className="text-xs text-center mt-1" style={{ color: 'var(--color-text-disabled)' }}>
        관리자가 출퇴근을 확인합니다
      </p>
    </div>
  );
}
