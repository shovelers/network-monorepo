import axios from 'axios';
import _ from 'lodash';
import {vCardParser} from './vcard_parser.js';
import { ContactTable } from "./contact_table";
import { programInit, Account, Person, PeopleRepository } from 'account-fs';

const NETWORK = import.meta.env.VITE_NETWORK || "DEVNET"

// TODO - remove passing of App handle, instead infer from IndexDB after join handshake from app agent
const program = await programInit(NETWORK, "rolodex")
window.shovel = program

const contactRepo = new PeopleRepository(program.agent)
const account = new Account(program.agent)

customElements.define('contact-table', ContactTable);

const axios_client  = axios.create({
  baseURL: `${window.location.origin}`,
})

async function signup(username, requester) {
  requester.notification.addEventListener("challengeGenerated", (challengeEvent) => {
    console.log(challengeEvent.detail)
  })
  
  const success = await account.create(
    username,
    [{name: "contacts.json", initialData: { contactList: {} }}]
  );

  if (success == true) {
    await requester.initiate()

    const timeout = setTimeout(() => {
      clearTimeout(timeout)
      window.location.href = "/app";
    }, 5000)
  }

  return success
}

async function getProfile() {
  return account.getProfile()
}

async function getContacts() {
  var list = await contactRepo.list()
  console.log("all", list)
  return {contactList: list}
}

async function getContactForRelate() {
  let profile = await getProfile()
  return {
    FN: profile.name,
    UID: `DCN:${profile.handle}`,
    PRODID: "DCN:rolodex" // TODO figure how to get app handle
  }
}

async function getContactByUID(uid) {
  return await contactRepo.find(uid)
}

async function filterContacts(filter) {
  return { contactList: await program.agent.search(filter) }
}

async function updateProfile(handle, name, tags = [], text = '') {
  account.editProfile({handle: handle, name: name, tags: tags, text: text})
}

async function addContact(name, tags = [], text = "", links = []) {
  let person = new Person({FN: name, CATEGORIES: tags.join(), NOTE: text, URL: links.join(), PRODID: "DCN:rolodex", UID: crypto.randomUUID()})
  return contactRepo.create(person)
}

// TODO - handle duplicate connections
async function addConnection(person) {
  let connection = new Person({FN: person.FN, PRODID: person.PRODID, UID: person.UID})
  return contactRepo.create(connection) 
}

// TODO - fix bug where contact edit clears PRODID etc.
async function editContact(id, name, tags = [], text='', links = []) {
  let person = new Person({FN: name, CATEGORIES: tags.join(), NOTE: text, URL: links.join(), PRODID: "DCN:rolodex", UID: id})
  return contactRepo.edit(person)
}

async function deleteContact(id) {
  return contactRepo.delete(id)
}

async function signout() {
  await account.signout()
}

async function downloadContactsDataLocally() {
  const content = await getContacts()
  console.log("content: ", content)
  const data = new Blob([JSON.stringify(content, null, 4)], { type: 'application/json' })
  var fileURL = window.URL.createObjectURL(data);
  var tempLink = document.createElement('a');
  tempLink.href = fileURL;
  tempLink.setAttribute('download', 'contacts.json');
  tempLink.click();
  window.URL.revokeObjectURL(fileURL);
}

async function generateRecoveryKit(username){
  const content = await account.recoveryKitContent()
  
  const data = new Blob([content], { type: 'text/plain' })
  var fileURL = window.URL.createObjectURL(data);
  var tempLink = document.createElement('a');
  tempLink.href = fileURL;
  tempLink.setAttribute('download', `rolodex-${username}-recovery-kit.yaml`);
  tempLink.click();
  window.URL.revokeObjectURL(fileURL);
  alert('your file has been downloaded!'); 
}

async function recover(kit) {
  var kitText = await kit.text()
  await account.recover(kitText)
  const timeout = setTimeout(() => {
    clearTimeout(timeout)
    window.location.href = "/app";
  }, 5000)
}

async function importContacts(username, password){
  //fetch creds from store if already present
  console.log("import triggered")
  var credsPresence = await appleCredsPresent()
  if (credsPresence.response) {
    var user = credsPresence.value.username
    var pass = credsPresence.value.password
  } else {
    account.editProfile({appleCreds: {username: username, password: password}});
    var user = username
    var pass = password
  }

  const response = await axios_client.get('/apple_contacts', { params: { username: user, password: pass } })
  .then(function (response) {
    return response;
  });

  //insert appleContacts to contactList
  await addAppleContactsToContactList(response.data)
  console.log("import done")
}

async function appleCredsPresent(){
  var profileData = await getProfile()
  var credsPresent =  !(_.isEmpty(profileData.appleCreds) || profileData.appleCreds.username === "")
  console.log("creds present: ", credsPresent)
  return {response: credsPresent, value: profileData.appleCreds} 
}

async function addAppleContactsToContactList(appleContacts){
  //check if the uid to appleContacts[i] is == to any of the appleContactIDs in contactList
  //if not, add it to contactList
  var contacts = await contactRepo.list()
  var existingAppleContactIDs = Object.values(contacts.contactList).filter((contact) => !contact.archived).map(contact => contact.UID)
  var contactList = []
  for (var i = 0; i < appleContacts.length; i++) {
    var appleContact = appleContacts[i]
    try {
      var parsedAppleContact = vCardParser.parse(appleContact.data)[0]
    } catch (error) {
      console.log("error for contact: ", appleContact, "error: ", error)
      continue
    }
    var name = parsedAppleContact.displayName
    var uid = parsedAppleContact.UID
    var TEL = parsedAppleContact.telephone ? parsedAppleContact.telephone[0].value : undefined
    var EMAIL = parsedAppleContact.email ? parsedAppleContact.email[0].value : undefined
    if (!existingAppleContactIDs.includes(uid)) {
      // TODO set PROPID from vcard parsing
      contactList.push(new Person({FN: name, PRODID: "APPLE", UID: uid, EMAIL: EMAIL, TEL: TEL}))
    }
  }
  await contactRepo.bulkCreate(contactList)
  console.log("Imported Contacts Count: ", contactList.length)
}

async function importGoogleContacts(refresh) {
  google.accounts.oauth2.initTokenClient({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/userinfo.email',
    callback: async (tokenResponse) => {
      const profile = await axios_client.get('https://www.googleapis.com/oauth2/v2/userinfo', {headers: { Authorization: `Bearer ${tokenResponse.access_token}`}})
      const response = await axios_client.get('https://people.googleapis.com/v1/people/me/connections',
        {params: { personFields: 'names,emailAddresses,phoneNumbers', sortOrder: 'LAST_MODIFIED_DESCENDING', pageSize: 200 }, headers: { Authorization: `Bearer ${tokenResponse.access_token}` }}
      )
      console.log("google contacts ", response.data);

      await addGoogleContactsToContactList(response.data.connections)
      console.log("import done")

      refresh()
    },
  }).requestAccessToken();
}

async function addGoogleContactsToContactList(googleContacts){
  var contacts = await contactRepo.list()
  var existingGoogleContactIDs = Object.values(contacts.contactList).filter((contact) => !contact.archived).map(contact => contact.UID)

  var contactList = []
  for (var i = 0; i < googleContacts.length; i++) {
    var googleContact = googleContacts[i]

    try {
      var name = googleContact.names[0].displayName
    } catch (error) {
      console.log("error for contact: ", googleContact, "error: ", error)
      continue
    }
    // TODO search for primary fields
    var EMAIL = googleContact.emailAddresses ? googleContact.emailAddresses[0].value : undefined
    var TEL = googleContact.phoneNumbers ? googleContact.phoneNumbers[0].canonicalForm : undefined
    var uid = googleContact.resourceName
    if (!existingGoogleContactIDs.includes(uid)) {
      contactList.push(new Person({FN: name, PRODID: "GOOGLE", UID: uid, EMAIL: EMAIL, TEL: TEL}))
    }
  }

  await contactRepo.bulkCreate(contactList)
  console.log("Imported Contacts Count: ", contactList.length)
}

export { 
  account,
  signup, 
  signout, 
  generateRecoveryKit, 
  recover,
  getProfile, 
  updateProfile, 
  getContacts, 
  getContactByUID,
  addContact, 
  addConnection,
  editContact, 
  deleteContact, 
  filterContacts, 
  importContacts,
  importGoogleContacts,
  appleCredsPresent,
  getContactForRelate,
  downloadContactsDataLocally
};
