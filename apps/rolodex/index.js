import express from 'express';
import Protocol from 'client';
import path from 'path';
import { fileURLToPath } from 'url';

const port = process.argv[2] || 3000;
const server = express();

const c = new Protocol();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

server.use(express.urlencoded({ extended: true }))
server.set('views', path.join(__dirname, 'views'));
server.set('view engine', 'ejs');
server.use(express.static(path.join(__dirname, 'public')))

server.get("/", (req, res) => {
  res.render('pages/index')
});

server.get("/profile", (req, res) => {
  res.render('pages/profile')
});

server.get("/contacts", (req, res) => {
  res.render('pages/contacts')
});

server.listen(port, (err) => {
  if (err) throw err;
  console.log(
    `> Ready on port ${port}`
  );
});
