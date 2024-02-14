// Implement SearchCapability declared in account-fs

const PRODIDs = {
  "APPLE": "APPLE",
  "GOOGLE": "GOOGLE",
  "DCN": "DCN"
}

/*
  "PRODID": "GOOGLE",
  "UID": contact.googleContactID,

  "PRODID": "DCN",
  "UID": `DCN:${contact.handle}`, || `DCN:${contact.fullname}` 

  "PRODID": "FARCASTER",
  "UID": `FARCASTER:${contact.fid}`, || `DCN:${contact.handle}` 

  "PRODID": "APPLE",
  "UID": contact.appleContactID,
*/

class Person {
  PRODID;
  UID;
  FN;
  CATEGORIES;
  URL;
  NOTE;
  TEL;
  EMAIL;
  // TODO: Fix following field on contact import
  // XML;

  constructor(fields) {
    this.PRODID = fields.PRODID
    this.UID = fields.UID
    this.FN = fields.FN
    this.CATEGORIES = fields.CATEGORIES
    this.URL = fields.URL
    this.NOTE = fields.NOTE
    this.TEL = fields.TEL
    this.EMAIL = fields.EMAIL
    this.VERSION = "4.0"
  }
}

export const SearchCapability = {
  async search(query) {
    // Load Rolodex folder
    // Read files and build index
    const contacts = await this.readPrivateFile('contacts.json')

    // Search and return a list of contacts for the query
    const queryString = query.toLowerCase()
    var filteredContacts = []
    for (var id in contacts.contactList) {
      var contact = contacts.contactList[id]
      if (contact.name.toLowerCase().includes(queryString) || contact.tags.filter(tag => tag.toLowerCase().includes(queryString)).length > 0) {
        filteredContacts.push(contact)
      }
      if (contact.text && contact.text.toLowerCase().includes(queryString)) {
        filteredContacts.push(contact)
      }
      if (contact.links && (contact.links.filter(link => link.toLowerCase().includes(queryString)).length > 0)) {
        filteredContacts.push(contact)
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
        FN: contact.name,
      })
    })
  },

  // similarity search with another Handle on rolodex network or other networks
  // useful for mutual friends. membership etc.
  // async similarity(handle){}
}
