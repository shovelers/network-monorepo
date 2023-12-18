class Contact {
  constructor() {}
}

export class ContactRepository {
  constructor(os) {
    this.store = os
    this.filename = "contacts.json"
  }

  async list(){
    return this.store.readPrivateFile(this.filename)
  }

  async filter(){}

  async create(){}

  async edit(){}

  async delete(){}
}