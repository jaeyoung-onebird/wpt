import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { workersAPI, authAPI, creditsAPI, badgesAPI } from '../api/client';
import LocationPicker from '../components/LocationPicker';

export default function My() {
  const { user, worker, logout, updateWorker } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // 상태
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [photoError, setPhotoError] = useState(false);

  // 데이터
  const [balance, setBalance] = useState(0);
  const [badgeCount, setBadgeCount] = useState(0);

  // 폼 데이터
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    birth_date: '',
    residence: '',
    residence_lat: null,
    residence_lng: null,
    bank_name: '',
    bank_account: '',
    driver_license: false,
    security_cert: false,
    contract_signed: false,
  });

  // 비밀번호 변경
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [changingPassword, setChangingPassword] = useState(false);

  // 회원 탈퇴
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    loadData();
  }, [worker]);

  const loadData = async () => {
    try {
      if (worker) {
        setFormData({
          name: worker.name || '',
          phone: worker.phone || '',
          birth_date: worker.birth_date || '',
          residence: worker.residence || '',
          residence_lat: worker.residence_lat || null,
          residence_lng: worker.residence_lng || null,
          bank_name: worker.bank_name || '',
          bank_account: worker.bank_account || '',
          driver_license: worker.driver_license || false,
          security_cert: worker.security_cert || false,
          contract_signed: worker.contract_signed || false,
        });

        // WPT 잔액 및 배지 수 로드
        const [balanceRes, badgeRes] = await Promise.all([
          creditsAPI.getMyBalance().catch(() => ({ data: { balance: 0 } })),
          badgesAPI.getMyBadges().catch(() => ({ data: { badges: [] } })),
        ]);
        setBalance(balanceRes.data.balance || 0);
        setBadgeCount(badgeRes.data.badges?.length || 0);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 거주지 선택 핸들러
  const handleResidenceSelect = (address, latitude, longitude) => {
    setFormData({
      ...formData,
      residence: address,
      residence_lat: latitude,
      residence_lng: longitude,
    });
  };

  // 이미지 압축
  const compressImage = (file, maxWidth = 800, quality = 0.7) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
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

  const handlePhotoSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 선택 가능합니다');
      return;
    }

    setCompressing(true);
    try {
      const compressedFile = await compressImage(file, 800, 0.7);
      setCompressing(false);
      setUploadingPhoto(true);

      await workersAPI.uploadPhoto(compressedFile);
      const { data } = await workersAPI.getMe();
      updateWorker(data);
      setPhotoError(false);
      alert('사진이 업로드되었습니다');
    } catch (error) {
      alert(error.response?.data?.detail || '사진 업로드에 실패했습니다');
    } finally {
      setCompressing(false);
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name?.trim() || !formData.phone?.trim() || !formData.birth_date ||
        !formData.residence?.trim() || !formData.bank_name?.trim() || !formData.bank_account?.trim()) {
      alert('모든 정보를 다 입력해주세요!');
      return;
    }
    if (!worker.face_photo_file_id) {
      alert('프로필 사진을 업로드해주세요!');
      return;
    }
    if (!formData.contract_signed) {
      alert('용역계약서 작성을 완료해주세요!');
      return;
    }

    setSaving(true);
    try {
      const saveData = {
        name: formData.name,
        phone: formData.phone,
        birth_date: formData.birth_date,
        residence: formData.residence,
        residence_lat: formData.residence_lat,
        residence_lng: formData.residence_lng,
        bank_name: formData.bank_name,
        bank_account: formData.bank_account,
        driver_license: formData.driver_license,
        security_cert: formData.security_cert,
      };

      const { data } = await workersAPI.updateMe(saveData);
      updateWorker(data);
      setEditing(false);
      alert('저장되었습니다');
    } catch (error) {
      const errorDetail = error.response?.data?.detail;
      let errorMessage = '저장에 실패했습니다';
      if (typeof errorDetail === 'string') errorMessage = errorDetail;
      else if (Array.isArray(errorDetail)) errorMessage = errorDetail.map(e => e.msg || e).join(', ');
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
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-sub)' }}>마이페이지를 확인하려면 로그인해주세요</p>
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

  if (loading) {
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
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-title)' }}>MY</h1>
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
      {/* 헤더 */}
      <div className="pt-2 flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-title)' }}>MY</h1>
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

      {/* 프로필 요약 카드 */}
      <div className="card">
        <div className="flex items-center gap-4 mb-4">
          <div
            onClick={() => editing && fileInputRef.current?.click()}
            className={`w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden ${editing ? 'cursor-pointer border-2 border-dashed' : ''}`}
            style={{ backgroundColor: 'var(--color-primary-light)', borderColor: editing ? 'var(--color-primary)' : undefined }}
          >
            {compressing || uploadingPhoto ? (
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-primary"></div>
            ) : worker.face_photo_file_id && !photoError ? (
              <img
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
            <h2 className="font-bold text-lg" style={{ color: 'var(--color-text-title)' }}>{worker.name || '-'}님</h2>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{worker.phone || '-'}</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoSelect}
            className="hidden"
          />
        </div>

        {/* WPT & 배지 요약 */}
        <div className="flex gap-2">
          <Link to="/wallet" className="flex-1 p-3 rounded-xl transition-all active:scale-[0.98]" style={{ backgroundColor: 'var(--color-bg)' }}>
            <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>보유 WPT</p>
            <p className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>{balance.toLocaleString()}</p>
          </Link>
          <Link to="/collection" className="flex-1 p-3 rounded-xl transition-all active:scale-[0.98]" style={{ backgroundColor: 'var(--color-bg)' }}>
            <p className="text-xs" style={{ color: 'var(--color-text-sub)' }}>보유 배지</p>
            <p className="text-lg font-bold" style={{ color: 'var(--color-secondary)' }}>{badgeCount}개</p>
          </Link>
        </div>
      </div>

      {/* 프로필 정보 */}
      <div className="card">
        <h3 className="font-semibold mb-3" style={{ color: 'var(--color-text-title)' }}>내 정보</h3>

        {editing ? (
          <div className="space-y-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={compressing || uploadingPhoto}
              className="w-full py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.98]"
              style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}
            >
              {compressing ? '압축 중...' : uploadingPhoto ? '업로드 중...' : <>프로필 사진 업로드 <span style={{ color: 'var(--color-error)' }}>*</span></>}
            </button>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-sub)' }}>이름 <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl text-sm"
                style={{ backgroundColor: 'var(--color-bg)', border: 'none', color: 'var(--color-text-title)' }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-sub)' }}>전화번호 <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl text-sm"
                style={{ backgroundColor: 'var(--color-bg)', border: 'none', color: 'var(--color-text-title)' }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-sub)' }}>생년월일 <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <input
                type="date"
                value={formData.birth_date}
                onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl text-sm"
                style={{ backgroundColor: 'var(--color-bg)', border: 'none', color: 'var(--color-text-title)' }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-sub)' }}>거주지역 <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <LocationPicker
                address={formData.residence}
                onLocationSelect={handleResidenceSelect}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-sub)' }}>은행명 <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <input
                type="text"
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                placeholder="예: 신한은행"
                className="w-full px-4 py-2.5 rounded-xl text-sm"
                style={{ backgroundColor: 'var(--color-bg)', border: 'none', color: 'var(--color-text-title)' }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-sub)' }}>계좌번호 <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <input
                type="text"
                value={formData.bank_account}
                onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                placeholder="숫자만 입력"
                className="w-full px-4 py-2.5 rounded-xl text-sm"
                style={{ backgroundColor: 'var(--color-bg)', border: 'none', color: 'var(--color-text-title)' }}
              />
            </div>

            {/* 토글 */}
            <div className="flex items-center justify-between py-2 px-3 rounded-xl" style={{ backgroundColor: 'var(--color-bg)' }}>
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>운전면허 보유</span>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, driver_license: !formData.driver_license })}
                className="w-11 h-6 rounded-full transition-all"
                style={{ backgroundColor: formData.driver_license ? 'var(--color-primary)' : '#D1D5DB' }}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.driver_license ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between py-2 px-3 rounded-xl" style={{ backgroundColor: 'var(--color-bg)' }}>
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>경호이수증 보유</span>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, security_cert: !formData.security_cert })}
                className="w-11 h-6 rounded-full transition-all"
                style={{ backgroundColor: formData.security_cert ? 'var(--color-primary)' : '#D1D5DB' }}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.security_cert ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* 용역계약서 */}
            <div className="pt-2">
              <a
                href="https://glosign.com/linkviewer/l19505c1c6253ae8fc0507e5a53072ed1d96fdb16a1eeeddc472fc4ee1a1cefb3ec31a275fdb22d570bf5644d281c10d8"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-2.5 px-4 rounded-xl text-sm font-medium text-center text-white"
                style={{ background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)' }}
              >
                용역계약서 작성하기
              </a>
              <label className="flex items-center gap-2 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.contract_signed}
                  onChange={(e) => setFormData({ ...formData, contract_signed: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  용역계약서 작성 완료 <span style={{ color: 'var(--color-error)' }}>*</span>
                </span>
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setEditing(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.98]"
                style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98]"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-0">
            {[
              { label: '생년월일', value: worker.birth_date },
              { label: '거주지역', value: worker.residence },
              { label: '은행', value: worker.bank_name },
              { label: '계좌번호', value: worker.bank_account },
              { label: '운전면허', value: worker.driver_license ? '보유' : '없음', highlight: worker.driver_license },
              { label: '경호이수증', value: worker.security_cert ? '보유' : '없음', highlight: worker.security_cert },
              { label: '용역계약서', value: worker.contract_signed ? '완료' : '미작성', highlight: worker.contract_signed },
            ].map((item, idx) => (
              <div key={idx} className="flex justify-between items-center py-2.5" style={{ borderBottom: idx < 6 ? '1px solid var(--color-border)' : 'none' }}>
                <span className="text-sm" style={{ color: 'var(--color-text-sub)' }}>{item.label}</span>
                <span className="text-sm font-medium" style={{ color: item.highlight !== undefined ? (item.highlight ? 'var(--color-primary)' : 'var(--color-text-disabled)') : 'var(--color-text-title)' }}>
                  {item.value || '-'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 메뉴 */}
      <div className="card">
        <h3 className="font-semibold mb-3" style={{ color: 'var(--color-text-title)' }}>설정</h3>
        <div className="space-y-0">
          <Link to="/notifications" className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>알림</span>
            <svg className="w-4 h-4" fill="none" stroke="var(--color-text-sub)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <Link to="/blockchain" className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>블록체인 기록</span>
            <svg className="w-4 h-4" fill="none" stroke="var(--color-text-sub)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          {user?.username?.includes('@') && (
            <button
              onClick={() => setShowPasswordModal(true)}
              className="flex items-center justify-between py-3 w-full"
              style={{ borderBottom: '1px solid var(--color-border)' }}
            >
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>비밀번호 변경</span>
              <svg className="w-4 h-4" fill="none" stroke="var(--color-text-sub)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
          {editing && (
            <button
              onClick={() => setShowWithdrawModal(true)}
              className="flex items-center justify-between py-3 w-full"
            >
              <span className="text-sm" style={{ color: 'var(--color-error)' }}>회원 탈퇴</span>
              <svg className="w-4 h-4" fill="none" stroke="var(--color-error)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 로그아웃 */}
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
          <div className="bg-white w-full sm:w-96 rounded-t-3xl sm:rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-title)' }}>비밀번호 변경</h2>
              <button onClick={() => { setShowPasswordModal(false); setPasswordData({ current: '', new: '', confirm: '' }); }}>
                <span className="text-xl" style={{ color: 'var(--color-text-secondary)' }}>×</span>
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="password"
                value={passwordData.current}
                onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                placeholder="현재 비밀번호"
                className="w-full px-4 py-2.5 rounded-xl text-sm"
                style={{ backgroundColor: 'var(--color-bg)', border: 'none' }}
              />
              <input
                type="password"
                value={passwordData.new}
                onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                placeholder="새 비밀번호 (6자 이상)"
                className="w-full px-4 py-2.5 rounded-xl text-sm"
                style={{ backgroundColor: 'var(--color-bg)', border: 'none' }}
              />
              <input
                type="password"
                value={passwordData.confirm}
                onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                placeholder="새 비밀번호 확인"
                className="w-full px-4 py-2.5 rounded-xl text-sm"
                style={{ backgroundColor: 'var(--color-bg)', border: 'none' }}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowPasswordModal(false); setPasswordData({ current: '', new: '', confirm: '' }); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-secondary)' }}
              >
                취소
              </button>
              <button
                onClick={handleChangePassword}
                disabled={changingPassword}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {changingPassword ? '변경 중...' : '변경하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 회원 탈퇴 모달 */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center text-2xl" style={{ backgroundColor: '#FEE2E2' }}>
              ⚠️
            </div>
            <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text-title)' }}>회원 탈퇴</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              정말 탈퇴하시겠습니까?<br />모든 정보가 삭제되며 복구할 수 없습니다.
            </p>
            <div className="flex gap-2">
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
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white"
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
