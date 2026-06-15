# QR Rest

QR-based contactless food ordering system for restaurants. Guests scan a table QR code to browse the menu, place orders, and pay online. Staff use role-based interfaces for waiters, kitchen, and administrators.

## Repository structure

| Folder       | Description                                      |
| ------------ | ------------------------------------------------ |
| `frontend/`  | React + Vite client app                          |
| `backend/`   | Node.js + Express REST API and WebSocket server  |
| `docs/`      | SRS documents and architecture diagrams          |

## Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- `backend/.env` with required variables (at minimum `MONGODB_URI`; see existing config)

## Getting started

Install dependencies for all packages:

```bash
npm install
npm install --prefix frontend
npm install --prefix backend
```

## Run

From the repository root:

```bash
npm run start
```

This starts the API and the frontend dev server together. The app is available at [http://localhost:3000](http://localhost:3000); API requests are proxied to the backend.

## Useful commands

```bash
npm run start --prefix frontend   # frontend only
npm run start --prefix backend    # backend only
npm test --prefix backend         # API tests
```
