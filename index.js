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
    console.log("Fetching All User");
    let params = {};
    params.TableName = USER_TABLE;
    params.ProjectionExpression = "Id, Handle, Email, Password";

    console.log("Fetch Parameters: " + JSON.stringify(params));
    db.scan(params, (err, data) => {
        if(err){ res.send({success: false, error: err}); }
        else{ res.send({success: true, data: data}); }
    });
});
app.get('/user/:id', (req, res) => {
    console.log("Fetching User by Id [" + req.params.id + "]");
    let params = {};
    params.TableName = USER_TABLE;
    params.Key = {'Id': req.params.id}
    
    console.log("Fetch Parameters: " + JSON.stringify(params));
    db.get(params, (err, data) => {
        if(err){ res.send({success: false, error: err}); }
        else{ res.send({success: true, data: data}); }
    });
});
app.get('/item/all', (req, res) => {
    let params = {};
    params.TableName = TODO_TABLE;
    params.ProjectionExpression = "Id, Created, Done, Item, User";
    
    console.log("Fetch Parameters: " + JSON.stringify(params));
    db.scan(params, (err, data) => {
        if(err){ res.send({success: false, error: err}); }
        else{ res.send({success: true, data: data}); }
    });
});
app.get('/item/:id', (req, res) => {
    console.log("Fetching by id [" + req.params.id + "]");
    let params = {};
    params.TableName = TODO_TABLE;
    params.Key = {'Id': req.params.id};
    
    console.log("Fetch Parameters: " + JSON.stringify(params));
    db.get(params,(err, data) => {
        if(err) { res.send({success: false, error: err}); }
        else{ res.send({success: true, data: data}); }
    });
});

app.listen(3000);