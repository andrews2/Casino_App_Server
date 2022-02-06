const { Dropbox } = require("dropbox");
var express = require("express");
var app = express();
var PORT = process.env.PORT || 5000; // 5000 default but get port number
app.use(express.json());
dbx = Dropbox(process.env.DROPBOX_KEY);

filename = '/local_files/in.txt'
dbx.files_upload(f.read(), filename, mute=True);

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

const accounts = new Map();

app.post("/signup", function(req, res){
  uName = req.body.name;
  pWord = req.body.password;
  if (accounts.has(uName)){
    res.status(400).send();
  } else{
    accounts.set(uName, new User(uName, pWord));
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