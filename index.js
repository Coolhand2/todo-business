const express = require('express')
const credentials = {}; //For future SSL Configuration.
const app = express(credentials);
app.use(express.json());

const uuid = require('uuid/v5');
const NAMESPACE = uuid('todo-api.shiftedhelix.com', uuid.URL);

const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-west-2' });

const db = new AWS.DynamoDB.DocumentClient();
const TODO_TABLE = 'todo';
const USER_TABLE = 'user';

let scan = (params, callback) => {
    console.log("Performing database scan: " + JSON.stringify(params));
    db.scan(params, callback);
}

let get = (params, callback) => {
    console.log("Performing database fetch: " + JSON.stringify(params));
    db.get(params, callback);
}

let put = (params, callback) => {
    console.log("Performing database insert: " + JSON.stringify(params));
    db.put(params, callback);
}

let update = (params, callback) => {
    console.log("Performing database update: " + JSON.stringify(params));
    db.update(params, callback);
}

let remove = (params, callback) => {
    console.log("Performing database delete: " + JSON.stringify(params));
    db.delete(params, callback);
}

let buildUUID = (params) => {
    return uuid(params, NAMESPACE);
}

let buildResponse = (res, err, data) => {
    let body = {};
    if (err) { body.success = false; body.error = err; }
    else { body.success = true; body.data = data; }
    res.send(body);
    console.log("Return: " + JSON.stringify(body));
};

let buildJWT = (id) => {
    let params = {};
    let date = new Date();
    params.iat = date.getDate();
    params.exp = date.getDate() + 7;
    params.sub = id;
    params.iss = NAMESPACE;
    params.jti = buildUUID(params);
    let header = { "alg": "HS512", "typ": "JWT" };
    let encodedHeader = base64encode(header);
    let encodedData = base64encode(params);
    let encodedSecret = base64encode("ThisIsAHorribleWayToKeepSecretsYall");
    let signature = HMACSHA512(encodedHeader + '.' + encodedData, encodedSecret);
    return encodedHeader + "." + encodedData + "." + signature;
};

/**
 * Passively checks a users JWT to ensure they're logged in
 * Expects the following body 
 * {
 *  jwt: <string>
 * }
 */
app.post('/passive', (req, res) => {
    console.log("Passively checking user login: [" + req.body.jwt + "]")
    scan({
        TableName: USER_TABLE,
        IndexName: "JwtIndex",
        KeyConditionExpression: "Jwt = :j",
        ExpressionAttributeValues: { ":j": req.body.jwt }
    }, (error, user) => {
        if (error) {
            buildResponse(res, error, user);
        } else {
            buildResponse(res, error, user);
        }
    });
});

/**
 * Expects the following body to login a user:
 * {
 *  handle: <string>,
 *  password: <string>
 * }
 */
app.post('/login', (req, res) => {
    console.log("Logging in user: [" + req.body.handle + "]")
    scan({
        TableName: USER_TABLE,
        IndexName: "HandleIndex",
        KeyConditionExpression: "Handle = :h",
        ExpressionAttributeValues: { ":h": req.body.handle }
    }, (scanError, user) => {
        if (scanError) {
            buildResponse(res, scanError, user);
        }
        bcrypt.compare(req.body.password, user.password, (hashError, hashResponse) => {
            if (hashError) {
                buildResponse(res, hashError, hashResponse);
            } else {
                let jwt = buildJWT(user.Id);
                update({
                    TableName: USER_TABLE,
                    Key: user.Id,
                    UpdateExpression: "set jwt = :j",
                    ExpressionAttributeValues: { ":j": jwt },
                    ReturnValues: "UPDATED_NEW"
                }, buildResponse(res, null, { "jwt": jwt }));
            }
        });
    });
});

/**
 * Expects the following body, to logout a user:
 * {
 *  jwt: <string>
 * }
 */
app.post('/logout', (req, res) => {
    console.log("Logging out user: [" + req.body.jwt + "]");
    scan({
        TableName: USER_TABLE,
        IndexName: "JwtIndex",
        KeyConditionExpression: "Jwt = :j",
        ExpressionAttributeValues: { ":j": req.body.jwt }
    }, (error, user) => {
        if (error) {
            buildResponse(res, error, user);
        } else {
            update({
                TableName: USER_TABLE,
                Key: user.Id,
                UpdateExpression: "set jwt = :j",
                ExpressionAttributeValues: { ":j": {} },
                ReturnValues: "UPDATED_NEW"
            }, buildResponse(res, null, { "jwt": jwt }));
        }
    });
});

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
app.post('/register', (req, res) => {
    console.log("Registering new user: ["+ req.body.handle +"]");
    let id = buildUUID({handle: req.body.handle, email: req.body.email});
    let jwt = buildJWT(id);
    put({
        TableName: USER_TABLE,
        Item: {
            Handle: req.body.handle,
            Email: req.body.email,
            Id: id,
            Password: bcrypt.hashSync(req.body.password, SALT_ROUNDS),
            Jwt: jwt
        }
    }, (error, response) => {
        buildResponse(res, error, response);
    });
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
    console.log("Updating user: ["+ req.params.id +"]");
    let params = {};
    params.TableName = USER_TABLE;
    params.Key = { 'Id': req.params.id };

    let attrs = {};
    get(params, (err, data) => {
        if (err) { buildResponse(res, err, data); }
        else {
            params.UpdateExpression = "set Password = :p, Email = :e";
            params.ExpressionAttributeValues = {
                ":p": req.body.hasOwnProperty('password') ? bcrypt.hashSync(req.body.password, SALT_ROUNDS) : data.Password,
                ":e": req.body.hasOwnProperty('email') ? req.body.email : data.Email
            };
            params.ReturnValues = "UPDATED_NEW";
            update(params, (err, data) => { buildResponse(res, err, data); });
        }
    });
});

/**
 * Expects the following body:
 * {
 *  id: <string>
 * }
 */
app.delete('/user', (req, res) => {
    console.log("Deleting user: ["+ req.body.id +"]");
    remove({
        TableName: USER_TABLE,
        Key: {
            Id: req.body.id
        }
    }, (err, data) => { buildResponse(res, err, data); });
});

app.get('/user/all', (req, res) => {
    console.log("Fetching All Users");
    scan({
        TableName: USER_TABLE,
        ProjectionExpression: "Id, Handle, Email, Password, Jwt"
    }, (err, data) => { buildResponse(res, err, data); });
});
app.get('/user/:id', (req, res) => {
    console.log("Getting user: [" + req.params.id + "]");
    get({
        TableName: USER_TABLE,
        Key: { 'Id': req.params.id }
    }, (err, data) => { buildResponse(res, err, data); });
});
app.get('/item/all', (req, res) => {
    console.log("Fetching All Items");
    scan({
        TableName: TODO_TABLE,
        ProjectionExpression: "Id, Created, Done, #i, #u",
        ExpressionAttributeNames: {
            "#i": "Item",
            "#u": "User"
        }
    }, (err, data) => { buildResponse(res, err, data); });
});
app.get('/item/:id', (req, res) => {
    console.log("Getting item: [" + req.params.id + "]");
    get({
        TableName: TODO_TABLE,
        Key: { "Id": req.params.id }
    }, (err, data) => { buildResponse(res, err, data); });
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
    console.log("Creating item: [" + req.body.todo + ", " + req.body.user + "]");
    let created = new Date();
    let id = buildUUID({todo: req.body.todo, user: req.body.user, time: created});
    put({
        TableName: TODO_TABLE,
        Item: {
            Todo: req.body.todo,
            User: req.body.user,
            Done: false,
            Created: created,
            Id: id
        }
    }, (err, data) => { buildResponse(res, err, data); });
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
    console.log("Updating item: [" + req.params.id + "]");
    let params = {
        TableName: TODO_TABLE,
        Key: {'Id': req.params.id}
    }
    get(params, (err, data) => {
        if (err) { buildResponse(res, err, data); }
        else {
            params.UpdateExpression = "set todo = :t, done = :d";
            params.ExpressionAttributeValues = {
                ":t": req.body.hasOwnProperty('todo') ? req.body.todo : data.Todo,
                ":d": req.body.hasOwnProperty('done') ? req.body.done : data.Done
            };
            params.ReturnValues = "UPDATED_NEW";
            update(params, (err, data) => { buildResponse(res, err, data); });
        }
    });
});

/**
 * Expects the following body:
 * {
 *  id: <string>
 * }
 */
app.delete('/item/:id', (req, res) => {
    console.log("Deleting item: [" + req.body.id + "]");
    remove({
        TableName: TODO_TABLE,
        Key: { 'Id': req.body.id }
    }, (err, data) => { buildResponse(res, err, data); });
});


app.listen(3000);