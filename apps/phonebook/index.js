const express = require("express");
const path = require("path");
const port = 3001;
const server = express();
server.use(express.json());
server.use(express.urlencoded({ extended: true }));
server.set('views', path.join(__dirname, 'views'));
server.set('view engine', 'ejs');
server.use(express.static(path.join(__dirname, 'public')));

const Protocol = require('client');
const c = new Protocol();

const Crypto = require('node:crypto').webcrypto;
const sha256 = require('sha256');

const apps = [
  { name: "Rolodex",       graphDID: "did:graph:rolodex" },
  { name: "Simple Follow", graphDID: "did:graph:simple_follow" }
]

var app_did = "did:dcn:phonebook";
c.registerApp(app_did,"09opdsfasdfasfasd12iuasfdfghjkjhgfdsasdfghjmknbvcxcvbnbvcuy")

const handlesTaken = [];
const handleDIDMap = new Map();

server.get("/", (req, res) => {
  res.render('pages/index');
});

server.get("/auth/account_creation_challenge", (req, res) => {
  handle = req.query.handle
  challenge = Crypto.getRandomValues(new Uint32Array(1))[0];
  userId = sha256(handle);
  rpName = "Phone Book";
  res.send({ challenge: challenge, user: { id: userId, name: handle, displayName: handle}, rpName: rpName })
});

server.get("/auth/login_challenge", (req, res) => {
  handle = req.query.handle;
  challenge = Crypto.getRandomValues(new Uint32Array(1))[0];
  res.send({challenge: challenge});
});

server.get("/did", (req, res) => {
  var handle = req.query.handle;
  var did = handleDIDMap.get(handle);
  res.send({did: `${did}`});
});

server.post("/account", async (req, res) => {
  var handle = req.body.fhandle;
  var did = req.body.fdid;
  var doc = req.body.fdoc;
  var handleAlreadyTaken = await handleUniqueness(handle);

  if (handleAlreadyTaken == false) {
    var result = await createAccount(handle, did, doc);
    console.log(`Account created for handle:${handle}, did:${result["did"]}`);
    res.redirect(`users/${handle}`);
  } else {
    console.log(`Handle: ${handle} already taken`);
    res.redirect(`/?alert=handleTaken`);
  };
});

server.post("/signin", async (req, res) => {
  var handle = req.body.fhandle
  var handleAlreadyTaken = req.body.fhandleAlreadyTaken;
  var validated = req.body.fvalidated;

  if (handleAlreadyTaken === "false") {
    console.log("Create an account first");
    res.redirect(`/?alert=missingAccount`);
  } else if (validated === "false") {
    res.redirect(`/?alert=wrongKey`);
  } else {
    console.log(`Profile lookup for handle:${handle}`);
    res.redirect(`users/${handle}`);
  };
});

server.get("/users/:handle", async (req, res) => {
  var socialGraph = []
  var did = handleDIDMap.get(req.param.handle);
  for (const app of apps) {
    var graphData = await c.readGraph(app.graphDID);
    var relationships = await relationshipFor(did, graphData);
    socialGraph.push({ name: app.name, relationships: relationships});
  };

  res.render('pages/profile', {
    socialGraph: socialGraph
  })
});

server.listen(port, (err) => {
  if (err) throw err;
  console.log(
    `> Ready`
  );
});

async function handleUniqueness(handle) {
  return handlesTaken.includes(handle);
  console.log('Handle Unquiness check', handlesTaken.includes(handle));
};

async function createAccount(handle, did, doc) {
  var profile = {app_did: app_did, handle: handle};
  console.log(did);
  c.registerUser(did, doc, profile);

  handlesTaken.push(handle);
  handleDIDMap.set(handle, did);
  console.log(handleDIDMap);

  return {did: did}
};

async function relationshipFor(did, graphData) {
  var list = [];
  graphData.forEach(function (item, index) {
    if ((item['from'] == did) || (item['to'] == did))
      list.push(item);
  });
  return list;
}
