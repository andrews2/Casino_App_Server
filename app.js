var express = require("express");
var app = express();
var PORT = process.env.PORT || 5000; // 5000 default but get port number
var dropbox = require("dropbox");
var fs = require("fs");
const { getSystemErrorMap } = require("util");
app.use(express.json());
dbx = new dropbox.Dropbox({accessToken: process.env.DROPBOX_KEY});

var accounts = new Map();

class User{
  constructor(userName, password){
    this.userName = userName;
    this.password = password;
    this.accountValue = 0;
  }

  get Password(){
    return this.password;
  }

  get UserName(){
    return this.userName;
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
        dbx.filesUpload({path: "/Accounts.json", contents: data});
    })

    fs.unlink("Accounts.json", function(err){
        if (err) console.log("error while saving acconuts file");
    })
}

function loadAccountsFromDB(){
    const accountsJSON = dbx.filesDownload({path: "/Accounts.json"})
    console.log(accountsJSON);
}

loadAccountsFromDB();


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
  uName = req.body.name;
  pWord = req.body.password;
  if (accounts.has(uName)){
    //username exists
    const requestedUser = accounts.get(uName);
    if (pWord == requestedUser.Password){
      const objToSend = {
        name: uName
      }
      res.status(200).send(JSON.stringify(objToSend));
    }
  } else{
    res.status(404).send();
  }
})




app.listen(PORT, function(){
    //start the server on the port
    console.log("Listening on port " +  PORT);
})