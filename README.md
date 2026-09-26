# Cleverferret design prototype

A responsive, browser-based product mockup for **Cleverferret**—a calm workspace for saving, organizing, and rediscovering useful knowledge.

## Run locally

The prototype has no build step or runtime dependencies. Serve the repository root with any static HTTP server:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Interactions

- Search the library by title, source, description, or tag.
- Filter the collection by content type.
- Toggle between grid and list layouts.
- Star saved items.
- Open the **Add to library** dialog and add a new item.
- Use the sidebar on desktop or the menu button on smaller screens.

## GitHub Pages

The workflow in `.github/workflows/pages.yml` publishes the static site on every push to `main` or `work`. It can also be run manually from the Actions tab.
