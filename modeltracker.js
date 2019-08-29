const crypto = require('crypto');

const gethash = (string) => {
    return crypto.createHash('sha256').update(string).digest("hex");
}

const checkpassword = (db, password, callback) => {
    let SettingsCollection = db.collection("settings");

    SettingsCollection.find().toArray((err, items) => {
        if (items.length > 0){
            var SettingDoc = items[0];
            
            if (SettingDoc.password === gethash(password)){
                callback({valid:true});
            }else{
                callback({valid:false, reason:"password invalid"});
            }
        }else{
            callback({valid:false, reason:"not exists any documents"});
        }
    });
}

function ModelTracker(host, database, password, callback) {
    this.MongoClient = require('mongodb').MongoClient;
    this.Database = undefined;

    this.SettingCollection = undefined;
    this.UserCollection = undefined;
    this.AccesstokenCollection = undefined;

    this.UserDefaultData = undefined;

    this.MongoClient.connect(host+"/"+database, (err, db) => {

        if (err && callback.failed !== undefined){
            callback.failed();
        }else if (callback.success !== undefined){
            var gamedb = db.db(database);
            this.Database = gamedb;

            var settings = gamedb.collection("settings");
            this.SettingCollection = settings;
            
            var users = gamedb.collection("users");
            this.UserCollection = users;

            var accessTokens = gamedb.collection("accessTokens");
            this.AccesstokenCollection = accessTokens;

            var settingCursor = settings.find().toArray((err, items) => {
                var settingCount = items.length;

                if (settingCount === 0){
                    settings.insertOne({
                        gamename : database,
                        version : 0.01,
                        password : gethash(password),
                        default_userdata : {}
                    });

                    UserDefaultData = {};

                    callback.success({new : true});
                }else{
                    var settingDoucment = items[0];
                    if (settingDoucment.password === gethash(password)){
                        UserDefaultData = settingDoucment.default_userdata
                        callback.success({new : false});
                    }else{
                        callback.failed();
                    }
                }
            });
        }
    });
};

module.exports = {
    modeltracker : ModelTracker,
    checkpassword : checkpassword,
    gethash : gethash
};