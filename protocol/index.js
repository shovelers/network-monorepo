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

/*
  sample req.body = {
    "did": "did:ion:z6MkkMKvnc3vJfQp8Sr8dYVjc6zrTQaxcDBbtYqW3wMJW2hY",
    "doc": "qwertyuiolpasdfghjkjhgfdsasdfghjmknbvcxcvbnbvcxzfghudsdfyuy"
  }
  TODO: Validate DID data
*/
server.post("/user", (req, res) => {
  UserRegistry[req.body.did] = req.body.doc
  console.log(UserRegistry)
  res.status(200).json({})
})

server.get("/graph", (req, res) => {
  res.status(200).json({})
})

/*
  sample req.body = {
    "from": "did:ion:z6MkkMKvnc3vJfQp8Sr8dYVjc6zrTQaxcDBbtYqW3wMJW2hY",
    "to": "did:web:z6MkkMKvnc3vJfQp8Sr8dYVjc6zrTQaxcDBbtYqW3wMJW2hY",
    "timestamp": 1683879632177
  }
  TODO: Think through how/if to handle duplicate enteries
  TODO: Validate Tuple
  TODO: Define timestamp format
*/
server.post("/graph", (req, res) => {
  RelationshipTuple.push(req.body)
  console.log(RelationshipTuple)
  res.status(200).json({})
})

server.listen(port, (err) => {
  if (err) throw err;
  console.log(
    `> Ready`
  );
});