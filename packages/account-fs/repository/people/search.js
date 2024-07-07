import { Person } from "./person"
import { CID } from 'multiformats/cid'

export class PeopleSearch {
  // build a list of people
    // get local contacts
    // get shared contacts via users and community
  // design caching and update of list of people
  // provide fast query layer
  // Alow providing context of community to query

  constructor(agent, peopleRepo) {
    this.agent = agent
    this.peopleRepo = peopleRepo
  }

  async search(query){
    const queryString = query.toLowerCase()
    let dis = this

    return await this.peopleRepo.match((p) => {
      return dis.fullTextMatch(p, queryString)
    })
  }

  async globalSearch(query){
    const queryString = query.toLowerCase()
    let matches = []

    const people = await this.peopleRepo.list()
    for (let step = 0; step < people.length; step++) {
      if (this.fullTextMatch(people[step], queryString)) {
        matches.push(people[step])
      }

      if (people[step].isCommunity()) {
        const members = await people[step].getMembers(this.agent)
        for (let i = 0; i < members.length; i++) {
          if (this.memberMatch(members[i], queryString) || (this.fullTextMatch(members[i], queryString))) {
            matches.push(members[i])
          }
        }
      }
    }

    return matches
  }

  //private
  fullTextMatch(person, queryString) {
    if ((person.FN && person.FN.toLowerCase().includes(queryString)) ||(person.CATEGORIES && person.CATEGORIES.split(',').filter(tag => tag.toLowerCase().includes(queryString)).length > 0)) {
      return true
    }

    if (person.NOTE && person.NOTE.toLowerCase().includes(queryString)) {
      return true
    }

    if (person.URL && (person.URL.split(',').filter(link => link.toLowerCase().includes(queryString)).length > 0)) {
      return true
    }

    if (person.EMAIL) {
      let emailMatch = false;
      if (Array.isArray(person.EMAIL)) {
        emailMatch = person.EMAIL.some(email => email.toLowerCase().includes(queryString));
      } else {   //done this way as some email's are strings while are some array of strings
        emailMatch =  person.EMAIL.split(',').filter(email => email.trim().toLowerCase().includes(queryString)).length > 0
      }
      if (emailMatch) {
        return true
      }
    }

    return false
  }

  memberMatch(person, queryString){
    let allTags = person.lookingFor.concat(person.canHelpWith, person.expertise)
    if (person.name.toLowerCase().includes(queryString) || person.handle.toLowerCase().includes(queryString) || person.text.toLowerCase().includes(queryString)){
      return true
    } else if ((allTags.filter(tag => tag.toLowerCase().includes(queryString))).length > 0 ) {
      return true
    }
    return false
  }
}

export const SearchCapability = {
  async search(query) {
    // Load Rolodex folder
    // Read files and build index
    const contacts = await this.readPrivateFile('contacts.json')

    // Search and return a list of contacts for the query
    const queryString = query.toLowerCase()
    //TODO: move filter to repository
    var filteredContacts = this.fullTextMatch(contacts, queryString)
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
    
    console.log("filtered after concat :", filteredContacts)
    return filteredContacts
  },

  async fetchMemberProfilesForCommunity(community) {
    //example community.XML format {members.json details}|{contacts.json details}
    //"members.json:DecentralisedCo.oXN3bmZzL3NoYXJlL3RlbXBvcmFso2VsYWJlbFggAxDOaGW3iLTPdw9K71ow6_-3ZzBReTN4N6hLMrhMGFJqY29udGVudENpZNgqWCUAAVUSIMG7uPOznVH86HYDUQWVq1YB1SPeIFsw6PKReWzb38zTa3RlbXBvcmFsS2V5WCD8fo-LhlD-NQZ_rop3lNx6aRRTq14OhH1wXGbxqYl1hg|contacts.json:DecentralisedCo.oXN3bmZzL3NoYXJlL3RlbXBvcmFso2VsYWJlbFggpX6-bGdo36XxL4280055vrM7qxaTj4hd_KHRYvbzVG1qY29udGVudENpZNgqWCUAAVUSIFiQy3vwUResYBaRClZfLLwqYsX0IbaeqFNjR-qadaeja3RlbXBvcmFsS2V5WCAJttK3Ut2VFLeZwGS4w9RmWk2UwK4IpDHuQnRnfOopRA"
    let details = community.XML.split('|');
    let memberDetails = details[0].split(':')[1];
    let memberAccessKey = memberDetails.split('.')[1];
    let communityDID = community.UID.split(':').splice(1).join(':');

    const timeout = (ms) => {
      return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('timeout')), ms);
      });
    };
    
    try {
        let response = await this.axios_client.get(`/v1/accounts/${communityDID}/head`);
        let forestCID = response.data.head;
        let filecontent = await this.readPrivateFileByPointer(memberAccessKey, CID.parse(forestCID).bytes, 'base64url');
        let fetchedMembers = JSON.parse(filecontent).memberList;

        console.log("fetched members", fetchedMembers);

        let profilePromises = Object.entries(fetchedMembers).map(async ([key, value]) => {
            let personDetails = value.XML.split(':')[1];
            let profileAccessKey = personDetails.split('.').pop();
            let personDID = value.UID.split(':').splice(1).join(':');

            try {
                let personResponse = await this.axios_client.get(`/v1/accounts/${personDID}/head`);
                let personForestCID = personResponse.data.head;
                let filecontent = await Promise.race([
                  this.readPrivateFileByPointer(profileAccessKey, CID.parse(personForestCID).bytes),
                  timeout(10000)
                ]);

                if (value.FN == "Seed Data") {
                    return Object.values(JSON.parse(filecontent));
                } else {
                    return [JSON.parse(filecontent)];
                }
            } catch (e) {
                console.log("CID fetch failed", e);
                return [];
            }
        });

        let profileResults = await Promise.all(profilePromises);
        let fetchedProfiles = profileResults.flat();

        console.log("fetched Profiles :", fetchedProfiles);
        return fetchedProfiles;
    } catch (e) {
        console.log("CID fetch failed", e);
        return [];
    }
  },

  async searchMembers(query, profiles){
    //fetch all profiles for the community
      //select & return the matching profiles
    let queryNormalized = query.toLowerCase()
    var filteredProfiles = []
    for (let [key, value] of Object.entries(profiles)) {
      let allTags = value.lookingFor.concat(value.canHelpWith, value.expertise)
      if (value.name.toLowerCase().includes(queryNormalized) || value.handle.toLowerCase().includes(queryNormalized) || value.text.toLowerCase().includes(queryNormalized)){
        filteredProfiles.push(value)
      } else if ( (allTags.filter(tag => tag.toLowerCase().includes(queryNormalized))).length > 0 ) {
        filteredProfiles.push(value)
      }
    } 

    console.log("from inside serch", query, filteredProfiles)
    return filteredProfiles
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
