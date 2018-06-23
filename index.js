const express = require('express')
const fs = require('fs');
const AWS = require('aws-sdk');
AWS.config.update({region: 'us-west-2'});

const db = new AWS.DynamoDB({apiVersion: '2012-10-08'});

const params = {
    TableName: "",
    Key: {
        'KEY_NAME': {S: 'id'}
    }
};

//var privateKey = fs.readFileSync('/opt/data/server.key');
//var certificate = fs.readFileSync('/opt/data/server.crt');

//var credentials = {key: privateKey, cert: certificate};
const credentials = {};

const app = express(credentials);

app.get('/', function(req, res) {
    db.listTables({Limit: 10}, function(err, data){
        if(err) {
            res.send(err);
        } else {
            res.send(data);
        }
    });
});

app.listen(3000);