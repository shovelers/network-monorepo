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

async function signup(odd) {
  var program = await getProgram(odd);
  var session = await getSession(program);
  const username = document.getElementById('handle').value
  const valid = program.auth.isUsernameValid(username)
  const available = await program.auth.isUsernameAvailable(username)
  console.log("username available", available)

  if (valid && available) {
    console.log("registering ...", username)
    // Register the user
    const { success } = await program.auth.register({ username: username })
    console.log("success: ", success)
    // Create a session on success
    session = success ? program.auth.session() : null
  }
  console.log("session", await session)

  //create fs
  const fs = session.fs
  console.log(fs)
  const profileData = JSON.stringify({ "handle": username })
  const contactData = JSON.stringify({ contactList: []})

  const { RootBranch } = odd.path
  const profileDirectoryPath = odd.path.directory("private", "profile")
  const profileFilePath = odd.path.file(RootBranch.Private, "profile", "profile.json")
  const contactDirectoryPath = odd.path.directory("private", "contacts")
  const contactFilePath = odd.path.file(RootBranch.Private, "contacts", "contacts.json")

  await fs.write(profileFilePath, new TextEncoder().encode(profileData))
  await fs.write(contactFilePath, new TextEncoder().encode(contactData))
  await fs.publish()

  const content = new TextDecoder().decode(await fs.read(profileFilePath))
  console.log("profile data :", content)
}

async function updateProfile(odd) {
  var program = await getProgram(odd);
  var session = await getSession(program);

  const fs = session.fs;
  const { RootBranch } = odd.path
  const privateDirectoryPath = odd.path.directory("private", "profile")
  const privateFilePath = odd.path.file(RootBranch.Private, "profile", "profile.json")

  var name = document.getElementById('name').value;
  const content = new TextDecoder().decode(await fs.read(privateFilePath))
  console.log("existing data :", JSON.parse(content))
  var profileData = JSON.parse(content)
  profileData.name = name

  await fs.write(privateFilePath, new TextEncoder().encode(JSON.stringify(profileData)))
  await fs.publish()

  const newContent = new TextDecoder().decode(await fs.read(privateFilePath))
  console.log("profile data :", newContent)
}

async function getProfile(odd) {
  var program = await getProgram(odd);
  var session = await getSession(program);

  const fs = session.fs;
  const { RootBranch } = odd.path
  const privateDirectoryPath = odd.path.directory("private", "profile")
  const privateFilePath = odd.path.file(RootBranch.Private, "profile", "profile.json")

  const content = new TextDecoder().decode(await fs.read(privateFilePath))
  return JSON.parse(content)
}

async function getContacts(odd) {
  var program = await getProgram(odd);
  var session = await getSession(program);
  const fs = session.fs;
  const { RootBranch } = odd.path
  const privateFilePath = odd.path.file(RootBranch.Private, "contacts", "contacts.json")

  const content = new TextDecoder().decode(await fs.read(privateFilePath))
  return JSON.parse(content)
}

async function addContact(odd) {
  var program = await getProgram(odd);
  var session = await getSession(program);

  const fs = session.fs;
  const { RootBranch } = odd.path
  const contactFilePath = odd.path.file(RootBranch.Private, "contacts", "contacts.json")

  var newContactHandle = document.getElementById('contacthandle').value;
  const content = new TextDecoder().decode(await fs.read(contactFilePath))
  var contactList = JSON.parse(content).contactList
  contactList.push(newContactHandle)
  var contactData = JSON.stringify({ contactList: contactList})

  await fs.write(contactFilePath, new TextEncoder().encode(contactData))
  await fs.publish()

  const newContent = new TextDecoder().decode(await fs.read(contactFilePath))
  console.log("contacts :", newContent)
}
export { signup, getProfile, updateProfile, getContacts, addContact };
