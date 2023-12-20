import * as odd from "@oddjs/odd";
import { sha256 } from '@oddjs/odd/components/crypto/implementation/browser'
import * as uint8arrays from 'uint8arrays';
import { publicKeyToDid } from '@oddjs/odd/did/transformers';
import {fs} from 'shovel-fs'

const USERNAME_STORAGE_KEY = "fullUsername"
const FS = import.meta.env.VITE_FS || "ODD" // "SHOVEL"

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
      window.shovelFs = fs
      return p.session;
    }
    return;
  }

  async readPrivateFile(filename) {
    let session = await this.getSession()
    let fs = new OddFS(this.odd, session) 
    return fs.readPrivateFile(filename)
  }

  async updatePrivateFile(filename, mutationFunction) {
    let session = await this.getSession()
    let fs = new OddFS(this.odd, session) 
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

export const os = new OddSession(odd);