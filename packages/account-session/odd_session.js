import * as odd from "@oddjs/odd";
import { retrieve } from '@oddjs/odd/common/root-key';
import { sha256 } from '@oddjs/odd/components/crypto/implementation/browser'
import * as uint8arrays from 'uint8arrays';
import { publicKeyToDid } from '@oddjs/odd/did/transformers';
import { Key } from 'interface-datastore';

const USERNAME_STORAGE_KEY = "fullUsername"
const SHOVEL_FS_ACCESS_KEY = "SHOVEL_FS_ACCESS_KEY"

export class AccountSession {
  constructor(os, helia) {
    this.os = os
    this.helia = helia
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

  async getOddAccessKey(){
    let program = await this.getProgram()
    var fissionusername = await this.fissionUsernames(undefined); // hacking - as logged in user will not need username
    var accountDID = await program.accountDID(fissionusername.hashed);
    var crypto = program.components.crypto;
    var oddAccessKey  = await retrieve({ crypto, accountDID });
    var encodedOddKey = uint8arrays.toString(oddAccessKey, 'base64pad')
    return encodedOddKey
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

  async createNewFissionAccountOnRecover(handle, oldfissionname, oddKey){
    var program = await this.getProgram();
    await program.components.storage.removeItem(USERNAME_STORAGE_KEY)
    var oldHashedUsername = await this.prepareUsername(oldfissionname)
    
    var fissionnames = await this.fissionUsernames(handle)
    var newhashedUsername = fissionnames.hashed;
    
    const valid = await program.auth.isUsernameValid(`${newhashedUsername}`)
    const available = await program.auth.isUsernameAvailable(`${newhashedUsername}`)
    console.log("username available", available)
    console.log("username valid", valid)
    
    if (valid && available) {
      console.log("oddKey", oddKey, newhashedUsername, oldHashedUsername)
      const success = await program.fileSystem.recover({
        newUsername: newhashedUsername,
        oldUsername: oldHashedUsername,
        readKey: oddKey
      })
      
      console.log("success: ", success);
      var session = await program.auth.session()
      await this.waitForDataRoot(newhashedUsername)
      console.log("session: ", session)
    }
  }

  async waitForDataRoot(username) {
    const program = await this.getProgram()
    const reference = program?.components.reference
    const EMPTY_CID = "Qmc5m94Gu7z62RC8waSKkZUrCCBJPyHbkpmGzEePxy2oXJ"
  
    if (!reference)
      throw new Error("Program must be initialized to check for data root")
  
    let dataRoot = await reference.dataRoot.lookup(username)
  
    if (dataRoot.toString() !== EMPTY_CID) return
  
    return new Promise((resolve) => {
      const maxRetries = 50
      let attempt = 0
  
      const dataRootInterval = setInterval(async () => {
        dataRoot = await reference.dataRoot.lookup(username)
  
        if (dataRoot.toString() === EMPTY_CID && attempt < maxRetries) {
          attempt++
          return
        }
  
        clearInterval(dataRootInterval)
        resolve()
      }, 500)
    })
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

export const os = new OddSession(odd);