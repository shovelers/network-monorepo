import { createHelia } from 'helia';
import { dagCbor } from '@helia/dag-cbor';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { keyToDID } from '@spruceid/didkit-wasm-node';

const port = 4000;

const server = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

server.use(express.json());
server.use(cors());

server.use(express.urlencoded({ extended: true }));
server.set('views', path.join(__dirname, 'views'));
server.set('view engine', 'ejs');
server.use(express.static(path.join(__dirname, 'public')));

const Registries = {}
/*
 head = {regID1to1from2: cid1
         regID1to2from1: cid2}
*/
const Heads = new Map();

const helia = await createHelia()
const dag = await dagCbor(helia)

server.get("/", async (req, res) => {
  const helia = await createHelia()
  const d = await dagCbor(helia)

  const object1 = { to: 'did:1', from: 'did:2', state:'absent' }
  const myImmutableAddress1 = await d.add(object1)

  const object2 = { to:'did:1', from:'did:2', state:'requested', link: myImmutableAddress1 }
  const myImmutableAddress2 = await d.add(object2)

  const object3 = { to:'did:1', from:'did:2', state:'present', link: myImmutableAddress2 }
  const myImmutableAddress3 = await d.add(object3)

  const retrievedObject3 = await d.get(myImmutableAddress3)
  console.log('Object3:',  retrievedObject3)

  const retrievedObject2 = await d.get(myImmutableAddress2)
  console.log(`Object2: ${retrievedObject2}`)

  const retrievedObject1 = await d.get(myImmutableAddress1)
  console.log(`Object1: ${retrievedObject1}`)
  // { link: CID(baguqeerasor...) }

  console.log(await d.get(retrievedObject3.link))
  console.log(await d.get(retrievedObject2.link))
  // { hello: 'world' }
  res.render('pages/index', {
    data: retrievedObject3,
  })
});

server.listen(port, (err) => {
  if (err) throw err;
  console.log(
    `> Ready`
  );
});

/*
sample re.body =
  {
    "name": "simple_follow_follow",
    "publickey": {"kty":"OKP","crv":"Ed25519","x":"EL_Z0oW6OLhN4Pe4LAzzGmOWkGZpxmhoqD0IAvQ4wGA"}
  }
  */
server.post("/registry", async (req, res) => {
  var registryDID = await createRegistry(req.body)
  console.log(`registry created with did ${registryDID}`)
  res.status(200).json({"did": registryDID})
})

/*
 sample req.body =
 {
   "registryID": "did:reg",
   "to": "did:a",
   "from": "did:b",
   "state": "requested",
   "sig": "hakjshdkjasnd"
 }
 */
server.post("/event", async (req, res) => {
  var CID = await addEvent(req.body)
  res.status(200).json({"cid": CID})
})

async function createRegistry(body) {
  var name = body.name
  var publickey = body.publickey
  var did = keyToDID('key', JSON.stringify(publickey))

  return did
}

async function addEvent (body) {
  var relID = `${body.regID}` + `${body.to}` + `${body.from}`
  if (Heads.has(relID)) {
    var CID = Heads.get(relID);
    console.log("already present CID", CID)
    const object = { event: body, link: CID };
    const newCID = await dag.add(object);
    Heads.set(relID, newCID);
    console.log('newCID:', newCID)
    var top = await dag.get(newCID)
    console.log("top", top)
    console.log("first", await dag.get(top.link))
    return newCID

  } else {
    const object = { event: body };
    const CID = await dag.add(object);
    Heads.set(relID, CID)
    console.log("set CID", CID)
    console.log('CID:',  CID)
    console.log("first", await dag.get(CID))
    return CID
  }
}
