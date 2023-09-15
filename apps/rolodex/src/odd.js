async function signup(odd) {
  const appInfo = { creator: "Shovel", name: "Rolod" }
  const program = await odd.program({namespace: appInfo})
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
  console.log(program)

  //create session
  let session
  if (program.session) {
    session = program.session
    //await session.destroy()
  }
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
  const profileData = JSON.stringify({"handle": username})

  const { RootBranch } = odd.path
  const privateDirectoryPath = odd.path.directory("private", "profile")
  const privateFilePath = odd.path.file(RootBranch.Private, "profile", "profile.json")

  await fs.write(privateFilePath,new TextEncoder().encode(profileData))
  await fs.publish()

  const content = new TextDecoder().decode(await fs.read(privateFilePath))
  console.log("profile data :", content)

}

export { signup };
