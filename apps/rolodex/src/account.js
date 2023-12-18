export class Profile {
  constructor(args) {
    let defaults = { name: "John Doe", tags: [], text: '' }
    let params = {...defaults, ...args}

    this.handle = params.handle
    this.name = params.name
    this.tags = params.tags
    this.text = params.text
  }

  asJSON() {
    return {
      handle: this.handle,
      name: this.name,
      tags: this.tags,
      text: this.text
    }
  }
}

export class Account {
  constructor(os) {
    this.store = os
    this.filename = "profile.json"
  }

  async getProfile(){
    return this.store.readPrivateFile(this.filename)
  }

  async editProfile(profile){
    await this.store.updatePrivateFile(this.filename, (content) => {
      content = profile.asJSON()
      return content
    })
  }
}