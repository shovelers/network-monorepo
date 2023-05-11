const express = require("express");
const { Client } = require("twitter-api-sdk");
const { Parser } = require('json2csv');
const zip = require('adm-zip');
const fs = require('fs');

const c = require('client');
console.log(c);

const path = require("path");
const port = 3000;
const client = new Client(process.env.BEARER_TOKEN);

const server = express();

server.use(express.urlencoded({ extended: true }))
server.set('views', path.join(__dirname, 'views'));
server.set('view engine', 'ejs');
server.use(express.static(path.join(__dirname, 'public')))

server.get("/", (req, res) => {
  res.render('pages/index')
});


server.post("/social_graph", async (req, res) => {
  var handle = req.body.fhandle;
  var result = await handleGraph(handle.toLowerCase());
  
  if (typeof result === "undefined" || typeof result["followers"] === "undefined" || typeof result["followings"] === "undefined") {
    res.status(404).send("Wrong Twitter Handle or Protected Account!")
  };
  
  fs.appendFile('graph_check_count.txt', handle + "\n" , function (err) {
  if (err) throw err;
  console.log('graph check!');
  });
  
  res.render('pages/social_graph', {
    profile: result["profile"],
    followers: result["followers"],
    followings: result["followings"]
  });
})

server.post("/download", async (req, res) => {
  var handle = req.body.handle;
  var result = await handleGraph(handle.toLowerCase());
  
  fs.appendFile('download_count.txt', handle + "\n", function (err) {
  if (err) throw err;
  console.log('data downloaded!');
  });
  
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
    `> Ready on ${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
  );
});

async function handleGraph(handle) {
  var user = await(client.users.findUserByUsername(handle));
  var user_id = user["data"]["id"];
  var profile = await(client.users.findUserById(
    user_id,
    {
      "user.fields": ["description", "public_metrics"]
    }));
  const followers = await(client.users.usersIdFollowers(user_id, {max_results: 1000}));
  const followings = await(client.users.usersIdFollowing(user_id, {max_results: 1000}));

  return {"profile": profile["data"], "followers": followers["data"], "followings": followings["data"]}
}

function createCSV(data) {
  const fields = ['name', 'username'];
  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(data);
  return csv
}