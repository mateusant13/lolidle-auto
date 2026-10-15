// Dicionário português → inglês, juntando as partes do jogo (cada parte traduz os textos de alguns arquivos)
import jogo from './en-jogo.js';
import motor from './en-motor.js';
import cena from './en-cena.js';
import entrada from './en-entrada.js';
import paginas from './en-paginas.js';
import servidor from './en-servidor.js';
import dados from './en-dados.js';

export const EN = { ...dados, ...motor, ...cena, ...entrada, ...paginas, ...servidor, ...jogo };

