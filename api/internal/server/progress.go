package server

import (
	"fmt"
	"time"

	"github.com/archangelgt/helpdesk/api/internal/pb"
)

// TicketProgress is derived from stages: hecha + pausada count as resolved.
type TicketProgress struct {
	Total     int
	Done      int
	Percent   int
	Label     string
	HasStages bool
	Current   string
	Finished  bool
	Overdue   bool
}

func stageResolved(estado string) bool {
	return estado == "hecha" || estado == "pausada"
}

func computeProgress(stages []pb.Stage) TicketProgress {
	p := TicketProgress{Total: len(stages), HasStages: len(stages) > 0}
	if !p.HasStages {
		return p
	}
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	for _, st := range stages {
		if stageResolved(st.Estado) {
			p.Done++
		} else if stageOverdue(st, today) {
			p.Overdue = true
		}
	}
	p.Percent = int(float64(p.Done) / float64(p.Total) * 100)
	p.Label = fmt.Sprintf("%d / %d", p.Done, p.Total)
	p.Finished = p.Done == p.Total
	for _, st := range stages {
		if st.Estado == "en_curso" {
			p.Current = st.Name
			return p
		}
	}
	for _, st := range stages {
		if !stageResolved(st.Estado) {
			p.Current = st.Name
			return p
		}
	}
	return p
}

func stageOverdue(st pb.Stage, today time.Time) bool {
	if stageResolved(st.Estado) || st.FechaPlanFin == "" {
		return false
	}
	fin, err := time.Parse("2006-01-02", st.FechaPlanFin)
	if err != nil {
		return false
	}
	return fin.Before(today)
}

// statusFromStages maps stage completion to stored ticket status (compat / filters).
func statusFromStages(stages []pb.Stage) string {
	if len(stages) == 0 {
		return ""
	}
	done := 0
	active := false
	for _, st := range stages {
		switch {
		case stageResolved(st.Estado):
			done++
		case st.Estado == "en_curso":
			active = true
		}
	}
	if done == len(stages) {
		return "resuelto"
	}
	if active || done > 0 {
		return "en_proceso"
	}
	return "abierto"
}

func avanceForEstado(estado string, fallback float64) float64 {
	switch estado {
	case "hecha", "pausada":
		return 100
	case "pendiente":
		return 0
	case "en_curso":
		if fallback > 0 && fallback < 100 {
			return fallback
		}
		return 50
	default:
		return fallback
	}
}

func stageClass(estado string) string {
	switch estado {
	case "hecha":
		return "stage-done"
	case "pausada":
		return "stage-paused"
	case "en_curso":
		return "stage-active"
	default:
		return "stage-todo"
	}
}

const finishedHideAfter = 14 * 24 * time.Hour

// boardLane: atrasados | activos | terminados | "" (hidden)
func boardLane(t pb.Ticket, prog TicketProgress) string {
	if prog.HasStages {
		if prog.Finished {
			if ticketFinishedTooOld(t) {
				return ""
			}
			return "terminados"
		}
		if prog.Overdue {
			return "atrasados"
		}
		return "activos"
	}
	switch t.Status {
	case "resuelto", "cerrado":
		if ticketFinishedTooOld(t) {
			return ""
		}
		return "terminados"
	default:
		return "activos"
	}
}

func ticketFinishedTooOld(t pb.Ticket) bool {
	raw := t.Updated
	if raw == "" {
		raw = t.Created
	}
	if raw == "" {
		return false
	}
	for _, layout := range []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02 15:04:05.999Z",
		"2006-01-02 15:04:05.999",
		"2006-01-02 15:04:05Z",
		"2006-01-02 15:04:05",
	} {
		if ts, err := time.Parse(layout, raw); err == nil {
			return time.Since(ts) > finishedHideAfter
		}
	}
	return false
}

