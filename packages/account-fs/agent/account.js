import * as uint8arrays from 'uint8arrays';
import { ProfileRepository } from '../repository/profile/profile';

class Profile {
  constructor(args) {
    let defaults = { name: "John Doe", tags: [], text: '', appleCreds: {username: '', password: ''} }
    let params = {...defaults, ...args}

    this.handle = params.handle
    this.name = params.name
    this.tags = params.tags
    this.text = params.text
    this.appleCreds = params.appleCreds
  }

  asJSON() {
    return {
      handle: this.handle,
      name: this.name,
      tags: this.tags,
      text: this.text,
      appleCreds: this.appleCreds
    }
  }
}

//TODO move profile file/object to Roloedx, and reduce to DCN account management
export class Account {
  constructor(agent) {
    this.agent = agent
    this.filename = "profile.json"
    this.profile = null
    this.profileRepo = new ProfileRepository(agent)
  }

  async getProfile(){
    return await this.profileRepo.get()
  }

  async editProfile(params){
    return await this.profileRepo.set(params)
  }

  // TODO - change signature - to take accountDID instead of handle
  async create(handle, initialFiles) {
    const success = await this.agent.registerUser(handle)

    if (success) {
      //TODO replace file initialisation with repo initialisation
      await this.agent.updatePrivateFile("profile.json", () => { return new Profile({handle: handle}).asJSON() })
      await initialFiles.forEach(async element => {
        await this.agent.updatePrivateFile(element.name, () => { return element.initialData })
      });
    }
    return success
  }

  async getLink() {
    let forestCID = await this.agent.forestCID()
    const accessKey = await this.agent.getAccessKeyForPrivateFile(this.filename)
    const encodedAccessKey = uint8arrays.toString(accessKey.toBytes(), 'base64url');
    const encodedForestCID = uint8arrays.toString(forestCID, 'base64url')
    return [encodedAccessKey, encodedForestCID]
  }

  async signout(){
    await this.agent.destroy()
  }

  async activeSession() {
    return this.agent.activeSession()
  }

  async recoveryKitContent() {
    const data = await this.agent.recoveryKitData()
    return RecoveryKit.toYML(data)
  }

  async recover(content){
    var data = RecoveryKit.parseYML(content)

    const success = await this.agent.recover(data)
    if (success) {
      await this.agent.load()
    }
    return success
  }
}

class RecoveryKit {
  static toYML(data){
    return `
  # This is your recovery kit. (It's a yaml text file)
  # Store this somewhere safe.
  # Anyone with this file will have read access to your private files.
  # Losing it means you won't be able to recover your account
  # in case you lose access to all your linked devices.
  
  fullname: ${data.fullname}
  accountkey: ${data.accountKey}
  signature: ${data.signature}
  `;
  }

  static parseYML(content) {
    var data = {}
    data.fullname = content.toString().split("fullname: ")[1].split("\n")[0]
    data.accountKey = content.toString().split("accountkey: ")[1].split("\n")[0]
    data.signature = content.toString().split("signature: ")[1].split("\n")[0]

    return data
  }
}