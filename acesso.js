/* =====================================================================
   ACESSO DO HÓSPEDE  —  configuração + validação (usado por index.html e gerador.html)
   Normalmente você NÃO precisa editar este arquivo.
   ===================================================================== */
(function (root) {
  "use strict";

  /* ---------------- CONFIGURAÇÃO (raramente muda) ---------------- */
  var CONFIG = {
    // Chave secreta que "assina" os códigos. Trocar esta frase INVALIDA TODOS os códigos já enviados.
    segredo: "c4b5296ae67f6d60fa2f47b8",
    // Hora (Brasília) em que o código expira no dia da saída.
    horaFim: "13:00",
    // WhatsApp do anfitrião (botão "peça o código").
    whatsapp: "5534999792398",
    // Endereço do guia (usado quando o gerador é aberto fora do GitHub Pages).
    baseUrl: "https://machadodm2.github.io/Check-in-Inteligente/",
    // Senha do anfitrião (protege o gerador). Deixe vazio na primeira vez: abra o gerador.html e siga a tela de configuração.
    pinSalt: "7f2caff9d9f0093f",
    pinHash: "825bd63a0b5534f586a458c387845873ab4d1e8f2da718fb95742134d2745378",
    // Para cortar UM código antes da hora, cole-o aqui. Exemplo: ["261020K7F2X"]
    revogados: []
  };
  /* ---------------------------------------------------------------- */

  var ALFA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem I, O, 0, 1 (evita confusão)

  function cyrb53(str, seed) {
    var h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (var i = 0; i < str.length; i++) {
      var ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }

  function assinatura(aammdd) {
    var n = cyrb53(CONFIG.segredo + "|" + aammdd, 7), s = "";
    for (var i = 0; i < 5; i++) { s += ALFA.charAt(n % 32); n = Math.floor(n / 32); }
    return s;
  }

  function normalizar(s) { return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }

  function fimDe(aa, mm, dd) {
    return new Date("20" + aa + "-" + mm + "-" + dd + "T" + CONFIG.horaFim + ":00-03:00");
  }

  // Gera o código para uma data de saída "AAAA-MM-DD". Ex.: "2026-10-20" -> "261020-K7F2X"
  function gerar(dataISO) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataISO || "");
    if (!m) return null;
    var aammdd = m[1].slice(2) + m[2] + m[3];
    return aammdd + "-" + assinatura(aammdd);
  }

  // Resultado: { estado: "ok" | "expirado" | "revogado" | "invalido", expira: Date|null, codigo: "AAMMDDXXXXX" }
  function analisar(texto) {
    var c = normalizar(texto);
    var m = /^(\d{2})(\d{2})(\d{2})([A-Z2-9]{5})$/.exec(c);
    if (!m) return { estado: "invalido", expira: null, codigo: c };
    var mes = +m[2], dia = +m[3];
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return { estado: "invalido", expira: null, codigo: c };
    if (assinatura(m[1] + m[2] + m[3]) !== m[4]) return { estado: "invalido", expira: null, codigo: c };
    var fim = fimDe(m[1], m[2], m[3]);
    if (isNaN(fim.getTime())) return { estado: "invalido", expira: null, codigo: c };
    var rev = CONFIG.revogados.map(normalizar);
    if (rev.indexOf(c) !== -1) return { estado: "revogado", expira: fim, codigo: c };
    if (Date.now() > fim.getTime()) return { estado: "expirado", expira: fim, codigo: c };
    return { estado: "ok", expira: fim, codigo: c };
  }

  root.ACESSO = {
    config: CONFIG, gerar: gerar, analisar: analisar, normalizar: normalizar,
    whatsapp: CONFIG.whatsapp, horaFim: CONFIG.horaFim
  };
})(window);
