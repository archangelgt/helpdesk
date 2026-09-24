package server

import (
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"

	"github.com/archangelgt/helpdesk/api/internal/i18n"
	"github.com/go-chi/chi/v5"
)

const maxUploadBytes = 15 << 20

func (s *Server) handleUploadTicketAttachment(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	lang := langFromRequest(r)
	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		http.Redirect(w, r, "/tickets/"+id+"?err="+url.QueryEscape(i18n.T(lang, "err.upload")), http.StatusSeeOther)
		return
	}
	note := strings.TrimSpace(r.FormValue("note"))
	author := defaultSelect(r.FormValue("author"), "agente")
	file, hdr, err := r.FormFile("file")
	if err != nil {
		http.Redirect(w, r, "/tickets/"+id+"?err="+url.QueryEscape(i18n.T(lang, "err.upload_required")), http.StatusSeeOther)
		return
	}
	defer file.Close()
	content, err := io.ReadAll(io.LimitReader(file, maxUploadBytes+1))
	if err != nil || len(content) == 0 || len(content) > maxUploadBytes {
		http.Redirect(w, r, "/tickets/"+id+"?err="+url.QueryEscape(i18n.T(lang, "err.upload")), http.StatusSeeOther)
		return
	}
	ct := hdr.Header.Get("Content-Type")
	if _, err := s.pb.CreateAttachment(r.Context(), id, "", "ticket", note, author, hdr.Filename, content, ct); err != nil {
		http.Redirect(w, r, "/tickets/"+id+"?err="+url.QueryEscape(err.Error()), http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/tickets/"+id+"?ok="+url.QueryEscape(i18n.T(lang, "flash.file_uploaded")), http.StatusSeeOther)
}

func (s *Server) handleCompleteStage(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	stageID := chi.URLParam(r, "stageID")
	lang := langFromRequest(r)
	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		http.Redirect(w, r, "/tickets/"+id+"?err="+url.QueryEscape(i18n.T(lang, "err.upload")), http.StatusSeeOther)
		return
	}
	note := strings.TrimSpace(r.FormValue("note"))
	author := defaultSelect(r.FormValue("author"), "agente")

	files := r.MultipartForm.File["file"]
	if len(files) == 0 {
		// also accept single "evidence"
		if f := r.MultipartForm.File["evidence"]; len(f) > 0 {
			files = f
		}
	}
	if len(files) == 0 {
		http.Redirect(w, r, "/tickets/"+id+"?err="+url.QueryEscape(i18n.T(lang, "err.evidence_required")), http.StatusSeeOther)
		return
	}

	stages, err := s.pb.ListStages(r.Context(), id)
	if err != nil {
		http.Redirect(w, r, "/tickets/"+id+"?err="+url.QueryEscape(err.Error()), http.StatusSeeOther)
		return
	}
	var curName string
	var curOrden float64
	var curIni, curFin string
	var curAvance float64
	found := false
	for _, st := range stages {
		if st.ID == stageID {
			found = true
			curName, curOrden = st.Name, st.Orden
			curIni, curFin = st.FechaPlanInicio, st.FechaPlanFin
			curAvance = st.Avance
			break
		}
	}
	if !found {
		http.Redirect(w, r, "/tickets/"+id+"?err="+url.QueryEscape(i18n.T(lang, "err.stage_missing")), http.StatusSeeOther)
		return
	}

	uploaded := 0
	for _, hdr := range files {
		f, err := hdr.Open()
		if err != nil {
			continue
		}
		content, err := io.ReadAll(io.LimitReader(f, maxUploadBytes+1))
		f.Close()
		if err != nil || len(content) == 0 || len(content) > maxUploadBytes {
			continue
		}
		ct := hdr.Header.Get("Content-Type")
		if _, err := s.pb.CreateAttachment(r.Context(), id, stageID, "evidence", note, author, hdr.Filename, content, ct); err != nil {
			http.Redirect(w, r, "/tickets/"+id+"?err="+url.QueryEscape(err.Error()), http.StatusSeeOther)
			return
		}
		uploaded++
	}
	if uploaded == 0 {
		http.Redirect(w, r, "/tickets/"+id+"?err="+url.QueryEscape(i18n.T(lang, "err.evidence_required")), http.StatusSeeOther)
		return
	}

	if _, err := s.pb.UpdateStage(r.Context(), stageID, curName, "hecha", curOrden, avanceForEstado("hecha", curAvance), curIni, curFin); err != nil {
		http.Redirect(w, r, "/tickets/"+id+"?err="+url.QueryEscape(err.Error()), http.StatusSeeOther)
		return
	}
	_ = s.syncTicketFromStages(r, id)
	http.Redirect(w, r, "/tickets/"+id+"?ok="+url.QueryEscape(i18n.T(lang, "flash.stage_done")), http.StatusSeeOther)
}

func (s *Server) handleDownloadAttachment(w http.ResponseWriter, r *http.Request) {
	ticketID := chi.URLParam(r, "id")
	attID := chi.URLParam(r, "attID")
	att, err := s.pb.GetAttachment(r.Context(), attID)
	if err != nil || att.Ticket != ticketID {
		http.NotFound(w, r)
		return
	}
	body, ct, err := s.pb.DownloadAttachmentFile(r.Context(), *att)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	defer body.Close()
	if ct != "" {
		w.Header().Set("Content-Type", ct)
	}
	name := att.File
	if name == "" {
		name = "archivo"
	}
	w.Header().Set("Content-Disposition", `inline; filename="`+path.Base(name)+`"`)
	_, _ = io.Copy(w, body)
}
