
try {
    console.log("Teste de import iniciado");
    await import("../db.js");
    console.log("DB importado");
    console.log("Sucesso");
} catch (e) {
    console.error("ERRO COMPLETO:", e);
}
