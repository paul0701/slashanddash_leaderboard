# Slash & Dash - Leaderboard Edition

This replaces the single-file drag-and-drop deploy with a small project folder,
because score validation now runs in a Netlify Function (server-side), which a
plain static-file upload can't include.

## One-time setup

1. Install Node.js if you don't have it already (nodejs.org).
2. Install the Netlify CLI:
   ```
   npm install -g netlify-cli
   ```
3. From inside this folder, log in and link it to your EXISTING slashanddash.online site:
   ```
   netlify login
   netlify link
   ```
   Pick "Use current git remote" or "Search by site name" and choose your
   existing site when asked - this keeps your current domain and settings.
4. Install the one dependency (Netlify Blobs client):
   ```
   npm install
   ```

## Deploying from now on

Every time you want to push a new version (including this first leaderboard one):

```
netlify deploy --prod
```

That's the whole workflow going forward - run that one command from this folder
instead of dragging index.html onto the Netlify dashboard. It uploads
index.html AND the functions together.

## What's new

- `netlify/functions/start-run.js` - issues a one-time token when a run begins
  and privately records the start time.
- `netlify/functions/submit-score.js` - validates a submitted score against how
  much time actually passed before accepting it onto the leaderboard, and the
  token can only be used once.
- `netlify/functions/get-leaderboard.js` - returns the current top 20.
- In-game "Leaderboard" button next to the theme switcher shows the live top 10.
- First time you finish a run, it'll ask for a name (max 16 characters) and
  remember it in this browser for next time.

## Storage

Scores are stored in Netlify Blobs, which is included with your Netlify account
at this scale - no extra service or signup needed.
