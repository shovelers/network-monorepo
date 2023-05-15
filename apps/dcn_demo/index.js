const express = require("express");
const DIDKit = require('@spruceid/didkit-wasm-node');
const Database = require("@replit/database");
const { v4: uuidv4 } = require('uuid');

const path = require("path");
const port = 3001;

const server = express();
const db = new Database();

server.use(express.urlencoded({ extended: true }));
server.set('views', path.join(__dirname, 'views'));
server.set('view engine', 'ejs');
server.use(express.static(path.join(__dirname, 'public')));

server.get("/", (req, res) => {
  res.render('pages/index')
});

server.post("/account", async (req, res) => {
  var handle = req.body.fhandle;
  var handleAlreadyTaken = await handleUniqueness(handle);

  if (handleAlreadyTaken == false) {
    var result = await createAccount(handle);
    console.log(`Account created for handle:${handle}, did:${result["did"]}`);
    res.redirect(`profile/${result["did"]}`);
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
    var did = await didByHandle(handle);
    console.log(`Profile lookup for handle:${handle}, DID: ${did}`);
    res.redirect(`profile/${did}`);
  };
});

server.post("/request_follow", async (req, res) => {
  var handle = req.body.fhandle;
  
  var userExists = await handleUniqueness(handle);

  if (userExists == true) {
    var issuerDID = await didByHandle(handle);
    var subjectDID = req.body.subjectDID;
    
    var alreadyPending = await checkPendingRequest(subjectDID, issuerDID);
    
    var alreadyFollowing = await checkFollowing(subjectDID, issuerDID); 
    
    if (alreadyPending == false && alreadyFollowing == false) {
      issuerInbox = await db.get(`inbox-${issuerDID}`);
      issuerInbox.push(subjectDID);
      db.set(`inbox-${issuerDID}`, issuerInbox);
      
      addPendingRequest(subjectDID, issuerDID);

      res.send("Request Sent");
      res.status(201);
    } else {
      res.status(409).send(`Follow Request already sent Or Already following ${handle}`);
    }
  } else {
    console.log(`Account with handle:${handle} doesn't exist`);
    res.status(404).send(`Account with handle:${handle} doesn't exist`);
  };
});

server.post("/accept_follow", async (req, res) => {
  var subjectDID = req.body.subjectDID;
  var issuerDID = req.body.issuerDID;
  
  var signedVC = await issueVC(subjectDID, issuerDID);

  updateFollowing(subjectDID, signedVC);

  updateFollowers(issuerDID, signedVC);

  removeRequestFromInbox(subjectDID, issuerDID);

  removeRequestFromPending(subjectDID, issuerDID);
  
  res.redirect(`profile/${issuerDID}`);
});

server.get("/profile/:id", async (req, res) => {
  var params = req.params;
  var did = params["id"];
  var result = await db.get(did);
  var followers = await db.get(`followers-${did}`);
  var following = await db.get(`following-${did}`);

  res.render('pages/profile_v2',{
    did: params["id"],
    key: result["key"],
    handle: result["handle"],
    follower_count: followers.length,
    following_count: following.length
  });
});

server.get("/contactlist/:id", async (req, res) => {
  var params = req.params;
  var did = params["id"];
  var doc = DIDKit.resolveDID(did, "{}");
  var inbox = await db.get(`inbox-${did}`);
  var followers = await db.get(`followers-${did}`);
  var following = await db.get(`following-${did}`);
  var pendingRequests = await db.get(`pending-${did}`);

  res.render('pages/contact_list',{
    did: did,
    inbox: inbox,
    doc: JSON.stringify(JSON.parse(await doc), null, 2),
    followers: followers,
    following: following,
    pendingRequests: pendingRequests
  });
});

server.listen(port, (err) => {
  if (err) throw err;
  console.log(
    `> Ready on ${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co on port ${port}`
  );
});

async function handleUniqueness(handle) {
  var handlesTaken = await db.list("handle-");
  return handlesTaken.includes(`handle-${handle}`);
};

async function checkPendingRequest(subjectDID, issuerDID) {
  var pendingList = await db.get(`pending-${subjectDID}`);
  return pendingList.includes(issuerDID);
};

async function checkFollowing(subjectDID, issuerDID) {
  var followingList = await db.get(`following-${subjectDID}`);
  var followingDIDs = []
  followingList.forEach((element) => {
    console.log(JSON.parse(element));
    followingDIDs.push(JSON.parse(element).issuer);
  })

  return followingDIDs.includes(issuerDID);
};

async function createAccount(handle) {
  var key = DIDKit.generateEd25519Key();
  var did = DIDKit.keyToDID('key', key);
  var doc = DIDKit.resolveDID(did, "{}");

  db.set(did, {"key": key, "handle": handle});
  db.set(`inbox-${did}`, []);
  db.set(`followers-${did}`, []);
  db.set(`following-${did}`, []);
  db.set(`handle-${handle}`, did);
  db.set(`pending-${did}`, []);

  return {key: key, did: did, doc:doc}
};

async function didByHandle(handle) {
  return db.get(`handle-${handle}`)
};

async function constructUnsignedVC(subjectDID, issuerDID) {
  var uuid = uuidv4();
  var date = new Date().toISOString();

  return `{\"@context\": \"https://www.w3.org/2018/credentials/v1\",\"id\":\"urn:did:${uuid}\",\"type\": [\"VerifiableCredential\"],\"issuer\": \"${issuerDID}\",\"issuanceDate\": \"${date}\",\"credentialSubject\": {\"id\": \"${subjectDID}\"}}`
};

async function issueVC(subjectDID, issuerDID){
  var unsignedVC = await constructUnsignedVC(subjectDID, issuerDID);
  
  var issuer = await db.get(issuerDID);
  var signingKey = issuer["key"];
  var issuerVerificationMethod = await DIDKit.keyToVerificationMethod("key", signingKey);
  var vcOptions = `{"proofPurpose": "assertionMethod", "verificationMethod": "${issuerVerificationMethod}"}`;

  var signedVC = await DIDKit.issueCredential(unsignedVC, vcOptions, signingKey).catch(e => { console.log(e) });

  return signedVC;
};

async function updateFollowing(did, message) {
  var followingList = await db.get(`following-${did}`);
  followingList.push(message);
  db.set(`following-${did}`, followingList);
};

async function updateFollowers(did, message) {
  var followersList = await db.get(`followers-${did}`);
  followersList.push(message);
  db.set(`followers-${did}`, followersList);
};

async function removeRequestFromInbox(subjectDID, issuerDID) {
  var inbox = await db.get(`inbox-${issuerDID}`);
  const index = inbox.indexOf(subjectDID);
  if (index > -1) {
    inbox.splice(index, 1);
  }
  db.set(`inbox-${issuerDID}`, inbox);
};

async function addPendingRequest(subjectDID, issuerDID) {
  var pending = await db.get(`pending-${subjectDID}`);
  pending.push(issuerDID);
  db.set(`pending-${subjectDID}`, pending);
};

async function removeRequestFromPending(subjectDID, issuerDID) {
  var pending = await db.get(`pending-${subjectDID}`);
  const index = pending.indexOf(issuerDID);
  if (index > -1) {
    pending.splice(index, 1);
  }
  db.set(`pending-${subjectDID}`, pending);
};
