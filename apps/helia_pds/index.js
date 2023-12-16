import { PublicDirectory, PrivateDirectory, PrivateForest, share, createShareName, Name } from "wnfs";
import { WnfsBlockstore, Rng, ExchangeKey,  PrivateKey } from './src/helia_wnfs_blockstore_adaptor.js';
import { createStandaloneNode } from './src/helia_node.js';
import { CID } from 'multiformats/cid'
import { toString } from 'uint8arrays'
import { PublicFileExample } from './src/public_file_example.js';

// file = new PublicFileExample(await createBrowserNode())
// await file.write("Hello World 101")
// console.log(await file.read())

const node = await createStandaloneNode()
const multiaddrs = node.libp2p.getMultiaddrs()
console.log("node address:", multiaddrs);

const file = new PublicFileExample(node)
const fileCID = await file.write("Standalone: Hello World")
console.log("PublicFileCID: ", CID.decode(fileCID))

//Public Directory
const wnfsBlockstore = new WnfsBlockstore(node)
const dir = new PublicDirectory(new Date());
var { rootDir } = await dir.mkdir(["pictures", "cats"], new Date(), wnfsBlockstore);

var content = new TextEncoder().encode("Hello World 101")

var { rootDir } = await rootDir.write(
  ["pictures", "cats", "tabby.txt"],
  content,
  new Date(),
  wnfsBlockstore
);
console.log("root after write", rootDir)

var rootDirCID = await rootDir.store(wnfsBlockstore)
console.log("Public rootDirCID:", CID.decode(rootDirCID))

// List all files in /pictures directory.
var result  = await rootDir.ls(["pictures"], wnfsBlockstore);
console.log("existent test: ",result)

var fileContent = await rootDir.read(["pictures", "cats", "tabby.txt"], wnfsBlockstore)

console.log("Files Content:", new TextDecoder().decode(fileContent));

//Private Directory
const rng = new Rng()
const initialForest = new PrivateForest(rng)
console.log("initial forest: ", initialForest)
const privateDir = new PrivateDirectory(initialForest.emptyName(), new Date(), rng)
console.log("private dir: ", privateDir)

var { rootDir, forest } = await privateDir.mkdir(["private", "cats"], true, new Date(), initialForest, wnfsBlockstore, rng);

var privateContent = new TextEncoder().encode("Hello Private World 101")

var { rootDir, forest } = await rootDir.write(["private", "cats", "tabby.png"], true, privateContent, new Date(), forest, wnfsBlockstore, rng);

var privateRootDir = await rootDir.store(forest, wnfsBlockstore, rng)
var forestCid = await privateRootDir[1].store(wnfsBlockstore)
console.log("private root dir object: ", privateRootDir)
console.log("Access Key: ", privateRootDir[0].toBytes())
process.stdout.write(privateRootDir[0].toBytes() + '\n');
console.log("private forest CID: ", CID.decode(forestCid))


var privateResult  = await rootDir.ls(["private"], true, forest, wnfsBlockstore);
console.log("private ls: ", privateResult)

var privateFileContent = await rootDir.read(["private", "cats", "tabby.png"], true, forest, wnfsBlockstore)
console.log("private file content: ", new TextDecoder().decode(privateFileContent.result))

// Share: Pass receipient's exchange root CID & recipientExchPubKey 
export async function generateShareLabel(recipientExchPubKey, recipientExchRootCid){
  const sharerRootDid = "did:key:z6MkqZjY";
  var recipientExchRootCid = CID.parse(recipientExchRootCid).bytes 
  
  var forest2 = await share(
    privateRootDir[0],
    0,
    sharerRootDid,
    recipientExchRootCid,
    privateRootDir[1],
    wnfsBlockstore
  );
  console.log("forest2: ", forest2)
  
  const shareLabel = createShareName(0, sharerRootDid, recipientExchPubKey, forest2);
  var forestCid = await forest2.store(wnfsBlockstore)

  var diff = await forest2.diff(privateRootDir[1], wnfsBlockstore)
  console.log("diff: ", diff)
  return {shareLabel: toString(shareLabel.toNameAccumulator(forest2).toBytes(), "base64url"), forestCid: CID.decode(forestCid)}
}