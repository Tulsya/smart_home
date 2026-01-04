FROM golang:1.24-alpine

WORKDIR /app

# Копировать все файлы из backend папки
COPY . .

# Загрузить зависимости
RUN go mod download

# Собрать приложение
RUN go build -o main .

# Запустить
CMD ["./main"]
