import { useState, createContext, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // BYPASS LOGIN - Gabriel
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('brickreview_token') || 'bypass-token');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Tenta forçar o login do Gabriel se estiver em modo bypass
    const forceBypass = async () => {
      try {
        const response = await fetch('/api/auth/verify', {
          headers: { 'Authorization': 'Bearer bypass-token' }
        });
        const data = await response.json();
        if (data.valid) {
          setUser(data.user);
        } else {
          // Se falhar o bypass, limpa para login real
          localStorage.removeItem('brickreview_token');
          setToken(null);
          setUser(null);
        }
      } catch (error) {
        console.error('Erro no bypass Gabriel:', error);
      } finally {
        setLoading(false);
      }
    };

    forceBypass();
  }, []);

  const verifyToken = async (authToken) => {
    try {
      const response = await fetch('/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      const data = await response.json();
      if (data.valid) {
        setUser(data.user);
      } else {
        logout();
      }
    } catch (error) {
      console.error('Erro ao verificar token:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      localStorage.setItem('brickreview_token', data.token);
      setToken(data.token);
      setUser(data.user);
      return { success: true };
    } else {
      return { success: false, error: data.error };
    }
  };

  const logout = () => {
    localStorage.removeItem('brickreview_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
