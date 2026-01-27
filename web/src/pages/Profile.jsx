import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { workersAPI, notificationsAPI, authAPI, bigdataAPI } from '../api/client';

export default function Profile() {
  const { user, worker, logout, updateWorker } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef(null);
  const [editing, setEditing] = useState(location.state?.edit || false);
  const [formData, setFormData] = useState({
    name: worker?.name || '',
    phone: worker?.phone || '',
    birth_date: worker?.birth_date || '',
    residence: worker?.residence || '',
    region_id: worker?.region_id || '',
    bank_name: worker?.bank_name || '',
    bank_account: worker?.bank_account || '',
    driver_license: worker?.driver_license || false,
    security_cert: worker?.security_cert || false,
    contract_signed: worker?.contract_signed || false,
  });
  const [saving, setSaving] = useState(false);

  // 지역 관련 상태
  const [regions, setRegions] = useState([]);
  const [sidoList, setSidoList] = useState([]);
  const [sigunguList, setSigunguList] = useState([]);
  const [selectedSido, setSelectedSido] = useState('');
  const [loadingWorker, setLoadingWorker] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [changingPassword, setChangingPassword] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  // 이미지 압축 함수 (최대 800px, 품질 0.7)
  const compressImage = (file, maxWidth = 800, quality = 0.7) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;

          // 최대 크기 조정
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            },
            'image/jpeg',
            quality
          );
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    loadRegions();
  }, []);

  // 지역 데이터 로드
  const loadRegions = async () => {
    try {
      const { data } = await bigdataAPI.getRegions();
      const regionsData = data.regions || [];
      setRegions(regionsData);
      const uniqueSido = [...new Set(regionsData.map(r => r.sido))];
      setSidoList(uniqueSido);
    } catch (error) {
      console.error('Failed to load regions:', error);
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

  useEffect(() => {
    if (user && !worker && !loadingWorker) {
      setLoadingWorker(true);
      workersAPI.getMe()
        .then(({ data }) => {
          updateWorker(data);
          setFormData({
            name: data.name || '',
            phone: data.phone || '',
            birth_date: data.birth_date || '',
            residence: data.residence || '',
            region_id: data.region_id || '',
            bank_name: data.bank_name || '',
            bank_account: data.bank_account || '',
            driver_license: data.driver_license || false,
            security_cert: data.security_cert || false,
            contract_signed: data.contract_signed || false,
          });
        })
        .catch(() => {})
        .finally(() => setLoadingWorker(false));
    }
  }, [user, worker]);

  useEffect(() => {
    if (worker) {
      loadNotifications();
    }
  }, [worker]);

  const loadNotifications = async () => {
    try {
      const { data } = await notificationsAPI.getList();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handlePhotoSelect = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 선택 가능합니다');
        return;
      }

      setCompressing(true);
      try {
        // 이미지 압축 (최대 800px, 품질 70%)
        const compressedFile = await compressImage(file, 800, 0.7);

        // 압축된 이미지 미리보기
        const reader = new FileReader();
        reader.onload = (readerEvent) => setPhotoPreview(readerEvent.target.result);
        reader.readAsDataURL(compressedFile);

        console.log(`원본: ${(file.size / 1024).toFixed(1)}KB → 압축: ${(compressedFile.size / 1024).toFixed(1)}KB`);

        // 자동 업로드
        setCompressing(false);
        setUploadingPhoto(true);
        try {
          await workersAPI.uploadPhoto(compressedFile);
          // worker 데이터 새로고침
          const { data } = await workersAPI.getMe();
          updateWorker(data);
          setPhotoFile(null);
          setPhotoPreview(null);
          setPhotoError(false);
          alert('사진이 업로드되었습니다');
        } catch (uploadError) {
          alert(uploadError.response?.data?.detail || '사진 업로드에 실패했습니다');
        } finally {
          setUploadingPhoto(false);
        }
      } catch (error) {
        console.error('이미지 압축 실패:', error);
        setCompressing(false);
        // 압축 실패 시 원본으로 업로드 시도
        setUploadingPhoto(true);
        try {
          await workersAPI.uploadPhoto(file);
          const { data } = await workersAPI.getMe();
          updateWorker(data);
          setPhotoFile(null);
          setPhotoPreview(null);
          setPhotoError(false);
          alert('사진이 업로드되었습니다');
        } catch (uploadError) {
          alert(uploadError.response?.data?.detail || '사진 업로드에 실패했습니다');
        } finally {
          setUploadingPhoto(false);
        }
      }
    }
  };

  useEffect(() => {
    if (worker) {
      setFormData({
        name: worker.name || '',
        phone: worker.phone || '',
        birth_date: worker.birth_date || '',
        residence: worker.residence || '',
        region_id: worker.region_id ? String(worker.region_id) : '',
        bank_name: worker.bank_name || '',
        bank_account: worker.bank_account || '',
        driver_license: worker.driver_license || false,
        security_cert: worker.security_cert || false,
        contract_signed: worker.contract_signed || false,
      });
      setPhotoError(false); // 사진 에러 상태 리셋
      // 기존 region_id로 sido 설정
      if (worker.region_id && regions.length > 0) {
        const region = regions.find(r => r.id === parseInt(worker.region_id));
        if (region) {
          setSelectedSido(region.sido);
        }
      }
    }
  }, [worker, regions]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    // 필수 필드 검증
    if (!formData.name?.trim() || !formData.phone?.trim() || !formData.birth_date ||
        !formData.region_id || !formData.bank_name?.trim() || !formData.bank_account?.trim()) {
      alert('모든 정보를 다 입력해주세요!');
      return;
    }

    // 사진 업로드 확인
    if (!worker.face_photo_file_id) {
      alert('프로필 사진을 업로드해주세요!');
      return;
    }

    // 용역계약서 체크 확인
    if (!formData.contract_signed) {
      alert('용역계약서 작성을 완료해주세요!');
      return;
    }

    setSaving(true);
    try {
      // 저장할 데이터 구성
      let saveData = { ...formData };

      // region_id가 있으면 residence 텍스트 생성
      if (formData.region_id) {
        const region = regions.find(r => r.id === parseInt(formData.region_id));
        if (region) {
          saveData.residence = `${region.sido} ${region.sigungu}`;
        }
        saveData.region_id = parseInt(formData.region_id);
      }

      const { data } = await workersAPI.updateMe(saveData);
      updateWorker(data);
      setEditing(false);
      alert('저장되었습니다');
    } catch (error) {
      const errorDetail = error.response?.data?.detail;
      let errorMessage = '저장에 실패했습니다';
      if (typeof errorDetail === 'string') {
        errorMessage = errorDetail;
      } else if (Array.isArray(errorDetail)) {
        errorMessage = errorDetail.map(e => e.msg || e).join(', ');
      } else if (errorDetail && typeof errorDetail === 'object') {
        errorMessage = errorDetail.msg || JSON.stringify(errorDetail);
      }
      alert(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      logout();
      navigate('/login');
    }
  };

  const handleChangePassword = async () => {
    if (!passwordData.current || !passwordData.new || !passwordData.confirm) {
      alert('모든 필드를 입력해주세요');
      return;
    }
    if (passwordData.new.length < 6) {
      alert('새 비밀번호는 6자 이상이어야 합니다');
      return;
    }
    if (passwordData.new !== passwordData.confirm) {
      alert('새 비밀번호가 일치하지 않습니다');
      return;
    }

    setChangingPassword(true);
    try {
      await authAPI.changePassword(passwordData.current, passwordData.new);
      alert('비밀번호가 변경되었습니다');
      setShowPasswordModal(false);
      setPasswordData({ current: '', new: '', confirm: '' });
    } catch (error) {
      alert(error.response?.data?.detail || '비밀번호 변경에 실패했습니다');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleWithdraw = async () => {
    setWithdrawing(true);
    try {
      await workersAPI.deleteMe();
      alert('회원 탈퇴가 완료되었습니다.');
      logout();
      navigate('/login');
    } catch (error) {
      alert(error.response?.data?.detail || '탈퇴 처리에 실패했습니다');
      setWithdrawing(false);
      setShowWithdrawModal(false);
    }
  };

  if (!user) {
    return (
      <div className="p-4 animate-fade-in">
        <div className="card text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: 'var(--color-bg)' }}>
            🔒
          </div>
          <p className="font-semibold mb-1" style={{ color: 'var(--color-text-title)' }}>로그인이 필요합니다</p>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-sub)' }}>서비스를 이용하려면 로그인해주세요</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98]"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            로그인하기
          </button>
        </div>
      </div>
    );
  }

  if (loadingWorker) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-900"></div>
      </div>
    );
  }

  if (!worker) {
    const isAdmin = user.role === 'admin' || user.is_admin;
    return (
      <div className="p-4 space-y-4 animate-fade-in">
        <div className="pt-2">
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-title)' }}>내 정보</h1>
        </div>

        <div className="card text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: 'var(--color-bg)' }}>
            {isAdmin ? '👑' : '👤'}
          </div>
          <p className="font-semibold mb-1" style={{ color: 'var(--color-text-title)' }}>
            {isAdmin ? '관리자 계정입니다' : '회원등록이 필요합니다'}
          </p>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-sub)' }}>
            {isAdmin ? '관리자는 근무자로 등록할 필요가 없습니다' : '근무를 위해 기본 정보를 등록해주세요'}
          </p>
          {!isAdmin && (
            <button
              onClick={() => navigate('/register')}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98]"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              회원등록
            </button>
          )}
        </div>

        <button
          onClick={handleLogout}
          className="w-full py-3 rounded-xl text-sm font-medium transition-all active:scale-[0.98]"
          style={{ color: 'var(--color-error)', backgroundColor: 'var(--color-bg)' }}
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      {/* 헤더 - 토스 스타일 */}
      <div className="pt-2 flex justify-between items-center">
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-title)' }}>내 정보</h1>
        <div className="flex items-center gap-3">
          {/* 알림 버튼 */}
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95"
            style={{ backgroundColor: showNotifications ? 'var(--color-primary-light)' : 'var(--color-bg)' }}
          >
            <span className="text-lg">🔔</span>
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 w-5 h-5 text-xs font-bold rounded-full flex items-center justify-center text-white" style={{ backgroundColor: 'var(--color-error)' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 rounded-full text-sm font-medium transition-all active:scale-95"
              style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-primary)' }}
            >
              수정
            </button>
          )}
        </div>
      </div>

      {/* 알림 패널 - 토스 스타일 */}
      {showNotifications && (
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold" style={{ color: 'var(--color-text-title)' }}>알림</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-medium"
                style={{ color: 'var(--color-primary)' }}
              >
                모두 읽음
              </button>
            )}
          </div>
          {notifications.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className="p-3 rounded-xl text-sm"
                  style={{
                    backgroundColor: n.is_read ? 'var(--color-bg)' : 'var(--color-primary-light)'
                  }}
                >
                  <p className="font-medium" style={{ color: 'var(--color-text-title)' }}>{n.title}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>{n.message}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-disabled)' }}>{n.created_at?.split(' ')[0]}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center text-xl" style={{ backgroundColor: 'var(--color-bg)' }}>🔕</div>
              <p className="text-sm" style={{ color: 'var(--color-text-disabled)' }}>알림이 없습니다</p>
            </div>
          )}
        </div>
      )}

      {/* 프로필 카드 - 토스 스타일 */}
      <div className="card">
        {/* 프로필 헤더 - 사진 포함 */}
        <div className="flex items-center gap-4 mb-4 pb-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div
            onClick={() => editing && fileInputRef.current?.click()}
            className={`w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden ${editing ? 'cursor-pointer border-2 border-dashed' : ''}`}
            style={{ backgroundColor: 'var(--color-primary-light)', borderColor: editing ? 'var(--color-primary)' : undefined }}
          >
            {compressing || uploadingPhoto ? (
              <div className="flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-primary"></div>
                <span className="text-xs mt-1" style={{ color: 'var(--color-text-sub)' }}>
                  {compressing ? '압축중' : '업로드중'}
                </span>
              </div>
            ) : photoPreview ? (
              <img src={photoPreview} alt="미리보기" className="w-full h-full object-cover" />
            ) : worker.face_photo_file_id && !photoError ? (
              <img
                key={worker.face_photo_file_id}
                src={workersAPI.getPhotoUrlFromPath(worker.face_photo_file_id) + `?v=${Date.now()}`}
                alt="프로필"
                className="w-full h-full object-cover"
                onError={() => setPhotoError(true)}
              />
            ) : (
              <span className="text-2xl">👤</span>
            )}
          </div>
          <div className="flex-1">
            <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-sub)' }}>안녕하세요</p>
            <h2 className="font-bold text-lg" style={{ color: 'var(--color-text-title)' }}>{worker.name || '-'}님</h2>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{worker.phone || '-'}</p>
            {worker.email && (
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-disabled)' }}>ID: {worker.email}</p>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoSelect}
            className="hidden"
          />
        </div>


        {editing ? (
          <div className="space-y-4">
            {/* 사진 변경 버튼 */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={compressing || uploadingPhoto}
              className="w-full py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.98]"
              style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}
            >
              {compressing ? '압축 중...' : uploadingPhoto ? '업로드 중...' : <>프로필 사진 업로드 (면접대체용) <span style={{ color: 'var(--color-error)' }}>*</span></>}
            </button>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-sub)' }}>이름 <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl text-sm"
                style={{ backgroundColor: 'var(--color-bg)', border: 'none', color: 'var(--color-text-title)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-sub)' }}>전화번호 <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl text-sm"
                style={{ backgroundColor: 'var(--color-bg)', border: 'none', color: 'var(--color-text-title)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-sub)' }}>생년월일 <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <input
                type="date"
                name="birth_date"
                value={formData.birth_date}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl text-sm"
                style={{ backgroundColor: 'var(--color-bg)', border: 'none', color: 'var(--color-text-title)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-sub)' }}>거주지역 <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={selectedSido}
                  onChange={(e) => {
                    setSelectedSido(e.target.value);
                    setFormData({ ...formData, region_id: '' });
                  }}
                  className="w-full px-4 py-3 rounded-xl text-sm"
                  style={{ backgroundColor: 'var(--color-bg)', border: 'none', color: 'var(--color-text-title)' }}
                >
                  <option value="">시/도 선택</option>
                  {sidoList.map((sido) => (
                    <option key={sido} value={sido}>{sido}</option>
                  ))}
                </select>
                <select
                  value={formData.region_id}
                  onChange={(e) => setFormData({ ...formData, region_id: e.target.value })}
                  disabled={!selectedSido}
                  className="w-full px-4 py-3 rounded-xl text-sm disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-bg)', border: 'none', color: 'var(--color-text-title)' }}
                >
                  <option value="">시/군/구 선택</option>
                  {sigunguList.map((region) => (
                    <option key={region.id} value={String(region.id)}>{region.sigungu}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-sub)' }}>은행명 <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <input
                type="text"
                name="bank_name"
                value={formData.bank_name}
                onChange={handleChange}
                placeholder="예: 신한은행"
                className="w-full px-4 py-3 rounded-xl text-sm"
                style={{ backgroundColor: 'var(--color-bg)', border: 'none', color: 'var(--color-text-title)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-sub)' }}>계좌번호 <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <input
                type="text"
                name="bank_account"
                value={formData.bank_account}
                onChange={handleChange}
                placeholder="숫자만 입력"
                className="w-full px-4 py-3 rounded-xl text-sm"
                style={{ backgroundColor: 'var(--color-bg)', border: 'none', color: 'var(--color-text-title)' }}
              />
            </div>

            {/* 자격증 토글 */}
            <div className="flex items-center justify-between py-3 px-4 rounded-xl" style={{ backgroundColor: 'var(--color-bg)' }}>
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>운전면허 보유</span>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, driver_license: !formData.driver_license })}
                className={`w-12 h-7 rounded-full transition-all ${formData.driver_license ? 'bg-primary' : 'bg-gray-300'}`}
                style={{ backgroundColor: formData.driver_license ? 'var(--color-primary)' : '#D1D5DB' }}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.driver_license ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between py-3 px-4 rounded-xl" style={{ backgroundColor: 'var(--color-bg)' }}>
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>경호이수증 보유</span>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, security_cert: !formData.security_cert })}
                className={`w-12 h-7 rounded-full transition-all`}
                style={{ backgroundColor: formData.security_cert ? 'var(--color-primary)' : '#D1D5DB' }}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.security_cert ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>

            {/* 용역계약서 */}
            <div className="pt-2 space-y-2">
              <label className="block text-xs font-medium" style={{ color: 'var(--color-text-sub)' }}>용역계약서 <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <a
                href="https://glosign.com/linkviewer/l19505c1c6253ae8fc0507e5a53072ed1d96fdb16a1eeeddc472fc4ee1a1cefb3ec31a275fdb22d570bf5644d281c10d8"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 px-4 rounded-xl text-sm font-medium text-center text-white"
                style={{ background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)' }}
              >
                📄 용역계약서 작성하기
              </a>
              <label className="flex items-center gap-3 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.contract_signed}
                  onChange={(e) => setFormData({ ...formData, contract_signed: e.target.checked })}
                  className="w-5 h-5 rounded"
                />
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  용역계약서 작성을 완료했습니다 <span style={{ color: 'var(--color-error)' }}>*</span>
                </span>
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setEditing(false)}
                className="flex-1 py-3 rounded-xl text-sm font-medium transition-all active:scale-[0.98]"
                style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98]"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>

            {/* 탈퇴하기 버튼 */}
            <div className="pt-6 border-t mt-6" style={{ borderColor: 'var(--color-border)' }}>
              <button
                onClick={() => setShowWithdrawModal(true)}
                className="w-full py-3 rounded-xl text-sm font-medium transition-all active:scale-[0.98]"
                style={{ color: 'var(--color-error)', backgroundColor: 'transparent' }}
              >
                회원 탈퇴
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-0">
            <div className="flex justify-between items-center py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <span className="text-sm" style={{ color: 'var(--color-text-sub)' }}>생년월일</span>
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-title)' }}>{worker.birth_date || '-'}</span>
            </div>
            <div className="flex justify-between items-center py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <span className="text-sm" style={{ color: 'var(--color-text-sub)' }}>거주지역</span>
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-title)' }}>{worker.residence || '-'}</span>
            </div>
            <div className="flex justify-between items-center py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <span className="text-sm" style={{ color: 'var(--color-text-sub)' }}>은행</span>
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-title)' }}>{worker.bank_name || '-'}</span>
            </div>
            <div className="flex justify-between items-center py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <span className="text-sm" style={{ color: 'var(--color-text-sub)' }}>계좌번호</span>
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-title)' }}>{worker.bank_account || '-'}</span>
            </div>
            <div className="flex justify-between items-center py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <span className="text-sm" style={{ color: 'var(--color-text-sub)' }}>운전면허</span>
              <span className="text-sm font-medium" style={{ color: worker.driver_license ? 'var(--color-primary)' : 'var(--color-text-disabled)' }}>
                {worker.driver_license ? '보유' : '없음'}
              </span>
            </div>
            <div className="flex justify-between items-center py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <span className="text-sm" style={{ color: 'var(--color-text-sub)' }}>경호이수증</span>
              <span className="text-sm font-medium" style={{ color: worker.security_cert ? 'var(--color-primary)' : 'var(--color-text-disabled)' }}>
                {worker.security_cert ? '보유' : '없음'}
              </span>
            </div>
            <div className="flex justify-between items-center py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <span className="text-sm" style={{ color: 'var(--color-text-sub)' }}>용역계약서</span>
              <span className="text-sm font-medium" style={{ color: worker.contract_signed ? 'var(--color-primary)' : 'var(--color-text-disabled)' }}>
                {worker.contract_signed ? '작성완료' : '미작성'}
              </span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-sm" style={{ color: 'var(--color-text-sub)' }}>등록일</span>
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-title)' }}>{worker.created_at?.split(' ')[0] || '-'}</span>
            </div>
          </div>
        )}
      </div>

      {/* 비밀번호 변경 버튼 - 이메일 사용자만 */}
      {user?.username?.includes('@') && (
        <button
          onClick={() => setShowPasswordModal(true)}
          className="w-full py-3 rounded-xl text-sm font-medium transition-all active:scale-[0.98] mb-2"
          style={{ color: 'var(--color-text-secondary)', backgroundColor: 'var(--color-bg)' }}
        >
          비밀번호 변경
        </button>
      )}

      {/* 로그아웃 - 토스 스타일 */}
      <button
        onClick={handleLogout}
        className="w-full py-3 rounded-xl text-sm font-medium transition-all active:scale-[0.98]"
        style={{ color: 'var(--color-error)', backgroundColor: 'var(--color-bg)' }}
      >
        로그아웃
      </button>

      {/* 비밀번호 변경 모달 */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center sm:justify-center z-50">
          <div className="bg-white w-full sm:w-[420px] sm:max-w-[90vw] rounded-t-3xl sm:rounded-2xl p-5 space-y-4 animate-slide-up">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-title)' }}>비밀번호 변경</h2>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordData({ current: '', new: '', confirm: '' });
                }}
                className="w-8 h-8 flex items-center justify-center rounded-full"
                style={{ backgroundColor: 'var(--color-bg)' }}
              >
                <span className="text-xl" style={{ color: 'var(--color-text-secondary)' }}>×</span>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-sub)' }}>현재 비밀번호</label>
                <input
                  type="password"
                  value={passwordData.current}
                  onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                  className="input py-2.5"
                  placeholder="현재 비밀번호 입력"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-sub)' }}>새 비밀번호</label>
                <input
                  type="password"
                  value={passwordData.new}
                  onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                  className="input py-2.5"
                  placeholder="6자 이상"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-sub)' }}>새 비밀번호 확인</label>
                <input
                  type="password"
                  value={passwordData.confirm}
                  onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                  className="input py-2.5"
                  placeholder="새 비밀번호 다시 입력"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordData({ current: '', new: '', confirm: '' });
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}
              >
                취소
              </button>
              <button
                onClick={handleChangePassword}
                disabled={changingPassword}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {changingPassword ? '변경 중...' : '변경하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 회원 탈퇴 확인 모달 */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 space-y-4">
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center text-2xl" style={{ backgroundColor: '#FEE2E2' }}>
                ⚠️
              </div>
              <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text-title)' }}>회원 탈퇴</h2>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                정말 탈퇴하시겠습니까?<br />
                탈퇴 시 모든 정보가 삭제되며<br />
                복구할 수 없습니다.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowWithdrawModal(false)}
                disabled={withdrawing}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}
              >
                취소
              </button>
              <button
                onClick={handleWithdraw}
                disabled={withdrawing}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-error)' }}
              >
                {withdrawing ? '탈퇴 중...' : '탈퇴하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
