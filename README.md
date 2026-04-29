# RepLab - Mobile Fitness Tracker

A mobile-first workout tracking app built with React + Node.js/Express + JSON persistence.

## Quick Start

```bash
# Install all dependencies
npm install
npm run install:all

# Start development (runs both client and server)
npm run dev
```

- **Client**: http://localhost:5173
- **Server**: http://localhost:3001

## Default Demo Schedule

| Day | Workout |
|-----|---------|
| Mon | Push    |
| Tue | Pull    |
| Wed | Rest    |
| Thu | Legs    |
| Fri | Push    |
| Sat | Pull    |
| Sun | Rest    |

## Reset Database

Delete `server/replab.json` and restart the server. The seed data will be recreated automatically.

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS + React Router v6
- **Backend**: Node.js + Express + JSON file persistence
- **Auth**: bcrypt + JWT
