const express = require('express')
const credentials = {};
const app = express(credentials);
app.use(express.json());

const uuid = require('uuid/v5');
const NAMESPACE = uuid('todo-api.shiftedhelix.com', uuid.URL);

const AWS = require('aws-sdk');
AWS.config.update({region: 'us-west-2'});

const db = new AWS.DynamoDB.DocumentClient();
const TODO_TABLE = 'todo';
const USER_TABLE = 'user';

app.get('/user/all', (req, res) => {
    const params = {
        TableName: USER_TABLE,
        ProjectionExpression: "Id, Handle, Email, Password"
    };
    db.scan(params, (err, data) => {
        if(err){ res.send({success: false, error: err}); }
        else{ res.send({success: true, data: data}); }
    });
});
app.get('/user/:id', (req, res) => {
    const params = {
        TableName: USER_TABLE,
        Key: {'Id': {S: req.params.id}}
    };
    db.get(params, (err, data) => {
        if(err){ res.send({success: false, error: err}); }
        else{ res.send({success: true, data: data}); }
    });
});
app.get('/item/all', (req, res) => {
    const params = {
        TableName: TODO_TABLE,
        ProjectionExpression: "Id, Done, Todo"
    };
    db.scan(params, (err, data) => {
        if(err){ res.send({success: false, error: err}); }
        else{ res.send({success: true, data: data}); }
    });
});
app.get('/item/:id', (req, res) => {
    console.log("Fetching by id [" + req.params.id + "]");
    const params = {
        TableName: TODO_TABLE,
        Key: {'Id': {S: req.params.id}}
    };
    db.get(params,(err, data) => {
        if(err) { res.send({success: false, error: err}); }
        else{ res.send({success: true, data: data}); }
    });
});

app.listen(3000);