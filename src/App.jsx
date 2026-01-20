import { useState, useEffect, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from "react-router-dom";
import {
  Home,
  Film,
  Settings,
  User,
  Search,
  Grid,
  List,
  SlidersHorizontal,
  Plus,
  ChevronLeft,
  ChevronRight,
  LogOut,
  HardDrive,
  Briefcase,
  MoreVertical,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import "./App.css";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { UploadProvider } from "./context/UploadContext";
import { Toaster } from "./components/ui/sonner";
import { ProjectCoverPlaceholder } from "./components/ui/ProjectCoverPlaceholder";
import { ProjectSettingsModal } from "./components/projects/ProjectSettingsModal";
import { ProjectListItem } from "./components/projects/ProjectListItem";
import { PageLoader } from "./components/ui/PageLoader";
import ErrorBoundary from "./components/ErrorBoundary";

const APP_VERSION = "1.2.0-perf";
console.log("BRICK Review Version:", APP_VERSION);

// Lazy loaded pages for code splitting
const LoginPage = lazy(() => import("./components/LoginPage").then(m => ({ default: m.LoginPage })));
const ProjectDetailPage = lazy(() => import("./components/projects/ProjectDetailPage").then(m => ({ default: m.ProjectDetailPage })));
const ShareViewPage = lazy(() => import("./components/projects/ShareViewPage").then(m => ({ default: m.ShareViewPage })));
const SettingsPage = lazy(() => import("./components/settings/SettingsPage").then(m => ({ default: m.SettingsPage })));
const StoragePage = lazy(() => import("./components/storage/StoragePage").then(m => ({ default: m.StoragePage })));
const SharedStoragePage = lazy(() => import("./components/storage/SharedStoragePage").then(m => ({ default: m.SharedStoragePage })));
const PortfolioPage = lazy(() => import("./components/portfolio/PortfolioPage").then(m => ({ default: m.PortfolioPage })));
const PortfolioPlayerPage = lazy(() => import("./components/portfolio/PortfolioPlayerPage").then(m => ({ default: m.PortfolioPlayerPage })));
const SharedCollectionPage = lazy(() => import("./components/portfolio/SharedCollectionPage").then(m => ({ default: m.SharedCollectionPage })));

// Cookie consent component (non-lazy, always needed)
import { CookieConsent } from "./components/CookieConsent";

// Helper para identificar URLs padrão antigas
const isDefaultUrl = (url) => {
  return !url || url.includes("images.unsplash.com/photo-1574267432644");
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <UploadProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Rota pública de Share Links (deve vir antes das rotas protegidas) */}
                <Route path="/share/:token" element={<ShareViewPage />} />
                <Route path="/storage/s/:id" element={<SharedStoragePage />} />
                <Route path="/portfolio/player/:id" element={<PortfolioPlayerPage />} />
                <Route path="/portfolio/c/:token" element={<SharedCollectionPage />} />

                {/* Rotas Principais do App */}
                <Route path="/*" element={<AppContent />} />
              </Routes>
            </Suspense>
            <Toaster position="top-right" />
            <CookieConsent />
          </BrowserRouter>
        </UploadProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

function AppContent() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-2 border-red-600 border-t-transparent"
        />
      </div>
    );
  }

  return (
    <>
      {!user ? (
        <div className="animate-fade-in">
          <Routes location={location} key={location.pathname}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
      ) : (
        <div className="flex min-h-screen bg-[#0d0d0e] text-white relative overflow-hidden font-sans animate-fade-in">
          {/* Background Accents for Glassmorphism - Static for performance */}
          <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-red-600/10 blur-[180px] rounded-full pointer-events-none opacity-[0.05]" />
          <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-blue-600/5 blur-[120px] rounded-full opacity-[0.04]" />

          <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />

          <main className="flex-1 relative z-10 custom-scrollbar overflow-y-auto overflow-x-hidden h-screen bg-black/20 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
            <Suspense fallback={<PageLoader />}>
              <div key={location.pathname} className="h-full animate-fade-in">
                <Routes location={location}>
                  <Route path="/" element={<ProjectsPage />} />
                  <Route path="/project/:id" element={<ProjectDetailPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/storage" element={<StoragePage />} />
                  <Route path="/portfolio" element={<PortfolioPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
            </Suspense>
          </main>
        </div>
      )}
    </>
  );
}

function Sidebar({ collapsed, setCollapsed }) {
  const location = useLocation();
  const { user, logout } = useAuth();

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { icon: Home, label: "Todos os Projetos", path: "/" },
    { icon: Briefcase, label: "Portfolio", path: "/portfolio" },
    { icon: HardDrive, label: "Storage", path: "/storage" },
    { icon: Settings, label: "Configurações", path: "/settings" },
  ];

  return (
    <>
      <MobileNav navItems={navItems} user={user} logout={logout} />
      <aside
        className={`hidden md:flex glass-panel border-r border-zinc-800/50 flex-col transition-all duration-300 relative z-20 ${collapsed ? "w-20" : "w-64"
          }`}
      >
        {/* Logo */}
        <div className="p-8 border-b border-zinc-900/50 flex items-center justify-between bg-zinc-950/20">
          <Link to="/" className="flex items-center gap-4">
            <div className="w-10 h-10 bg-red-600 flex items-center justify-center flex-shrink-0 relative">
              <div className="absolute inset-0 bg-red-600 blur-[10px] opacity-20" />
              <Film className="w-5 h-5 text-white relative z-10" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <h1 className="brick-title text-xl text-white whitespace-nowrap leading-none">
                  BRICK
                </h1>
                <span className="brick-tech text-[8px] text-zinc-500 uppercase tracking-[0.4em] mt-1">
                  Review
                </span>
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
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-6 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-4 px-4 py-3 border-l-2 transition-all group ${isActive(item.path)
                ? "bg-red-600/10 border-red-600 text-white shadow-[inset_10px_0_20px_rgba(220,38,38,0.05)]"
                : "border-transparent text-zinc-500 hover:text-white hover:bg-zinc-900/50"
                } ${collapsed ? "justify-center" : ""} cursor-pointer`}
              title={collapsed ? item.label : ""}
            >
              <item.icon
                className={`w-4 h-4 flex-shrink-0 ${isActive(item.path) ? "text-red-500" : "group-hover:text-red-400"} transition-colors`}
              />
              {!collapsed && (
                <span className="brick-tech text-[10px] uppercase tracking-widest">
                  {item.label}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-zinc-900">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div
                className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors ${collapsed ? "justify-center" : ""}`}
              >
                <div className="w-8 h-8 bg-red-600 rounded-none flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-black text-white">
                    {user.username.substring(0, 2).toUpperCase()}
                  </span>
                </div>
                {!collapsed && (
                  <>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm text-white truncate">{user.username}</p>
                      <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">
                        {user.role}
                      </p>
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
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  logout();
                  window.location.href = "/login";
                }}
                className="text-red-500 focus:text-red-400 focus:bg-red-500/10 rounded-none cursor-pointer"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
}

function ProjectsPage() {
  const [viewMode, setViewMode] = useState("grid");
  const [projects, setProjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", description: "", client_name: "" });
  const [isCreating, setIsCreating] = useState(false);
  const { token } = useAuth();

  useEffect(() => {
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newProject),
      });

      if (response.ok) {
        setIsDialogOpen(false);
        setNewProject({ name: "", description: "", client_name: "" });
        fetchProjects();
      }
    } catch (error) {
      console.error("Erro ao criar projeto:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const isRecentPage = location.pathname === "/recent";
      const url = isRecentPage ? "/api/projects?recent=true" : "/api/projects";

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      // Handle both paginated response { data: [...], pagination: {...} } and array response
      const projectsArray = Array.isArray(data) ? data : (data.data || []);
      setProjects(projectsArray);
    } catch (error) {
      console.error("Erro ao buscar projetos:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="border-b border-zinc-800/50 glass-panel sticky top-0 z-30 px-4 md:px-8 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 md:gap-4 flex-1">
            <h1 className="brick-title text-xl md:text-2xl tracking-tighter truncate">Workspace</h1>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="glass-button-primary border-none rounded-none">
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Projeto
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-zinc-950 border-zinc-800 rounded-none text-white">
                <DialogHeader>
                  <DialogTitle className="brick-title text-2xl tracking-tighter uppercase">
                    Novo Projeto
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateProject} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">
                      Nome do Projeto
                    </Label>
                    <Input
                      required
                      value={newProject.name}
                      onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                      className="glass-input border-none rounded-none h-12"
                      placeholder="Ex: CAMPANHA KEETA"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">
                      Nome do Cliente
                    </Label>
                    <Input
                      value={newProject.client_name}
                      onChange={(e) =>
                        setNewProject({ ...newProject, client_name: e.target.value })
                      }
                      className="glass-input border-none rounded-none h-12"
                      placeholder="Ex: Brick Produtora"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">
                      Descrição
                    </Label>
                    <Input
                      value={newProject.description}
                      onChange={(e) =>
                        setNewProject({ ...newProject, description: e.target.value })
                      }
                      className="glass-input border-none rounded-none h-12"
                      placeholder="Detalhes opcionais..."
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isCreating}
                    className="w-full glass-button-primary border-none rounded-none h-12 font-black uppercase tracking-widest"
                  >
                    {isCreating ? "Criando..." : "Criar Projeto"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search */}
          <div className="relative flex-1 md:flex-none md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              placeholder="Buscar..."
              className="pl-9 glass-input border-none h-10 text-xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="hidden md:flex items-center gap-2 ml-4">
            <Button variant="ghost" size="icon">
              <User className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Recent Projects Section */}
      <div className="px-4 md:px-8 py-6 md:py-8 border-b border-zinc-900/50 bg-zinc-950/20">
        <h2 className="brick-tech text-[10px] text-zinc-500 mb-4 md:mb-6 uppercase tracking-[0.3em]">
          Recentes
        </h2>
        <div className="flex gap-4 md:gap-6 overflow-x-auto pb-4 no-scrollbar">
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
                      loading="lazy"
                      className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
                    />
                  ) : (
                    <ProjectCoverPlaceholder projectName={project.name} />
                  )}
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/10 transition-colors" />
                  <div className="absolute bottom-0 left-0 w-full h-[2px] bg-red-600 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500" />
                </div>
                <p className="brick-title text-xs text-zinc-400 group-hover:text-white transition-colors truncate">
                  {project.name}
                </p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Filters & View Controls */}
      <div className="px-4 md:px-8 py-4 flex items-center justify-between border-b border-zinc-900/50 bg-zinc-950/30 backdrop-blur-sm sticky top-[73px] z-20">
        <div className="flex items-center gap-2">
          {/* Sort Dropdown - Minimalista */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-700 transition-all text-xs font-medium uppercase tracking-wider"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 mr-2" />
                Ordenar: Nome
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-zinc-900 border-zinc-800 w-48">
              <DropdownMenuItem className="text-zinc-400 hover:text-white hover:bg-zinc-800 focus:bg-zinc-800 cursor-pointer text-xs uppercase tracking-wider">
                Nome
              </DropdownMenuItem>
              <DropdownMenuItem className="text-zinc-400 hover:text-white hover:bg-zinc-800 focus:bg-zinc-800 cursor-pointer text-xs uppercase tracking-wider">
                Data de Modificação
              </DropdownMenuItem>
              <DropdownMenuItem className="text-zinc-400 hover:text-white hover:bg-zinc-800 focus:bg-zinc-800 cursor-pointer text-xs uppercase tracking-wider">
                Data de Criação
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Filter Badge - Estilo Tag */}
          <div className="flex items-center h-8 px-3 bg-zinc-900/50 border border-zinc-800 rounded-md">
            <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
              Ativos
            </span>
          </div>
        </div>

        {/* View Toggle - Segmented Control Style */}
        <div className="flex items-center p-1 bg-zinc-900/80 border border-zinc-800 rounded-lg">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-md transition-all ${viewMode === "grid"
              ? "bg-zinc-800 text-white shadow-sm"
              : "text-zinc-500 hover:text-zinc-300"
              } cursor-pointer`}
            title="Grid View"
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded-md transition-all ${viewMode === "list"
              ? "bg-zinc-800 text-white shadow-sm"
              : "text-zinc-500 hover:text-zinc-300"
              } cursor-pointer`}
            title="List View"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Projects Grid/List */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 h-full">
        {loading ? (
          viewMode === "grid" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="aspect-[4/3] bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
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
            <p className="text-zinc-500 uppercase tracking-[0.3em] font-black text-[10px]">
              Nenhum projeto encontrado
            </p>
            <Button
              size="sm"
              onClick={() => setIsDialogOpen(true)}
              className="mt-6 glass-button-primary border-none rounded-none px-8 py-6 h-auto"
            >
              Criar seu primeiro projeto
            </Button>
          </motion.div>
        ) : viewMode === "grid" ? (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.05,
                },
              },
            }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"
          >
            {projects
              .filter(
                (p) =>
                  p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  p.client_name?.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((project) => (
                <motion.div
                  key={project.id}
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    show: { opacity: 1, y: 0 },
                  }}
                >
                  <ProjectCard project={project} onProjectUpdate={fetchProjects} />
                </motion.div>
              ))}
            {/* New Project Card */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 20 },
                show: { opacity: 1, y: 0 },
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
                <span className="text-zinc-500 font-bold uppercase tracking-widest text-xs group-hover:text-white transition-colors relative z-10">
                  Criar Novo Projeto
                </span>
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
                    staggerChildren: 0.03,
                  },
                },
              }}
              className="divide-y divide-zinc-900"
            >
              {projects
                .filter(
                  (p) =>
                    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    p.client_name?.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((project) => (
                  <motion.div
                    key={project.id}
                    variants={{
                      hidden: { opacity: 0, x: -10 },
                      show: { opacity: 1, x: 0 },
                    }}
                  >
                    <ProjectListItem project={project} onProjectUpdate={fetchProjects} />
                  </motion.div>
                ))}
              {/* New Project Row */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, x: -10 },
                  show: { opacity: 1, x: 0 },
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
                    <span className="text-sm font-bold text-zinc-500 group-hover:text-white uppercase tracking-wider transition-colors">
                      Criar Novo Projeto
                    </span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectCard({ project, onProjectUpdate }) {
  const [showSettings, setShowSettings] = useState(false);
  const [imageError, setImageError] = useState(false);
  const { token } = useAuth();

  const coverUrl = project.cover_image_url || project.thumbnail_url || project.thumbnail;
  const hasValidCover = !isDefaultUrl(coverUrl);

  return (
    <>
      <div
        onContextMenu={(e) => {
          e.preventDefault();
          setShowSettings(true);
        }}
        className="group glass-card p-4 border-l-2 border-l-transparent hover:border-l-red-600 hover:shadow-[0_0_30px_rgba(220,38,38,0.1)] transition-all duration-500 relative flex flex-col h-full selector-card"
      >
        <Link to={`/project/${project.id}`} className="flex-1 flex flex-col cursor-pointer">
          <div className="relative aspect-[4/3] overflow-hidden mb-5 bg-zinc-900 border border-zinc-800/30">
            {hasValidCover && !imageError ? (
              <img
                src={coverUrl}
                alt={project.name}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out"
                onError={() => setImageError(true)}
              />
            ) : (
              <ProjectCoverPlaceholder
                projectName={project.name}
                clientName={project.client_name}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

            {/* Status indicator */}
            <div className="absolute top-4 left-4 flex items-center gap-2 px-2 py-1 bg-black/80 backdrop-blur-md border border-white/10">
              <div className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
              <span className="brick-tech text-[8px] text-white uppercase tracking-tighter">
                Active
              </span>
            </div>

            {/* Action Menu - Mobile accessible */}
            <div className="absolute top-2 right-2 z-20" onClick={(e) => e.preventDefault()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-white bg-black/20 hover:bg-black/80 rounded-sm backdrop-blur-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-zinc-950 border-zinc-800 text-zinc-300" align="end">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setShowSettings(true); }}>
                    <Settings className="mr-2 h-4 w-4" /> Configurações
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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

        <div className="flex items-center gap-2 pt-4 border-t border-zinc-900/50">
          <div className="w-6 h-6 bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <span className="brick-tech text-[8px] text-zinc-500">v1</span>
          </div>
          <span className="brick-tech text-[9px] text-zinc-600 uppercase">
            {project.updated_at
              ? new Date(project.updated_at).toLocaleDateString()
              : project.updatedAt}
          </span>
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
  );
}


function MobileNav({ navItems, user, logout }) {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] bg-zinc-950/90 backdrop-blur-xl border-t border-zinc-800 z-[100] px-4 flex items-center justify-around">
      {navItems.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          className={`flex flex-col items-center gap-1 transition-colors ${isActive(item.path) ? "text-red-500" : "text-zinc-500"
            }`}
        >
          <item.icon className="w-5 h-5" />
          <span className="text-[9px] uppercase font-bold tracking-tighter">
            {item.label.split(" ")[0]}
          </span>
        </Link>
      ))}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex flex-col items-center gap-1 text-zinc-500 cursor-pointer">
            <div className="w-6 h-6 bg-red-600 flex items-center justify-center">
              <span className="text-[10px] font-black text-white">
                {user.username.substring(0, 2).toUpperCase()}
              </span>
            </div>
            <span className="text-[9px] uppercase font-bold tracking-tighter">Perfil</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="bg-zinc-950 border-zinc-800 rounded-none w-56 mb-2"
        >
          <DropdownMenuItem className="text-zinc-400 focus:text-white focus:bg-white/5 rounded-none cursor-pointer">
            <User className="w-4 h-4 mr-2" /> Perfil
          </DropdownMenuItem>
          <DropdownMenuItem className="text-zinc-400 focus:text-white focus:bg-white/5 rounded-none cursor-pointer">
            <Settings className="w-4 h-4 mr-2" /> Configurações
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              logout();
              window.location.href = "/login";
            }}
            className="text-red-500 focus:text-red-400 focus:bg-red-500/10 rounded-none cursor-pointer"
          >
            <LogOut className="w-4 h-4 mr-2" /> Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}

export default App;
