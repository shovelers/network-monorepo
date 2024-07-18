import { Person } from "./person"

interface Contact {
  PRODID: string;
  UID: string;
  TEL: string[];
  EMAIL: string[];
  FN: string;
  CATEGORIES: string;
  URL: string;
  NOTE: string;
  XML: string;
  archived?: boolean;
}

interface ContactList {
  [key: string]: Contact;
}

interface ContactsFile {
  contactList: ContactList;
}

//TODO: make contacts.json a CRDT


export class PeopleRepository {
  private agent: any;
  private filename: string = "contacts.json";
  private cache: any;

  constructor(agent: any) {
    this.agent = agent
    this.cache = {}
  }

  async initialise(): Promise<void> {
    const exists = await this.agent.fileExists(this.filename)
    if (!exists) {
      await this.agent.updatePrivateFile(this.filename, () => { return { contactList: {}} })
    }
  }

  async list(): Promise<Person[]> {
    if (!(this.cache.people)) {
      this.cache.people = await this.match((c: Contact) => { return true })
    }

    return this.cache.people
  }

  async match(matcher: (contact: Contact) => boolean): Promise<Person[]> {
    const contacts: ContactsFile = await this.agent.readPrivateFile(this.filename);
    const people: Person[] = [];

    for (const [_, contact] of Object.entries(contacts.contactList)) {
      if (contact.archived) { continue }
      if (matcher(contact) != true) { continue }

      people.push(new Person(contact));
    }

    return people;
  }

  async find(uid: string): Promise<Person | undefined> {
    const people = await this.list()
    const person = people.find((p) => { return p.UID == uid })
    return person
  }

  async create(person: Person): Promise<void> {
    await this.agent.updatePrivateFile(this.filename, (content: ContactsFile) => {
      content.contactList[person.UID] = person.asJSON();
      return content;
    });
    this.cache.people = undefined
  }

  async bulkCreate(contacts: Person[]): Promise<void> {
    await this.agent.updatePrivateFile(this.filename, (content: ContactsFile) => {
      contacts.forEach((element) => {
        content.contactList[element.UID] = element.asJSON();
      });
      return content;
    });
    this.cache.people = undefined
  }

  async edit(personData: Person): Promise<void> {
    await this.agent.updatePrivateFile(this.filename, (content: ContactsFile) => {
      content.contactList[personData.UID] = personData.asJSON();
      return content;
    });
    this.cache.people = undefined
  }

  async delete(UID: string): Promise<void> {
    await this.agent.updatePrivateFile(this.filename, (content: ContactsFile) => {
      content.contactList[UID].archived = true;
      console.log("archived contact", content.contactList[UID]);
      return content;
    });
    this.cache.people = undefined
  }
}