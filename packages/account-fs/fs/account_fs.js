import { PrivateFS } from "./private_fs.js"
import { dial } from './helia_node.js'
import axios from 'axios'
import { CID } from 'multiformats/cid'
import localforage from "localforage";

const SHOVEL_FS_ACCESS_KEY = "SHOVEL_FS_ACCESS_KEY"
const SHOVEL_FS_FOREST_CID = "SHOVEL_FS_FOREST_CID"

export class AccountFS {
  constructor(helia, agent, network, syncHost){
    this.helia = helia
    this.agent = agent
    this.fs = new PrivateFS(helia)
    this.prefix = (network == "TESTNET") ? "/dns4/testnet.shovel.company/tcp/443/tls/ws/p2p/" : "/ip4/127.0.0.1/tcp/3001/ws/p2p/"
    this.syncServer = null
    this.axios_client  = axios.create({baseURL: syncHost})
  }

  async load(){
    await this.startSync()

    try {
      let accessKey = await this.agent.accessKey()
      let forestCID = await this.agent.forestCID()

      if (accessKey && forestCID){
        await this.fs.loadForest(accessKey, forestCID)
      }
    } catch (err) {
      console.log("missing datastore keys, need an account")
      return 
    }
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
    let forestCID = await this.agent.forestCID()
    let accessKey = await this.fs.accessKeyForPrivateFile(filename)
    return [accessKey, forestCID]
  }

  async updatePrivateFile(filename, mutationFunction) {
    let content = await this.readPrivateFile(filename)
    let newContent = mutationFunction(content)
    var [access_key, forest_cid] = await this.fs.write(filename, JSON.stringify(newContent))

    await localforage.setItem(SHOVEL_FS_ACCESS_KEY, access_key)
    await localforage.setItem(SHOVEL_FS_FOREST_CID, forest_cid)

    this.pin(forest_cid)
    return newContent
  }

  async pin(forest_cid) {
    let cid = CID.decode(forest_cid).toString()
    let handle = await this.agent.handle()

    const envelope = await this.agent.envelop({cid: cid, handle: handle})
    await this.axios_client.post('/pin', envelope).then(async (response) => {
      console.log(response.status)
    }).catch((e) => {
      console.log(e);
      return e
    })
  }

  async startSync(){
    await this.axios_client.get('/bootstrap').then(async (response) => {
      this.syncServer = this.prefix + response.data.peerId
      await dial(this.helia, this.syncServer)
    }).catch((e) => {
      console.log(e);
      return e
    })
  }
}