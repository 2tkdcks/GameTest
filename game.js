const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 캔버스 크기 설정 (필요에 따라 조절)
canvas.width = 800;
canvas.height = 500;

// 게임 요소 설정
const player = {
    x: 100,
    y: canvas.height - 50, // 초기 위치 (바닥에 있도록)
    width: 30,
    height: 50,
    color: 'blue',
    speed: 5,
    dx: 0,
    dy: 0, // 수직 속도
    jumpStrength: 12,
    gravity: 0.5,
    isGrounded: false,
    facingDirection: 'right', // 'left' 또는 'right'
    isAttacking: false, // 현재는 발사체에만 사용, 추후 플레이어 애니메이션 등에 활용 가능
    attackCooldown: 500, // 공격 쿨다운 (밀리초)
    lastAttackTime: 0
};

const projectiles = [];
const projectileRadius = 5;
const projectileSpeed = 7;
const projectileColor = 'red';

const platforms = [
    { x: 0, y: canvas.height - 20, width: canvas.width, height: 20, color: 'green' }, // 바닥
    { x: 150, y: canvas.height - 100, width: 200, height: 20, color: 'saddlebrown' },
    { x: 400, y: canvas.height - 180, width: 150, height: 20, color: 'saddlebrown' },
    { x: 50, y: canvas.height - 280, width: 100, height: 20, color: 'saddlebrown' }
];

const enemies = [
    { x: 200, y: platforms[1].y - 30, width: 30, height: 30, color: 'purple', alive: true, speed: 0.5, direction: 1, originalX: 200, patrolRange: 50 },
    { x: 450, y: platforms[2].y - 30, width: 30, height: 30, color: 'purple', alive: true, speed: 0, direction: 1, originalX: 450, patrolRange: 0 }, // 정지된 적
    { x: 600, y: platforms[0].y - 30, width: 30, height: 30, color: 'purple', alive: true, speed: 0.8, direction: -1, originalX: 600, patrolRange: 70 }
];

// 키 입력 상태
const keys = {
    ArrowLeft: false,
    ArrowRight: false,
    Space: false,
    KeyA: false // 'a' 키
};

// --- 그리기 함수들 ---
function drawPlayer() {
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // 간단한 시선 표현 (옵션)
    ctx.fillStyle = 'white';
    if (player.facingDirection === 'right') {
        ctx.fillRect(player.x + player.width * 0.7, player.y + player.height * 0.2, 5, 5);
    } else {
        ctx.fillRect(player.x + player.width * 0.1, player.y + player.height * 0.2, 5, 5);
    }
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

// 화면 지우기
function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// --- 업데이트 함수들 ---
function updatePlayer() {
    // 좌우 이동
    if (keys.ArrowLeft) {
        player.x -= player.speed;
        player.facingDirection = 'left';
    }
    if (keys.ArrowRight) {
        player.x += player.speed;
        player.facingDirection = 'right';
    }

    // 점프
    if (keys.Space && player.isGrounded) {
        player.dy = -player.jumpStrength;
        player.isGrounded = false;
    }

    // 중력 적용
    player.dy += player.gravity;
    player.y += player.dy;
    player.isGrounded = false; // 일단 false로 두고 플랫폼 충돌 시 true로 변경

    // 플랫폼과의 충돌 처리
    platforms.forEach(platform => {
        // 플레이어가 플랫폼 위에서 아래로 떨어지는 경우 + 발이 플랫폼 상단에 닿았을 때
        if (player.x < platform.x + platform.width &&
            player.x + player.width > platform.x &&
            player.y + player.height >= platform.y && // 이전 y 위치는 플랫폼 위였고
            player.y + player.height - player.dy <= platform.y + 1 && // 현재 y 위치는 플랫폼 안이나 아래로 내려옴
            player.dy >= 0) { // 아래로 떨어지는 중일 때만
            player.y = platform.y - player.height;
            player.dy = 0;
            player.isGrounded = true;
        }
        // 머리가 플랫폼 바닥에 닿는 경우 (선택적)
        if (player.x < platform.x + platform.width &&
            player.x + player.width > platform.x &&
            player.y < platform.y + platform.height &&
            player.y + player.height > platform.y + platform.height && // 머리가 플랫폼 바닥보다 위에 있었고
            player.dy < 0) { // 위로 점프 중일 때
            player.y = platform.y + platform.height;
            player.dy = 0; // 위로 가는 속도 0
        }
    });


    // 캔버스 경계 처리 (좌우)
    if (player.x < 0) {
        player.x = 0;
    }
    if (player.x + player.width > canvas.width) {
        player.x = canvas.width - player.width;
    }
    // 캔버스 바닥 경계 (플랫폼이 없을 경우 대비)
    if (player.y + player.height > canvas.height && !player.isGrounded) {
        player.y = canvas.height - player.height;
        player.dy = 0;
        player.isGrounded = true;
    }


    // 공격 (발사체)
    const now = Date.now();
    if (keys.KeyA && (now - player.lastAttackTime > player.attackCooldown)) {
        const projectile = {
            x: player.facingDirection === 'right' ? player.x + player.width : player.x,
            y: player.y + player.height / 2,
            radius: projectileRadius,
            color: projectileColor,
            dx: player.facingDirection === 'right' ? projectileSpeed : -projectileSpeed
        };
        projectiles.push(projectile);
        player.lastAttackTime = now;
    }
}

function updateProjectiles() {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.x += p.dx;

        // 화면 밖으로 나간 발사체 제거
        if (p.x - p.radius > canvas.width || p.x + p.radius < 0) {
            projectiles.splice(i, 1);
        }
    }
}

function updateEnemies() {
    enemies.forEach(enemy => {
        if (enemy.alive && enemy.speed > 0) { // 움직이는 적인 경우
            enemy.x += enemy.speed * enemy.direction;
            // 순찰 범위 제한
            if (enemy.x < enemy.originalX - enemy.patrolRange || enemy.x + enemy.width > enemy.originalX + enemy.patrolRange + enemy.width /2) {
                 enemy.direction *= -1; // 방향 전환
                 // 범위를 벗어나지 않도록 위치 보정
                 if(enemy.x < enemy.originalX - enemy.patrolRange) enemy.x = enemy.originalX - enemy.patrolRange;
                 if(enemy.x + enemy.width > enemy.originalX + enemy.patrolRange + enemy.width /2) enemy.x = enemy.originalX + enemy.patrolRange - enemy.width/2;
            }
        }
    });
}


// --- 충돌 감지 함수 ---
function checkCollisions() {
    // 발사체 vs 적
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            if (enemy.alive &&
                p.x - p.radius < enemy.x + enemy.width &&
                p.x + p.radius > enemy.x &&
                p.y - p.radius < enemy.y + enemy.height &&
                p.y + p.radius > enemy.y) {
                enemy.alive = false; // 적 제거 (또는 체력 감소 등)
                projectiles.splice(i, 1); // 발사체 제거
                break; // 다음 발사체로 넘어감
            }
        }
    }

    // 플레이어 vs 적
    enemies.forEach(enemy => {
        if (enemy.alive &&
            player.x < enemy.x + enemy.width &&
            player.x + player.width > enemy.x &&
            player.y < enemy.y + enemy.height &&
            player.y + player.height > enemy.y) {
            // 플레이어가 적과 충돌했을 때의 로직 (예: 게임 오버, 체력 감소 등)
            console.log("플레이어와 적 충돌!");
            // 간단한 예시: 플레이어를 시작 위치로
            player.x = 100;
            player.y = canvas.height - 50;
            player.dy = 0;
        }
    });
}


// --- 게임 루프 ---
function gameLoop() {
    clearCanvas();

    updatePlayer();
    updateProjectiles();
    updateEnemies();

    checkCollisions();

    drawPlatforms();
    drawEnemies();
    drawProjectiles();
    drawPlayer();

    requestAnimationFrame(gameLoop);
}

// --- 키보드 이벤트 리스너 ---
function handleKeyDown(e) {
    if (e.code === 'ArrowLeft') keys.ArrowLeft = true;
    if (e.code === 'ArrowRight') keys.ArrowRight = true;
    if (e.code === 'Space') keys.Space = true;
    if (e.code === 'KeyA') keys.KeyA = true; // 'a' 키 (소문자 a)
}

function handleKeyUp(e) {
    if (e.code === 'ArrowLeft') keys.ArrowLeft = false;
    if (e.code === 'ArrowRight') keys.ArrowRight = false;
    if (e.code === 'Space') keys.Space = false;
    if (e.code === 'KeyA') keys.KeyA = false;
}

document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);

// --- 게임 시작 ---
gameLoop();
