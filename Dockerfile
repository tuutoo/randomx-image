FROM node:lts-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src

EXPOSE 3000
ENV PORT=3000
ENV IMAGE_DIR=/app/images

CMD ["npm", "start"]
