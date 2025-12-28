FROM golang:1.21-alpine
WORKDIR /app
COPY backend/main.go .
COPY backend/go.mod backend/go.sum ./
RUN go mod download
RUN go build -o main main.go
CMD ["./main"]
