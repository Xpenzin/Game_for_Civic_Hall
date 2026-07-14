# Firewall Defense 

A browser-based tower-defense game about cybersecurity, built for the AI summer camp @ Civic Hall.

Malicious traffic (phishing, trojans, worms, DDoS, ransomware, and a zero-day boss) streams
across the network toward your server. Deploy defenses along the path to stop each threat.
Each defense only counters *some* threat types, so you have to combine them, just like
real defense-in-depth security. Every kill (and every breach) shows a one-line explanation of
the real-world threat and how to actually defend against it.

## How to play

Just open `index.html` in a browser or click the link in the "About" section of this repo— no install, no build step.

1. Click a defense card (Firewall, Antivirus, Spam Filter, Encryption/IDS) in the left panel.
2. Click an open tile on the grid (not on the glowing path) to deploy it.
3. Click **Start Wave** to send in the next wave of threats.
4. Click a deployed tower to see its info or sell it back for part of its cost.
5. Survive all 8 waves to secure the network. Your best result is saved locally.

## Running it locally

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Or just double-click `index.html` — it works with no server at all.

## Deploying with GitHub Pages

Settings → Pages → Deploy from branch → `main` / root. The game will be live at
`https://<username>.github.io/Game_for_Civic_Hall/`.

## Files

- `index.html` — page structure / UI
- `style.css` — dark "terminal" theme
- `game.js` — all game logic (grid, pathing, towers, waves, damage matchups, win/lose)

## AI disclosure

This game was built with the help of an AI coding assistant (Claude), which wrote the code
For the game design and cybersecurity concepts described above.
