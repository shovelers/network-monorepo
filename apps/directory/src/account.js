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
  constructor(os, accountfs) {
    this.store = os
    this.accountfs = accountfs
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

  async create(handle) {
    await this.store.createFissionUser(handle)

    await this.accountfs.updatePrivateFile("profile.json", () => { return new Profile({handle: handle}).asJSON() })
    await this.accountfs.updatePrivateFile("contacts.json", () => { return { contactList: {}, appleContacts: [], googleContacts: {} } })  
  }

  async signout(){
    let session = await this.store.getSession()
    await session.destroy()
  }

  async recoveryKitContent() {
    let oddAccessKey = await this.store.getOddAccessKey()
    var { accessKey, handle, fissionusername } = await this.store.recoveryKitData()
    const encodedAccessKey = uint8arrays.toString(accessKey, 'base64pad');
    return RecoveryKit.toYML(fissionusername, encodedAccessKey, oddAccessKey)
  }

  async recover(access_key, handle) {
    return await this.store.recover(access_key, handle)
  }
}

class RecoveryKit {
  static toYML(fissionusername, encodedAccessKey, encodedOddKey){
    return `
  # This is your recovery kit. (It's a yaml text file)
  # Store this somewhere safe.
  # Anyone with this file will have read access to your private files.
  # Losing it means you won't be able to recover your account
  # in case you lose access to all your linked devices.
  
  username: ${fissionusername}
  shovelkey: ${encodedAccessKey}
  oddkey: ${encodedOddKey}
  `;
  }
}