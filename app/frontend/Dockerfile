FROM node:20-alpine

WORKDIR /app

# 💡 Cloud-Native: 빌드 타임에 외부 주소(VIP 등)를 주입받기 위한 설정
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1

# 패키지 파일 복사 및 의존성 설치
COPY package*.json ./
RUN npm install

# 소스 코드 복사 및 Next.js 빌드
COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]