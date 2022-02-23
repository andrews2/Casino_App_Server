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




dbx = new dropbox.Dropbox({accessToken: process.env.DROPBOX_KEY});
const accountsFilePath = "/Apps/IOT_Casino_Server/Accounts.json";

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

  }
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
  encPword = process.env.ENC_KEY;
  var key = Buffer.from(encPword,'hex');
  var iv = Buffer.from('0000000000000000');
  // create decipher object 
  var decipher = crypto.createDecipheriv("aes-128-cbc", key, Buffer.from(iv));
  return decipher.update(Buffer.from(msg), 'hex', 'utf8') + decipher.final('utf8');
}

function initServer(){
    loadAccountsFromDB();
    sendEmail('Server is up',  "Hello,<br><br>Your server is now currently up and running.");
}

//set up server
initServer();

app.post("/signup", function(req, res){
  uName = req.body.name;
  pWord = req.body.password;
  if (accounts.has(uName)){
    res.status(400).send();
  } else{
    addToAccounts(uName, new User(uName, pWord));
    saveAccountsToDB();
    res.status(200).send();
  }
})

app.post("/login", function(req, res){
  uName = decryptData(req.body.name);
  pWord = decryptData(req.body.password);
  sendEmail("encryption", (uName + pWord))
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


app.listen(PORT, function(){
    //start the server on the port
    console.log("Listening on port " +  PORT);
})