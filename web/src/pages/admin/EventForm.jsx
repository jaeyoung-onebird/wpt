import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { eventsAPI, bigdataAPI, adminAPI } from '../../api/client';
import LocationPicker from '../../components/LocationPicker';

export default function EventForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 마스터 데이터
  const [regions, setRegions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [admins, setAdmins] = useState([]);

  // 지역 선택을 위한 상태
  const [sidoList, setSidoList] = useState([]);
  const [sigunguList, setSigunguList] = useState([]);
  const [selectedSido, setSelectedSido] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    location: '',           // 상세 주소 (텍스트)
    region_id: '',          // 지역 ID (마스터)
    event_date: '',
    end_date: '',           // 종료일 (기본값은 시작일과 동일)
    start_time: '09:00',
    end_time: '18:00',
    pay_amount: 130000,
    pay_description: '',
    headcount: 10,
    work_type: '',          // 기타 입력용 (텍스트)
    category_id: '',        // 업종 ID (마스터)
    dress_code: '',
    requires_driver_license: false,
    requires_security_cert: false,
    manager_name: '',
    manager_phone: '',
    location_address: '',   // GPS용 전체 주소
    location_lat: null,     // GPS 위도
    location_lng: null,     // GPS 경도
    location_radius: 100,   // GPS 범위 (미터)
  });

  useEffect(() => {
    window.scrollTo(0, 0);
    loadMasterData();
  }, []);

  useEffect(() => {
    if (isEdit && regions.length > 0 && categories.length > 0) {
      loadEvent();
    } else if (!isEdit && regions.length > 0) {
      setLoading(false);
    }
  }, [id, regions, categories]);

  // 마스터 데이터 로드
  const loadMasterData = async () => {
    try {
      const [regionsRes, categoriesRes] = await Promise.all([
        bigdataAPI.getRegions(),
        bigdataAPI.getCategories()
      ]);

      const regionsData = regionsRes.data.regions || [];
      const categoriesData = categoriesRes.data.categories || [];

      setRegions(regionsData);
      setCategories(categoriesData);

      // 시도 목록 추출 (중복 제거)
      const uniqueSido = [...new Set(regionsData.map(r => r.sido))];
      setSidoList(uniqueSido);

      // 관리자 목록 별도 로드 (실패해도 계속 진행)
      try {
        const adminsRes = await adminAPI.getAllWorkers();
        const allWorkers = adminsRes.data.workers || adminsRes.data || [];
        const adminsData = allWorkers.filter(w => w.is_admin);
        setAdmins(adminsData);
      } catch (adminError) {
        console.error('Failed to load admins:', adminError);
      }

    } catch (error) {
      console.error('Failed to load master data:', error);
      setLoading(false);
    }
  };

  // 시도 선택 시 시군구 필터링
  useEffect(() => {
    if (selectedSido) {
      const filtered = regions.filter(r => r.sido === selectedSido);
      setSigunguList(filtered);
    } else {
      setSigunguList([]);
    }
  }, [selectedSido, regions]);

  const loadEvent = async () => {
    try {
      const { data } = await eventsAPI.getDetail(id);

      // 지역 정보가 있으면 시도 설정
      if (data.region_id) {
        const region = regions.find(r => r.id === data.region_id);
        if (region) {
          setSelectedSido(region.sido);
        }
      }

      setFormData({
        title: data.title || '',
        location: data.location || '',
        region_id: data.region_id || '',
        event_date: data.event_date || '',
        end_date: data.end_date || data.event_date || '',
        start_time: data.start_time || '09:00',
        end_time: data.end_time || '18:00',
        pay_amount: data.pay_amount || 130000,
        pay_description: data.pay_description || '',
        headcount: data.headcount || 10,
        work_type: data.work_type || '',
        category_id: data.category_id || '',
        dress_code: data.dress_code || '',
        requires_driver_license: data.requires_driver_license || false,
        requires_security_cert: data.requires_security_cert || false,
        manager_name: data.manager_name || '',
        manager_phone: data.manager_phone || '',
        location_address: data.location_address || '',
        location_lat: data.location_lat || null,
        location_lng: data.location_lng || null,
        location_radius: data.location_radius || 100,
      });
    } catch (error) {
      console.error('Failed to load event:', error);
      alert('행사 정보를 불러오는데 실패했습니다');
      navigate('/admin/events');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newFormData = {
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    };

    // 시작일이 변경되고 종료일이 비어있거나 시작일보다 이전이면 종료일도 시작일로 설정
    if (name === 'event_date') {
      if (!formData.end_date || formData.end_date < value) {
        newFormData.end_date = value;
      }
    }

    setFormData(newFormData);
  };

  const handleSidoChange = (e) => {
    const sido = e.target.value;
    setSelectedSido(sido);
    setFormData({
      ...formData,
      region_id: '', // 시도 변경 시 시군구 초기화
    });
  };

  const handleLocationSelect = (address, latitude, longitude) => {
    setFormData({
      ...formData,
      location: address, // 기본 주소를 상세 장소에도 설정
      location_address: address,
      location_lat: latitude,
      location_lng: longitude,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      // 숫자 필드 변환
      const submitData = {
        ...formData,
        pay_amount: parseInt(formData.pay_amount) || 0,
        headcount: parseInt(formData.headcount) || 1,
        region_id: formData.region_id ? parseInt(formData.region_id) : null,
        category_id: formData.category_id ? parseInt(formData.category_id) : null,
      };

      if (isEdit) {
        await eventsAPI.update(id, submitData);
        alert('수정되었습니다');
      } else {
        await eventsAPI.create(submitData);
        alert('등록되었습니다');
      }
      navigate('/admin/events');
    } catch (error) {
      alert(error.response?.data?.detail || '저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* 헤더 */}
      <div className="pt-2">
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? '행사 수정' : '새 행사 등록'}
        </h1>
      </div>

      {/* 폼 */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">행사명 *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="예: 볼보행사"
              className="input"
            />
          </div>

          {/* 행사장 위치 (카카오맵) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              행사장 위치 *
            </label>
            <LocationPicker
              address={formData.location_address}
              onLocationSelect={handleLocationSelect}
            />
          </div>

          {/* 상세 주소 보충 (선택사항) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              상세 장소 <span className="text-xs text-gray-500">(선택사항)</span>
            </label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="예: 3층 컨벤션홀, 메인 무대 앞 등 추가 안내사항"
              className="input"
            />
          </div>

          {/* GPS 인정 범위 */}
          <div className="pt-3 border-t border-gray-100">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">
                  📍 GPS 출근 인정 범위
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  GPS 인정 범위
                </label>
                <select
                  name="location_radius"
                  value={formData.location_radius}
                  onChange={handleChange}
                  className="input"
                >
                  <option value={50}>50m (매우 좁음)</option>
                  <option value={100}>100m (기본)</option>
                  <option value={200}>200m (넓음)</option>
                  <option value={500}>500m (매우 넓음)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  행사장에서 이 범위 내에 있어야 출근 인정됩니다
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">근무 시작일 *</label>
              <input
                type="date"
                name="event_date"
                value={formData.event_date}
                onChange={handleChange}
                required
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">근무 종료일 *</label>
              <input
                type="date"
                name="end_date"
                value={formData.end_date}
                onChange={handleChange}
                min={formData.event_date}
                required
                className="input"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 -mt-2">
            하루짜리 행사는 시작일과 종료일을 같은 날짜로 설정하세요
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">시작 시간</label>
              <input
                type="time"
                name="start_time"
                value={formData.start_time}
                onChange={handleChange}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">종료 시간</label>
              <input
                type="time"
                name="end_time"
                value={formData.end_time}
                onChange={handleChange}
                className="input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">급여 (원)</label>
              <input
                type="text"
                name="pay_amount"
                value={formData.pay_amount ? formData.pay_amount.toLocaleString('ko-KR') : ''}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, '');
                  setFormData({
                    ...formData,
                    pay_amount: value ? parseInt(value) : 0
                  });
                }}
                placeholder="예: 130,000"
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">모집 인원</label>
              <input
                type="number"
                name="headcount"
                value={formData.headcount}
                onChange={handleChange}
                min={1}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">급여 설명</label>
            <input
              type="text"
              name="pay_description"
              value={formData.pay_description}
              onChange={handleChange}
              placeholder="예: 수당포함, 3.3%공제, 식사제공"
              className="input"
            />
          </div>

          {/* 업종 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">업종 *</label>
            <select
              name="category_id"
              value={formData.category_id}
              onChange={handleChange}
              className="input"
              required
            >
              <option value="">업종 선택</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            {categories.length === 0 && (
              <p className="text-xs text-orange-500 mt-1">
                업종 마스터 데이터가 없습니다. 빅데이터 관리에서 초기화해주세요.
              </p>
            )}
          </div>

          {/* 상세 근무 유형 (기타 입력) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">상세 업무</label>
            <input
              type="text"
              name="work_type"
              value={formData.work_type}
              onChange={handleChange}
              placeholder="예: 주차안내, VIP응대 등"
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">복장</label>
            <input
              type="text"
              name="dress_code"
              value={formData.dress_code}
              onChange={handleChange}
              placeholder="예: 정장"
              className="input"
            />
          </div>

          {/* 자격요건 */}
          <div className="pt-2 border-t border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-2">자격요건</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="requires_driver_license"
                  checked={formData.requires_driver_license}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">운전면허 필요</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="requires_security_cert"
                  checked={formData.requires_security_cert}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">경호이수증 필요</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">담당자 선택</label>
              <select
                value={formData.manager_name}
                onChange={(e) => {
                  const selectedAdmin = admins.find(a => a.name === e.target.value);
                  setFormData({
                    ...formData,
                    manager_name: e.target.value,
                    manager_phone: selectedAdmin?.phone || ''
                  });
                }}
                className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">담당자 선택</option>
                {admins.map(admin => (
                  <option key={admin.id} value={admin.name}>
                    {admin.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">담당자 연락처</label>
              <input
                type="text"
                name="manager_phone"
                value={formData.manager_phone}
                readOnly
                placeholder="담당자 선택 시 자동입력"
                className="w-full px-4 py-3 border border-gray-200 rounded-2xl bg-gray-50"
              />
            </div>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/events')}
            className="btn-secondary flex-1"
          >
            취소
          </button>
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? '저장 중...' : isEdit ? '수정' : '등록'}
          </button>
        </div>
      </form>
    </div>
  );
}
