import express, { Request, Response } from 'express';
import PgBoss from 'pg-boss';

type ScheduleNotificationBody = {
  message?: string;
};

type NotificationJob = {
  message: string;
};

const port = Number(process.env.PORT ?? 3000);

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

async function setupWorker(): Promise<void> {
  await boss.work<NotificationJob>(QUEUE_NAME, async (jobs) => {
    for (const job of jobs) {
      const message = job.data?.message;

      if (!message) {
        console.warn(`⚠️ [알림 데이터 없음] jobId=${job.id}`);
        continue;
      }

      console.log(`✅ [알림 발송 성공] ${message}`);
    }
  });
}

app.post(
  '/schedule-notification',
  async (req: Request<unknown, string, ScheduleNotificationBody>, res: Response<string | { error: string }>) => {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'message가 필요합니다.' });
    }

    try {
      await boss.send(QUEUE_NAME, { message }, { startAfter: '10 seconds' });
      return res.status(200).send('10초 뒤 알림이 예약되었습니다.');
    } catch (error) {
      console.error('작업 예약 실패:', error);
      return res.status(500).send('서버 오류 발생');
    }
  },
);

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

