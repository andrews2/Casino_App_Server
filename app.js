var express = require("express");
var app = express();
var PORT = process.env.PORT || 5000; // 5000 default but get port number
var dropbox = require("dropbox");
var fs = require("fs");
const { getSystemErrorMap } = require("util");
app.use(express.json());
const config = {
    clientId: bmxmh7wpdpeu01i,
    clientSecret: mrk86xg8z1sxhjm
}

dbx = new dropbox.Dropbox(config);

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
        dbx.filesUpload({path: "/Accounts.json", contents: data});
    })

    fs.unlink("Accounts.json", function(err){
        if (err) console.log("error while saving acconuts file");
    })
}

function loadAccountsFromDB(){
    const accountsJSON = dbx.filesDownload({path: "/Accounts.json"})
    .then(function(response){
        const data = JSON.parse(response.result.fileBinary);
        const keys = Object.keys(data);
        for(let i = 0; i < keys.length; i++){
            accounts.set(keys[i], data[keys[i]]);
        }
        console.log(accounts);
    })
}

function initServer(){
    loadAccountsFromDB();
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
  uName = req.body.name;
  pWord = req.body.password;
  if (accounts.has(uName)){
    //username exists
    const requestedUser = accounts.get(uName);
    if (pWord == requestedUser.Password){
        //password is correct
      const objToSend = {
        accountValue: requestedUser.AccountValue
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