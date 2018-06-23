FROM node:latest
USER node
WORKDIR /home/node/app
ENV NODE_ENV production
EXPOSE 443
COPY ./ /home/node/app/
VOLUME ["/opt/data"]
CMD ["node","index.js"]
