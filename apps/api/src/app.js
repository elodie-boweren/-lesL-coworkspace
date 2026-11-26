const Fastify = require('fastify');
const healthRoutes = require('./routes/health');

function buildApp(options = {}) {
  const app = Fastify(options);

  app.register(healthRoutes);

  return app;
}

module.exports = { buildApp };
