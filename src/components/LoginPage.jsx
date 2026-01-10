import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Film } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
    <div className="min-h-screen bg-[#0d0d0e] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Accents */}
      <motion.div 
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.04, 0.06, 0.04],
          x: [0, 30, 0],
          y: [0, -20, 0]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-red-600/10 blur-[180px] rounded-full pointer-events-none" 
      />
      <motion.div 
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.05, 0.08, 0.05],
          x: [0, -40, 0],
          y: [0, 60, 0]
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-[-15%] right-[-10%] w-[60%] h-[60%] bg-blue-600/5 blur-[150px] rounded-full" 
      />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-md relative z-10"
      >
        <div className="glass-panel p-10 border border-zinc-800/50 relative overflow-hidden group">
          {/* Subtle line across the card */}
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-zinc-500/20 to-transparent" />
          
          <div className="flex flex-col items-center mb-10">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
              className="w-20 h-20 bg-red-600 flex items-center justify-center mb-6 relative"
            >
              <div className="absolute inset-0 bg-red-600 animate-pulse opacity-50 blur-xl" />
              <Film className="w-12 h-12 text-white relative z-10" />
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-center"
            >
              <h1 className="brick-title text-4xl text-white tracking-tighter mb-1">BRICKREVIEW</h1>
              <div className="h-[2px] w-12 bg-red-600 mx-auto mb-4" />
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.4em] leading-none">Video Review System</p>
            </motion.div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="space-y-2"
            >
              <label className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-black">Usuário</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="SEU USUÁRIO"
                className="glass-input h-14 rounded-none border-none text-xs tracking-widest"
                required
              />
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="space-y-2"
            >
              <label className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-black">Senha</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="glass-input h-14 rounded-none border-none"
                required
              />
            </motion.div>

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-4 bg-red-900/20 border-l-2 border-red-600 text-red-200 text-[10px] font-black uppercase tracking-wider overflow-hidden"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
            >
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-14 glass-button-primary border-none rounded-none text-xs font-black uppercase tracking-[0.3em] mt-2"
              >
                {isLoading ? 'Autenticando...' : 'Entrar na Plataforma'}
              </Button>
            </motion.div>
          </form>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 1 }}
            className="mt-12 pt-8 border-t border-zinc-900 text-center"
          >
            <p className="text-[9px] text-zinc-600 uppercase tracking-[0.4em] font-bold leading-relaxed">
              Acesso exclusivo para equipe <span className="text-zinc-400">Brick</span> e clientes autorizados
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
