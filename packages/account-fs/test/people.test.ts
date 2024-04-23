import { assert } from 'chai';

import sinon from 'sinon';
import { PeopleRepository }  from '../repository/people/people';
import { Person } from '../repository/people/person';

describe('PeopleRepository', function() {
  let repo;
  let mockAgent;

  beforeEach(function() {
    mockAgent = {
      readPrivateFile: sinon.stub(),
      updatePrivateFile: sinon.stub(),
    };
    repo = new PeopleRepository(mockAgent);
  });

  
  
  describe('list()', function() {
    it('returns an array of Person objects', async function() {
      mockAgent.readPrivateFile.resolves({
        contactList: {
          '1': { UID: '1', FN: 'John Doe', archived: false },
          '2': { UID: '2', FN: 'Jane Doe', archived: false },
        },
      });
      const result = await repo.list();
      assert.strictEqual(result.length, 2);
      result.forEach(person => assert(person instanceof Person));
    });

    it('filters out archived contacts', async function() {
      mockAgent.readPrivateFile.resolves({
        contactList: {
          '1': { UID: '1', FN: 'John Doe', archived: false },
          '2': { UID: '2', FN: 'Jane Doe', archived: true },
        },
      });
      const result = await repo.list();
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].UID, '1');
    });

    it('handles an empty contact list', async function() {
      mockAgent.readPrivateFile.resolves({ contactList: {} });
      const result = await repo.list();
      assert.strictEqual(result.length, 0);
    });
  });

  describe('find()', function() {
    it('returns the correct Person object for a given UID', async function() {
      const expectedContact = {
        UID: '1',
        FN: 'John Doe',
        EMAIL: ['john@example.com'],
        TEL: ['+1234567890'],
        PRODID: '',
      };
  
      mockAgent.readPrivateFile.resolves({
        contactList: {
          '1': expectedContact,
          '2': {
            UID: '2',
            FN: 'Jane Doe',
          },
        },
      });
  
      const result = await repo.find('1');
      assert.deepEqual(result, new Person(expectedContact));
    });

  });

  describe('create()', function() {
    const initialContactList = {
        '1': {
          UID: '1',
          FN: 'John Doe',
          EMAIL: ['john@doe.com'],
          TEL: ['+1234567890'],
          PRODID: ''
        },
        '2': {
          UID: '2',
          FN: 'Jane Doe',
          EMAIL: ['jane@doe.com'],
          TEL: ['+1234567890'],
          PRODID: ''
        },
      };

    it('adds a new contact to the contact list', async function() {
      const newContact = new Person({
        UID: '3',
        FN: 'New Contact',
        EMAIL: ['new@example.com'],
        TEL: ['+1234567890'],
        PRODID: ''
      });
  
      mockAgent.readPrivateFile.resolves({ contactList: initialContactList });
  
      let updatedContactList;
      mockAgent.updatePrivateFile.callsFake((fileName, updateFn) => {
        const content = { contactList: initialContactList };
        updatedContactList = updateFn(content).contactList;
      });
  
      await repo.create(newContact);
      assert.deepEqual(updatedContactList, {
        ...initialContactList,
        '3': newContact.asJSON(),
      });
    });
  

  it('overwrites an existing contact when creating with the same UID', async function() {
    const existingContact = new Person({
      UID: '1',
      FN: 'Existing Contact',
      EMAIL: ['existing@example.com'],
      TEL: ['+1234567890'],
      PRODID : ''
    });
    mockAgent.readPrivateFile.resolves({ contactList: initialContactList });

    let updatedContactList;
    mockAgent.updatePrivateFile.callsFake((fileName, updateFn) => {
      const content = { contactList: initialContactList };
      updatedContactList = updateFn(content).contactList;
    });

    await repo.create(existingContact);

    assert.deepEqual(updatedContactList, {
      ...initialContactList,
      '1': existingContact.asJSON(),
    });
  });


});

describe('bulkCreate()', function() {
    it('adds multiple contacts to the contact list', async function() {
      const newContacts = [
        new Person({
          UID: '3',
          FN: 'New Contact 1',
          EMAIL: ['new1@example.com'],
          TEL: ['+1234567890'],
          PRODID: ''
        }),
        new Person({
          UID: '4',
          FN: 'New Contact 2',
          EMAIL: ['new2@example.com'],
          TEL: ['+1234567891'],
          PRODID: ''
        }),
      ];
  
      const initialContactList = {
        '1': {
          UID: '1',
          FN: 'John Doe',
        },
        '2': {
          UID: '2',
          FN: 'Jane Doe',
        },
      };
  
      mockAgent.readPrivateFile.resolves({ contactList: initialContactList });
  
      let updatedContactList;
      mockAgent.updatePrivateFile.callsFake((fileName, updateFn) => {
        const content = { contactList: initialContactList };
        updatedContactList = updateFn(content).contactList;
      });
  
      await repo.bulkCreate(newContacts);
  
      assert.deepEqual(updatedContactList, {
        ...initialContactList,
        '3': newContacts[0].asJSON(),
        '4': newContacts[1].asJSON(),
      });
    });
  });

  describe('edit()', function() {
    it('updates an existing contact with the provided data', async function() {
      const updatedContact = new Person({
        UID: '1',
        FN: 'Updated Contact',
        EMAIL: ['updated@example.com'],
        TEL: ['+1234567890'],
        PRODID: ''
      });
  
      const initialContactList = {
        '1': {
          UID: '1',
          FN: 'John Doe',
          // ...
        },
        '2': {
          UID: '2',
          FN: 'Jane Doe',
          // ...
        },
      };
  
      mockAgent.readPrivateFile.resolves({ contactList: initialContactList });
  
      let updatedContactList;
      mockAgent.updatePrivateFile.callsFake((fileName, updateFn) => {
        const content = { contactList: initialContactList };
        updatedContactList = updateFn(content).contactList;
      });
  
      await repo.edit(updatedContact);
  
      assert.deepEqual(updatedContactList, {
        ...initialContactList,
        '1': updatedContact.asJSON(),
      });
    });
  });

  describe('delete()', function() {
    it('marks a contact as archived', async function() {
      const initialContactList = {
        '1': {
          UID: '1',
          FN: 'John Doe',
          archived: false,
        },
        '2': {
          UID: '2',
          FN: 'Jane Doe',
          archived: false,
        },
      };
      mockAgent.readPrivateFile.resolves({ contactList: initialContactList });
      let updatedContactList;
      mockAgent.updatePrivateFile.callsFake((fileName, updateFn) => {
        const content = { contactList: initialContactList };
        updatedContactList = updateFn(content).contactList;
      });
      await repo.delete('1');
      assert.isTrue(updatedContactList['1'].archived);
    });
  });
});


