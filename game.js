const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const livesElement = document.getElementById('lives');
const gameOverScreen = document.getElementById('gameOver');
const finalScoreElement = document.getElementById('finalScore');
const restartButton = document.getElementById('restartButton');
const gameContainer = document.getElementById('gameContainer');
const loadingScreen = document.getElementById('loading');

// Sonidos
const shootSound = document.getElementById('shootSound');
const explosionSound = document.getElementById('explosionSound');
const gameOverSound = document.getElementById('gameOverSound');
const backgroundSound = document.getElementById('backgroundSound');

// Configurar volumen del sonido de fondo
backgroundSound.volume = 0.1; // 10% del volumen

// Precargamos los sonidos
const sounds = {
    shoot: new Audio(shootSound.src),
    explosion: new Audio(explosionSound.src),
    gameOver: new Audio(gameOverSound.src)
};

// Configuración del canvas
canvas.width = 1280;
canvas.height = 580;

// Configuración del canvas para ocupar toda la pantalla
/*
let gameWidth = window.innerWidth;
let gameHeight = window.innerHeight;
canvas.width = gameWidth;
canvas.height = gameHeight;
*/

// Variables del juego
let score = 0;
let lives = 5; // ¡Ahora 5 vidas!
let gameOver = false;
let asteroids = [];
let bombs = [];
let explosions = [];
let isMouseDown = false;
let lastShotTime = 0;
const SHOT_DELAY = 100; // Retraso entre disparos en milisegundos para el efecto de ametralladora

// Clase Asteroide - Ahora un polígono wireframe
class Asteroid {
    constructor() {
        this.sides = Math.floor(Math.random() * 3) + 5; // 5 a 7 lados
        this.size = 20 + Math.random() * 20;
        this.x = Math.random() * canvas.width;
        this.y = -this.size;
        this.speed = 1.5 + Math.random() * 1.5;
        this.angle = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.05;
        this.color = '#FF0000';
    }

    draw() {
        ctx.save();
        ctx.beginPath();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.moveTo(this.size * Math.cos(0), this.size * Math.sin(0));
        
        for (let i = 1; i <= this.sides; i++) {
            const angle = (i * 2 * Math.PI) / this.sides;
            ctx.lineTo(this.size * Math.cos(angle), this.size * Math.sin(angle));
        }
        
        ctx.closePath();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.restore();
    }

    update() {
        this.y += this.speed;
        this.angle += this.rotationSpeed;
        return this.y > canvas.height + this.size;
    }
}

// Clase Bomba - Ahora un disparo láser
class Bomb {
    constructor(targetX, targetY) {
        this.x = canvas.width / 2;
        this.y = canvas.height;
        this.targetX = targetX;
        this.targetY = targetY;
        this.speed = 10;
        
        const angle = Math.atan2(targetY - this.y, targetX - this.x);
        this.dx = Math.cos(angle) * this.speed;
        this.dy = Math.sin(angle) * this.speed;
    }

    draw() {
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - this.dx * 10, this.y - this.dy * 10);
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#FF0000';
        ctx.shadowBlur = 15;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.closePath();
    }

    update() {
        this.x += this.dx;
        this.y += this.dy;
        return this.y < 0 || this.x < 0 || this.x > canvas.width;
    }
}

// Clase Explosión - Ahora círculos que se expanden
class Explosion {
    constructor(x, y, size = 1) {
        this.x = x;
        this.y = y;
        this.radius = 0;
        this.maxRadius = 40 * size;
        this.alpha = 1;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 0, 0, ${this.alpha})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = '#FF0000';
        ctx.shadowBlur = 15;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.closePath();
    }

    update() {
        this.radius += 2;
        this.alpha -= 0.02;
        return this.alpha <= 0;
    }
}

// Función para reproducir sonidos
function playSound(type) {
    try {
        const sound = new Audio(sounds[type].src);
        sound.volume = type === 'explosion' ? 0.6: 0.1;
        sound.play();
    } catch (error) {
        console.log("Error playing sound:", error);
    }
}

// Función para iniciar el sonido de fondo
function startBackgroundSound() {
    backgroundSound.play().catch(error => console.log("Error playing background sound:", error));
}

// Función para detener el sonido de fondo
function stopBackgroundSound() {
    backgroundSound.pause();
    backgroundSound.currentTime = 0;
}

// Pantalla de instrucciones
function showInstructionsScreen() {
    const overlay = document.createElement('div');
    overlay.classList.add('game-over');
    overlay.innerHTML = `
        <h1>TERRA DEFENSE</h1>
        <p>INSTRUCCIONES:</p>
        <p>Defiende la tierra de los asteroides.</p>
        <p>
            - Haz **clic** para disparar un tiro único. <br>
            - Mantén el **clic presionado** para usar ametralladora.
        </p>
        <button id="startButton">COMENZAR</button>
    `;
    document.body.appendChild(overlay);

    const startButton = document.getElementById('startButton');
    startButton.addEventListener('click', () => {
        document.body.removeChild(overlay);
        startGame();
    });
}

// Función para iniciar el juego
function startGame() {
    gameContainer.classList.remove('hidden');
    startBackgroundSound();
    gameLoop();
}

// Manejo de eventos del mouse para disparo continuo
canvas.addEventListener('mousedown', (event) => {
    if (gameOver) return;
    if (event.button === 0) { // Clic izquierdo
        isMouseDown = true;
        fireShot(event);
    }
});

canvas.addEventListener('mouseup', (event) => {
    if (event.button === 0) { // Clic izquierdo
        isMouseDown = false;
    }
});

canvas.addEventListener('mousemove', (event) => {
    if (gameOver || !isMouseDown) return;
    
    const currentTime = Date.now();
    if (currentTime - lastShotTime >= SHOT_DELAY) {
        fireShot(event);
    }
});

canvas.addEventListener('mouseleave', () => {
    isMouseDown = false;
});

// Función para manejar el disparo
function fireShot(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    bombs.push(new Bomb(x, y));
    playSound('shoot');
    lastShotTime = Date.now();
}

// Reiniciar juego
restartButton.addEventListener('click', () => {
    score = 0;
    lives = 5;
    gameOver = false;
    asteroids = [];
    bombs = [];
    explosions = [];
    scoreElement.textContent = score;
    livesElement.textContent = lives;
    gameOverScreen.classList.add('hidden');
    // Reiniciar el sonido de fondo
    startBackgroundSound();
    // Reiniciar el loop del juego
    requestAnimationFrame(gameLoop);
});

// Verificar colisiones
function checkCollisions() {
    for (let i = bombs.length - 1; i >= 0; i--) {
        for (let j = asteroids.length - 1; j >= 0; j--) {
            const dx = bombs[i].x - asteroids[j].x;
            const dy = bombs[i].y - asteroids[j].y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < asteroids[j].size) {
                explosions.push(new Explosion(bombs[i].x, bombs[i].y, asteroids[j].size / 30));
                asteroids.splice(j, 1);
                bombs.splice(i, 1);
                score += 100;
                scoreElement.textContent = score;
                playSound('explosion');
                break;
            }
        }
    }
}

// Generar asteroides
function spawnAsteroid() {
    if (Math.random() < 0.015) {
        asteroids.push(new Asteroid());
    }
}

// Loop principal del juego
function gameLoop() {
    if (gameOver) {
        stopBackgroundSound();
        return;
    }
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height); // Usa un color con opacidad para un efecto de 'rastreo'

    // Actualizar y dibujar asteroides
    for (let i = asteroids.length - 1; i >= 0; i--) {
        asteroids[i].draw();
        if (asteroids[i].update()) {
            asteroids.splice(i, 1);
            lives--;
            livesElement.textContent = lives;
            
            if (lives <= 0) {
                gameOver = true;
                finalScoreElement.textContent = score;
                gameOverScreen.classList.remove('hidden');
                stopBackgroundSound();
                playSound('gameOver');
                return;
            }
        }
    }
    
    // Actualizar y dibujar bombas
    for (let i = bombs.length - 1; i >= 0; i--) {
        bombs[i].draw();
        if (bombs[i].update()) {
            bombs.splice(i, 1);
        }
    }
    
    // Actualizar y dibujar explosiones
    for (let i = explosions.length - 1; i >= 0; i--) {
        explosions[i].draw();
        if (explosions[i].update()) {
            explosions.splice(i, 1);
        }
    }
    
    checkCollisions();
    spawnAsteroid();
    requestAnimationFrame(gameLoop);
}

// Iniciar el juego cuando la página esté lista
window.addEventListener('load', () => {
    loadingScreen.classList.add('hidden');
    showInstructionsScreen();
});