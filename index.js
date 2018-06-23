const express = require('express')
const fs = require('fs');
const AWS = require('aws-sdk');
AWS.config.update({region: 'us-west-2'});

const db = new AWS.DynamoDB({apiVersion: '2012-10-08'});
const credentials = {};

const app = express(credentials);

app.get('/', function(req, res) {
    const params = {
        TableName: 'todo_demo',
        Key: {'id': {N: '0'}}
    };
    db.getItem(params, function(err, data){
        if(err) {
            res.send(err);
        } else {
            res.send(data);
        }
    });
});

app.listen(3000);