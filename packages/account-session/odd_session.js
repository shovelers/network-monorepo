import * as uint8arrays from 'uint8arrays';
import { Key } from 'interface-datastore';
import axios from 'axios'
import { RSASigner } from 'iso-signatures/signers/rsa.js'
import localforage from "localforage";
import { Approver } from './linking/approver.js';
import { Requester } from './linking/requester.js';

const SHOVEL_FS_ACCESS_KEY = "SHOVEL_FS_ACCESS_KEY"
const SHOVEL_ACCOUNT_HANDLE = "SHOVEL_ACCOUNT_HANDLE"
const SHOVEL_FS_FOREST_CID = "SHOVEL_FS_FOREST_CID"
const SHOVEL_AGENT_WRITE_KEYPAIR = "SHOVEL_AGENT_WRITE_KEYPAIR"

class Agent {
  constructor(helia) {
    this.helia = helia
    this.requester = new Requester(this)
    this.approver = new Approver(this)
  }

  async DID(){
    const signer = await this.signer()
    return signer.did
  }

  async sign(message){
    const signer = await this.signer()
    return signer.sign(message)
  }

  async envelop(message){
    message.signer = await this.DID()
    let encodedMessage = uint8arrays.fromString(JSON.stringify(message)) 
    let signature = await this.sign(encodedMessage)
    let encodedSignature = uint8arrays.toString(signature, 'base64')
    return { message: message, signature: encodedSignature }
  }

  async destroy() {
    await localforage.removeItem(SHOVEL_AGENT_WRITE_KEYPAIR)
  }

  async accessKey() {
    let ak = await this.helia.datastore.get(new Key(SHOVEL_FS_ACCESS_KEY))
    return uint8arrays.toString(ak, 'base64pad') 
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
    this.agent = new Agent(helia)
  }

  async registerUser(handle) {
    let encodeddHandle = uint8arrays.fromString(handle);
    await this.helia.datastore.put(new Key(SHOVEL_ACCOUNT_HANDLE), encodeddHandle)

    const did = await this.agent.DID()
    const fullname = `${handle}#${did}`

    let success = false
    const envelope = await this.agent.envelop({fullname: fullname})
    await this.axios_client.post('/accounts', envelope).then(async (response) => {
      console.log("account creation status", response.status)
      success = true
    }).catch(async (e) => {
      console.log(e);
      await this.destroy()
      return e
    })

    return success
  }

  async recover(kit) {
    var handle = kit.fullname.split('#')[0]

    let encodeddHandle = uint8arrays.fromString(handle);
    await this.helia.datastore.put(new Key(SHOVEL_ACCOUNT_HANDLE), encodeddHandle)

    await this.agent.destroy()
    const did = await this.agent.DID()
    const fullname = `${handle}#${did}`

    let success = false
    const envelope = await this.agent.envelop({fullname: fullname, recoveryKit: { generatingAgent: kit.fullname, signature: kit.signature }})
    await this.axios_client.put('/accounts', envelope).then(async (response) => {
      console.log("account recovery status", response.status)
      success = true
    }).catch(async (e) => {
      console.log(e);
      await this.destroy()
      return e
    })

    return success
  }

  async destroy() {
    await this.helia.datastore.delete(new Key(SHOVEL_FS_ACCESS_KEY))
    await this.helia.datastore.delete(new Key(SHOVEL_ACCOUNT_HANDLE))
    await this.helia.datastore.delete(new Key(SHOVEL_FS_FOREST_CID))
    await this.agent.destroy()
  }

  async activeSession() {
    let keypair = await localforage.getItem(SHOVEL_AGENT_WRITE_KEYPAIR)
    return (keypair != null)
  }

  async recoveryKitData(){
    const handle = await this.handle()
    const did = await this.agent.DID()
    const fullname = `${handle}#${did}`

    let ak = await this.helia.datastore.get(new Key(SHOVEL_FS_ACCESS_KEY))
    const encodedAccessKey = uint8arrays.toString(ak, 'base64pad');

    const envolope = await this.agent.envelop({fullname: fullname})
    return {fullname: fullname, accountKey: encodedAccessKey, signature: envolope.signature}
  }

  async handle() {
    let handle = await this.helia.datastore.get(new Key(SHOVEL_ACCOUNT_HANDLE))
    return uint8arrays.toString(handle)
  }
}