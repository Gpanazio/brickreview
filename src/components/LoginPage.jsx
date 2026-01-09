import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Film } from 'lucide-react';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    const result = await login(username, password);
    if (!result.success) {
      setError(result.error || 'Erro ao fazer login');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Accents */}
      <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-red-600/10 blur-[150px] rounded-full" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] bg-blue-600/5 blur-[150px] rounded-full" />

      <div className="w-full max-w-md relative z-10">
        <div className="glass-panel p-8 border border-zinc-800/50">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-red-600 flex items-center justify-center mb-4">
              <Film className="w-10 h-10 text-white" />
            </div>
            <h1 className="brick-title text-3xl text-white tracking-tighter">BRICKREVIEW</h1>
            <p className="text-zinc-500 text-sm mt-2 font-medium uppercase tracking-[0.2em]">Video Review System</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-zinc-400 font-bold">Username</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Seu usuário"
                className="glass-input h-12 rounded-none border-none"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-zinc-400 font-bold">Senha</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="glass-input h-12 rounded-none border-none"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-900/30 border border-red-500/50 text-red-200 text-xs font-bold uppercase tracking-wider">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 glass-button-primary border-none rounded-none text-sm font-black uppercase tracking-widest mt-4"
            >
              {isLoading ? 'Autenticando...' : 'Entrar'}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-zinc-800/50 text-center">
            <p className="text-[10px] text-zinc-600 uppercase tracking-[0.3em] font-bold italic">
              Acesso exclusivo para equipe Brick e clientes autorizados
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
