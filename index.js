const express = require('express')
const credentials = {}; //For future SSL Configuration.
const app = express(credentials);
app.use(express.json());

const uuid = require('uuid/v5');
const NAMESPACE = uuid('todo-api.shiftedhelix.com', uuid.URL);

const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

const AWS = require('aws-sdk');
AWS.config.update({region: 'us-west-2'});

const db = new AWS.DynamoDB.DocumentClient();
const TODO_TABLE = 'todo';
const USER_TABLE = 'user';

let buildUUID = (params) => {
    return uuid(params, NAMESPACE);
}

let buildResponse = (res, err, data) => {    
    let body = {};
    if(err){ body.success = false; body.error = err; }
    else{ body.success = true; body.data = data; }
    res.send(body);
    console.log("Return: " + JSON.stringify(body));
};

/**
 * Expects the following body, to create a new user:
 * {
 *  handle: <string>,
 *  password: <string>,
 *  email: <string>
 * }
 * 
 * Uses handle and email to generate a UUID.
 * Uses bcrypt to salt and hash the password for storage.
 */
app.post('/user', (req, res) => {
    let params = {
        TableName: USER_TABLE,
        Item: {
            Handle: req.body.handle,
            Email: req.body.email,
            Id: buildUUID({handle: req.body.handle, email: req.body.email}),
            Password: bcrypt.hashSync(req.body.password, SALT_ROUNDS)
        }
    };
    db.put(params, (err, data) => { buildResponse(res, err, data); });
});

/**
 * Expects the following body, to update an existing user:
 * {
 * [password: <string>,]
 * [email: <string>]
 * }
 * Both are treated as optional, but do not have to be optional. 
 */
app.put('/user/:id', (req, res) => {
    let params = {};
    params.TableName = USER_TABLE;
    params.Key = {'Id': req.params.id};

    let attrs = {};
    db.get(params, (err, data) => { 
        if(err) { buildResponse(res, err, data); }
        else {
            params.UpdateExpression = "set Password = :p, Email = :e";
            params.ExpressionAttributeValues = {
                ":p": req.body.hasOwnProperty('password') ? bcrypt.hashSync(req.body.password, SALT_ROUNDS) : data.Password,
                ":e": req.body.hasOwnProperty('email') ? req.body.email : data.Email
            };
            params.ReturnValues = "UPDATED_NEW";
            db.update(params, (err, data) => { buildResponse(res, err, data); });
        }
    });
});

/**
 * Does not expect a request body. Goes by the id in the URL.
 */
app.delete('/user/:id', (req, res) => {
    let params = {
        TableName: USER_TABLE,
        Key: {
            Id: req.params.id
        }
    };
    db.delete(params, (err, data) => { buildResponse(res, err, data); });
});

app.get('/user/all', (req, res) => {
    console.log("Fetching All User");
    let params = {};
    params.TableName = USER_TABLE;
    params.ProjectionExpression = "Id, Handle, Email, Password";

    console.log("Fetch Parameters: " + JSON.stringify(params));
    db.scan(params, (err, data) => { buildResponse(res, err, data); });
});
app.get('/user/:id', (req, res) => {
    console.log("Fetching User by Id [" + req.params.id + "]");
    let params = {};
    params.TableName = USER_TABLE;
    params.Key = {'Id': req.params.id};
    
    console.log("Fetch Parameters: " + JSON.stringify(params));
    db.get(params, (err, data) => { buildResponse(res, err, data); });
});
app.get('/item/all', (req, res) => {
    console.log("Fetching All Items");
    let params = {};
    params.TableName = TODO_TABLE;
    params.ProjectionExpression = "Id, Created, Done, #i, #u";
    params.ExpressionAttributeNames = {
        "#i": "Item",
        "#u": "User"
    };
    
    console.log("Fetch Parameters: " + JSON.stringify(params));
    db.scan(params, (err, data) => { buildResponse(res, err, data); });
});
app.get('/item/:id', (req, res) => {
    console.log("Fetching by id [" + req.params.id + "]");
    let params = {};
    params.TableName = TODO_TABLE;
    params.Key = {'Id': req.params.id};
    
    console.log("Fetch Parameters: " + JSON.stringify(params));
    db.get(params, (err, data) => { buildResponse(res, err, data); });
});

/**
 * Expects the following body, to create a new item:
 * {
 *  todo: <string>,
 *  user: <string>
 * }
 * 
 * Uses todo, user, and created date to generate a UUID.
 */
app.post('/item', (req, res) => {
    let created = new Date();
    let params = {
        TableName: TODO_TABLE,
        Item: {
            Todo: req.body.todo,
            User: req.body.user,
            Done: false,
            Created: created,
            Id: buildUUID({todo: req.body.todo, user: req.body.user, time: created})
        }
    };
    db.put(params, (err, data) => { buildResponse(res, err, data); });
});

/**
 * Expects the following body, to update an existing user:
 * {
 * [todo: <string>,]
 * [done: <string>]
 * }
 * Both are treated as optional, but do not have to be optional. 
 */
app.put('/item/:id', (req, res) => {
    let params = {};
    params.TableName = TODO_TABLE;
    params.Key = {'Id': req.params.id};

    let attrs = {};
    db.get(params, (err, data) => { 
        if(err) { buildResponse(res, err, data); }
        else {
            params.UpdateExpression = "set todo = :t, done = :d";
            params.ExpressionAttributeValues = {
                ":t": req.body.hasOwnProperty('todo') ? req.body.todo : data.Todo,
                ":d": req.body.hasOwnProperty('done') ? req.body.done : data.Done
            };
            params.ReturnValues = "UPDATED_NEW";
            db.update(params, (err, data) => { buildResponse(res, err, data); });
        }
    });
});

/**
 * Does not expect a request body. Goes by the id in the URL.
 */
app.delete('/item/:id', (req, res) => {
    let params = {
        TableName: TODO_TABLE,
        Key: {
            Id: req.params.id
        }
    };
    db.delete(params, (err, data) => { buildResponse(res, err, data); });
});


app.listen(3000);