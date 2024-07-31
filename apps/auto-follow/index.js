import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import morgan from 'morgan';
import { NeynarAPIClient } from "@neynar/nodejs-sdk";

const port = process.argv[2] || 3500;
const server = express();
server.use(morgan('tiny'))

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY|| 'DUMMY-KEY';
const client = new NeynarAPIClient(NEYNAR_API_KEY);

server.use(express.urlencoded({ extended: true }))
server.set('views', path.join(__dirname, 'views'));
server.set('view engine', 'ejs');
server.use(express.static(path.join(__dirname, 'public')))

server.get("/", (req,res) => {
  res.render('pages/auto_follow_signup');
});

server.get("/auto_follow_signup", (req,res) => {
  res.render('pages/auto_follow_signup');
});

server.get("/auto_follow_landing", (req,res) => {
  res.render('pages/auto_follow_landing');
});

server.post("/farcaster-follow-users/",express.json(),  async (req, res) => {
  try {
      const { signerUuid, targetFids } = req.body;
      const response = await client.followUser(signerUuid,targetFids);
      res.status(200).json(response);
  }
  catch (error) {
    console.error("Error following users:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

server.listen(port, (err) => {
  if (err) throw err;
  console.log(
    `> Ready on port ${port}`
  );
});
