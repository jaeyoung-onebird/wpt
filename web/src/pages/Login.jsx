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

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center p-6">
      <div className="max-w-sm mx-auto w-full">
        {/* 로고 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">WorkProof</h1>
          <p className="text-gray-500 mt-2">근무이력 증명 시스템</p>
        </div>

        {/* 로그인 */}
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
            onClick={() => navigate('/register')}
            className="w-full text-center text-sm text-blue-600 hover:underline"
          >
            회원가입
          </button>
        </form>
      </div>
    </div>
  );
}
