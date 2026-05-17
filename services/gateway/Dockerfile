# syntax=docker/dockerfile:1
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=6 \
  CMD wget -qO- http://127.0.0.1:8080/health >/dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]

