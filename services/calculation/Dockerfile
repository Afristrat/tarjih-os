FROM python:3.13-slim AS builder
WORKDIR /build
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV PIP_NO_CACHE_DIR=1
COPY services/calculation/pyproject.toml ./
COPY services/calculation/src ./src
# `[api]` installe FastAPI et uvicorn ; le cœur lui-même n'a aucune dépendance.
RUN pip install --prefix=/install ".[api]"

FROM python:3.13-slim AS runner
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000
COPY --from=builder /install /usr/local
COPY services/calculation/src ./src
ENV PYTHONPATH=/app/src
# Le service ne touche à rien sur le disque : il tourne sans privilège.
RUN adduser --system --uid 1001 --group tarjih
USER tarjih
EXPOSE 8000
# La sonde n'utilise pas la clé de service : elle doit dire si le processus vit,
# pas si la configuration est bonne — sinon un jeton absent ferait redémarrer un
# conteneur parfaitement sain, en boucle.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status == 200 else 1)"
CMD ["python", "-m", "uvicorn", "tarjih_calculation.api:app", "--host", "0.0.0.0", "--port", "8000"]
