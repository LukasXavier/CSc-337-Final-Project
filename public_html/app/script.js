/**
 * Author: Eric Mendoza (ericmendoza@email.arizona.edu)
 * Author: Luke Ramirez (lucasxavier@email.arizona.edu)
 * File: script.js
 * Assignment: Final Project
 * Course: CSc 337; Fall 21
 * Purpose: 
 */

/*
108 cards
25 each color 2 sets of (0-9, skip (@), +2, reverse (%))
8 wild cards (4 wild cards, 4 +4 wild cards)
*/
const socket = io();
cardCount = 0;
colors = ['green', 'blue', 'red', 'yellow']

function followMouse(state, card) {
    state == "on" ? y = -50 : y = 0;
    $("#" + card.id).css("transform", "translateY(" + y + "px)");
}

function draw() {
    $.get('/app/draw',
    (data) => {
        if (data == -1) {
            alert("Something went wrong with the server, try clearing your cookies");
        } 
    });
}

function getGame() {
    $.get('/app/rejoinLobby',
    (data) => {
        if (data == -1) {
            alert("Something went wrong with the server, try clearing your cookies");
        } 
        else if (data == "Lobby Full") {
            alert("The Lobby is Full");
        }
        else if (data == "Lobby Joined") {
            socket.emit("getGame")
        }
    });
}

socket.on("receiveGame", (data) => {
    $("#cardGroup1").children(".card").remove();
    $("#cardGroup2").children(".cardBack2").remove();
    $("#cardGroup3").children(".cardBack3").remove();
    $("#cardGroup4").children(".cardBack4").remove();
    data[0].forEach(card => { 
        $("#cardGroup1").append(card); 
    });
    
    $(".playedCards").children(".card").remove();
    $(".playedCards").append(data[1]);

    for (let i = 2; i < 5; i++) {
        $("#cardGroup" + i).append(opponentCard(i, data[i]));
    }
})

function opponentCard(player, amount) {
    out = ""
    for (let index = 0; index < amount; index++) {
        out += '<img class="cardBack' + player + '" src="images/CardBack' + player + '.png"></img> '
    }
    return out
}

function makeMove(card) {
    var cardVal = $("#" + card.id).children()[0].innerText
    var cardColor = $("#" + card.id).attr("style").split(" ")[1].replace(";", "")
    if ($(".playedCards").children().length == 0) {
        var lastPlayedCardVal = cardVal
        var lastPlayedCardColor = cardColor
    }
    else {
        var lastPlayedCardVal = $(".playedCards").children()[0].innerText.split("\n")[0]
        var lastPlayedCardColor = $(".playedCards").children().attr("style").split(":")[1].replace(";", "")
    }
    if (cardVal == lastPlayedCardVal || cardColor == lastPlayedCardColor) {
        $.post('/app/playedCard', { 
            value: cardVal,
            color: cardColor,
            id: card.id
            }, (data, status) => {
                data = JSON.parse(data);
                if (data == -1) {
                    alert("Something went wrong with the server, try reloading the page");
                }
        })
    }
}

function createLobby() {
    $.post('/app/createLobby',
    {lobbyCode: $('#lobbyCreateID').val()},
    (data, status) => {
        if (data == -1) {
            alert("Something went wrong with the server, try clearing your cookies")
        }
        else if (data == "Lobby Invalid") {
            alert("Lobby Already Created")
        }
        else {
            alert(data)
            window.location.href = '/app/uno.html';
        }
    })
}

function joinLobby() {
    $.post('/app/joinLobby',
    {lobbyCode: $('#lobbyJoinID').val()},
    (data, status) => {
        if (data == -1) {
            alert("Something went wrong with the server, try clearing your cookies");
        } 
        else if (data == "Lobby Full") {
            alert("The Lobby is Full");
        }
        else if (data == "Lobby Invalid") {
            alert("Lobby ID Not Created");
        }
        else {
            alert(data)
            window.location.href = '/app/uno.html';
        }
    })
}

socket.on("lobbyFull", () => {
    alert("The Lobby is Full")
})

socket.on("clearCookie", () => {
    $.post('/app/clearCookie')
})

socket.on("playerDisconnected", () => {
    $.post('/app/playerLeft')
})