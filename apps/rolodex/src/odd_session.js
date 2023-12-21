import * as odd from "@oddjs/odd";
import { sha256 } from '@oddjs/odd/components/crypto/implementation/browser'
import * as uint8arrays from 'uint8arrays';
import { publicKeyToDid } from '@oddjs/odd/did/transformers';
import { createBrowserNode, dial, PrivateFS } from 'shovel-fs'
import axios from 'axios';
import { CID } from 'multiformats/cid'

const USERNAME_STORAGE_KEY = "fullUsername"
const SHOVEL_FS_ACCESS_KEY = "SHOVEL_FS_ACCESS_KEY"
const SHOVEL_FS_FOREST_CID = "SHOVEL_FS_FOREST_CID"
const FS = import.meta.env.VITE_FS || "ODD" // "SHOVEL"
const SHOVEL_FS_SYNC_HOST = import.meta.env.VITE_SHOVEL_FS_SYNC_HOST

class OddFS {
  constructor(odd, session) {
    this.odd = odd
    this.fs = session.fs
  }
 
  async readPrivateFile(filename) {
    const { RootBranch } = this.odd.path;
    const filePath = this.odd.path.file(RootBranch.Private, filename);
    const pathExists = await this.fs.exists(filePath);

    if (pathExists) {
      const content = new TextDecoder().decode(await this.fs.read(filePath));
      return JSON.parse(content);
    }
  }

  async updatePrivateFile(filename, mutationFunction) {
    const { RootBranch } = this.odd.path;
    const filePath = this.odd.path.file(RootBranch.Private, filename);

    const fileExists = await this.fs.exists(filePath)
    let newContent

    if(fileExists){
      const content = new TextDecoder().decode(await this.fs.read(filePath));
      console.log("content in file:", content);
      newContent = mutationFunction(JSON.parse(content));
    } else {
      newContent = mutationFunction();
    }

    await this.fs.write(
      filePath,
      new TextEncoder().encode(JSON.stringify(newContent))
    );
    await this.fs.publish();

    return newContent;
  }
}

class ShovelFS {
  constructor(helia, kvStore){
    this.helia = helia
    this.fs = new PrivateFS(helia)
    this.kvStore = kvStore
  }

  async load(){
    let access_key = await this.kvStore.getItem(SHOVEL_FS_ACCESS_KEY)
    let forest_cid = await this.kvStore.getItem(SHOVEL_FS_FOREST_CID)

    if (access_key && forest_cid){
      await this.fs.loadForest(access_key, forest_cid)
    }

    await this.startSync()
  }

  async recover(access_key, forest_cid) {
    await this.kvStore.setItem(SHOVEL_FS_ACCESS_KEY, access_key)
    await this.kvStore.setItem(SHOVEL_FS_FOREST_CID, forest_cid)
    await this.load()
  }

  async getForestCidForHandle(handle){
    let forest_cid;
    if (SHOVEL_FS_SYNC_HOST) {
      const axios_client  = axios.create({baseURL: SHOVEL_FS_SYNC_HOST})
      await axios_client.get('/forestCID/'+ handle).then(async (response) => {
        forest_cid = response.data.cid
      }).catch((e) => {
        console.log(e);
        return e
      })
    }
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
    if (SHOVEL_FS_SYNC_HOST) {
      let cid = CID.decode(forest_cid).toString()
      let handle = (await this.kvStore.getItem(USERNAME_STORAGE_KEY)).split('#')[0] 
      const axios_client  = axios.create({baseURL: SHOVEL_FS_SYNC_HOST})
      await axios_client.post('/pin', { cid: cid, handle: handle }).then(async (response) => {
        console.log(response.status)
      }).catch((e) => {
        console.log(e);
        return e
      })
    }
  }

  async startSync(){
    if (SHOVEL_FS_SYNC_HOST) {
      const axios_client  = axios.create({baseURL: SHOVEL_FS_SYNC_HOST})
      await axios_client.get('/bootstrap').then(async (response) => {
        await dial(this.helia, response.data.peerAddress)
      }).catch((e) => {
        console.log(e);
        return e
      })
    }
  }
}

class OddSession {
  constructor(odd) {
    this.odd = odd;
    this.program = null;
  }

  async getProgram() {
    if (!this.program) {
      const appInfo = { creator: "Shovel", name: "Rolod" };
      this.program = await this.odd
        .program({ namespace: appInfo, debug: true })
        .catch((error) => {
          switch (error) {
            case this.odd.ProgramError.InsecureContext:
              // ODD requires HTTPS
              break;
            case this.odd.ProgramError.UnsupportedBrowser:
              // Browsers must support IndexedDB
              break;
          }
        });
    }
    console.log("program: ", this.program);
    return this.program;
  }

  async getSession() {
    var p = await this.getProgram();
    if (p.session) {
      return p.session;
    }
    return;
  }

  async getFS() {
    if (FS == "SHOVEL") {
      return shovelfs
    } else {
      let session = await this.getSession()
      let fs = new OddFS(this.odd, session) 
      return fs
    }
  }

  async recoveryKitData(){
    let program = await this.getProgram()
    let ak = await program.components.storage.getItem(SHOVEL_FS_ACCESS_KEY)
    let handle = (await program.components.storage.getItem(USERNAME_STORAGE_KEY)).split('#')[0]
    return {accessKey: ak, handle: handle}
  }

  async recover(access_key, handle) {
    await program.components.storage.setItem(SHOVEL_FS_ACCESS_KEY, access_key)

    let forest_cid = await shovelfs.getForestCidForHandle(handle)
    forest_cid = CID.parse(forest_cid).bytes
    await program.components.storage.setItem(SHOVEL_FS_FOREST_CID, forest_cid)
    await shovelfs.load()
  }

  async readPrivateFile(filename) {
    let fs = await this.getFS()
    return fs.readPrivateFile(filename)
  }

  async updatePrivateFile(filename, mutationFunction) {
    let fs = await this.getFS()
    return fs.updatePrivateFile(filename, mutationFunction)
  }

  async createFissionUser(handle) {
    this.program = await this.getProgram()
    var fissionusername = await this.fissionUsernames(handle);
    var hashedUsername = fissionusername.hashed;

    const valid = await this.program.auth.isUsernameValid(hashedUsername);
    const available = await this.program.auth.isUsernameAvailable(hashedUsername);
    console.log("username valid", valid);
    console.log("username available", available);

    if (valid && available) {
      // Register the user
      const { success } = await this.program.auth.register({
        username: hashedUsername,
      });
      console.log("success: ", success);
      // Create a session on success
      let session = success ? await this.program.auth.session() : null;
      this.program.session = session
      return session
    } else if (!valid) {
      alert("username is not valid");
    } else if (!available) {
      alert("username is not available");
    }
  }

  async fissionUsernames(username) {
    let program = await this.getProgram()
    console.log(program)
    let fullUsername = await program.components.storage.getItem(USERNAME_STORAGE_KEY)
    if (!fullUsername) {
      const did = await this.createDID(program.components.crypto)
      fullUsername = `${username}#${did}`
      await program.components.storage.setItem(USERNAME_STORAGE_KEY, fullUsername)
    }
  
    var hashedUsername = await this.prepareUsername(fullUsername);
    return {full: fullUsername, hashed: hashedUsername} 
  }

  async createDID(crypto){
    if (await this.program.agentDID()){
      return this.program.agentDID()
    } else {
      const pubKey = await crypto.keystore.publicExchangeKey()
      const ksAlg = await crypto.keystore.getAlgorithm()
  
      return publicKeyToDid(crypto, pubKey, ksAlg)
    }
  }
  
  async prepareUsername(username){
    const normalizedUsername = username.normalize('NFD')
    const hashedUsername = await sha256(
      new TextEncoder().encode(normalizedUsername)
    )
  
    return uint8arrays
      .toString(hashedUsername, 'base32')
      .slice(0, 32)
  }
}

const helia = await createBrowserNode()
export const os = new OddSession(odd);

let program = await os.getProgram()
const shovelfs = new ShovelFS(helia, program.components.storage)
await shovelfs.load()