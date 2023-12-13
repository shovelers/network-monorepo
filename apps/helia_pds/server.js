import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import cors from 'cors';
import { generateShareLabel } from './index.js';

const port = process.argv[2] || 3000;
const server = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

server.use(express.json());
server.use(cors());

server.use(express.urlencoded({ extended: true }));
server.set('views', path.join(__dirname, 'views'));
server.set('view engine', 'ejs');
server.use(express.static(path.join(__dirname, 'public')));

server.get("/", (req, res) => {
  res.render('pages/index')
});

server.post("/generate_share", (req, res) => {
  generateShareLabel(req.body.key, req.body.cid).then((result) => {
    res.send(result);
  });
}
)

server.listen(port, (err) => {
  if (err) throw err;
  console.log(
    `> Ready`
  );
});