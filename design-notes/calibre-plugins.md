# Running calibre plugins in CleverFerret

Question: can CleverFerret use calibre plugins, starting with the nine in
[Kaleaon/calibre_plugins](https://github.com/Kaleaon/calibre_plugins), with their
desktop dialogs reformatted for a phone?

Short answer: **yes for all nine of your plugins, no for "any calibre plugin" in general.**
Your plugins are built in a way that makes this practical. Most third-party plugins are not.

Prototype: `docs/app.dc.html?screen=plugins` (Settings → Calibre plugins).

## What the plugins look like inside

Every plugin in the repo is split into a **core** and a thin **calibre/Qt layer**:

| Plugin                  | Core (no calibre or Qt imports)                      | Glue (calibre + Qt)        | Core needs                                                                          |
| ----------------------- | ---------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------- |
| Takeout Book Fixer      | `plugin/core.py` (195 lines)                         | `action.py`, `importer.py` | stdlib; PyMuPDF optional; poppler CLI (`pdfinfo`, `pdftotext`, `pdftoppm`) for PDFs |
| EPUB Promo Scrubber     | `scrubber_plugin/core.py` (407)                      | `action.py`                | stdlib + lxml                                                                       |
| Reddit Story Follower   | `reddit/core.py` (1,012), `login.py` (165)           | `action.py`, `ui.py`       | stdlib; `login.py` runs a local web server on 127.0.0.1 for OAuth                   |
| Gemini Library Fixer    | `gemini/engine.py` (513)                             | `action.py`                | stdlib (urllib)                                                                     |
| Media Matcher           | `media/matching.py`, `sources.py`, `tags.py` (1,318) | `action.py`                | stdlib (own ID3/FLAC/MP4 tag readers); optional `fpcalc` binary for AcoustID        |
| Story Collection Tagger | `tagger/rules.py`, `fff_sites.py` (285)              | `action.py`                | stdlib                                                                              |
| Fanfic Site Downloader  | `fanfic/engine.py` (197), `flaresolverr.py` (254)    | `action.py`, `ui.py`       | FanFicFare (pure Python); FlareSolverr (a headless-browser service) for Royal Road  |
| Nifty Downloader        | `nifty/core.py` (645)                                | `action.py`, `ui.py`       | stdlib                                                                              |
| Metabods Downloader     | `metabods/core.py` (200)                             | `action.py`, `ui.py`       | stdlib                                                                              |

Shared code follows the same split: `common/storykit.py` (fetching, cleaning, EPUB building) is pure
Python; `common/libkit.py` and `common/guikit.py` are the calibre and Qt halves.

The glue layer only touches a small part of calibre. Across all nine plugins it calls about 20 methods
on calibre's library API (`db.new_api`): `add_books`, `add_format`, `remove_formats`, `format`,
`formats`, `format_abspath`, `save_original_format`, `get_metadata`, `set_metadata`, `field_for`,
`all_field_for`, `set_field`, `set_cover`, `cover`, `all_book_ids`, `has_id`, `create_book_entry`,
`remove_books`. It also uses `Metadata`, `JSONConfig`, `parse_date`, and four GUI hooks: selected
book IDs, refresh the library view, recount tags, and the status bar. The repo's own tests already
stub most of this (`tests/test_plugin_imports.py`, `tests/test_qt_dialogs.py`).

## Options

### 1. Run the cores on the phone (recommended)

- **Python runtime.** [Chaquopy](https://github.com/chaquo/chaquopy) embeds CPython in an Android app
  through Gradle. It is MIT-licensed. [Version 17.0](https://chaquo.com/chaquopy/doc/current/versions.html)
  supports Python 3.10–3.14 on Android API 24 and up. Pure-Python packages install from PyPI as
  normal. Chaquopy's [package index](https://chaquo.com/pypi-13.1/) has Android builds of `lxml` and
  `brotli`, but none of PyQt, PySide, PyMuPDF or Chromaprint.
- **calibre shim.** A small `calibre` package, written for CleverFerret, implements the roughly 20
  library methods above. It forwards them over a Kotlin bridge to the app's Room database and
  storage. `Metadata` maps to the app's media model and `JSONConfig` maps to DataStore. The existing
  test stubs are a starting point.
- **No Qt.** Qt can't run here, so each plugin's `action.py` and `ui.py` are replaced by a
  **manifest**: a list of settings fields and actions that CleverFerret draws with its own
  components. `PLUGINS` in `docs/cf-system.js` is a draft of that format.
- **Background work.** `guikit.run_task` (a function run on a thread that checks for cancel and
  reports status) maps directly onto WorkManager, with progress shown in a notification.

Per-plugin work on Android:

| Plugin                                  | What changes                                                                                                                                                          |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Takeout Book Fixer                      | Swap the poppler calls for Android `PdfRenderer` (rendering pages) and a Kotlin text probe, called through the bridge.                                                |
| Reddit Story Follower                   | "While Calibre is open" polling becomes a periodic WorkManager job. "Log in with Reddit" uses a Custom Tab and an app-link redirect in place of the 127.0.0.1 server. |
| Gemini Library Fixer                    | Keep the API key in the Android Keystore. The app passes cover images in through the bridge.                                                                          |
| Media Matcher                           | AcoustID fingerprinting stays off until Chromaprint is compiled for Android. Everything else runs as is.                                                              |
| Fanfic Site Downloader                  | FlareSolverr needs a headless browser and can't run on a phone. Keep it on a computer or NAS and point the plugin at its URL (the setting already exists).            |
| Promo Scrubber, Tagger, Nifty, Metabods | No changes beyond the shim.                                                                                                                                           |

Cost: Chaquopy adds the Python runtime and standard library to the APK (tens of MB, more with
lxml). Chaquopy's documentation covers how to trim what gets packaged.

### 2. Native Kotlin ports

CleverFerret already has partial Kotlin versions of several of these:
`services/webfiction/RedditStoryManager.kt`, `MetabodsTagService.kt`, `UniversalTagService.kt`,
`services/fanfiction/*` and `services/gemini/GeminiService.kt`. Finishing those ports avoids
shipping Python, but every plugin then has two implementations to keep in step. Option 1 runs the
same Python on desktop and phone.

### 3. A calibre companion on a computer or NAS

Use this for plugins that can't run without calibre itself. The phone sends jobs to a real calibre
install, using `calibredb`, `ebook-convert`, `fetch-ebook-metadata` or a small bridge plugin, and
shows the results. It gets close to "any plugin" for headless work, but it needs a machine that is
always on.

## Other calibre plugins

| Type                                                           | Route                                                                                                                       |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Plain-Python logic with a thin GUI (like all nine above)       | Option 1, once someone writes the manifest                                                                                  |
| Metadata sources                                               | Option 1 with a larger shim (calibre's `Source` base class, its browser, lxml parsing). Feasible, but test each plugin.     |
| Conversion (input/output), file type, catalog, Edit Book tools | Option 3. They depend on calibre's conversion engine and C extensions.                                                      |
| Interface plugins built around Qt dialogs                      | No generic route. Port them one at a time, or skip the ones that duplicate app features (duplicates, stats, reading lists). |

## Turning Qt dialogs into mobile screens

The desktop dialogs use about a dozen widget types, and each has a counterpart already in the
prototype:

| Qt                                                                | CleverFerret pattern                      | Where to see it                 |
| ----------------------------------------------------------------- | ----------------------------------------- | ------------------------------- |
| `QProgressDialog` + worker thread                                 | Notification plus an in-app progress card | Downloads → In progress         |
| `QTreeWidget` review list with checkboxes (Gemini, Media Matcher) | Candidates plus per-field checkboxes      | Fix match                       |
| `QTableWidget` of followed series (Reddit)                        | Status rows with actions                  | Import inbox                    |
| `QListWidget` of favourite tags or categories                     | Multi-select chips                        | Plugins → Media Matcher         |
| `QCheckBox` options                                               | Switch rows (`role="switch"`)             | Plugins, Sort rules             |
| `QComboBox` / `QRadioButton` groups                               | Segmented control                         | Plugins → Reddit Story Follower |
| `QLineEdit` (keys, URLs)                                          | Text or password field                    | Plugins → Gemini Library Fixer  |
| `QPlainTextEdit` log                                              | Collapsible log sheet                     | (planned)                       |
| `QSplitter` two-pane review                                       | Stacked sections; side by side on tablet  | Fix match                       |
| Preview before applying (Tagger, Scrubber)                        | Before / after toggle                     | File repair → Preview           |

## Licensing

Things to check, not legal advice:

- calibre is GPL-3.0. A shim that copies calibre code would carry that licence; a shim written from
  scratch against the method names would not.
- FanFicFare is GPL-3.0 (check its LICENSE before bundling). CleverFerret is Apache-2.0, and putting
  GPL code inside the APK affects how the combined app can be distributed. Downloading plugins at
  runtime is one way to keep them separate, but it should be checked.
- `Kaleaon/calibre_plugins` has no LICENSE file yet. Add one so it's clear what the app may bundle.
- Two plugins download from adult archives. The prototype hides them until 18+ sources are allowed
  in Settings → Parental.

## Suggested order

1. Add Chaquopy to `CleverFerret/` and get Story Collection Tagger running through the shim (no
   network, no Qt, small). This proves the bridge.
2. Promo Scrubber (lxml) and Media Matcher (network plus tag readers).
3. Reddit Story Follower with WorkManager and the Custom Tab login. Then decide whether
   `RedditStoryManager.kt` is retired or kept.
4. Gemini Library Fixer feeding the Fix match screen.
5. The download plugins, then Takeout Book Fixer once PDF handling is on the bridge.
6. Only then consider third-party metadata-source plugins.
