import { useState, createContext, useContext, useEffect, useCallback } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Erro no logout:", e);
    }
    setUser(null);
  }, []);

  const verifyToken = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/verify");

      if (!response.ok) {
        if (response.status !== 401 && response.status !== 403) {
          console.error("Erro inesperado ao verificar sessão:", response.status);
        }
        setUser(null);
        return;
      }

      const data = await response.json();
      if (data.valid) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Erro ao verificar sessão:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    verifyToken();
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
    <AuthContext.Provider value={{ user, token: null, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
