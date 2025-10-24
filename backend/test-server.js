import http from 'http';

const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type':'text/plain'});
  res.end('test server ok');
});

const PORT = 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('test-server listening on', PORT);
});

server.on('error', (err) => {
  console.error('test-server error', err);
});
