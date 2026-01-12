import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  Upload, Copy, Archive, Trash2, 
  Image as ImageIcon, ZoomIn, ZoomOut, Move, 
  Share2, Check, Globe, ArrowLeft, Link as LinkIcon, Search
} from 'lucide-react';

export function ProjectSettingsModal({ project, onClose, onProjectUpdate, token }) {
  // Estados de Navegação: 'main', 'cover-selection', 'cover-editor'
  const [viewMode, setViewMode] = useState('main'); 
  
  // Estados do Editor de Capa e Upload
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [settingCoverFromUrl, setSettingCoverFromUrl] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Estados do Projeto e Gerais
  const [projectDetails, setProjectDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [projectName, setProjectName] = useState(project.name);
  const [isRenaming, setIsRenaming] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchProjectDetails();
  }, [project.id]);

  const fetchProjectDetails = async () => {
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setProjectDetails(data);
      setProjectName(data.name);
    } catch (error) {
      console.error('Erro ao buscar detalhes do projeto:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const projectData = projectDetails || project;
  const rootVideos = (projectData.videos || []).filter((v) => v.parent_video_id == null);
  const versionsCount = Math.max(0, (projectData.videos?.length || 0) - rootVideos.length);

  const formatBytes = (bytes) => {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unitIndex = 0;
    let size = value;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    const decimals = unitIndex === 0 ? 0 : unitIndex === 1 ? 0 : 1;
    return `${size.toFixed(decimals)} ${units[unitIndex]}`;
  };

  const projectSizeBytes = rootVideos.reduce((acc, v) => acc + (Number(v.file_size) || 0), 0);
  const projectSizeLabel = formatBytes(projectSizeBytes);

  // --- Funções de Capa ---

  const openGoogleImages = () => {
    const query = `${projectName || projectData.name}${projectData.client_name ? ` ${projectData.client_name}` : ''} wallpaper`;
    window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}&tbs=isz:l`, '_blank', 'noopener,noreferrer');
    toast.info("Copie o endereço da imagem no Google e cole na opção de URL.");
  };

  const handleSetCoverFromUrl = async () => {
    const url = coverImageUrl.trim();
    if (!url) return;

    setSettingCoverFromUrl(true);
    const coverToast = toast.loading('Atualizando imagem de capa...');

    try {
      const response = await fetch(`/api/projects/${project.id}/cover-url`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
      });

      if (response.ok) {
        toast.success('Imagem de capa atualizada!', { id: coverToast });
        await fetchProjectDetails();
        onProjectUpdate();
        setCoverImageUrl('');
        setViewMode('main');
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || 'Erro ao atualizar imagem de capa', { id: coverToast });
      }
    } catch (error) {
      console.error('Erro ao atualizar capa por URL:', error);
      toast.error('Erro ao atualizar imagem de capa', { id: coverToast });
    } finally {
      setSettingCoverFromUrl(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewImage(reader.result);
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      setViewMode('cover-editor'); // Vai para o editor
    };
    reader.readAsDataURL(file);
  };

  // --- Lógica do Editor (Zoom/Pan) ---
  const handleMouseDown = (e) => {
    if (e.target.tagName === 'IMG') {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.5));
  const handleResetTransform = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleCoverUpload = async () => {
    if (!selectedFile) return;

    setUploadingCover(true);
    const uploadToast = toast.loading('Enviando imagem de capa...');
    const formData = new FormData();
    formData.append('cover', selectedFile);
    // Nota: Em uma implementação real de crop, enviaríamos os dados de crop/zoom aqui também
    // ou processaríamos o canvas no cliente antes de enviar.

    try {
      const response = await fetch(`/api/projects/${project.id}/cover`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        toast.success('Imagem de capa atualizada!', { id: uploadToast });
        await fetchProjectDetails();
        onProjectUpdate();
        setPreviewImage(null);
        setSelectedFile(null);
        setViewMode('main');
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Erro ao fazer upload', { id: uploadToast });
      }
    } catch (error) {
      console.error('Erro no upload:', error);
      toast.error('Erro ao fazer upload da imagem', { id: uploadToast });
    } finally {
      setUploadingCover(false);
    }
  };

  // --- Funções Gerais do Projeto ---

  const handleDuplicateProject = () => {
    toast.info('Funcionalidade de duplicar projeto em desenvolvimento');
  };

  const handleRename = async () => {
    if (!projectName.trim() || projectName === projectData.name) return;
    setIsRenaming(true);
    const renameToast = toast.loading('Renomeando projeto...');
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: projectName.trim() })
      });

      if (response.ok) {
        toast.success('Projeto renomeado!', { id: renameToast });
        onProjectUpdate();
      } else {
        toast.error('Erro ao renomear', { id: renameToast });
      }
    } catch (error) {
      toast.error('Erro ao renomear', { id: renameToast });
    } finally {
      setIsRenaming(false);
    }
  };

  const handleToggleStatus = async () => {
    try {
      const newStatus = projectData.status === 'active' ? 'inactive' : 'active';
      const statusToast = toast.loading('Alterando status...');
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        toast.success(`Projeto ${newStatus === 'active' ? 'ativado' : 'inativado'}`, { id: statusToast });
        onProjectUpdate();
        onClose();
      } else {
        toast.error('Erro ao alterar status', { id: statusToast });
      }
    } catch (error) {
      toast.error('Erro ao alterar status');
    }
  };

  const handleGenerateShare = async () => {
    setIsGeneratingShare(true);
    const shareToast = toast.loading('Gerando link...');
    try {
      const response = await fetch('/api/shares', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          project_id: project.id,
          access_type: 'comment'
        })
      });

      if (!response.ok) throw new Error('Erro na API');
      const data = await response.json();
      if (!data.token) throw new Error('Token inválido');

      const fullUrl = `${window.location.origin}/share/${data.token}`;
      setShareLink(fullUrl);
      toast.success('Link gerado!', { id: shareToast });
    } catch (err) {
      toast.error('Erro ao gerar link', { id: shareToast });
    } finally {
      setIsGeneratingShare(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    toast.success('Copiado para área de transferência');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteProject = async () => {
    if (!confirm(`Tem certeza que deseja excluir "${projectData.name}"?`)) return;
    const deleteToast = toast.loading('Excluindo...');
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success('Projeto excluído', { id: deleteToast });
        onProjectUpdate();
        onClose();
      } else {
        toast.error('Erro ao excluir', { id: deleteToast });
      }
    } catch (error) {
      toast.error('Erro ao excluir', { id: deleteToast });
    }
  };

  // --- RENDERIZADORES DE VIEW ---

  const renderCoverEditor = () => (
    <div className="flex flex-col h-full animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center gap-3 mb-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setViewMode('cover-selection')}
          className="h-8 w-8 rounded-none hover:bg-zinc-800"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h2 className="brick-title text-lg uppercase tracking-tighter">Ajustar Capa</h2>
      </div>

      <div
        className="relative aspect-[4/3] rounded-none overflow-hidden border border-zinc-800 mb-4 bg-zinc-950 cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {previewImage && (
          <img
            src={previewImage}
            alt="Preview"
            className="absolute inset-0 w-full h-full object-contain select-none"
            style={{
              transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
              transition: isDragging ? 'none' : 'transform 0.1s'
            }}
            draggable={false}
          />
        )}
        <div className="absolute top-2 left-2 bg-black/80 text-white text-[10px] font-bold px-2 py-1 uppercase tracking-widest flex items-center gap-2 pointer-events-none">
          <Move className="w-3 h-3" />
          Arraste e Zoom
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="glass-button border border-zinc-800 rounded-none h-8 w-8"
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs text-zinc-400 font-mono min-w-[50px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="glass-button border border-zinc-800 rounded-none h-8 w-8"
            onClick={handleZoomIn}
            disabled={zoom >= 3}
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="glass-button border border-zinc-800 rounded-none h-8 text-[10px] ml-2"
            onClick={handleResetTransform}
          >
            Resetar
          </Button>
        </div>
      </div>

      <div className="flex gap-3 mt-auto">
        <Button
          variant="ghost"
          className="flex-1 glass-button border border-zinc-800 rounded-none"
          onClick={() => setViewMode('cover-selection')}
          disabled={uploadingCover}
        >
          Cancelar
        </Button>
        <Button
          className="flex-1 glass-button-primary border-none rounded-none"
          onClick={handleCoverUpload}
          disabled={uploadingCover}
        >
          {uploadingCover ? 'Salvando...' : 'Confirmar'}
        </Button>
      </div>
    </div>
  );

  const renderCoverSelection = () => (
    <div className="flex flex-col h-full animate-in slide-in-from-right-10 fade-in duration-200">
      <div className="flex items-center gap-3 mb-6">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setViewMode('main')}
          className="h-8 w-8 rounded-none hover:bg-zinc-800"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h2 className="brick-title text-lg uppercase tracking-tighter">Alterar Capa</h2>
      </div>

      <div className="space-y-4">
        {/* Opção 1: Upload */}
        <div className="p-4 border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/50 transition-colors group">
          <label className="cursor-pointer flex items-center gap-4">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            <div className="w-10 h-10 bg-zinc-900 border border-zinc-800 flex items-center justify-center group-hover:border-red-600 transition-colors">
              <Upload className="w-5 h-5 text-zinc-400 group-hover:text-red-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wide">Fazer Upload</h3>
              <p className="text-[10px] text-zinc-500">Do seu computador (JPG, PNG, WebP)</p>
            </div>
          </label>
        </div>

        {/* Opção 2: Google Images */}
        <div 
          onClick={openGoogleImages}
          className="p-4 border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/50 transition-colors group cursor-pointer flex items-center gap-4"
        >
          <div className="w-10 h-10 bg-zinc-900 border border-zinc-800 flex items-center justify-center group-hover:border-blue-500 transition-colors">
            <Search className="w-5 h-5 text-zinc-400 group-hover:text-blue-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wide">Buscar no Google</h3>
            <p className="text-[10px] text-zinc-500">Abre nova aba. Copie o link da imagem.</p>
          </div>
        </div>

        {/* Opção 3: URL */}
        <div className="p-4 border border-zinc-800 bg-zinc-900/30">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-10 h-10 bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <LinkIcon className="w-5 h-5 text-zinc-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wide">Usar URL</h3>
              <p className="text-[10px] text-zinc-500">Cole o link direto da imagem</p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="url"
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              placeholder="https://exemplo.com/imagem.jpg"
              className="flex-1 bg-black border border-zinc-800 text-white px-3 py-2 text-xs focus:border-red-600 outline-none transition-colors rounded-none placeholder:text-zinc-700"
            />
            <Button
              className="glass-button-primary border-none rounded-none h-auto"
              disabled={settingCoverFromUrl || !coverImageUrl.trim()}
              onClick={handleSetCoverFromUrl}
            >
              {settingCoverFromUrl ? '...' : <Check className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMainView = () => (
    <div className="flex flex-col h-full animate-in slide-in-from-left-10 fade-in duration-200">
      <h2 className="brick-title text-xl uppercase tracking-tighter mb-6">Configurações</h2>

      {/* Edição de Nome */}
      <div className="mb-6 space-y-2">
        <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Nome do Projeto</label>
        <div className="flex gap-2">
          <input 
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="flex-1 bg-black border border-zinc-800 text-white px-3 py-2 text-sm focus:border-red-600 outline-none transition-colors rounded-none font-bold uppercase tracking-tighter"
            placeholder="NOME DO PROJETO"
          />
          {projectName !== projectData.name && (
            <Button 
              size="sm" 
              className="glass-button-primary border-none rounded-none px-4 h-auto text-[10px]"
              onClick={handleRename}
              disabled={isRenaming}
            >
              {isRenaming ? '...' : 'OK'}
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 p-4 glass-card rounded-none border border-zinc-800">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400 text-xs uppercase tracking-wider">Itens</span>
            <span className="text-white font-bold text-xs">{rootVideos.length} (+{versionsCount} versões)</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400 text-xs uppercase tracking-wider">Tamanho</span>
            <span className="text-white font-bold text-xs">{projectSizeLabel}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400 text-xs uppercase tracking-wider">Status</span>
            <span className={`font-bold uppercase text-xs ${projectData.status === 'active' ? 'text-green-500' : 'text-zinc-500'}`}>
              {projectData.status === 'active' ? 'Ativo' : 'Inativo'}
            </span>
          </div>
        </div>
      </div>

      {/* Menu Actions */}
      <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar">
        {/* Botão Único para Capa */}
        <Button
          variant="ghost"
          className="w-full justify-start glass-button border border-zinc-800 rounded-none h-10 group"
          onClick={() => setViewMode('cover-selection')}
        >
          <ImageIcon className="w-4 h-4 mr-3 text-zinc-500 group-hover:text-white" />
          Alterar Imagem de Capa
        </Button>

        <Button
          variant="ghost"
          className="w-full justify-start glass-button border border-zinc-800 rounded-none h-10 group"
          onClick={handleDuplicateProject}
        >
          <Copy className="w-4 h-4 mr-3 text-zinc-500 group-hover:text-white" />
          Duplicar Projeto
        </Button>

        <Button
          variant="ghost"
          className="w-full justify-start glass-button border border-zinc-800 rounded-none h-10 group"
          onClick={handleToggleStatus}
        >
          <Archive className="w-4 h-4 mr-3 text-zinc-500 group-hover:text-white" />
          {projectData.status === 'active' ? 'Marcar como Inativo' : 'Marcar como Ativo'}
        </Button>

        {/* Share Section */}
        <div className="pt-4 border-t border-zinc-900 mt-4">
          {!shareLink ? (
            <Button
              variant="outline"
              className="w-full justify-start border-zinc-800 bg-zinc-900/50 hover:bg-blue-600 hover:text-white transition-all rounded-none h-10"
              onClick={handleGenerateShare}
              disabled={isGeneratingShare}
            >
              <Share2 className="w-4 h-4 mr-3" />
              {isGeneratingShare ? 'Gerando...' : 'Gerar Link de Revisão'}
            </Button>
          ) : (
            <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-2 p-2 bg-black border border-zinc-800 rounded-none">
                <Globe className="w-3 h-3 text-blue-500 flex-shrink-0" />
                <input 
                  readOnly 
                  value={shareLink} 
                  className="flex-1 bg-transparent border-none text-[10px] text-zinc-400 font-mono outline-none truncate"
                />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 hover:bg-zinc-800 rounded-none"
                  onClick={copyToClipboard}
                >
                  {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-zinc-500" />}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-zinc-900 flex gap-3">
        <Button
          variant="ghost"
          className="flex-1 glass-button border border-red-900/30 text-red-500 hover:bg-red-500/10 rounded-none h-10"
          onClick={handleDeleteProject}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Excluir
        </Button>
        <Button
          variant="ghost"
          className="flex-1 glass-button border border-zinc-800 rounded-none h-10"
          onClick={onClose}
        >
          Fechar
        </Button>
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="glass-panel p-6 max-w-md w-full mx-4 rounded-none border border-zinc-800 h-auto max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {viewMode === 'main' && renderMainView()}
        {viewMode === 'cover-selection' && renderCoverSelection()}
        {viewMode === 'cover-editor' && renderCoverEditor()}
      </div>
    </div>
  );
}
