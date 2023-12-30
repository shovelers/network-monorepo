import * as uint8arrays from 'uint8arrays';

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
    this.filename = `directory-${name}.json`;
  }

  async list() {
    return this.store.readPrivateFile(this.filename)
  }

  async create(membership) {
    await this.store.updatePrivateFile(this.filename, (content) => {
      content.membershipList[membership.id] = membership.asJSON()
      return content
    })
  }

  async share() {
    return this.store.shareFile(this.filename)
  }
}

export class DirectoryPOJO {
  constructor(args) {
    let defaults = {id: crypto.randomUUID(), name: undefined, archived: false}
    let params = {...defaults, ...args}

    this.id = params.id
    this.name = params.name
    this.archived = params.archived
    this.filename = `directory-${params.name}.json`
  }

  asJSON() {
    return {
      id: this.id,
      name: this.name,
      archived: this.archived
    }
  }
}

export class DirectoryReposistory {
  constructor(accountfs) {
    this.accountfs = accountfs
    this.filename = "directories.json"
  }

  async list() {
    let data = await this.accountfs.readPrivateFile(this.filename)
    let directories = Object.values(data.directoryList).map(element => new DirectoryPOJO(element))
    for(let step = 0; step < directories.length; step++) {
      directories[step].link = await this.getLink(directories[step])
    }
    return directories
  }

  async getLink(directory) {
    const [accessKey, forestCID] = await this.accountfs.getAccessKeyForPrivateFile(directory.filename)
    const encodedAccessKey = uint8arrays.toString(accessKey.toBytes(), 'base64url');
    const encodedForestCID = uint8arrays.toString(forestCID, 'base64url')
    return `/directory/${directory.id}?cid=${encodedForestCID}&key=${encodedAccessKey}`
  }

  async create(directory) {
    await this.accountfs.updatePrivateFile(this.filename, (content) => {
      content.directoryList[directory.id] = directory.asJSON()
      return content
    })

    await this.accountfs.updatePrivateFile(directory.filename, () => { return {} })
  }
}