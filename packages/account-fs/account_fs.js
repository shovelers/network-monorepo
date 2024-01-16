import { PrivateFS } from "./private_fs.js"
import { dial } from './helia_node.js'
import axios from 'axios'
import { CID } from 'multiformats/cid'
import { Key } from 'interface-datastore';
import * as uint8arrays from 'uint8arrays';

const SHOVEL_FS_ACCESS_KEY = "SHOVEL_FS_ACCESS_KEY"
const SHOVEL_FS_FOREST_CID = "SHOVEL_FS_FOREST_CID"
const SHOVEL_ACCOUNT_HANDLE = "SHOVEL_ACCOUNT_HANDLE"

export class AccountFS {
  constructor(helia, session, network, syncHost){
    this.helia = helia
    this.session = session
    this.fs = new PrivateFS(helia)
    this.prefix = (network == "TESTNET") ? "/dns4/testnet.shovel.company/tcp/443/tls/ws/p2p/" : "/ip4/127.0.0.1/tcp/3001/ws/p2p/"
    this.axios_client  = axios.create({baseURL: syncHost})
  }

  async load(){
    await this.startSync()

    try {
      let access_key = await this.helia.datastore.get(new Key(SHOVEL_FS_ACCESS_KEY))
      let forest_cid = await this.helia.datastore.get(new Key(SHOVEL_FS_FOREST_CID))

      if (access_key && forest_cid){
        await this.fs.loadForest(access_key, forest_cid)
      }
    } catch (err) {
      console.log("missing datastore keys, need an account")
      return 
    }
  }

  async recover(handle, access_key) {    
    let forest_cid = await this.getForestCidForHandle(handle)
    forest_cid = CID.parse(forest_cid).bytes

    await this.helia.datastore.put(new Key(SHOVEL_FS_ACCESS_KEY), access_key)
    await this.helia.datastore.put(new Key(SHOVEL_FS_FOREST_CID), forest_cid)

    await this.load()
  }

  async getForestCidForHandle(handle){
    let forest_cid;
    await this.axios_client.get('/forestCID/'+ handle).then(async (response) => {
      console.log("response", response.status, response.data)
      forest_cid = response.data.cid
    }).catch((e) => {
      console.log(e);
      return e
    })
    return forest_cid; 
  }

  async readPrivateFile(filename) {
    try {
      let content = await this.fs.read(filename)
      return JSON.parse(content)
    } catch (error) {
      console.log("missing file: ", filename)
    }
  }

  async getAccessKeyForPrivateFile(filename) {
    let forest_cid = await this.helia.datastore.get(new Key(SHOVEL_FS_FOREST_CID))
    let access_key = await this.fs.accessKeyForPrivateFile(filename)
    return [access_key, forest_cid]
  }

  async updatePrivateFile(filename, mutationFunction) {
    let content = await this.readPrivateFile(filename)
    let newContent = mutationFunction(content)
    var [access_key, forest_cid] = await this.fs.write(filename, JSON.stringify(newContent))

    await this.helia.datastore.put(new Key(SHOVEL_FS_ACCESS_KEY), access_key)
    await this.helia.datastore.put(new Key(SHOVEL_FS_FOREST_CID), forest_cid)

    this.pin(forest_cid)
    return newContent
  }

  async pin(forest_cid) {
    let cid = CID.decode(forest_cid).toString()
    // Need to model handle as first class citizen on network
    let handle = await this.helia.datastore.get(new Key(SHOVEL_ACCOUNT_HANDLE))
    handle = uint8arrays.toString(handle)

    const envelope = await this.session.agent.envelop({cid: cid, handle: handle})
    await this.axios_client.post('/pin', envelope).then(async (response) => {
      console.log(response.status)
    }).catch((e) => {
      console.log(e);
      return e
    })
  }

  async startSync(){
    await this.axios_client.get('/bootstrap').then(async (response) => {
      const peerAddress = this.prefix + response.data.peerId
      await dial(this.helia, peerAddress)
    }).catch((e) => {
      console.log(e);
      return e
    })
  }
}