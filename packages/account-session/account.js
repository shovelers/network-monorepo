import * as uint8arrays from 'uint8arrays';

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

export class Account {
  constructor(accountfs, accountSession) {
    this.accountfs = accountfs
    this.accountSession = accountSession
    this.filename = "profile.json"
    this.profile = null
  }

  async getProfile(){
    this.profile = await this.accountfs.readPrivateFile(this.filename)
    return this.profile
  }

  async editProfile(params){
    if (!this.profile) {
      await this.getProfile()
    }

    await this.accountfs.updatePrivateFile(this.filename, (content) => {
      content = {...this.profile, ...params}
      return content
    })
  }

  async create(handle, initialFiles) {
    const fullname = await this.accountSession.registerUser(handle)

    await this.accountfs.updatePrivateFile("profile.json", () => { return new Profile({handle: handle}).asJSON() })
    await initialFiles.forEach(async element => {
      await this.accountfs.updatePrivateFile(element.name, () => { return element.initialData })
    });
  }

  async getLink() {
    const [accessKey, forestCID] = await this.accountfs.getAccessKeyForPrivateFile(this.filename)
    const encodedAccessKey = uint8arrays.toString(accessKey.toBytes(), 'base64url');
    const encodedForestCID = uint8arrays.toString(forestCID, 'base64url')
    return [encodedAccessKey, encodedForestCID]
  }

  async signout(){
    await this.accountSession.destroy()
  }

  async activeSession() {
    return this.accountSession.activeSession()
  }

  async recoveryKitContent() {
    var { accessKey, handle } = await this.accountSession.recoveryKitData()
    const encodedAccessKey = uint8arrays.toString(accessKey, 'base64pad');
    return RecoveryKit.toYML(handle, encodedAccessKey)
  }

  async recover(content){
    var data = RecoveryKit.parseYML(content)

    var shovelKey = uint8arrays.fromString(data.shovelkey, 'base64pad'); 
    var handle = data.handle

    await this.accountfs.recover(handle, shovelKey)
  }
}

class RecoveryKit {
  static toYML(handle, encodedAccessKey){
    return `
  # This is your recovery kit. (It's a yaml text file)
  # Store this somewhere safe.
  # Anyone with this file will have read access to your private files.
  # Losing it means you won't be able to recover your account
  # in case you lose access to all your linked devices.
  
  username: ${handle}
  shovelkey: ${encodedAccessKey}
  `;
  }

  static parseYML(content) {
    var handle = content.toString().split("username: ")[1].split("\n")[0]
    var shovelKey = content.toString().split("shovelkey: ")[1].split("\n")[0]

    return {handle: handle, shovelkey: shovelKey}
  }
}