# /pg-boss-project/app/Dockerfile

# 1. Node.js 18-alpine (가벼운 버전)을 기반으로 시작
FROM node:18-alpine

# 2. 앱 디렉터리 설정
WORKDIR /usr/src/app

# 3. package.json과 package-lock.json을 먼저 복사 (캐시 활용)
COPY package*.json ./

# 4. 타입스크립트 설정 파일 복사
COPY tsconfig.json ./

# 5. 의존성 설치
RUN npm install

# 6. 타입스크립트 소스 코드 복사
COPY src ./src

# 7. 타입스크립트 빌드
RUN npm run build

# 8. 앱이 3000번 포트를 사용함을 명시
EXPOSE 3000

# 9. 컨테이너 실행 명령어
CMD [ "npm", "start" ]