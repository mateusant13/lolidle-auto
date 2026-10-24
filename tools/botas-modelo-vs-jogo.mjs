#!/usr/bin/env node
/*
 * botas-modelo-vs-jogo.mjs - O MODELO CONCORDA COM O JOGO NA ESCOLHA DA BOTA?
 *
 * Compara a ordenacao do MODELO da extensao (`estimarSet`/`scoreSet`, o que decide a troca) com a
 * ordenacao MEDIDA no motor do jogo (`tools/botas-cdr-vs-pen.mjs`). Le o kit vivo da Katarina do
 * repo e o catalogo REAL (docs/game-src/itens.js) - nada e' copiado (REGRA No 3).
 *
 * USO: node tools/botas-modelo-vs-jogo.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { criarMundo, carregarAutomation, alimentarCatalogo, alimentarMeta, definirCampeao, RAIZ } from "./testes/dom-stub.mjs";
import { literal, curvaCoef } from "./testes/motor-fonte.mjs";
import { ITENS_DADOS } from "../docs/game-src/itens.js";

const MONS = literal("MONSTROS");
const coefArr = (c) => { const x = curvaCoef(c); return [x.a, x.b, x.c]; };
const CURVA = { hp: coefArr("hp"), ad: coefArr("ad"), armadura: coefArr("armadura"), xp: coefArr("xp"), ouro: coefArr("ouro") };

const vivo = JSON.parse(fs.readFileSync(path.join(RAIZ, "docs/game-src/kit-katarina-vivo.json"), "utf8").replace(/^\/\/.*$/gm, ""));
const kit = vivo.kit.hab;
const m = criarMundo();
const auto = carregarAutomation(m);
alimentarCatalogo(m, ITENS_DADOS);
alimentarMeta(m, { monstros: MONS, curva: CURVA });
definirCampeao(m, "katarina", { kit, magia: true });
m.montar("#hud-nivel", [m.el({ label: "hud-nivel", textContent: "36" })]);
m.montar("#hud-vida-txt", [m.el({ label: "hud-vida-txt", textContent: "4937 / 4937" })]);
m.montar(".st", [
  m.el({ label: "st-dano", textContent: "Dano 292" }),
  m.el({ label: "st-arm", textContent: "Armadura 196" }),
  m.el({ label: "st-rm", textContent: "Res. magica 154" }),
  m.el({ label: "st-va", textContent: "Vel. ataque 1.18" }),
  m.el({ label: "st-rv", textContent: "Roubo de vida 0" }),
]);
const kRanks = { Q: 10, W: 6, E: 10, R: 5, G: 1, A: 1, F: 1, T: 1 };
m.montar("#hab-ativas .hab[data-t]", Object.keys(kRanks).map((tt) => m.el({ tag: "div", label: "hab-" + tt, className: "hab", dataset: { t: tt }, textContent: kRanks[tt] + " / 10" })));
await new Promise((r) => setTimeout(r, 100));

const sMob = auto.statsMonstro("Tropa de Cerco", 36);
const sChefe = auto.statsMonstro("Barão Nashor", 36);
console.log("mob stats", JSON.stringify(sMob), "chefe", JSON.stringify(sChefe));
const alvoMob = { armadura: sMob.armadura, hp: sMob.hp, nivel: 36, chefe: false };
const alvoChefe = { armadura: sChefe.armadura, hp: sChefe.hp, nivel: 36, chefe: true };
const base = ["3115", "3089", "3168", "3031"];
for (const b of ["3158", "3020", "3171", "3175"]) {
  const ids = [b].concat(base);
  const em = auto.estimarSet(ids, alvoMob);
  const ec = auto.estimarSet(ids, alvoChefe);
  console.log(b, "mob dps", Math.round(em.dps), "cdr", em.cdr, "pen", em.pen, "| chefe dps", Math.round(ec.dps), "| score", Math.round(auto.scoreSet(ids, { armadura: alvoChefe.armadura })));
}
// RESUMO: qual bota o MODELO escolhe por fase (a maior dps). Comparar com as vitorias medidas
// por `node tools/botas-cdr-vs-pen.mjs` - e' o que revela se o modelo engana a troca.
const linhas = ["3158", "3020"].map((b) => [
  b, Math.round(auto.estimarSet([b].concat(base), alvoMob).dps), Math.round(auto.estimarSet([b].concat(base), alvoChefe).dps),
]);
const lend = ["3171", "3175"].map((b) => [
  b, Math.round(auto.estimarSet([b].concat(base), alvoMob).dps), Math.round(auto.estimarSet([b].concat(base), alvoChefe).dps),
]);
const escolhe = (l, i) => l.slice().sort((a, b) => b[i] - a[i])[0][0];
console.log("");
console.log("MODELO -> epico    mobs:" + escolhe(linhas, 1) + "  chefe:" + escolhe(linhas, 2));
console.log("MODELO -> lendario mobs:" + escolhe(lend, 1) + "  chefe:" + escolhe(lend, 2));
// ---- O NUMERO QUE DECIDE: `scoreSet` com o alvo DA FASE (e' o que `buildIdeal`/`montarBuildDe`
// usam). `estimarSet.dps` conta so' SKILLS + procs (nao conta auto-ataques) - comparar esse numero
// com o tempo de morte do jogo e' comparar duas grandezas diferentes, e foi esse o erro do
// primeiro relatorio (2026-10-24).
for (const [nome, alvo] of [["mobs", alvoMob], ["chefe", alvoChefe]]) {
  const sc = (b) => Math.round(auto.scoreSet([b].concat(base), alvo));
  console.log("SCORE " + nome + " (epico 3158 CDR vs 3020 PEN): " + sc("3158") + " vs " + sc("3020"));
  console.log("SCORE " + nome + " (lendario 3171 CDR vs 3175 PEN): " + sc("3171") + " vs " + sc("3175"));
}
