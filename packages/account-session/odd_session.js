import * as odd from "@oddjs/odd";
import { retrieve } from '@oddjs/odd/common/root-key';
import { sha256 } from '@oddjs/odd/components/crypto/implementation/browser'
import * as uint8arrays from 'uint8arrays';
import { publicKeyToDid } from '@oddjs/odd/did/transformers';
import { Key } from 'interface-datastore';

const USERNAME_STORAGE_KEY = "fullUsername"
const SHOVEL_FS_ACCESS_KEY = "SHOVEL_FS_ACCESS_KEY"
const SHOVEL_ACCOUNT_HANDLE = "SHOVEL_ACCOUNT_HANDLE"
const SHOVEL_FS_FOREST_CID = "SHOVEL_FS_FOREST_CID"

export class AccountSession {
  constructor(os, helia) {
    this.os = os
    this.helia = helia
  }

  async registerUser(handle) {
    let encodeddHandle = uint8arrays.fromString(handle);
    await this.helia.datastore.put(new Key(SHOVEL_ACCOUNT_HANDLE), encodeddHandle)
  }

  async destroy() {
    await this.helia.datastore.delete(new Key(SHOVEL_FS_ACCESS_KEY))
    await this.helia.datastore.delete(new Key(SHOVEL_ACCOUNT_HANDLE))
    await this.helia.datastore.delete(new Key(SHOVEL_FS_FOREST_CID))
  }

  async recoveryKitData(){
    let program = await os.getProgram()
    let ak = await this.helia.datastore.get(new Key(SHOVEL_FS_ACCESS_KEY))
    let fu = await program.components.storage.getItem(USERNAME_STORAGE_KEY) 
    return {accessKey: ak, handle: fu.split('#')[0], fissionusername: fu}
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

  async createFissionUser(handle) {
    this.program = await this.getProgram()
    await this.program.components.storage.removeItem(USERNAME_STORAGE_KEY)

    var fissionusername = await this.fissionUsernames(handle);
    var hashedUsername = fissionusername.hashed;
    await this.program.components.storage.setItem(USERNAME_STORAGE_KEY, fissionusername.full)

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

    const did = await this.createDID(program.components.crypto)
    let fullUsername = `${username}#${did}`
  
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

export const os = new OddSession(odd);