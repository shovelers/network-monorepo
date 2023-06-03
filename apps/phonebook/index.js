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

const apps = [
  { name: "Rolodex",       graphDID: "did:graph:rolodex" },
  { name: "Simple Follow", graphDID: "did:graph:simple_follow" }
]

server.get("/", (req, res) => {
  res.render('pages/index');
});

server.get("/users/:did", async (req, res) => {
  var socialGraph = []
  for (const app of apps) {
    var graphData = await c.readGraph(app.graphDID);
    var relationships = await relationshipFor(req.params.did, graphData);
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

async function relationshipFor(did, graphData) {
  var list = [];
  graphData.forEach(function (item, index) {
    if ((item['from'] == did) || (item['to'] == did))
      list.push(item);
  });
  return list;
}
