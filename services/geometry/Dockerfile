# Hardened runtime for untrusted mesh parsing (SECURITY.md §5). Run read-only, without egress.
FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_PROJECT_ENVIRONMENT=/opt/venv
RUN pip install --no-cache-dir uv==0.9.5
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY geometry ./geometry
RUN useradd --system --uid 10001 geometry
USER 10001
EXPOSE 8001
CMD ["/opt/venv/bin/uvicorn", "geometry.app:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]
