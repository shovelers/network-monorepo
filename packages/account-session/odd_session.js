import * as odd from "@oddjs/odd";
import { sha256 } from '@oddjs/odd/components/crypto/implementation/browser'
import * as uint8arrays from 'uint8arrays';
import { publicKeyToDid } from '@oddjs/odd/did/transformers';
import { Key } from 'interface-datastore';
import axios from 'axios'

const SHOVEL_FS_ACCESS_KEY = "SHOVEL_FS_ACCESS_KEY"
const SHOVEL_ACCOUNT_HANDLE = "SHOVEL_ACCOUNT_HANDLE"
const SHOVEL_FS_FOREST_CID = "SHOVEL_FS_FOREST_CID"

export class AccountSession {
  constructor(os, helia, accountHost) {
    this.os = os
    this.helia = helia
    this.axios_client  = axios.create({baseURL: accountHost})
  }

  async registerUser(handle) {
    let encodeddHandle = uint8arrays.fromString(handle);
    await this.helia.datastore.put(new Key(SHOVEL_ACCOUNT_HANDLE), encodeddHandle)

    const did = await this.agentDID()
    const fullname = `${handle}#${did}`

    await this.axios_client.post('/accounts', { fullname: fullname }).then(async (response) => {
      console.log("account creation status", response.status)
    }).catch((e) => {
      console.log(e);
      return e
    })

    return fullname
  }

  async destroy() {
    await this.helia.datastore.delete(new Key(SHOVEL_FS_ACCESS_KEY))
    await this.helia.datastore.delete(new Key(SHOVEL_ACCOUNT_HANDLE))
    await this.helia.datastore.delete(new Key(SHOVEL_FS_FOREST_CID))
  }

  async recoveryKitData(){
    let ak = await this.helia.datastore.get(new Key(SHOVEL_FS_ACCESS_KEY))
    let hd = await this.helia.datastore.get(new Key(SHOVEL_ACCOUNT_HANDLE))
    return {accessKey: ak, handle: uint8arrays.toString(hd)}
  }

  //Private methods
  async agentDID(){
    let program = await os.getProgram()

    const pubKey = await program.components.crypto.keystore.publicWriteKey() // publicExchageKey for other did
    const ksAlg = await program.components.crypto.keystore.getAlgorithm()

    return publicKeyToDid(program.components.crypto, pubKey, ksAlg) 
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

  async createFissionUser(fullname) {
    this.program = await this.getProgram()
    var hashedUsername = await this.prepareUsername(fullname);

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