import * as uint8arrays from 'uint8arrays';
import axios from 'axios'
import { RSASigner } from 'iso-signatures/signers/rsa.js'
import localforage from "localforage";
import { Approver } from './linking/approver.js';
import { Requester } from './linking/requester.js';
import { multiaddr } from '@multiformats/multiaddr'
import { CID } from 'multiformats/cid'

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

export const MessageCapability = {
  async actAsApprover() {
    const channelName = await this.handle()

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
  },

  async actAsRequester(address, channelName) {
    const channel = new Channel(this.helia, channelName)
    let agent = this
    this.requester = new Requester(this, channel, async (message) => { return await agent.createSessionOnDeviceLink(channelName, message)})

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
}

export const AccountCapability = {
  async registerUser(handle) {
    await this.runtime.setItem(SHOVEL_ACCOUNT_HANDLE, handle)

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
  },

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
  },

  async recover(kit) {
    var handle = kit.fullname.split('#')[0]

    await this.destroy()

    await this.runtime.setItem(SHOVEL_ACCOUNT_HANDLE, handle)
    await this.runtime.setItem(SHOVEL_FS_ACCESS_KEY, uint8arrays.fromString(kit.accountKey, 'base64pad'))

    const did = await this.DID()
    const fullname = `${handle}#${did}`

    let success = false
    const envelope = await this.envelop({fullname: fullname, recoveryKit: { generatingAgent: kit.fullname, signature: kit.signature }})
    await this.axios_client.put('/accounts', envelope).then(async (response) => {
      await this.runtime.setItem(SHOVEL_FS_FOREST_CID, CID.parse(response.data.cid).bytes)
      success = true
    }).catch(async (e) => {
      console.log(e);
      await this.destroy()
      return e
    })

    return success
  },

  async destroy() {
    await this.runtime.removeItem(SHOVEL_FS_ACCESS_KEY)
    await this.runtime.removeItem(SHOVEL_FS_FOREST_CID)
    await this.runtime.removeItem(SHOVEL_AGENT_WRITE_KEYPAIR)
    await this.runtime.removeItem(SHOVEL_ACCOUNT_HANDLE)
  },

  async activeSession() {
    let keypair = await this.runtime.getItem(SHOVEL_AGENT_WRITE_KEYPAIR)
    return (keypair != null)
  },

  async recoveryKitData(){
    const handle = await this.handle()
    const did = await this.DID()
    const fullname = `${handle}#${did}`

    let ak = await this.accessKey()

    const envolope = await this.envelop({fullname: fullname})
    return {fullname: fullname, accountKey: uint8arrays.toString(ak, 'base64pad'), signature: envolope.signature}
  },

  async createSessionOnDeviceLink(handle, message) {
    await this.runtime.setItem(SHOVEL_ACCOUNT_HANDLE, handle)
    await this.runtime.setItem(SHOVEL_FS_ACCESS_KEY, uint8arrays.fromString(message.accessKey, 'base64pad'))
    await this.runtime.setItem(SHOVEL_FS_FOREST_CID, uint8arrays.fromString(message.forestCID, 'base64pad'))
  }
}

export const StorageCapability = {
  async pin(accessKey, forestCID) {
    await this.runtime.setItem(SHOVEL_FS_ACCESS_KEY, accessKey)
    await this.runtime.setItem(SHOVEL_FS_FOREST_CID, forestCID)

    let cid = CID.decode(forestCID).toString()
    let handle = await this.handle()

    const envelope = await this.envelop({cid: cid, handle: handle})
    await this.axios_client.post('/pin', envelope).then(async (response) => {
      console.log(response.status)
    }).catch((e) => {
      console.log(e);
      return e
    })
  },

  async accessKey() {
    return await this.runtime.getItem(SHOVEL_FS_ACCESS_KEY)
  },

  async forestCID() {
    return await this.runtime.getItem(SHOVEL_FS_FOREST_CID)
  }
}

export class Agent {
  constructor(helia, accountHost, runtime_type) {
    this.helia = helia
    this.axios_client  = axios.create({baseURL: accountHost})
    this.runtime = new Runtime(runtime_type)
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

  async signer(){
    let keypair = await this.runtime.getItem(SHOVEL_AGENT_WRITE_KEYPAIR)
    if (keypair) {
      return RSASigner.import(keypair)
    }

    const signer = await RSASigner.generate()
    await this.runtime.setItem(SHOVEL_AGENT_WRITE_KEYPAIR, signer.export())
    
    return signer
  }

  async handle() {
    return await this.runtime.getItem(SHOVEL_ACCOUNT_HANDLE)
  }
}


/*
Agent
  Capabilities - 
    Account - Register, LinkDevice, Recover
    Storage - Pin, Data on WNFS and/or Device
    Message - actAs*
  Runtime -
    Browser -
      Capabilties - All 3
      Device storage is IndexDB
    Server -
      Capabilities - Message for Handshakes, potenitally Storage. Never Account
      Device storage is static configs on local
*/

export const BROWSER_RUNTIME=1
export const SERVER_RUNTIME=2
// localforage vs config json, Unknown device-linking/Agent add - assuming config file as given

class Runtime {
  constructor(type) {
    this.type = type
  }

  async getItem(key) {
    switch(this.type){
      case BROWSER_RUNTIME:
        return await localforage.getItem(key)
      case SERVER_RUNTIME:
        throw "NotImplementedInRuntime"
      default:
        throw "InvalidRuntime"
    }
  }
 
  async setItem(key, value) {
    switch(this.type){
      case BROWSER_RUNTIME:
        return await localforage.setItem(key, value)
      case SERVER_RUNTIME:
        throw "NotImplementedInRuntime"
      default:
        throw "InvalidRuntime"
    }
  }

  async removeItem(key) {
    switch(this.type){
      case BROWSER_RUNTIME:
        return await localforage.removeItem(key)
      case SERVER_RUNTIME:
        throw "NotImplementedInRuntime"
      default:
        throw "InvalidRuntime"
    }
  }
}