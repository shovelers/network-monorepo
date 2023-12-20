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
  constructor(os) {
    this.store = os
    this.filename = "profile.json"
    this.profile = null
  }

  async getProfile(){
    var data = await this.store.readPrivateFile(this.filename)
    this.profile = new Profile(data);
    return this.profile.asJSON()
  }

  async editProfile(params){
    if (!this.profile) {
      await this.getProfile()
    }

    await this.store.updatePrivateFile(this.filename, (content) => {
      content = {...this.profile.asJSON(), ...params}
      return content
    })
  }

  async create(handle) {
    await this.store.createFissionUser(handle)

    this.store.updatePrivateFile("profile.json", () => { return new Profile({handle: handle}).asJSON() })
    this.store.updatePrivateFile("contacts.json", () => { return { contactList: {}, appleContacts: [], googleContacts: {} } })  
  }

  async signout(){
    let session = await this.store.getSession()
    await session.destroy()
  }
}