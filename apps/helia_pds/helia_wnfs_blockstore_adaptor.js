import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'

export class WnfsBlockstore {
  constructor(node) {
    this.helia = node
  }

  async getBlock (cid){
    this.helia.blockstore.get(cid)
  }
  
  async putBlock (bytes, codec){
    console.log("I am here")
    const multihash = await sha256.digest(bytes)
    const cid = CID.createV1(codec, multihash)
    this.helia.blockstore.put(cid, bytes)
  }
}

