import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Railway volume path or local fallback
const ANEXOS_PATH = process.env.ANEXOS_PATH || '/anexos';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let dest = ANEXOS_PATH;

        // Fallback if /anexos doesn't exist (local dev)
        if (!fs.existsSync(dest)) {
            dest = path.join(__dirname, '../anexos');
            if (!fs.existsSync(dest)) {
                fs.mkdirSync(dest, { recursive: true });
            }
        }

        cb(null, dest);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'attach-' + uniqueSuffix + path.extname(file.originalname));
    }
});

export const attachmentUpload = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit for attachments
    }
});
