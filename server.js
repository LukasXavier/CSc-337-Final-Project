const mongoose = require('mongoose')
const express = require('express')
const app = express()
const db  = mongoose.connection
const mongoDBURL = 'mongodb://127.0.0.1/Uno'
const cookieParser = require('cookie-parser')
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(express.static('public_html'))
app.get('/', (req, res) => { res.redirect('login/index.html') })
//app.use('/app/*', authenticate)
//app.get('/', (req, res) => { res.redirect('login/index.html') })

mongoose.connect(mongoDBURL, { useNewUrlParser: true })
db.on('error', console.error.bind(console, 'MongoDB connection error:'))

var Schema = mongoose.Schema

var UserSchema = new Schema({
  username: String,
  password: String,
  stats: {wins: Number, losses: Number, streak: Number}
})
var User = mongoose.model('Users', UserSchema )

var LobbySchema = new Schema({
    players: {p0: [String], p1: [String], p2: [String], p3: [String]},
    deck: {played: [String], remaining: [String]},
    turn: Number
  })
var Lobby = mongoose.model('Lobbies', LobbySchema )


app.post('/playedCard', (req, res) => {
    Lobby.findOne({_id: req.cookies.lobby.id})
    .exec( (err, result) => {
        if (err) {return res.end('Could Not Find Lobby')}
        if (result.turn == req.cookies.lobby.player) {
            result.players.p0.push("" + req.body.color + req.body.value)
            result.deck.played.push("" + req.body.color + req.body.value)
            result.turn = result.turn + 1 % 4
            result.save(function (err) {
                if (err) console.log('ERROR SAVING LOBBY')
                res.end("Remove");
            })
        }
        else {
            res.end("Keep")
        }
    })
});

app.post('/createUser', (req, res) => {
    var newUser = new User(req.body)
    newUser.save(function (err) {
        if (err) console.log('ERROR SAVING USER')
        res.end("User Created");
    })
});

app.post('/login', (req, res) => {
    User.findOne({username: req.body.username})
    .exec( (err, result) => {
        if (err) {return res.end('Could Not Find User')}
        res.cookie("login", {username: req.body.username})
        res.end("Logged In");
    })
});

app.post('/createLobby', (req, res) => {
    var newLobby = new Lobby(req.body)
    newLobby.save(function (err) {
        if (err) console.log('ERROR FINDING LOBBY')
        else {
            res.cookie("lobby", {id: newLobby._id, player: 1})
            res.end("Lobby Created");
        }
    })
});

// opens the server on port 80
const port = 80;
app.listen(port, () => {
    console.log('server has started');
});