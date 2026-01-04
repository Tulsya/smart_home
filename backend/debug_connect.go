package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/lib/pq"
)

func debugMain() {
	dsn := os.Getenv("DATABASE_URL")
	fmt.Printf("DSN from env: %s\n", dsn)

	if dsn == "" {
		log.Fatal("DATABASE_URL is empty!")
	}

	// Try to connect
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatalf("Failed to open connection: %v", err)
	}
	defer db.Close()

	// Try to ping
	err = db.Ping()
	if err != nil {
		log.Fatalf("Failed to ping: %v", err)
	}

	fmt.Println("✅ Connection successful!")

	// Try to query users
	rows, err := db.Query("SELECT id, username FROM users LIMIT 3")
	if err != nil {
		log.Fatalf("Query failed: %v", err)
	}
	defer rows.Close()

	fmt.Println("✅ Query successful! Users:")
	for rows.Next() {
		var id int
		var username string
		rows.Scan(&id, &username)
		fmt.Printf("  - ID: %d, Username: %s\n", id, username)
	}
}
