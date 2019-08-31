FROM node:carbon
MAINTAINER 콘센트 (박원호) toolscomfact@gmail.com

WORKDIR /app
ADD . /app
RUN npm install

EXPOSE 443 80

RUN node node.js