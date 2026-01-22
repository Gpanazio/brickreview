import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import { Mic, Send, X, Terminal, Sparkles, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";

export function MasonFloating() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const messagesEndRef = useRef(null);
    const { user } = useAuth();

    // Audio UI state
    const [audioLevel, setAudioLevel] = useState(0);

    // Initialize welcome message
    useEffect(() => {
        if (messages.length === 0) {
            setMessages([{
                id: 'init',
                role: 'ai',
                content: "Eu sou MASON. Sistemas online."
            }]);
        }
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Fake breathing animation for the orb
    useEffect(() => {
        if (!isOpen) {
            const interval = setInterval(() => {
                setAudioLevel(Math.random() * 0.3 + 0.1);
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim() || isProcessing) return;

        const userMsg = { id: Date.now(), role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setIsProcessing(true);

        try {
            const context = {
                view: window.location.pathname,
                projectName: document.title, // Simple context for now
            };

            const res = await fetch('/api/mason/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}` // Fallback if hook doesnt provide token direct
                },
                body: JSON.stringify({
                    message: userMsg.content,
                    history: messages.filter(m => m.id !== 'init').map(m => ({
                        role: m.role,
                        content: m.content
                    })),
                    context
                })
            });

            if (!res.ok) throw new Error('Falha na comunicação');

            const data = await res.json();

            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'ai',
                content: data.response
            }]);

        } catch (error) {
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'system',
                content: "CRITICAL FAILURE. CONNECTION SEVERED."
            }]);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <motion.div
            drag
            dragMomentum={false}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={() => setTimeout(() => setIsDragging(false), 150)}
            className="fixed z-[101] bottom-6 right-6"
        >
            <AnimatePresence mode="wait">
                {!isOpen ? (
                    <motion.div
                        key="orb"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        whileHover={{ scale: 1.05 }}
                        onClick={() => !isDragging && setIsOpen(true)}
                        className="w-16 h-16 rounded-full bg-black border border-red-900/50 shadow-[0_0_30px_rgba(220,38,38,0.2)] flex items-center justify-center cursor-pointer group relative overflow-hidden"
                    >
                        {/* Scanlines */}
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(255,0,0,0.02),rgba(255,0,0,0.06))] z-10 bg-[length:100%_2px,3px_100%] pointer-events-none" />

                        {/* The Eye */}
                        <div className={`w-4 h-4 rounded-full bg-red-600 shadow-[0_0_15px_rgba(220,38,38,0.8)] transition-all duration-1000 ${isProcessing ? 'animate-pulse scale-125' : ''}`} />

                        {/* Ring */}
                        <div className="absolute inset-0 border-2 border-red-900/20 rounded-full animate-[spin_10s_linear_infinite]" />
                    </motion.div>
                ) : (
                    <motion.div
                        key="window"
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="w-[380px] h-[600px] bg-[#050505]/95 backdrop-blur-xl border border-zinc-800 flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-lg overflow-hidden"
                    >
                        {/* Header */}
                        <div
                            className="h-10 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between px-4 cursor-grab active:cursor-grabbing select-none"
                            onPointerDown={(e) => {
                                // Allow dragging from header
                            }}
                        >
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                                <span className="font-mono text-[10px] text-red-500 tracking-[0.2em]">MASON v4.0</span>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                                className="text-zinc-500 hover:text-white transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-black/50 relative">
                            {/* Atmosphere */}
                            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.03),transparent_70%)]" />

                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    {msg.role === 'ai' && (
                                        <div className="w-6 h-6 rounded-none border border-red-900/50 bg-black flex items-center justify-center mr-3 mt-1 flex-shrink-0">
                                            <div className="w-1.5 h-1.5 bg-red-600 rounded-full" />
                                        </div>
                                    )}

                                    <div className={`max-w-[80%] ${msg.role === 'user'
                                        ? 'bg-zinc-900 text-zinc-100 border border-zinc-800'
                                        : 'text-red-500 font-mono text-sm'} p-3 rounded-sm`}
                                    >
                                        {msg.content === "CRITICAL FAILURE. CONNECTION SEVERED." ? (
                                            <div className="flex items-center gap-2 text-red-600 font-bold tracking-widest text-xs">
                                                <AlertCircle className="w-4 h-4" />
                                                {msg.content}
                                            </div>
                                        ) : (
                                            msg.role === 'ai' ? (
                                                <ReactMarkdown
                                                    className="prose prose-invert prose-p:leading-relaxed prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800 max-w-none text-xs md:text-sm"
                                                >
                                                    {msg.content}
                                                </ReactMarkdown>
                                            ) : (
                                                <p className="text-sm">{msg.content}</p>
                                            )
                                        )}
                                    </div>
                                </div>
                            ))}
                            {isProcessing && (
                                <div className="flex justify-start">
                                    <div className="w-6 h-6 mr-3" />
                                    <div className="flex items-center gap-1 h-8">
                                        <span className="w-1 h-3 bg-red-600/50 animate-[pulse_0.5s_ease-in-out_infinite]" />
                                        <span className="w-1 h-4 bg-red-600/50 animate-[pulse_0.5s_ease-in-out_0.1s_infinite]" />
                                        <span className="w-1 h-2 bg-red-600/50 animate-[pulse_0.5s_ease-in-out_0.2s_infinite]" />
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <form onSubmit={handleSubmit} className="p-3 border-t border-zinc-900 bg-black">
                            <div className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-800 p-2 rounded-sm focus-within:border-red-900/50 transition-colors">
                                <Terminal className="w-4 h-4 text-zinc-600" />
                                <input
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Comandos ou filosofia..."
                                    className="flex-1 bg-transparent border-none focus:outline-none text-zinc-300 text-sm font-mono placeholder:text-zinc-700"
                                    autoFocus
                                />
                                <button
                                    type="submit"
                                    disabled={!input.trim() || isProcessing}
                                    className="text-zinc-500 hover:text-red-500 disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex justify-between mt-2 px-1">
                                <span className="text-[8px] text-zinc-700 font-mono uppercase">SYSTEM: ONLINE</span>
                                <span className="text-[8px] text-zinc-700 font-mono uppercase">SECURE: TRUE</span>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
