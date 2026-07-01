FROM mcr.microsoft.com/playwright:v1.61.1-jammy

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY src ./src

ENV PORT=3001
ENV WHATSAPP_USER_DATA_DIR=/data/user-data

EXPOSE 3001

CMD ["npm", "start"]
