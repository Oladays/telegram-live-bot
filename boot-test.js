process.stdout.write('NODE BOOT TEST\n');

const http = require('http');

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.end('ALIVE');
}).listen(PORT, () => {
  process.stdout.write(`HTTP SERVER ALIVE ON ${PORT}\n`);
});
