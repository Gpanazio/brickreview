import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import {
  Home, Film, Upload, FolderOpen, Settings, User, Search,
  Grid, List, SlidersHorizontal, Plus, Clock, Star, Archive, ChevronLeft, ChevronRight, LogOut
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import './App.css'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { LoginPage } from './components/LoginPage'
import { ProjectDetailPage } from './components/projects/ProjectDetailPage'
import { ProjectSettingsModal } from './components/projects/ProjectSettingsModal'
import { FolderView } from './components/projects/FolderView'
import { ProjectListItem } from './components/projects/ProjectListItem'
import { ShareViewPage } from './components/projects/ShareViewPage'
import { Toaster } from './components/ui/sonner'
import { toast } from 'sonner'
import { ProjectCoverPlaceholder } from './components/ui/ProjectCoverPlaceholder'

// Helper para identificar URLs padrão antigas
const isDefaultUrl = (url) => {
  return !url || url.includes('images.unsplash.com/photo-1574267432644');
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Rota pública de Share Links (deve vir antes das rotas protegidas) */}
          <Route path="/share/:token" element={<ShareViewPage />} />
          
          {/* Rotas Principais do App */}
          <Route path="/*" element={<AppContent />} />
        </Routes>
        <Toaster position="top-right" />
      </BrowserRouter>
    </AuthProvider>
  )
}

function AppContent() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-2 border-red-600 border-t-transparent" 
        />
      </div>
    )
  }

  return (
    <AnimatePresence mode="wait">
      {!user ? (
        <motion.div
          key="login"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Routes location={location} key={location.pathname}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </motion.div>
      ) : (
        <motion.div
          key="app"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex min-h-screen bg-[#0d0d0e] text-white relative overflow-hidden font-sans"
        >
          {/* Background Accents for Glassmorphism */}
          <motion.div 
            animate={{ 
              scale: [1, 1.1, 1],
              opacity: [0.04, 0.06, 0.04],
            }}
            transition={{ duration: 12, repeat: Infinity }}
            className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-red-600/10 blur-[180px] rounded-full pointer-events-none" 
          />
          <motion.div 
            animate={{ 
              scale: [1, 1.3, 1],
              opacity: [0.03, 0.06, 0.03],
            }}
            transition={{ duration: 20, repeat: Infinity }}
            className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-blue-600/5 blur-[120px] rounded-full" 
          />
          
          <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
          
          <main className="flex-1 relative z-10 custom-scrollbar overflow-y-auto overflow-x-hidden h-screen bg-black/20">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                className="h-full"
              >
                <Routes location={location}>
                  <Route path="/" element={<ProjectsPage />} />
                  <Route path="/project/:id" element={<ProjectDetailPage />} />
                  <Route path="/recent" element={<RecentPage />} />
                  <Route path="/starred" element={<StarredPage />} />
                  <Route path="/archived" element={<ArchivedPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </motion.div>
            </AnimatePresence>
          </main>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Sidebar({ collapsed, setCollapsed }) {
  const location = useLocation()
  const { user, logout } = useAuth()

  const isActive = (path) => location.pathname === path

  const navItems = [
    { icon: Home, label: 'Todos os Projetos', path: '/' },
    { icon: Clock, label: 'Recentes', path: '/recent' },
    { icon: Star, label: 'Favoritos', path: '/starred' },
    { icon: Archive, label: 'Arquivados', path: '/archived' },
  ]

  return (
    <aside className={`glass-panel border-r border-zinc-800/50 flex flex-col transition-all duration-300 relative z-20 ${
      collapsed ? 'w-20' : 'w-64'
    }`}>
      {/* Logo */}
      <div className="p-8 border-b border-zinc-900/50 flex items-center justify-between bg-zinc-950/20">
        <Link to="/" className="flex items-center gap-4">
          <div className="w-10 h-10 bg-red-600 flex items-center justify-center flex-shrink-0 relative">
            <div className="absolute inset-0 bg-red-600 blur-[10px] opacity-20" />
            <Film className="w-5 h-5 text-white relative z-10" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <h1 className="brick-title text-xl text-white whitespace-nowrap leading-none">BRICK</h1>
              <span className="brick-tech text-[8px] text-zinc-500 uppercase tracking-[0.4em] mt-1">Review</span>
            </div>
          )}
        </Link>
      </div>

      {/* Collapse Toggle */}
      <div className="px-4 py-2 flex justify-end">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="text-zinc-400 hover:text-white hover:bg-zinc-900"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-6 space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-4 px-4 py-3 border-l-2 transition-all group ${
              isActive(item.path)
                ? 'bg-red-600/10 border-red-600 text-white shadow-[inset_10px_0_20px_rgba(220,38,38,0.05)]'
                : 'border-transparent text-zinc-500 hover:text-white hover:bg-zinc-900/50'
            } ${collapsed ? 'justify-center' : ''}`}
            title={collapsed ? item.label : ''}
          >
            <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive(item.path) ? 'text-red-500' : 'group-hover:text-red-400'} transition-colors`} />
            {!collapsed && <span className="brick-tech text-[10px] uppercase tracking-widest">{item.label}</span>}
          </Link>
        ))}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-zinc-900">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors ${collapsed ? 'justify-center' : ''}`}>
              <div className="w-8 h-8 bg-red-600 rounded-none flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-black text-white">{user.username.substring(0, 2).toUpperCase()}</span>
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm text-white truncate">{user.username}</p>
                    <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">{user.role}</p>
                  </div>
                  <Settings className="w-4 h-4 text-zinc-400" />
                </>
              )}
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-zinc-950 border-zinc-800 rounded-none w-56 side-right">
            <DropdownMenuItem className="text-zinc-400 focus:text-white focus:bg-white/5 rounded-none cursor-pointer">
              <User className="w-4 h-4 mr-2" />
              Perfil
            </DropdownMenuItem>
            <DropdownMenuItem className="text-zinc-400 focus:text-white focus:bg-white/5 rounded-none cursor-pointer">
              <Settings className="w-4 h-4 mr-2" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={logout}
              className="text-red-500 focus:text-red-400 focus:bg-red-500/10 rounded-none cursor-pointer"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

function ProjectsPage() {
  const [viewMode, setViewMode] = useState('grid')
  const [projects, setProjects] = useState([])
  const [folders, setFolders] = useState([])
  const [currentFolderId, setCurrentFolderId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', description: '', client_name: '' })
  const [isCreating, setIsCreating] = useState(false)
  const { token } = useAuth()

  useEffect(() => {
    fetchProjects()
    fetchFolders()
  }, [])

  const fetchFolders = async () => {
    try {
      const response = await fetch('/api/folders/root', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      setFolders(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Erro ao buscar pastas:', error)
    }
  }

  const handleCreateFolder = async (name, parentFolderId = null) => {
    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          parent_folder_id: parentFolderId
          // project_id is null for root folders
        })
      })

      if (response.ok) {
        fetchFolders()
      }
    } catch (error) {
      console.error('Erro ao criar pasta:', error)
    }
  }

  const handleMoveProject = async (projectId, folderId) => {
    const moveToast = toast.loading('Movendo projeto...')
    try {
      const response = await fetch(`/api/projects/${projectId}/move`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ folder_id: folderId })
      })

      if (response.ok) {
        toast.success('Projeto movido', { id: moveToast })
        fetchProjects()
        fetchFolders()
      } else {
        toast.error('Erro ao mover projeto', { id: moveToast })
      }
    } catch (error) {
      console.error('Erro ao mover projeto:', error)
      toast.error('Erro ao mover projeto', { id: moveToast })
    }
  }

  const handleCreateProject = async (e) => {
    e.preventDefault()
    setIsCreating(true)
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newProject)
      })

      if (response.ok) {
        setIsDialogOpen(false)
        setNewProject({ name: '', description: '', client_name: '' })
        fetchProjects()
      }
    } catch (error) {
      console.error('Erro ao criar projeto:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const fetchProjects = async () => {
    try {
      const isRecentPage = location.pathname === '/recent'
      const url = isRecentPage ? '/api/projects?recent=true' : '/api/projects'
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      setProjects(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Erro ao buscar projetos:', error)
    } finally {
      setLoading(false)
    }
  }

  // Mock projects (como Frame.io)
  const mockProjects = [
    {
      id: 1,
      name: 'KEETA',
      thumbnail: null,
      color: '#FFD700',
      updatedAt: '0mo ago',
      team: "Brick's Team"
    },
    {
      id: 2,
      name: 'PITADA DE BRASIL',
      thumbnail: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400',
      color: '#FF6B35',
      updatedAt: '7mo ago',
      team: "Brick's Team"
    },
    {
      id: 3,
      name: 'FAMILIAS FORTES',
      thumbnail: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=400',
      color: '#4ECDC4',
      updatedAt: '10mo ago',
      team: "Brick's Team"
    },
    {
      id: 4,
      name: 'LUTS',
      thumbnail: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=400',
      color: '#9B59B6',
      updatedAt: '24d ago',
      team: "Brick's Team"
    },
    {
      id: 5,
      name: 'AliExpress',
      thumbnail: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400',
      color: '#E74C3C',
      updatedAt: '7mo ago',
      team: "Brick's Team"
    },
    {
      id: 6,
      name: 'AUTOBOL',
      thumbnail: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400',
      color: '#3498DB',
      updatedAt: '24d ago',
      team: "Brick's Team"
    },
    {
      id: 7,
      name: 'AUTORAIS',
      thumbnail: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400',
      color: '#000000',
      updatedAt: '10mo ago',
      team: "Brick's Team"
    },
    {
      id: 8,
      name: 'BBC',
      thumbnail: 'https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=400',
      color: '#DC2626',
      updatedAt: '24d ago',
      team: "Brick's Team"
    },
  ]

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="border-b border-zinc-800/50 glass-panel sticky top-0 z-30 px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <h1 className="brick-title text-2xl tracking-tighter">Conta da Brick</h1>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="glass-button-primary border-none rounded-none">
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Projeto
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-zinc-950 border-zinc-800 rounded-none text-white">
                <DialogHeader>
                  <DialogTitle className="brick-title text-2xl tracking-tighter uppercase">Novo Projeto</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateProject} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">Nome do Projeto</Label>
                    <Input 
                      required
                      value={newProject.name}
                      onChange={(e) => setNewProject({...newProject, name: e.target.value})}
                      className="glass-input border-none rounded-none h-12" 
                      placeholder="Ex: CAMPANHA KEETA" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">Nome do Cliente</Label>
                    <Input 
                      value={newProject.client_name}
                      onChange={(e) => setNewProject({...newProject, client_name: e.target.value})}
                      className="glass-input border-none rounded-none h-12" 
                      placeholder="Ex: Brick Produtora" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">Descrição</Label>
                    <Input 
                      value={newProject.description}
                      onChange={(e) => setNewProject({...newProject, description: e.target.value})}
                      className="glass-input border-none rounded-none h-12" 
                      placeholder="Detalhes opcionais..." 
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={isCreating}
                    className="w-full glass-button-primary border-none rounded-none h-12 font-black uppercase tracking-widest"
                  >
                    {isCreating ? 'Criando...' : 'Criar Projeto'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search */}
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              placeholder="Buscar projetos..."
              className="pl-10 glass-input border-none h-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 ml-4">
            <Button variant="ghost" size="icon">
              <User className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Recent Projects Section */}
      <div className="px-8 py-8 border-b border-zinc-900/50 bg-zinc-950/20">
        <h2 className="brick-tech text-[10px] text-zinc-500 mb-6 uppercase tracking-[0.3em]">Projetos Recentes</h2>
        <div className="flex gap-6 overflow-x-auto pb-4 custom-scrollbar">
          {projects.slice(0, 5).map((project) => {
            const coverUrl = project.cover_image_url || project.thumbnail_url || project.thumbnail;
            const hasValidCover = !isDefaultUrl(coverUrl);

            return (
              <Link
                key={project.id}
                to={`/project/${project.id}`}
                className="flex-shrink-0 w-64 group"
              >
                <div className="relative aspect-video overflow-hidden mb-3 border border-zinc-800/50 group-hover:border-red-600/30 transition-colors bg-zinc-900">
                  {hasValidCover ? (
                    <img
                      src={coverUrl}
                      alt={project.name}
                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-110"
                    />
                  ) : (
                    <ProjectCoverPlaceholder projectName={project.name} />
                  )}
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/10 transition-colors" />
                  <div className="absolute bottom-0 left-0 w-full h-[2px] bg-red-600 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500" />
                </div>
                <p className="brick-title text-xs text-zinc-400 group-hover:text-white transition-colors truncate">{project.name}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Filters & View Controls */}
      <div className="px-8 py-4 flex items-center justify-between border-b border-zinc-900/50 bg-zinc-950/30 backdrop-blur-sm sticky top-[73px] z-20">
        <div className="flex items-center gap-2">
          {/* Sort Dropdown - Minimalista */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 transition-all text-xs font-medium uppercase tracking-wider">
                <SlidersHorizontal className="w-3.5 h-3.5 mr-2" />
                Ordenar: Nome
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-zinc-900 border-zinc-800 w-48">
              <DropdownMenuItem className="text-zinc-400 hover:text-white hover:bg-zinc-800 focus:bg-zinc-800 cursor-pointer text-xs uppercase tracking-wider">Nome</DropdownMenuItem>
              <DropdownMenuItem className="text-zinc-400 hover:text-white hover:bg-zinc-800 focus:bg-zinc-800 cursor-pointer text-xs uppercase tracking-wider">Data de Modificação</DropdownMenuItem>
              <DropdownMenuItem className="text-zinc-400 hover:text-white hover:bg-zinc-800 focus:bg-zinc-800 cursor-pointer text-xs uppercase tracking-wider">Data de Criação</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Filter Badge - Estilo Tag */}
          <div className="flex items-center h-8 px-3 bg-zinc-900/50 border border-zinc-800 rounded-md">
            <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Ativos</span>
          </div>
        </div>

        {/* View Toggle - Segmented Control Style */}
        <div className="flex items-center p-1 bg-zinc-900/80 border border-zinc-800 rounded-lg">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-md transition-all ${
              viewMode === 'grid' 
                ? 'bg-zinc-800 text-white shadow-sm' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Grid View"
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('folders')}
            className={`p-1.5 rounded-md transition-all ${
              viewMode === 'folders' 
                ? 'bg-zinc-800 text-white shadow-sm' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Folder View (OS Mode)"
          >
            <FolderOpen className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-md transition-all ${
              viewMode === 'list' 
                ? 'bg-zinc-800 text-white shadow-sm' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="List View"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Projects Grid/List */}
      <div className="flex-1 overflow-y-auto p-8 h-full">
        {loading ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="aspect-[4/3] bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-white/5 animate-pulse" />
              ))}
            </div>
          )
        ) : projects.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center h-64 border border-zinc-900 bg-zinc-950/20"
          >
            <p className="text-zinc-500 uppercase tracking-[0.3em] font-black text-[10px]">Nenhum projeto encontrado</p>
            <Button 
              size="sm" 
              onClick={() => setIsDialogOpen(true)}
              className="mt-6 glass-button-primary border-none rounded-none px-8 py-6 h-auto"
            >
              Criar seu primeiro projeto
            </Button>
          </motion.div>
        ) : viewMode === 'folders' ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel border border-zinc-800/30 rounded-none p-6"
          >
            <FolderView
              folders={folders}
              projects={projects}
              currentFolderId={currentFolderId}
              onFolderClick={(folder) => setCurrentFolderId(folder.id)}
              onProjectClick={(project) => window.location.href = `/project/${project.id}`}
              onCreateFolder={handleCreateFolder}
              onRenameFolder={fetchFolders}
              onDeleteFolder={fetchFolders}
              onMoveProject={handleMoveProject}
              token={token}
            />
          </motion.div>
        ) : viewMode === 'grid' ? (
          <motion.div 
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.05
                }
              }
            }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"
          >
            {projects
              .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.client_name?.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((project) => (
              <motion.div
                key={project.id}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  show: { opacity: 1, y: 0 }
                }}
              >
                <ProjectCard project={project} onProjectUpdate={fetchProjects} />
              </motion.div>
            ))}
            {/* New Project Card */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 20 },
                show: { opacity: 1, y: 0 }
              }}
            >
              <div 
                onClick={() => setIsDialogOpen(true)}
                className="group cursor-pointer h-full min-h-[280px] border border-dashed border-zinc-800 hover:border-red-600/50 bg-zinc-900/20 hover:bg-zinc-900/40 transition-all duration-300 flex flex-col items-center justify-center gap-4 rounded-lg relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-red-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center group-hover:scale-110 group-hover:border-red-600 transition-all duration-300 relative z-10">
                  <Plus className="w-8 h-8 text-zinc-500 group-hover:text-red-500 transition-colors" />
                </div>
                <span className="text-zinc-500 font-bold uppercase tracking-widest text-xs group-hover:text-white transition-colors relative z-10">Criar Novo Projeto</span>
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <div className="flex flex-col">
            <div className="grid grid-cols-12 px-6 py-3 text-[10px] uppercase tracking-widest text-zinc-500 font-bold border-b border-zinc-900">
              <div className="col-span-6">Nome do Projeto</div>
              <div className="col-span-3">Última Atualização</div>
              <div className="col-span-3">Data de Criação</div>
            </div>
            <motion.div
              initial="hidden"
              animate="show"
              variants={{
                hidden: { opacity: 0 },
                show: {
                  opacity: 1,
                  transition: {
                    staggerChildren: 0.03
                  }
                }
              }}
              className="divide-y divide-zinc-900"
            >
              {projects
                .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.client_name?.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((project) => (
                <motion.div
                  key={project.id}
                  variants={{
                    hidden: { opacity: 0, x: -10 },
                    show: { opacity: 1, x: 0 }
                  }}
                >
                  <ProjectListItem project={project} onProjectUpdate={fetchProjects} />
                </motion.div>
              ))}
              {/* New Project Row */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, x: -10 },
                  show: { opacity: 1, x: 0 }
                }}
              >
                <div 
                  onClick={() => setIsDialogOpen(true)}
                  className="group flex items-center px-6 py-4 hover:bg-zinc-900/30 transition-all cursor-pointer border-l-2 border-transparent hover:border-l-red-600/50"
                >
                  <div className="flex-1 flex items-center gap-4">
                    <div className="w-12 h-8 border border-dashed border-zinc-700 bg-zinc-900/50 flex items-center justify-center rounded-sm group-hover:border-red-600/50 transition-colors">
                      <Plus className="w-4 h-4 text-zinc-600 group-hover:text-red-500" />
                    </div>
                    <span className="text-sm font-bold text-zinc-500 group-hover:text-white uppercase tracking-wider transition-colors">Criar Novo Projeto</span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  )
}

function ProjectCard({ project, onProjectUpdate }) {
  const [showSettings, setShowSettings] = useState(false);
  const [imageError, setImageError] = useState(false);
  const { token } = useAuth();

  const coverUrl = project.cover_image_url || project.thumbnail_url || project.thumbnail;
  const hasValidCover = !isDefaultUrl(coverUrl);

  return (
    <>
      <div className="group glass-card p-4 border-l-2 border-l-transparent hover:border-l-red-600 transition-all duration-500 relative flex flex-col h-full">
        <Link to={`/project/${project.id}`} className="flex-1 flex flex-col cursor-pointer">
          <div className="relative aspect-[4/3] overflow-hidden mb-5 bg-zinc-900 border border-zinc-800/30">
            {hasValidCover && !imageError ? (
              <img
                src={coverUrl}
                alt={project.name}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out grayscale group-hover:grayscale-0"
                onError={() => setImageError(true)}
              />
            ) : (
              <ProjectCoverPlaceholder projectName={project.name} clientName={project.client_name} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

            {/* Status indicator */}
            <div className="absolute top-4 right-4 flex items-center gap-2 px-2 py-1 bg-black/80 backdrop-blur-md border border-white/10">
              <div className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
              <span className="brick-tech text-[8px] text-white uppercase tracking-tighter">Active</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            <h3 className="brick-title text-lg text-white mb-1 group-hover:text-red-500 transition-colors leading-tight">
              {project.name}
            </h3>
            <p className="brick-manifesto text-[10px] text-zinc-500 uppercase tracking-[0.2em] mb-4">
              {project.client_name || "Brick Production"}
            </p>
          </div>
        </Link>

        <div className="flex items-center justify-between pt-4 border-t border-zinc-900/50 relative z-20">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <span className="brick-tech text-[8px] text-zinc-500">v1</span>
            </div>
            <span className="brick-tech text-[9px] text-zinc-600 uppercase">
              {project.updated_at ? new Date(project.updated_at).toLocaleDateString() : project.updatedAt}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-zinc-900 rounded-none transition-colors pointer-events-auto"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Botão de engrenagem clicado para o projeto:', project.id);
              setShowSettings(true);
            }}
          >
            <Settings className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
          </Button>
        </div>
      </div>

      {/* Modal de Configurações */}
      {showSettings && (
        <ProjectSettingsModal
          project={project}
          onClose={() => setShowSettings(false)}
          onProjectUpdate={onProjectUpdate}
          token={token}
        />
      )}
    </>
  )
}

function RecentPage() {
  return <div className="p-8"><h1 className="brick-title text-3xl">Projetos Recentes</h1></div>
}

function StarredPage() {
  return <div className="p-8"><h1 className="brick-title text-3xl">Projetos Favoritos</h1></div>
}

function ArchivedPage() {
  return <div className="p-8"><h1 className="brick-title text-3xl">Projetos Arquivados</h1></div>
}

export default App
