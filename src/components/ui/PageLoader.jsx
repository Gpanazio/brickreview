import { Film } from "lucide-react";

export function PageLoader() {
    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-2 border-red-600 border-t-transparent rounded-none animate-spin" />
                <div className="flex items-center gap-2">
                    <Film className="w-4 h-4 text-red-600" />
                    <span className="text-xs text-zinc-500 uppercase tracking-widest">
                        Carregando...
                    </span>
                </div>
            </div>
        </div>
    );
}
