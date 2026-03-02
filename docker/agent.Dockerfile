FROM golang:1.24-alpine AS builder

WORKDIR /app

COPY apps/agent/go.mod apps/agent/go.sum ./
RUN set -eux; \
    export GOPROXY=https://proxy.golang.org,direct; \
    for i in 1 2 3 4 5; do \
      go mod download && break; \
      if [ "$i" -eq 5 ]; then exit 1; fi; \
      sleep 2; \
    done

COPY apps/agent/*.go ./
RUN go build -o /bin/vm-agent .

FROM alpine:3.20

RUN apk add --no-cache ca-certificates

COPY --from=builder /bin/vm-agent /usr/local/bin/vm-agent

CMD ["/usr/local/bin/vm-agent"]
