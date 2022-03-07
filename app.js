// global variables used in server
var express = require("express");
var app = express();
var PORT = process.env.PORT || 5000; // 5000 default but get port number
var dropbox = require("dropbox");
var fs = require("fs");
const { getSystemErrorMap } = require("util");
app.use(express.json());
var sendmail = require("sendmail")();
var crypto = require("crypto");
const { path } = require("express/lib/application");




dbx = new dropbox.Dropbox({accessToken: process.env.DROPBOX_KEY});
const accountsFilePath = "/Apps/IOT_Casino_Server/Accounts.json";
const historyFilePath = "/Apps/IOT_Casino_Server/User_History";

var accounts = new Map();

class User{
  constructor(userName, password){
    this.userName = userName;
    this.password = password;
    this.accountValue = 0;
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
};

function addToAccounts(username, user){
    accounts.set(username, user);
}

function saveAccountsToDB(){
    var obj = Object.fromEntries(accounts);
    var accountsJSON = JSON.stringify(obj);
    fs.writeFile("Accounts.json", accountsJSON, 'utf-8', function(err){
        if (err) console.log("error while saving acconuts file");
    })

    fs.readFile("Accounts.json", 'utf-8', function(err, data){
        if (err) console.log("error while saving acconuts file");
        try{
          dbx.filesUpload({path: accountsFilePath, contents: data, mode:'overwrite'});
        } catch(err) {

        } 
    })

    fs.unlink("Accounts.json", function(err){
        if (err) console.log("error while saving acconuts file");
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
    accounts.clear();
    addToAccounts("TEST", new User("TEST", "test"));
    saveAccountsToDB();
  }
}

function createHistoryFiles(userName){
  const gamesFilePath = historyFilePath + '/' + userName + "_games.ser";
  const valsFilePath = historyFilePath + '/' + userName + "_vals.ser";
  try{
    dbx.filesUpload({path: gamesFilePath, contents: "", mode:'overwrite'});
    dbx.filesUpload({path: valsFilePath, contents: "", mode:'overwrite'});
  } catch(err){}
}

function getGamesFile(userName){
  try{
    const gamesFilePath = historyFilePath + '/' + userName + "_games.ser";
    const savePath = __dirname + "/" + userName + "_games.ser";
    const file = dbx.filesDownload({path: gamesFilePath}).then(function(response){
      const data = Buffer.from(response.result.fileBinary, 'binary');
      var wStream = fs.createWriteStream(savePath);
      wStream.write(data);
    })
  } catch(err){}
}

function getValsFile(userName){
  try{
    const valsFilePath = historyFilePath + '/' + userName + "_vals.ser";
    const savePath = __dirname + "/" + userName + "_vals.ser";
    return dbx.filesDownload({path: valsFilePath}).then(function(response){
      const data = Buffer.from(response.result.fileBinary, 'binary');
      var wStream = fs.createWriteStream(savePath);
      wStream.write(data);
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
    sendEmail('Server is up',  "Hello,<br><br>Your server is now currently up and running.");
}

//set up server
initServer();

app.post("/signup", function(req, res){
  uName = decryptData(req.body.name);
  pWord = decryptData(req.body.password);
  if (accounts.has(uName)){
    res.status(400).send();
  } else{
    addToAccounts(uName, new User(uName, pWord));
    res.status(200).send();
    saveAccountsToDB();
    createHistoryFiles(uName);
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
        username: requestedUser.userName
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

app.post("/getHistGames", function(req, res){
  getGamesFile(req.body.name);
  var options = {root: __dirname};
  var fileName = req.body.name + "_games.ser";
  res.sendFile(fileName, options, function(err){
    if (err) console.log(err);
  })
})

app.post("/getHistVals", function(req, res){
  getValsFile(req.body.name);
  var options = {root: __dirname};
  var fileName = req.body.name + "_vals.ser";
  res.sendFile(fileName, options, function(err){
    if (err) console.log(err);
  })
})

app.get("/reset_accounts", function(req, res){
  accounts.clear();
  addToAccounts("TEST", new User("TEST", "test"));
  saveAccountsToDB();
})

app.get("/", function(req, res){
  const options = {root: __dirname + "/histFiles"};
  res.sendFile("hello.html", options, function(err){
    console.log(err);
  })
})


app.listen(PORT, function(){
    //start the server on the port
    console.log("Listening on port " +  PORT);
})