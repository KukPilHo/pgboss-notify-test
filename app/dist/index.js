"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _b, _c, _d, _e, _f;
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const pg_boss_1 = __importDefault(require("pg-boss"));
const port = Number((_a = process.env.PORT) !== null && _a !== void 0 ? _a : 3000);
const boss = new pg_boss_1.default({
    host: (_b = process.env.DB_HOST) !== null && _b !== void 0 ? _b : 'localhost',
    port: Number((_c = process.env.DB_PORT) !== null && _c !== void 0 ? _c : 5432),
    database: (_d = process.env.DB_NAME) !== null && _d !== void 0 ? _d : 'pgboss',
    user: (_e = process.env.DB_USER) !== null && _e !== void 0 ? _e : 'user',
    password: (_f = process.env.DB_PASSWORD) !== null && _f !== void 0 ? _f : 'password',
});
const app = (0, express_1.default)();
app.use(express_1.default.json());
const QUEUE_NAME = 'send-alert';
async function setupWorker() {
    await boss.work(QUEUE_NAME, async (jobs) => {
        var _a;
        for (const job of jobs) {
            const message = (_a = job.data) === null || _a === void 0 ? void 0 : _a.message;
            if (!message) {
                console.warn(`⚠️ [알림 데이터 없음] jobId=${job.id}`);
                continue;
            }
            console.log(`✅ [알림 발송 성공] ${message}`);
        }
    });
}
app.post('/schedule-notification', async (req, res) => {
    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'message가 필요합니다.' });
    }
    try {
        await boss.send(QUEUE_NAME, { message }, { startAfter: '10 seconds' });
        return res.status(200).send('10초 뒤 알림이 예약되었습니다.');
    }
    catch (error) {
        console.error('작업 예약 실패:', error);
        return res.status(500).send('서버 오류 발생');
    }
});
async function startServer() {
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
    }
    catch (error) {
        console.error('서버 시작 실패:', error);
        process.exit(1);
    }
}
boss.on('error', (error) => console.error(error));
void startServer();
