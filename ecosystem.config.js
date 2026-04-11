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
      CORS_ORIGIN: 'https://gravijet.eu',
      PLAYER_PASSWORD: 'JUGEND',
      ADMIN_PASSWORD: 'JUGENDADMIN'
    }
  }]
};
