FROM node:latest

RUN mkdir /home/node/app/node_modules

USER node
WORKDIR /home/node/app
ENV NODE_ENV production
EXPOSE 3000
COPY ./index.js /home/node/app/
COPY ./package.json /home/node/app/
CMD ["npm","start"]
