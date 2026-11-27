const { buildApp } = require('./app');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const app = buildApp({ logger: true });

app.listen({ port: PORT, host: HOST }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
