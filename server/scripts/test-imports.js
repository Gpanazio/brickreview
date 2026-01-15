
console.log("Iniciando script de teste...");
import { query } from "../db.js";
console.log("Query importada com sucesso");
import { downloadFile } from "../utils/r2.js";
console.log("downloadFile importado com sucesso");
import { generateSpriteSheet } from "../utils/video.js";
console.log("generateSpriteSheet importado com sucesso");

console.log("Todos os imports funcionaram!");
process.exit(0);
