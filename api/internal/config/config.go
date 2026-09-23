package config

import "os"

type Config struct {
	HTTPAddr       string
	PocketBaseURL  string
	PBAdminEmail   string
	PBAdminPassword string
	WebDir         string
}

func FromEnv() Config {
	return Config{
		HTTPAddr:        getenv("HTTP_ADDR", ":8080"),
		PocketBaseURL:   getenv("POCKETBASE_URL", "http://pocketbase:8090"),
		PBAdminEmail:    getenv("PB_ADMIN_EMAIL", "admin@helpdesk.local"),
		PBAdminPassword: getenv("PB_ADMIN_PASSWORD", "helpdesk-admin-change-me"),
		WebDir:          getenv("WEB_DIR", "web"),
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
