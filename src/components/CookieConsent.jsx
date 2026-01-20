import { useState, useEffect } from "react";
import { X, Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CookieConsent() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Check if user has already consented
        const hasConsented = localStorage.getItem("brick_cookie_consent");
        if (!hasConsented) {
            // Small delay to avoid layout shift on initial load
            const timer = setTimeout(() => setIsVisible(true), 500);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem("brick_cookie_consent", "true");
        setIsVisible(false);
    };

    const handleDecline = () => {
        // Still set consent flag to avoid showing again
        localStorage.setItem("brick_cookie_consent", "declined");
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 md:p-6 animate-slide-up">
            <div className="max-w-4xl mx-auto bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 shadow-2xl shadow-black/50">
                <div className="p-4 md:p-6">
                    <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div className="hidden md:flex w-12 h-12 bg-red-600/10 border border-red-600/30 items-center justify-center flex-shrink-0">
                            <Cookie className="w-6 h-6 text-red-500" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <h3 className="brick-title text-lg text-white mb-2">
                                Cookies & Armazenamento Local
                            </h3>
                            <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                                Este site utiliza cookies e armazenamento local para melhorar sua experiência,
                                manter você conectado e garantir o funcionamento correto do player de vídeo.
                                <br />
                                <span className="text-zinc-500 text-xs mt-1 block">
                                    Ao continuar, você concorda com nossa política de privacidade.
                                </span>
                            </p>

                            {/* Actions */}
                            <div className="flex flex-wrap items-center gap-3">
                                <Button
                                    onClick={handleAccept}
                                    className="glass-button-primary border-none rounded-none px-6 h-10 font-black uppercase tracking-widest text-xs"
                                >
                                    Aceitar Cookies
                                </Button>
                                <Button
                                    onClick={handleDecline}
                                    variant="ghost"
                                    className="text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-none h-10 px-4 text-xs uppercase tracking-widest"
                                >
                                    Recusar
                                </Button>
                                <a
                                    href="/privacy"
                                    className="text-xs text-zinc-600 hover:text-red-500 transition-colors uppercase tracking-widest"
                                >
                                    Política de Privacidade
                                </a>
                            </div>
                        </div>

                        {/* Close Button */}
                        <button
                            onClick={handleDecline}
                            className="text-zinc-600 hover:text-white transition-colors p-1 flex-shrink-0"
                            aria-label="Fechar aviso de cookies"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Accent Line */}
                <div className="h-[2px] bg-gradient-to-r from-red-600 via-red-500 to-transparent" />
            </div>
        </div>
    );
}
