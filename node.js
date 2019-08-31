const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const http = require('http');
const https = require('https');

const modeltracker = require('./modeltracker.js');

const ObjectId = require('mongodb').ObjectID;

var app = express();

var trackers = {};

var mongodb_host = "mongodb://localhost:32768";

let resp_error = (resp, reason, moredata={}) => {
    let data = {
        "status":"error",
        "reason":reason
    };

    data = Object.assign(data, moredata);

    resp.send(JSON.stringify(data))
};

let resp_msg = (resp, reason, moredata={}) => {
    let data = {
        "status" : "ok",
        "reason" : reason
    };

    data = Object.assign(data, moredata);

    resp.send(JSON.stringify(data));
}

app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());

app.post('/api/newgame', (req, res) => {
    // 파라메터로 gamename 을 받아옵니다.

    let gamename = req.body.gamename;
    let gamekey = req.body.gamekey;

    console.log(req.body);

    if ((gamename !== undefined) && (gamekey !== undefined)){
        let trackerNameSet = Object.keys(trackers);

        if (trackerNameSet.includes(gamename)){
            resp_error(res, gamename + " is already registered.");
        }else{
            var tracker = new modeltracker.modeltracker(mongodb_host, gamename, gamekey, {
                success:(data) => {
                    if (data.new){
                        resp_msg(res, "db " + gamename + " created!");
                    }else{
                        resp_msg(res, "db " + gamename + " registered!");
                    }

                    trackers[gamename] = tracker;
                },
                failed:()=>{
                    resp_error(res, "can't reach db. try again later");
                }
            });
        }
    }else{
        resp_error(res, "invalid parameter");
    }
});

app.post('/api/deletegame', (req, res) => {
    let gamename = req.body.gamename;
    let gamekey = req.body.gamekey;

    if ((gamename !== undefined) && (gamekey !== undefined)){
        if (trackers[gamename] !== undefined){
            var tracker = trackers[gamename];

            var settings = tracker.SettingCollection;
            settings.find().toArray((err, items) => {
                if (items.length > 0){
                    var setting = items[0];

                    if (setting.password !== undefined){
                        if (setting.password === modeltracker.gethash(gamekey)){
                            tracker.Database.dropDatabase(gamename);

                            delete trackers[gamename];

                            resp_msg(res, "Drop success.");
                        }else{
                            resp_error(res, "Invalid password");
                        }
                    }else{
                        resp_error(res, "Invalid document");
                    }
                }else{
                    resp_error(res, "not exists document");
                }
            });
        }else{
            resp_error(res, "db you requested is not registered");
        }
    }else{
        resp_error(res, "invalid parameter");
    }
});

app.post('/api/signup', (req, res) => {
    let gamename = req.body.gamename;
    let gamekey = req.body.gamekey;

    let userid = req.body.userid;
    let userpassword = req.body.userpassword;

    if ((gamename !== undefined) && (gamekey !== undefined) && (userid !== undefined) && (userpassword !== undefined)){
        var tracker = trackers[gamename];

        if (tracker !== undefined){
            modeltracker.checkpassword(tracker.Database, gamekey, (data) => {
                if (data.valid){
                    var users = tracker.UserCollection;

                    users.find({userid : userid}).count((err, count) => {
                        if (count === 0){
                            users.insertOne(Object.assign({
                                userid : userid,
                                password : modeltracker.gethash(userpassword),
                                logincount : 0
                            }, UserDefaultData));

                            resp_msg(res, "user registered.");
                        }else{
                            resp_error(res, "already exists userid");
                        }
                    });
                }else{
                    resp_error(res, data.reason);
                }
            });
        }else{
            resp_error(res, "db you requested is not registered");
        }
    }else{
        resp_error(res, "invalid parameter");
    }
});

app.post('/api/signin', (req, res) => {
    let gamename = req.body.gamename;
    let gamekey = req.body.gamekey;

    let userid = req.body.userid;
    let userpassword = req.body.userpassword;

    if ((gamename !== undefined) && (gamekey !== undefined) && (userid !== undefined) && (userpassword !== undefined)){
        let tracker = trackers[gamename];

        if (tracker !== undefined){
            let users = tracker.UserCollection;

            modeltracker.checkpassword(tracker.Database, gamekey, (data) => {
                if (data.valid){
                    users.find({userid : userid, password : modeltracker.gethash(userpassword)}).toArray((err, items) => {
                        if (items.length > 0){
                            let item = items[0];

                            let accessTokens = tracker.AccesstokenCollection;

                            accessTokens.deleteOne({userid : userid}, () => {
                                accessTokens.insertOne({userid : userid}, (err, result) => {
                                    let accessToken = result.insertedId;

                                    users.updateOne({_id : item._id}, {$inc : {logincount : 1}}, () => {
                                        console.log("accessToken : " + accessToken);

                                        resp_msg(res, "Sign in successed.", moredata = {
                                            accessToken : accessToken
                                        });
                                    });
                                });
                            });
                        }else{
                            resp_error(res, "User is not exists or password is not matched");
                        }
                    });
                }else{
                    resp_error(res, data.reason);
                }
            });
        }else{
            resp_error(res, "Db you requested is not exists");
        }
    }else{
        resp_error(res, "invalid parameter");
    }
});

app.post('/api/setversion', (req, res) => {
    let gamename = req.body.gamename;
    let gamekey = req.body.gamekey;
    let version = req.body.version;

    if ((gamename !== undefined) && (gamekey !== undefined) && (version !== undefined)){
        let tracker = trackers[gamename];

        if (tracker !== undefined){
            modeltracker.checkpassword(tracker.Database, gamekey, (data) => {
                if (data.valid){
                    let settings = tracker.SettingCollection;

                    settings.updateOne({}, {$set : {version : version}}, () => {
                        resp_msg(res, "version updated!");
                    });
                }else{
                    resp_error(res, data.reason);
                }
            });
        }else{
            resp_error(res, "Db you requested is not exists");
        }
    }else{
        resp_error(res, "Invalid parameter");
    }
});

app.post('/private/push', (req, res) => {
    let gamename = req.body.gamename;
    let gamekey = req.body.gamekey;
    let gamedata = req.body.gamedata;

    let collection = req.body.collection;
    let accessToken = req.body.accessToken;

    if ((gamename !== undefined) && (gamekey !== undefined) && (collection !== undefined) && (accessToken !== undefined) && (gamedata !== undefined)){
        let tracker = trackers[gamename];

        if (tracker !== undefined){
            modeltracker.checkpassword(tracker.Database, gamekey, (data) => {
                if (data.valid){
                    tracker.AccesstokenCollection.find({_id : new ObjectId(accessToken)}).toArray((err, items) => {
                        console.log(items);
                        if (items.length > 0){
                            let document = items[0];

                            let userid = document.userid;
                            let dbCollection = tracker.Database.collection(collection);

                            dbCollection.find({userid : userid}).count((err, count) => {
                                if (count === 0){
                                    dbCollection.insertOne(Object.assign({userid : userid}, JSON.parse(gamedata)), () => {
                                        resp_msg(res, "Data push complete.");
                                    });
                                }else{
                                    resp_error(res, "Data already pushed");
                                }
                            });
                        }else{
                            resp_error(res, "Invalid accessToken");
                        }
                    });
                }else{
                    resp_error(res, data.reason);
                }
            });
        }else{
            resp_error(res, "Db you requested is not exists");
        }
    }else{
        resp_error(res, "Invalid parameter");
    }
});

app.post('/private/pull', (req, res) => {
    let gamename = req.body.gamename;
    let gamekey = req.body.gamekey;

    let collection = req.body.collection;
    let accessToken = req.body.accessToken;

    if ((gamename !== undefined) && (gamekey !== undefined) && (collection !== undefined) && (accessToken !== undefined)){
        let tracker = trackers[gamename];

        if (tracker !== undefined){
            let accessTokens = tracker.AccesstokenCollection;

            accessTokens.find({_id : new ObjectId(accessToken)}).toArray((err, items) => {
                if (items.length > 0){
                    let document = items[0];

                    let dbCollection = tracker.Database.collection(collection);

                    dbCollection.deleteOne({userid : document.userid}, () => {
                        resp_msg(res, "delete completed");
                    });
                }else{
                    resp_msg(res, "Invalid accessToken");
                }
            });
        }else{
            resp_error(res, "Db you requested is not exists");
        }
    }else{
        resp_error(res, "Invalid parameter");
    }
});

app.post('/private/update', (req, res) => {
    let gamename = req.body.gamename;
    let gamekey = req.body.gamekey;
    let updatedata = req.body.updatedata;

    let collection = req.body.collection;
    let accessToken = req.body.accessToken;

    if ((gamename !== undefined) && (gamekey !== undefined) && (collection !== undefined) && (accessToken !== undefined)){
        let tracker = trackers[gamename];

        if (tracker !== undefined){
            let accessTokens = tracker.AccesstokenCollection;

            accessTokens.find({_id : new ObjectId(accessToken)}).toArray((err, items) => {
                if (items.length > 0){
                    let accessTokenDocument = items[0];

                    let userid = accessTokenDocument.userid;

                    let dbCollection = tracker.Database.collection(collection);

                    dbCollection.find({userid : userid}).toArray((err, collectionItems) => {
                        if (collectionItems.length > 0){
                            let collectionDocument = collectionItems[0];
                            console.log(updatedata);
                            console.log(JSON.parse(updatedata));
                            console.log(collectionDocument);

                            dbCollection.updateOne({_id : collectionDocument._id}, JSON.parse(updatedata), (err, result) => {
                               resp_msg(res, "Update completed [ msg " + err + " ]");
                            });
                        }else{
                            resp_error(res, "Document not exists");
                        }
                    });
                }else{
                    resp_error(res, "Invalid accessToken");
                }
            });
        }else{
            resp_error(res, "Db you requested is not exists");
        }
    }else{
        resp_error(res, "Invalid parameters");
    }
});

app.post('/private/get', (req, res) => {
    let gamename = req.body.gamename;
    let gamekey = req.body.gamekey;
    let query = req.body.query;

    let collection = req.body.collection;
    let accessToken = req.body.accessToken;

    if ((gamename !== undefined) && (gamekey !== undefined) && (collection !== undefined) && (accessToken !== undefined)){
        let tracker = trackers[gamename];

        if (tracker !== undefined){
            let accessTokens = tracker.AccesstokenCollection;

            accessTokens.find({_id : new ObjectId(accessToken)}).toArray((err, items) => {
                if (items.length > 0){
                    let accessTokenDocument = items[0];
                    let queryObject = JSON.parse(query);

                    let dbCollection = tracker.Database.collection(collection);
                    console.log(queryObject);
                    console.log(Object.assign(queryObject, {userid : accessTokenDocument.userid}));

                    dbCollection.find(Object.assign(queryObject, {userid : accessTokenDocument.userid})).toArray((err, collectionItems) => {
                        if (collectionItems.length > 0){
                            let collectionDocument = collectionItems[0];
                            delete collectionDocument.userid;

                            resp_msg(res, "Get completed.", {"data" : collectionDocument});
                        }else{
                            resp_msg(res, "Get completed.", {"data" : {}});
                        }
                    });
                }else{
                    resp_error(res, "Invalid accessToken");
                }
            });
        }else{
            resp_error(res, "Db you requested is not exists");
        }
    }else{
        resp_error(res, "Invalid parameter");
    }
});

const httpsOptions = {
  key: fs.readFileSync('/etc/letsencrypt/live/mongotracker.com/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/mongotracker.com/fullchain.pem')
}

let server_on = () => {
  console.log("App started");
}

http.createServer(app).listen(80, server_on);
https.createServer(httpsOptions, app).listen(443, server_on);

//var server = app.listen(80, () => {
//    console.log("App statred");
//});
