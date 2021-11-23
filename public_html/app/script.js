cardCount = 0;
colors = ['green', 'blue', 'red', 'yellow']

function followMouse(state, card) {
    if (state == "on") {
        $("#" + card.id).css("transform", "translateY(-50px)")
    }
    else {
        $("#" + card.id).css("transform", "translateY(0px)")
    }
}

function makeCard() {
    var num = Math.floor(Math.random() * 10)
    var randomColor = Math.floor(Math.random() * 4)
    $("#cardGroup1").append(playerCard(num, colors[randomColor]))
}

function playerCard(value, color) {
    var cardID = "card" + cardCount;
    var newCard = "";
    newCard += '<div class="card" style="background-color:' + color + ';" id=' + cardID +  
               ' onmouseover="followMouse(\'on\', this)"' +
               'onmouseout="followMouse(\'off\', this)"' + 
               'onclick="makeMove(this)"' + '>' +
               '<div class="topLeftText"><b>' + value + '</b></div>' +
               '<div class="loop" style="background-color:' + color + 
               ';"><div class="cardText"><b>' + value + '</b></div></div>' + 
               '<div class="bottomRightText"><b>' + value + '</b></div></div>'
    cardCount++;
    return newCard;
}

function playedCard(value, color) {
    var newCard = "";
    newCard += '<div class="card" style="background-color:' + color + ';">' + 
               '<div class="topLeftText"><b>' + value + '</b></div>' +
               '<div class="loop" style="background-color:' + color + 
               ';"><div class="cardText"><b>' + value + '</b></div></div>' + 
               '<div class="bottomRightText"><b>' + value + '</b></div></div>'
    return newCard;
}

function makeMove(card) {
    var cardVal = $("#" + card.id).children()[0].innerText
    var cardColor = $("#" + card.id).attr("style").split(" ")[1].replace(";", "")
    $(".playedCards").children(".card").remove()
    $("#" + card.id).remove()
    $(".playedCards").append(playedCard(cardVal, cardColor))
    $.post('/playedCard', { 
        value: cardVal,
        color: cardColor
        }, (data, status) => {
            // update the page with other player's moves
    })
}