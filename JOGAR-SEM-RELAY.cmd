@echo off
REM ============================================================
REM  JOGAR SEM O RELAY — o relay (omp browser-relay) e a causa do
REM  travamento (biseccao: mesmo perfil, mesmas 58 extensoes, mesmo
REM  Chrome 155 -> sem relay NAO trava; com relay trava a t=4s).
REM  Este atalho derruba o relay e abre o jogo com a NOSSA extensao.
REM ============================================================
echo A derrubar o relay (a causa do travamento)...
taskkill /IM bun.exe /F >nul 2>&1
taskkill /IM omp.exe /F >nul 2>&1
timeout /t 2 /nobreak >nul
echo A abrir o LoL Idle com a extensao (sem relay)...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="%LOCALAPPDATA%\Google\Chrome\User Data" --load-extension="I:\!lolidle.com\extension" "https://lolidle.com/jogar"
echo.
echo Pronto. Se o jogo travar, o relay voltou a ligar-se — corre este atalho outra vez.