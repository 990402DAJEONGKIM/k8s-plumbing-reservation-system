FROM node:20-alpine

WORKDIR /app

# 패키지 파일 복사 및 모듈 설치
COPY package*.json ./
RUN npm install

# 소스 코드 복사
COPY . .

EXPOSE 4000

CMD ["node", "index.js"]