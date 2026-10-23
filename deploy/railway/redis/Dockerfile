FROM redis:7.4-alpine@sha256:57e4255cc971b1c8d6f8a6ca283ac01bc3ecdd914273ef6bfaede87aaecd6541
COPY --chmod=755 deploy/railway/redis/entrypoint.sh /usr/local/bin/crm-redis-entrypoint
ENTRYPOINT ["/usr/local/bin/crm-redis-entrypoint"]
CMD ["redis-server", "/tmp/crm-redis.conf"]
