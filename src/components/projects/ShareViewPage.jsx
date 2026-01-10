import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Film, Folder, Play, Clock, MessageSquare, ChevronRight, Share2, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { VideoPlayer } from '../player/VideoPlayer';

export function ShareViewPage() {
  const { token } = useParams();
  const [shareData, setShareData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [visitorName, setVisitorName] = useState(localStorage.getItem('brickreview_visitor_name') || '');
  const [showNameModal, setShowNameModal] = useState(!localStorage.getItem('brickreview_visitor_name'));

  const fetchShare = async (pass = null) => {
    try {
      setLoading(true);
      setError(null);
      const url = `/api/shares/${token}${pass ? `?password=${pass}` : ''}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 && data.requires_password) {
          setShareData({ requires_password: true });
        } else {
          throw new Error(data.error || 'Erro ao carregar link');
        }
      } else {
        setShareData(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShare();
  }, [token]);

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    fetchShare(password);
  };

  const handleSaveName = (e) => {
    e.preventDefault();
    if (visitorName.trim()) {
      localStorage.setItem('brickreview_visitor_name', visitorName.trim());
      setShowNameModal(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d0e] flex items-center justify-center text-white font-sans">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-2 border-red-600 border-t-transparent" 
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0d0d0e] flex flex-col items-center justify-center text-white p-4 font-sans text-center">
        <div className="w-16 h-16 bg-red-600/10 rounded-full flex items-center justify-center mb-6 border border-red-600/20">
          <Share2 className="text-red-500 w-8 h-8" />
        </div>
        <h1 className="brick-title text-2xl mb-2">LINK INVÁLIDO</h1>
        <p className="text-zinc-500 text-sm max-w-xs">{error}</p>
        <Button variant="link" className="mt-6 text-red-500" asChild>
          <Link to="/login">Ir para Login</Link>
        </Button>
      </div>
    );
  }

  if (shareData?.requires_password) {
    return (
      <div className="min-h-screen bg-[#0d0d0e] flex items-center justify-center p-4 font-sans text-white">
        <Card className="w-full max-w-sm glass-panel border-zinc-800/50 p-8 rounded-none">
          <div className="flex flex-col items-center mb-8 text-center">
            <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
              <Lock className="w-5 h-5 text-zinc-400" />
            </div>
            <h1 className="brick-title text-xl tracking-tighter">LINK PROTEGIDO</h1>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">Este link exige uma senha de acesso</p>
          </div>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <Input 
              type="password"
              placeholder="DIGITE A SENHA"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="glass-input h-12 rounded-none border-none text-center"
              required
            />
            <Button type="submit" className="w-full h-12 glass-button-primary border-none rounded-none font-black uppercase tracking-widest text-xs">
              Acessar Conteúdo
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  const { resource } = shareData;

  return (
    <div className="min-h-screen bg-[#0d0d0e] text-white font-sans overflow-hidden flex flex-col">
      {/* Name Collection Overlay */}
      <AnimatePresence>
        {showNameModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm glass-panel p-8 border-zinc-800"
            >
              <h2 className="brick-title text-xl text-center mb-2">BEM-VINDO AO REVIEW</h2>
              <p className="text-[10px] text-zinc-500 text-center uppercase tracking-[0.2em] mb-8 leading-relaxed">
                Identifique-se para que possamos atribuir seus comentários
              </p>
              <form onSubmit={handleSaveName} className="space-y-4">
                <Input 
                  placeholder="SEU NOME"
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  className="glass-input h-12 rounded-none border-none text-center text-xs tracking-widest"
                  required
                  autoFocus
                />
                <Button type="submit" className="w-full h-12 glass-button-primary border-none rounded-none font-black uppercase tracking-widest text-xs">
                  Começar Revisão
                </Button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Public Header */}
      <header className="h-16 border-b border-zinc-900 bg-black/40 backdrop-blur-md px-6 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-red-600 flex items-center justify-center">
            <Film className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="brick-title text-sm tracking-tighter">BRICK <span className="text-red-500">SHARE</span></h1>
            <p className="text-[8px] text-zinc-500 uppercase tracking-widest leading-none">Review Mode</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Badge variant="outline" className="border-zinc-800 text-[8px] uppercase tracking-widest text-zinc-400 rounded-none bg-zinc-900/50 h-6">
            Visitante: {visitorName || 'Anônimo'}
          </Badge>
          <Button variant="ghost" size="sm" className="text-zinc-500 text-[10px] uppercase font-bold hover:text-white" onClick={() => setShowNameModal(true)}>
            Trocar Nome
          </Button>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto p-8 relative">
        {/* Glow Effect */}
        <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-red-600/5 blur-[150px] rounded-full pointer-events-none" />
        
        <div className="max-w-6xl mx-auto space-y-8 relative z-10">
          {/* Resource Title & Breadcrumbs */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
              <span>Compartilhamento</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-red-500">{resource.type}</span>
            </div>
            <h2 className="brick-title text-4xl tracking-tighter text-white">{resource.content.name || resource.content.title}</h2>
            <p className="text-zinc-500 text-sm max-w-2xl leading-relaxed">{resource.content.description || 'Nenhuma descrição disponível.'}</p>
          </div>

          {/* Conditional Rendering based on Resource Type */}
          {resource.type === 'video' ? (
            <div className="aspect-video bg-black border border-zinc-800 shadow-2xl">
              <VideoPlayer video={resource.content} isPublic={true} visitorName={visitorName} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {/* Se for projeto ou pasta, listaremos o conteúdo principal aqui */}
               {/* Para o MVP do link, focaremos no vídeo compartilhado. */}
               <div className="col-span-full bg-zinc-900/20 border border-zinc-800 p-12 text-center">
                  <Play className="w-12 h-12 text-red-600 mx-auto mb-4 opacity-50" />
                  <p className="text-zinc-500 text-sm italic">O conteúdo deste compartilamento está pronto para revisão.</p>
               </div>
            </div>
          )}
        </div>
      </main>
      
      <footer className="py-6 border-t border-zinc-900 bg-black/20 text-center">
        <p className="text-[8px] text-zinc-600 uppercase tracking-[0.4em]">Powered by BRICK Systems</p>
      </footer>
    </div>
  );
}
