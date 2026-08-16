FROM archlinux:base
RUN pacman -Syu --noconfirm python && pacman -Scc --noconfirm
WORKDIR /app
COPY policy.py store.py server.py /app/
ENV HOST_ID=open-marketplace-first-public-database-host
ENV HOST_DATA=/data
ENV MEDIA_NODE_DATA=/data
ENV MEDIA_NODE_PORT=8788
ENV HOST_MIN_REPLICAS=3
VOLUME ["/data"]
EXPOSE 8788
CMD ["python", "/app/server.py"]
