export class Contact {
  constructor(args) {
    let defaults = {id: crypto.randomUUID(), tags: [], links: [], text: "", archived: false}
    let params = {...defaults, ...args}

    this.id = params.id
    this.name = params.name
    this.tags = params.tags
    this.links = params.links
    this.text = params.text
    this.archived = params.archived
    this.PRODID = params.PRODID  // Validate - Required
    this.UID = params.UID        // Validate - Required 
  }

  asJSON() {
    return {
      id: this.id,
      PRODID: this.PRODID,
      UID: this.UID,
      name: this.name,
      tags: this.tags,
      links: this.links,
      text: this.text,
      archived: this.archived
    }
  }
}

export class ContactRepository {
  constructor(agent) {
    this.agent = agent
    this.filename = "contacts.json"
  }

  async list(){
    return this.agent.readPrivateFile(this.filename)
  }

  async filter(){}

  async create(contact){
    await this.agent.updatePrivateFile(this.filename, (content) => {
      content.contactList[contact.id] = contact.asJSON()
      return content
    })
  }

  async bulkCreate(contacts){
    await this.agent.updatePrivateFile(this.filename, (content) => {
      contacts.forEach(element => {
        content.contactList[element.id] = element.asJSON()
      });
      return content
    })
  }

  async edit(contact){
    await this.agent.updatePrivateFile(this.filename, (content) => {
      content.contactList[contact.id] = contact.asJSON()
      return content
    }) 
  }

  async delete(contactID){
    await this.agent.updatePrivateFile(this.filename, (content) => {
      content.contactList[contactID].archived = true
      console.log("archived contact", content.contactList[contactID])
      return content
    })  
  }
}