import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api/client';

export default function Login() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, checkAuth } = useAuth();

  // Email login states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState('login'); // login, register
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const formatPhone = (value) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  };

  // Email login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      alert('이메일과 비밀번호를 입력해주세요');
      return;
    }

    setLoading(true);
    try {
      const { data } = await authAPI.emailLogin(email, password);
      login(data.access_token, data);
      await checkAuth();
      navigate('/');
    } catch (error) {
      if (error.response?.status === 401) {
        alert('이메일 또는 비밀번호가 올바르지 않습니다');
      } else {
        alert('로그인에 실패했습니다');
      }
    } finally {
      setLoading(false);
    }
  };

  // Email register
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!email || !name.trim() || !phone.trim() || !password) {
      alert('모든 정보를 입력해주세요');
      return;
    }
    if (password.length < 6) {
      alert('비밀번호는 6자 이상이어야 합니다');
      return;
    }

    setLoading(true);
    try {
      const { data } = await authAPI.emailRegister({
        email,
        password,
        name,
        phone: phone.replace(/-/g, ''),
      });
      login(data.access_token, data);
      await checkAuth();
      navigate('/profile', { state: { edit: true } });  // 회원가입 후 프로필 수정 모드로 이동
    } catch (error) {
      alert(error.response?.data?.detail || '회원가입에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center p-6">
      <div className="max-w-sm mx-auto w-full">
        {/* 로고 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">WorkProof</h1>
          <p className="text-gray-500 mt-2">근무이력 증명 시스템</p>
        </div>

        {/* 로그인 */}
        {step === 'login' && (
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="input text-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
                className="input text-lg"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? '로그인 중...' : '로그인'}
            </button>
            <button
              type="button"
              onClick={() => setStep('register')}
              className="w-full text-center text-sm text-blue-600 hover:underline"
            >
              회원가입
            </button>
          </form>
        )}

        {/* 회원가입 */}
        {step === 'register' && (
          <form onSubmit={handleRegister} className="space-y-5">
            <div className="text-center mb-4">
              <p className="text-gray-600">회원 정보를 입력해주세요</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="input text-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6자 이상"
                className="input text-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">이름</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                className="input text-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">전화번호</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="010-1234-5678"
                className="input text-lg"
                maxLength={13}
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? '가입 중...' : '회원가입'}
            </button>
            <button
              type="button"
              onClick={() => setStep('login')}
              className="btn-secondary w-full"
            >
              뒤로가기
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
