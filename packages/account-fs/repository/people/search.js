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
    // Find contats who have shared their contactbook with us for second degree search
    var contactsWithDepth = []
    for (var id in contacts.contactList) {
      var person = contacts.contactList[id]
      if (person.XML) {
        contactsWithDepth.push(person)
        continue
      }
    }

    // Contact type - Rolodex Network or Imported Contacts from other networks/naming service
    // Contact data structure to support invite action and profile details for display
    //   Invite Handshake for Rolodex Network
    //   DeepLink for Imported Contact
    filteredContacts = this.typecastToPerson(filteredContacts)

    //for each contactWithDepth fetchSharedContacts and append to filteredContacts and return filteredContacts
    console.log("contactsWithDepth :", contactsWithDepth)
    const promises = contactsWithDepth.map(async (element) => {
      let result;
      try {
        result = await Promise.race([
          this.filterFromSharedContacts(element, query),
          new Promise((resolve, reject) => {
            setTimeout(() => {
              reject(new Error('Timeout'));
            }, 5000); // Timeout after 5 seconds
          })
        ]);
        console.log("result after fetch and filter :", element.UID, result);
        filteredContacts = filteredContacts.concat(result);
      } catch (error) {
        console.log("contact filtering failed", element.UID, error);
      }
    });

    // Wait for all promises to resolve
    await Promise.all(promises);
    
    console.log("filtered after concat :", filteredContacts)
    return filteredContacts
  },

  async filterFromSharedContacts(person, query) {
    const queryString = query.toLowerCase()
    let details = person.XML.split(':')[1]
    let handle = details.split('.')[0]
    let accessKey = details.split('.')[1]
    
    console.log("starting searching", handle)

    // TODO replace with new v1 api
    //fetch cid using handle
    return await this.axios_client.get(`/forestCID/${handle}`).then(async (response) => {
      let forestCID = response.data.cid
      //Use accesskey & forestCID to get content of contats.json
      var fetchedContacts
      try {
        fetchedContacts = await this.readPrivateFileByPointer(accessKey, CID.parse(forestCID).bytes)
        console.log("CID fetch complete", handle)
      } catch (e) {
        console.log("CID fetch failed", handle, forestCID, e);
        return []
      }

      try {
        fetchedContacts = JSON.parse(fetchedContacts)
        //filter contats to get contacts matching criterion
        var filteredContacts = this.fullTextMatch(fetchedContacts, query)
        //create Person Object and add XML = via: person.UID so that the UI can show this info in the search results
        filteredContacts = this.typecastToPerson(filteredContacts, handle)
        console.log("filtering done", handle)
        return filteredContacts
      } catch (e) {
        console.log("weird data bug", handle, e)
        return []
      }
    }).catch((e) => {
        console.log("Couldn't resolve CID", handle, e);
        return []
      })
  },

  //matches the query with text in contact fileds
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

      if (person.EMAIL ) {
        let emailMatch = false;
        if (Array.isArray(person.EMAIL)) {
          emailMatch = person.EMAIL.some(email => email.toLowerCase().includes(queryString));
        } else {   //done this way as some email's are strings while are some array of strings
          emailMatch =  person.EMAIL.split(',').filter(email => email.trim().toLowerCase().includes(queryString)).length > 0
        }
        if (emailMatch) {
          filteredContacts.push(person);
          continue;
        }
      }

    }
    return filteredContacts
  },

  //typecast response to Person object
  typecastToPerson(filteredContacts, handle) {
    return filteredContacts.map(function(contact) {
      //adds via info in XML for seach results from connect's contacts
      if (handle) { contact["XML"] = `via:${handle}` }
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
  }
  // similarity search with another Handle on rolodex network or other networks
  // useful for mutual friends. membership etc.
  // async similarity(handle){}
}
