package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/archangelgt/helpdesk/api/internal/config"
	"github.com/archangelgt/helpdesk/api/internal/pb"
	"github.com/archangelgt/helpdesk/api/internal/server"
)

func main() {
	cfg := config.FromEnv()
	logger := log.New(os.Stdout, "[helpdesk-api] ", log.LstdFlags|log.Lmsgprefix)

	client := pb.NewClient(cfg.PocketBaseURL, cfg.PBAdminEmail, cfg.PBAdminPassword)

	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	if err := client.WaitHealthy(ctx); err != nil {
		logger.Fatalf("pocketbase not ready: %v", err)
	}
	if err := client.Bootstrap(ctx); err != nil {
		logger.Fatalf("bootstrap: %v", err)
	}
	logger.Printf("pocketbase ready at %s", cfg.PocketBaseURL)

	srv := server.New(cfg, client, logger)
	httpServer := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           srv.Routes(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		logger.Printf("listening on %s", cfg.HTTPAddr)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatalf("listen: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	_ = httpServer.Shutdown(shutdownCtx)
}
