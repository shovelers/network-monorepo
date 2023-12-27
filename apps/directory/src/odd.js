import { retrieve } from '@oddjs/odd/common/root-key';
import * as uint8arrays from 'uint8arrays';
import _ from 'lodash';
import { ContactTable } from "./contact_table";
import { os, accountfs } from './odd_session.js';
import { Contact, ContactRepository } from "./contacts.js";
import { Account } from "./account.js";

const contactRepo = new ContactRepository(accountfs)
const account = new Account(os, accountfs)

customElements.define('contact-table', ContactTable);

let program = null
const USERNAME_STORAGE_KEY = "fullUsername"

async function validSession() {
  let session = await os.getSession()
  return (session !== undefined)
}

async function getProgram() {
  program = await os.getProgram()
  return program
}

async function signup(username) {
  await account.create(username);

  const timeout = setTimeout(() => {
    clearTimeout(timeout)
    window.location.href = "/app";
  }, 5000)
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
  var oldFullUsername = kitText.toString().split("username: ")[1].split("\n")[0]
  var oldHashedUsername = await os.prepareUsername(oldFullUsername)
  console.log("old username: ...", oldFullUsername)
  console.log("hashed old username: ", oldHashedUsername)

  var readKey = kitText.toString().split("oddkey: ")[1].split("\n")[0]
  readKey = uint8arrays.fromString(readKey, 'base64pad');
  console.log("readKey: ...", readKey)
  
  var program = await getProgram();
  await program.components.storage.removeItem(USERNAME_STORAGE_KEY)
  var fissionnames = await os.fissionUsernames(oldFullUsername.split("#")[0])
  var newhashedUsername = fissionnames.hashed;
  
  const valid = await program.auth.isUsernameValid(`${newhashedUsername}`)
  const available = await program.auth.isUsernameAvailable(`${newhashedUsername}`)
  console.log("username available", available)
  console.log("username valid", valid)
  
  if (valid && available) {
    await account.recover(kitText)
    
    const success = await program.fileSystem.recover({
      newUsername: newhashedUsername,
      oldUsername: oldHashedUsername,
      readKey
    })
    
    console.log("success: ", success);
    var session = await program.auth.session()
    await waitForDataRoot(newhashedUsername)
    console.log("session: ", session)
    
    const timeout = setTimeout(() => {
      clearTimeout(timeout)
      window.location.href = "/app";
    }, 5000)
  }
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

export { 
  account,
  validSession,
  signup, 
  signout, 
  generateRecoveryKit, 
  recover,
  updateProfile, 
  getContacts, 
  addContact, 
  editContact, 
  deleteContact, 
  filterContacts 
};
