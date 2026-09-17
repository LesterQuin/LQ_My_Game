# Comfort Cards Online

> **"Sometimes one question is enough to start a meaningful conversation."**

Comfort Cards Online is an original, temporary, web-based multiplayer card game featuring an original 60-question Tagalog-English conversation deck. Friends and loved ones can open the website, start a private room in seconds, share an invite link, and play together in real-time—with no accounts, logins, or saved history.

---

## 1. What the Application Does

- **Zero-Friction Multiplayer**: Create or join a game by simply entering a temporary nickname and a 6-character room code.
- **Original 60-Card Deck**: A thoughtful mix of reflective Tagalog and English questions designed to encourage emotional honesty, comfort, and vulnerability.
- **Authoritative Turn Management**: The server orchestrates round-robin turns, ensuring only the active player can draw and answer questions.
- **Tactile 3D Card Experience**: Interactive card flip animations and responsive mobile-first UI.
- **100% In-Memory State**: No database, no user accounts, no saved profiles, and no permanent answer logs.

---

## 2. Technologies Used

### Frontend
- **React 18**: Component-driven declarative UI.
- **Vite**: Ultra-fast build tool and dev server.
- **Socket.IO Client**: Real-time event communication with the server.
- **React Router DOM 6**: Client-side routing (`/`, `/create`, `/join`, `/room/:code`).
- **Canvas-Confetti**: Celebration confetti when completing all cards.
- **Lucide React**: Clean, accessible UI icons.
- **Custom CSS Design System**: Warm neutral palette, organic radii, and 3D card flip effects.

### Backend
- **Node.js (ES Modules)**: Modern `import`/`export` JavaScript syntax.
- **Express.js**: REST endpoints for health checks and room validation.
- **Socket.IO**: Authoritative real-time game state synchronization.
- **In-Memory JavaScript Map**: Ephemeral room store.
- **CORS & Dotenv**: Environment configuration and secure cross-origin resource sharing.

---

## 3. Folder Structure

```text
comfort-cards-online/
├── backend/
│   ├── controllers/
│   │   └── roomController.js        # REST controllers for health and room checks
│   ├── data/
│   │   └── comfortCards.js          # Exactly 60 original Tagalog-English questions
│   ├── routes/
│   │   └── apiRoutes.js             # Express API routes (/api/health, /api/rooms/:code)
│   ├── scripts/
│   │   └── testGameFlow.js          # Automated backend test suite
│   ├── services/
│   │   ├── gameManager.js           # Deck shuffling, turn rotation, answer validation
│   │   └── roomManager.js           # Ephemeral room storage Map, players, host reassignment
│   ├── sockets/
│   │   └── gameSocket.js            # Real-time Socket.IO event router
│   ├── utils/
│   │   ├── roomCleanup.js           # Inactivity and abandonment sweeper
│   │   ├── roomCode.js              # 6-character unambiguous code generator
│   │   ├── sanitize.js              # Input sanitization and XSS prevention
│   │   └── shuffle.js               # Fisher-Yates array shuffling
│   ├── .env.example
│   ├── package.json
│   └── server.js                    # Express + Socket.IO server entry
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AnswerBox.jsx        # Response textarea and submit control
│   │   │   ├── AnswerDisplay.jsx    # Live answer presentation and turn advance
│   │   │   ├── Card.jsx             # 3D interactive flip card
│   │   │   ├── Header.jsx           # Brand logo and room status bar
│   │   │   ├── PlayerList.jsx       # Player list chips and host indicators
│   │   │   └── Toast.jsx            # Gentle notification toasts
│   │   ├── hooks/
│   │   │   └── useGameSocket.js     # React hook coordinating Socket.IO state
│   │   ├── pages/
│   │   │   ├── CreateGame.jsx       # Nickname entry & room creation
│   │   │   ├── Game.jsx             # Main game table and completion screen
│   │   │   ├── Home.jsx             # Welcoming landing page
│   │   │   ├── JoinGame.jsx         # Room code & nickname entry
│   │   │   └── Lobby.jsx            # Waiting room with invite link and player roster
│   │   ├── services/
│   │   │   ├── api.js               # REST client
│   │   │   └── socket.js            # Socket.IO client singleton
│   │   ├── utils/
│   │   │   ├── clipboard.js         # One-click invite link and code copier
│   │   │   └── session.js           # Temporary browser sessionStorage manager
│   │   ├── App.jsx                  # Main routing and navigation
│   │   ├── index.css                # Warm minimal design system styles
│   │   └── main.jsx                 # React root
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── .gitignore
└── README.md
```

---

## 4. Installation

Ensure you have **Node.js (v18+)** installed.

Clone or download the repository, then install dependencies for both the backend and frontend:

### Backend
```bash
cd backend
npm install
```

### Frontend
```bash
cd ../frontend
npm install
```

---

## 5. Environment Configuration

### Backend (`backend/.env`)
Copy `backend/.env.example` to `backend/.env`:
```env
PORT=5000
CLIENT_URL=http://localhost:5173
```

### Frontend (`frontend/.env`)
Copy `frontend/.env.example` to `frontend/.env`:
```env
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

---

## 6. Running the Application

### Start the Backend Server
```bash
cd backend
npm run dev
```
The server will start at `http://localhost:5000`.

### Start the Frontend Client
In a separate terminal:
```bash
cd frontend
npm run dev
```
The client will start at `http://localhost:5173`.

---

## 7. How to Play

### Create a Game
1. Visit `http://localhost:5173`.
2. Click **Create a Game**.
3. Enter your nickname (e.g. `Lester`) and click **CREATE GAME**.
4. You will be redirected to the Room Lobby and given a unique 6-character room code (e.g. `A7K92P`). You are designated as the **HOST**.

### Join a Game
1. Open the shareable invite link (e.g. `http://localhost:5173/join/A7K92P`) or navigate to **Join a Game**.
2. Enter the 6-character Room Code and your nickname (e.g. `Claire`).
3. Click **JOIN GAME**.

### Starting and Playing
1. In the Lobby, the Host clicks **START GAME**.
2. The server shuffles all 60 cards using the Fisher-Yates algorithm.
3. The active player draws a card by clicking **DRAW CARD**.
4. The card flips to reveal the question.
5. The player writes their reflection in the prompt box and clicks **Submit Answer**.
6. The answer is shown to all players in the room. The player or host clicks **Next Card** to advance the turn to the next player.
7. Repeat until all 60 cards are completed, after which players can choose **PLAY AGAIN** or **RETURN HOME**.

---

## 8. Ephemeral State & Privacy Rules

- **No Database**: There is strictly NO SQL Server, MySQL, Postgres, MongoDB, Firebase, Supabase, or Redis.
- **Server Memory Only**: Rooms exist purely inside an in-memory JavaScript `Map` on the Node.js server.
- **No Permanent History**: Player answers and names are never saved to disk and never logged to the server console.
- **Session Reconnection**: Player identity is temporarily held in browser `sessionStorage` only so a player can refresh the page without losing their place in the active game.
- **Server Restart Notice**: Because room data exists in-memory, restarting the backend server will cleanly wipe all active rooms.

---

## 9. Automatic Room Expiration & Cleanup

A background sweeper runs every 2 minutes:
- **Inactive Rooms**: Any room with no activity for 30 minutes is automatically deleted.
- **Abandoned Rooms**: Any room where all players disconnect for more than 15 minutes is automatically deleted.
- **Completed Games**: Finished games are automatically deleted after 10 minutes.
- **Empty Rooms**: When the last player leaves a room, it is removed immediately.
- **Host Departure**: If the host leaves, host status is automatically passed to the next connected player.

---

## 10. Automated Testing

Run the automated backend test suite:
```bash
cd backend
npm test
```
This tests code generation, deck shuffling, turn validation, answer submission, host migration, and room cleanup.
