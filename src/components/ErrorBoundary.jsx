import { Component } from "react";
import { AlertTriangle, RefreshCw, Home, Film } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Error Boundary Component
 * Captura erros de runtime no React e exibe uma UI amigável
 * Em vez de deixar a aplicação crashar, mostra opções de recuperação
 * 
 * BRICK Visual Identity: Dark theme, red accents, sharp corners
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Atualiza o estado para que a próxima renderização mostre a UI de fallback
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log do erro para monitoramento
    console.error("ErrorBoundary caught an error:", error);
    console.error("Error info:", errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // TODO: Enviar para serviço de monitoramento (Sentry, LogRocket, etc.)
    // if (process.env.NODE_ENV === 'production') {
    //   sendErrorToMonitoring(error, errorInfo);
    // }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
          {/* Background Accents */}
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-red-600/5 blur-[200px] rounded-full pointer-events-none" />
          <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-red-600/3 blur-[150px] rounded-full pointer-events-none" />

          <div className="max-w-xl w-full bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 relative z-10">
            {/* Top Accent Line */}
            <div className="h-[2px] bg-gradient-to-r from-red-600 via-red-500 to-transparent" />

            <div className="p-8 space-y-8">
              {/* Icon + Brand */}
              <div className="flex justify-center">
                <div className="relative">
                  <div className="w-20 h-20 bg-red-600/10 border border-red-600/30 flex items-center justify-center">
                    <AlertTriangle className="w-10 h-10 text-red-500" />
                  </div>
                  {/* Corner accents */}
                  <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-red-600" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-red-600" />
                  <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-red-600" />
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-red-600" />
                </div>
              </div>

              {/* Title */}
              <div className="text-center space-y-3">
                <h1 className="brick-title text-2xl md:text-3xl text-white uppercase tracking-tight">
                  Erro Inesperado
                </h1>
                <p className="text-sm text-zinc-500 leading-relaxed max-w-md mx-auto">
                  Encontramos um problema crítico. Não se preocupe, seus dados estão seguros.
                </p>
              </div>

              {/* Error Details (Dev Only) */}
              {process.env.NODE_ENV === "development" && this.state.error && (
                <div className="bg-zinc-900/50 border border-zinc-800 p-4 space-y-2">
                  <h3 className="brick-tech text-[10px] text-red-500 uppercase tracking-widest">
                    Debug Info
                  </h3>
                  <details className="text-sm">
                    <summary className="cursor-pointer text-red-400 font-mono text-xs hover:text-red-300 transition-colors">
                      {this.state.error.toString()}
                    </summary>
                    <pre className="mt-3 text-[10px] text-zinc-600 overflow-x-auto font-mono leading-relaxed">
                      {this.state.errorInfo?.componentStack}
                    </pre>
                  </details>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={this.handleReload}
                  className="glass-button-primary border-none rounded-none h-12 px-8 font-black uppercase tracking-widest text-xs"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Recarregar
                </Button>
                <Button
                  onClick={this.handleGoHome}
                  variant="ghost"
                  className="h-12 px-8 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-none uppercase tracking-widest text-xs border border-zinc-800"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Voltar ao Início
                </Button>
              </div>

              {/* Footer */}
              <div className="text-center pt-6 border-t border-zinc-900">
                <p className="text-[10px] text-zinc-600 uppercase tracking-widest">
                  Se o problema persistir, entre em contato com o suporte
                </p>
                {process.env.NODE_ENV === "production" && (
                  <p className="mt-2 font-mono text-[10px] text-zinc-700">
                    REF: {Date.now().toString(36).toUpperCase()}
                  </p>
                )}
              </div>
            </div>

            {/* Bottom Brand */}
            <div className="px-8 py-4 bg-zinc-900/30 border-t border-zinc-800 flex items-center justify-center gap-2">
              <Film className="w-4 h-4 text-red-600" />
              <span className="brick-title text-sm text-zinc-600">BRICK</span>
              <span className="brick-tech text-[8px] text-zinc-700 uppercase tracking-widest">Review</span>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

