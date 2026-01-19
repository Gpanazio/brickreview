import { Component } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Error Boundary Component
 * Captura erros de runtime no React e exibe uma UI amigável
 * Em vez de deixar a aplicação crashar, mostra opções de recuperação
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
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full p-8 space-y-6">
            {/* Ícone de Erro */}
            <div className="flex justify-center">
              <div className="rounded-full bg-red-100 p-4">
                <AlertTriangle className="w-12 h-12 text-red-600" />
              </div>
            </div>

            {/* Título */}
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold text-gray-900">
                Oops! Algo deu errado
              </h1>
              <p className="text-gray-600">
                Encontramos um erro inesperado. Não se preocupe, seus dados estão seguros.
              </p>
            </div>

            {/* Detalhes do Erro (apenas em desenvolvimento) */}
            {process.env.NODE_ENV === "development" && this.state.error && (
              <div className="bg-gray-100 rounded-lg p-4 space-y-2">
                <h3 className="font-semibold text-gray-900">Detalhes do erro:</h3>
                <details className="text-sm">
                  <summary className="cursor-pointer text-red-600 font-mono">
                    {this.state.error.toString()}
                  </summary>
                  <pre className="mt-2 text-xs text-gray-700 overflow-x-auto">
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              </div>
            )}

            {/* Ações */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={this.handleReload}
                variant="default"
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Recarregar Página
              </Button>
              <Button
                onClick={this.handleGoHome}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Home className="w-4 h-4" />
                Voltar ao Início
              </Button>
            </div>

            {/* Informações Adicionais */}
            <div className="text-center text-sm text-gray-500 pt-4 border-t">
              <p>
                Se o problema persistir, entre em contato com o suporte técnico.
              </p>
              {process.env.NODE_ENV === "production" && (
                <p className="mt-2 font-mono text-xs text-gray-400">
                  ID do erro: {Date.now()}
                </p>
              )}
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
