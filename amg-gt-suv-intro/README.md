# Mercedes-AMG GT SUV — intro scene prototype

> Non-commercial fan prototype. Mercedes-AMG, the AMG / Affalterbach emblem and the Mercedes star are trademarks of
> Mercedes-Benz Group AG.

Plain HTML / CSS / JS — no build step, no dependencies. Deployed on Vercel (project `amg-gt-suv-intro`,
Root Directory `amg-gt-suv-intro`).

- `index.html` — page shell (canvas stage, key-fob entry screen, HUD)
- `js/config.js` — timeline, FX and asset config (`window.INTRO_CONFIG`)
- `js/intro.js` — canvas compositor; every visual is a pure function of the timeline clock `render(t)`
- `js/t1.js`, `js/t1loop.js` — T1 launch segment (WebGL) and the endless S1 road loop
- `css/style.css` — layout, key-fob entrance / exit, HUD, scroll cue
- `assets/` — layers (hd / sd), audio, video, sequences, loop plates, UI

Run locally: `python3 -m http.server` in this folder, then open `http://localhost:8000/` (`?nofob` skips the key fob).
