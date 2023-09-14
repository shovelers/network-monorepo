async function signup(odd) {
  const program = await odd.program({
    // `namespace` can also be just a string; it's used as an identifier for caches.
    // If you're developing multiple apps on the same localhost port,
    // make sure these differ.
    namespace: { creator: "Nullsoft", name: "Winamp" }
  }).catch(error => {
    switch (error) {
      case odd.ProgramError.InsecureContext:

        // ODD requires HTTPS
        break;
      case odd.ProgramError.UnsupportedBrowser:
        // Browsers must support IndexedDB
        break;
    }

  })
  console.log("program", program)

  let session
  if (program.session) {
    session = program.session
    await session.destroy()
  }
  console.log("I am here")
  const username = document.getElementById('handle').value
  const valid = program.auth.isUsernameValid(username)
  const available = await program.auth.isUsernameAvailable(username)
  console.log("username available", available)

  if (valid && available) {
    // Register the user
    const { success } = await program.auth.register({ username: username })

    // Create a session on success
    session = success ? program.auth.session() : null
  }
  console.log("session", await session)
}

export { signup };
