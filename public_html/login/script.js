function login() {
    $.post('/login', 
    { username: $('#usernameLogin').val(),
      password: $('#passwordLogin').val()
    }, (data, status) => {
        alert(data)
        window.location.href = '/login/lobby.html';
    })
}

function createUser() {
    $.post('/createUser', 
    { username: $('#username').val(),
      password: $('#password').val()
    }, (data, status) => {
        alert(data)
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