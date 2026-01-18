import { Smile, ThumbsUp, ThumbsDown, Heart, Flame, Rocket, Eye, CheckCircle2, XCircle, PartyPopper } from "lucide-react";


const REACTIONS = [
    { emoji: "😂", label: "Rosto chorando de rir" },
    { emoji: "❤️", label: "Coração vermelho" },
    { emoji: "😍", label: "Rosto apaixonado" },
    { emoji: "😭", label: "Rosto chorando" },
    { emoji: "🙏", label: "Mãos juntas" },
    { emoji: "😅", label: "Sorriso com suor" },
    { emoji: "🤣", label: "Gargalhando" },
    { emoji: "😘", label: "Beijo mandando coração" },
    { emoji: "🥰", label: "Rosto sorridente com corações" },
    { emoji: "😎", label: "Rosto com óculos escuros" },
    { emoji: "🤔", label: "Rosto pensativo" },
    { emoji: "👍", label: "Polegar para cima" },
    { emoji: "😁", label: "Sorriso largo" },
    { emoji: "🔥", label: "Fogo" },
    { emoji: "🤡", label: "Palhaço" },
    { emoji: "✨", label: "Brilhos" },
];

export function ReactionPicker({ onSelect }) {
    return (
        <div className="bg-[#0a0a0a] border border-zinc-800 p-3 shadow-xl w-[280px]">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    Reações Rápidas
                </span>
            </div>

            <div className="grid grid-cols-5 gap-2">
                {REACTIONS.map((reaction) => (
                    <button
                        key={reaction.label}
                        onClick={() => onSelect(reaction)}
                        className="aspect-square flex items-center justify-center text-xl hover:bg-zinc-800 hover:scale-110 transition-all rounded-sm group relative"
                        title={reaction.label}
                    >
                        {reaction.emoji}
                    </button>
                ))}
            </div>
        </div>
    );
}
