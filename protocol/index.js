const express = require("express");

const path = require("path");
const port = 4000;

const server = express();

server.use(express.urlencoded({ extended: true }));
server.set('views', path.join(__dirname, 'views'));
server.set('view engine', 'ejs');
server.use(express.static(path.join(__dirname, 'public')));

server.get("/", (req, res) => {
  res.render('pages/index')
});

server.listen(port, (err) => {
  if (err) throw err;
  console.log(
    `> Ready`
  );
});