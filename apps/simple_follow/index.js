const express = require("express");
const DIDKit = require('@spruceid/didkit-wasm-node');
const Protocol = require('client');
const c = new Protocol();
const Crypto = require('node:crypto').webcrypto;
const sha256 = require('sha256');

const path = require("path");
const port = 3002;

const server = express();
const handlesTaken = [];
const handleDIDMap = new Map();
const handleKeyMap = new Map();

server.use(express.urlencoded({ extended: true }));
server.set('views', path.join(__dirname, 'views'));
server.set('view engine', 'ejs');
server.use(express.static(path.join(__dirname, 'public')));

var app_did = "did:dcn:simple_follow"
var graph_did = c.registerGraph("simple_follow", {"kty":"OKP","crv":"Ed25519","x":"EL_Z0oW6OLhN4Pe4LAzzGmOWkGZpxmhoqD0IAvQ4wGA"})
                 .then(function(data) { graph_did = data.did });

var rolodex_did = "did:dcn:rolodex"
var rolodex_graph_did = graph_did

const Alerts = {
  missingAccount: "Account Not Registered! Create an account first",
  handleTaken: "Handle is already taken",
  requireLogin: "Please login or sign up before you proceed",
  wrongKey: "Sigin Failed! The key & handle do not match",
}


server.get("/", (req, res) => {
  res.render('pages/index', { alert: Alerts[req.query.alert] })
});

server.get("/auth/account_creation_challenge", (req, res) => {
  handle = req.query.handle
  challenge = Crypto.getRandomValues(new Uint32Array(1))[0];
  userId = sha256(handle);
  rpName = "Simple Follow";
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
    res.redirect(`profiles?session=${handle}`);
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
    res.redirect(`profiles?session=${handle}`);
  };
});

server.get("/profiles", async (req, res) => {
  if (!req.query["session"])
    res.redirect("/?alert=requireLogin")

  res.render('pages/profiles', {
    handleDIDMap: handleDIDMap,
    current_user: req.query["session"],
  })
});

server.get("/profiles/:handle", async (req, res) => {
  if (!req.query["session"])
    res.redirect("/?alert=requireLogin")

  var params = req.params;
  var handle = params["handle"];
  var did = handleDIDMap.get(handle);
  var key = handleKeyMap.get(handle);
  var graphData = await c.readGraph(graph_did);
  var rolodexData = await c.readGraph(rolodex_graph_did);
  var followers = await followerListFor(did, graphData);
  var followings = await followingListFor(did, graphData);

  //var rolodexFollowers = await followerDIDsFor(did, rolodexData);
  //var current_user_did = handleDIDMap.get(req.query["session"])
  //var isRolodexFollower = rolodexFollowers.includes(current_user_did)

  res.render('pages/profile_v2',{
    did: did,
    current_user: req.query["session"],
    handle: handle,
    key: key,
    followers: followers,
    followings: followings,
    followersCount: followers.length,
    followingsCount: followings.length,
    isRolodexFollower: false,
  });
});

server.post("/follow", async (req, res) => {
  var followerHandle = req.body.fhandle;
  var followingHandle = req.body.phandle;
  var followerDID = handleDIDMap.get(followerHandle);
  var followingDID = handleDIDMap.get(followingHandle);
  var followerExists = await handleUniqueness(followerHandle);

  if (followerExists == false) {
    console.log("Create an account first");
    res.status(404).send("Create an account first");
  } else {
    c.insertGraph(graph_did, followerDID, followingDID, "present", "qwerty")
    console.log(`User ${followerHandle} followed ${followingHandle}`);
    res.redirect(`profiles/${followingHandle}?session=${followerHandle}`);
  };
});

server.listen(port, (err) => {
  if (err) throw err;
  console.log(
    `> Ready on ${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co port ${port}`
  );
});

async function handleUniqueness(handle) {
  return handlesTaken.includes(handle);
  console.log('Handle Unquiness check', handlesTaken.includes(handle));
};

async function createAccount(handle, did, doc) {
  var profile = {app_did: app_did, handle: handle};
  console.log(did);

  handlesTaken.push(handle);
  handleDIDMap.set(handle, did);
  console.log(handleDIDMap);

  return {did: did}
};

async function followerListFor(did, graphData) {
  //hashes where did == to
  var followerList = [];
  graphData.forEach(function (item, index) {
    if (item['to'] == did) {
      followerList.push(findHandleByDID(item['from']));
    }
  });
  return followerList;
}

async function followingListFor(did, graphData) {
  //hashes where did == from
  var followingList = [];
  graphData.forEach(function (item, index) {
    if (item['from'] == did) {
      followingList.push(findHandleByDID(item['to']));
    }
  });
  return followingList;
}

async function followerDIDsFor(did, graphData) {
  //hashes where did == from
  var followingList = [];
  graphData.forEach(function (item, index) {
    if (item['to'] == did) {
      followingList.push(item['from']);
    }
  });
  return followingList;
}

function findHandleByDID(searchDID) {
  for (let [key, value] of handleDIDMap.entries()) {
    if (value === searchDID)
      return key;
  }
}
