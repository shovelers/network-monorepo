import { WnfsBlockstore, PrivateKey, Rng} from './helia_wnfs_blockstore_adaptor.js';
import { PublicDirectory, PrivateForest, receiveShare, Name, NameAccumulator, share, createShareName } from "wnfs";
import { CID } from 'multiformats/cid'
import { toString, fromString } from 'uint8arrays';

export class Recipient {
  constructor(node) {
    this.store = new WnfsBlockstore(node)
  }

  async createExchangeRoot() {
    const keypair = await PrivateKey.generate();
    const excPubKey = await keypair.getPublicKey().getPublicKeyModulus()

    const { rootDir } = await new PublicDirectory(new Date()).write(
      ["device1", "v1.exchange_key"],
      excPubKey,
      new Date(),
      this.store
    );

    const recipientExchRootCid = await rootDir.store(this.store);
   
    this.exchangeDir = rootDir
    this.exchRootCid = recipientExchRootCid
    this.keypair = keypair

    return [toString(excPubKey, 'base64url'), CID.decode(recipientExchRootCid).toString()]
  }

  async acceptShare(shareLabel, forestCID) {
    const rng = new Rng()
    const forest = await PrivateForest.load(CID.parse(forestCID).bytes, this.store)
    console.log("loaded forest:", forest)

    shareLabel = new Name(NameAccumulator.fromBytes(fromString(shareLabel, "base64url"))); 
    console.log("shareLabel:", shareLabel)

    const sharedNode = await receiveShare(
      shareLabel,
      this.keypair,
      forest,
      this.store
    );
    console.log("sharedNode:", sharedNode)
  
    const { rootDir } = await sharedNode.asDir().ls([], true, forest, this.store);
    console.log("rootDir:", rootDir)
    var privateFileContent = await rootDir.read(["private", "note.txt"], true, forest, this.store)
    console.log(new TextDecoder().decode(privateFileContent.result))
  }
}

export class Sharer {
  constructor(file) {
    this.file = file
  }
  
  async generateShareLabel(recipientExchPubKey, recipientExchRootCid){
    const sharerRootDid = "did:key:z6MkqZjY";
    var recipientExchRootCid = CID.parse(recipientExchRootCid).bytes 
    
    var forest2 = await share(
      this.file.accessKey,
      0,
      sharerRootDid,
      recipientExchRootCid,
      this.file.forest,
      this.file.store
    );
    console.log("forest2: ", forest2)
    
    const shareLabel = createShareName(0, sharerRootDid, recipientExchPubKey, forest2);
    var forestCid = await forest2.store(this.file.store)
  
    return {shareLabel: toString(shareLabel.toNameAccumulator(forest2).toBytes(), "base64url"), forestCid: CID.decode(forestCid)}
  }
}