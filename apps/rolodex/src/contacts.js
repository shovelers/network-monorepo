export class Contact {
  constructor(args) {
    let defaults = {id: crypto.randomUUID(), tags: [], links: [], text: "", archived: false}
    let params = {...defaults, ...args}

    this.id = params.id
    this.name = params.name
    this.tags = params.tags
    this.links = params.links
    this.text = params.text
    this.googleContactID = params.googleContactID
    this.appleContactID = params.appleContactID
    this.archived = params.archived
  }

  asJSON() {
    return {
      id: this.id,
      name: this.name,
      tags: this.tags,
      links: this.links,
      text: this.text,
      googleContactID: this.googleContactID,
      appleContactID: this.appleContactID,
      archived: this.archived
    }
  }
}

export class ContactRepository {
  constructor(os) {
    this.store = os
    this.filename = "contacts.json"
  }

  async list(){
    return this.store.readPrivateFile(this.filename)
  }

  async filter(){}

  async create(contact){
    await this.store.updatePrivateFile(this.filename, (content) => {
      content.contactList[contact.id] = contact.asJSON()
      return content
    })
  }

  async edit(contact){
    await this.store.updatePrivateFile(this.filename, (content) => {
      content.contactList[contact.id] = contact.asJSON()
      return content
    }) 
  }

  async delete(contactID){
    await this.store.updatePrivateFile(this.filename, (content) => {
      content.contactList[contactID].archived = true
      console.log("archived contact", content.contactList[contactID])
      return content
    })  
  }
}