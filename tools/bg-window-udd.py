#!/usr/bin/env python3
"""bg-window-udd.py - wrapper do bg-window.py que abre a janela no PERFIL CERTO.

Porque existe (2026-10-22): o `bg-window.py open` corre
`chrome.exe --new-window <url>` sem `--user-data-dir`. No PC do dono o Chrome
real corre com `--user-data-dir="C:\ChromeDebugProfile"`; sem essa flag o
Chrome abre uma SEGUNDA instancia no perfil padrao. Foi assim que a extensao
foi instalada no perfil errado (o dono viu e reclamou).

O VOD.RIP ja resolveu isto (`cookie_extension_auto_install.ps1:224-260`):
passar `--user-data-dir=<o do processo que ja corre>` faz o `--new-window`
ser entregue a INSTANCIA VIVA, no perfil certo, sem matar nada.

Uso:
  BG_UDD='C:\\ChromeDebugProfile' python tools/bg-window-udd.py open --url about:blank --label x --uia
  python tools/bg-window-udd.py fg
  python tools/bg-window-udd.py close --target <id>

Qualquer subcomando que nao seja `open` e' delegado tal e qual ao bg-window.py.
"""
from __future__ import annotations

import argparse
import importlib.util
import os
import sys
import types
from pathlib import Path

BG_PATH = os.environ.get("BG_WINDOW_PY", r"I:\!manager\tools\bg-window.py")
UDD = os.environ.get("BG_UDD", "").strip()


def carregar_bg():
    spec = importlib.util.spec_from_file_location("bg_window", BG_PATH)
    if spec is None or spec.loader is None:
        raise SystemExit(f"nao consegui carregar {BG_PATH}")
    mod = importlib.util.module_from_spec(spec)
    sys.modules["bg_window"] = mod
    spec.loader.exec_module(mod)
    return mod


def main() -> int:
    argv = sys.argv[1:]
    if not argv or argv[0] != "open":
        bg = carregar_bg()
        sys.argv = [BG_PATH] + argv
        return bg.main()

    # `open`: parseamos so o que o cmd_open usa. O bg-window.py nao conhece
    # --user-data-dir; a flag e' injectada no Popen, nao no parser dele.
    ap = argparse.ArgumentParser(prog="bg-window-udd.py open")
    ap.add_argument("--url", required=True)
    ap.add_argument("--label", default="probe")
    ap.add_argument("--uia", action="store_true")
    ap.add_argument("--relay", default="http://127.0.0.1:9224")
    ap.add_argument("--chrome", default="C:/Program Files/Google/Chrome/Application/chrome.exe")
    ns = ap.parse_args(argv[1:])
    ns.cmd = "open"

    if not UDD:
        print('{"ok":false,"err":"BG_UDD vazio: sem --user-data-dir o Chrome abre no perfil padrao"}')
        return 2

    bg = carregar_bg()

    # Proxy de subprocess: so a linha do Chrome `--new-window` leva a flag.
    #
    # MEDIDO (2026-10-23): com o Chrome do dono JA a correr, `chrome.exe
    # --user-data-dir=<perfil> --new-window <url>` sai com codigo **21**
    # (`RESULT_CODE_NORMAL_EXIT_PROCESS_NOTIFIED`): a linha de comandos foi entregue a
    # instancia viva e o processo novo saiu, mas a instancia NAO cria janela nova (o
    # hand-off do singleton leva o URL, nao o `--new-window`). Resultado: nenhum hwnd
    # novo, `bg-window.py` responde "new chrome window not found" e o UIA nao tem onde
    # clicar. Lancar por `explorer.exe` (nivel medio) foi tentado: mesmo 21.
    # Ou seja: nao ha caminho de JANELA para o perfil em uso. A solucao definitiva e a
    # REGRA 11.3 (reload sem janela pelo service worker da propria extensao).
    real = bg.subprocess
    class SubprocessProxy(types.SimpleNamespace):
        def __getattr__(self, name):
            return getattr(real, name)
        def Popen(self, args, **kw):
            args = list(args)
            if args and os.path.basename(str(args[0])).lower() == "chrome.exe" and "--new-window" in args:
                if not any(str(a).startswith("--user-data-dir=") for a in args):
                    args.insert(1, f"--user-data-dir={UDD}")
            return real.Popen(args, **kw)

    bg.subprocess = SubprocessProxy()
    return bg.cmd_open(ns)


if __name__ == "__main__":
    raise SystemExit(main())
