<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>플랫포머 어드벤처</title>
    <style>
        body {
            margin: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background-color: #333; /* 어두운 배경색 */
            color: white;
            font-family: 'Arial', sans-serif;
        }
        #gameContainer {
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        canvas {
            border: 2px solid #fff; /* 캔버스 테두리 */
            background-color: #555; /* 캔버스 배경색 */
            box-shadow: 0 0 15px rgba(255, 255, 255, 0.3);
        }
        #controlsInfo {
            margin-top: 15px;
            font-size: 0.9em;
            text-align: center;
        }
        #controlsInfo p {
            margin: 5px 0;
        }
    </style>
</head>
<body>
    <div id="gameContainer">
        <canvas id="gameCanvas"></canvas>
        <div id="controlsInfo">
            <p><strong>조작법:</strong></p>
            <p>이동: ← → (화살표 키)</p>
            <p>점프: 스페이스바</p>
            <p>공격: 'A' 키</p>
            <p>재시작 (게임 오버 시): 'R' 키</p>
        </div>
    </div>
    <script src="game.js"></script>
</body>
</html>
```javascript
// game.js

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 캔버스 크기 설정
canvas.width = 800;
canvas.height = 500;
console.log("캔버스 초기화 완료:", canvas.width, "x", canvas.height);

// --- 게임 요소 객체 및 배열 ---

// 플레이어 설정
const player = {
    x: 100,
    y: canvas.height - 70, // 초기 y 위치 (바닥 플랫폼 위에서 시작하도록)
    width: 30,
    height: 50,
    color: '#4A90E2',
    speed: 4,
    dx: 0,
    dy: 0,
    jumpStrength: 11,
    gravity: 0.45,
    isGrounded: false,
    facingDirection: 'right',
    attackCooldown: 400,
    lastAttackTime: 0,
    health: 3,
    maxHealth: 3,
    isInvincible: false,
    invincibilityDuration: 1500,
    lastHitTime: 0
};
console.log("플레이어 객체 초기화:", JSON.parse(JSON.stringify(player))); // 객체 복사해서 출력

// 발사체 설정
const projectiles = [];
const projectileRadius = 6;
const projectileSpeed = 8;
const projectileColor = '#F5A623';

// 플랫폼 설정
const platforms = [
    { x: 0, y: canvas.height - 40, width: canvas.width, height: 40, color: '#6B8E23' },
    { x: 150, y: canvas.height - 120, width: 180, height: 20, color: '#8B4513' },
    { x: 400, y: canvas.height - 200, width: 150, height: 20, color: '#8B4513' },
    { x: 50, y: canvas.height - 300, width: 120, height: 20, color: '#8B4513' },
    { x: 600, y: canvas.height - 350, width: 100, height: 20, color: '#8B4513' }
];
console.log("플랫폼 개수:", platforms.length);

// 적 설정
const enemies = [
    { x: 200, y: platforms[1].y - 30, width: 30, height: 30, color: '#C0392B', alive: true, speed: 0.7, direction: 1, originalX: 200, patrolRange: 60 },
    { x: 450, y: platforms[2].y - 30, width: 30, height: 30, color: '#C0392B', alive: true, speed: 0, direction: 1, originalX: 450, patrolRange: 0 },
    { x: 650, y: platforms[0].y - 30, width: 30, height: 30, color: '#C0392B', alive: true, speed: 1, direction: -1, originalX: 650, patrolRange: 80 }
];
let score = 0;

const keys = {
    ArrowLeft: false,
    ArrowRight: false,
    Space: false,
    KeyA: false
};

// --- 그리기 함수들 ---

function drawPlayer() {
    // console.log(`플레이어 그리기 시도: x=${player.x}, y=${player.y}, health=${player.health}, invincible=${player.isInvincible}`); // 너무 자주 호출되므로 필요시 주석 해제
    if (player.isInvincible && Math.floor((Date.now() - player.lastHitTime) / 100) % 2 === 0) {
        // console.log("플레이어 무적 상태 깜빡임 - 이번 프레임은 그리지 않음");
        return; // 무적 깜빡임 효과
    }
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);

    ctx.fillStyle = 'white';
    const eyeXOffset = player.facingDirection === 'right' ? player.width * 0.65 : player.width * 0.15;
    ctx.fillRect(player.x + eyeXOffset, player.y + player.height * 0.2, 6, 6);
}

function drawPlatforms() {
    platforms.forEach(platform => {
        ctx.fillStyle = platform.color;
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
    });
}

function drawProjectiles() {
    projectiles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.closePath();
    });
}

function drawEnemies() {
    enemies.forEach(enemy => {
        if (enemy.alive) {
            ctx.fillStyle = enemy.color;
            ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
        }
    });
}

function drawUI() {
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`점수: ${score}`, 20, 30);

    ctx.textAlign = 'right';
    let healthDisplay = "체력: ";
    for(let i=0; i < player.maxHealth; i++) {
        healthDisplay += (i < player.health) ? "❤️" : "🖤";
    }
    ctx.fillText(healthDisplay, canvas.width - 20, 30);

    if (player.health <= 0) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = '40px Arial';
        ctx.fillStyle = 'red';
        ctx.textAlign = 'center';
        ctx.fillText('게임 오버', canvas.width / 2, canvas.height / 2 - 20);
        ctx.font = '20px Arial';
        ctx.fillStyle = 'white';
        ctx.fillText('다시 시작하려면 R 키를 누르세요', canvas.width / 2, canvas.height / 2 + 20);
    }
}

function clearCanvas() {
    ctx.fillStyle = '#555';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// --- 업데이트 함수들 (게임 로직) ---

function updatePlayer() {
    if (player.health <= 0 && !gameRunning) return; // 게임 오버 상태면 업데이트 안함 (gameRunning으로 이미 제어)

    if (keys.ArrowLeft) {
        player.x -= player.speed;
        player.facingDirection = 'left';
    }
    if (keys.ArrowRight) {
        player.x += player.speed;
        player.facingDirection = 'right';
    }

    if (keys.Space && player.isGrounded) {
        player.dy = -player.jumpStrength;
        player.isGrounded = false;
    }

    player.dy += player.gravity;
    player.y += player.dy;
    player.isGrounded = false;

    platforms.forEach(platform => {
        if (player.x < platform.x + platform.width &&
            player.x + player.width > platform.x &&
            player.y + player.height >= platform.y &&
            player.y + player.height - player.dy <= platform.y + 1 && // 이전 y 위치는 플랫폼 위였고
            player.dy >= 0) {
            player.y = platform.y - player.height;
            player.dy = 0;
            player.isGrounded = true;
        }
        if (player.x < platform.x + platform.width &&
            player.x + player.width > platform.x &&
            player.y <= platform.y + platform.height &&
            player.y - player.dy >= platform.y + platform.height -1 &&
            player.dy < 0) {
            player.y = platform.y + platform.height;
            player.dy = 0.1;
        }
    });

    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

    if (player.y + player.height > canvas.height && !player.isGrounded) {
        player.health -=1;
        console.log("플레이어 추락! 현재 체력:", player.health);
        if(player.health > 0) {
            player.x = 100;
            player.y = canvas.height - 70;
            player.dy = 0;
            player.isGrounded = true; // 추락 후에는 땅에 있도록 설정
            player.isInvincible = true;
            player.lastHitTime = Date.now();
        }
    }

    const now = Date.now();
    if (keys.KeyA && (now - player.lastAttackTime > player.attackCooldown)) {
        const projectile = {
            x: player.facingDirection === 'right' ? player.x + player.width + projectileRadius : player.x - projectileRadius,
            y: player.y + player.height / 2,
            radius: projectileRadius,
            color: projectileColor,
            dx: player.facingDirection === 'right' ? projectileSpeed : -projectileSpeed
        };
        projectiles.push(projectile);
        player.lastAttackTime = now;
    }

    if (player.isInvincible && (Date.now() - player.lastHitTime > player.invincibilityDuration)) {
        player.isInvincible = false;
        // console.log("플레이어 무적 상태 해제");
    }
}

function updateProjectiles() {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.x += p.dx;
        if (p.x - p.radius > canvas.width || p.x + p.radius < 0) {
            projectiles.splice(i, 1);
        }
    }
}

function updateEnemies() {
    // if (player.health <= 0 && !gameRunning) return; // 게임 오버 시 적 업데이트 중단 (gameRunning으로 제어)

    enemies.forEach(enemy => {
        if (enemy.alive && enemy.speed > 0) {
            enemy.x += enemy.speed * enemy.direction;
            if (enemy.x < enemy.originalX - enemy.patrolRange || enemy.x + enemy.width > enemy.originalX + enemy.patrolRange + enemy.width) {
                 enemy.direction *= -1;
                 if(enemy.x < enemy.originalX - enemy.patrolRange) enemy.x = enemy.originalX - enemy.patrolRange;
                 if(enemy.x + enemy.width > enemy.originalX + enemy.patrolRange + enemy.width) enemy.x = enemy.originalX + enemy.patrolRange;
            }
        }
    });
}

function checkCollisions() {
    // if (player.health <= 0 && !gameRunning) return; // 게임 오버 시 충돌 감지 중단 (gameRunning으로 제어)

    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            if (enemy.alive &&
                p.x - p.radius < enemy.x + enemy.width &&
                p.x + p.radius > enemy.x &&
                p.y - p.radius < enemy.y + enemy.height &&
                p.y + p.radius > enemy.y) {
                enemy.alive = false;
                projectiles.splice(i, 1);
                score += 10;
                console.log("적 명중! 현재 점수:", score);
                break;
            }
        }
    }

    if (!player.isInvincible) {
        enemies.forEach(enemy => {
            if (enemy.alive &&
                player.x < enemy.x + enemy.width &&
                player.x + player.width > enemy.x &&
                player.y < enemy.y + enemy.height &&
                player.y + player.height > enemy.y) {
                player.health--;
                player.isInvincible = true;
                player.lastHitTime = Date.now();
                console.log("플레이어 피격! 현재 체력:", player.health, "무적 상태 시작");

                if (player.health > 0) {
                     player.x = 100;
                     player.y = canvas.height - 70;
                     player.dy = 0;
                     player.isGrounded = true; // 피격 후 땅에 있도록 설정
                } else {
                    console.log("플레이어 체력 0. 게임 오버.");
                }
            }
        });
    }
}

function resetGame() {
    console.log("게임 리셋 시작");
    player.x = 100;
    player.y = canvas.height - 70;
    player.dx = 0;
    player.dy = 0;
    player.health = player.maxHealth;
    player.isGrounded = false; // 시작 시 공중에 약간 떠있다가 떨어지도록
    player.isInvincible = false;
    player.facingDirection = 'right';
    player.lastAttackTime = 0;
    player.lastHitTime = 0;

    projectiles.length = 0;

    enemies.forEach(enemy => {
        enemy.alive = true;
        enemy.x = enemy.originalX;
    });
    // 적 y 위치 재설정
    enemies[0].y = platforms[1].y - enemies[0].height;
    enemies[1].y = platforms[2].y - enemies[1].height;
    enemies[2].y = platforms[0].y - enemies[2].height;

    score = 0;
    gameRunning = true;
    console.log("게임 리셋 완료. gameRunning:", gameRunning);
}

let gameRunning = true;
function gameLoop() {
    clearCanvas();

    if (gameRunning) {
        updatePlayer();
        updateProjectiles();
        updateEnemies();
        checkCollisions();

        if (player.health <= 0) {
            gameRunning = false; // 게임 로직 업데이트 중단
            console.log("게임 루프 내에서 게임 오버 감지. gameRunning:", gameRunning);
        }
    }

    // 그리기 함수들은 게임 실행 여부와 관계없이 호출 (게임오버 화면 등)
    drawPlatforms();
    drawEnemies();
    drawProjectiles();
    drawPlayer(); // 플레이어는 항상 그림 (게임 오버 시에도 마지막 모습)
    drawUI();     // UI도 항상 그림 (점수, 체력, 게임오버 메시지)

    requestAnimationFrame(gameLoop);
}

// --- 키보드 이벤트 리스너 ---
function handleKeyDown(e) {
    if (e.code === 'ArrowLeft') keys.ArrowLeft = true;
    if (e.code === 'ArrowRight') keys.ArrowRight = true;
    if (e.code === 'Space') keys.Space = true;
    if (e.code === 'KeyA') keys.KeyA = true;

    if (!gameRunning && e.code === 'KeyR' && player.health <= 0) {
        resetGame();
    }
}

function handleKeyUp(e) {
    if (e.code === 'ArrowLeft') keys.ArrowLeft = false;
    if (e.code === 'ArrowRight') keys.ArrowRight = false;
    if (e.code === 'Space') keys.Space = false;
    if (e.code === 'KeyA') keys.KeyA = false;
}

document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', keyUp); // 오타 수정: keyUp -> handleKeyUp

// --- 게임 시작 ---
// 적 y 위치 초기화 (platforms 배열이 정의된 후에)
enemies[0].y = platforms[1].y - enemies[0].height;
enemies[1].y = platforms[2].y - enemies[1].height;
enemies[2].y = platforms[0].y - enemies[2].height;
console.log("초기 적 y 위치 설정 완료");

console.log("게임 루프 시작 직전");
gameLoop();
console.log("첫 게임 루프 호출됨");
