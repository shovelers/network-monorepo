import { PrivateFS } from "./private_fs.js"
import { dial } from './helia_node.js'
import axios from 'axios'
import { CID } from 'multiformats/cid'

const SHOVEL_FS_ACCESS_KEY = "SHOVEL_FS_ACCESS_KEY"
const SHOVEL_FS_FOREST_CID = "SHOVEL_FS_FOREST_CID"
const USERNAME_STORAGE_KEY = "fullUsername"

export class AccountFS {
  constructor(helia, kvStore, network, syncHost){
    this.helia = helia
    this.fs = new PrivateFS(helia)
    this.kvStore = kvStore
    this.prefix = (network == "TESTNET") ? "/dns4/testnet.shovel.company/tcp/443/tls/ws/p2p/" : "/ip4/127.0.0.1/tcp/3001/ws/p2p/"
    this.axios_client  = axios.create({baseURL: syncHost})
  }

  async load(){
    let access_key = await this.kvStore.getItem(SHOVEL_FS_ACCESS_KEY)
    let forest_cid = await this.kvStore.getItem(SHOVEL_FS_FOREST_CID)

    if (access_key && forest_cid){
      await this.fs.loadForest(access_key, forest_cid)
    }

    await this.startSync()
  }

  async recover(handle, access_key) {    
    let forest_cid = await this.getForestCidForHandle(handle)
    forest_cid = CID.parse(forest_cid).bytes

    await this.kvStore.setItem(SHOVEL_FS_ACCESS_KEY, access_key)
    await this.kvStore.setItem(SHOVEL_FS_FOREST_CID, forest_cid)
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

  async updatePrivateFile(filename, mutationFunction) {
    let content = await this.readPrivateFile(filename)
    let newContent = mutationFunction(content)
    var [access_key, forest_cid] = await this.fs.write(filename, JSON.stringify(newContent))
    await this.kvStore.setItem(SHOVEL_FS_ACCESS_KEY, access_key)
    await this.kvStore.setItem(SHOVEL_FS_FOREST_CID, forest_cid)
    this.pin(forest_cid)
    return newContent
  }

  async pin(forest_cid) {
    let cid = CID.decode(forest_cid).toString()
    // Remove following coupling with odd sdk
    let handle = (await this.kvStore.getItem(USERNAME_STORAGE_KEY)).split('#')[0] 
    await this.axios_client.post('/pin', { cid: cid, handle: handle }).then(async (response) => {
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