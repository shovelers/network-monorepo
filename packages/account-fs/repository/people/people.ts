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
  constructor(agent: any) {
    this.agent = agent
  }

  async list(): Promise<Person[]> {
    const contacts: ContactsFile = await this.agent.readPrivateFile(this.filename);
    const people: Person[] = [];

    for (const [_, contact] of Object.entries(contacts.contactList)) {
      if (contact.archived) {
        continue;
      }

      people.push(
        new Person({
          PRODID: contact.PRODID,
          UID: contact.UID,
          TEL: contact.TEL,
          EMAIL: contact.EMAIL,
          FN: contact.FN,
          //TODO: remove below fields from search results, when searched from other apps
          CATEGORIES: contact.CATEGORIES,
          URL: contact.URL,
          NOTE: contact.NOTE,
          XML: contact.XML,
        })
      );
    }

    return people;
  }

  async find(uid: string): Promise<Person> {
    const contacts: ContactsFile = await this.agent.readPrivateFile(this.filename);
    const contact: Contact = contacts.contactList[uid];

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
      XML: contact.XML,
    });
  }

  async filter(){}

  async create(person: Person): Promise<void> {
    await this.agent.updatePrivateFile(this.filename, (content: ContactsFile) => {
      content.contactList[person.UID] = person.asJSON();
      return content;
    });
  }
  

  async bulkCreate(contacts: Person[]): Promise<void> {
    await this.agent.updatePrivateFile(this.filename, (content: ContactsFile) => {
      contacts.forEach((element) => {
        content.contactList[element.UID] = element.asJSON();
      });
      return content;
    });
  }

  async edit(personData: Person): Promise<void> {
    await this.agent.updatePrivateFile(this.filename, (content: ContactsFile) => {
      content.contactList[personData.UID] = personData.asJSON();
      return content;
    });
  }

  async delete(UID: string): Promise<void> {
    await this.agent.updatePrivateFile(this.filename, (content: ContactsFile) => {
      content.contactList[UID].archived = true;
      console.log("archived contact", content.contactList[UID]);
      return content;
    });
  }
}