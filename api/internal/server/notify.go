package server

import (
	"bytes"
	"context"
	"fmt"
	"html/template"
	"strings"
	texttemplate "text/template"
	"time"

	"github.com/archangelgt/helpdesk/api/internal/i18n"
	"github.com/archangelgt/helpdesk/api/internal/mail"
	"github.com/archangelgt/helpdesk/api/internal/pb"
)

type implMail struct {
	Heading   string
	Intro     string
	Ticket    pb.Ticket
	Company   string
	Stage     *pb.Stage
	Progress  TicketProgress
	Stages    []pb.Stage
	PortalURL string
}

var implMailFuncs = map[string]any{
	"labelStage": func(code string) string { return i18n.T(i18n.ES, "stage."+code) },
	"shortDate":  shortDate,
	"stageColor": func(estado string) string {
		switch estado {
		case "hecha":
			return "#2f6b4f"
		case "en_curso":
			return "#2a5f78"
		case "pausada":
			return "#9a6b1f"
		default:
			return "#5c6b62"
		}
	},
}

var implMailHTML = template.Must(template.New("impl").Funcs(implMailFuncs).Parse(`<!DOCTYPE html>
<html lang="es"><body style="margin:0;padding:0;background:#eef2ef;font-family:Arial,Helvetica,sans-serif;color:#152018">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2ef;padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden">
  <tr><td style="background:#b54a2a;color:#fff7f2;padding:20px 28px">
    <div style="font-size:13px;opacity:.85">Ticket {{.Ticket.Number}}{{if .Company}} · {{.Company}}{{end}}</div>
    <div style="font-size:22px;font-weight:bold;margin-top:4px">{{.Heading}}</div>
  </td></tr>
  <tr><td style="padding:24px 28px">
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5">{{.Intro}}</p>
    <p style="margin:0 0 4px;font-size:13px;color:#5c6b62">Proyecto</p>
    <p style="margin:0 0 18px;font-size:16px;font-weight:bold">{{.Ticket.Subject}}</p>
    {{if .Progress.HasStages}}
    <p style="margin:0 0 6px;font-size:13px;color:#5c6b62">Avance general: <strong style="color:#152018">{{.Progress.Percent}}%</strong> ({{.Progress.Done}} de {{.Progress.Total}} etapas)</p>
    <div style="background:#e3e9e5;border-radius:6px;height:10px;margin:0 0 20px"><div style="background:#2f6b4f;border-radius:6px;height:10px;width:{{.Progress.Percent}}%"></div></div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px">
      <tr style="color:#5c6b62;font-size:12px;text-align:left">
        <th style="padding:6px 8px;border-bottom:1px solid #d7dfda">Etapa</th>
        <th style="padding:6px 8px;border-bottom:1px solid #d7dfda">Estado</th>
        <th style="padding:6px 8px;border-bottom:1px solid #d7dfda">Fechas plan</th>
      </tr>
      {{range .Stages}}
      <tr{{if and $.Stage (eq .ID $.Stage.ID)}} style="background:#fbf1ec"{{end}}>
        <td style="padding:8px;border-bottom:1px solid #eef2ef">{{.Name}}</td>
        <td style="padding:8px;border-bottom:1px solid #eef2ef;color:{{stageColor .Estado}};font-weight:bold">{{labelStage .Estado}}</td>
        <td style="padding:8px;border-bottom:1px solid #eef2ef;color:#5c6b62">{{shortDate .FechaPlanInicio}} – {{shortDate .FechaPlanFin}}</td>
      </tr>
      {{end}}
    </table>
    {{end}}
    <p style="margin:24px 0 0"><a href="{{.PortalURL}}" style="display:inline-block;background:#b54a2a;color:#fff7f2;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:bold">Ver avance en el portal</a></p>
  </td></tr>
  <tr><td style="padding:14px 28px;background:#f4f7f5;color:#5c6b62;font-size:12px">Soporte ERPSYS · Este es un aviso automático; puedes responder a este correo si tienes dudas.</td></tr>
</table>
</td></tr></table>
</body></html>`))

var implMailText = texttemplate.Must(texttemplate.New("impl").Funcs(implMailFuncs).Parse(`{{.Heading}}
Ticket {{.Ticket.Number}}{{if .Company}} · {{.Company}}{{end}}

{{.Intro}}

Proyecto: {{.Ticket.Subject}}
{{if .Progress.HasStages}}Avance general: {{.Progress.Percent}}% ({{.Progress.Done}} de {{.Progress.Total}} etapas)

{{range .Stages}}- {{.Name}}: {{labelStage .Estado}} ({{shortDate .FechaPlanInicio}} – {{shortDate .FechaPlanFin}})
{{end}}{{end}}
Ver avance en el portal: {{.PortalURL}}

Soporte ERPSYS
`))

// notifyImplementationCreated avisa al cliente que se abrió su ticket de implementación.
func (s *Server) notifyImplementationCreated(ticketID string) {
	s.notifyAsync(ticketID, func(t *pb.Ticket, stages []pb.Stage, _ TicketProgress) (implMail, string, bool) {
		intro := "Hemos creado el ticket de implementación de tu proyecto. Te iremos notificando por este medio el avance de cada etapa."
		return implMail{Heading: "Iniciamos tu implementación", Intro: intro},
			fmt.Sprintf("[%s] Iniciamos tu implementación: %s", t.Number, t.Subject), true
	})
}

// notifyStageChanged avisa al cliente cuando una etapa cambia de estado.
func (s *Server) notifyStageChanged(ticketID, stageID, prevEstado string) {
	s.notifyAsync(ticketID, func(t *pb.Ticket, stages []pb.Stage, prog TicketProgress) (implMail, string, bool) {
		var st *pb.Stage
		for i := range stages {
			if stages[i].ID == stageID {
				st = &stages[i]
			}
		}
		if st == nil || st.Estado == prevEstado {
			return implMail{}, "", false
		}
		m := implMail{Stage: st}
		var subject string
		switch st.Estado {
		case "en_curso":
			m.Heading = "Etapa iniciada: " + st.Name
			m.Intro = fmt.Sprintf("Comenzamos a trabajar en la etapa «%s» de tu implementación.", st.Name)
			subject = fmt.Sprintf("[%s] Etapa iniciada: %s", t.Number, st.Name)
		case "hecha":
			if allStagesDone(stages) {
				m.Heading = "Implementación completada"
				m.Intro = fmt.Sprintf("Completamos la etapa «%s», la última de tu implementación. ¡Gracias por tu confianza!", st.Name)
				subject = fmt.Sprintf("[%s] Implementación completada: %s", t.Number, t.Subject)
			} else {
				m.Heading = "Etapa completada: " + st.Name
				m.Intro = fmt.Sprintf("Completamos la etapa «%s». El avance de tu implementación es de %d%%.", st.Name, prog.Percent)
				subject = fmt.Sprintf("[%s] Etapa completada: %s (%d%%)", t.Number, st.Name, prog.Percent)
			}
		case "pausada":
			m.Heading = "Etapa en pausa: " + st.Name
			m.Intro = fmt.Sprintf("La etapa «%s» quedó en pausa. Nuestro equipo se pondrá en contacto contigo si necesitamos algo de tu parte.", st.Name)
			subject = fmt.Sprintf("[%s] Etapa en pausa: %s", t.Number, st.Name)
		default:
			return implMail{}, "", false
		}
		return m, subject, true
	})
}

type implMailBuilder func(t *pb.Ticket, stages []pb.Stage, prog TicketProgress) (implMail, string, bool)

func (s *Server) notifyAsync(ticketID string, build implMailBuilder) {
	if !s.mailer.Enabled() {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
		defer cancel()
		if err := s.sendImplementationMail(ctx, ticketID, build); err != nil {
			s.log.Printf("notify ticket %s: %v", ticketID, err)
		}
	}()
}

func (s *Server) sendImplementationMail(ctx context.Context, ticketID string, build implMailBuilder) error {
	t, err := s.pb.GetTicket(ctx, ticketID)
	if err != nil {
		return err
	}
	to := strings.TrimSpace(t.RequesterEmail)
	if t.Type != "implementacion" || to == "" {
		return nil
	}
	stages, err := s.pb.ListStages(ctx, ticketID)
	if err != nil {
		return err
	}
	prog := computeProgress(stages)
	data, subject, ok := build(t, stages, prog)
	if !ok {
		return nil
	}
	data.Ticket = *t
	data.Stages = stages
	data.Progress = prog
	data.PortalURL = s.cfg.PublicURL + "/portal/tickets/" + t.ID
	if t.Tenant != "" {
		if tn, err := s.pb.GetTenant(ctx, t.Tenant); err == nil {
			data.Company = tn.Name
		}
	}
	var html, text bytes.Buffer
	if err := implMailHTML.Execute(&html, data); err != nil {
		return err
	}
	if err := implMailText.Execute(&text, data); err != nil {
		return err
	}
	if err := s.mailer.Send(mail.Message{To: []string{to}, Subject: subject, Text: text.String(), HTML: html.String()}); err != nil {
		_, _ = s.pb.CreateComment(ctx, ticketID, "No se pudo enviar el correo a "+to+": "+err.Error(), "interno", "sistema")
		return err
	}
	_, _ = s.pb.CreateComment(ctx, ticketID, "Correo enviado a "+to+": "+subject, "interno", "sistema")
	return nil
}

// computeProgress cuenta las pausadas como resueltas; aquí solo cuentan las hechas.
func allStagesDone(stages []pb.Stage) bool {
	for _, st := range stages {
		if st.Estado != "hecha" {
			return false
		}
	}
	return len(stages) > 0
}

// shortDate convierte "2026-09-30 00:00:00.000Z" o "2026-09-30" a "30/09/2026".
func shortDate(v string) string {
	if len(v) < 10 {
		return v
	}
	d, err := time.Parse("2006-01-02", v[:10])
	if err != nil {
		return v
	}
	return d.Format("02/01/2006")
}
