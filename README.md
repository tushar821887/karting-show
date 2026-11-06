# Kart Battle Arena 🏎️💥

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)
[![Angular](https://img.shields.io/badge/Angular-22+-dd0031.svg)](https://angular.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-0.174+-black.svg)](https://threejs.org/)
[![Rapier.js](https://img.shields.io/badge/Rapier.js-0.21+-red.svg)](https://rapier.rs/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8+-010101.svg)](https://socket.io/)
[![Node.js](https://img.shields.io/badge/Node.js-22+-green.svg)](https://nodejs.org/)

**Kart Battle Arena** is a real-time, browser-based 3D multiplayer kart combat game inspired by the gameplay mechanics of *Smash Karts*. Designed for entertainment with friends and office teammates, the game features private multiplayer rooms, 2–8 player Last Kart Standing combat, rocket launchers, nitro speed boosts, 3D physics collisions, live leaderboards, and celebratory victory ceremonies.

---

## 🏗️ System Architecture

The game utilizes a **server-authoritative multiplayer architecture** orchestrated across a clean TypeScript monorepo:

```
kart-battle-arena/
├── shared/                  # Common TypeScript library
│   ├── src/constants/       # Game configuration, physics constants, colors
│   ├── src/events/          # Bi-directional Socket.IO event enumerations
│   ├── src/interfaces/      # Room, Player, Weapon, Match & Leaderboard types
│   └── src/validation/      # Zod validation schemas for all incoming client data
├── backend/                 # Authoritative Game Server
│   ├── src/config/          # Environment configuration & MongoDB connection
│   ├── src/models/          # Mongoose models (Match & Player persistence)
│   ├── src/modules/game/    # 30Hz physics simulation loop, hit detection, winner logic
│   ├── src/modules/rooms/   # Private room lifecycle, host arbitration, 6-char codes
│   ├── src/modules/weapons/ # Rocket cooldown, projectile trajectories & hits
│   ├── src/modules/leaderboard/ # Deterministic ranking engine
│   ├── src/sockets/         # Socket.IO connection handling & event routing
│   └── src/routes/          # Health check and telemetry REST endpoints
├── frontend/                # Angular 22 Single-Page Application
│   ├── src/app/core/        # State management (signals), Socket & API services
│   ├── src/app/features/    # Home, Room Lobby, Game Viewport, and Results screens
│   └── src/app/game-engine/ # High-performance Three.js & Rapier.js game engine
│       ├── controls/        # Input capture, keyboard event listeners & focus protection
│       ├── effects/         # Particle systems (boost flame, rocket smoke, explosion shockwaves)
│       ├── kart/            # Procedural 3D kart model, steerable wheels & billboard HUD
│       ├── network/         # 100ms snapshot interpolation buffer & client prediction
│       ├── physics/         # Rapier.js 3D physics world, collision hulls & rigid bodies
│       ├── scene/           # 3D circular arena, perimeter wall, lighting & bunkers
│       └── weapons/         # 3D visual rockets & particle explosions
└── test-*.js                # Automated end-to-end and subsystem test suites
```

### Networking & Simulation Model

```
┌────────────────────────────────────────────────────────┐
│                   AUTHORITATIVE SERVER                 │
│  - 30 Hz Simulation Loop (33.3ms intervals)            │
│  - Rapier 3D Rigid-Body Physics & Collision Detection   │
│  - Cooldown & Weapon Hit Arbitrations                  │
│  - Non-blocking MongoDB persistence                    │
└───────────────────────────┬────────────────────────────┘
                            │
               Socket.IO    │  Socket.IO
          Inputs & Actions  │  Snapshots & State
                            ▼
┌────────────────────────────────────────────────────────┐
│                   CLIENT (BROWSER)                     │
│  - 60 FPS Three.js Rendering (Outside Angular Zone)    │
│  - Client-Side Prediction for Instant Responsive Steer │
│  - 100ms Delayed Snapshot Interpolation (Remote Karts) │
│  - Reactive Angular Signals for HUD & Live Leaderboard  │
└────────────────────────────────────────────────────────┘
```

---

## 🎮 Game Design & Features

### 1. Private Multiplayer Rooms (2–8 Players)
- **Unique 6-Character Room Codes**: Cryptographically secure, alphanumeric room code generation (`[A-Z0-9]{6}`).
- **Host Privileges**: Room creator automatically assumes Host status with authority to initiate matches and kick players.
- **Copy-to-Clipboard**: Instant one-click invite code copying with visual confirmation.
- **Room Lifecycle**: Strictly enforced lifecycle states: `WAITING` ➔ `COUNTDOWN` ➔ `PLAYING` ➔ `FINISHED`.
- **Dynamic Reconnection & Cleanup**: Graceful host migration upon host departure and automatic empty room cleanup.
- **Practice Mode**: Instant singleplayer sandbox allowing players to test drive and fire rockets without a lobby.

### 2. 3D Battle Arena & Procedural Graphics
- **Three.js WebGL Rendering**: 60 FPS rendering using perspective camera, ambient lighting, directional sun light, and ACES Filmic tone mapping.
- **Battleground Architecture**: 90-unit diameter circular battle arena (`ARENA_RADIUS = 45`) with glowing perimeter walls, 4 corner bunkers, 4 inner obstacle pillars, and power-up pads.
- **Procedural Low-Poly Kart Model**: Custom-built 3D kart with steerable front wheels, chassis, cockpit, exhaust pipes, and 8 selectable racer colors.
- **3D Overhead Billboard HUD**: In-world canvas-textured health bar and player nameplate tracking each kart in 3D space.

### 3. Arcade Kart Physics (Rapier.js)
- **Rapier 3D WebAssembly**: Deterministic physics engine providing instant collision response and stability.
- **Steering & Drift**: Realistic arcade handling with speed-dependent turning torque, lateral friction grip, and drift mechanics.
- **Boundary & Obstacle Collisions**: High-velocity elastic bounce off neon perimeter colliders and bunker walls.
- **Kart-to-Kart Bumping**: Server-enforced rigid body separation preventing karts from clipping through one another.

### 4. Weapon & Combat Systems
- **Rocket Launcher (`SPACE`)**:
  - Deals **25 HP** damage per direct hit.
  - Strict **2.0s server-enforced cooldown**.
  - Maximum flight range of **30 units** at **40 units/sec**.
  - Animated projectile mesh with trailing smoke and expanding explosion shockwaves.
  - Server-side collision validation with obstacle and self-damage prevention.
- **Nitro Speed Boost (`SHIFT`)**:
  - Temporary **1.6x speed multiplier** for **3 seconds**.
  - **8.0s server-validated cooldown**.
  - Dynamic camera field-of-view expansion ($60^\circ \rightarrow 72^\circ$).
  - Dual cyan exhaust flame particle trails.
- **Player Elimination**:
  - Each player starts with **100 HP**.
  - When health reaches 0, the player is eliminated.
  - Kart transforms into charred, burnt wreck with smoke plumes.
  - Eliminated players enter spectator mode to watch the remaining battle.

### 5. Live Leaderboard & HUD
- **In-Game HUD**: Real-time digital speedometer, circular skill cooldown gauges, health bar with low-health warning pulses, and remaining survivor counter.
- **Live Mini-Leaderboard**: Pinned to the top-right of the HUD showing living/eliminated racers and kill counts.
- **Interactive TAB Leaderboard**: Full modal table showing player ranks (🥇, 🥈, 🥉), colors, kills, HP bars, and scores.

### 6. Winner Ceremony & Rematch Flow
- **Victory Royale Screen**: Celebrates the Last Kart Standing with a dynamic 2D confetti canvas particle explosion.
- **3D Winner Showcase**: Live 360-degree rotating turntable displaying the champion's kart on a glowing podium.
- **Match Recap**: Total combat duration, contender count, total kills, and official final standings.
- **Instant Rematch**: One-click "Play Again" button returns players to the room lobby in `WAITING` status with unready states ready for the next round.
- **Draw Handling**: Special deterministic draw resolution if all players are eliminated simultaneously.

---

## 🕹️ Controls Reference

| Key | Action | Details |
| :--- | :--- | :--- |
| **W / ↑** | Accelerate | Propels kart forward up to 22 units/s |
| **S / ↓** | Reverse / Brake | Decelerates or reverses up to 8 units/s |
| **A / ←** | Steer Left | Angular turning with speed-ratio sensitivity |
| **D / →** | Steer Right | Angular turning with speed-ratio sensitivity |
| **SPACE** | Fire Rocket | Launches rocket forward (25 HP damage • 2s cooldown) |
| **SHIFT** | Nitro Boost | 1.6x speed boost (3s duration • 8s cooldown) |
| **TAB** | Toggle Leaderboard | Opens live in-game match standings |

---

## 📦 Tech Stack Summary

| Component | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | Angular (Standalone Components) | `^22.0.0` | UI architecture, routing, signals |
| **3D Rendering** | Three.js | `^0.174.0` | 3D scene, models, lighting, particles |
| **Physics Engine** | Rapier.js (`@dimforge/rapier3d-compat`) | `^0.21.0` | WebAssembly 3D rigid-body simulation |
| **Real-Time Client** | Socket.IO Client | `^4.8.1` | Low-latency WebSocket event transport |
| **Backend Framework** | Node.js + Express.js | `^4.21.2` | Authoritative server & REST API |
| **Real-Time Server** | Socket.IO | `^4.8.1` | Room management & 30Hz game loop |
| **Validation** | Zod | `^3.24.2` | Runtime schema validation for socket inputs |
| **Database** | MongoDB & Mongoose | `^8.10.0` | Match history & player telemetry |
| **Language** | TypeScript | `^5.7.3` | Full-stack end-to-end type safety |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: `v20.x` or `v22.x` (LTS recommended)
- **npm**: `v10.x` or `v11.x`
- **MongoDB** *(Optional)*: Server automatically falls back to non-blocking in-memory mode if MongoDB is not locally running.

### 1. Installation

Install all package dependencies with a single command from the root directory:

```bash
npm run install:all
```

### 2. Environment Setup

Create the backend environment file:

```bash
cp backend/.env.example backend/.env
```

Default configuration in `backend/.env`:
```env
PORT=3000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:4200
MONGODB_URI=mongodb://localhost:27017/kart-battle
LOG_LEVEL=info
```

### 3. Build Monorepo

Compile all TypeScript packages (`shared`, `backend`, `frontend`):

```bash
npm run build
```

### 4. Run Development Servers

Start both the backend server and frontend dev server concurrently:

```bash
npm run dev
```

The game is now accessible:
- 🏎️ **Game Client**: [http://localhost:4200](http://localhost:4200)
- 🚀 **Backend Server**: [http://localhost:3000](http://localhost:3000)
- 🩺 **Health Check**: [http://localhost:3000/api/health](http://localhost:3000/api/health)
- ℹ️ **Game Info**: [http://localhost:3000/api/info](http://localhost:3000/api/info)

---

## 🧪 Automated Test Suite

The repository includes a comprehensive automated test suite verifying every layer of the game:

| Script | Command | What it Validates |
| :--- | :--- | :--- |
| **E2E Match** | `npm run test:e2e` | Complete game loop: connection, room creation, join, ready, 30Hz loop, nitro, combat, elimination, winner screen, and rematch reset. |
| **Phase 2** | `npm run test:phase2` | 6-character room codes, host permissions, ready check, duplicate prevention, and room state sync. |
| **Physics** | `npm run test:physics` | Rapier.js WASM physics initialization, arena colliders, acceleration, and bounce damping. |
| **Sync** | `npm run test:sync` | 30Hz authoritative simulation, client prediction reconciliation, and snapshot interpolation. |
| **Weapons** | `npm run test:weapons` | Rocket projectile travel, collision detection, 25 HP damage, 2s cooldown enforcement, and elimination. |
| **Phase 7** | `npm run test:phase7` | Real-time live leaderboard updates, victory broadcast, and room reset to `WAITING` state. |

Run any test:
```bash
# Example: Run complete end-to-end match test
npm run test:e2e
```

---

## 🗺️ Project Roadmap Status

- [x] **PHASE 1**: Monorepo scaffolding, Angular 22 + Three.js + Rapier.js setup, shared package, backend server, WebSocket setup & health-check APIs.
- [x] **PHASE 2**: Private rooms, 6-character room codes, host controls, ready status & matchmaking lobby.
- [x] **PHASE 3**: 3D battle arena, perspective camera follow system, kart meshes & materials.
- [x] **PHASE 4**: Rapier.js 3D physics integration, collisions with arena walls, obstacles, and opponents.
- [x] **PHASE 5**: Server-authoritative multiplayer movement sync, client prediction, server reconciliation.
- [x] **PHASE 6**: Rocket projectile weapon system, nitro boost, damage calculation & player elimination.
- [x] **PHASE 7**: Live real-time leaderboard, match completion & winner announcement screen with 3D turntable kart & confetti.
- [x] **PHASE 8**: Polish, end-to-end automated testing, monorepo build verification, and deployment documentation.

---

## 📄 License

MIT © 2026 Kart Battle Arena Team
