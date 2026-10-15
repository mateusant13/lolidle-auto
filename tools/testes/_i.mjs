try { await import('./w5-itens.test.mjs'); console.log('OK'); } catch (e) { console.log('ERRO: ' + e.message.slice(0,80)); }
