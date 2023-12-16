import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import cors from 'cors';
import { ExchangeKey } from './helia_wnfs_blockstore_adaptor.js';
import { fromString } from 'uint8arrays'
import { createStandaloneNode } from './helia_node.js';
import { CID } from 'multiformats/cid'
import { ExamplePublicFile } from './example_public_file.js';
import { ExamplePrivateFile } from './example_private_file.js';
import { Sharer } from "./share.js";

globalThis.ExchangeKey = ExchangeKey;
const port = process.argv[2] || 3000;
const server = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

server.use(express.json());
server.use(cors());

server.use(express.urlencoded({ extended: true }));
server.set('views', path.join(__dirname, '../views'));
server.set('view engine', 'ejs');
server.use(express.static(path.join(__dirname, '../public')));

const node = await createStandaloneNode()
const multiaddrs = node.libp2p.getMultiaddrs()
console.log("node address:", multiaddrs);

const publicFile = new ExamplePublicFile(node)
const publicFileCID = await publicFile.write("Standalone: Public Hello World")
console.log("PublicFileCID: ", CID.decode(publicFileCID))

const privateFile = new ExamplePrivateFile(node)
const [accessKey, privateForestCID] = await privateFile.write("Standalone: Private Hello World")
process.stdout.write("AccessKey: " + accessKey + '\n');
console.log("PrivateForestCID: ", CID.decode(privateForestCID))

const sharer = new Sharer(privateFile)

server.get("/", (req, res) => {
  res.render('pages/index')
});

server.post("/generate_share", (req, res) => {
  var key = fromString(req.body.key, "base64url")

  sharer.generateShareLabel(key, req.body.cid).then((result) => {
    console.log(result)
    res.send(result);
  });
}
)

server.listen(port, (err) => {
  if (err) throw err;
  console.log(
    `> Ready`
  );
});