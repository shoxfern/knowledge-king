const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const csv = require('csv-parser');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let questions = [];
let scores = {};
let currentQ = 0;
let answeredOrder = [];
let timer = null;
let timeLeft = 10;

fs.createReadStream('questions.csv')
  .pipe(csv())
  .on('data', row => questions.push(row));

function startTimer() {
  timeLeft = 10;
  answeredOrder = [];
  clearInterval(timer);
  io.emit('timer', timeLeft);

  timer = setInterval(() => {
    timeLeft--;
    io.emit('timer', timeLeft);
    if (timeLeft <= 0) endQuestion();
  }, 1000);
}

function endQuestion() {
  clearInterval(timer);
  io.emit('reveal', questions[currentQ].answer);
}

io.on('connection', socket => {
  socket.on('join', name => {
    scores[socket.id] = { name, score: 0 };
    socket.emit('question', questions[currentQ]);
    io.emit('scores', scores);
    startTimer();
  });

  socket.on('answer', choice => {
    if (answeredOrder.includes(socket.id)) return;
    answeredOrder.push(socket.id);

    const correct = questions[currentQ].answer;
    if (choice === correct) {
      const rank = answeredOrder.length;
      const points = rank === 1 ? 10 : rank === 2 ? 8 : rank === 3 ? 6 : 5;
      scores[socket.id].score += points;
      socket.emit('result', { correct: true, points });
    } else {
      socket.emit('result', { correct: false, points: 0 });
    }
    io.emit('scores', scores);
  });

  socket.on('next', () => {
    currentQ++;
    io.emit('question', questions[currentQ]);
    startTimer();
  });
});

server.listen(3000);
