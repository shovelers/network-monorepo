import { PublicDirectory, PrivateDirectory, PrivateForest, share, createShareName, Name } from "wnfs";
import { createStandaloneNode } from './src/helia_node.js';
import { CID } from 'multiformats/cid'
import { toString } from 'uint8arrays'
import { ExamplePublicFile } from './src/example_public_file.js';
import { ExamplePrivateFile } from './src/example_private_file.js';

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

export async function generateShareLabel(recipientExchPubKey, recipientExchRootCid){
  const sharerRootDid = "did:key:z6MkqZjY";
  var recipientExchRootCid = CID.parse(recipientExchRootCid).bytes 
  
  var forest2 = await share(
    privateFile.accessKey,
    0,
    sharerRootDid,
    recipientExchRootCid,
    privateFile.forest,
    privateFile.store
  );
  console.log("forest2: ", forest2)
  
  const shareLabel = createShareName(0, sharerRootDid, recipientExchPubKey, forest2);
  var forestCid = await forest2.store(privateFile.store)

  return {shareLabel: toString(shareLabel.toNameAccumulator(forest2).toBytes(), "base64url"), forestCid: CID.decode(forestCid)}
}