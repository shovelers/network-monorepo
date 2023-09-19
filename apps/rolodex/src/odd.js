async function getProgram(odd) {
  const appInfo = { creator: "Shovel", name: "Rolod" }
  const program = await odd.program({ namespace: appInfo })
    .catch(error => {
      switch (error) {
        case odd.ProgramError.InsecureContext:
          // ODD requires HTTPS
          break;
        case odd.ProgramError.UnsupportedBrowser:
          // Browsers must support IndexedDB
          break;
      }
    })
  return program;
}

async function getSession(program) {
  let session
  if (program.session) {
    session = program.session
  }

  return session;
}

async function signup(odd, username) {
  var program = await getProgram(odd);
  var session = await getSession(program);
  const valid = await program.auth.isUsernameValid(username)
  const available = await program.auth.isUsernameAvailable(username)
  console.log("username available", available)

  if (valid && available) {
    console.log("registering ...", username)
    // Register the user
    const { success } = await program.auth.register({ username: username })
    console.log("success: ", success)
    // Create a session on success
    session = success ? await program.auth.session() : null
  }

  //create fs
  console.log("newly created session: ", session)
  const fs = session.fs
  console.log(fs)
  const profileData = JSON.stringify({ "handle": username, "name": "John Doe" })
  const contactData = JSON.stringify({ contactList: {} })

  const { RootBranch } = odd.path
  const profileFilePath = odd.path.file(RootBranch.Private, "profile.json")
  const contactFilePath = odd.path.file(RootBranch.Private, "contacts.json")

  await fs.write(profileFilePath, new TextEncoder().encode(profileData))
  await fs.write(contactFilePath, new TextEncoder().encode(contactData))
  await fs.publish()

  const content = new TextDecoder().decode(await fs.read(profileFilePath))
  console.log("profile data :", content)
}

async function getProfile(odd) {
  var program = await getProgram(odd);
  var session = await getSession(program);

  const fs = session.fs;
  const { RootBranch } = odd.path
  const privateFilePath = odd.path.file(RootBranch.Private, "profile.json")

  const content = new TextDecoder().decode(await fs.read(privateFilePath))
  return JSON.parse(content)
}

async function getContacts(odd) {
  var program = await getProgram(odd);
  var session = await getSession(program);
  const fs = session.fs;
  const { RootBranch } = odd.path
  const privateFilePath = odd.path.file(RootBranch.Private, "contacts.json")

  const content = new TextDecoder().decode(await fs.read(privateFilePath))
  return JSON.parse(content)
}

async function updateProfile(odd, name) {
  await updateFile(odd, "profile.json", (content) => {
    content.name = name
    return content
  })
}
async function addContact(odd, newContact) {
  await updateFile(odd, "contacts.json", (content) => {
    var id = crypto.randomUUID()
    content.contactList[id] = newContact
    return content
  })
}

async function editContact(odd, id, contact) {
  await updateFile(odd, "contacts.json", (content) => {
    var contactList = content.contactList
    contactList[id] = contact
    return content
  })
}

async function deleteContact(odd, id) {
  await updateFile(odd, "contacts.json", (content) => {
    delete content.contactList[id]
    console.log("delete", id)
    console.log("delete", content.contactList)
    return content
  })
}

async function updateFile(odd, file, mutationFunction) {
  var program = await getProgram(odd);
  var session = await getSession(program);

  const fs = session.fs;
  const { RootBranch } = odd.path
  const contactFilePath = odd.path.file(RootBranch.Private, file)

  const content = new TextDecoder().decode(await fs.read(contactFilePath))
  const newContent = mutationFunction(JSON.parse(content))

  await fs.write(contactFilePath, new TextEncoder().encode(JSON.stringify(newContent)))
  await fs.publish()

  const readContent = new TextDecoder().decode(await fs.read(contactFilePath))
  console.log("contacts :", readContent)
  return readContent;
}

async function signout(odd) {
  var program = await getProgram(odd);
  var session = await getSession(program);
  await session.destroy()
}

async function linkDeviceProducer(odd) {
  console.log("i am here")
  var program = await getProgram(odd);
  const producer = await program.auth.accountProducer(program.session.username)
  console.log("producer", producer)

  producer.on("challenge", challenge => {
    console.log("challenge: ", challenge)
    // Either show `challenge.pin` or have the user input a PIN and see if they're equal.
    if ("123456" === challenge.pin) challenge.confirmPin()
    else challenge.rejectPin()
  })

  producer.on("link", ({ approved }) => {
    if (approved) console.log("Link device successfully")
  })
}

async function linkDeviceConsumer(odd, username) {
  var program = await getProgram(odd);
  const consumer = await program.auth.accountConsumer(username)
  console.log("consumer", consumer)

  // The consumer generates a PIN and sends it to the producer
  consumer.on("challenge", ({ pin }) => {
    // Display the PIN
    showPinOnUI(pin)
  })

  // The consumer receives an approval or rejection message from the producer
  consumer.on("link", async ({ approved, username }) => {
    if (approved) {
      console.log(`Successfully authenticated as ${username}`)
      session = await program.auth.session()
    }
  })
}  

export { signup, getProfile, updateProfile, getContacts, addContact, editContact, deleteContact, signout, getSession, getProgram, linkDeviceProducer, linkDeviceConsumer};
