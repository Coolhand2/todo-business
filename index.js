const express = require('express')
const credentials = {}; //For future SSL Configuration.
const cors = require('cors');
const app = express(credentials);

/** Convert incoming request bodies to correct JSON format */
app.use(express.json());

/** Pass in CORS middleware to allow the frontend to communicate. */
app.use(cors());

const uuid = require('uuid/v5');
const NAMESPACE = uuid('todo-api.shiftedhelix.com', uuid.URL);

const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-west-2' });

const db = new AWS.DynamoDB.DocumentClient();
const TODO_TABLE = 'todo';
const USER_TABLE = 'user';

/**
 * Performs a scan on dynamodb given the parameters
 * @param {JSON} params specified to perform a correct scan on DynamoDB.
 * @param {CALLBACK} callback Function to handle the return result of the scan.
 */
let scan = (params, callback) => {
    console.log("Performing database scan: " + JSON.stringify(params));
    db.scan(params, callback);
}

/**
 * Gets a single item from dynamodb, given the parameters.
 * @param {JSON} params Specified to perform a correct get on DynamoDB.
 * @param {CALLBACK} callback Function to handle the return result of the get
 */
let get = (params, callback) => {
    console.log("Performing database fetch: " + JSON.stringify(params));
    db.get(params, callback);
}

/**
 * Inserts information into dynamodb, from given parameters.
 * @param {JSON} params Parameters at DynamoDB specification to correctly insert into DynamoDB
 * @param {CALLBACK} callback Function to handle the results of the insert.
 */
let put = (params, callback) => {
    console.log("Performing database insert: " + JSON.stringify(params));
    db.put(params, callback);
}

/**
 * Updates information in DynamoDB, from given parameters.
 * @param {JSON} params Parameters that form to DynamoDB specification to correctly update information in DynamoDB.
 * @param {CALLBACK} callback Function to handle the results of the update.
 */
let update = (params, callback) => {
    console.log("Performing database update: " + JSON.stringify(params));
    db.update(params, callback);
}

/**
 * Deletes information in DynamoDB, from given parameters.
 * @param {JSON} params Parameters that form to DynamoDB specification to correctly delete information in DynamoDB.
 * @param {CALLBACK} callback Function to handle the results of the delete.
 */
let remove = (params, callback) => {
    console.log("Performing database delete: " + JSON.stringify(params));
    db.delete(params, callback);
}

/**
 * Generates a UUIDv5 string.
 * @param {JSON} params Parameters to create a Universally Unique ID
 */
let buildUUID = (params) => {
    return uuid(params, NAMESPACE);
}

/**
 * Builds a response to send back.
 * @param {http.response} res The response object we'll communicate with.
 * @param {json} err If this exists, then something went wrong and the "success" flag will be false. Otherwise the "success" flag will be true.
 * @param {json} data This will contain either pertinent data, or the error from the call being made.
 */
let buildResponse = (res, err, data) => {
    let body = {};
    if (err) { body.success = false; body.error = err; }
    else { body.success = true; body.data = data; }
    res.send(body);
    console.log("Return: " + JSON.stringify(body));
};

/**
 * Builds a JSON Web Token for a user. It'll expire in 7 days, and have a UUID of it's own.
 * @param {string} id User id number to build a JWT for.
 */
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
 * 
 * Expects the following body 
 * {
 *  jwt: <string>
 * }
 *
 * Returns the following data, if successful:
 *  { success: true, data: {<user information>} }
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
 * Actively creates a new JWT upon successful login.
 * 
 * Expects the following body to login a user:
 * {
 *  handle: <string>,
 *  password: <string>
 * }
 * 
 * REturns the following on success:
 * { success: true, data: { jwt: <json web token>} }
 * 
 * For more info on JWTs, please lookup jwt.io
 * This function references the "buildJWT" function above.
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
 * Actively logs out a user to destroy their session.
 * 
 * Expects the following body, to logout a user:
 * {
 *  jwt: <string>
 * }
 * 
 * On success returns the following data:
 * { success: true, {}} <- Empty data body. Just the success flag.
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
            }, buildResponse(res, null, {}));
        }
    });
});

/**
 * Creates a new user in the system.
 * 
 * Expects the following body:
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
    let hash = bcrypt.hashSync(req.body.password, SALT_ROUNDS);
    put({
        TableName: USER_TABLE,
        Item: {
            Id: id,
            Handle: req.body.handle,
            Email: req.body.email,
            Password: hash,
            Jwt: jwt
        }
    }, (error, response) => {
        buildResponse(res, error, response);
    });
});

/**
 * Updates an existing user (via their profile page, if it were to exist)
 * 
 * Expects the following body:
 * {
 * [password: <string>,]
 * [email: <string>]
 * }
 * Both are treated as optional, but do not have to be optional.
 * Updating of handle, id, or jwt are not allowed.
 * 
 * Returns on success:
 * {success: true, data:{}}
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
 * Deletes a user. Probably to be changed? I'd rather "disable" a user or something.
 * 
 * Expects the following body:
 * {
 *  id: <string>
 * }
 * 
 * Returns on success:
 * {success: true, data: {}}
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

/**
 * Gets all users
 * Does not expect JSON body with request.
 * 
 * Returns on success:
 * {success: true, data:{list of all user data}}
 */
app.get('/user/all', (req, res) => {
    console.log("Fetching All Users");
    scan({
        TableName: USER_TABLE,
        ProjectionExpression: "Id, Handle, Email, Password, Jwt"
    }, (err, data) => { buildResponse(res, err, data); });
});

/**
 * Gets a user by their ID
 * Does not expect JSON body with request.
 * 
 * Returns on success:
 * {success: true, data:{list of single user data}}
 */
app.get('/user/:id', (req, res) => {
    console.log("Getting user: [" + req.params.id + "]");
    get({
        TableName: USER_TABLE,
        Key: { 'Id': req.params.id }
    }, (err, data) => { buildResponse(res, err, data); });
});

/**
 * Gets all the items in the database.
 * Does not expect JSON body  with request.
 * 
 * Returns on success:
 * {success: true, data: {list of all item data}}
 */
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

/**
 * Gets item details via given id.
 * Does not expect JSON body with request.
 * 
 * Returns on success:
 * { success: true, data: {list of item details}}
 */
app.get('/item/:id', (req, res) => {
    console.log("Getting item: [" + req.params.id + "]");
    get({
        TableName: TODO_TABLE,
        Key: { "Id": req.params.id }
    }, (err, data) => { buildResponse(res, err, data); });
});

/**
 * Creates a new item.
 * 
 * Expects the following body, to create a new item:
 * {
 *  todo: <string>,
 *  user: <string>
 * }
 * 
 * Returns the following on success:
 * {
 *  success: true, 
 *  data: {information on item}
 * }
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
 * Updates an existing item.
 * 
 * Expects the following body
 * {
 * [todo: <string>,]
 * [done: <string>]
 * }
 * 
 * Both are treated as optional, but do not have to be optional. 
 * 
 * Returns the following on success:
 * {success: true, data{<data about updated item}}
 */
app.put('/item/:id', (req, res) => {
    console.log("Updating item: [" + req.params.id + "]");
    let params = {
        TableName: TODO_TABLE,
        Key: { "Id": req.params.id }
    };
    get(params, (err, data) => {
        console.log("Action Performed! {error: " + err + ", data: " + data +"}");
        if (err) { buildResponse(res, err, data); }
        else {
            console.log("Body in update: " + JSON.stringify(req.body));
            if(req.body.hasOwnProperty('todo')) {
                console.log("It has a todo property!");
                params.UpdateExpression = "set todo = :t";
                params.ExpressionAttributeValues = {":t": req.body.todo};
            } else if(req.body.hasOwnProperty('done')) {
                console.log("It has a done property!");
                params.UpdateExpression = "set done = :d";
                params.ExpressionAttributeValues = {":d": req.body.done};
            }
            params.ReturnValues = "UPDATED_NEW";
            update(params, (err, data) => { buildResponse(res, err, data); });
        }
    });
});

/**
 * Deletes an item by id. Probably will remove all together, in favor of "hidden" flag.
 * 
 * Expects the following body:
 * {
 *  id: <string>
 * }
 */
app.delete('/item', (req, res) => {
    console.log("Deleting item: [" + req.body.id + "]");
    remove({
        TableName: TODO_TABLE,
        Key: { 'Id': req.body.id }
    }, (err, data) => { buildResponse(res, err, data); });
});


app.listen(3000);