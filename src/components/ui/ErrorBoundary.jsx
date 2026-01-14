import React from 'react';
import { AlertTriangle } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(_error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }
            return (
                <div className="flex items-center gap-2 p-2 text-xs text-red-500 bg-red-500/10 rounded-sm border border-red-500/20">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Erro ao carregar componente</span>
                </div>
            );
        }

        return this.props.children;
    }
}

export { ErrorBoundary };
