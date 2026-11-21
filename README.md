# Boyfriend Improvement Plan 💞

A relationship betterment app — be a more thoughtful, consistent partner, one small thing at a time.

## Features

| Screen | What it does |
| --- | --- |
| **Today** | Dashboard: text to send, upcoming reminders, daily habits, reassurance of the day, this week's challenge, top compliment, a favorite to remember, a question to ask tonight |
| **Reminders** | Repeating reminders by time and day, with in-app and browser pop-up notifications |
| **Tone Helper** | Paste a text and it flags phrases that could land badly (blame, "always/never", ALL CAPS, dry replies…), then rewrites it as warmer, calmer, apologetic, supportive, direct, playful or flirty. Includes an "I feel… when… because… could we…" builder. Runs entirely in the browser |
| **Daily Texts** | Ready-made good morning / good night / thinking of you / encouragement / missing you / playful / appreciation texts, plus your own. One tap to copy or open Messages |
| **Reassurance** | A library of reassuring lines plus "say this in this moment" scripts |
| **Compliment Jar** | Save compliments that landed, rate how much she loved them (1–5 ❤️), sort by most loved, pull a random one weighted toward the favorites |
| **Favorites** | Her favorite things by category: food, flowers, music, sizes, wishlist, important dates, people, and more |
| **Connect** | Call / FaceTime / text buttons, a question deck, voice-note prompts, phone date ideas |
| **Growth Plan** | 12-week plan with a theme and 3 challenges a week, plus a daily habit checklist with streaks |
| **Display mode** | Full-screen rotating slides for a wall or desk screen |

## Run it locally

No build step and no dependencies. From this folder:

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080.

## Put it on GitHub (and your digital screen)

1. Create a new repository on GitHub (e.g. `boyfriend-improvement-plan`).
2. In this folder:
   ```bash
   git init
   git add .
   git commit -m "Boyfriend Improvement Plan"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/boyfriend-improvement-plan.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, choose `main` and `/ (root)`, then save.
4. After a minute it's live at `https://YOUR-USERNAME.github.io/boyfriend-improvement-plan/`.
5. On the digital screen, open **`https://YOUR-USERNAME.github.io/boyfriend-improvement-plan/?display`** (or add `#display` to any link) — it boots straight into display mode. Press `Esc` (or hover and click ✕) to exit, arrow keys to change slides.

## Your data

Everything is saved in the browser you're using (`localStorage`) — nothing is sent anywhere, and nothing personal is stored in the GitHub repo. Because of that, your phone and your display screen each keep their own copy. To move your data to the screen, use **Settings → Export data** on one device and **Import data** on the other.

> Note: a GitHub Pages site is public, but it only contains the app itself. Your favorites, compliments and names live only in your own browsers.

## Customize

All built-in content (texts, reassurances, questions, the 12-week plan, habits, default reminders) lives in [`data.js`](data.js). `{name}` is replaced with your partner's name.
