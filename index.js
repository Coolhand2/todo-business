const express = require('express')
const fs = require('fs');

//var privateKey = fs.readFileSync('/opt/data/server.key');
//var certificate = fs.readFileSync('/opt/data/server.crt');

//var credentials = {key: privateKey, cert: certificate};
const credentials = {};

const app = express.createServer(credentials);

app.get('/', function(req, res) {

    res.send('Hello, World!?!');
});

app.listen(443);