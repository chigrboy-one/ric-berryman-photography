# Studio — in-page image editor (v3 galleries)

Drag-and-drop image management that runs **locally in Chrome/Edge** and writes
real files you then commit + push to publish.

## Turn it on
Open any wired gallery page on the local server and add `?edit`:

    http://localhost:<port>/dance-archive-v3.html?edit

(Stays on for the session via a localStorage flag. To turn off, run
`localStorage.removeItem('rbEdit')` in the console, or open the page without
`?edit` in a fresh tab.)

A bar appears at the bottom: **drag to reorder · drop files to add · × to remove**.

## What you can do
- **Reorder** — drag any tile; the grid reflows live.
- **Add** — drag image files from Finder onto the grid. They appear outlined
  in red (not yet on disk until you Save).
- **Remove** — hover a tile, click the × .
- **Save** — first Save asks you to pick the **project root folder** once
  (the worktree folder). It then:
    - copies any newly-added images into the gallery's asset folder, and
    - writes the order to `data/galleries/<gallery>.json`.
  Chrome remembers the folder, so later Saves are one click.

## Publish
Saving only writes to your disk. To put changes live:

    git add -A && git commit -m "Curate <gallery>" && git push
    # then merge to main (Netlify deploys on merge)

## How pages read it
`assets/js/gallery-render.js` loads on every page and, for any element with
`data-gallery="<id>"`, fetches `data/galleries/<id>.json` and renders the grid
from it. If no manifest exists yet, the static markup already in the page is
used as-is (nothing breaks).

## Wiring a new gallery
1. On the container element add: `data-gallery="my-id" data-gallery-dir="assets/images/my-folder"`
2. Include the two scripts before `</body>`:
   `<script src="/assets/js/gallery-render.js"></script>`
   `<script src="/assets/js/gallery-edit.js"></script>`
3. (Optional) seed `data/galleries/my-id.json` from current markup.

Currently wired: **dance-archive-v3** (proof of concept). Beauty/Abandoned
archives, Field Notes "Full Take" grids, and editorial figure sequences are
the next to wire.
