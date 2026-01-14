import { useState, createContext, useContext, useEffect, useCallback } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("brickreview_token"));
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem("brickreview_token");
    setToken(null);
    setUser(null);
  }, []);

  const verifyToken = useCallback(async (authToken) => {
    try {
      const response = await fetch("/api/auth/verify", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const data = await response.json();
      if (data.valid) {
        setUser(data.user);
      } else {
        logout();
      }
    } catch (error) {
      console.error("Erro ao verificar token:", error);
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    const storedToken = localStorage.getItem("brickreview_token");
    if (storedToken) {
      verifyToken(storedToken);
    } else {
      setLoading(false);
    }
  }, [verifyToken]);

  const login = async (username, password) => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (response.ok) {
          localStorage.setItem("brickreview_token", data.token);
          setToken(data.token);
          setUser(data.user);
          return { success: true };
        } else {
          return { success: false, error: data.error || "Erro no login" };
        }
      } else {
        const text = await response.text();
        console.error("Resposta não-JSON do servidor:", text);
        return { success: false, error: `Erro no servidor (${response.status})` };
      }
    } catch (error) {
      console.error("Erro na requisição de login:", error);
      return { success: false, error: "Erro de conexão com o servidor" };
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
