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
cardCount = 0;
colors = ['green', 'blue', 'red', 'yellow']
document.addEventListener('DOMContentLoaded', function() {
    // makeCard(7)
    // makeOpponentCard(7, 2)
    // makeOpponentCard(7, 3)
    // makeOpponentCard(7, 4)
}, false);

function followMouse(state, card) {
    state == "on" ? y = -50 : y = 0;
    $("#" + card.id).css("transform", "translateY(" + y + "px)");
}

function draw() {
    $.get('/app/draw',
    (data) => {
        $("#cardGroup1").append(data);
    });
}

// function makeCard(amount) {
//     for (let index = 0; index < amount; index++) {
//         var num = Math.floor(Math.random() * 10)
//         var randomColor = Math.floor(Math.random() * 4)
//         $("#cardGroup1").append(playerCard(num, colors[randomColor]))
//     }
// }

// function makeOpponentCard(amount, player) {
//     for (let index = 0; index < amount; index++) {
//         $("#cardGroup" + player).append(opponentCard(player))
//     }
// }

function opponentCard(player) {
    return '<img class="cardBack' + player + '" src="images/CardBack' + player + '.png"></img>'
}

// function playerCard(value, color) {
//     var cardID = "card" + cardCount;
//     var newCard = "";
//     newCard += '<div class="card" style="background-color:' + color + ';" id=' + cardID +  
//                ' onmouseover="followMouse(\'on\', this)"' +
//                'onmouseout="followMouse(\'off\', this)"' + 
//                'onclick="makeMove(this)"' + '>' +
//                '<div class="topLeftText"><b>' + value + '</b></div>' +
//                '<div class="loop" style="background-color:' + color + 
//                ';"><div class="cardText"><b>' + value + '</b></div></div>' + 
//                '<div class="bottomRightText"><b>' + value + '</b></div></div>'
//     cardCount++;
//     return newCard;
// }

// function playedCard(value, color) {
//     var newCard = "";
//     newCard += '<div class="card" style="background-color:' + color + ';">' + 
//                '<div class="topLeftText"><b>' + value + '</b></div>' +
//                '<div class="loop" style="background-color:' + color + 
//                ';"><div class="cardText"><b>' + value + '</b></div></div>' + 
//                '<div class="bottomRightText"><b>' + value + '</b></div></div>'
//     return newCard;
// }

function makeMove(card) {
    var cardVal = $("#" + card.id).children()[0].innerText
    var cardColor = $("#" + card.id).attr("style").split(" ")[1].replace(";", "")
    $.post('/playedCard', { 
        value: cardVal,
        color: cardColor
        }, (data, status) => {
            if (data == "Remove") {
                $(".playedCards").children(".card").remove()
                $("#" + card.id).remove()
                $(".playedCards").append(playedCard(cardVal, cardColor))
            }
    })
}

function createLobby() {
    $.post('/createLobby', {
        players: {p0: [], p1: [], p2: [], p3: []},
        deck: {played: [], remaining: []},
        turn: 1
    }, (data, status) => {
        alert(data)
        window.location.href = '/app/uno.html';
    })
}