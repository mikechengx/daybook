# Daybook

A simple, low-pressure daily planner for families. A place for parents’ work, kids’ homework, and the everyday things around the house.

Daybook opens in English, with a Chinese language switch available in the header.

## What it does

- Create and rename your own lists, such as **Work must-dos**, **After-school things**, or **Around the house**.
- Open a list to add tasks, notes, family members, and optional reminder times.
- Choose **red for urgent**, **yellow for normal**, or **green for later**.
- Sort by priority, or drag tasks into your own order. Arrow buttons offer a keyboard-friendly alternative.
- Track partial progress with a small slider on every task.
- Attach up to three pictures to a task, and an optional cover picture to a list.
- Automatically carry unfinished tasks forward when you reopen the planner or leave it open past midnight. Progress and pictures come along.
- Export and restore backups containing lists, tasks, and pictures. Backups from the earlier Daynest version can also be imported.
- Use a layout that adapts to phones, tablets, and computers.

## Run it

There is no build step and no third-party runtime dependency.

Open `index.html` directly in a modern browser, or use Node.js 22+:

```sh
npm start
```

Then visit **http://localhost:4173**. Use the same address and browser each time to keep accessing the same stored data.

For static hosting, serve the repository root with `index.html` as the entry point. GitHub Pages can serve it from the root of the `main` branch after Pages is enabled in the repository settings.

## Data and reminders

Daybook stores your lists, tasks, and compressed pictures in IndexedDB in the current browser, with a browser-storage fallback. It shows a warning if a save fails. No task or image data is sent to a server.

This version has **no account system or cross-device synchronization**. Clearing browser data, changing browser profiles, changing website addresses, or using private browsing can affect access to local data. Export regular backups, especially before moving between the downloaded file, localhost, and a hosted site.

Reminder times use the device’s local time. Browser notifications require permission and an open page; closed-page push notifications are not included. Unfinished tasks roll forward on reopening or at midnight while the page is open. Completed tasks keep their original date.

Pictures are compressed locally to a maximum dimension of 1,200 pixels. GIFs become still images. Export the backup to preserve attachments separately from browser storage.

## Browser checks

The browser smoke check covers list creation and editing, priorities, ordering, task progress, image upload, IndexedDB persistence after refresh, rollover, image backup and restore, language switching, and phone layout overflow.

Run it with Node.js 22+ and a Chromium-based browser:

```sh
CHROME_BIN=/path/to/chrome npm test
```

The check uses an isolated temporary browser profile and writes screenshots and test results to a temporary directory. It does not use your everyday browser data.

## Project files

- `index.html` — the complete application, styles, and browser storage logic.
- `serve.mjs` — a dependency-free local static server.
- `tests/smoke.mjs` — browser checks using Chromium’s debugging protocol.

The starter lists and family names are examples. Edit or remove them to make the planner yours.
