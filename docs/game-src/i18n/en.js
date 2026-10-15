// i18n/en.js — LIDO DO JOGO VIVO em 2026-10-14 via https://lolidle.com/js/i18n/en.js (HTTP, sem browser).
// 468 bytes · sha256 6840946b5556fe3f86223620f79e4195de5a624d901baa035c7d7ac4429ec532 — Regra N.o 3: numero LIDO, nunca copiado.
// Dicionário português → inglês, juntando as partes do jogo (cada parte traduz os textos de alguns arquivos)
import jogo from './en-jogo.js';
import motor from './en-motor.js';
import cena from './en-cena.js';
import entrada from './en-entrada.js';
import paginas from './en-paginas.js';
import servidor from './en-servidor.js';
import dados from './en-dados.js';

export const EN = { ...dados, ...motor, ...cena, ...entrada, ...paginas, ...servidor, ...jogo };
