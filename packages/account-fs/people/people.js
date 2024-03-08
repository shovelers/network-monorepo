import { Person } from "./person"

//TODO: make contacts.json a CRDT 
export class PeopleRepository {
  constructor(agent) {
    this.agent = agent
    this.filename = "contacts.json"
  }

  async list(){
    let contacts = await this.agent.readPrivateFile(this.filename)

    let people = []
    for (let [_, contact] of Object.entries(contacts.contactList)) {
      if (contact.archived == true) {
        continue;
      }

      people.push(new Person({
        PRODID: contact.PRODID,
        UID: contact.UID,
        TEL: contact.TEL,
        EMAIL: contact.EMAIL,
        FN: contact.FN,
        //TODO: remove below fields from search results, when searched from other apps
        CATEGORIES: contact.CATEGORIES,
        URL: contact.URL,
        NOTE: contact.NOTE,
        XML: contact.XML
      }))
    }
    return people
  }

  async find(uid){
    let contacts = await this.agent.readPrivateFile(this.filename)
    let contact = contacts.contactList[uid]

    return new Person({
        PRODID: contact.PRODID,
        UID: contact.UID,
        TEL: contact.TEL,
        EMAIL: contact.EMAIL,
        FN: contact.FN,
        //TODO: remove below fields from search results, when searched from other apps
        CATEGORIES: contact.CATEGORIES,
        URL: contact.URL,
        NOTE: contact.NOTE,
        XML: contact.XML
      })
  }

  async filter(){}

  async create(person){
    await this.agent.updatePrivateFile(this.filename, (content) => {
      content.contactList[person.UID] = person.asJSON()
      return content
    })
  }

  async bulkCreate(contacts){
    await this.agent.updatePrivateFile(this.filename, (content) => {
      contacts.forEach(element => {
        content.contactList[element.UID] = element.asJSON()
      });
      return content
    })
  }

  async edit(person){
    await this.agent.updatePrivateFile(this.filename, (content) => {
      content.contactList[person.UID] = person.asJSON()
      return content
    }) 
  }

  async delete(UID){
    await this.agent.updatePrivateFile(this.filename, (content) => {
      content.contactList[UID].archived = true
      console.log("archived contact", content.contactList[UID])
      return content
    })  
  }
}