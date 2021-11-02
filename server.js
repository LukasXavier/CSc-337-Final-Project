const express = require('express');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.get('/:anything', (req, res) => {
    res.end("Under Construction");
});

app.post('/:anything', (req, res) => {
    res.end("Under Construction");
});

// if no path is specified
app.use(express.static('public_html'))

// opens the server on port 80
const port = 80;
app.listen(port, () => {
console.log('server has started');
});