require('dotenv').config();
const express = require("express");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const cookieSession = require('cookie-session');
const Keygrip = require('keygrip');
const crypto = require('crypto');

const app = express();

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(__dirname + "/public"));

mongoose.connect(process.env.DB_URI);

app.set('trust proxy', 1);
app.use(cookieSession({
  name: 'secrets.app.session',
  keys: new Keygrip([process.env.KEY_SECRET1, process.env.KEY_SECRET2, process.env.KEY_SECRET3],'SHA256','base64'),
  resave: false,
  saveUninitialized: true,
  maxAge: 1000*60*360,
  sameSite: true
}));
app.use(passport.initialize());
app.use(passport.session());

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secret: Array,
});

userSchema.plugin(passportLocalMongoose);

const User = mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "https://secrets2.herokuapp.com/auth/google/secrets"
  },
  function(accessToken, refreshToken, profile, done) {
    // console.log(profile);
      User.findOne({"googleId": profile.id}, function(err, foundUser){
        console.log(foundUser);
        if(foundUser) {
          done(null, foundUser);
        } else {
          const newUser = new User();
          newUser.googleId = profile.id;
          newUser.username = profile.emails[0].value;

          newUser.save(function(err) {
            if(err) {throw err;}
            done(null, newUser);
          });
        }
      });
  }
));

app.get("/", function(req, res){
  res.render("home");
});

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile','email'] })
);

app.get('/auth/google/secrets',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect secrets.
    res.redirect('/secrets');
  });

app.route("/login")
  .get(function(req,res){
    res.render("login");
  })
  .post(function(req,res){
    const user = new User({
      username: req.body.username,
      password: req.body.password
    });

    req.login(user, function(err){
      if(err){
        console.log(err);
      } else {
        passport.authenticate("local")(req, res, function(){
          res.redirect("secrets");
        });
      }
    });
  });

app.get("/logout", function(req,res){
  req.logout();
  res.redirect("/");
});

app.route("/submit")
  .get(function(req, res){
    if(req.isAuthenticated()){
      res.render("submit");
    } else {
      res.render("login");
    }
  })
  .post(function(req,res){
    const submittedSecret = req.body.secret;
    // console.log(req.user.id);
    User.findById(req.user.id, function(err, foundUser){
      if(err){
        console.log(err);
      } else {
        if(foundUser){
          foundUser.secret.push(submittedSecret);
          foundUser.save(function(){
            res.redirect("/secrets");
          });
        }
      }
    });
  });

app.get("/secrets", function(req,res){
  User.find({"secret": {$ne: null}}, function(err, foundSecrets){
    if(err){
      console.log(err);
    } else {
      if(foundSecrets){
        res.render("secrets", {usersWithSecrets: foundSecrets});
      }
    }
  });
});

app.route("/register")
  .get(function(req, res){
    res.render("register");
  })
  .post(function(req, res){
    User.register({username: req.body.username}, req.body.password, function(err, user){
      if(err){
        console.log(err);
        res.redirect('/register');
      } else{
        passport.authenticate("local")(req, res, function(){
          res.redirect("/secrets");
        });
      }
    });
  });

  let port = process.env.PORT;
  if (port == null || port == "") {
    port = 3000;
  }
  app.listen(port);
