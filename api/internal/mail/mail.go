// Package mail envía correos por SMTP (STARTTLS en 587, TLS implícito en 465).
package mail

import (
	"bytes"
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"errors"
	"fmt"
	"mime"
	"mime/quotedprintable"
	"net"
	netmail "net/mail"
	"net/smtp"
	"strconv"
	"strings"
	"time"

	"github.com/archangelgt/helpdesk/api/internal/config"
)

type Message struct {
	To      []string
	Subject string
	Text    string
	HTML    string
}

type Sender struct {
	cfg config.SMTPConfig
}

func New(cfg config.SMTPConfig) *Sender {
	return &Sender{cfg: cfg}
}

func (s *Sender) Enabled() bool {
	return s != nil && s.cfg.Host != "" && s.from() != ""
}

func (s *Sender) from() string {
	if s.cfg.From != "" {
		return s.cfg.From
	}
	return s.cfg.User
}

func (s *Sender) Send(m Message) error {
	if !s.Enabled() {
		return errors.New("smtp no configurado")
	}
	if len(m.To) == 0 {
		return errors.New("sin destinatarios")
	}
	rcpts := append([]string{}, m.To...)
	if s.cfg.Bcc != "" {
		for _, b := range strings.Split(s.cfg.Bcc, ",") {
			if b = strings.TrimSpace(b); b != "" {
				rcpts = append(rcpts, b)
			}
		}
	}
	for _, r := range rcpts {
		if _, err := netmail.ParseAddress(r); err != nil {
			return fmt.Errorf("destinatario inválido %q", r)
		}
	}
	raw := s.build(m)

	addr := net.JoinHostPort(s.cfg.Host, strconv.Itoa(s.cfg.Port))
	dialer := &net.Dialer{Timeout: 20 * time.Second}
	tlsCfg := &tls.Config{ServerName: s.cfg.Host}
	var conn net.Conn
	var err error
	if s.cfg.Port == 465 {
		conn, err = tls.DialWithDialer(dialer, "tcp", addr, tlsCfg)
	} else {
		conn, err = dialer.Dial("tcp", addr)
	}
	if err != nil {
		return err
	}
	_ = conn.SetDeadline(time.Now().Add(60 * time.Second))
	c, err := smtp.NewClient(conn, s.cfg.Host)
	if err != nil {
		conn.Close()
		return err
	}
	defer c.Close()
	if s.cfg.Port != 465 {
		if ok, _ := c.Extension("STARTTLS"); ok {
			if err := c.StartTLS(tlsCfg); err != nil {
				return err
			}
		}
	}
	if s.cfg.User != "" {
		if err := c.Auth(s.auth(c)); err != nil {
			return err
		}
	}
	if err := c.Mail(s.from()); err != nil {
		return err
	}
	for _, r := range rcpts {
		if err := c.Rcpt(r); err != nil {
			return err
		}
	}
	w, err := c.Data()
	if err != nil {
		return err
	}
	if _, err := w.Write(raw); err != nil {
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}
	return c.Quit()
}

// Office 365 solo anuncia AUTH LOGIN; el resto acepta PLAIN.
func (s *Sender) auth(c *smtp.Client) smtp.Auth {
	if _, params := c.Extension("AUTH"); !strings.Contains(strings.ToUpper(params), "PLAIN") &&
		strings.Contains(strings.ToUpper(params), "LOGIN") {
		return &loginAuth{user: s.cfg.User, pass: s.cfg.Password}
	}
	return smtp.PlainAuth("", s.cfg.User, s.cfg.Password, s.cfg.Host)
}

func (s *Sender) build(m Message) []byte {
	var b bytes.Buffer
	boundary := randHex(12)
	from := (&netmail.Address{Name: s.cfg.FromName, Address: s.from()}).String()
	header := func(k, v string) { fmt.Fprintf(&b, "%s: %s\r\n", k, v) }
	header("From", from)
	header("To", strings.Join(m.To, ", "))
	header("Subject", mime.QEncoding.Encode("utf-8", m.Subject))
	header("Date", time.Now().Format(time.RFC1123Z))
	header("Message-ID", fmt.Sprintf("<%s@%s>", randHex(16), domainOf(s.from())))
	header("MIME-Version", "1.0")
	header("Content-Type", `multipart/alternative; boundary="`+boundary+`"`)
	b.WriteString("\r\n")
	writePart(&b, boundary, "text/plain; charset=utf-8", m.Text)
	if m.HTML != "" {
		writePart(&b, boundary, "text/html; charset=utf-8", m.HTML)
	}
	fmt.Fprintf(&b, "--%s--\r\n", boundary)
	return b.Bytes()
}

func writePart(b *bytes.Buffer, boundary, contentType, body string) {
	fmt.Fprintf(b, "--%s\r\nContent-Type: %s\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n", boundary, contentType)
	qp := quotedprintable.NewWriter(b)
	_, _ = qp.Write([]byte(body))
	_ = qp.Close()
	b.WriteString("\r\n")
}

func randHex(n int) string {
	buf := make([]byte, n)
	_, _ = rand.Read(buf)
	return hex.EncodeToString(buf)
}

func domainOf(addr string) string {
	if i := strings.LastIndex(addr, "@"); i >= 0 {
		return addr[i+1:]
	}
	return "localhost"
}

type loginAuth struct {
	user, pass string
}

func (a *loginAuth) Start(server *smtp.ServerInfo) (string, []byte, error) {
	if !server.TLS {
		return "", nil, errors.New("AUTH LOGIN requiere TLS")
	}
	return "LOGIN", nil, nil
}

func (a *loginAuth) Next(fromServer []byte, more bool) ([]byte, error) {
	if !more {
		return nil, nil
	}
	switch strings.ToLower(strings.TrimSpace(string(fromServer))) {
	case "username:":
		return []byte(a.user), nil
	case "password:":
		return []byte(a.pass), nil
	}
	return nil, fmt.Errorf("respuesta AUTH LOGIN inesperada: %q", fromServer)
}
