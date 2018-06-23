const express = require('express')
const credentials = {};
const app = express(credentials);
app.use(express.json());

const uuid = require('uuid/v5');
const NAMESPACE = uuid('todo-api.shiftedhelix.com', uuid.URL);

const AWS = require('aws-sdk');
AWS.config.update({region: 'us-west-2'});

const db = new AWS.DynamoDB.DocumentClient();
const TODO_TABLE = 'todo_demo';

app.get('/item', (req, res) => {
    const params = {
        TableName: TODO_TABLE,
        ProjectionExpression: "id, done, todo"
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
        Key: {'id': {S: req.params.id}}
    };
    db.get(params,(err, data) => {
        if(err) { res.send({success: false, error: err}); }
        else{ res.send({success: true, data: data}); }
    });
});
app.put('/item', (req, res) => {
    const newId = uuid(req.body, NAMESPACE);
    const params = {
        TableName: TODO_TABLE, 
        Item: {
            id: newId,
            done: {BOOL: req.body.done},
            todo: {S: req.body.todo}
        }
    };
    db.put(params, (err, data) => {
        if(err) { res.send({success: false, error: err}); }
        else{ res.send({success: true, data: newId}); }
    });
});
app.post('/item/:id', (req, res) => {
    const params = {
        TableName: TODO_TABLE,
        Key: {
            id: {N: req.body.id},
        },
        UpdateExpression: 'set done = :d, todo = :t',
        ExpressionValues: {
            ':d': req.body.done,
            ':t': req.body.todo
        },
        ReturnValues: "UPDATED_NEW"
    };
    db.update(params, (err, data) => {
        if(err){ res.send({success: false, error: err}); }
        else{ res.send({success: true}); }
    });
});
app.delete('/item/:id', (req, res) => {
    const params = {
        TableName: TODO_TABLE,
        Key: {
            "id": req.body.id
        }
    };
    db.delete(params, (err, data) => {
        if(err){ res.send({success: false, error: err}); }
        else{ res.send({success: true, data: data}); }
    });
});


app.listen(3000);