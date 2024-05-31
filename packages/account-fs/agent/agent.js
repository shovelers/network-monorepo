import * as uint8arrays from 'uint8arrays';
import axios from 'axios'
import { RSASigner } from 'iso-signatures/signers/rsa.js'
import localforage from "localforage";
import { LinkingRequester } from './handshakes/link.js';
import { JoinRequester } from './handshakes/join.js';
import { RelateRequester } from './handshakes/relate.js';
import { Broker } from './handshakes/base/broker.js';
import { Approver } from './handshakes/base/approver.js';
import { Channel } from './handshakes/base/channel.js';
import { CID } from 'multiformats/cid'
import { DIDKey } from 'iso-did/key';
import { spki } from 'iso-signatures/spki'
import { dial } from './helia_node.js'
import { PrivateFS, PrivateFile } from "./fs/private_fs.js"

const SHOVEL_FS_ACCESS_KEY = "SHOVEL_FS_ACCESS_KEY"
const SHOVEL_ACCOUNT_HANDLE = "SHOVEL_ACCOUNT_HANDLE"
const SHOVEL_ACCOUNT_DID = "SHOVEL_ACCOUNT_DID"
const SHOVEL_FS_FOREST_CID = "SHOVEL_FS_FOREST_CID"
const SHOVEL_AGENT_WRITE_KEYPAIR = "SHOVEL_AGENT_WRITE_KEYPAIR"

export const MessageCapability = {
  async actAsApprover(approverHandle) {
    let agent = this
    let channelName = approverHandle 
    const channel = new Channel(this.helia, channelName)
    this.approver = new Approver(this, channel, async (message) => {  })
    this.approver.notification.addEventListener("CONFIRMED", async (message) => {
      return await agent.linkDevice(message.detail)
    })

    await channel.subscribe(this.approver)
  },

  async actAsRequester(address, approverHandle) {
    let agent = this
    let channelName = approverHandle
    const channel = new Channel(this.helia, channelName)
    this.requester = new LinkingRequester(this, channel)
    this.requester.notification.addEventListener("CONFIRMED", async (message) => {
      return await agent.createSessionOnDeviceLink(message.detail.data)
    })

    await dial(this.helia, address)
    await channel.subscribe(this.requester)
    const timeout = setTimeout(() => {
      clearTimeout(timeout)
      this.requester.initiate()
    }, 500)
  },

  async actAsJoinApprover(approverHandle) {
    const channelName = `${approverHandle}-membership`
    const channel = new Channel(this.helia, channelName)
    this.approver = new Approver(this, channel, async (message) => { })
    this.approver.notification.addEventListener("CONFIRMED", async (message) => {
      console.log(message.detail)
    })

    await channel.subscribe(this.approver)
    console.log("Subscribing to :", channelName)
  },

  async actAsJoinRequester(address, approverHandle) {
    const channelName = `${approverHandle}-membership`
    const channel = new Channel(this.helia, channelName)
    this.requester = new JoinRequester(this, channel)
    this.requester.notification.addEventListener("CONFIRMED", async (message) => {
      console.log(message.detail)
    })

    await dial(this.helia, address)
    await channel.subscribe(this.requester)
    console.log("Subscribing to :", channelName)
    return this.requester
  },

  async actAsRelationshipApprover(address, brokerHandle, approverHandle, person) {
    let channelName = `${brokerHandle}-${approverHandle}-relationship`
    const channel = new Channel(this.helia, channelName)
    this.approver = new Approver(this, channel, async (message) => { })
    this.approver.notification.addEventListener("CONFIRMED", async (message) => {
      console.log(message.detail)
    })

    await dial(this.helia, address)
    await channel.subscribe(this.approver)
  },

  async actAsRelationshipRequester(address, brokerHandle, approverHandle, person ) {
    let channelName = `${brokerHandle}-${approverHandle}-relationship`
    let forwardingChannel = `${brokerHandle}-forwarding`
    const channel = new Channel(this.helia, channelName, forwardingChannel)
    // TODO save contact that is received in message
    this.requester = new RelateRequester(this, channel)
    this.requester.challenge = function () { return { person: person } }

    await dial(this.helia, address)
    await channel.subscribe(this.requester)
    const timeout = setTimeout(() => {
      clearTimeout(timeout)
      this.requester.initiate()
    }, 500)
    return this.requester
  },

  async actAsRelationshipBroker() {
    const forwardingChannel = `${await this.handle()}-forwarding`

    const channel = new Channel(this.helia, forwardingChannel)
    this.broker = new Broker(this, channel)

    await channel.subscribe(this.broker)
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

  async register(accountDID, siweMessage, siweSignature) {
    await this.runtime.setItem(SHOVEL_ACCOUNT_DID, accountDID)

    let success = {status: false, created: true}
    const envelope = await this.envelop({accountDID: accountDID, siweMessage: siweMessage, siweSignature: siweSignature})
    await this.axios_client.post('/v1/accounts', envelope).then(async (response) => {
      console.log("account creation status", response.status)
      if (response.data.created == false) {
        const accessKey = uint8arrays.fromString(response.data.accessKey, 'base64url');
        await this.runtime.setItem(SHOVEL_FS_ACCESS_KEY, accessKey)

        const forestCID = CID.parse(response.data.forestCID).bytes
        await this.runtime.setItem(SHOVEL_FS_FOREST_CID, forestCID)
        success.created = false
      }
      success.status = true
    }).catch(async (e) => {
      console.log(e);
      await this.destroy()
      return e
    })

    return success
  },

  async appendName(id, provider) {
    let accountDID = await this.accountDID()

    let success = false
    const envelope = await this.envelop({id: id, provider: provider})
    await this.axios_client.put(`/v1/accounts/${accountDID}/names`, envelope).then(async (response) => {
      console.log("name submitted", response.status)
      success = true
    }).catch(async (e) => {
      console.log(e);
      return e
    })

    return success
  },

  async setCustodyKey(accessKey) {
    await this.runtime.setItem(SHOVEL_FS_ACCESS_KEY, accessKey)

    const encodedAccessKey = uint8arrays.toString(accessKey, 'base64url');
    let accountDID = await this.accountDID()

    const envelope = await this.envelop({accessKey: encodedAccessKey})
    await this.axios_client.put(`/v1/accounts/${accountDID}/custody`, envelope).then(async (response) => {
      console.log(response.status)
    }).catch((e) => {
      console.log(e);
      return e
    })
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
    await this.runtime.removeItem(SHOVEL_ACCOUNT_DID)
  },

  async activeSession() {
    // TODO when agent has storage capability check for access key
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
  async load(){
    try {
      let accessKey = await this.accessKey()
      let forestCID = await this.forestCID()

      if (accessKey && forestCID){
        await this.fs.loadForest(accessKey, forestCID)
      }
    } catch (err) {
      console.log("load failed: ", err.name, err.message)
      return 
    }

    let accountDID = await this.accountDID()
    if (accountDID) { 
      await this.syncWithHub(accountDID, await this.forestCID())
    }
  },

  async fileExists(filename) {
    try {
      let content = await this.fs.read(filename)
      JSON.parse(content)
      return true
    } catch (error) {
      console.log("missing file: ", filename, error.name)
      return false
    }
  },

  async readPrivateFile(filename) {
    try {
      let content = await this.fs.read(filename)
      return JSON.parse(content)
    } catch (error) {
      console.log("missing file: ", filename)
    }
  },

  async readPrivateFileByPointer(accessKey, forestCID){
    //fetches the CID from the network if not available locally
      //Primarily used for fetching data shared by other users to the client
    let privateFile = new PrivateFile(this.helia)
    let content = await privateFile.read(uint8arrays.fromString(accessKey, 'base64'), forestCID)
    console.log("content fetched", forestCID)
    return content
  },

  async getAccessKeyForPrivateFile(filename) {
    return await this.fs.accessKeyForPrivateFile(filename)
  },

  async updatePrivateFile(filename, mutationFunction) {
    let content = await this.readPrivateFile(filename)
    let newContent = mutationFunction(content)
    var [accessKey, forestCID] = await this.fs.write(filename, JSON.stringify(newContent))

    await this.pin(forestCID)
    return newContent
  },

  async pin(cid) {
    let accountDID = await this.accountDID()
    
    //Pulls remoteCID, Merge locally, see the final file, then push
    const mergedCID = await this.syncWithHub(accountDID, cid)
    console.log("merged CID on first try :", mergedCID, cid)
    const envelope = await this.envelop({cid: CID.decode(mergedCID).toString()})
    
    await this.axios_client.post(`/v1/accounts/${accountDID}/head`, envelope).then(async (response) => {
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
  },

  async syncWithHub(accountDID, cid) {
    let mergedCID
    
    await this.axios_client.get(`/v1/accounts/${accountDID}/head`).then(async (response) => {
      const headCID = CID.parse(response.data.head).bytes
      
      const diff = await this.fs.compareWithRemote(headCID)
      mergedCID = await this.fs.mergeWithRemote(headCID)
     
      await this.runtime.setItem(SHOVEL_FS_FOREST_CID, mergedCID)
      console.log("diff :", diff, "merge :", mergedCID)
    }).catch((e) => {
      if (e.response.status == '404') {
        this.runtime.setItem(SHOVEL_FS_FOREST_CID, cid)
        mergedCID = cid
      }
      return e
    })
    
    return mergedCID
  }, 
}

export class Agent {
  constructor(helia, accountHost, dialPrefix, runtime, appHandle) {
    this.helia = helia
    this.axios_client  = axios.create({baseURL: accountHost})
    this.runtime = runtime
    this.prefix = dialPrefix
    this.syncServer = null
    this.fs = new PrivateFS(helia, appHandle)
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

  async accountDID() {
    return await this.runtime.getItem(SHOVEL_ACCOUNT_DID)
  }
  
  async bootstrap(){
    await this.axios_client.get('/bootstrap').then(async (response) => {
      this.syncServer = this.prefix + response.data.peerId
      await dial(this.helia, this.syncServer)
    }).catch((e) => {
      console.log(e);
      return e
    })
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
        throw "InvalidRuntime from signer"
    }
  }

  async getItem(key) {
    switch(this.type){
      case BROWSER_RUNTIME:
        return await localforage.getItem(key)
      case SERVER_RUNTIME:
        if (key == "SHOVEL_FS_ACCESS_KEY") {
          // convert string to Uint8array
          return uint8arrays.fromString(this.config[key], 'base64url')
        } else if (key == "SHOVEL_FS_FOREST_CID") {
          //convert string to Uinst8array
          return CID.parse(this.config[key]).bytes
        }
        else {
          return this.config[key]
        }
      default:
        throw "InvalidRuntime from getItem"
    }
  }
 
  async setItem(key, value) {
    switch(this.type){
      case BROWSER_RUNTIME:
        return await localforage.setItem(key, value)
      case SERVER_RUNTIME:
        //convert uint8arrays to string before save to file
        //TODO: Make the config persist on the config file 
        if (key == "SHOVEL_FS_ACCESS_KEY") {
          var valueString = uint8arrays.toString(value, 'base64url')
          return this.config[key] = valueString
        } else if (key == "SHOVEL_FS_FOREST_CID") {
          var valueString = CID.decode(value).toString()
          return this.config[key] = valueString
        }
        else {
          return this.config[key] = value
        }
      default:
        throw "InvalidRuntime from setItem"
    }
  }

  async removeItem(key) {
    switch(this.type){
      case BROWSER_RUNTIME:
        return await localforage.removeItem(key)
      case SERVER_RUNTIME:
        throw "NotImplementedInRuntime"
      default:
        throw "InvalidRuntime for removeItem"
    }
  }
}