const express = require("express");
const DIDKit = require('@spruceid/didkit-wasm-node');
const Protocol = require('client');
const c = new Protocol();

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
var graph_did = "did:graph:simple_follow"
c.registerApp(app_did,"qwerdsfasdfasfasdfsafasfdfghjkjhgfdsasdfghjmknbvcxcvbnbvcuy")
c.registerGraph(graph_did,"uiolpasdfghjkjhgfdsasdfghjmknbvcxcvbnbvcxzfghudsdfyuy", app_did)

var rolodex_did = "did:dcn:rolodex"
var rolodex_graph_did = "did:graph:rolodex"

const Alerts = {
  missingAccount: "Create an account first",
  handleTaken: "Handle is already taken",
  requireLogin: "Please login or sign up before you proceed",
  wrongKey: "Sigin Failed!! The key & handle do not match",
}


server.get("/", (req, res) => {
  res.render('pages/index', { alert: Alerts[req.query.alert] })
});

server.post("/account", async (req, res) => {
  var handle = req.body.fhandle;
  var did = req.body.fdid;
  var handleAlreadyTaken = await handleUniqueness(handle);

  if (handleAlreadyTaken == false) {
    var result = await createAccount(handle, did);
    console.log(`Account created for handle:${handle}, did:${result["did"]}`);
    res.redirect(`profiles?session=${handle}`);
  } else {
    console.log(`Handle: ${handle} already taken`);
    res.redirect(`/?alert=handleTaken`);
  };
});

server.post("/signin", async (req, res) => {
  var handle = req.body.fhandle;
  var key = req.body.fkey;

  var handleAlreadyTaken = await handleUniqueness(handle);
  var validated = await validateKey(handle, key);
  console.log(validated);

  if (handleAlreadyTaken == false) {
    console.log("Create an account first");
    res.redirect(`/?alert=missingAccount`);
  } else if (validated == false) {
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

  var rolodexFollowers = await followerDIDsFor(did, rolodexData);
  var current_user_did = handleDIDMap.get(req.query["session"])
  var isRolodexFollower = rolodexFollowers.includes(current_user_did)

  res.render('pages/profile_v2',{
    did: did,
    current_user: req.query["session"],
    handle: handle,
    key: key,
    followers: followers,
    followings: followings,
    followersCount: followers.length,
    followingsCount: followings.length,
    isRolodexFollower: isRolodexFollower,
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
    handleKeyMap.set(handle, key);

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

async function validateKey(handle, key) {
  //sign handle with key & call verify method in client with data
  var did = handleDIDMap.get(handle);
  try {
    var verificationMethod = await DIDKit.keyToVerificationMethod("key", key);
  } catch(e) {
    console.log(e);
    return false;
  }
  var proofOptions = {
    proofPurpose: "authentication",
    challenge: `${handle}`,
    verificationMethod: `${verificationMethod}`,
  };
  try {
    var vp = await DIDKit.DIDAuth(did, JSON.stringify(proofOptions), key);
  } catch (error) {
    console.error(error);
    return false;
  }

  var verifyOptions = {
    proofPurpose: "authentication",
    challenge: `${handle}`,
  };

  try {
    var response = await DIDKit.verifyPresentation(vp, JSON.stringify(verifyOptions));
  } catch (e) {
    console.log(e);
    return false;
  }
  var result = JSON.parse(response);
  console.log(result);
  console.log(result["checks"]);

  if (result["checks"][0] === "proof") {
    return true;
  } else {
    return false;
  }
}

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
