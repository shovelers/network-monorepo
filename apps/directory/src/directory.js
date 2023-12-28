export class Membership {
  constructor(args) {
    let defaults = {id: crypto.randomUUID(), profileCid: "testcid", accessKey: "testaccesskey", archived: false}
    let params = {...defaults, ...args}

    this.id = params.id
    this.profileCid = params.profileCid
    this.accessKey = params.accessKey
    this.archived = params.archived
  }

  asJSON() {
    return {
      id: this.id,
      profileCid: this.profileCid,
      accessKey: this.accessKey,
      archived: this.archived
    }
  }
}

export class Directory {
  constructor(accountfs, name) {
    this.store = accountfs;
    this.filename = `${name}.json`;
  }

  async list() {
    return this.store.readPrivateFile(this.filename)
  }

  async create(membership) {
    await this.store.updatePrivateFile(this.filename, () => { return { membershipList: {}} })
    
    await this.store.updatePrivateFile(this.filename, (content) => {
      content.membershipList[membership.id] = membership.asJSON()
      return content
    })
  }

  async share() {
    return this.store.shareFile(this.filename)
  }
}
