const express = require("express");
const DIDKit = require('@spruceid/didkit-wasm-node');
const Protocol = require('client');
const c = new Protocol();

const path = require("path");
const port = 3002;

const server = express();
const handlesTaken = [];
const handleDIDMap = new Map();

server.use(express.urlencoded({ extended: true }));
server.set('views', path.join(__dirname, 'views'));
server.set('view engine', 'ejs');
server.use(express.static(path.join(__dirname, 'public')));

var app_did = "did:dcn:simple_follow"
var graph_did = "did:graph:simple_follow"
c.registerApp(app_did,"qwerdsfasdfasfasdfsafasfdfghjkjhgfdsasdfghjmknbvcxcvbnbvcuy")
c.registerGraph(graph_did,"uiolpasdfghjkjhgfdsasdfghjmknbvcxcvbnbvcxzfghudsdfyuy", app_did)

var rolodex_did = "did:dcn:rolodex"
var rolodex_graph_did = "did:graph:rolodex"

server.get("/", (req, res) => {
  res.render('pages/index')
});

server.post("/account", async (req, res) => {
  var handle = req.body.fhandle;
  var did = req.body.fdid;
  var handleAlreadyTaken = await handleUniqueness(handle);

  if (handleAlreadyTaken == false) {
    var result = await createAccount(handle, did);
    console.log(`Account created for handle:${handle}, did:${result["did"]}`);
    res.redirect(`profiles/${handle}`);
  } else {
    console.log(`Handle: ${handle} already taken`);
    res.status(404).send(`Handle: ${handle} already taken`);
  };
});

server.post("/signin", async (req, res) => {
  var handle = req.body.fhandle;
  var handleAlreadyTaken = await handleUniqueness(handle);

  if (handleAlreadyTaken == false) {
    console.log("Create an account first");
    res.status(404).send("Create an account first");
  } else {
    console.log(`Profile lookup for handle:${handle}`);
    res.redirect(`profiles/${handle}`);
  };
});

server.get("/profiles", async (req, res) => {
  res.render('pages/profiles', { handleDIDMap: handleDIDMap})
});

server.get("/profiles/:handle", async (req, res) => {
  var params = req.params;
  var handle = params["handle"];
  var did = handleDIDMap.get(handle);
  var graphData = await c.readGraph(graph_did);
  var rolodexData = await c.readGraph(rolodex_graph_did);
  var followers = await followerListFor(did, graphData);
  var followings = await followingListFor(did, graphData);
  var rolodexFollowers = await followerListFor(did, rolodexData);
  var rolodexFollowings = await followingListFor(did, rolodexData);

  res.render('pages/profile_v2',{
    did: did,
    handle: handle,
    followers: followers,
    followings: followings,
    followersCount: followers.length,
    followingsCount: followings.length,
    rolodexFollowersCount: rolodexFollowers.length,
    rolodexFollowingsCount: rolodexFollowings.length,
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
    c.insertGraph(graph_did, followerDID, followingDID, new Date())
    console.log(`User ${followerHandle} followed ${followingHandle}`);
    res.status(200).send(`You successfully followed ${followingHandle}`);
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
  console.log(handlesTaken.includes(handle));
};

async function createAccount(handle, did) {
  var profile = {app_did: app_did, handle: handle};
  if (!did) {
    console.log(`got did ${did}`)
    var key = DIDKit.generateEd25519Key();
    handlesTaken.push(handle);
    console.log(key);
    //call client to generate did and pass this key
    var result = await c.generateDID(key);
    console.log(result);
    var did = result["did"];
    var doc = result["doc"];
    c.registerUser(did, doc, profile);

    handleDIDMap.set(handle, did);

    return {key: key, did: did}
  } else {
    // temp entry
    var doc = ""
    c.registerUser(did, doc, profile);

    handlesTaken.push(handle);
    handleDIDMap.set(handle, did);
    console.log(handleDIDMap);

    return {key: key, did: did}
  }
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

function findHandleByDID(searchDID) {
  for (let [key, value] of handleDIDMap.entries()) {
    if (value === searchDID)
      return key;
  }
}
