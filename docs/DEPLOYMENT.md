# Deployment und Start – Werwolf Jugend

Anleitung für lokalen Start und Produktionseinsatz.

---

## 1. Lokaler Start (Entwicklung)

### Voraussetzungen

- **Node.js 18+** (empfohlen: LTS)
- Zwei Terminals (oder ein Terminal mit zwei Prozessen)

### Ablauf

**Terminal 1 – Backend:**

```bash
cd backend
npm install
npm start
```

- Server: **http://localhost:3000**
- Health-Check: **http://localhost:3000/health**

**Terminal 2 – Frontend:**

```bash
cd frontend
npm install
npm run dev
```

- App: **http://localhost:5173**
- Vite leitet Anfragen an `/socket.io` und `/health` an das Backend (Port 3000) weiter.

**Optional – Backend mit Auto-Reload:**

```bash
cd backend
npm run dev
```

---

## 2. Umgebungsvariablen

### Backend

| Variable            | Bedeutung                    | Standard           |
|---------------------|-----------------------------|--------------------|
| `PORT`              | HTTP-Port des Servers       | `3000`             |
| `PLAYER_PASSWORD`   | Passwort für Spieler        | `JUGENDINNSBRUCK`  |
| `ADMIN_PASSWORD`    | Passwort für Admins         | `JUGENDADMIN`      |

Beispiel `.env` im Ordner `backend/` (Datei anlegen, nicht committen):

```env
PORT=3000
PLAYER_PASSWORD=JUGENDINNSBRUCK
ADMIN_PASSWORD=JUGENDADMIN
```

Das Backend lädt optional eine `.env`-Datei im Ordner `backend/` (über `dotenv`). Alternativ die Variablen beim Start setzen:  
`PORT=4000 PLAYER_PASSWORD=geheim node src/server.js`

### Frontend

| Variable         | Bedeutung                                      | Standard      |
|------------------|------------------------------------------------|---------------|
| `VITE_API_URL`   | Basis-URL des Backends (Socket.io-Verbindung)  | gleicher Origin |

- **Lokal mit Vite-Proxy:** nicht setzen (leer lassen).
- **Produktion, Frontend und Backend getrennt:** setzen auf die Backend-URL, z. B.  
  `VITE_API_URL=https://api.mein-spiel.de`

Build mit Backend-URL:

```bash
cd frontend
VITE_API_URL=https://api.mein-spiel.de npm run build
```

---

## 3. Produktion – Build

### Backend

Kein Build nötig. Auf dem Server:

```bash
cd backend
npm install --omit=dev
PORT=3000 node src/server.js
```

Oder mit PM2/systemd den Befehl `node src/server.js` ausführen und `PORT` (sowie ggf. Passwörter) in der Umgebung setzen.

### Frontend

```bash
cd frontend
npm install
VITE_API_URL=https://deine-backend-url npm run build
```

Ausgabe in **`frontend/dist/`**. Diesen Ordner mit einem beliebigen Webserver (Nginx, Apache, Caddy, Netlify, Vercel, etc.) ausliefern.

---

## 4. Produktion – typische Setups

### A) Alles auf einer Domain (empfohlen)

- **Reverse-Proxy** (Nginx/Caddy) auf einer Domain, z. B. `https://werwolf.example.de`.
- Proxy-Regeln:
  - `/.well-known/`, `/assets/`, `/index.html` etc. → Frontend (statische Dateien aus `frontend/dist/`).
  - `/socket.io` → Backend (z. B. `http://127.0.0.1:3000` mit WebSocket-Support).
  - `/health` → Backend.

Dann **`VITE_API_URL` leer lassen** (oder weglassen); das Frontend spricht mit dem gleichen Origin, der Proxy leitet an das Backend weiter.

**Beispiel Nginx (Auszug):**

```nginx
server {
  listen 443 ssl;
  server_name werwolf.example.de;

  root /pfad/zu/frontend/dist;
  index index.html;
  location / {
    try_files $uri $uri/ /index.html;
  }

  location /socket.io {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }
  location /health {
    proxy_pass http://127.0.0.1:3000;
  }
}
```

### B) Frontend und Backend getrennt

- Backend z. B. unter **https://api.werwolf.example.de**
- Frontend z. B. unter **https://werwolf.example.de**

Frontend-Build:

```bash
VITE_API_URL=https://api.werwolf.example.de npm run build
```

Backend muss CORS für die Frontend-Domain erlauben (in `server.js` ist aktuell `cors: { origin: "*" }`; für Produktion besser eine konkrete Origin eintragen).

---

## 5. Checkliste Produktion

- [ ] **Backend:** `PORT`, `PLAYER_PASSWORD`, `ADMIN_PASSWORD` gesetzt (nicht Standard verwenden).
- [ ] **Frontend:** `VITE_API_URL` nur setzen, wenn Backend auf anderer Domain/Port läuft.
- [ ] **HTTPS:** In Produktion HTTPS für Frontend und ggf. Backend (oder Proxy) nutzen.
- [ ] **Firewall:** Nur nötige Ports offen (z. B. 80/443 für Proxy; Backend nur lokal erreichbar).
- [ ] **State:** Spielzustand lebt nur im Speicher; Server-Neustart setzt alles zurück (kein persistenter Store).

---

## 6. Beide Dienste starten (optional)

Ohne zusätzliche Tools: zwei Terminals wie unter Abschnitt 1.

Mit **concurrently** (einmalig im Projektroot):

```bash
npm install -g concurrently
concurrently "cd backend && npm start" "cd frontend && npm run dev"
```

Oder im Projektroot eine `package.json` mit Scripts anlegen, die `concurrently` aufrufen – dann reicht ein Aufruf wie `npm run start:all` (Details je nach gewünschter Struktur).
