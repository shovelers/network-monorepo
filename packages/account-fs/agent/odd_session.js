import * as uint8arrays from 'uint8arrays';
import { Key } from 'interface-datastore';
import axios from 'axios'
import { RSASigner } from 'iso-signatures/signers/rsa.js'
import localforage from "localforage";
import { Approver } from './linking/approver.js';
import { Requester } from './linking/requester.js';
import { multiaddr } from '@multiformats/multiaddr'

const SHOVEL_FS_ACCESS_KEY = "SHOVEL_FS_ACCESS_KEY"
const SHOVEL_ACCOUNT_HANDLE = "SHOVEL_ACCOUNT_HANDLE"
const SHOVEL_FS_FOREST_CID = "SHOVEL_FS_FOREST_CID"
const SHOVEL_AGENT_WRITE_KEYPAIR = "SHOVEL_AGENT_WRITE_KEYPAIR"

class Channel {
  constructor(helia, channelName) {
    this.helia = helia
    this.channelName = channelName
  }

  async publish(message) {
    this.helia.libp2p.services.pubsub.publish(this.channelName, new TextEncoder().encode(message))
    console.log(message)
  }
}

export class Agent {
  constructor(helia, accountHost) {
    this.helia = helia
    this.axios_client  = axios.create({baseURL: accountHost})
  }

  async actAsApprover() {
    let handle = await this.helia.datastore.get(new Key(SHOVEL_ACCOUNT_HANDLE))
    const channelName = uint8arrays.toString(handle)

    let agent = this
    const channel = new Channel(this.helia, channelName)
    this.approver = new Approver(this, channel, async (message) => { return await agent.linkDevice(message) })

    this.helia.libp2p.services.pubsub.addEventListener('message', (message) => {
      console.log(`${message.detail.topic}:`, new TextDecoder().decode(message.detail.data))
      if (message.detail.topic == channelName) {
        this.approver.handler(new TextDecoder().decode(message.detail.data))
      }
    })
    
    this.helia.libp2p.services.pubsub.subscribe(channelName)
  }

  async actAsRequester(address, channelName) {
    const channel = new Channel(this.helia, channelName)
    let agent = this
    this.requester = new Requester(this, channel, async (message) => { return await agent.createSession(channelName, message)})

    this.helia.libp2p.services.pubsub.addEventListener('message', (message) => {
      console.log(`${message.detail.topic}:`, new TextDecoder().decode(message.detail.data))
      if (message.detail.topic == channelName) {
        this.requester.handler(new TextDecoder().decode(message.detail.data))
      }
    })

    await this.helia.libp2p.dial(multiaddr(address));
    
    this.helia.libp2p.services.pubsub.subscribe(channelName)
    this.requester.initiate()
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

  async accessKey() {
    let ak = await this.helia.datastore.get(new Key(SHOVEL_FS_ACCESS_KEY))
    return uint8arrays.toString(ak, 'base64pad') 
  }

  async forestCID() {
    let cid = await this.helia.datastore.get(new Key(SHOVEL_FS_FOREST_CID))
    return uint8arrays.toString(cid, 'base64pad') 
  }

  async signer(){
    let keypair = await localforage.getItem(SHOVEL_AGENT_WRITE_KEYPAIR)
    if (keypair) {
      return RSASigner.import(keypair)
    }

    const signer = await RSASigner.generate()
    await localforage.setItem(SHOVEL_AGENT_WRITE_KEYPAIR, signer.export())
    
    return signer
  }

  async createSession(handle, message) {
    let encodedAccessKey = uint8arrays.fromString(message.accessKey, "base64pad")
    let encodeddHandle = uint8arrays.fromString(handle);
    let encodedForestCID = uint8arrays.fromString(message.forestCID, "base64pad")
    await this.helia.datastore.put(new Key(SHOVEL_ACCOUNT_HANDLE), encodeddHandle)
    await this.helia.datastore.put(new Key(SHOVEL_FS_ACCESS_KEY), encodedAccessKey)
    await this.helia.datastore.put(new Key(SHOVEL_FS_FOREST_CID), encodedForestCID)
  }

  async registerUser(handle) {
    let encodeddHandle = uint8arrays.fromString(handle);
    await this.helia.datastore.put(new Key(SHOVEL_ACCOUNT_HANDLE), encodeddHandle)

    const did = await this.DID()
    const fullname = `${handle}#${did}`

    let success = false
    const envelope = await this.envelop({fullname: fullname})
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

  async linkDevice(message) {
    let success = false
    let handle = await this.handle()
    console.log("message with pin and did", message)
    let agentDID = await message.did
    const envelope = await this.envelop({agentDID: agentDID})
    await this.axios_client.put(`accounts/${handle}/agents` , envelope).then(async (response) => {
      success = true
    }).catch(async (e) => {
      console.log(e);
      return e
    })

    return success 
  }

  async recover(kit) {
    var handle = kit.fullname.split('#')[0]

    await this.destroy()

    let encodeddHandle = uint8arrays.fromString(handle);
    await this.helia.datastore.put(new Key(SHOVEL_ACCOUNT_HANDLE), encodeddHandle)

    const did = await this.DID()
    const fullname = `${handle}#${did}`

    let success = false
    const envelope = await this.envelop({fullname: fullname, recoveryKit: { generatingAgent: kit.fullname, signature: kit.signature }})
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
    await localforage.removeItem(SHOVEL_AGENT_WRITE_KEYPAIR)
  }

  async activeSession() {
    let keypair = await localforage.getItem(SHOVEL_AGENT_WRITE_KEYPAIR)
    return (keypair != null)
  }

  async recoveryKitData(){
    const handle = await this.handle()
    const did = await this.DID()
    const fullname = `${handle}#${did}`

    let ak = await this.helia.datastore.get(new Key(SHOVEL_FS_ACCESS_KEY))
    const encodedAccessKey = uint8arrays.toString(ak, 'base64pad');

    const envolope = await this.envelop({fullname: fullname})
    return {fullname: fullname, accountKey: encodedAccessKey, signature: envolope.signature}
  }

  async handle() {
    let handle = await this.helia.datastore.get(new Key(SHOVEL_ACCOUNT_HANDLE))
    return uint8arrays.toString(handle)
  }
}