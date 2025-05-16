const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 캔버스 크기 설정
canvas.width = 600;
canvas.height = 400;

// 플레이어 설정
const player = {
    x: 50,
    y: canvas.height / 2 - 25, // 중앙에 위치하도록 y값 조정
    width: 30,
    height: 30,
    color: 'blue',
    speed: 5,
    dx: 0, // x축 이동 방향 및 속도
    dy: 0, // y축 이동 방향 및 속도
    isAttacking: false,
    attackColor: 'red',
    originalColor: 'blue',
    attackDuration: 200, // 공격 상태 지속 시간 (밀리초)
    attackTimer: null
};

// 키 입력 상태
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    Space: false
};

// 그리기 함수
function drawPlayer() {
    ctx.fillStyle = player.isAttacking ? player.attackColor : player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);
}

// 화면 지우기
function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// 플레이어 위치 업데이트
function updatePlayerPosition() {
    // 이동 방향 설정
    player.dx = 0;
    player.dy = 0;

    if (keys.ArrowUp) player.dy = -player.speed;
    if (keys.ArrowDown) player.dy = player.speed;
    if (keys.ArrowLeft) player.dx = -player.speed;
    if (keys.ArrowRight) player.dx = player.speed;

    // 대각선 이동 시 속도 보정 (선택 사항)
    if (player.dx !== 0 && player.dy !== 0) {
        player.dx /= Math.sqrt(2);
        player.dy /= Math.sqrt(2);
    }

    // 플레이어 위치 업데이트
    player.x += player.dx;
    player.y += player.dy;

    // 경계 처리 (캔버스 밖으로 나가지 않도록)
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;
    if (player.y < 0) player.y = 0;
    if (player.y + player.height > canvas.height) player.y = canvas.height - player.height;
}

// 공격 처리
function handleAttack() {
    if (keys.Space && !player.isAttacking) {
        player.isAttacking = true;
        player.color = player.attackColor; // 공격 시 색상 변경

        // 일정 시간 후 공격 상태 해제
        clearTimeout(player.attackTimer); // 이전 타이머가 있다면 초기화
        player.attackTimer = setTimeout(() => {
            player.isAttacking = false;
            player.color = player.originalColor; // 원래 색상으로 복귀
        }, player.attackDuration);
    }
}


// 게임 루프
function gameLoop() {
    clearCanvas();
    updatePlayerPosition();
    handleAttack();
    drawPlayer();
    requestAnimationFrame(gameLoop); // 다음 프레임 요청
}

// 키보드 이벤트 리스너
function keyDown(e) {
    if (e.key === 'ArrowUp' || e.key === 'Up') keys.ArrowUp = true;
    if (e.key === 'ArrowDown' || e.key === 'Down') keys.ArrowDown = true;
    if (e.key === 'ArrowLeft' || e.key === 'Left') keys.ArrowLeft = true;
    if (e.key === 'ArrowRight' || e.key === 'Right') keys.ArrowRight = true;
    if (e.code === 'Space') keys.Space = true; // e.code 사용 (e.key는 ' ' 공백)
}

function keyUp(e) {
    if (e.key === 'ArrowUp' || e.key === 'Up') keys.ArrowUp = false;
    if (e.key === 'ArrowDown' || e.key === 'Down') keys.ArrowDown = false;
    if (e.key === 'ArrowLeft' || e.key === 'Left') keys.ArrowLeft = false;
    if (e.key === 'ArrowRight' || e.key === 'Right') keys.ArrowRight = false;
    if (e.code === 'Space') keys.Space = false;
}

// 이벤트 리스너 등록
document.addEventListener('keydown', keyDown);
document.addEventListener('keyup', keyUp);

// 게임 시작
gameLoop();
