import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import {
  Home, Film, Upload, FolderOpen, Settings, User, Search,
  Grid, List, SlidersHorizontal, Plus, Clock, Star, Archive, ChevronLeft, ChevronRight, LogOut
} from 'lucide-react'
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

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  )
}

function AppContent() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#050505] text-white relative overflow-hidden">
      {/* Background Accents for Glassmorphism */}
      <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-red-600/10 blur-[150px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] bg-blue-600/5 blur-[150px] rounded-full" />
      <div className="absolute top-[30%] left-[40%] w-[30%] h-[30%] bg-purple-600/5 blur-[130px] rounded-full" />
      
      <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      <main className="flex-1 relative z-10 custom-scrollbar overflow-y-auto overflow-x-hidden h-screen">
        <Routes>
          <Route path="/" element={<ProjectsPage />} />
          <Route path="/project/:id" element={<ProjectDetailPage />} />
          <Route path="/recent" element={<RecentPage />} />
          <Route path="/starred" element={<StarredPage />} />
          <Route path="/archived" element={<ArchivedPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
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
      <div className="p-6 border-b border-zinc-800/50 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600 flex items-center justify-center flex-shrink-0">
            <Film className="w-6 h-6 text-white" />
          </div>
          {!collapsed && (
            <h1 className="brick-title text-xl text-white whitespace-nowrap">BRICKREVIEW</h1>
          )}
        </Link>
      </div>

      {/* Collapse Toggle */}
      <div className="px-4 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full justify-start text-zinc-400 hover:text-white hover:bg-zinc-900"
        >
              {collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <>
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  <span className="text-sm">Recolher</span>
                </>
              )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-3 px-3 py-2 rounded transition-colors ${
              isActive(item.path)
                ? 'bg-red-600 text-white'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
            } ${collapsed ? 'justify-center' : ''}`}
            title={collapsed ? item.label : ''}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>{item.label}</span>}
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
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', description: '', client_name: '' })
  const [isCreating, setIsCreating] = useState(false)
  const { token } = useAuth()

  useEffect(() => {
    fetchProjects()
  }, [])

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
      const response = await fetch('/api/projects', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      setProjects(data)
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
      thumbnail: 'https://images.unsplash.com/photo-1574267432644-f610a75d1c6d?w=400',
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
      <div className="px-8 py-6 border-b border-zinc-900">
        <h2 className="text-sm text-zinc-500 mb-4">Projetos Recentes</h2>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {projects.slice(0, 4).map((project) => (
            <div
              key={project.id}
              className="flex-shrink-0 w-48 cursor-pointer group"
            >
              <div className="relative aspect-video rounded overflow-hidden mb-2">
                <img
                  src={project.thumbnail}
                  alt={project.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
              </div>
              <p className="text-sm font-medium truncate">{project.name}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filters & View Controls */}
      <div className="px-8 py-4 flex items-center justify-between border-b border-zinc-900">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Grid className="w-4 h-4 text-zinc-500" />
            <span className="text-sm text-zinc-400">Filtrado por</span>
            <Badge variant="secondary" className="bg-zinc-900 text-white border-zinc-700">
              Projetos Ativos
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-zinc-500" />
            <span className="text-sm text-zinc-400">Ordenado por</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-white">
                  Nome
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-zinc-900 border-zinc-800">
                <DropdownMenuItem className="text-white">Nome</DropdownMenuItem>
                <DropdownMenuItem className="text-white">Data de Modificação</DropdownMenuItem>
                <DropdownMenuItem className="text-white">Data de Criação</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewMode('grid')}
            className={viewMode === 'grid' ? 'text-white' : 'text-zinc-500'}
          >
            <Grid className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewMode('list')}
            className={viewMode === 'list' ? 'text-white' : 'text-zinc-500'}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="flex-1 overflow-y-auto p-8 h-full">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="aspect-[4/3] bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-zinc-800">
            <p className="text-zinc-500 uppercase tracking-widest font-bold text-sm">Nenhum projeto encontrado</p>
            <Button 
              size="sm" 
              onClick={() => setIsDialogOpen(true)}
              className="mt-4 glass-button-primary border-none rounded-none"
            >
              Criar seu primeiro projeto
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ProjectCard({ project }) {
  return (
    <Link to={`/project/${project.id}`} className="group cursor-pointer glass-card p-3 rounded-none border-l-2 border-l-transparent hover:border-l-red-600 transition-all duration-300 block">
      <div className="relative aspect-[4/3] rounded-none overflow-hidden mb-3 bg-zinc-900/50">
        <img
          src={project.thumbnail_url || project.thumbnail || 'https://images.unsplash.com/photo-1574267432644-f610a75d1c6d?w=400'}
          alt={project.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505]/90 via-transparent to-transparent opacity-80 group-hover:opacity-60 transition-opacity" />

        {/* Lock badge (como no Frame.io) */}
        <div className="absolute top-0 right-0 w-10 h-10 bg-red-600/20 backdrop-blur-xl border-l border-b border-red-600/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
          <div className="w-2 h-2 bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.8)]" />
        </div>

        {/* Project name overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-0 transition-all duration-500">
          <p className="brick-title text-base text-white drop-shadow-2xl mb-0.5 uppercase tracking-tighter">{project.name}</p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 font-bold opacity-80">{project.team || project.client_name || "Brick's Team"}</p>
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-zinc-500">
          {project.updated_at ? new Date(project.updated_at).toLocaleDateString() : project.updatedAt}
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-zinc-400">⋯</span>
        </Button>
      </div>
    </Link>
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
