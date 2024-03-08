import { Person } from "./person"

export const SearchCapability = {
  async search(query) {
    // Load Rolodex folder
    // Read files and build index
    const contacts = await this.readPrivateFile('contacts.json')

    // Search and return a list of contacts for the query
    const queryString = query.toLowerCase()
    //TODO: move filter to repository
    var filteredContacts = []
    for (var id in contacts.contactList) {
      var person = contacts.contactList[id]
      if (person.archived) { continue }
      if (person.FN.toLowerCase().includes(queryString) || person.CATEGORIES.split(',').filter(tag => tag.toLowerCase().includes(queryString)).length > 0) {
        filteredContacts.push(person)
        continue
      }
      if (person.NOTE && person.NOTE.toLowerCase().includes(queryString)) {
        filteredContacts.push(person)
        continue
      }
      if (person.URL && (person.URL.split(',').filter(link => link.toLowerCase().includes(queryString)).length > 0)) {
        filteredContacts.push(person)
        continue
      }
    }

    // Contact type - Rolodex Network or Imported Contacts from other networks/naming service
    // Contact data structure to support invite action and profile details for display
    //   Invite Handshake for Rolodex Network
    //   DeepLink for Imported Contact
    return filteredContacts.map(function(contact) {
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
    })
  },

  // similarity search with another Handle on rolodex network or other networks
  // useful for mutual friends. membership etc.
  // async similarity(handle){}
}
