# Official production image; same release as the locally validated Twenty server.
FROM twentycrm/twenty:v2.50.1@sha256:6398458f42b760312aa59c4ade78cbaaa62063a0817e42cb21c66628fc310b3f
COPY --chown=1000:1000 deploy/native-ui/ /app/crm-native-ui/
RUN node /app/crm-native-ui/apply.mjs
COPY --chown=1000:1000 deploy/railway/preflight.mjs /app/railway-preflight.mjs
COPY --chown=1000:1000 --chmod=755 deploy/railway/entrypoint.sh /app/railway-entrypoint.sh
ENV NODE_ENV=production NODE_PORT=3000
EXPOSE 3000
ENTRYPOINT ["/app/railway-entrypoint.sh"]
CMD ["node", "dist/main"]
