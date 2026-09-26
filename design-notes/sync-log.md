repo: Kaleaon/CleverFerret
branch: main
path: CleverFerret/src/main/java/com/universalmedialibrary/ui

## Last sync
date: 2026-09-26T14:43:31Z

### Updated in this project
- Added a phone prototype (`CleverFerret App.dc.html`) with working navigation across 9 screens and an in-app Theme Studio.
- Sweep Console now wraps every screen in an LCARS frame whose rail is the navigation.
- Discover and Search recreated from the repo. Downloads is a new design.

## Screen map
| Project screen | Repo source |
| --- | --- |
| Home | ui/modern/home/ModernHomeScreen.kt, ui/modern/components/Scaffolding.kt, SharedComponents.kt (MiniPlayer) |
| Library (phone / tablet) | ui/modern/library/ModernLibraryScreen.kt, ui/modern/domain/Models.kt |
| Discover | ui/modern/discover/ModernDiscoverScreen.kt |
| Search | ui/modern/search/ModernSearchScreen.kt |
| Audio player | ui/modern/player/ModernAudioPlayerScreen.kt |
| Reader | ui/modern/reader/ModernReaderScreen.kt, docs/THEMING.md (Day/Sepia/Night) |
| Settings | ui/modern/settings/ModernSettingsScreen.kt |
| Theme Studio | ui/modern/theme/ModernThemePickerScreen.kt (extended to layout / colour / effect tabs) |
| Tokens / type | ui/modern/theme/CFTokens.kt, CFTheme.kt, ui/theme/UnifiedThemeSystem.kt, MetallicColors.kt |
| Downloads, TV preview | new |

## Other sources
- Kaleaon/linkpoint-design (main): docs/react/src/theme/palettes.js, layouts.js, look.js, color.js, components/ConsoleFrame.jsx
- Kaleaon/Ktheme (main): theme-creator/src/index.css (spec-sheet and prototype chrome)

## Sync history
- 2026-09-26T14:20:07Z: spec sheet built (Home, Library, Player, Reader, Settings, tablet, TV previews).
