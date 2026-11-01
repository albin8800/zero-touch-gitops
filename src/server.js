/**
 * Zero-Touch GitOps API Microservice  
 * Standard HTTP Server with Cloud-Native Health Probes
 */

const http = require('http');

const PORT = process.env.PORT || 3000;
const APP_VERSION = process.env.APP_VERSION || '2.0.0';

const server = http.createServer((req, res) => {
  // Kubernetes Liveness & Readiness Probe Endpoint
  if (req.url === '/healthz' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  // Application Root Information Endpoint
  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        service: 'zero-touch-gitops-api',
        version: APP_VERSION,
        environment: process.env.NODE_ENV || 'development',
        message:
          'Zero-Touch GitOps v2.0 is LIVE! Automated deployment successful!',
      })
    );
    return;
  }

  // 404 Fallback
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint Not Found' }));
});

// Graceful Shutdown Handling (Crucial for Kubernetes Pod Lifecycle)
const gracefulShutdown = () => {
  console.log('Received termination signal. Closing HTTP server gracefully...');
  server.close(() => {
    console.log('HTTP server closed. Exiting process.');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`🩺 Health probe available at http://0.0.0.0:${PORT}/healthz`);
});
