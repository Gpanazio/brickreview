import { useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import {
  Home, Film, Upload, FolderOpen, Settings, User, Search,
  Grid, List, SlidersHorizontal, Plus, Clock, Star, Archive
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

function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-black text-white">
        <Sidebar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<ProjectsPage />} />
            <Route path="/recent" element={<RecentPage />} />
            <Route path="/starred" element={<StarredPage />} />
            <Route path="/archived" element={<ArchivedPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

function Sidebar() {
  const location = useLocation()

  const isActive = (path) => location.pathname === path

  const navItems = [
    { icon: Home, label: 'All Projects', path: '/' },
    { icon: Clock, label: 'Recent', path: '/recent' },
    { icon: Star, label: 'Starred', path: '/starred' },
    { icon: Archive, label: 'Archived', path: '/archived' },
  ]

  return (
    <aside className="w-64 bg-zinc-950 border-r border-zinc-900 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-zinc-900">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600 flex items-center justify-center">
            <Film className="w-6 h-6 text-white" />
          </div>
          <h1 className="brick-title text-xl text-white">BRICKREVIEW</h1>
        </Link>
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
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-zinc-900">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-white">Brick Team</p>
            <p className="text-xs text-zinc-500">Admin</p>
          </div>
          <Settings className="w-4 h-4 text-zinc-400 cursor-pointer hover:text-white" />
        </div>
      </div>
    </aside>
  )
}

function ProjectsPage() {
  const [viewMode, setViewMode] = useState('grid')

  // Mock projects (como Frame.io)
  const projects = [
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
      <header className="border-b border-zinc-900 bg-black px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <h1 className="brick-title text-2xl">Brick's Account</h1>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </div>

          {/* Search */}
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              placeholder="Search"
              className="pl-10 bg-zinc-900 border-zinc-800 text-white"
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
        <h2 className="text-sm text-zinc-500 mb-4">Recent Projects</h2>
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
            <span className="text-sm text-zinc-400">Filtered by</span>
            <Badge variant="secondary" className="bg-zinc-900 text-white border-zinc-700">
              Active Projects
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-zinc-500" />
            <span className="text-sm text-zinc-400">Sorted by</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-white">
                  Name
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-zinc-900 border-zinc-800">
                <DropdownMenuItem className="text-white">Name</DropdownMenuItem>
                <DropdownMenuItem className="text-white">Date Modified</DropdownMenuItem>
                <DropdownMenuItem className="text-white">Date Created</DropdownMenuItem>
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
      <div className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ProjectCard({ project }) {
  return (
    <div className="group cursor-pointer">
      <div className="relative aspect-[4/3] rounded overflow-hidden mb-3 bg-zinc-900">
        <img
          src={project.thumbnail}
          alt={project.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Lock badge (como no Frame.io) */}
        <div className="absolute top-2 right-2 w-6 h-6 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
          <div className="w-3 h-3 bg-zinc-700 rounded-full" />
        </div>

        {/* Project name overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="brick-title text-sm text-white">{project.name}</p>
          <p className="text-xs text-zinc-400">{project.team}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">Updated {project.updatedAt}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-zinc-400">⋯</span>
        </Button>
      </div>
    </div>
  )
}

function RecentPage() {
  return <div className="p-8"><h1 className="brick-title text-3xl">Recent Projects</h1></div>
}

function StarredPage() {
  return <div className="p-8"><h1 className="brick-title text-3xl">Starred Projects</h1></div>
}

function ArchivedPage() {
  return <div className="p-8"><h1 className="brick-title text-3xl">Archived Projects</h1></div>
}

export default App
