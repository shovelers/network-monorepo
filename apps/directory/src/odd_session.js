import * as odd from "@oddjs/odd";
import { sha256 } from '@oddjs/odd/components/crypto/implementation/browser'
import * as uint8arrays from 'uint8arrays';
import { publicKeyToDid } from '@oddjs/odd/did/transformers';
import { createBrowserNode, AccountFS } from 'account-fs'
import { CID } from 'multiformats/cid'

const USERNAME_STORAGE_KEY = "fullUsername"
const SHOVEL_FS_ACCESS_KEY = "SHOVEL_FS_ACCESS_KEY"
const SHOVEL_FS_FOREST_CID = "SHOVEL_FS_FOREST_CID"
const SHOVEL_FS_SYNC_HOST = import.meta.env.VITE_SHOVEL_FS_SYNC_HOST || "http://localhost:3000"
const NETWORK = import.meta.env.VITE_NETWORK || "DEVNET"

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

  async recoveryKitData(){
    let program = await this.getProgram()
    let ak = await program.components.storage.getItem(SHOVEL_FS_ACCESS_KEY)
    let fu = await program.components.storage.getItem(USERNAME_STORAGE_KEY) 
    return {accessKey: ak, handle: fu.split('#')[0], fissionusername: fu}
  }

  async recover(access_key, handle) {
    await program.components.storage.setItem(SHOVEL_FS_ACCESS_KEY, access_key)

    let forest_cid = await accountfs.getForestCidForHandle(handle)
    forest_cid = CID.parse(forest_cid).bytes
    await program.components.storage.setItem(SHOVEL_FS_FOREST_CID, forest_cid)
    await accountfs.load()
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
export const accountfs = new AccountFS(helia, program.components.storage, NETWORK, SHOVEL_FS_SYNC_HOST)
await accountfs.load()

window.shovel = {
  helia: helia,
  fs: accountfs,
  odd: program
}