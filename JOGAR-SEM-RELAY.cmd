@echo off
REM ============================================================
REM  ABRIR O JOGO no Chrome normal (sem flags).
REM
REM  NOTA (2026-10-18): este atalho chamava-se "JOGAR-SEM-RELAY" e
REM  afirmava que "o relay e a causa do travamento". ISSO NAO ESTA
REM  PROVADO -- e a biseccao do dono diz o contrario: com o relay
REM  DESLIGADO o jogo continuou a travar. Ver AGENTS.md 10.4.
REM
REM  Foi limpo porque fazia duas coisas proibidas (REGRA 9):
REM   - passava --user-data-dir a apontar para o User Data REAL
REM     (foi assim que se invalidou a sessao e se apagaram binarios
REM      de extensoes em 2026-10-18);
REM   - fazia taskkill /IM bun.exe /F, matando TODO o bun da maquina;
REM   - e usava --load-extension, carregando uma SEGUNDA copia em vez
REM     de recarregar a que ja esta instalada.
REM ============================================================
echo A abrir o LoL Idle no Chrome (perfil normal, sem flags)...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "https://lolidle.com/jogar"
echo.
echo Feito.
echo Para recarregar a extensao depois de editar os ficheiros:
echo   powershell -NoProfile -ExecutionPolicy Bypass -File install\recarregar-extensao-uia.ps1 -ExtensionName "LoL Idle"
echo.
echo Para testar uma variante (biseccao do travamento):
echo   powershell -NoProfile -ExecutionPolicy Bypass -File install\aplicar-variante.ps1 -Variant sem-inject
