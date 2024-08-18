import * as uint8arrays from 'uint8arrays';
import axios from 'axios'
import { Broker } from './handshakes/base/broker.js';
import { Approver } from './handshakes/base/approver.js';
import { Requester } from './handshakes/base/requester.js';
import { CID } from 'multiformats/cid'
import { dial } from './helia_node.js'
import { PrivateFS, PrivateFile } from "./fs/private_fs.js"
import { HubConnection } from './hub_connection.js';
import { SERVER_RUNTIME } from './runtime.js';

const SHOVEL_FS_ACCESS_KEY = "SHOVEL_FS_ACCESS_KEY"
const SHOVEL_ACCOUNT_HANDLE = "SHOVEL_ACCOUNT_HANDLE"
const SHOVEL_ACCOUNT_DID = "SHOVEL_ACCOUNT_DID"
const SHOVEL_FS_FOREST_CID = "SHOVEL_FS_FOREST_CID"
const SHOVEL_AGENT_WRITE_KEYPAIR = "SHOVEL_AGENT_WRITE_KEYPAIR"

export const MessageCapability = {
  async setInbox(address){
    let accountDID = await this.accountDID()

    const envelope = await this.envelop({inbox: address})
    await this.axios_client.post(`/v1/accounts/${accountDID}/inbox`, envelope).then(async (response) => {
      console.log("setting inbox:", accountDID, address, response.status)
    }).catch((e) => {
      console.log(e);
      return e
    })
  },

  async getInbox(accountDID){
    let inbox = ""

    await this.axios_client.get(`/v1/accounts/${accountDID}/inbox`).then(async (response) => {
      inbox = response.data.inbox
    }).catch((e) => {
      console.log(e);
      return e
    })

    return inbox
  },

  async establishConnection(accountDID) {
    let address = await this.getInbox(accountDID)
   
    try {
      await dial(this.helia, address)
      return true
    } catch (e) {
      console.log("Connection Failed while dialing:", address, e)
      alert('Connection with Hub Failed. Please Relaod the Page.')
    }

    return false
  }
}

export const AccountCapability = {
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

  async destroy() {
    await this.runtime.removeItem(SHOVEL_FS_ACCESS_KEY)
    await this.runtime.removeItem(SHOVEL_FS_FOREST_CID)
    await this.runtime.removeItem(SHOVEL_AGENT_WRITE_KEYPAIR)
    await this.runtime.removeItem(SHOVEL_ACCOUNT_HANDLE)
    await this.runtime.removeItem(SHOVEL_ACCOUNT_DID)
  },

  async activeSession() {
    // TODO when agent has storage capability check for access key
    let accessKey = await this.runtime.getItem(SHOVEL_FS_ACCESS_KEY)
    return (accessKey != null)
  }
}

export const StorageCapability = {
  async registerAgent(accountDID, siweMessage, siweSignature) {
    await this.runtime.setItem(SHOVEL_ACCOUNT_DID, accountDID)

    let success = false 
    const envelope = await this.envelop({accountDID: accountDID, siweMessage: siweMessage, siweSignature: siweSignature})
    await this.axios_client.post(`/v1/accounts/${accountDID}/agents`, envelope).then(async (response) => {
      console.log("agent registration status", response.status, response.data)
      const accessKey = uint8arrays.fromString(response.data.accessKey, 'base64url');
      await this.runtime.setItem(SHOVEL_FS_ACCESS_KEY, accessKey)

      const forestCID = CID.parse(response.data.forestCID).bytes
      await this.runtime.setItem(SHOVEL_FS_FOREST_CID, forestCID)
      success = true
    }).catch(async (e) => {
      console.log(e);
      if (this.runtime.type != SERVER_RUNTIME) {
        await this.runtime.removeItem(SHOVEL_FS_ACCESS_KEY)
        await this.runtime.removeItem(SHOVEL_FS_FOREST_CID)
      }
      return e
    })

    return success
  },

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
      await this.pullAndMergeOnLocal(accountDID, await this.forestCID())
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

  async readSharedFile(accountDID, accessKey, akEncoding='base64url') {
    let content = {}

    await this.axios_client.get(`/v1/accounts/${accountDID}/head`).then(async (response) => {
      content = await this.readPrivateFileByPointer(response.data.head, accessKey, akEncoding)
    }).catch((e) => {
      console.log(e);
      return e
    })
    return content
  },

  async readPrivateFileByPointer(forestCIDString, accessKey, akEncoding='base64'){
    var startTime = performance.now()
    const forestCID = CID.parse(forestCIDString).bytes
    let privateFile = new PrivateFile(this.helia)
    let content = await privateFile.read(uint8arrays.fromString(accessKey, akEncoding), forestCID)      
    var endTime = performance.now()  
    console.log(`Call to readPrivateFileByPointer took ${endTime - startTime} milliseconds`)
    return JSON.parse(content);
  },

  async getAccessKeyForPrivateFile(filename) {
    return await this.fs.accessKeyForPrivateFile(filename)
  },

  async updatePrivateFile(filename, mutationFunction) {
    let content = await this.readPrivateFile(filename)
    let newContent = mutationFunction(content)
    var [accessKey, forestCID] = await this.fs.write(filename, JSON.stringify(newContent))

    await this.pin(forestCID)
    console.log("pinning content")
    return newContent
  },

  async syncCarFileWithHub(cid, carBuffer) {
    let accountDID = await this.accountDID()
    const envelope = await this.envelop({cid: cid, carBuffer: carBuffer})
    await this.axios_client.post(`/v1/accounts/${accountDID}/sync-car-file`, envelope).then(async (response) => {
      console.log(response.status)
    }).catch((e) => {
      console.log(e);
      return e
    })
  },

  async pin(cid) {
    let accountDID = await this.accountDID()
    
    //Pulls remoteCID, Merge locally, see the final file, then push
    const mergedCID = await this.pullAndMergeOnLocal(accountDID, cid)
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

  async head() {
    return CID.decode(await this.forestCID()).toString()
  },

  async syncStatus(){
    let accountDID = await this.accountDID()
    let localCID = await this.forestCID()
    let status = false

    await this.axios_client.get(`/v1/accounts/${accountDID}/head`).then(async (response) => {
      const headCID = CID.parse(response.data.head).bytes
      status = uint8arrays.compare(localCID,headCID) == 0
    }).catch((e) => {
      console.log(e);
      return e
    })

    return status
  },

  async push(){
    let localCID = await this.forestCID()
    let status = await this.syncStatus()

    if (status == false) {
      this.pin(localCID)
    }
  },

  async pullAndMergeOnLocal(accountDID, cid) {
    let mergedCID
    
    await this.axios_client.get(`/v1/accounts/${accountDID}/head`).then(async (response) => {
      const headCID = CID.parse(response.data.head).bytes
      
      const diff = await this.fs.compareWithRemote(headCID)
      mergedCID = await this.fs.mergeWithRemote(headCID)
     
      await this.runtime.setItem(SHOVEL_FS_FOREST_CID, mergedCID)
      console.log("diff :", diff, "merge :", mergedCID)
    }).catch((e) => {
      //if hub is down or missing then assume local as mergedCID 
      if (!(e.response) || (e.response && e.response.status == '404')) {
        this.runtime.setItem(SHOVEL_FS_FOREST_CID, cid)
        mergedCID = cid
      }
      return e
    })
    
    return mergedCID
  },
}

export class Agent {
  constructor(helia, accountHost, dialPrefix, runtime) {
    this.helia = helia
    this.axios_client  = axios.create({baseURL: accountHost})
    this.runtime = runtime
    this.fs = new PrivateFS(helia)
    this.hubConnection = new HubConnection(this.helia, this.axios_client, dialPrefix)
    this.approver = new Approver(this)
    this.broker = new Broker(this)
    this.requester = new Requester(this)
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

  // TODO - remove - members repo is using it.
  async handle() {
    return await this.runtime.getItem(SHOVEL_ACCOUNT_HANDLE)
  }

  async accountDID() {
    return await this.runtime.getItem(SHOVEL_ACCOUNT_DID)
  }
  
  async bootstrap(){
    return await this.hubConnection.bootstrap()
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
