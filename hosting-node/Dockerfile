FROM python:3.12-slim
WORKDIR /app
COPY server.py /app/server.py
ENV MEDIA_NODE_DATA=/data
ENV MEDIA_NODE_PORT=8788
VOLUME ["/data"]
EXPOSE 8788
CMD ["python", "/app/server.py"]
