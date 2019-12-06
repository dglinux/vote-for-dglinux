FROM node:12-alpine

LABEL maintainer="AUTUMN"

WORKDIR /usr/src/app

RUN npm config set registry http://registry.npm.taobao.org/

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 12345

CMD [ "npm", "run", "server" ]