import * as odd from '@oddjs/odd'

async function signup() {
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
}

export { signup };
