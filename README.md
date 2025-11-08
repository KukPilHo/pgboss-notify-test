# pg-boss 알림 서버 - 완전 개발 가이드

TypeScript + PostgreSQL 기반의 백그라운드 작업 큐 시스템입니다.
**pg-boss**를 사용하여 예약 알림을 처리하는 API 서버를 Docker로 완전히 컨테이너화했습니다.

---

## 📋 목차

1. [프로젝트 개요](#-프로젝트-개요)
2. [빠른 시작](#-빠른-시작)
3. [개발 환경 및 기술 스택](#-개발-환경-및-기술-스택)
4. [프로젝트 구조](#-프로젝트-구조)
5. [각 파일 상세 설명](#-각-파일-상세-설명)
6. [전체 동작 흐름](#-전체-동작-흐름)
7. [API 사용 방법](#-api-사용-방법)
8. [로컬 개발 가이드](#-로컬-개발-가이드)
9. [트러블슈팅](#-트러블슈팅)
10. [pg-boss 고급 기능](#-pg-boss-고급-기능)
11. [실전 활용 예시](#-실전-활용-예시)

---

## 🎯 프로젝트 개요

### 이 프로젝트는 무엇인가?

- **TypeScript**로 작성된 예약 알림 API 서버
- **PostgreSQL** 기반의 작업 큐 시스템 **pg-boss** 사용
- API로 알림을 예약하면 지정된 시간 후에 워커가 자동 처리
- **Docker Compose**로 완전히 컨테이너화되어 어디서든 동일하게 실행 가능

### 주요 특징

- ✅ Redis 없이 PostgreSQL만으로 작업 큐 구현
- ✅ TypeScript로 타입 안전한 코드
- ✅ Docker로 원클릭 실행
- ✅ 자동 재시도 및 에러 처리
- ✅ 작업 예약 및 우선순위 지원

---

## 🚀 빠른 시작

### 필수 요구사항

- Docker Desktop 설치

### 실행 방법

```bash
# 1. 프로젝트 루트 디렉토리에서 실행
docker-compose up --build

# 출력 예상:
# ✓ PostgreSQL 시작
# ✓ Node.js 앱 빌드
# ✓ pg-boss가 시작되었습니다.
# ✓ 'send-alert' 큐가 준비되었습니다.
# ✓ 알림 API 서버가 http://localhost:3000 에서 실행 중입니다.
```

### 테스트

**새 터미널에서 실행:**

```bash
# 알림 예약 요청
curl -X POST http://localhost:3000/schedule-notification \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello World"}'

# 응답: "10초 뒤 알림이 예약되었습니다."

# 10초 후 docker-compose 로그에 출력됨:
# ✅ [알림 발송 성공] Hello World
```

### 종료

```bash
# Ctrl+C로 종료 후
docker-compose down

# 데이터까지 완전 삭제
docker-compose down -v
```

---

## 🛠 개발 환경 및 기술 스택

### 기술 스택

| 구분 | 기술 | 버전 |
|------|------|------|
| **언어** | TypeScript | 5.6.3 |
| **런타임** | Node.js | 18 (Alpine) |
| **프레임워크** | Express | 4.18.2 |
| **작업 큐** | pg-boss | 11.1.2 |
| **데이터베이스** | PostgreSQL | 14 |
| **컨테이너** | Docker + Docker Compose | - |

### 로컬 개발용 도구 (선택)

- Node.js 18+
- npm
- VS Code (권장)

---

## 📂 프로젝트 구조

```
pgboss-notify-test/
├── docker-compose.yml       # Docker 컨테이너 오케스트레이션
├── README.md               # 프로젝트 문서 (이 파일)
└── app/                    # Node.js 애플리케이션
    ├── Dockerfile          # Node.js 앱 이미지 빌드 설정
    ├── package.json        # npm 패키지 의존성
    ├── package-lock.json   # 의존성 버전 잠금
    ├── tsconfig.json       # TypeScript 컴파일 설정
    └── src/
        └── index.ts        # 메인 애플리케이션 코드
```

---

## 📖 각 파일 상세 설명

### 1. `docker-compose.yml` - 시스템 구성

**역할:** PostgreSQL과 Node.js 앱을 함께 실행하고 네트워크 연결

```yaml
version: '3.8'

services:
  # PostgreSQL 데이터베이스
  postgres:
    image: postgres:14-alpine          # 경량 PostgreSQL 이미지
    container_name: pgboss_db
    environment:
      POSTGRES_USER: user              # DB 사용자명
      POSTGRES_PASSWORD: password      # DB 비밀번호
      POSTGRES_DB: pgboss              # 데이터베이스명
    ports:
      - "5432:5432"                    # 호스트:컨테이너 포트 매핑
    volumes:
      - postgres_data:/var/lib/postgresql/data  # 데이터 영속성
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d pgboss"]
      interval: 5s                     # 5초마다 체크
      timeout: 5s
      retries: 5

  # Node.js 애플리케이션
  node-app:
    build:
      context: ./app                   # app 폴더의 Dockerfile 사용
    container_name: pgboss_app
    ports:
      - "3000:3000"                    # API 서버 포트
    environment:
      DB_HOST: postgres                # 컨테이너 네트워크 내 DB 주소
      DB_PORT: 5432
      DB_USER: user
      DB_PASSWORD: password
      DB_NAME: pgboss
      PORT: 3000
    depends_on:
      postgres:
        condition: service_healthy     # DB 준비 완료 후 시작
    restart: unless-stopped            # 실패시 자동 재시작

volumes:
  postgres_data:                       # DB 데이터 영속 볼륨
```

**핵심 포인트:**
- `healthcheck`: PostgreSQL이 완전히 준비될 때까지 대기
- `depends_on`: DB 준비 완료 후 앱 시작 (순서 보장)
- `volumes`: 컨테이너 재시작해도 데이터 유지

---

### 2. `app/Dockerfile` - Node.js 이미지 빌드

**역할:** TypeScript 앱을 컴파일하고 실행 가능한 Docker 이미지 생성

```dockerfile
FROM node:18-alpine                   # 경량 Node.js 베이스 이미지

WORKDIR /usr/src/app                  # 작업 디렉토리

# 1단계: 의존성 파일만 먼저 복사 (Docker 캐시 활용)
COPY package*.json ./
COPY tsconfig.json ./

# 2단계: 의존성 설치
RUN npm install

# 3단계: 소스 코드 복사
COPY src ./src

# 4단계: TypeScript 빌드
RUN npm run build

EXPOSE 3000                           # 포트 노출 (문서화 목적)

CMD [ "npm", "start" ]                # 컨테이너 실행 명령
```

**빌드 최적화:**
- package.json을 먼저 복사 → `npm install` 캐싱
- 소스 코드 변경 시 의존성 재설치 안 함

---

### 3. `app/package.json` - npm 패키지 설정

```json
{
  "name": "pgboss-notify-test",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "start:prod": "npm run build && npm run start",
    "dev": "nodemon --watch src --ext ts --exec ts-node src/index.ts"
  },
  "dependencies": {
    "express": "^4.18.2",       // HTTP 서버
    "pg": "^8.16.3",            // PostgreSQL 클라이언트
    "pg-boss": "^11.1.2"        // 작업 큐 라이브러리
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.12.12",
    "nodemon": "^3.1.10",
    "ts-node": "^10.9.2",
    "typescript": "^5.6.3"
  }
}
```

---

### 4. `app/tsconfig.json` - TypeScript 설정

```json
{
  "compilerOptions": {
    "target": "ES2019",                   // JavaScript 버전
    "module": "CommonJS",                 // Node.js 모듈 시스템
    "rootDir": "src",                     // 소스 폴더
    "outDir": "dist",                     // 컴파일 결과 폴더
    "strict": true,                       // 엄격한 타입 체크
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

---

### 5. `app/src/index.ts` - 메인 애플리케이션 코드

#### 타입 정의

```typescript
import express, { Request, Response } from 'express';
import PgBoss from 'pg-boss';

// API 요청 body 타입
type ScheduleNotificationBody = {
  message?: string;
};

// 작업 데이터 타입
type NotificationJob = {
  message: string;
};
```

#### pg-boss 설정

```typescript
const port = Number(process.env.PORT ?? 3000);

// pg-boss 인스턴스 생성
const boss = new PgBoss({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? 'pgboss',
  user: process.env.DB_USER ?? 'user',
  password: process.env.DB_PASSWORD ?? 'password',
});

const app = express();
app.use(express.json());

const QUEUE_NAME = 'send-alert';
```

#### 워커 설정 (핵심!)

```typescript
async function setupWorker(): Promise<void> {
  await boss.work<NotificationJob>(QUEUE_NAME, async (jobs) => {
    // ⚠️ pg-boss 11에서 handler는 배열을 받음!
    for (const job of jobs) {
      const message = job.data?.message;

      if (!message) {
        console.warn(`⚠️ [알림 데이터 없음] jobId=${job.id}`);
        continue;
      }

      console.log(`✅ [알림 발송 성공] ${message}`);
      // 실제로는 여기서 이메일/SMS/푸시알림 전송
    }
  });
}
```

**중요:** `boss.work()` 핸들러는 **단일 job이 아니라 jobs 배열**을 받습니다!

#### API 엔드포인트

```typescript
app.post(
  '/schedule-notification',
  async (req: Request<unknown, string, ScheduleNotificationBody>,
         res: Response<string | { error: string }>) => {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message가 필요합니다.' });
    }

    try {
      // ⚠️ startIn이 아니라 startAfter (pg-boss 11)
      await boss.send(QUEUE_NAME, { message }, { startAfter: '10 seconds' });
      return res.status(200).send('10초 뒤 알림이 예약되었습니다.');
    } catch (error) {
      console.error('작업 예약 실패:', error);
      return res.status(500).send('서버 오류 발생');
    }
  },
);
```

**주요 변경 사항:**
- ❌ `startIn` (구버전) → ✅ `startAfter` (pg-boss 11)

#### 서버 시작

```typescript
async function startServer(): Promise<void> {
  try {
    await boss.start();
    console.log('pg-boss가 시작되었습니다.');

    await boss.createQueue(QUEUE_NAME);
    console.log(`'${QUEUE_NAME}' 큐가 준비되었습니다.`);

    await setupWorker();
    console.log(`'${QUEUE_NAME}' 워커가 작업을 대기 중입니다.`);

    app.listen(port, () => {
      console.log(`알림 API 서버가 http://localhost:${port} 에서 실행 중입니다.`);
    });
  } catch (error) {
    console.error('서버 시작 실패:', error);
    process.exit(1);
  }
}

boss.on('error', (error) => console.error(error));

void startServer();
```

---

## 🔄 전체 동작 흐름

```
┌─────────────────────────────────────────────────────┐
│ 1. 시스템 시작 (docker-compose up --build)          │
└─────────────────────────────────────────────────────┘
                     │
                     ▼
   ┌─────────────────────────────────┐
   │ PostgreSQL 컨테이너 시작        │
   │ - DB 초기화                     │
   │ - healthcheck 통과 대기         │
   └─────────────────────────────────┘
                     │
                     ▼
   ┌─────────────────────────────────┐
   │ Node.js 앱 빌드 & 시작          │
   │ 1. npm install                  │
   │ 2. tsc (TypeScript → JS)        │
   │ 3. node dist/index.js           │
   └─────────────────────────────────┘
                     │
                     ▼
   ┌─────────────────────────────────┐
   │ 애플리케이션 초기화              │
   │ - pg-boss.start()               │
   │ - createQueue('send-alert')     │
   │ - setupWorker() 등록            │
   │ - Express 서버 실행 (3000)      │
   └─────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ 2. 클라이언트 요청                                   │
└─────────────────────────────────────────────────────┘
                     │
                     ▼
   ┌─────────────────────────────────┐
   │ POST /schedule-notification     │
   │ { "message": "Hello" }          │
   └─────────────────────────────────┘
                     │
                     ▼
   ┌─────────────────────────────────┐
   │ pg-boss에 작업 등록             │
   │ → PostgreSQL에 저장             │
   └─────────────────────────────────┘
                     │
                     ▼
   ┌─────────────────────────────────┐
   │ 즉시 응답: "10초 뒤 예약됨"     │
   └─────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ 3. 백그라운드 처리 (10초 후)                        │
└─────────────────────────────────────────────────────┘
                     │
                     ▼
   ┌─────────────────────────────────┐
   │ pg-boss 워커 폴링               │
   │ - DB에서 실행 가능 작업 조회    │
   └─────────────────────────────────┘
                     │
                     ▼
   ┌─────────────────────────────────┐
   │ setupWorker 핸들러 실행         │
   │ - console.log() 출력            │
   │ ✅ [알림 발송 성공] Hello       │
   └─────────────────────────────────┘
```

### 핵심 개념

1. **pg-boss는 PostgreSQL을 작업 큐로 사용**
   - Redis 같은 별도 메시지 브로커 불필요
   - 작업이 DB 테이블에 저장됨
   - 서버 재시작해도 작업 유실 없음

2. **워커는 폴링 방식**
   - 주기적으로 DB 조회
   - 실행 가능한 작업 찾으면 처리
   - 자동 재시도, 에러 처리 지원

3. **비동기 처리**
   - API는 즉시 응답 (작업 등록만)
   - 실제 처리는 백그라운드
   - 서버 부하 분산

---

## 🌐 API 사용 방법

### 엔드포인트

```
POST /schedule-notification
```

### 요청

```bash
curl -X POST http://localhost:3000/schedule-notification \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello World"}'
```

**Request Body:**
```json
{
  "message": "알림 메시지"
}
```

### 응답

**성공 (200):**
```
10초 뒤 알림이 예약되었습니다.
```

**실패 (400):**
```json
{
  "error": "message가 필요합니다."
}
```

**에러 (500):**
```
서버 오류 발생
```

### 여러 건 테스트

```bash
# 테스트 1
curl -X POST http://localhost:3000/schedule-notification \
  -H "Content-Type: application/json" \
  -d '{"message":"First notification"}'

# 테스트 2
curl -X POST http://localhost:3000/schedule-notification \
  -H "Content-Type: application/json" \
  -d '{"message":"Second notification"}'

# 테스트 3
curl -X POST http://localhost:3000/schedule-notification \
  -H "Content-Type: application/json" \
  -d '{"message":"Third notification"}'
```

---

## 💻 로컬 개발 가이드

Docker 없이 로컬에서 개발하는 방법입니다.

### 1. PostgreSQL 설치 및 설정

```bash
# macOS (Homebrew)
brew install postgresql@14
brew services start postgresql@14

# 데이터베이스 생성
createdb pgboss
```

### 2. 환경 변수 설정 (선택)

```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_USER=user
export DB_PASSWORD=password
export DB_NAME=pgboss
export PORT=3000
```

### 3. 앱 실행

```bash
# 의존성 설치
cd app
npm install

# 개발 모드 (자동 재시작)
npm run dev

# 또는 빌드 후 실행
npm run build
npm start
```

---

## 🔧 트러블슈팅

### 문제 1: TypeScript 컴파일 에러

```
error TS2339: Property 'data' does not exist on type 'Job<NotificationJob>[]'
```

**원인:** pg-boss 11에서 `work()` 핸들러가 배열을 받음

**해결:**
```typescript
// ❌ 잘못된 코드
await boss.work(QUEUE_NAME, async (job) => {
  const message = job.data.message;
});

// ✅ 올바른 코드
await boss.work(QUEUE_NAME, async (jobs) => {
  for (const job of jobs) {
    const message = job.data?.message;
  }
});
```

---

### 문제 2: startIn 옵션 에러

```
error TS2353: Object literal may only specify known properties,
and 'startIn' does not exist in type 'SendOptions'
```

**원인:** pg-boss 3.0+ 에서 `startIn` → `startAfter` 로 변경

**해결:**
```typescript
// ❌ 구버전
boss.send(queue, data, { startIn: '10 seconds' })

// ✅ 신버전
boss.send(queue, data, { startAfter: '10 seconds' })
```

---

### 문제 3: 워커가 작업을 처리하지 않음

**체크리스트:**
1. `boss.start()` 호출했는지 확인
2. `boss.createQueue()` 호출했는지 확인
3. `setupWorker()` 등록 순서 확인
4. DB 연결 상태 확인
5. 로그에 에러 메시지 확인

---

### 문제 4: Docker 빌드 실패

```bash
# Docker 캐시 삭제 후 재빌드
docker-compose down
docker system prune -a
docker-compose up --build
```

---

## 🚀 pg-boss 고급 기능

### 재시도 및 만료 설정

```typescript
boss.send(queue, data, {
  startAfter: '1 minute',
  retryLimit: 3,           // 최대 3번 재시도
  retryDelay: 60,          // 재시도 간격 60초
  retryBackoff: true,      // 지수 백오프
  expireInSeconds: 3600    // 1시간 후 만료
})
```

### 우선순위

```typescript
boss.send(queue, data, {
  priority: 10             // 높을수록 먼저 처리
})
```

### 중복 방지

```typescript
boss.send(queue, data, {
  singletonKey: 'user-123' // 같은 키는 하나만 실행
})
```

### 워커 옵션

```typescript
boss.work(queue, {
  teamSize: 5,             // 동시 처리 작업 수
  teamConcurrency: 2,      // 동시 실행 워커 수
  pollingIntervalSeconds: 5 // 폴링 간격
}, handler)
```

### 작업 모니터링

```typescript
// 진행 중인 작업 조회
const jobs = await boss.fetch(queue);

// 특정 작업 취소
await boss.cancel(jobId);

// 작업 완료 수동 처리
await boss.complete(jobId);
```

---

## 💡 실전 활용 예시

### 이메일 발송

```typescript
type EmailJob = {
  to: string;
  subject: string;
  body: string;
};

await boss.work<EmailJob>('email-queue', async (jobs) => {
  for (const job of jobs) {
    const { to, subject, body } = job.data;

    // 실제 이메일 발송 로직
    await sendEmail(to, subject, body);
    console.log(`Email sent to ${to}`);
  }
});

// API에서 사용
app.post('/send-email', async (req, res) => {
  await boss.send('email-queue', req.body);
  res.send('Email queued');
});
```

### 이미지 리사이징

```typescript
type ResizeJob = {
  imageUrl: string;
  sizes: number[];
};

await boss.work<ResizeJob>('image-resize', async (jobs) => {
  for (const job of jobs) {
    const { imageUrl, sizes } = job.data;

    for (const size of sizes) {
      await resizeImage(imageUrl, size);
    }
  }
});
```

### 예약 알림

```typescript
// 1시간 후 알림
boss.send('notification', data, { startAfter: '1 hour' });

// 특정 시간에 실행
boss.send('notification', data, { startAfter: new Date('2025-12-31 23:59:59') });

// 매일 오전 9시 (cron 사용)
boss.schedule('daily-report', '0 9 * * *', data);
```

---

## 📝 빠른 참조 카드

### Docker 명령어

```bash
# 전체 시스템 시작
docker-compose up --build

# 백그라운드 실행
docker-compose up -d

# 로그 보기
docker-compose logs -f

# 특정 서비스 로그
docker-compose logs -f node-app

# 종료
docker-compose down

# 데이터 삭제 후 종료
docker-compose down -v

# 컨테이너 접속
docker exec -it pgboss_app sh
docker exec -it pgboss_db psql -U user -d pgboss
```

### npm 명령어

```bash
cd app

# 개발 모드 (자동 재시작)
npm run dev

# 빌드
npm run build

# 프로덕션 실행
npm start

# 빌드 + 실행
npm run start:prod
```

### API 테스트

```bash
# 기본 테스트
curl -X POST http://localhost:3000/schedule-notification \
  -H "Content-Type: application/json" \
  -d '{"message":"Test"}'

# 에러 테스트
curl -X POST http://localhost:3000/schedule-notification \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## 🎓 학습 요약

이 프로젝트에서 배운 것:

1. **TypeScript + Node.js 백엔드 개발**
   - 타입 안정성
   - 비동기 처리 (async/await)
   - Express API 서버

2. **작업 큐 시스템 (pg-boss)**
   - 백그라운드 작업 처리
   - 예약 작업 (스케줄링)
   - 재시도 메커니즘

3. **Docker 컨테이너화**
   - 멀티 컨테이너 구성
   - 환경 변수 관리
   - 헬스체크 & 의존성

4. **PostgreSQL 활용**
   - 작업 큐로 활용
   - 데이터 영속성

---

## 📚 다음 단계

- [ ] 실제 이메일/SMS 발송 연동
- [ ] 작업 모니터링 대시보드
- [ ] 에러 알림 시스템 (Sentry 등)
- [ ] 성능 최적화 (인덱싱)
- [ ] AWS/GCP 배포
- [ ] CI/CD 파이프라인
- [ ] 테스트 코드 작성

---

## 📄 라이선스

MIT

---

## 🤝 기여

이슈와 Pull Request를 환영합니다!

---

**Made with ❤️ using TypeScript, pg-boss, and Docker**
