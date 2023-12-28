import _ from 'lodash';
import { ContactTable } from "./contact_table";
import { Contact, ContactRepository } from "./contacts.js";
import { Membership, Directory, DirectoryPOJO, DirectoryReposistory } from "./directory.js";
import { Account , os  } from 'account-session';
import { createBrowserNode, AccountFS } from 'account-fs'

const SHOVEL_FS_SYNC_HOST = import.meta.env.VITE_SHOVEL_FS_SYNC_HOST || "http://localhost:3000"
const NETWORK = import.meta.env.VITE_NETWORK || "DEVNET"

const helia = await createBrowserNode()

let program = await os.getProgram()
const accountfs = new AccountFS(helia, program.components.storage, NETWORK, SHOVEL_FS_SYNC_HOST)
await accountfs.load()

window.shovel = {
  helia: helia,
  fs: accountfs,
  odd: program
}

const contactRepo = new ContactRepository(accountfs)
const account = new Account(os, accountfs)
const directory = new Directory(accountfs, "test")
const directoryRepo =  new DirectoryReposistory(accountfs)

customElements.define('contact-table', ContactTable);

async function validSession() {
  let session = await os.getSession()
  return (session !== undefined)
}

async function signup(username) {
  await account.create(username, [
      {name: "directories.json", initialData: { directoryList: {} }}
    ]
  );

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

async function createDirectory(name) {
  return await directoryRepo.create(new DirectoryPOJO({name: name}))
}

async function getDirectories() {
  return await directoryRepo.list()
}

async function addMembership() {
  //get self profileCid and access key
  let membership = new Membership()
  return await directory.create(membership)
}

async function getMemberships() {
  return await directory.list()
}

async function shareDirectory() {
  return directory.share()
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
  await account.recover(kitText)
  const timeout = setTimeout(() => {
    clearTimeout(timeout)
    window.location.href = "/app";
  }, 5000)
}

export { 
  account,
  validSession,
  signup, 
  signout, 
  generateRecoveryKit, 
  recover,
  updateProfile,
  createDirectory, 
  getDirectories,
  getContacts, 
  addContact, 
  editContact, 
  deleteContact, 
  filterContacts,
  addMembership,
  getMemberships,
  shareDirectory 
};
