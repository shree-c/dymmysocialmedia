// pulling up db connection for mongo store
const client = require('./db');
// express server
const express = require('express');
// express router
const router = require('./router');
//for sessions
const session = require('express-session');
//for storing session data in database
const mongoStore = require('connect-mongo');
//pulling in flash package
const flash = require('connect-flash');
//creating express app
const app = express();

//session config
const sessionOpts = session({
    secret: 'some secret',
    resave: false,
    //storing session info in database
    store: mongoStore.create({
        client: client,
        dbName: 'complexapp',
    }),
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24,
        httpOnly: true
    }
});
//using session options
app.use(sessionOpts);
//using flash middleware
app.use(flash());
// for files accessible via their filenames to anybody
app.use(express.static('public'));
// setting up template engine
app.set('views', 'views');
app.set('view engine', 'ejs');
// setting up for parsing posted data
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
// setting up a local object for every ejsfile to access
app.use((req, res, next)=>{
    //make all error and success flash messages available from all templates
    res.locals.errors  = req.flash('errors');
    res.locals.success = req.flash('success');
    //making new variable named visitor id to check whether he is logged in or he is guest
    req.visitorId = req.session.user ? req.session.user._id : 0;
    //making sessions object available globally on ejs template
    res.locals.user = req.session.user;
    next();
});
app.use(router);

//we are exporting app so that to start listining after we are connected to database
module.exports = app;