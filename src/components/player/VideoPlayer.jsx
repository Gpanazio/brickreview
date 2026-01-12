import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Plyr from 'plyr-react';
import 'plyr-react/plyr.css';
import './VideoPlayer.css'; // Importa o CSS customizado
import { useAuth } from '../../hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft, ChevronRight, MessageSquare, Clock,
  CheckCircle, AlertCircle, History, Reply, CornerDownRight, Download, Share2,
  Pencil, Eraser, Smile, Paperclip, X
} from 'lucide-react';
import { toast } from 'sonner';
import EmojiPicker from 'emoji-picker-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PLYR_OPTIONS = {
  controls: [
    'play-large', 'play', 'progress', 'current-time',
    'mute', 'volume', 'captions', 'settings', 'pip', 'fullscreen'
  ],
  keyboard: { focused: true, global: true },
  tooltips: { controls: true, seek: true },
  debug: true, // Enable debug logs
  loadSprite: false, // Avoid loading external sprite
  blankVideo: '' // Prevent blank video loading issues
};

export function VideoPlayer({
  video,
  versions = [],
  onBack,
  isPublic = false,
  visitorName: initialVisitorName = '',
  shareToken = null,
  sharePassword = null,
  accessType = 'view',
}) {
  // Determina a versão inicial (mais recente) ao montar o componente
  const getLatestVersion = useCallback(() => {
    if (versions.length === 0) return video;
    // Encontra a versão com maior version_number
    const sorted = [video, ...versions].sort((a, b) => b.version_number - a.version_number);
    return sorted[0];
  }, [video, versions]);

  const latestVersion = useMemo(() => getLatestVersion(), [getLatestVersion]);

  const [currentVideoId, setCurrentVideoId] = useState(latestVersion.id);
  const [currentVideo, setCurrentVideo] = useState(latestVersion);
  const [comments, setComments] = useState(latestVersion.comments || []);
  const [newComment, setNewComment] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [approvalStatus, setApprovalStatus] = useState(latestVersion.latest_approval_status || 'pending');
  const [, setIsSubmittingApproval] = useState(false)
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [videoUrl, setVideoUrl] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null); // ID do comentário sendo respondido
  const [replyText, setReplyText] = useState('');
  const [, setShareLink] = useState('')
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const [visitorName, setVisitorName] = useState(initialVisitorName || localStorage.getItem('brickreview_visitor_name') || '');
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingMode, setDrawingMode] = useState(false); // Se está no modo desenho
  const [drawColor, setDrawColor] = useState('#FF0000');
  const [drawings, setDrawings] = useState([]); // Desenhos salvos por timestamp
  const [currentDrawing, setCurrentDrawing] = useState([]); // Pontos do desenho atual
  const [hasTimestamp, setHasTimestamp] = useState(true); // Se o comentário tem timestamp
  const [showEmojiPicker, setShowEmojiPicker] = useState(false); // Controla exibição do emoji picker
  const [, setIsLoadingVideo] = useState(false) // Loading ao trocar versão
  const playerRef = useRef(null);
  const canvasRef = useRef(null);
  const videoContainerRef = useRef(null);
  const { token } = useAuth();

  // Guest mode: no token, use visitor name for identification
  const isGuest = isPublic || !token;
  const canComment = isGuest ? (accessType === 'comment') : true;
  const canApprove = !isGuest; // Only authenticated users can approve
  const canShare = !isGuest; // Only authenticated users can generate share links
  const canDownload = !isGuest; // Only authenticated users can download

  // Constrói lista completa de versões (vídeo original + versões)
  // Ordena da versão mais recente para a mais antiga
  const allVersions = [video, ...versions].sort((a, b) => b.version_number - a.version_number);

  // Calcula aspect ratio do vídeo
  const getAspectRatioClass = () => {
    if (!currentVideo.width || !currentVideo.height) {
      return 'aspect-video'; // fallback para 16:9
    }

    const ratio = currentVideo.width / currentVideo.height;

    // Horizontal (>= 16:9)
    if (ratio >= 1.7) return 'aspect-video';
    // Quase horizontal (>= 4:3)
    if (ratio >= 1.3) return 'aspect-[4/3]';
    // Quadrado (~1:1)
    if (ratio >= 0.9 && ratio <= 1.1) return 'aspect-square';
    // Vertical (9:16 e similares)
    if (ratio <= 0.6) return 'aspect-[9/16]';
    // Outros verticais
    return 'aspect-[3/4]';
  };

  const getMaxHeightClass = () => {
    if (!currentVideo.width || !currentVideo.height) {
      return 'max-h-[70vh]';
    }

    const ratio = currentVideo.width / currentVideo.height;

    // Vertical: limita altura e largura
    if (ratio < 1) return 'max-h-[85vh] max-w-[45vh]';
    // Horizontal: sem limite específico
    return 'max-h-[70vh]';
  };

  // Use precise FPS from metadata, fallback to 30 if not available
  const videoFPS = currentVideo.fps || 30;
  const frameTime = 1 / videoFPS;

  const videoSource = useMemo(() => {
    if (!videoUrl) return null;
    console.log('[VideoPlayer] Creating video source:', {
      url: videoUrl,
      mimeType: currentVideo.mime_type
    });
    return {
      type: 'video',
      preload: 'auto',
      sources: [
        {
          src: videoUrl,
          type: currentVideo.mime_type || 'video/mp4'
        }
      ]
    };
  }, [videoUrl, currentVideo.mime_type]);

  const addComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    // Guests can only comment if access_type is 'comment'
    if (isGuest && !canComment) {
      toast.error('Você não tem permissão para comentar');
      return;
    }

    // Guests must provide a name
    if (isGuest && !visitorName.trim()) {
      toast.error('Por favor, informe seu nome');
      return;
    }

    try {
      // Save visitor name to localStorage for future visits
      if (isGuest && visitorName.trim()) {
        localStorage.setItem('brickreview_visitor_name', visitorName.trim());
      }

      // Use different endpoint for guest comments
      const endpoint = isGuest ? `/api/shares/${shareToken}/comments` : '/api/comments'
      const headers = {
        'Content-Type': 'application/json',
      }

      if (isGuest && sharePassword) {
        headers['x-share-password'] = sharePassword
      }

      if (!isGuest) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const body = {
        video_id: currentVideoId,
        content: newComment,
        timestamp: hasTimestamp ? currentTime : null
      };

      if (isGuest) {
        body.visitor_name = visitorName;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (response.ok) {
        const comment = await response.json();
        setComments([...comments, comment].sort((a, b) => a.timestamp - b.timestamp));
        setNewComment('');
        toast.success('Comentário adicionado com sucesso!');
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Erro ao adicionar comentário');
      }
    } catch (error) {
      console.error('Erro ao adicionar comentário:', error);
      toast.error('Erro ao adicionar comentário');
    }
  };

  const addReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !replyingTo) return;

    // Guests can only reply if access_type is 'comment'
    if (isGuest && !canComment) {
      toast.error('Você não tem permissão para responder');
      return;
    }

    // Guests must provide a name
    if (isGuest && !visitorName.trim()) {
      toast.error('Por favor, informe seu nome');
      return;
    }

    try {
      // Save visitor name to localStorage for future visits
      if (isGuest && visitorName.trim()) {
        localStorage.setItem('brickreview_visitor_name', visitorName.trim());
      }
      // Use different endpoint for guest replies
      const endpoint = isGuest ? `/api/shares/${shareToken}/comments` : '/api/comments'
      const headers = {
        'Content-Type': 'application/json',
      }

      if (isGuest && sharePassword) {
        headers['x-share-password'] = sharePassword
      }

      if (!isGuest) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const body = {
        video_id: currentVideoId,
        content: replyText,
        timestamp: currentTime,
        parent_comment_id: replyingTo
      };

      if (isGuest) {
        body.visitor_name = visitorName;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (response.ok) {
        const reply = await response.json();
        setComments([...comments, reply]);
        setReplyText('');
        setReplyingTo(null);
        toast.success('Resposta adicionada com sucesso!');
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Erro ao adicionar resposta');
      }
    } catch (error) {
      console.error('Erro ao adicionar resposta:', error);
      toast.error('Erro ao adicionar resposta');
    }
  };

  // Organiza comentários em threads (pais e respostas)
  const organizeComments = () => {
    const parentComments = comments.filter(c => !c.parent_comment_id);
    return parentComments
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(parent => ({
        ...parent,
        replies: comments
          .filter(c => c.parent_comment_id === parent.id)
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      }));
  };

  const seekTo = (time) => {
    if (playerRef.current?.plyr) {
      playerRef.current.plyr.currentTime = time;
      playerRef.current.plyr.play();
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleApproval = async (status) => {
    setIsSubmittingApproval(true);
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          video_id: currentVideoId,
          status,
          notes: status === 'approved' ? 'Aprovado pelo cliente' : 'Ajustes solicitados pelo cliente'
        })
      });

      if (response.ok) {
        setApprovalStatus(status);
        fetchHistory();
      }
    } catch (error) {
      console.error('Erro ao processar aprovação:', error);
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch(`/api/reviews/${currentVideoId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setHistory(data);
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
    }
  };

  useEffect(() => {
    if (showHistory) fetchHistory();
  }, [showHistory]);

  // Função para trocar de versão
  const handleVersionChange = (versionId) => {
    if (versionId === currentVideoId) return;

    setIsLoadingVideo(true);
    setVideoUrl(null); // Limpa URL atual para forçar loading
    setCurrentVideoId(versionId);
    const selectedVersion = allVersions.find(v => v.id === versionId);
    if (selectedVersion) {
      setCurrentVideo(selectedVersion);
      setApprovalStatus(selectedVersion.latest_approval_status || 'pending');
    }
  };

  // Carrega comentários quando a versão muda
  useEffect(() => {
    const fetchComments = async () => {
      try {
        // Use endpoint público para guests, privado para usuários autenticados
        const endpoint = isGuest
          ? `/api/shares/${shareToken}/comments/video/${currentVideoId}`
          : `/api/comments/video/${currentVideoId}`;

        const headers = isGuest
          ? (sharePassword ? { 'x-share-password': sharePassword } : {})
          : { 'Authorization': `Bearer ${token}` }

        const response = await fetch(endpoint, { headers });
        if (response.ok) {
          const data = await response.json();
          setComments(data.sort((a, b) => a.timestamp - b.timestamp));
        }
      } catch (error) {
        console.error('Erro ao carregar comentários:', error);
      }
    };

    fetchComments();
  }, [currentVideoId, token, isGuest, shareToken]);

  // Carrega desenhos quando a versão muda
  useEffect(() => {
    const fetchDrawings = async () => {
      try {
        // Use endpoint público para guests, privado para usuários autenticados
        const endpoint = isGuest
          ? `/api/shares/${shareToken}/drawings/video/${currentVideoId}`
          : `/api/drawings/video/${currentVideoId}`;

        const headers = isGuest
          ? (sharePassword ? { 'x-share-password': sharePassword } : {})
          : { 'Authorization': `Bearer ${token}` }

        const response = await fetch(endpoint, { headers });
        if (response.ok) {
          const data = await response.json();
          // Converte os dados do banco para o formato esperado
          const formattedDrawings = data.map(d => ({
            id: d.id,
            timestamp: parseFloat(d.timestamp),
            points: d.drawing_data,
            color: d.color
          }));
          setDrawings(formattedDrawings);
        }
      } catch (error) {
        console.error('Erro ao carregar desenhos:', error);
      }
    };

    fetchDrawings();
  }, [currentVideoId, token, isGuest, shareToken]);

  // Função para fazer download do vídeo (proxy ou original)
  const handleDownload = async (type) => {
    try {
      const response = await fetch(`/api/videos/${currentVideoId}/download?type=${type}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();

        // Força download usando fetch + blob ao invés de link direto
        const videoResponse = await fetch(data.url);
        const blob = await videoResponse.blob();
        const blobUrl = window.URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = data.filename || `${currentVideo.title}_${type}.mp4`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();

        // Cleanup
        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        }, 100);
      }
    } catch (error) {
      console.error('Erro ao fazer download:', error);
    }
  };

  // Função para gerar link de compartilhamento do vídeo
  const handleGenerateShare = async () => {
    setIsGeneratingShare(true);
    const shareToast = toast.loading('Gerando link de compartilhamento...');

    try {
      const response = await fetch('/api/shares', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          video_id: currentVideoId,
          access_type: 'comment' // Convidados podem comentar
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        toast.error(errorData.error || 'Erro ao gerar link', { id: shareToast });
        return;
      }

      const data = await response.json();

      if (!data.token) {
        toast.error('Token de compartilhamento não recebido', { id: shareToast });
        return;
      }

      const fullUrl = `${window.location.origin}/share/${data.token}`;
      setShareLink(fullUrl);

      // Copia para clipboard
      try {
        await navigator.clipboard.writeText(fullUrl);
        toast.success('Link copiado para área de transferência!', { id: shareToast });
      } catch (clipboardError) {
        // Fallback: cria input temporário e usa execCommand
        console.warn('Clipboard API bloqueada, usando fallback:', clipboardError);

        const input = document.createElement('textarea');
        input.value = fullUrl;
        input.style.position = 'fixed';
        input.style.left = '-9999px';
        input.style.top = '0';
        document.body.appendChild(input);
        input.focus();
        input.select();
        input.setSelectionRange(0, 99999);

        try {
          const successful = document.execCommand('copy');
          if (successful) {
            toast.success('Link copiado para área de transferência!', { id: shareToast });
          } else {
            throw new Error('execCommand falhou');
          }
        } catch {
          prompt('Copie o link de compartilhamento:', fullUrl);
          toast.success('Link gerado com sucesso!', { id: shareToast });
        }

        document.body.removeChild(input);
      }
    } catch (error) {
      console.error('Erro ao gerar link:', error);
      toast.error('Erro ao gerar link de compartilhamento', { id: shareToast });
    } finally {
      setIsGeneratingShare(false);
    }
  };

  useEffect(() => {
    const fetchStreamUrl = async () => {
      console.log('[VideoPlayer] Fetching stream URL for video:', currentVideoId);
      try {
        // Use endpoint público para guests, privado para usuários autenticados
        const endpoint = isGuest
          ? `/api/shares/${shareToken}/video/${currentVideoId}/stream`
          : `/api/videos/${currentVideoId}/stream`;

        const headers = isGuest
          ? (sharePassword ? { 'x-share-password': sharePassword } : {})
          : { 'Authorization': `Bearer ${token}` }

        const response = await fetch(endpoint, { headers });
        if (response.ok) {
          const data = await response.json();
          console.log('[VideoPlayer] Stream URL received:', data.url);
          if (data.url) {
            setVideoUrl(data.url);
          } else {
            console.error('[VideoPlayer] URL de streaming não recebida');
          }
        } else {
          console.error('[VideoPlayer] Erro ao buscar URL de streaming:', response.status);
        }
      } catch (error) {
        console.error('[VideoPlayer] Erro ao obter URL de streaming:', error);
      } finally {
        setIsLoadingVideo(false);
      }
    };

    if (currentVideoId) {
      setIsLoadingVideo(true);
      fetchStreamUrl();
    }
  }, [currentVideoId, token, isGuest, shareToken]);

  // Polling para atualizar currentTime caso o evento não dispare
  useEffect(() => {
    const interval = setInterval(() => {
      if (playerRef.current?.plyr?.currentTime !== undefined) {
        setCurrentTime(playerRef.current.plyr.currentTime);
      }
    }, 100); // Atualiza a cada 100ms

    return () => clearInterval(interval);
  }, []);

>>>>>>


  // Canvas drawing handlers
  const startDrawing = (e) => {
    if (!drawingMode) return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setCurrentDrawing([{ x, y }]);
  };

  const draw = (e) => {
    if (!isDrawing || !drawingMode) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setCurrentDrawing([...currentDrawing, { x, y }]);
  };

  const stopDrawing = async () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentDrawing.length > 0) {
      // Salva o desenho localmente primeiro
      const newDrawing = {
        timestamp: currentTime,
        points: currentDrawing,
        color: drawColor,
        id: Date.now()
      };
      setDrawings([...drawings, newDrawing]);

      // Salva no backend (apenas para usuários autenticados)
      if (!isGuest) {
        const saveToast = toast.loading('Salvando desenho...');
        try {
          const response = await fetch('/api/drawings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              video_id: currentVideoId,
              timestamp: currentTime,
              drawing_data: currentDrawing,
              color: drawColor
            })
          });

          if (response.ok) {
            toast.success('Desenho salvo com sucesso!', { id: saveToast });
            setCurrentDrawing([]);
            setDrawingMode(false); // Desativa modo desenho automaticamente
          } else {
            toast.error('Erro ao salvar desenho', { id: saveToast });
          }
        } catch (error) {
          console.error('Erro ao salvar desenho:', error);
          toast.error('Erro ao salvar desenho', { id: saveToast });
        }
      } else {
        setCurrentDrawing([]);
      }
    }
  };

  const clearDrawing = () => {
    setCurrentDrawing([]);
    setDrawings(drawings.filter(d => Math.abs(d.timestamp - currentTime) > 0.1));
  };

  // Renderiza os desenhos no canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const container = videoContainerRef.current;
    if (!container) return;

    // Ajusta o tamanho do canvas para o container
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;

    // Limpa o canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Desenha os desenhos salvos para o timestamp atual
    const currentDrawings = drawings.filter(d => Math.abs(d.timestamp - currentTime) < 0.1);
    currentDrawings.forEach(drawing => {
      ctx.strokeStyle = drawing.color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      drawing.points.forEach((point, i) => {
        const x = point.x * canvas.width;
        const y = point.y * canvas.height;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    });

    // Desenha o desenho atual (em progresso)
    if (currentDrawing.length > 0) {
      ctx.strokeStyle = drawColor;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      currentDrawing.forEach((point, i) => {
        const x = point.x * canvas.width;
        const y = point.y * canvas.height;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    }
  }, [drawings, currentDrawing, currentTime, drawColor]);

  return (
    <div className="flex h-full bg-[#050505] overflow-hidden">
      {/* Área do Player */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-4 border-b border-zinc-800/50 glass-panel flex items-center gap-4">
          <button onClick={onBack} className="text-zinc-500 hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="brick-title text-lg tracking-tighter uppercase truncate">{video.title}</h2>
          
          <div className="flex items-center gap-2 ml-auto">
            {/* Approval Button - Only for authenticated users */}
            {canApprove && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`rounded-none border px-3 h-8 text-[10px] font-black uppercase tracking-widest transition-all ${
                      approvalStatus === 'approved' ? 'border-green-500/50 text-green-500 bg-green-500/10' :
                      approvalStatus === 'changes_requested' ? 'border-amber-500/50 text-amber-500 bg-amber-500/10' :
                      'border-zinc-700 text-zinc-400 bg-zinc-900'
                    }`}
                  >
                    {approvalStatus === 'approved' ? <CheckCircle className="w-3 h-3 mr-2" /> :
                     approvalStatus === 'changes_requested' ? <AlertCircle className="w-3 h-3 mr-2" /> : null}
                    {approvalStatus === 'approved' ? 'Aprovado' :
                     approvalStatus === 'changes_requested' ? 'Ajustes' : 'Pendente'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-zinc-950 border-zinc-800 rounded-none w-48">
                  <DropdownMenuItem
                    onClick={() => handleApproval('approved')}
                    className="text-green-500 focus:text-green-400 focus:bg-green-500/10 rounded-none cursor-pointer font-bold text-[10px] uppercase tracking-widest"
                  >
                    <CheckCircle className="w-3 h-3 mr-2" /> Aprovar Vídeo
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleApproval('changes_requested')}
                    className="text-amber-500 focus:text-amber-400 focus:bg-amber-500/10 rounded-none cursor-pointer font-bold text-[10px] uppercase tracking-widest"
                  >
                    <AlertCircle className="w-3 h-3 mr-2" /> Solicitar Ajustes
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* History Button - Available for all users */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowHistory(!showHistory)}
              className={`h-8 w-8 rounded-none border border-zinc-800 ${showHistory ? 'bg-red-600 text-white border-red-600' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}
            >
              <History className="w-4 h-4" />
            </Button>

            {/* Share Button - Only for authenticated users */}
            {canShare && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleGenerateShare}
                disabled={isGeneratingShare}
                className="h-8 w-8 rounded-none border border-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
              </Button>
            )}

            {/* Download Menu - Only for authenticated users */}
            {canDownload && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-none border border-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-800"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-zinc-950 border-zinc-800 rounded-none w-56">
                  <DropdownMenuItem
                    onClick={() => handleDownload('proxy')}
                    className="text-zinc-400 focus:text-white focus:bg-zinc-800 rounded-none cursor-pointer font-bold text-[10px] uppercase tracking-widest"
                  >
                    <Download className="w-3 h-3 mr-2" />
                    Baixar Proxy (720p)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDownload('original')}
                    className="text-zinc-400 focus:text-white focus:bg-zinc-800 rounded-none cursor-pointer font-bold text-[10px] uppercase tracking-widest"
                  >
                    <Download className="w-3 h-3 mr-2" />
                    Baixar Original (HD)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Version Selector */}
            {allVersions.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 h-8 flex items-center gap-2 rounded-none"
                  >
                    <History className="w-3 h-3" />
                    v{currentVideo.version_number}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-zinc-950 border-zinc-800 rounded-none w-56">
                  {allVersions.map((v) => (
                    <DropdownMenuItem
                      key={v.id}
                      onClick={() => handleVersionChange(v.id)}
                      className={`rounded-none cursor-pointer font-bold text-[10px] uppercase tracking-widest ${
                        v.id === currentVideoId
                          ? 'text-red-500 bg-red-500/10'
                          : 'text-zinc-400 focus:text-white focus:bg-zinc-800'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span>Versão {v.version_number}</span>
                        {v.id === currentVideoId && <CheckCircle className="w-3 h-3" />}
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Version badge when only one version */}
            {allVersions.length === 1 && (
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-900 border border-zinc-800 px-2 py-1.5 h-8 flex items-center">
                v{currentVideo.version_number}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 bg-black flex items-center justify-center p-8">
          <div
            ref={videoContainerRef}
            className={`relative w-full ${currentVideo.width && currentVideo.height && (currentVideo.width / currentVideo.height) >= 1 ? 'max-w-5xl' : ''} ${getAspectRatioClass()} ${getMaxHeightClass()} shadow-2xl ring-1 ring-white/10`}
          >
            {videoSource ? (
              <div key={`player-${currentVideoId}-${videoUrl}`} className="relative w-full h-full">
                <Plyr
                  ref={playerRef}
                  source={videoSource}
                  options={{
                    ...PLYR_OPTIONS,
                    autoplay: false,
                  }}
                />
                {/* Canvas overlay for drawing */}
                <canvas
                  ref={canvasRef}
                  className={`absolute top-0 left-0 w-full h-full pointer-events-none ${drawingMode ? 'pointer-events-auto cursor-crosshair' : ''}`}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  style={{ zIndex: drawingMode ? 10 : 1 }}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-zinc-400">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                <span className="text-xs font-bold uppercase tracking-[0.2em]">A carregar stream...</span>
              </div>
            )}
          </div>
        </div>

        {/* Barra de Controles Customizados (Frame by Frame) */}
        <div className="p-4 border-t border-zinc-800/50 glass-panel flex items-center justify-center gap-8">
          <Button
            variant="ghost"
            size="sm"
            className="text-zinc-500 hover:text-white"
            onClick={() => { if (playerRef.current?.plyr) playerRef.current.plyr.currentTime -= frameTime }}
          >
            <ChevronLeft className="w-4 h-4 mr-2" /> -1 FRAME
          </Button>
          <div className="brick-tech text-red-600 font-bold text-xl tabular-nums">
            {formatTime(currentTime)}
            <div className="text-[10px] text-zinc-600 tracking-widest font-bold uppercase text-center mt-1">
              {videoFPS} FPS
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-zinc-500 hover:text-white"
            onClick={() => { if (playerRef.current?.plyr) playerRef.current.plyr.currentTime += frameTime }}
          >
            +1 FRAME <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* Barra Lateral de Comentários / Histórico */}
      <div className="w-96 border-l border-zinc-800/50 glass-panel flex flex-col relative z-20">
        <div className="p-6 border-b border-zinc-800/50 flex items-center justify-between">
          <h3 className="brick-title text-sm uppercase tracking-widest flex items-center gap-2 text-white">
            {showHistory ? (
              <><History className="w-4 h-4 text-red-600" /> Histórico</>
            ) : (
              <><MessageSquare className="w-4 h-4 text-red-600" /> Comentários ({comments.length})</>
            )}
          </h3>
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="text-[10px] font-black uppercase tracking-tighter text-zinc-500 hover:text-white transition-colors"
          >
            {showHistory ? 'Ver Comentários' : 'Ver Histórico'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {showHistory ? (
            history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-600 italic text-sm text-center px-8">
                Nenhum histórico registrado ainda.
              </div>
            ) : (
              history.map((item) => (
                <div key={item.id} className="glass-card p-4 border-l-2 border-l-zinc-800">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${
                      item.status === 'approved' ? 'bg-green-500' : 'bg-amber-500'
                    }`} />
                    <span className={`text-[10px] font-black uppercase tracking-widest ${
                      item.status === 'approved' ? 'text-green-500' : 'text-amber-500'
                    }`}>
                      {item.status === 'approved' ? 'Aprovado' : 'Ajustes'}
                    </span>
                  </div>
                  <p className="text-xs text-white font-medium mb-1">{item.notes}</p>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 uppercase font-bold tracking-widest">
                    <span>{item.username}</span>
                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )
          ) : (
            comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-zinc-600 italic text-sm text-center px-8">
                Nenhum comentário ainda. Vá para um frame específico e comece a discussão.
              </div>
            ) : (
              organizeComments().map((comment) => (
                <div key={comment.id} className="space-y-2">
                  {/* Comentário Principal */}
                  <div
                    className="group glass-card p-3 border-l-2 border-l-transparent hover:border-l-red-600 transition-all"
                  >
                    <div
                      className="cursor-pointer"
                      onClick={() => seekTo(comment.timestamp)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black text-red-600 uppercase tracking-tighter">
                          {formatTime(comment.timestamp)}
                        </span>
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                          {comment.username}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-300 leading-relaxed">{comment.content}</p>
                    </div>

                    {/* Botão de Responder - disponível para todos */}
                    {canComment && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setReplyingTo(replyingTo === comment.id ? null : comment.id);
                        }}
                        className="mt-2 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-zinc-600 hover:text-red-500 transition-colors"
                      >
                        <Reply className="w-3 h-3" />
                        {replyingTo === comment.id ? 'Cancelar' : 'Responder'}
                      </button>
                    )}

                    {/* Input de Resposta */}
                    {replyingTo === comment.id && (
                      <form onSubmit={addReply} className="mt-3 space-y-2">
                        {/* Guest name input for replies */}
                        {isGuest && canComment && (
                          <input
                            type="text"
                            value={visitorName}
                            onChange={(e) => setVisitorName(e.target.value)}
                            placeholder="Seu nome"
                            className="w-full bg-[#0a0a0a] border border-zinc-800 px-3 py-2 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-red-600/50 transition-colors"
                            required={isGuest}
                          />
                        )}
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Escreva sua resposta..."
                          className="w-full bg-[#0a0a0a] border border-zinc-800 p-2 text-xs text-white focus:outline-none focus:border-red-600 transition-colors resize-none h-16"
                          autoFocus
                        />
                        <button
                          type="submit"
                          disabled={!replyText.trim()}
                          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-[10px] font-black uppercase tracking-widest py-2 transition-colors"
                        >
                          Enviar Resposta
                        </button>
                      </form>
                    )}
                  </div>

                  {/* Respostas */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="ml-4 space-y-2 border-l-2 border-zinc-800/50 pl-3">
                      {comment.replies.map((reply) => (
                        <div
                          key={reply.id}
                          className="glass-card p-3 bg-zinc-900/30"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <CornerDownRight className="w-3 h-3 text-zinc-600" />
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                              {reply.username}
                            </span>
                            <span className="text-[9px] text-zinc-600">
                              {new Date(reply.created_at).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          <p className="text-sm text-zinc-400 leading-relaxed">{reply.content}</p>

                          {/* Botão de responder também nas respostas */}
                          {canComment && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setReplyingTo(replyingTo === comment.id ? null : comment.id);
                                setReplyText(`@${reply.username} `);
                              }}
                              className="mt-2 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-zinc-600 hover:text-red-500 transition-colors"
                            >
                              <Reply className="w-3 h-3" />
                              Responder
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )
          )}
        </div>

        {/* Input de Novo Comentário */}
        {!showHistory && (
          <div className="p-4 border-t border-zinc-800/50 bg-white/5">
            <form onSubmit={addComment} className="flex flex-col gap-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-between">
                {hasTimestamp ? (
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Clock className="w-3 h-3" />
                    <span className="text-red-500">{formatTime(currentTime)}</span>
                  </div>
                ) : (
                  <div className="text-zinc-500">
                    Comentário geral (sem timestamp)
                  </div>
                )}
                <span className="text-zinc-600">Deixe seu comentário...</span>
              </div>

              {/* Guest name input - discreto e inline */}
              {isGuest && canComment && (
                <input
                  type="text"
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full bg-[#0a0a0a] border border-zinc-800 px-3 py-2 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-red-600/50 transition-colors"
                  required={isGuest}
                />
              )}

              <div className="relative">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={isGuest ? "Escreva seu comentário..." : "Escreva seu feedback..."}
                  className="w-full bg-[#0a0a0a] border border-zinc-800 p-3 pb-12 text-sm text-white focus:outline-none focus:border-red-600 transition-colors resize-none h-24"
                  disabled={isGuest && !canComment}
                />

                {/* Toolbar de ações */}
                <div className="absolute bottom-0 left-0 right-0 border-t border-zinc-800 bg-[#0a0a0a] p-2 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {/* Timestamp toggle */}
                    <button
                      type="button"
                      className={`p-2 rounded-sm transition-colors ${
                        hasTimestamp
                          ? 'text-red-500 bg-red-500/10'
                          : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                      }`}
                      onClick={() => setHasTimestamp(!hasTimestamp)}
                      title={hasTimestamp ? "Remover timestamp" : "Adicionar timestamp"}
                    >
                      {hasTimestamp ? <Clock className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    </button>

                    {/* Attachment */}
                    <button
                      type="button"
                      className="p-2 rounded-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                      title="Anexar arquivo"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>

                    {/* Emoji picker */}
                    <div className="relative">
                      <button
                        type="button"
                        className={`p-2 rounded-sm transition-colors ${
                          showEmojiPicker
                            ? 'text-yellow-500 bg-yellow-500/10'
                            : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                        }`}
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        title="Adicionar emoji"
                      >
                        <Smile className="w-4 h-4" />
                      </button>

                      {showEmojiPicker && (
                        <div className="absolute bottom-full left-0 mb-2 z-50">
                          <EmojiPicker
                            onEmojiClick={(emojiData) => {
                              setNewComment(newComment + emojiData.emoji);
                              setShowEmojiPicker(false);
                            }}
                            theme="dark"
                            width={300}
                            height={400}
                          />
                        </div>
                      )}
                    </div>

                    {/* Drawing tool */}
                    <button
                      type="button"
                      className={`p-2 rounded-sm transition-colors ${
                        drawingMode
                          ? 'text-red-500 bg-red-500/10'
                          : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                      }`}
                      onClick={() => setDrawingMode(!drawingMode)}
                      title="Desenhar no frame"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    {/* Color picker - only when drawing mode is active */}
                    {drawingMode && (
                      <>
                        {['#FF0000', '#FFA500', '#FFFF00', '#00FF00', '#0000FF', '#FFFFFF'].map(color => (
                          <button
                            key={color}
                            type="button"
                            className={`w-6 h-6 rounded-sm border transition-all ${
                              drawColor === color ? 'border-white scale-110' : 'border-zinc-700 hover:border-zinc-500'
                            }`}
                            style={{ backgroundColor: color }}
                            onClick={() => setDrawColor(color)}
                            title={`Cor: ${color}`}
                          />
                        ))}

                        <button
                          type="button"
                          className="p-2 rounded-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors ml-1"
                          onClick={clearDrawing}
                          title="Limpar desenho"
                        >
                          <Eraser className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Send button */}
                  <button
                    type="submit"
                    disabled={!newComment.trim() || (isGuest && !canComment)}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-sm transition-colors"
                  >
                    Enviar
                  </button>
                </div>
              </div>

              {isGuest && !canComment && (
                <p className="text-xs text-zinc-600 italic">Este compartilhamento é somente visualização.</p>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
