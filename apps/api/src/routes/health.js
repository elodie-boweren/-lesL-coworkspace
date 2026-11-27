async function healthRoutes(app) {
  app.get('/health', async () => {
    return { status: 'ok', uptime: process.uptime() };
  });
}

module.exports = healthRoutes;
