const express = require("express");
const { Client } = require("twitter-api-sdk");
const { Parser } = require('json2csv');
const zip = require('adm-zip');
const DIDKit = require('@spruceid/didkit-wasm-node');

const Protocol = require('client');
const c = new Protocol();

const path = require("path");
const port = 3000;
const client = new Client(process.env.BEARER_TOKEN);

const server = express();

server.use(express.urlencoded({ extended: true }))
server.set('views', path.join(__dirname, 'views'));
server.set('view engine', 'ejs');
server.use(express.static(path.join(__dirname, 'public')))

const HandleToDID = {}
var app_did = "did:dcn:rolodex"
var graph_did = "did:graph:rolodex"
c.registerApp(app_did,"qwerdsfasdfasfasdfsafasfdfghjkjhgfdsasdfghjmknbvcxcvbnbvcuy")
c.registerGraph(graph_did,"qwertyuiolpasdfghjkjhgfdsasdfghjmknbvcxcvbnbvcxzfghudsdfyuy", app_did)

server.get("/", (req, res) => {
  res.render('pages/index')
});


server.post("/social_graph", async (req, res) => {
  var handle = req.body.fhandle;
  var result = await handleGraph(handle.toLowerCase());

  if (typeof result === "undefined" || typeof result["followers"] === "undefined" || typeof result["followings"] === "undefined") {
    res.status(404).send("Wrong Twitter Handle or Protected Account!")
  };

  res.render('pages/social_graph', {
    profile: result["profile"],
    user_did: result["user_did"],
    followers: result["followers"],
    followings: result["followings"]
  });
})

server.post("/download", async (req, res) => {
  var handle = req.body.handle;
  var result = await handleGraph(handle.toLowerCase());

  var follower_csv = createCSV(result["followers"]);
  var following_csv = createCSV(result["followings"]);

  var zipper = new zip();
  zipper.addFile("follower.csv", Buffer.from(follower_csv));
  zipper.addFile("following.csv", Buffer.from(following_csv));

  const downloadName = 'twitter_social_graph.zip';
  const data = zipper.toBuffer();

  res.set('Content-Type','application/octet-stream');
  res.set('Content-Disposition',`attachment; filename=${downloadName}`);
  res.set('Content-Length',data.length);
  res.send(data);
});

server.listen(port, (err) => {
  if (err) throw err;
  console.log(
    `> Ready on ${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co on port ${port}`
  );
});

async function handleGraph(handle) {
  var user_did = await getDIDforHandle(handle);

  var user = await(client.users.findUserByUsername(handle));
  var user_id = user["data"]["id"];
  var profile = await(client.users.findUserById(
    user_id,
    {
      "user.fields": ["description", "public_metrics"]
    }));
  const followers = await(client.users.usersIdFollowers(user_id, {max_results: 1000}));
  const followings = await(client.users.usersIdFollowing(user_id, {max_results: 1000}));

  for (const element of followers["data"]) {
    var did = await getDIDforHandle(element.username)
    c.insertGraph(graph_did, did, user_did, new Date())
  }

  for (const element of followings["data"]) {
    var did = await getDIDforHandle(element.username)
    c.insertGraph(graph_did, user_did, did, new Date())
  }

  console.log(handle, user_did, HandleToDID[handle], getDIDforHandle(handle), Object.keys(HandleToDID).length)
  return {"profile": profile["data"], "followers": followers["data"], "followings": followings["data"], "user_did": user_did}
}

function createCSV(data) {
  const fields = ['name', 'username'];
  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(data);
  return csv
}

async function getDIDforHandle(handle) {
  if (HandleToDID[handle] !== undefined){
    console.log("hit", handle)
    return HandleToDID[handle]
  }
  // TODO - use promise instead, so that if given to a caller they can get the correct final value
  HandleToDID[handle] = "placeholder"

  var key = await DIDKit.generateEd25519Key();
  var result = await c.generateDID(key);

  var did = result["did"];
  var doc = result["doc"];
  var profile = {app_did: app_did, twitter_handle: handle}
  c.registerUser(did, doc, profile);

  HandleToDID[handle] = did
  console.log(handle, did, Object.keys(HandleToDID).length)

  return did
}
