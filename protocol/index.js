const express = require("express");
const cors = require('cors');
const morgan = require('morgan')

const path = require("path");
const port = 4000;

const server = express();

server.use(express.json());
server.use(cors());
server.use(morgan('tiny'));

server.use(express.urlencoded({ extended: true }));
server.set('views', path.join(__dirname, 'views'));
server.set('view engine', 'ejs');
server.use(express.static(path.join(__dirname, 'public')));

const UserRegistry = {}
const GraphRegistry = {}
const RelationshipTuple = []

server.get("/", (req, res) => {
  relationships = 0
  Object.values(GraphRegistry).forEach(val => {
    relationships += val.relationships.length
  });

  res.render('pages/index', {
    users: Object.keys(UserRegistry).length,
    graphs: Object.keys(GraphRegistry).length,
    relationships: relationships
  })
});

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

// TODO: Handle overwrite scenario, ideally this method should return a did rather than accept it
server.post("/graph", (req, res) => {
  GraphRegistry[req.body.did] = {
    doc: req.body.doc,
    relationships: []
  }
  console.log(GraphRegistry)
  res.status(200).json({})
})

/*
  TODO: Validate presence of Graph
*/
server.get("/graph/:did", (req, res) => {
  if (GraphRegistry[req.params.did] !== undefined)
    res.status(200).json(GraphRegistry[req.params.did].relationships)
  else
    res.status(404).json({})
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
server.post("/graph/:did", (req, res) => {
  if (GraphRegistry[req.params.did] !== undefined) {
    GraphRegistry[req.params.did].relationships.push(req.body)
    console.log(GraphRegistry[req.params.did])
    res.status(200).json({})
  } else {
    res.status(404).json({})
  }
})

server.listen(port, (err) => {
  if (err) throw err;
  console.log(
    `> Ready`
  );
});
