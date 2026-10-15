/*
 * LoL Idle — Auto Poção · background.js (service worker MV3)
 *
 * Serve só para RECARREGAR a extensão sem clicar em chrome://extensions:
 * o Chrome cacheia o content script de extensão unpacked até um reload. Com
 * este worker, dá para disparar o reload de dentro da própria extensão:
 *
 *   - mensagem: chrome.runtime.sendMessage({ type: 'lolidle:reload' })
 *   - storage:  chrome.storage.local.set({ 'lolidleAutoPotion:reload': Date.now() })
 *
 * (O content script, no mundo isolado, pode chamar chrome.runtime.sendMessage;
 * o teste via CDP usa isso.)
 */
'use strict';

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'lolidle:reload') {
    chrome.runtime.reload();
    return true;
  }
  return false;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes['lolidleAutoPotion:reload']) {
    chrome.runtime.reload();
  }
});
