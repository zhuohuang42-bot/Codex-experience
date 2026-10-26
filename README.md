# Study Journal

A calm, English-language website for study time and task planning.

- Start a study timer, then **Stop & save** to record a session.
- Browse the calendar to see daily totals and individual sessions.
- Add **Long-term** goals and **Short-term** tasks, check them off, reopen them, or delete them.
- Set an optional due date when adding a task, or click its date label to add, change, or remove the date later. Unfinished tasks show **Due today** or **Overdue** when appropriate.
- Progress is saved automatically in the current browser. Existing study history from the original version is preserved.

## Development

Requires Node.js 22.12+ (Node.js 20.19+ is also supported).

```sh
npm ci
npm run dev
```

The development server uses port 5173. `npm run build` produces a static site in `dist/`; `npm run preview` serves that build locally. If the default npm cache is not writable in the cloud environment, use `npm ci --cache /workspace/.cache/npm`.

## How your data works

- A running timer tracks real elapsed time even after switching tabs, refreshing, or closing the page. Click **Stop & save** when you finish studying.
- Sessions crossing midnight are split across local calendar dates, including daylight-saving changes. Calendar colors represent less than 30 minutes, 30–59 minutes, 1–2 hours, and 2+ hours of study.
- Task titles can contain up to 200 characters. Both task lists support completion, reopening, and deletion. Multiple tabs in the same browser synchronize changes.
- Due dates are calendar dates in your browser's local timezone. A task becomes overdue the day after its due date; completed tasks are not marked overdue. Existing undated tasks remain valid and do not receive an automatic deadline.
- Study history and tasks are stored separately in local storage, so adding tasks does not replace existing study records. The original study storage key remains unchanged for compatibility.
- Data stays in this browser; it does not sync across devices or browsers. Clearing site data or ending a private browsing session may remove it.
- **Export records** downloads daily study totals as a CSV for spreadsheets. Task lists are stored locally and are not included in this study-time export.

## Validation

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

If Chromium is already installed, skip the download and run:

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

Tests cover timer restoration, midnight and daylight-saving transitions, storage validation, English labels, both task categories, due-date editing and overdue status, task persistence, compatibility with existing records, concurrent tabs, safe text rendering, storage failures, exports, and mobile layouts.

## GitHub Pages

The workflow in `.github/workflows/deploy-pages.yml` tests, builds and deploys pushes to `main`. In repository **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**. Relative asset URLs support the `/Codex-experience/` project path.

Live site: <https://zhuohuang42-bot.github.io/Codex-experience/>

Publishing the Codex development environment saves that environment; GitHub Pages publishes the actual website. No personal access token needs to be added to this project.
