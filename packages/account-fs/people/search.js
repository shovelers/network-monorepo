import { Person } from "./person"
import { CID } from 'multiformats/cid'


export const SearchCapability = {
  async search(query) {
    // Load Rolodex folder
    // Read files and build index
    const contacts = await this.readPrivateFile('contacts.json')

    // Search and return a list of contacts for the query
    const queryString = query.toLowerCase()
    //TODO: move filter to repository
    var filteredContacts = this.fullTextMatch(contacts, query)
    var contactsWithDepth = []
    for (var id in contacts.contactList) {
      var person = contacts.contactList[id]
      if (person.XML) {
        contactsWithDepth.push(person)
      }
    }

    // Contact type - Rolodex Network or Imported Contacts from other networks/naming service
    // Contact data structure to support invite action and profile details for display
    //   Invite Handshake for Rolodex Network
    //   DeepLink for Imported Contact
    filteredContacts.map(function(contact) {
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

    //for each contactWithDepth fetchSharedContacts and append to filteredContacts and return filteredContacts
    for await (const element of contactsWithDepth) {
      let result = await this.filterFromSharedContacts(element, query)
      console.log("result after fetch and filter :", result)
      return filteredContacts.concat(result)
    }
    console.log("filtered after concat :", filteredContacts)
    return filteredContacts
  },

  async filterFromSharedContacts(person, query) {
    const queryString = query.toLowerCase()
    let details = person.XML.split(':')[1]
    let handle = details.split('.')[0]
    let accessKey = details.split('.')[1]

    //fetch cid using handle
    return await this.axios_client.get(`/forestCID/${handle}`).then(async (response) => {
      let forestCID = response.data.cid
      //Use accesskey & forestCID to get content of contats.json
      var fetchedContacts = await this.readPrivateFileByPointer(accessKey, CID.parse(forestCID).bytes)
      fetchedContacts = JSON.parse(fetchedContacts)
      //filter contats to get contacts matching criterion
      var filteredContacts = this.fullTextMatch(fetchedContacts, query)
      //create Person Object and add XML = via: person.UID so that the UI can show this info in the search results
      console.log("filtered Contacts before XML:", filteredContacts)
      filteredContacts.map(function(contact) {
        contact["XML"] = `via:${handle}`
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
      console.log("filtered from fetch, person objects :", filteredContacts)
      return filteredContacts
    }).catch((e) => {
        console.log(e);
        return e
      })
  },

  fullTextMatch (contacts, queryString) {
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
    return filteredContacts
  }
  // similarity search with another Handle on rolodex network or other networks
  // useful for mutual friends. membership etc.
  // async similarity(handle){}
}
