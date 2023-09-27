async function fetchAppleContacts(){
  const client = await createDAVClient({
    serverUrl: 'https://contacts.icloud.com',
    credentials: {
      username: 'me@sinisterlight.com',
      password: 'uygi-sabc-azlt-qiey',
    },
    authMethod: 'Basic',
    defaultAccountType: 'carddav',
  });

  const addressBooks = await client.fetchAddressBooks();
  console.log(addressBooks);

  const vcards = await client.fetchVCards({
    addressBook: addressBooks[0],
  });
  console.log(vcards);
};

export { fetchAppleContacts }