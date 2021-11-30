/**
 * Author: Eric Mendoza (ericmendoza@email.arizona.edu)
 * Author: Luke Ramirez (lucasxavier@email.arizona.edu)
 * File: server.js
 * Assignment: Final Project
 * Course: CSc 337; Fall 21
 * Purpose: 
 */

// necessary packages
const mongoose = require('mongoose');
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');

// sets up express and the multer image path
const app = express();
const upload = multer({ dest: __dirname + '/public_html/app/images/pfp'} );

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const db  = mongoose.connection;
const mongoDBURL = 'mongodb://127.0.0.1/Uno'

var UserSchema = new mongoose.Schema({
    username: String,
    password: String,
    stats: {wins: Number, losses: Number, streak: Number}
});
var User = mongoose.model("Users", UserSchema);

var LobbySchema = new mongoose.Schema({
    player0 : [String],
    player1 : [String],
    player2 : [String],
    player3 : [String],
    // players: {p0: [String], p1: [String], p2: [String], p3: [String]},
    deck: {played: [String], remaining: [String]},
    turn: Number,
    direction: Number
});
var Lobby = mongoose.model("Lobbies", LobbySchema);

mongoose.connect(mongoDBURL, { useNewUrlParser: true });
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

var cardCount = 0;
app.get('/app/draw', (req, res) => {
    var c = req.cookies;
    if (c && c.lobby) {
        Lobby.findOne({_id: c.lobby.id}).exec( (err, result) => {
            if (err || !result) {
                res.end(JSON.stringify(-1));
            } else {
                var card = result.deck.remaining.pop();

                res.end(generateCard(5, "red"));
            }
        });
    } else {
        res.end(JSON.stringify(-1));
    }
});

function generateCard(value, color) {
    var cardID = "card" + cardCount;
    var newCard = "";
    newCard += '<div class="card" style="background-color:' + color + ';" id=' + cardID +
               ' onmouseover="followMouse(\'on\', this);" ' +
               'onmouseout="followMouse(\'off\', this);" ' + 
               'onclick="makeMove(this);"' + '>' + '<div class="topLeftText"><b>' +
               value + '</b></div>' + '<div class="loop" style="background-color:' +
               color +  ';"><div class="cardText"><b>' + value + '</b></div></div>' + 
               '<div class="bottomRightText"><b>' + value + '</b></div></div>'
    cardCount++;
    return newCard;
}

/* WIP: do with but with js
    db.lobbies.findOneAndUpdate(
        {"_id": ObjectId("61a5a00de153f294840d4dd3")}, 
        {$pull : {player0: "blue7"}}
        )

    WIP: how to add to
    db.lobbies.findOneAndUpdate(
        {"_id": ObjectId("61a5a00de153f294840d4dd3")},
        {$push : {player0: "blue7"}}
        )
*/
app.post('/app/playedCard', (req, res) => {
    var c = req.cookies;
    if (c && c.lobby) {
        Lobby.findOne({_id: c.lobby.id}).exec( (err, result) => {
            if (err || !result) {
                res.end(JSON.stringify(-1));
            } else {
                if (result.turn == c.lobby.player) {
                    var color = req.body.color;
                    var value = req.body.value;
                    // Lobby.findOneAndUpdate({_id: c.lobby.id}, {$pull:})
                    result.deck.played.push("" + color + value);
                    // result.turn = result.turn + 1 % 4;
                    result.save((err) => {
                        if (err) {
                            res.end(JSON.stringify(-1));
                        } else {
                            res.end(JSON.stringify(["Remove", playedCard(value, color)]));
                        }
                    });
                } else {
                    res.end("Keep");
                }
            }
        });
    }
});

function playedCard(value, color) {
    var newCard = "";
    newCard += '<div class="card" style="background-color:' + color + ';">' + 
               '<div class="topLeftText"><b>' + value + '</b></div>' +
               '<div class="loop" style="background-color:' + color + 
               ';"><div class="cardText"><b>' + value + '</b></div></div>' + 
               '<div class="bottomRightText"><b>' + value + '</b></div></div>'
    return newCard;
}

app.post('/app/createLobby', (req, res) => {
    var newLobby = new Lobby(req.body)
    newLobby.save(function (err) {
        if (err) console.log('ERROR FINDING LOBBY')
        else {
            res.cookie("lobby", {id: newLobby._id, player: 0})
            res.end("Lobby Created");
        }
    })
});

app.post('/login', (req, res) => {
    var user = {username: req.body.username, password: req.body.password}
    User.findOne(user).exec( (err, result) => {
        if (err || !result) {
            res.end(JSON.stringify(-1));
        } else {
            addSession(req.body.username);
            res.cookie("username", req.body.username);
            res.end("LOGIN");
        }
    });
});

app.post('/createUser', (req, res) => {
    User.findOne({username: req.body.username}).exec( (err, result) => {
        if (err || result) {
            return res.end("User already exist");
        } else {
            var temp = new User(req.body);
            temp.save((err) => {
                err ? res.end("db error occurred") : res.end("User Created!");
            });
        }
    });
});

var sessions = {};
var second = 1000; var minute = 60*second; var hour = 60*minute;
const LOGIN_TIME = 10*minute;

function filterSessions() {
    for (x in sessions) {
        if (sessions[x] + LOGIN_TIME < Date.now()) {
            delete sessions[x];
        }
    }
}
setInterval(filterSessions, 2000);


function addSession(username) { sessions[username] = Date.now(); }


app.use('/app/*', (req, res, next) => {
    var c = req.cookies;
    if (c && c.username) {
        if (c.username in sessions) {
            addSession(c.username);
            next();
        } else { res.redirect('/public/index.html'); }
    } else { res.redirect('/public/index.html'); }
});


app.use(express.static('public_html'));
app.get('/*', (req, res) => { res.redirect('/app/lobby.html'); });

app.listen(80, () => { console.log('server has started'); });