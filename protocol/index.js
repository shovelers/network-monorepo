const express = require("express");

const path = require("path");
const port = 4000;

const server = express();

server.use(express.json())
server.use(express.urlencoded({ extended: true }));
server.set('views', path.join(__dirname, 'views'));
server.set('view engine', 'ejs');
server.use(express.static(path.join(__dirname, 'public')));

server.get("/", (req, res) => {
  res.render('pages/index')
});

const UserRegistry = {}
const RelationshipTuple = []

server.post("/user", (req, res) => {
  UserRegistry[req.body.did] = req.body.doc
  console.log(UserRegistry)
  res.status(200).json({})
})

server.get("/graph", (req, res) => {
  res.status(200).json({})
})

server.post("/graph", (req, res) => {
  res.status(200).json({})
})

server.listen(port, (err) => {
  if (err) throw err;
  console.log(
    `> Ready`
  );
});