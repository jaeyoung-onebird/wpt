import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, workersAPI } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const { data: userData } = await authAPI.me();
      setUser(userData);

      if (userData.is_registered) {
        const { data: workerData } = await workersAPI.getMe();
        setWorker(workerData);
      }
    } catch (error) {
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setWorker(null);
  };

  const updateWorker = (data) => {
    setWorker(data);
  };

  return (
    <AuthContext.Provider value={{ user, worker, loading, login, logout, checkAuth, updateWorker }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
