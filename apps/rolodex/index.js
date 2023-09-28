import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createDAVClient } from 'tsdav';

const port = process.argv[2] || 3000;
const server = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

server.use(express.urlencoded({ extended: true }))
server.set('views', path.join(__dirname, 'views'));
server.set('view engine', 'ejs');
server.use(express.static(path.join(__dirname, 'public')))

server.get("/", (req, res) => {
  res.render('pages/index')
});

server.get("/home", (req, res) => {
  res.render('pages/index')
});

server.get("/app", (req, res) => {
  res.render('pages/app')
});

server.get("/link", (req, res) => {
  console.log(req.query.username)
  res.render('pages/link', { username: req.query.username })
});

server.get("/apple_contacts", async (req, res) => {
  const client = await createDAVClient({
    serverUrl: 'https://contacts.icloud.com',
    credentials: {
      username: req.query.username,
      password: req.query.password,
    },
    authMethod: 'Basic',
    defaultAccountType: 'carddav',
  });

  const addressBooks = await client.fetchAddressBooks();
  console.log(addressBooks);

  const vcards = await client.fetchVCards({
    addressBook: addressBooks[0],
  });
  
  res.status(200).json(vcards)
});

server.listen(port, (err) => {
  if (err) throw err;
  console.log(
    `> Ready on port ${port}`
  );
});
