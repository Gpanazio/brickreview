import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Upload, Copy, Archive, Trash2, Image as ImageIcon, ZoomIn, ZoomOut, Move, Share2, Check, Globe } from 'lucide-react';

export function ProjectSettingsModal({ project, onClose, onProjectUpdate, token }) {
  const [showCoverEditor, setShowCoverEditor] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
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
  const projectSize = projectData.videos?.reduce((acc, v) => acc + (v.file_size || 0), 0) || 0;
  const projectSizeGB = (projectSize / (1024 * 1024 * 1024)).toFixed(2);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewImage(reader.result);
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      setShowCoverEditor(true);
    };
    reader.readAsDataURL(file);
  };

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

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.1, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.1, 0.5));
  };

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

    try {
      const response = await fetch(`/api/projects/${project.id}/cover`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        toast.success('Imagem de capa atualizada!', { id: uploadToast });
        await fetchProjectDetails(); // Atualiza detalhes no modal
        onProjectUpdate(); // Atualiza lista de projetos
        setShowCoverEditor(false);
        setPreviewImage(null);
        setSelectedFile(null);
        onClose();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Erro ao fazer upload da imagem de capa', { id: uploadToast });
      }
    } catch (error) {
      console.error('Erro ao fazer upload da imagem de capa:', error);
      toast.error('Erro ao fazer upload da imagem de capa', { id: uploadToast });
    } finally {
      setUploadingCover(false);
    }
  };

  const handleCancelEditor = () => {
    setShowCoverEditor(false);
    setPreviewImage(null);
    setSelectedFile(null);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleDuplicateProject = async () => {
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
        toast.success('Projeto renomeado com sucesso!', { id: renameToast });
        onProjectUpdate();
      } else {
        toast.error('Erro ao renomear projeto', { id: renameToast });
      }
    } catch (error) {
      console.error('Erro ao renomear:', error);
      toast.error('Erro ao renomear projeto', { id: renameToast });
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
        toast.success(`Projeto marcado como ${newStatus === 'active' ? 'ativo' : 'inativo'}`, { id: statusToast });
        onProjectUpdate();
        onClose();
      } else {
        toast.error('Erro ao alterar status do projeto', { id: statusToast });
      }
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao alterar status do projeto');
    }
  };

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
          project_id: project.id,
          access_type: 'comment'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        toast.error(errorData.error || 'Erro ao gerar link', { id: shareToast });
        return;
      }

      const data = await response.json();
      console.log('Share data received:', data); // Debug

      // Garante que temos um token válido
      if (!data.token) {
        toast.error('Token de compartilhamento não recebido', { id: shareToast });
        return;
      }

      const fullUrl = `${window.location.origin}/share/${data.token}`;
      console.log('Generated share URL:', fullUrl); // Debug
      setShareLink(fullUrl);
      toast.success('Link de revisão gerado!', { id: shareToast });
    } catch (err) {
      console.error('Erro ao gerar link:', err);
      toast.error('Erro ao gerar link de compartilhamento', { id: shareToast });
    } finally {
      setIsGeneratingShare(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    toast.success('Link copiado para a área de transferência');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteProject = async () => {
    if (!confirm(`Tem certeza que deseja excluir o projeto "${projectData.name}"? Esta ação não pode ser desfeita.`)) return;

    const deleteToast = toast.loading('Excluindo projeto...');
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success('Projeto excluído com sucesso', { id: deleteToast });
        onProjectUpdate();
        onClose();
      } else {
        toast.error('Erro ao excluir projeto', { id: deleteToast });
      }
    } catch (error) {
      console.error('Erro ao excluir projeto:', error);
      toast.error('Erro ao excluir projeto', { id: deleteToast });
    }
  };

  if (showCoverEditor) {
    return (
      <div
        className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50"
        onClick={handleCancelEditor}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <div
          className="glass-panel p-6 max-w-2xl w-full mx-4 rounded-none border border-zinc-800"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="brick-title text-xl uppercase tracking-tighter mb-4">Editor de Imagem de Capa</h2>

          {/* Preview com controles de zoom e posição */}
          <div
            className="relative aspect-[4/3] rounded-none overflow-hidden border border-zinc-800 mb-4 bg-zinc-950 cursor-move"
            onMouseDown={handleMouseDown}
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
            <div className="absolute top-2 left-2 bg-black/80 text-white text-[10px] font-bold px-2 py-1 uppercase tracking-widest flex items-center gap-2">
              <Move className="w-3 h-3" />
              Arraste para posicionar
            </div>
          </div>

          {/* Controles */}
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
              <span className="text-xs text-zinc-400 font-mono min-w-[60px] text-center">
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
                className="glass-button border border-zinc-800 rounded-none h-8 text-xs"
                onClick={handleResetTransform}
              >
                Resetar
              </Button>
            </div>
          </div>

          {/* Botões de ação */}
          <div className="flex gap-3">
            <Button
              variant="ghost"
              className="flex-1 glass-button border border-zinc-800 rounded-none"
              onClick={handleCancelEditor}
              disabled={uploadingCover}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 glass-button-primary border-none rounded-none"
              onClick={handleCoverUpload}
              disabled={uploadingCover}
            >
              {uploadingCover ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin mr-2" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Confirmar Upload
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="glass-panel p-6 max-w-md w-full mx-4 rounded-none border border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="brick-title text-xl uppercase tracking-tighter mb-6">Configurações do Projeto</h2>

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

        {/* Informações do Projeto */}
        <div className="mb-6 p-4 glass-card rounded-none border border-zinc-800">
          <h3 className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-3">Informações</h3>
          {loadingDetails ? (
            <div className="text-center py-4">
              <div className="w-6 h-6 border-2 border-red-600 border-t-transparent animate-spin mx-auto" />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Total de itens:</span>
                <span className="text-white font-bold">{projectData.videos?.length || 0} vídeos</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Tamanho total:</span>
                <span className="text-white font-bold">{projectSizeGB} GB</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Status:</span>
                <span className={`font-bold uppercase text-xs ${projectData.status === 'active' ? 'text-green-500' : 'text-zinc-500'}`}>
                  {projectData.status === 'active' ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="space-y-2">
          <input
            type="file"
            id={`cover-upload-${project.id}`}
            className="hidden"
            accept="image/*"
            onChange={handleFileSelect}
          />
          <Button
            asChild
            variant="ghost"
            className="w-full justify-start glass-button border border-zinc-800 rounded-none"
          >
            <label htmlFor={`cover-upload-${project.id}`} className="cursor-pointer flex items-center">
              <ImageIcon className="w-4 h-4 mr-3" />
              Alterar Imagem de Capa
            </label>
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start glass-button border border-zinc-800 rounded-none"
            onClick={handleDuplicateProject}
          >
            <Copy className="w-4 h-4 mr-3" />
            Duplicar Projeto
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start glass-button border border-zinc-800 rounded-none"
            onClick={handleToggleStatus}
          >
            <Archive className="w-4 h-4 mr-3" />
            {projectData.status === 'active' ? 'Marcar como Inativo' : 'Marcar como Ativo'}
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start glass-button border border-red-900/50 text-red-500 hover:bg-red-500/10 rounded-none"
            onClick={handleDeleteProject}
          >
            <Trash2 className="w-4 h-4 mr-3" />
            Excluir Projeto
          </Button>

          <div className="pt-4 border-t border-zinc-900 mt-4 space-y-4">
            <h3 className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Compartilhamento</h3>
            
            {!shareLink ? (
              <Button
                variant="outline"
                className="w-full justify-start border-zinc-800 bg-zinc-900/50 hover:bg-red-600 hover:text-white transition-all rounded-none"
                onClick={handleGenerateShare}
                disabled={isGeneratingShare}
              >
                <Share2 className="w-4 h-4 mr-3" />
                {isGeneratingShare ? 'Gerando...' : 'Gerar Link de Revisão'}
              </Button>
            ) : (
              <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-2 p-3 bg-black border border-zinc-800 rounded-none">
                  <Globe className="w-3 h-3 text-red-500 flex-shrink-0" />
                  <input 
                    readOnly 
                    value={shareLink} 
                    className="flex-1 bg-transparent border-none text-[10px] text-zinc-400 font-mono outline-none truncate"
                  />
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 hover:bg-zinc-800 rounded-none"
                    onClick={copyToClipboard}
                  >
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-zinc-500" />}
                  </Button>
                </div>
                <p className="text-[9px] text-zinc-600 uppercase tracking-widest text-center">O cliente poderá revisar e comentar</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            variant="ghost"
            className="flex-1 glass-button border border-zinc-800 rounded-none"
            onClick={onClose}
          >
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
