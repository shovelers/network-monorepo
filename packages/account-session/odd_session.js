import * as uint8arrays from 'uint8arrays';
import { Key } from 'interface-datastore';
import axios from 'axios'
import { RSASigner } from 'iso-signatures/signers/rsa.js'
import localforage from "localforage";

const SHOVEL_FS_ACCESS_KEY = "SHOVEL_FS_ACCESS_KEY"
const SHOVEL_ACCOUNT_HANDLE = "SHOVEL_ACCOUNT_HANDLE"
const SHOVEL_FS_FOREST_CID = "SHOVEL_FS_FOREST_CID"
const SHOVEL_AGENT_WRITE_KEYPAIR = "SHOVEL_AGENT_WRITE_KEYPAIR"

class Agent {
  constructor() {}

  async DID(){
    const signer = await this.signer()
    return signer.did
  }

  async sign(message){
    const signer = await this.signer()
    return signer.sign(message)
  }

  //Private
  async signer(){
    let keypair = await localforage.getItem(SHOVEL_AGENT_WRITE_KEYPAIR)
    if (keypair) {
      return RSASigner.import(keypair)
    }

    const signer = await RSASigner.generate()
    await localforage.setItem(SHOVEL_AGENT_WRITE_KEYPAIR, signer.export())
    
    return signer
  }
}

export class AccountSession {
  constructor(helia, accountHost) {
    this.helia = helia
    this.axios_client  = axios.create({baseURL: accountHost})
    this.agent = new Agent()
  }

  async registerUser(handle) {
    let encodeddHandle = uint8arrays.fromString(handle);
    await this.helia.datastore.put(new Key(SHOVEL_ACCOUNT_HANDLE), encodeddHandle)

    const did = await this.agentDID()
    const fullname = `${handle}#${did}`

    await this.axios_client.post('/accounts', { fullname: fullname }).then(async (response) => {
      console.log("account creation status", response.status)
    }).catch((e) => {
      console.log(e);
      return e
    })

    return fullname
  }

  async destroy() {
    await this.helia.datastore.delete(new Key(SHOVEL_FS_ACCESS_KEY))
    await this.helia.datastore.delete(new Key(SHOVEL_ACCOUNT_HANDLE))
    await this.helia.datastore.delete(new Key(SHOVEL_FS_FOREST_CID))
    await localforage.clear()
  }

  async activeSession() {
    let keypair = await localforage.getItem(SHOVEL_AGENT_WRITE_KEYPAIR)
    return (keypair != null)
  }

  async recoveryKitData(){
    let ak = await this.helia.datastore.get(new Key(SHOVEL_FS_ACCESS_KEY))
    let hd = await this.helia.datastore.get(new Key(SHOVEL_ACCOUNT_HANDLE))
    return {accessKey: ak, handle: uint8arrays.toString(hd)}
  }

  async agentDID(){
    return (await this.agent.DID())
  }

  async sign(message){
    return (await this.agent.sign(message))
  }
}