# IBD Tracker

Live at <https://track-your-ibd.netlify.app>.

Track your IBD: bathroom trips, symptoms, food (with carbs, protein, fat and fibre ratings), water, sleep, exercise, medicines, vitamins and supplements, and (optionally) periods. It shows an estimated activity score (SCCAI for ulcerative colitis, Harvey-Bradshaw for Crohn's) with charts in the Trends tab.

No accounts and no server. Everything a person enters is stored in their own browser (IndexedDB) and never leaves their device. People back up by saving a file to Google Drive, iCloud Drive or Files.

## Files

| File | What it is |
|---|---|
| `index.html` | The app page |
| `styles.css` | All styling (light and dark mode) |
| `app.js` | All app logic |
| `privacy.html` | Privacy note |
| `manifest.webmanifest` | Lets phones and computers install it as an app |
| `sw.js` | Makes it work offline |
| `_headers` | Security settings Netlify applies to the site |
| `_redirects` | Keeps this README and `docs/` off the website |
| `fonts/` | The Nunito font (SIL Open Font License, see `fonts/OFL.txt`) |
| `icons/` | App icons |

## Contact email

The privacy page lists rajatjoshi1518@gmail.com for questions. To change it, edit the "Contact" line near the bottom of `privacy.html`, then publish an update (below).

## Publish on Netlify (free)

1. Go to <https://app.netlify.com> and sign up.
2. Choose **Add new project › Deploy manually**.
3. Drag this whole `ibd-tracker` folder onto the page. After a few seconds you get a web address like `random-name-123.netlify.app`.
4. Rename it: open the project, then go to **Project configuration › General › Project details › Project information** and choose **Manage project name and cover image**. (Shortcut: **Project overview › Customize › Manage project name and cover image**.) Pick a name, for example `ibd-tracker` or `trackyouribd`. Your address becomes `https://ibd-tracker.netlify.app` (if that name is free).
5. Open the address on your phone and install it:
   - Android (Chrome): ⋮ menu › **Add to Home screen**
   - iPhone (Safari): Share › **Add to Home Screen**
   - Mac (Safari): **File › Add to Dock**; (Chrome): the install icon in the address bar

## Publishing an update

1. Open `sw.js` and change the `VERSION` line, for example `ibd-tracker-2026-10-01-4` to `ibd-tracker-2026-10-02-1`. Without this, installed copies keep the old version.
2. In Netlify, open your project › **Deploys**, and drag the folder onto the page again.

People with the app open see "A new version of IBD Tracker is ready" with an **Update** button.

## Try it on your Mac before publishing

```bash
python3 -m http.server 8000 --directory "/Users/rajatjoshi/Library/CloudStorage/OneDrive-Personal/Apps/ibd-tracker"
```

Then open <http://localhost:8000>. Offline mode is turned off on localhost so changes show up straight away.

## Moving data from the old UC Daybook

In the old version, go to **More › Download backup (.json)**. Then in IBD Tracker, go to **More › Restore from backup** and pick that file.
