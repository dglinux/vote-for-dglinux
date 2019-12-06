FROM node:12-alpine

LABEL maintainer="AUTUMN"

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 12345

CMD [ "npm", "run", "server" ]