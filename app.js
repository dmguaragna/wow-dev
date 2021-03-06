require('dotenv').config();
var _ = require('lodash');
const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const router = express.Router();
const bodyParser = require('body-parser');
var cookieParser = require('cookie-parser')
const ejs = require('ejs');
const flash = require('connect-flash');
const request = require('request');
const fetch = require('node-fetch');
const session = require('express-session');
const MongoStore = require('connect-mongo');
var BnetStrategy = require('passport-bnet').Strategy;

const refresh = require('./routes/token');
const keys = require('./config/key');
const getToken = require('./routes/getToken');
const ensureAuthenticated = require('./middlewares/authenticated');

const User = require('./models/User');
const Character = require('./models/Profile');
const CharacterService = require("./services/CharacterService");

mongoose.connect(keys.mongoUri, {useNewUrlParser: true, useUnifiedTopology: true });
mongoose.set("useCreateIndex", true);
mongoose.set('useFindAndModify', false);

const characterService = new CharacterService(getToken);

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({extended: true}));

app.use(cookieParser());
app.use(session({ secret: keys.SECRET,
                  saveUninitialized: true,
                  resave: false,
                  store: MongoStore.create({
                  mongoUrl: keys.mongoUri,
                  autoRemove: 'native' // Default
                  })
                 }));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function(user, done) {
  done(null, user);
});
passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

passport.use(new BnetStrategy({
    clientID: keys.BNET_ID,
    clientSecret: keys.BNET_SECRET,
    callbackURL: keys.callback_URL,
    scope: "wow.profile",
    region: "us"
}, function(accessToken, refreshToken, profile, done) {

    return done(null, profile);
}));

app.use(function (req, res, next) { //use this to gain access to isAuthenticated function in templates. ex. using this to change login and logout buttons
 res.locals.isAuthenticated = req.isAuthenticated();
 next();
});

app.use(function (req, res, next) {//use this to gain access to isAuthenticated function in templates. ex. using this to change login and logout buttons
 res.locals.isAuthenticated = req.isAuthenticated();
 next();
});

// Connect flash
app.use(flash());

// Global variables - for error messages will implement this later when I have enough players in db. When searching for characters name it will run a check if the name matches on in db
app.use(function(req, res, next) {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  next();
});

app.use('/', require('./config/router.js'));

app.get('/auth/bnet',
    passport.authenticate('bnet'));

app.get('/auth/bnet/callback',
    passport.authenticate('bnet', { failureRedirect: '/' }),
    function(req, res){
      var battletag = req.user.battletag;
      console.log(battletag);
          const user = new User({
            battletag: battletag
          });
          User.findOne({battletag: battletag}).then(function(userTag){
            if(userTag) {
              console.log("user found");
              var charName = userTag.characters[0].name;
              var charRealm = userTag.characters[0].realm;

              res.redirect('/userProfile/' + charName + '/' + charRealm);
            } else {
              console.log("new user saved");
              user.save();
              res.redirect('/charPick');
            }
          })
    });

app.get('/', function(req, res){
  res.render("home");
});

app.get('/error', function(req, res){
  res.render("error");
});

app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
});



require('./routes/weeklyVault')(app);
require('./routes/comingSoon')(app);

require('./routes/findUserCharacters/addCharacter')(app);
require('./routes/findUserCharacters/removeCharacter')(app);
require('./routes/findUserCharacters/mainCharacter')(app);
require('./routes/findUserCharacters/findCharacter')(app);

require('./routes/renderCharacter/userCharacters')(app);
require('./routes/renderCharacter/profileCharacter')(app);
require('./routes/renderCharacter/pvpCharacter')(app);
require('./routes/renderCharacter/searchCharacter')(app);
require('./routes/renderCharacter/userProfile')(app);


const PORT = process.env.PORT || 3000;

app.listen(PORT, function(){
  console.log('wow server started on 3000');
});
