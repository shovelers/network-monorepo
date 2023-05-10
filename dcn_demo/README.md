# dcn_demo
DID/VC contact app demo

Re-Build CSS
* after edit in ejs file, run the following command in shell
* ```tailwindcss build -i ./public/styles/tailwind.css -o ./public/styles/style.css --watch```

Clean DB
* Run the following commands in console after `cmd + c` 
* ```
  const Client = require("@replit/database");
  const db = new Client();

  await db.empty();
  ```