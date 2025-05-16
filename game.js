console.log("game.js 스크립트 시작됨"); // 스크립트 파일 실행 여부 확인용 최상단 로그

const canvas = document.getElementById('gameCanvas');
// canvas 요소가 제대로 로드되었는지 확인
if (!canvas) {
    console.error("캔버스 요소를 찾을 수 없습니다! HTML에 'gameCanvas' ID를 가진 canvas 태그가 있는지, 스크립트가 DOM 로드 후 실행되는지 확인하세요.");
} else {
    console.log("캔버스 요소 가져오기 성공:", canvas);
}

const ctx = canvas ? canvas.getContext('2d') : null;
if (!ctx) {
    console.error("2D 컨텍스트를 가져올 수 없습니다! canvas 요소가 유효한지 확인하세요.");
} else {
    console.log("2D 컨텍스트 가져오기 성공");
}


// 캔버스 크기 설정 (ctx가 유효할 때만 실행)
if (ctx) {
    canvas.width = 800;
    canvas.height = 500;
    console.log("캔버스 크기 설정 완료:", canvas.width, "x", canvas.height);
}


// --- 게임 요소 객체 및 배열 ---

// 플레이어 설정
const player = {
    x: 100,
    y: ctx ? canvas.height - 70 : 430, // ctx가 없을 경우 기본값 사용 (오류 방지용)
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
// 플레이어 객체가 올바르게 생성되었는지 확인하기 위해 JSON.stringify와 JSON.parse를 사용 (객체 내부 값까지 확인)
console.log("플레이어 객체 초기화 시도 직후:", JSON.parse(JSON.stringify(player)));

// 발사체 설정
const projectiles = [];
const projectileRadius = 6;
const projectileSpeed = 8;
const projectileColor = '#F5A623';

// 플랫폼 설정
const platforms = [
    { x: 0, y: ctx ? canvas.height - 40 : 460, width: ctx ? canvas.width : 800, height: 40, color: '#6B8E23' },
    { x: 150, y: ctx ? canvas.height - 120 : 380, width: 180, height: 20, color: '#8B4513' },
    { x: 400, y: ctx ? canvas.height - 200 : 300, width: 150, height: 20, color: '#8B4513' },
    { x: 50, y: ctx ? canvas.height - 300 : 200, width: 120, height: 20, color: '#8B4513' },
    { x: 600, y: ctx ? canvas.height - 350 : 150, width: 100, height: 20, color: '#8B4513' }
];
console.log("플랫폼 개수:", platforms.length, "첫 플랫폼 y:", platforms[0].y);

// 적 설정
const enemies = [
    // 적 y 위치는 플랫폼 기준으로 설정되므로, platforms 배열 초기화 이후에 y값 할당
];
let score = 0;

const keys = {
    ArrowLeft: false,
    ArrowRight: false,
    Space: false,
    KeyA: false
};

// --- 그리기 함수들 --- (ctx가 유효할 때만 의미 있음)

function drawPlayer() {
    if (!ctx) return;
    if (player.isInvincible && Math.floor((Date.now() - player.lastHitTime) / 100) % 2 === 0) {
        return;
    }
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);

    ctx.fillStyle = 'white';
    const eyeXOffset = player.facingDirection === 'right' ? player.width * 0.65 : player.width * 0.15;
    ctx.fillRect(player.x + eyeXOffset, player.y + player.height * 0.2, 6, 6);
}

function drawPlatforms() {
    if (!ctx) return;
    platforms.forEach(platform => {
        ctx.fillStyle = platform.color;
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
    });
}

function drawProjectiles() {
    if (!ctx) return;
    projectiles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.closePath();
    });
}

function drawEnemies() {
    if (!ctx) return;
    enemies.forEach(enemy => {
        if (enemy.alive) {
            ctx.fillStyle = enemy.color;
            ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
        }
    });
}

function drawUI() {
    if (!ctx) return;
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
    if (!ctx) return;
    ctx.fillStyle = '#555';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// --- 업데이트 함수들 (게임 로직) ---

function updatePlayer() {
    if (!ctx || (player.health <= 0 && !gameRunning)) return;

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
            player.y + player.height - player.dy <= platform.y + 1 &&
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
            player.isGrounded = true;
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
    }
}

function updateProjectiles() {
    if (!ctx) return;
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.x += p.dx;
        if (p.x - p.radius > canvas.width || p.x + p.radius < 0) {
            projectiles.splice(i, 1);
        }
    }
}

function updateEnemies() {
    if (!ctx) return;
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
    if (!ctx || (player.health <= 0 && !gameRunning)) return;

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
                     player.isGrounded = true;
                } else {
                    console.log("플레이어 체력 0. 게임 오버.");
                }
            }
        });
    }
}

function resetGame() {
    if (!ctx) {
        console.error("resetGame 호출되었으나 ctx가 없어 실행 불가");
        return;
    }
    console.log("게임 리셋 시작");
    player.x = 100;
    player.y = canvas.height - 70;
    player.dx = 0;
    player.dy = 0;
    player.health = player.maxHealth;
    player.isGrounded = false;
    player.isInvincible = false;
    player.facingDirection = 'right';
    player.lastAttackTime = 0;
    player.lastHitTime = 0;

    projectiles.length = 0;

    enemies.forEach(enemy => { // 적 정보 초기화
        enemy.alive = true;
        enemy.x = enemy.originalX;
        // y 위치도 플랫폼 기준으로 재설정
        const platformIndex = enemies.indexOf(enemy); // 임시로 인덱스 사용, 더 좋은 방법은 적 객체에 플랫폼 정보 저장
        if (platformIndex === 0 && platforms[1]) enemy.y = platforms[1].y - enemy.height;
        else if (platformIndex === 1 && platforms[2]) enemy.y = platforms[2].y - enemy.height;
        else if (platformIndex === 2 && platforms[0]) enemy.y = platforms[0].y - enemy.height;

    });


    score = 0;
    gameRunning = true;
    console.log("게임 리셋 완료. gameRunning:", gameRunning);
}

let gameRunning = true;
function gameLoop() {
    if (!ctx) { // ctx가 없으면 게임 루프를 실행할 수 없음
        console.warn("gameLoop 호출되었으나 ctx가 없어 중단합니다.");
        return;
    }
    clearCanvas();

    if (gameRunning) {
        updatePlayer();
        updateProjectiles();
        updateEnemies();
        checkCollisions();

        if (player.health <= 0) {
            gameRunning = false;
            console.log("게임 루프 내에서 게임 오버 감지. gameRunning:", gameRunning);
        }
    }

    drawPlatforms();
    drawEnemies();
    drawProjectiles();
    drawPlayer();
    drawUI();

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
document.addEventListener('keyup', handleKeyUp); // 이전 코드의 오타 수정됨

// --- 게임 시작 전 초기화 ---
function initializeGameElements() {
    if (!ctx) {
        console.error("게임 요소 초기화 실패: ctx가 없습니다.");
        return;
    }
    // 적 y 위치 초기화 (platforms 배열이 정의된 후에)
    // enemies 배열을 여기서 다시 정의하거나, y 값만 업데이트
    enemies.length = 0; // 기존 적 배열 비우기
    enemies.push(
        { x: 200, y: platforms[1].y - 30, width: 30, height: 30, color: '#C0392B', alive: true, speed: 0.7, direction: 1, originalX: 200, patrolRange: 60 },
        { x: 450, y: platforms[2].y - 30, width: 30, height: 30, color: '#C0392B', alive: true, speed: 0, direction: 1, originalX: 450, patrolRange: 0 },
        { x: 650, y: platforms[0].y - 30, width: 30, height: 30, color: '#C0392B', alive: true, speed: 1, direction: -1, originalX: 650, patrolRange: 80 }
    );
    console.log("적 y 위치 및 배열 초기화 완료. 첫 번째 적 y:", enemies[0] ? enemies[0].y : "없음");
}


// --- 게임 시작 ---
if (ctx) { // ctx가 성공적으로 로드되었을 때만 게임 시작
    initializeGameElements();
    console.log("게임 루프 시작 직전");
    gameLoop();
    console.log("첫 게임 루프 호출됨");
} else {
    console.error("ctx가 유효하지 않아 게임을 시작할 수 없습니다.");
}
