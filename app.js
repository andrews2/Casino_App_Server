// global variables used in server
//
var express = require("express");
var app = express();
var http = require('http').Server(app);
var PORT = process.env.PORT || 5000; // 5000 default but get port number
var dropbox = require("dropbox");
var fs = require("fs");
const Path = require("path");
const { getSystemErrorMap } = require("util");
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb'}));
app.use(express.static(__dirname+"/public"));
var sendmail = require("sendmail")();
var crypto = require("crypto");
const { path } = require("express/lib/application");
var favicon = require('serve-favicon');
app.use(favicon(__dirname + "/favicon.ico"));



//file paths for saving files to dropbox
dbx = new dropbox.Dropbox({accessToken: process.env.DROPBOX_KEY});
const accountsFilePath = "/Apps/IOT_Casino_Server/Accounts.json";
const missingFilePath = "/Apps/IOT_Casino_Server/Missing.json";
const ownedFilePath = "/Apps/IOT_Casino_Server/Owned.json";
const pastOwnedFilePath = "/Apps/IOT_Casino_Server/PastOwned.json";
const historyFilePath = "/Apps/IOT_Casino_Server/User_History";
const pictureFilePath = "/Apps/IOT_Casino_Server/Pictures";

var accounts = new Map();
var missing = new Map();
var owned = new Map(); //shows current user for each chip
var pastOwned = new Map(); // shows the last person who owned the chip

class User{
  constructor(userName, password){
    this.userName = userName;
    this.password = password;
    this.accountValue = 0;
    this.historyVersion = 0;
    this.profilePicture = 'none';
  }

  copyJSON(obj){
      Object.assign(this, obj)
  }

  get Password(){
    return this.password;
  }

  get UserName(){
    return this.userName;
  }

  get AccountValue(){
      return this.accountValue;
  }

  get HistoryVersion(){
    return this.historyVersion;
  }
};

function addToAccounts(username, user){
    accounts.set(username, user);
}

function saveAccountsToDB(){
    var obj = Object.fromEntries(accounts);
    var accountsJSON = JSON.stringify(obj);
    fs.writeFile("Accounts.json", accountsJSON, 'utf-8', function(err){
        if (err) saveAccountsToDB();
    })

    fs.readFile("Accounts.json", 'utf-8', function(err, data){
        if (err) saveAccountsToDB();
        try{
          dbx.filesUpload({path: accountsFilePath, contents: data, mode:'overwrite'});
        } catch(err) {
          saveAccountsToDB();
        } 
    })

    fs.unlink("Accounts.json", function(err){
        if (err) saveAccountsToDB();
    })
}

function saveBufferToDbx(data, fp){
  dbx.filesUpload({path: fp, contents: data, mode:'overwrite'});
}

function saveFileToDbx(file, fp, name){
  var obj = Object.fromEntries(file);
  var fileJson = JSON.stringify(obj);
  fs.writeFile(Path.join(__dirname, name), fileJson, 'utf-8', function(err, data){
    if (err){
      console.log(err);
      saveFileToDbx(file, fp, name);
    } 
  })

  fs.readFile(Path.join(__dirname, name), 'utf-8', function(err, data){
    if(err){
      console.log(err);
      saveFileToDbx(file, fp, name);
    }
    try{
      dbx.filesUpload({path: fp, contents: data, mode:'overwrite'})
    } catch(err){console.log(err)}
  })

  fs.unlink(Path.join(__dirname, name), function(err){
    if (err) console.log(err);
  })

}

function loadAccountsFromDB(){
  try{
    const accountsJSON = dbx.filesDownload({path: accountsFilePath})
    .then(function(response){
        const data = JSON.parse(response.result.fileBinary);
        const keys = Object.keys(data);
        for(let i = 0; i < keys.length; i++){
            var user = new User(data[keys[i]].username, data[keys[i]].password)
            user.copyJSON(data[keys[i]]);
            accounts.set(keys[i], user);
        }
    })
  } catch(err){
  }
}

function loadOwnedFromDB(){
  try{
    const ownedJSON = dbx.filesDownload({path: ownedFilePath})
    .then(function(response){
      const data = JSON.parse(response.result.fileBinary);
      owned = new Map(Object.entries(data))
    })
  } catch(err){
  }
}

function loadPastOwnedFromDB(){
  try{
    const pastOwnedJSON = dbx.filesDownload({path: pastOwnedFilePath})
    .then(function(response){
      const data = JSON.parse(response.result.fileBinary);
      pastOwned = new Map(Object.entries(data))
    })
  } catch(err){
  }
}

function getIDsFile(userName, callback){
  try{
    const IDsFilePath = historyFilePath + '/' + userName + "_ids.ser";
    const savePath = __dirname + "/" + userName + "_ids.ser";
    const file = dbx.filesDownload({path: IDsFilePath}).then(function(response){
      const data = Buffer.from(response.result.fileBinary, 'binary');
      fs.writeFile(savePath, data, function(){
        callback();
      })
      console.log("File saved at: " + savePath)
    })
  } catch(err){}

}

function getValsFile(userName, callback){
  try{
    const valsFilePath = historyFilePath + '/' + userName + "_vals.ser";
    const savePath = __dirname + "/" + userName + "_vals.ser";
    return dbx.filesDownload({path: valsFilePath}).then(function(response){
      const data = Buffer.from(response.result.fileBinary, 'binary');
      fs.writeFile(savePath, data, function(){
        callback();
      })
      console.log("File saved at: " + savePath)
    })
  } catch(err){}
}

function getProfilePicture(fileName, callback){
  try{
    const picFP = pictureFilePath + '/' + fileName;
    const savePath = __dirname + '/' + fileName;
    return dbx.filesDownload({path: picFP}).then(function(response){
      const data = Buffer.from(response.result.fileBinary, 'binary');
      fs.writeFile(savePath, data, function(){
        callback();
      })
      console.log("File saved at: " + savePath);
    })
  } catch(err){}
}

function sendEmail(subject, msg){
  try{
    sendmail({
      from: 'no-reply@casinoserver.com',
      to: 'ajshipma@ncsu.edu',
      subject: subject,
      html: msg
    }, function (err, reply) {})
  } catch(err){
    console.log("error connecting to email: " + err)
  }
}

function decryptData(msg){
  //get encryption key
  var key = process.env.ENC_KEY;
  var iv = '0000000000000000';
  var decipher = crypto.createDecipheriv("aes-256-cbc", key, iv)
  var data = decipher.update(msg, 'hex', 'utf8')
  data += decipher.final('utf8');
  return data.toString();
}

function initServer(){
    loadAccountsFromDB();
    loadOwnedFromDB();
    loadPastOwnedFromDB();
}

//set up server
initServer();

app.post("/addChip", function(req, res){
  var userName = req.body.name
  var chipID = req.body.chipID
  if(!owned.get(chipID) || owned.get(chipID) == "none"){
    owned.set(chipID, userName)
    saveFileToDbx(owned, ownedFilePath, "Owned.json")

    //check if tag is missing
    if(missing.has(chipID)){
      missing.delete(chipID)
      saveFileToDbx(Missing, missingFilePath, "Missing.json")
    }

    res.status(200).send();
  }
  else{
    res.status(400).send();
  }
})

app.post("/putChipInPlay", function(req, res){
  var userName = req.body.name
  var chipID = req.body.chipID
  if (owned.get(chipID) == userName){
    pastOwned.set(chipID, userName)
    owned.set(chipID, "none")
    saveFileToDbx(owned, ownedFilePath, "Owned.json")
    saveFileToDbx(pastOwned, pastOwnedFilePath, "PastOwned.json")
  }
  res.status(200).send();
})

app.post("/signup", function(req, res){
  uName = decryptData(req.body.name);
  pWord = decryptData(req.body.password);
  if (accounts.has(uName)){
    res.status(400).send();
  } else{
    addToAccounts(uName, new User(uName, pWord));
    res.status(200).send();
    saveAccountsToDB();
  }
})

app.post("/login", function(req, res){
  uName = decryptData(req.body.name);
  pWord = decryptData(req.body.password);
  if (accounts.has(uName)){
    //username exists
    const requestedUser = accounts.get(uName);
    if (pWord == requestedUser.Password){
        //password is correct
      const objToSend = {
        accountValue: requestedUser.AccountValue,
        username: requestedUser.userName,
        version: requestedUser.HistoryVersion,
        profilePicture: requestedUser.profilePicture
      }
      res.status(200).send(JSON.stringify(objToSend));
      
    } else {
        //password is inccorect
        res.status(400).send();
    }
  } else{
      //username does not exist
    res.status(404).send();
  }
})

app.post("/getHistIDs", function(req, res){
  getIDsFile(req.body.name, function(){
    var options = {root: __dirname};
    var fileName = req.body.name + "_ids.ser";
    res.status(200).sendFile(fileName, options, function(err){
      if (err) console.log(err);
    })
  });
})

app.post("/getHistVals", function(req, res){
  getValsFile(req.body.name, function(){
    var options = {root: __dirname};
    var fileName = req.body.name + "_vals.ser";
    res.status(200).sendFile(fileName, options, function(err){
      if (err) console.log(err);
    })
  });
})

app.post("/getProfilePicture", function(req,res){
  var uName = req.body.name;
  var pictureFile = accounts.get(uName).profilePicture;
  getProfilePicture(pictureFile, function(){
    var options = {root: __dirname};
    res.status(200).sendFile(pictureFile, options, function(err){
      if (err) console.log(err);
    })
  })
})

app.post("/updateHist", function(req, res){
  var uName = Buffer.from(req.body.uName).toString('ascii')
  accounts.get(uName).historyVersion = parseInt(Buffer.from(req.body.version).toString('ascii'))
  accounts.get(uName).accountValue = parseInt(Buffer.from(req.body.value).toString('ascii'))
  saveAccountsToDB();
  var histIDs = Buffer.from(req.body.histIDs, 'binary') 
  var histVals = Buffer.from(req.body.histVals, 'binary')
  const IDsFilePath = historyFilePath + '/' + uName + "_ids.ser";
  const valsFilePath = historyFilePath + '/' + uName + "_vals.ser";
  try{
    saveBufferToDbx(histIDs, IDsFilePath);
    saveBufferToDbx(histVals, valsFilePath);
  } catch(err){}
  res.status(200).send();
})

app.post("/updateProfilePic", function(req, res){
  var uName = Buffer.from(req.body.uName).toString('ascii');
  var fileName = Buffer.from(req.body.fileName).toString('ascii')
  accounts.get(uName).profilePicture = fileName;
  saveAccountsToDB();
  var profPic = Buffer.from(req.body.image, 'binary')
  const imageFP = pictureFilePath + '/' + fileName
  try{
    dbx.filesUpload({path: imageFP, contents: profPic, mode:'overwrite'})
  } catch(err){}
  res.status(200).send();
})

app.get("/reset_accounts", function(req, res){
  accounts.clear();
  var usr = new User("TEST", "test");
  usr.accountValue = 200;
  usr.historyVersion = 1;
  addToAccounts("TEST", usr);
  const options = {root: __dirname};
  saveAccountsToDB();
  res.sendFile("accountsreset.html", options);
})

app.post("/wake", function(req, res){
  res.status(200).send();
})

app.get("/", function(req, res){
  const options = {root: __dirname};
  res.sendFile("home.html", options, function(err){
    console.log(err);
  })
})

app.get("/download", function(req,res){
  res.download(__dirname + "/app-debug.apk", "Wolfpack Casino.apk");
})

app.post("/serverNotification", function(req, res){

  if(req.body.Found){
    try{
      missing.delete(req.body.Found)
      console.log("Found: " + req.body.Found)
    } catch(err){}
  }

  if(req.body.Missing){
    missing.set(req.body.Missing, req.body.Missing)
    if(!owned.get(req.body.Missing.substring(16)) || owned.get(req.body.Missing.substring(16)) == "none"){
      owned.set(("0x" + req.body.Missing.substring(16)), "Casino")
    }
    console.log(owned)
    console.log("Missing: " + req.body.Missing)
  }
  res.status(200).send();
})


app.listen(PORT, function(){
    //start the server on the port
    console.log("Listening on port " +  PORT);
})
//