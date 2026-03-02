FROM golang:1.22-alpine AS builder

WORKDIR /app

COPY apps/agent/go.mod apps/agent/go.sum ./
RUN go mod download

COPY apps/agent/main.go ./
RUN go build -o /bin/lxc-agent ./main.go

FROM alpine:3.20

RUN apk add --no-cache ca-certificates

COPY --from=builder /bin/lxc-agent /usr/local/bin/lxc-agent

CMD ["/usr/local/bin/lxc-agent"]
