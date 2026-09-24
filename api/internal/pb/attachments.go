package pb

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"path"
	"strings"
)

type Attachment struct {
	ID      string `json:"id"`
	Ticket  string `json:"ticket"`
	Stage   string `json:"stage"`
	Kind    string `json:"kind"` // ticket | evidence
	File    string `json:"file"`
	Note    string `json:"note"`
	Author  string `json:"author"`
	Created string `json:"created"`
	Updated string `json:"updated"`
}

func (c *Client) ListAttachments(ctx context.Context, ticketID string) ([]Attachment, error) {
	q := url.Values{}
	q.Set("filter", fmt.Sprintf("ticket='%s'", escapeFilter(ticketID)))
	q.Set("sort", "-created")
	q.Set("perPage", "200")
	var out listResponse[Attachment]
	if err := c.doJSON(ctx, http.MethodGet, "/api/collections/ticket_attachments/records?"+q.Encode(), nil, &out); err != nil {
		return nil, err
	}
	return out.Items, nil
}

func (c *Client) ListStageEvidence(ctx context.Context, stageID string) ([]Attachment, error) {
	q := url.Values{}
	q.Set("filter", fmt.Sprintf("stage='%s' && kind='evidence'", escapeFilter(stageID)))
	q.Set("sort", "-created")
	q.Set("perPage", "50")
	var out listResponse[Attachment]
	if err := c.doJSON(ctx, http.MethodGet, "/api/collections/ticket_attachments/records?"+q.Encode(), nil, &out); err != nil {
		return nil, err
	}
	return out.Items, nil
}

func (c *Client) GetAttachment(ctx context.Context, id string) (*Attachment, error) {
	var out Attachment
	if err := c.doJSON(ctx, http.MethodGet, "/api/collections/ticket_attachments/records/"+url.PathEscape(id), nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) CreateAttachment(ctx context.Context, ticketID, stageID, kind, note, author, filename string, content []byte, contentType string) (*Attachment, error) {
	if kind == "" {
		kind = "ticket"
	}
	if author == "" {
		author = "agente"
	}
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	filename = path.Base(strings.ReplaceAll(filename, "\\", "/"))
	if filename == "" || filename == "." || filename == "/" {
		filename = "archivo"
	}

	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	_ = w.WriteField("ticket", ticketID)
	if stageID != "" {
		_ = w.WriteField("stage", stageID)
	}
	_ = w.WriteField("kind", kind)
	_ = w.WriteField("note", strings.TrimSpace(note))
	_ = w.WriteField("author", strings.TrimSpace(author))

	h := make(textproto.MIMEHeader)
	h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="file"; filename="%s"`, escapeQuotes(filename)))
	h.Set("Content-Type", contentType)
	part, err := w.CreatePart(h)
	if err != nil {
		return nil, err
	}
	if _, err := part.Write(content); err != nil {
		return nil, err
	}
	if err := w.Close(); err != nil {
		return nil, err
	}

	var out Attachment
	if err := c.doMultipart(ctx, http.MethodPost, "/api/collections/ticket_attachments/records", w.FormDataContentType(), &buf, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) AttachmentFileURL(ctx context.Context, a Attachment) (string, error) {
	if a.File == "" {
		return "", fmt.Errorf("attachment has no file")
	}
	colID, err := c.collectionID(ctx, "ticket_attachments")
	if err != nil {
		return "", err
	}
	return c.baseURL + "/api/files/" + url.PathEscape(colID) + "/" + url.PathEscape(a.ID) + "/" + url.PathEscape(a.File), nil
}

func (c *Client) DownloadAttachmentFile(ctx context.Context, a Attachment) (io.ReadCloser, string, error) {
	fileURL, err := c.AttachmentFileURL(ctx, a)
	if err != nil {
		return nil, "", err
	}
	if err := c.ensureToken(ctx); err != nil {
		return nil, "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fileURL, nil)
	if err != nil {
		return nil, "", err
	}
	c.mu.Lock()
	token := c.token
	c.mu.Unlock()
	req.Header.Set("Authorization", token)
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		defer resp.Body.Close()
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return nil, "", fmt.Errorf("download file: %s (%s)", resp.Status, strings.TrimSpace(string(b)))
	}
	ct := resp.Header.Get("Content-Type")
	return resp.Body, ct, nil
}

func (c *Client) doMultipart(ctx context.Context, method, path, contentType string, body io.Reader, out any) error {
	if err := c.ensureToken(ctx); err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, body)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", contentType)
	c.mu.Lock()
	token := c.token
	c.mu.Unlock()
	req.Header.Set("Authorization", token)
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("%s %s: %s (%s)", method, path, resp.Status, strings.TrimSpace(string(raw)))
	}
	if out == nil || len(raw) == 0 {
		return nil
	}
	return json.Unmarshal(raw, out)
}

func escapeQuotes(s string) string {
	return strings.ReplaceAll(strings.ReplaceAll(s, `\`, `\\`), `"`, `\"`)
}

func attachmentsCollection(ticketColID, stageColID string) map[string]any {
	return map[string]any{
		"name": "ticket_attachments", "type": "base",
		"listRule": nil, "viewRule": nil, "createRule": nil, "updateRule": nil, "deleteRule": nil,
		"fields": []map[string]any{
			{
				"name": "ticket", "type": "relation", "required": true,
				"collectionId": ticketColID, "maxSelect": 1, "cascadeDelete": true,
			},
			{
				"name": "stage", "type": "relation", "required": false,
				"collectionId": stageColID, "maxSelect": 1, "cascadeDelete": true,
			},
			{
				"name": "kind", "type": "select", "required": true, "maxSelect": 1,
				"values": []string{"ticket", "evidence"},
			},
			{
				"name": "file", "type": "file", "required": true, "maxSelect": 1,
				"maxSize": 15728640,
				"mimeTypes": []string{
					"image/jpeg", "image/png", "image/webp", "image/gif",
					"application/pdf", "text/plain", "application/zip",
					"application/msword",
					"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
					"application/vnd.ms-excel",
					"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				},
			},
			{"name": "note", "type": "text", "required": false, "max": 500},
			{"name": "author", "type": "text", "required": false, "max": 120},
			{"name": "created", "type": "autodate", "onCreate": true, "onUpdate": false},
			{"name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true},
		},
	}
}
