console.log('a importar sim-chefes...');
const S = await import('./sim-chefes.mjs');
console.log('importado. chaves:', Object.keys(S).length);
