import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'

export class WnfsBlockstore {
  constructor(node) {
    this.helia = node
  }

  async getBlock (cid){
    const decoded_cid = CID.decode(cid)
    const content = this.helia.blockstore.get(decoded_cid)
    return content
  }
  
  async putBlock (bytes, codec){
    const multihash = await sha256.digest(bytes)
    const cid = CID.createV1(codec, multihash)
    this.helia.blockstore.put(cid, bytes)
    return cid.bytes
  }
}

