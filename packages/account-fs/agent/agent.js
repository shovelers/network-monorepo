import * as uint8arrays from 'uint8arrays';
import axios from 'axios'
import { RSASigner } from 'iso-signatures/signers/rsa.js'
import localforage from "localforage";
import { LinkingApprover, LinkingRequester } from './handshakes/link.js';
import { JoinApprover, JoinRequester } from './handshakes/join.js';
import { RelateApprover, RelateRequester } from './handshakes/relate.js';
import { Broker } from './handshakes/base/broker.js';
import { Channel } from './handshakes/base/channel.js';
import { multiaddr } from '@multiformats/multiaddr'
import { CID } from 'multiformats/cid'
import { DIDKey } from 'iso-did/key';
import { spki } from 'iso-signatures/spki'

const SHOVEL_FS_ACCESS_KEY = "SHOVEL_FS_ACCESS_KEY"
const SHOVEL_ACCOUNT_HANDLE = "SHOVEL_ACCOUNT_HANDLE"
const SHOVEL_FS_FOREST_CID = "SHOVEL_FS_FOREST_CID"
const SHOVEL_AGENT_WRITE_KEYPAIR = "SHOVEL_AGENT_WRITE_KEYPAIR"

export const MessageCapability = {
  async actAsApprover(channelName) {
    let agent = this
    const channel = new Channel(this.helia, channelName)
    this.approver = new LinkingApprover(this, channel, async (message) => { return await agent.linkDevice(message) })

    await channel.subscribe(this.approver)
  },

  async actAsJoinApprover(channelName) {
    let agent = this
    const channel = new Channel(this.helia, channelName)
    this.approver = new JoinApprover(this, channel, async (message) => { })

    await channel.subscribe(this.approver)
  },

  async actAsJoinRequester(address, channelName) {
    let agent = this
    const channel = new Channel(this.helia, channelName)
    this.requester = new JoinRequester(this, channel, async (message) => { })

    await this.helia.libp2p.dial(multiaddr(address));
    await channel.subscribe(this.requester)
    return this.requester
  },

  async actAsRelationshipApprover(address, channelName) {
    let agent = this
    const channel = new Channel(this.helia, channelName)
    this.approver = new RelateApprover(this, channel, async (message) => { })

    await this.helia.libp2p.dial(multiaddr(address));
    await channel.subscribe(this.approver)
  },

  async actAsRelationshipRequester(address, channelName, forwardingChannel) {
    let agent = this
    const channel = new Channel(this.helia, channelName, forwardingChannel)
    this.requester = new RelateRequester(this, channel, async (message) => { })

    console.log("dialing", address, channelName)
    await this.helia.libp2p.dial(multiaddr(address));
    await channel.subscribe(this.requester)
    const timeout = setTimeout(() => {
      clearTimeout(timeout)
      this.requester.initiate()
    }, 500)
  },

  async actAsRelationshipBroker() {
    const forwardingChannel = `${await this.handle()}-forwarding`

    const channel = new Channel(this.helia, forwardingChannel)
    this.broker = new Broker(this, channel)

    await channel.subscribe(this.broker)
  },

  async actAsRequester(address, channelName) {
    let agent = this
    const channel = new Channel(this.helia, channelName)
    this.requester = new LinkingRequester(this, channel, async (message) => { return await agent.createSessionOnDeviceLink(message.data)})

    await this.helia.libp2p.dial(multiaddr(address));
    await channel.subscribe(this.requester)
    const timeout = setTimeout(() => {
      clearTimeout(timeout)
      this.requester.initiate()
    }, 500)
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

  async createSessionOnDeviceLink(message) {
    await this.runtime.setItem(SHOVEL_ACCOUNT_HANDLE, message.handle)
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
  constructor(helia, accountHost, runtime) {
    this.helia = helia
    this.axios_client  = axios.create({baseURL: accountHost})
    this.runtime = runtime
  }

  async DID(){
    const signer = await this.runtime.signer()
    return signer.did
  }

  async sign(message){
    const signer = await this.runtime.signer()
    return signer.sign(message)
  }

  async envelop(message){
    message.signer = await this.DID()
    let encodedMessage = uint8arrays.fromString(JSON.stringify(message)) 
    let signature = await this.sign(encodedMessage)
    let encodedSignature = uint8arrays.toString(signature, 'base64')
    return { message: message, signature: encodedSignature }
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

export class Runtime {
  constructor(type, config) {
    this.type = type
    this.config = config
  }

  // Read config from file
  // SERVER_RUNTIME - Keypair importJWK and fail on missing
  async signer(){
    switch(this.type){
      case BROWSER_RUNTIME: 
        let keypair = await this.getItem(SHOVEL_AGENT_WRITE_KEYPAIR)
        if (keypair) {
          return RSASigner.import(keypair)
        }

        const signer = await RSASigner.generate()
        await this.setItem(SHOVEL_AGENT_WRITE_KEYPAIR, signer.export())
        
        return signer
      case SERVER_RUNTIME:
        const jwk = await this.getItem(SHOVEL_AGENT_WRITE_KEYPAIR)
        if (!jwk) {
          throw "MissingAgentKeyPair"
        }
        const publicKeyJWK = await crypto.subtle.importKey(
          'jwk',
          { ...jwk, d: undefined },
          {
            name: 'RSASSA-PKCS1-v1_5',
            hash: 'SHA-256',
          },
          true,
          ['verify']
        )
    
        const publicKey = await crypto.subtle.exportKey('spki', publicKeyJWK)
        const decodedPublicKey = spki.decode(new Uint8Array(publicKey))

        const did = DIDKey.fromPublicKey('RSA', decodedPublicKey)

        return await RSASigner.importJwk(jwk, did)
      default:
        throw "InvalidRuntime"
    }
  }

  async getItem(key) {
    switch(this.type){
      case BROWSER_RUNTIME:
        return await localforage.getItem(key)
      case SERVER_RUNTIME:
        return this.config[key]
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