// ******* Const
// require("dotenv").confg();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require("passport-google-oauth20").Strategy;
var findOrCreate = require('mongoose-findorcreate');

// const bcrypt = require("bcrypt");
// const saltRounds = 10;
// const encrypt = require("mongoose-encryption");
// const md5 = require("md5");

const app = express();
// ******* Nes. Code
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended: true}));

// Место для установки сессии, между app и mongo DB только
app.use(session({
    secret: "Our little secret ///",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// ******* DB 
// Connection
mongoose.connect("mongodb://localhost:27017/userDB", { useNewUrlParser: true, useUnifiedTopology: true });
// Fix для зависимости 
mongoose.set("useCreateIndex", true);
// Schema/Module 

// 1 lvl sec. 
// const userSchema = 
// {
//     email: String,
//     password: String
// }

// 2 lvl sec. with mongoose-encryption
const userSchema = new mongoose.Schema
({
    email: String,
    password: String,
    googleID: String,
    secret: String
});

// Новая схема для пакета passportLocalMongoose и минифицированный код
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

// Код без авторизации через гугл и passport
// passport.serializeUser(User.serializeUser());
// passport.deserializeUser(User.deserializeUser());

// Код для авторизации через гугл и passport
passport.serializeUser(function(user, done) {
    done(null, user.id); 
});

passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
    done(err, user);
    });
});

// Код для passport GoogleStrategy
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret:process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/secrets",
    // Код из баг фикса на гитхабе о неработающем гугл+
    userProfileURL: "https://www.google.com/outh2/v3/userinfo"
  },
// Чтобы код работал нужен или более развернутый вариант (см. stack overflaw) или 
// npm пакет npm install mongoose-findorcreate
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

// Crypto code. Use docs mongoose-encrypt
// Используется в app.js до 2 уровня 
// const secret = "Thisisoursecret";
// Все поля
// userSchema.plugin(encrypt, {secret: secret});
// Определенные поля 
// userSchema.plugin(encrypt, {secret: process.env.Secret, encryptedFields: ["password"] });

// ********* Get
app.get("/", function(req, res)
{
    res.render("home");
});

// Аутентификация через гугл
app.get("/auth/google",
passport.authenticate("google", { scope: ["profile"] }));

app.get("/auth/google/secrets", 
  passport.authenticate("google", { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect secrest.
    res.redirect("/secrests");
  });

app.get("/login", function(req, res)
{
    res.render("login");
});

app.get("/register", function(req, res)
{
    res.render("register");
});

// Создание secret путь для того, чтобы он был доступен только во время авторизированной сессии
app.get("/secrets", function(req, res)
{
    // При наличии кода на проверку того, что юзер залогинился - проверка не нужна
    // if(req.isAuthenticated())
    // {
    //     res.render("secrets");
    // }
    // else
    // {
    //     res.redirect("/login")
    // }
    User.find({"secret": {$ne: null}}, function(err, foundUsers)
    {
        if(err)
        {
            console.log(err);
        }
        else{
            if(foundUsers)
            {
                res.render("secrets", {usersWithSecrets: foundUsers});
            }
        }
    });
});

app.get("/submit", function(req, res)
{
    if(req.isAuthenticated())
    {
        res.render("submit");
    }
    else
    {
        res.redirect("/login")
    }
});

// Код для сохранения сообщения в базе для конкретного юзера
app.post("/submit", function(req, res)
{   
    const submittedSecret = req.body.secret;
    // passport сохраняет данные о сессии в req.user
    User.findById(req.user.id, function(err, foundUser)
    {
        if(err)
        {
            console.log(err);
        }
        else
        {
            if (foundUser)
            {
                foundUser.secret = submittedSecret;
                foundUser.save(function(){res.redirect("/secrets");});
            }
        }
    });
});

// ******* Код редиректа для кнопки logout
app.get("logout", function(req, res)
{
    req.logout();
    res.redirect("/");
});

// ******* POST
app.post("/register", function(req, res)
{
    // Для bcrypt
    // bcrypt.hash(req.body.username, saltRounds, function(err, hash)
    // {
    // const newUser = new User({
    //     email: req.body.username,
    //     password: hash
    // });

    // newUser.save(function(err)
    // {
    //     if (err) {console.log(err);}
    //     else{res.render("secrets");}
    // });
// });
    User.register({username: req.body.username}, req.body.password, function(err, user)
    {
        if(err)
        {
            console.log(err);
            res.redirect("/register");
        }
        else
        {
            passport.authenticate("local")(req, res, function()
            {
                res.redirect("/secrets");
            });
        }
    });
});

app.post("/login", function(req, res)
{
    const user = new User({
        username: req.body.username,
        password: req.bosy.password
    });

    req.login(user, function(err)
    {
        if(err)
        {
            console.log(err);
        }
        else
        {
            passport.authenticate("local")(req, res, function()
            {
                res.redirect("/secrets");
            });
        }
    });
    // const username = req.body.username;
    // const password = req.body.password;

    // User.findOne({email:  username}, function(err, foundUser)
    // {
    //     if(err){console.log(err);}
    //     else{
    //         if(foundUser)
    //         {
    //             // if(foundUser.password === password)
    //             bcrypt.compare(password, foundUser.password  , function(err, result)
    //             { if (result === true) 
    //             {
    //                 res.render("secrets");
    //             } 
    //             });                                 
    //         }
    //     } 
    // });
});

// Listen ports
app.listen(3000, function() 
{
    console.log("Server started on port 3000");
}); 
