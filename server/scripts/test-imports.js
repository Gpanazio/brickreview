console.log("Iniciando script de teste...");
import { query } from "../db.js";
console.log("Query importada com sucesso", !!query);
import { downloadFile } from "../utils/r2-helpers.js";
console.log("downloadFile importado com sucesso", !!downloadFile);
import { generateSpriteSheet } from "../utils/video.js";
console.log("generateSpriteSheet importado com sucesso", !!generateSpriteSheet);

console.log("Todos os imports funcionaram!");
process.exit(0);
