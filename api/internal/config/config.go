package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	HTTPAddr        string
	PocketBaseURL   string
	PBAdminEmail    string
	PBAdminPassword string
	WebDir          string
	SessionSecret   string
	// PublicURL es la URL pública de la app (enlaces en correos).
	PublicURL string
	SMTP      SMTPConfig
	// API del ERP (usuarios y empresas). Sin URL o token la integración queda apagada.
	ERPAPIURL   string
	ERPAPIToken string
	// Los usuarios del ERP de esta empresa (Seraph Systems) entran como maestros.
	MasterSeraphID string
}

// SMTPConfig vacío (sin Host) desactiva el envío de correos.
type SMTPConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	From     string
	FromName string
	Bcc      string
}

func FromEnv() Config {
	port, _ := strconv.Atoi(getenv("SMTP_PORT", "587"))
	return Config{
		HTTPAddr:        getenv("HTTP_ADDR", ":8080"),
		PocketBaseURL:   getenv("POCKETBASE_URL", "http://pocketbase:8090"),
		PBAdminEmail:    getenv("PB_ADMIN_EMAIL", "admin@helpdesk.local"),
		PBAdminPassword: getenv("PB_ADMIN_PASSWORD", "helpdesk-admin-change-me"),
		WebDir:          getenv("WEB_DIR", "web"),
		SessionSecret:   getenv("SESSION_SECRET", "helpdesk-dev-session-secret-change-me"),
		PublicURL:       strings.TrimRight(getenv("PUBLIC_URL", "http://localhost:3000"), "/"),
		SMTP: SMTPConfig{
			Host:     getenv("SMTP_HOST", ""),
			Port:     port,
			User:     getenv("SMTP_USER", ""),
			Password: getenv("SMTP_PASSWORD", ""),
			From:     getenv("SMTP_FROM", ""),
			FromName: getenv("SMTP_FROM_NAME", "Soporte ERPSYS"),
			Bcc:      getenv("SMTP_BCC", ""),
		},
		ERPAPIURL:   strings.TrimRight(getenv("ERP_API_URL", ""), "/"),
		ERPAPIToken:    getenv("ERP_API_TOKEN", ""),
		MasterSeraphID: getenv("MASTER_SERAPH_ID", "116077069"),
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
