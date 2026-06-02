// PM2-Konfiguration für das Werwolf-Backend.
//
// WICHTIG (Security): Passwörter NICHT hier hartkodieren / committen.
// Setze sie als echte Umgebungsvariablen, bevor du pm2 startest, z. B.:
//
//   export PLAYER_PASSWORD="dein-spieler-code"
//   export ADMIN_PASSWORD="dein-admin-code"
//   pm2 start ecosystem.config.js
//
// Alternativ in einer nicht eingecheckten Datei (backend/.env) – siehe .env.example.
module.exports = {
  apps: [{
    name: 'werwolf-backend',
    script: 'src/server.js',
    cwd: '/var/www/werwolf/backend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 5172,
      CORS_ORIGIN: process.env.CORS_ORIGIN || 'https://gravijet.eu',
      // Aus der Shell-Umgebung übernommen – keine Klartext-Geheimnisse im Repo.
      PLAYER_PASSWORD: process.env.PLAYER_PASSWORD,
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD
    }
  }]
};
