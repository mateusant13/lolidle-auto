
import fs from 'node:fs';
const base = process.env.LOCALAPPDATA + '\\Google\\Chrome\\User Data';
const j = JSON.parse(fs.readFileSync(base + '\\Default\\Secure Preferences', 'utf8'));
const s = j.extensions.settings;
const ids = ['cfhdojbkjhnklbpkdaibdccddilifddb','clngdbkpkpeebahjckkjfobafhncgmne','cnojnbdhbhnkbcieeekonklommdnndci','ddkjiahejlhfcafbddmgiahcphecmpfh','eimadpbcbfnmbkopoojfekhnkhdbieeh','gighmmpiobklfepjocnamgkkbiglidom','pkehgijcmpdhfbdbbnkijodmdjhbjlgp','dpacanjfikmhoddligfbehkpomnbgblf','majdfhpaihoncoakbjgbdhglglocklcgno'];
for (const id of ids) {
  const v = s[id];
  console.log((v && v.manifest && v.manifest.name || '(sem nome)').padEnd(45) + ' ' + id);
}
