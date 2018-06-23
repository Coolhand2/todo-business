const express = require('express')
const fs = require('fs');
const AWS = require('aws-sdk');
AWS.config.update({region: 'us-west-2'});

const db = new AWS.DynamoDB({apiVersion: '2012-10-08'});
const credentials = {};

const app = express(credentials);

const cb = (err, data) => {
    if(err) {
        return err;
    }
    return data;
}

app.get('/', (req, res) => {
    db.listTables({},(err, data) => {
        if(err) { res.send(err); }
        else{ res.send(data); }
    });
});
app.get('/item/:id', (req, res) => {
    const params = {
        TableName: 'todo_demo',
        Key: {'id': {N: params["id"]}}
    };
    db.getItem(params,(err, data) => {
        if(err) { res.send(err); }
        else{ res.send(data); }
    });
});

app.listen(3000);