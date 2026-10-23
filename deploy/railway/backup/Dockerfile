FROM twentycrm/twenty:v2.50.1@sha256:6398458f42b760312aa59c4ade78cbaaa62063a0817e42cb21c66628fc310b3f
COPY --chown=1000:1000 deploy/railway/backup/ /app/crm-backup/
ENTRYPOINT ["node", "/app/crm-backup/run.mjs"]
CMD []
