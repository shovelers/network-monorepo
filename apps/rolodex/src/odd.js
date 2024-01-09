import axios from 'axios';
import _ from 'lodash';
import {vCardParser} from './vcard_parser.js';
import { ContactTable } from "./contact_table";
import { Contact, ContactRepository } from "./contacts.js";
import { Account, os, AccountSession  } from 'account-session';
import { createBrowserNode, AccountFS } from 'account-fs';
import { Key } from 'interface-datastore';

const SHOVEL_FS_SYNC_HOST = import.meta.env.VITE_SHOVEL_FS_SYNC_HOST || "http://localhost:3000"
const NETWORK = import.meta.env.VITE_NETWORK || "DEVNET"

const helia = await createBrowserNode()

let program = await os.getProgram()
const accountfs = new AccountFS(helia, NETWORK, SHOVEL_FS_SYNC_HOST)
await accountfs.load()

const accountSession =  new AccountSession(os, helia)

window.shovel = {
  helia: helia,
  fs: accountfs,
  session: accountSession,
  odd: program,
  Key: Key
}

const contactRepo = new ContactRepository(accountfs)
const account = new Account(os, accountfs, accountSession)

customElements.define('contact-table', ContactTable);

const axios_client  = axios.create({
  baseURL: `${window.location.origin}`,
})


async function getProgram() {
  program = await os.getProgram()
  return program
}

async function getSession(program) {
  return await os.getSession()
}

async function signup(username) {
  await account.create(
    username,
    [{name: "contacts.json", initialData: { contactList: {}, appleContacts: [], googleContacts: {} }}]
  );

  const timeout = setTimeout(() => {
    clearTimeout(timeout)
    window.location.href = "/app";
  }, 5000)
}

async function getProfile() {
  return account.getProfile()
}

async function getContacts() {
  return contactRepo.list()
}

async function filterContacts(filter) {
  var contacts = await getContacts()
  var filteredContacts = { "contactList": {}, "appleContacts": []}
  for (var id in contacts.contactList) {
    var contact = contacts.contactList[id]
    if (contact.name.toLowerCase().includes(filter.toLowerCase()) || contact.tags.filter(tag => tag.toLowerCase().includes(filter.toLowerCase())).length > 0) {
      filteredContacts.contactList[id] = contact
    }
    if (contact.text && contact.text.toLowerCase().includes(filter.toLowerCase())) {
      filteredContacts.contactList[id] = contact
    }
    if (contact.links && contact.links.filter(link => link.toLowerCase().includes(filter.toLowerCase())).length > 0) {
      filteredContacts.contactList[id] = contact
    }
  }
  console.log("filtered contacts", filteredContacts)
  return filteredContacts
}

async function updateProfile(handle, name, tags = [], text = '') {
  account.editProfile({handle: handle, name: name, tags: tags, text: text})
}

async function addContact(name, tags = [], text = "", links = []) {
  let contact = new Contact({name: name, tags: tags, text: text, links: links})
  return contactRepo.create(contact)
}

async function editContact(id, name, tags = [], text='', links = []) {
  let contact = new Contact({id: id, name: name, tags: tags, text: text, links: links})
  return contactRepo.edit(contact)
}

async function deleteContact(id) {
  return contactRepo.delete(id)
}

async function signout() {
  await account.signout()
}

async function producerChallengeProcessor(challenge, userInput) {
  console.log("challenge pin", challenge.pin)
  console.log("userinput", userInput)

  // Either show `challenge.pin` or have the user input a PIN and see if they're equal.
  if (userInput === challenge.pin.join("")) {
    challenge.confirmPin(); alert("Correct PIN.... Wait for the other device to load account data")
  } else {
    challenge.rejectPin(); alert("Wrong PIN")
  }
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

async function waitForDataRoot(username) {
  const program = await getProgram()
  const reference = program?.components.reference
  const EMPTY_CID = "Qmc5m94Gu7z62RC8waSKkZUrCCBJPyHbkpmGzEePxy2oXJ"

  if (!reference)
    throw new Error("Program must be initialized to check for data root")

  let dataRoot = await reference.dataRoot.lookup(username)

  if (dataRoot.toString() !== EMPTY_CID) return

  return new Promise((resolve) => {
    const maxRetries = 50
    let attempt = 0

    const dataRootInterval = setInterval(async () => {
      dataRoot = await reference.dataRoot.lookup(username)

      if (dataRoot.toString() === EMPTY_CID && attempt < maxRetries) {
        attempt++
        return
      }

      clearInterval(dataRootInterval)
      resolve()
    }, 500)
  })
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
  var existingAppleContactIDs = Object.values(contacts.contactList).filter((contact) => !contact.archived).map(contact => contact.appleContactID)
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
    if (!existingAppleContactIDs.includes(uid)) {
      contactList.push(new Contact({name: name, appleContactID: uid}))
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
        {params: { personFields: 'names', sortOrder: 'LAST_MODIFIED_DESCENDING', pageSize: 200 }, headers: { Authorization: `Bearer ${tokenResponse.access_token}` }}
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
  var existingGoogleContactIDs = Object.values(contacts.contactList).filter((contact) => !contact.archived).map(contact => contact.googleContactID)

  var contactList = []
  for (var i = 0; i < googleContacts.length; i++) {
    var googleContact = googleContacts[i]

    try {
      var name = googleContact.names[0].displayName
    } catch (error) {
      console.log("error for contact: ", googleContact, "error: ", error)
      continue
    }
    var uid = googleContact.resourceName
    if (!existingGoogleContactIDs.includes(uid)) {
      contactList.push(new Contact({name: name, googleContactID: uid}))
    }
  }

  await contactRepo.bulkCreate(contactList)
  console.log("Imported Contacts Count: ", contactList.length)
}

export { 
  getSession, 
  getProgram, 
  producerChallengeProcessor, 
  waitForDataRoot,
  signup, 
  signout, 
  generateRecoveryKit, 
  recover,
  getProfile, 
  updateProfile, 
  getContacts, 
  addContact, 
  editContact, 
  deleteContact, 
  filterContacts, 
  importContacts,
  importGoogleContacts,
  appleCredsPresent,
  downloadContactsDataLocally
};
