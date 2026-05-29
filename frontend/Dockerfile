# Stage 1: Build
FROM node:18-alpine AS build

# Pass build args to make them available during compile
ARG REACT_APP_API_BASE_URL
ARG REACT_APP_AUTH_SERVICE
ARG REACT_APP_FAST_FOOD_SERVICE
ARG REACT_APP_RESTAURANT_SERVICE

ENV REACT_APP_API_BASE_URL=$REACT_APP_API_BASE_URL
ENV REACT_APP_AUTH_SERVICE=$REACT_APP_AUTH_SERVICE
ENV REACT_APP_FAST_FOOD_SERVICE=$REACT_APP_FAST_FOOD_SERVICE
ENV REACT_APP_RESTAURANT_SERVICE=$REACT_APP_RESTAURANT_SERVICE

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
