require('dotenv').config();
const express = require("express");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const md5 = require('md5');

const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(__dirname + "/public"));

mongoose.connect("mongodb://localhost:27017/userDB");

const userSchema = new mongoose.Schema({
  email: String,
  password: String
});


const User = mongoose.model("User", userSchema);

app.get("/", function(req, res){
  res.render("home");
});

app.get("/login", function(req, res){
  res.render("login");
});

app.get("/register", function(req, res){
  res.render("register");
});

app.post("/register", function(req, res){
  const user = new User({
    email: req.body.username,
    password: md5(req.body.password)
  });
  user.save(function(err){
    if(err){
      res.send(err);
    } else {
      res.render("secrets");
    }
  });
});

app.post("/login", function(req, res){
  User.findOne({email: req.body.username}, function(err, foundUser){
    if(foundUser){
      if(req.body.password === foundUser.password){
        res.render("secrets");
      }
    } else {
      res.send("Incorrect login credentials");
    }
  });
});

app.listen(PORT, () => {
  console.log("App has started on localhost: " + PORT);
});
