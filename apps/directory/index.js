import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from 'redis';

const redisClient = await createClient()
  .on('error', err => console.log('Redis Client Error', err))
  .connect();



const port = process.argv[2] || 3000;
const server = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

server.use(express.json());
server.use(express.urlencoded({ extended: true }))
server.set('views', path.join(__dirname, 'views'));
server.set('view engine', 'ejs');
server.use(express.static(path.join(__dirname, 'public')))

server.get("/", (req, res) => {
  res.render('pages/index')
});

server.get("/home", (req, res) => {
  res.render('pages/index')
});

server.get("/app", (req, res) => {
  res.render('pages/app')
});

server.get("/directory/:id/join", (req, res) => {
  res.render('pages/join')
})

server.get("/directory/:id", (req, res) => {
  res.render('pages/directory')
})

server.post("/directory/:id/request", async (req, res) => {
  var accessKey = req.body.accessKey
  var forestCID = req.body.forestCID
  var directoryID = req.params.id
  await redisClient.lPush(directoryID, `${accessKey}:${forestCID}`);

  res.status(200).json({})
})

server.get("/directory/:id/requests", async (req, res) => {
  var data = await redisClient.lRange(req.params.id, 0, -1)
  res.status(200).json(data)
})

server.listen(port, (err) => {
  if (err) throw err;
  console.log(
    `> Ready on port ${port}`
  );
});
