package server

import (
	"fmt"

	"github.com/archangelgt/helpdesk/api/internal/pb"
)

// TicketProgress is derived only from stage completion (hecha / total).
type TicketProgress struct {
	Total     int
	Done      int
	Percent   int
	Label     string
	HasStages bool
	Current   string
}

func computeProgress(stages []pb.Stage) TicketProgress {
	p := TicketProgress{Total: len(stages), HasStages: len(stages) > 0}
	if !p.HasStages {
		return p
	}
	for _, st := range stages {
		if st.Estado == "hecha" {
			p.Done++
		}
	}
	p.Percent = int(float64(p.Done) / float64(p.Total) * 100)
	p.Label = fmt.Sprintf("%d / %d", p.Done, p.Total)
	// Current = first en_curso, else first pendiente/bloqueada
	for _, st := range stages {
		if st.Estado == "en_curso" {
			p.Current = st.Name
			return p
		}
	}
	for _, st := range stages {
		if st.Estado != "hecha" {
			p.Current = st.Name
			return p
		}
	}
	return p
}

// statusFromStages maps stage completion to the stored ticket status (kept for compat / filters).
func statusFromStages(stages []pb.Stage) string {
	if len(stages) == 0 {
		return ""
	}
	done := 0
	active := false
	for _, st := range stages {
		switch st.Estado {
		case "hecha":
			done++
		case "en_curso", "bloqueada":
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
	case "hecha":
		return 100
	case "pendiente":
		return 0
	case "en_curso":
		if fallback > 0 && fallback < 100 {
			return fallback
		}
		return 50
	case "bloqueada":
		return fallback
	default:
		return fallback
	}
}

func stageClass(estado string) string {
	switch estado {
	case "hecha":
		return "stage-done"
	case "en_curso":
		return "stage-active"
	case "bloqueada":
		return "stage-blocked"
	default:
		return "stage-todo"
	}
}
