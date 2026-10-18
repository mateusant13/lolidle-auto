# How to auto-install / UPDATE an unpacked Chrome extension (VOD.RIP mechanism)

Canonical installer (verified on disk 2026-09-20): `I:/!aicompanion/VOD.RIP/scripts/cookie_extension_auto_install.ps1`
(**1178 lines**, sha256 `664069de6718fa0550a5bfb4c219a805c0f54556defe2175d5bb32431b61c51a`); an identical copy ships in
`I:/!aicompanion/VOD.RIP/_internal/scripts/`. The older relative form `VOD.RIP/backend/scripts/...` does not exist.
Proven, production-grade silent installer (BCL/UIA only, no deps): `-ExtensionDir <folder>` installs a FIRST-TIME
unpacked extension with zero keyboard, zero focus steal, on-screen alpha-0 window (~5-9 s of script time).

## The one thing to know first: "Load unpacked" does NOT update

**Measured 2026-09-20: `-Force` (re-driving "Load unpacked") does not update an extension that is already
loaded.** Chrome refuses the duplicate; and with a `\`-separated path the profile check matches the OLD record
and reports `installed:true` (false-OK). Moving files in place changes nothing until Chrome re-reads them.

The update path that DOES work is the extension reloading ITSELF:

1. `python I:/!manager/tools/bg-window.py open --url "<page that the content script runs on>" --label <label>`
   (for flow-helper: `https://labs.google/flow`).
2. From the content script's isolated world, over the local CDP relay, open the extension's own bootstrap page:
   `bun I:/!manager/tools/ext-reload-cdp.mjs --target <page target id> \
      --expr "window.open(chrome.runtime.getURL('reload-bootstrap.html'))" --context-origin chrome-extension://<id>`
   (`Target.attachToTarget{flatten:true}` + `Runtime.evaluate` with the `sessionId`; `ws://127.0.0.1:9224/cdp`).
3. Click the bootstrap button by UIA (InvokePattern) in the alpha-0 window:
   `powershell -File I:/!manager/tools/ext-reload-uia-click.ps1 -NameContains "Recarregar extensão e abas"`.
   The page runs `setTimeout(400ms)` -> `chrome.runtime.reload()`.
4. Verify: `%LOCALAPPDATA%\Google\Chrome\User Data\Default\Secure Preferences` -> `extensions.settings[id]`
   `version` + `scriptable_host`, then re-probe the DOM after a fresh page load.

Tool paths (durable, promoted out of `state/tmp/` on 2026-09-20):
`I:/!manager/tools/ext-reload-cdp.mjs` (111 lines, sha256 `15e214b11787348b...`, CDP driver: `:1`, `:6-8` usage,
`:11-13` modes) and `I:/!manager/tools/ext-reload-uia-click.ps1` (55 lines, sha256 `0e63b057b321a1d8...`,
UIA Invoke by accessible name — no cursor movement, no keystrokes, no other window touched).
`I:/!manager/state/tmp/` copies are throwaway; never point a runbook at them.

### Prerequisite: the extension needs the bootstrap page

No `reload-bootstrap.html` -> not reloadable this way. `flow-helper` has it; `adslib-live` now has it too
(`I:/!produtos202608/BrandOps/dashboard/extension/adslib-live/reload-bootstrap.html` + `reload-bootstrap.js`,
mirroring flow-helper exactly, listed in `manifest.json` `web_accessible_resources`). Prove it is served:
open `chrome-extension://<id>/reload-bootstrap.html` and check the button renders (measured: title
`Adslib Bootstrap`, `reloadButton: true`, extension id `bafklmpfblecp…` for the adslib-live path below).

## UPDATE by re-running the install — VERIFIED 2026-10-13 (contradicts the 2026-09-20 note above)

**Re-running the installer with `-Force` DOES update (reload) an already-loaded unpacked
extension.** The 2026-09-20 note above ("Load unpacked does NOT update") does not hold on the
current Chrome (154) / installer: Chrome re-reads the folder and reloads it.

Clean test (owner machine, 2026-10-13; content-script-only change, `manifest.json` untouched):

1. Edit a file the extension's content script loads (add a visible marker).
2. `powershell -NoProfile -ExecutionPolicy Bypass -File <installer> -ExtensionDir <dir> -Browser chrome -Force`
3. Reload a page the extension matches.
4. The NEW content-script code is live (the marker appears). Repeating step 2 with
   no file change is a no-op for the user.

So the simplest, focus-safe update is just **re-running the install** — no
`chrome://extensions` visit, no reload button. The self-reload recipe below
(steps 1-4) is now only the fallback for cases where re-running the install is
not possible.

## Installer rules (all of them are traps)

1. **Normalize the path before it is typed.** The picker dialog receives the `-ExtensionDir` string VERBATIM.
   Drive lowercase + forward slashes (`l:/!produtos202608/...`, `/i/produtos...` from Git Bash) makes Chrome answer
   **"Nome de pasta inválido" / "Invalid folder name"** (owner-reproduced 2026-09-20). The script now normalizes
   once (`ConvertTo-NativeWinPath`, `:137`) — uppercase drive, MSYS `/i/...` and `/cygdrive/i/...` converted,
   `/` -> `\`, doubled separators collapsed (UNC preserved), trailing separator dropped — and ABORTS before any
   window opens when the result is not a real drive (`:303-318`, json `code:"bad_path"`, rc **2**).
2. **The exit code is meaningful now; the JSON is the source of truth.** `0` installed/reloaded/idempotent,
   `1` generic UIA failure, `2` bad path (format/missing manifest, nothing opened), `3` the folder dialog itself
   refused the path or lost its state. Parse the JSON line, never the rc alone.
3. **Idempotent shortcut:** an already-installed path returns `installed:true` + `version` in ~2-3 s, zero windows
   (`:155` `Test-ExtInProfile`, `:174` `Get-ExtProfileEntry`). Updates still need step 4 below.
4. **Detecting the install later:** Secure Preferences `extensions.settings` lookup by `path` (an unpacked
   extension's ID is a hash of that path). Compare with `Get-NormalExtPath` (separator-normalized) on BOTH sides;
   the JSON reports `path` AND `version` so a caller can tell "installed" from "updated".
5. **No alternative profile, ever.** No `--user-data-dir`, no temporary/new profile, no harness headless. The
   install runs in the owner's REAL profile.
6. **Focus.** The spawned window is on-screen + alpha-0 and foreground is bounced back to the owner's window;
   the folder picker also activates, so the guard now runs for the whole drive (`DrivePicker(..., userFg)`, `:606`)
   and the run is deadlined by `-TimeoutSec` (default 120 s, `:73`) so a wedged picker cannot strand a hidden
   window or block the caller.
7. **A refused dialog must not be clicked through.** `PickerReject` (`:777`) scans the dialog's own window text
   (children + UIA) for `inválido|invalid folder`; on a hit `DrivePicker` returns `REJECTED:<dialog text>` without
   pressing the commit button, and the run prints a two-cause diagnosis and exits **3** (`:1171-1175`). The old
   code BM_CLICKed blind and only looked "installed" by re-reading the stale profile entry.

Diagnostic the script prints when the picker refuses (stderr, JSON carries the same fields):

```
auto-install: PICKER REJECTED -- <the dialog's own text, e.g. Nome de pasta inválido>
auto-install: path typed = I:\!produtos202608\BrandOps\dashboard\extension\adslib-live
auto-install: cause (a) path format -- the dialog refuses anything that is not native Windows form (lower-case drive, forward slashes, relative path); -ExtensionDir is normalized before the run, so a mismatch here means the input was mutated after normalization.
auto-install: cause (b) focus/state loss -- the owner clicked or typed while the dialog was open and it dropped its state; the root cause is the auto-install window/picker holding the foreground (measured 8.2s picker foreground hold; the drive now bounces it back).
```
plus, on stdout, one JSON line:
`{"ok":false,"installed":false,"code":"picker_rejected","error":"...","dialog_text":"<observed>","normalized_path":"I:\\...","hint":"<both causes>"}`.
Causes (a) and (b) are reported SEPARATELY — never collapse them into one guess.

## CDP limits (learned the hard way)

- A `chrome-extension://` page is **not attachable** by the relay; `bg-window.py` cannot identify its target and
  returns `{ok:false}` — indistinguishable from a total failure. Do not read that as "extension missing".
- A tab that merely CONTAINS a `chrome-extension://` **iframe** kills the CDP session ("Detached while handling
  command"). The bootstrap page must be opened with `window.open` into its OWN tab.
- Chrome 137+ refuses `--remote-debugging-port` on the REAL profile (account revocation) — CDP is only reachable
  through `bg-window.py`'s relay (`ws://127.0.0.1:9224/cdp`), which is why the 4-step recipe is relay-bound.

## Guardrails that make it safe

On-screen alpha-0 (never off-screen, never hidden), focus bounce to the owner's window, posted-keys-only,
UIA SetValue/Invoke, JSON-parse prefs, verify-by-profile, single JSON result line on stdout, hard `-TimeoutSec`
deadline, stray-picker sweep in `finally`.

## Measured (2026-09-20, real profile)

| flow | wall | windows | foreground moved off the owner |
|---|---|---|---|
| idempotent (`installed:true`) | 2.3 s | 0 | none |
| full UIA install (`-Force`) | 8.9-12.9 s | 1 (alpha-0) | spawn 0.04 s + click 1.5 s + picker ~8-9 s (before the in-drive guard) |
