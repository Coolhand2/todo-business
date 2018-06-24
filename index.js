const express = require('express')
const credentials = {}; //For future SSL Configuration.
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
    console.log("Fetching All User");
    let params = {};
    params.TableName = USER_TABLE;
    params.ProjectionExpression = "Id, Handle, Email, Password";

    console.log("Fetch Parameters: " + JSON.stringify(params));
    let body = {};
    db.scan(params, (err, data) => {
        if(err){ body.success = false; body.error = err; }
        else{ body.success = true; body.data = data; }
    });
    console.log("Return: " + JSON.stringify(body));
    res.send(body);
});
app.get('/user/:id', (req, res) => {
    console.log("Fetching User by Id [" + req.params.id + "]");
    let params = {};
    params.TableName = USER_TABLE;
    params.Key = {'Id': req.params.id}
    
    console.log("Fetch Parameters: " + JSON.stringify(params));
    let body = {};
    db.scan(params, (err, data) => {
        if(err){ body.success = false; body.error = err; }
        else{ body.success = true; body.data = data; }
    });
    console.log("Return: " + JSON.stringify(body));
    res.send(body);
});
app.get('/item/all', (req, res) => {
    console.log("Fetching All Items");
    let params = {};
    params.TableName = TODO_TABLE;
    params.ProjectionExpression = "Id, Created, Done, #Item, User";
    
    console.log("Fetch Parameters: " + JSON.stringify(params));
    let body = {};
    db.scan(params, (err, data) => {
        if(err){ body.success = false; body.error = err; }
        else{ body.success = true; body.data = data; }
    });
    console.log("Return: " + JSON.stringify(body));
    res.send(body);
});
app.get('/item/:id', (req, res) => {
    console.log("Fetching by id [" + req.params.id + "]");
    let params = {};
    params.TableName = TODO_TABLE;
    params.Key = {'Id': req.params.id};
    
    console.log("Fetch Parameters: " + JSON.stringify(params));
    let body = {};
    db.scan(params, (err, data) => {
        if(err){ body.success = false; body.error = err; }
        else{ body.success = true; body.data = data; }
    });
    console.log("Return: " + JSON.stringify(body));
    res.send(body);
});

app.listen(3000);