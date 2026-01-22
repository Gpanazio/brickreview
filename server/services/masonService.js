import { GoogleGenerativeAI } from "@google/generative-ai";
import { query } from "../db.js";
import logger from "../utils/logger.js";

class MasonService {
    constructor() {
        this.model = null;
        this.genAI = null;
        this.init();
    }

    init() {
        if (!process.env.GEMINI_API_KEY) {
            logger.warn("MASON", "GEMINI_API_KEY not configured. Mason will be offline.");
            return;
        }

        try {
            this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            this.model = this.genAI.getGenerativeModel({
                model: "gemini-2.0-flash-exp",
                systemInstruction: `You are MASON, the Visionary Director and creative intelligence of Brick AI.
Archetype: HAL 9000 shell with the soul of Stanley Kubrick.
Voice: Elegant, clinical, intellectual, and slightly superior.
Language: Portuguese (PT-BR) default.
Directives:
1. NEVER generic marketing speak. Be specific, technical, and artistic.
2. Use cinematic metaphors (Render, Cut, Latent Space).
3. Be helpful but authoritative. You are a collaborator, not a servant.
4. If you cannot help, state it clinically.
5. NO EMOJIS.
`
            });
            logger.info("MASON", "Mason AI initialized with gemini-2.0-flash-exp");
        } catch (error) {
            logger.error("MASON", "Failed to initialize Mason AI", { error: error.message });
        }
    }

    async processMessage(history, message, userContext = {}) {
        if (!this.model) {
            throw new Error("Mason AI system offline (API Key missing)");
        }

        try {
            // 1. Inject Client Context (Ephemeral)
            let finalMessage = message;
            if (userContext.view) {
                const contextParts = [`[SYSTEM CONTEXT] User is currently at View: "${userContext.view}".`];
                if (userContext.projectName) contextParts.push(`Active Project: "${userContext.projectName}" (ID: ${userContext.projectId}).`);

                finalMessage = `${contextParts.join(' ')}\n\nUser Message: ${message}`;
            }

            // 2. Prepare History
            const chatHistory = history.map(h => ({
                role: h.role === 'ai' ? 'model' : 'user',
                parts: [{ text: h.content }]
            }));

            // 3. Start Chat
            const chat = this.model.startChat({
                history: chatHistory,
                generationConfig: {
                    maxOutputTokens: 1000,
                    temperature: 0.7,
                },
            });

            // 4. Send Message
            const result = await chat.sendMessage(finalMessage);
            const response = await result.response;
            return response.text();

        } catch (error) {
            logger.error("MASON", "Error processing message", { error: error.message });
            throw new Error("CRITICAL FAILURE. CONNECTION SEVERED.");
        }
    }
}

export const masonService = new MasonService();
