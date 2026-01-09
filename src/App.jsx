import { useState } from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { Film, Upload, FolderOpen, Bell, Settings, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-black text-white">
        <Header />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/upload" element={<UploadPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

function Header() {
  return (
    <header className="border-b border-zinc-900 bg-black sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 flex items-center justify-center">
              <Film className="w-6 h-6 text-white" />
            </div>
            <h1 className="brick-title text-2xl text-white">BRICKREVIEW</h1>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/projects" className="text-zinc-400 hover:text-white transition-colors">
              Projetos
            </Link>
            <Link to="/upload" className="text-zinc-400 hover:text-white transition-colors">
              Upload
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
              <Bell className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
              <Settings className="w-5 h-5" />
            </Button>
            <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-zinc-400" />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

function HomePage() {
  const stats = [
    { label: 'Total de Vídeos', value: '0', color: 'red' },
    { label: 'Em Revisão', value: '0', color: 'yellow' },
    { label: 'Aprovados', value: '0', color: 'green' },
    { label: 'Comentários Abertos', value: '0', color: 'blue' },
  ]

  return (
    <div className="container mx-auto px-6 py-12">
      {/* Hero */}
      <div className="mb-12">
        <h1 className="brick-title text-6xl mb-4 text-white">
          REVISÃO DE VÍDEOS
        </h1>
        <p className="brick-manifesto text-xl text-zinc-400 max-w-2xl">
          Sistema profissional de revisão e aprovação de vídeos para produtoras.
          Comentários frame-by-frame, versionamento e aprovação de clientes.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        {stats.map((stat) => (
          <Card key={stat.label} className="bg-zinc-950 border-zinc-900">
            <CardHeader>
              <CardDescription className="text-zinc-500">
                {stat.label}
              </CardDescription>
              <CardTitle className="brick-title text-4xl text-white">
                {stat.value}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-zinc-950 border-zinc-900 hover:border-red-600 transition-colors cursor-pointer">
          <CardHeader>
            <div className="w-12 h-12 bg-red-600 flex items-center justify-center mb-4">
              <Upload className="w-6 h-6 text-white" />
            </div>
            <CardTitle className="text-white">Upload de Vídeo</CardTitle>
            <CardDescription className="text-zinc-400">
              Faça upload de novos vídeos para revisão e aprovação
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full bg-red-600 hover:bg-red-700 text-white">
              Novo Upload
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950 border-zinc-900 hover:border-red-600 transition-colors cursor-pointer">
          <CardHeader>
            <div className="w-12 h-12 bg-zinc-800 flex items-center justify-center mb-4">
              <FolderOpen className="w-6 h-6 text-white" />
            </div>
            <CardTitle className="text-white">Meus Projetos</CardTitle>
            <CardDescription className="text-zinc-400">
              Acesse e gerencie seus projetos de vídeo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full border-zinc-700 text-white hover:bg-zinc-900">
              Ver Projetos
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950 border-zinc-900 hover:border-red-600 transition-colors cursor-pointer">
          <CardHeader>
            <div className="w-12 h-12 bg-zinc-800 flex items-center justify-center mb-4">
              <Film className="w-6 h-6 text-white" />
            </div>
            <CardTitle className="text-white">Vídeos Recentes</CardTitle>
            <CardDescription className="text-zinc-400">
              Continue de onde parou nas revisões
            </CardDescription>
          </CardContent>
          <CardContent>
            <Button variant="outline" className="w-full border-zinc-700 text-white hover:bg-zinc-900">
              Ver Recentes
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Empty State */}
      <div className="mt-12 text-center py-12 border-2 border-dashed border-zinc-800 rounded">
        <Film className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
        <h3 className="brick-title text-2xl text-zinc-600 mb-2">
          NENHUM VÍDEO AINDA
        </h3>
        <p className="text-zinc-500 mb-6">
          Comece fazendo upload do seu primeiro vídeo para revisão
        </p>
        <Button className="bg-red-600 hover:bg-red-700 text-white">
          <Upload className="w-4 h-4 mr-2" />
          Fazer Upload
        </Button>
      </div>
    </div>
  )
}

function ProjectsPage() {
  return (
    <div className="container mx-auto px-6 py-12">
      <h1 className="brick-title text-5xl mb-8 text-white">PROJETOS</h1>
      <div className="text-center py-20">
        <FolderOpen className="w-20 h-20 text-zinc-700 mx-auto mb-4" />
        <p className="text-zinc-500">Em desenvolvimento...</p>
      </div>
    </div>
  )
}

function UploadPage() {
  return (
    <div className="container mx-auto px-6 py-12">
      <h1 className="brick-title text-5xl mb-8 text-white">UPLOAD DE VÍDEO</h1>
      <div className="text-center py-20">
        <Upload className="w-20 h-20 text-zinc-700 mx-auto mb-4" />
        <p className="text-zinc-500">Em desenvolvimento...</p>
      </div>
    </div>
  )
}

export default App
